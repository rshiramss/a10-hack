"""
Modal LLM endpoint for MI Agent Framework.

Modal is ONLY responsible for GPU inference.
All orchestration, storage, probe training, and serving run locally.

Usage:
    modal serve modal_app.py          # deploy endpoint (stays warm)
    modal deploy modal_app.py         # permanent deployment

Set the printed URL as MI_MODAL_ENDPOINT in your local environment.
"""
from pathlib import Path

import modal

image = (
    modal.Image.debian_slim(python_version="3.11")
    .pip_install(
        "torch==2.5.1",
        "transformers>=4.45.0",
        "accelerate>=0.30.0",
        "numpy>=1.26.0",
        "sentencepiece",
        "protobuf",
    )
    .add_local_dir("src", remote_path="/root/src")
)

hf_cache_volume = modal.Volume.from_name("mi-agent-hf-cache", create_if_missing=True)
hf_secret = modal.Secret.from_name("huggingface-secret")
HF_CACHE_DIR = Path("/root/.cache/huggingface")

app = modal.App("mi-agent-llm", image=image)


@app.cls(
    gpu="A10G",
    volumes={str(HF_CACHE_DIR): hf_cache_volume},
    secrets=[hf_secret],
    min_containers=1,
)
class LLMEndpoint:
    @modal.enter()
    def load(self):
        import sqlite3
        from src.agent import SupportAgent
        conn = sqlite3.connect(":memory:")
        self.agent = SupportAgent(conn)
        self.agent._load()

    @modal.fastapi_endpoint(method="POST")
    def generate(self, payload: dict) -> dict:
        """
        Generate an agent turn.

        Request:
            {
                "messages": [{"role": ..., "content": ...}, ...],
                "tool_result": "<optional DB lookup result to inject>"
            }

        Response:
            {
                "response": str,
                "hidden_states": {"0": [...], "1": [...], ...},
                "needs_lookup": "<order_id> | null"
            }
        """
        import re
        import numpy as np

        messages = payload["messages"]
        tool_result = payload.get("tool_result")

        prompt = self.agent._format_prompt(messages)

        if tool_result:
            # Second pass: inject tool result and generate final response
            first_raw = payload.get("first_raw", "")
            prompt_with_tool = prompt + first_raw + f"\n[Database result: {tool_result}]\n"
            raw = self.agent._generate_text(prompt_with_tool)
            full_text = prompt_with_tool + raw
        else:
            raw = self.agent._generate_text(prompt)
            # Check if model wants to do a DB lookup
            if raw.upper().startswith("LOOKUP:"):
                m = re.match(r"LOOKUP:\s*(ORD-\d+)", raw, re.IGNORECASE)
                if m:
                    return {
                        "response": None,
                        "hidden_states": {},
                        "needs_lookup": m.group(1),
                        "first_raw": raw,
                    }
            full_text = prompt + raw

        hidden = self.agent.capture_hidden_states_for_text(full_text)
        return {
            "response": raw.strip(),
            "hidden_states": {str(k): v.tolist() for k, v in hidden.items()},
            "needs_lookup": None,
        }

    @modal.fastapi_endpoint(method="POST")
    def patch_hidden_states(self, payload: dict) -> dict:
        """
        Run a patched forward pass for counterfactual analysis.

        Request:
            {
                "full_text": str,
                "layer_idx": int,
                "vector": [...],
                "alpha": float
            }

        Response:
            {"hidden_states": {"0": [...], ...}}
        """
        import numpy as np

        vector = np.array(payload["vector"], dtype=np.float32)
        hidden = self.agent.patched_hidden_states_for_text(
            payload["full_text"],
            layer_idx=payload["layer_idx"],
            vector=vector,
            alpha=payload["alpha"],
        )
        return {"hidden_states": {str(k): v.tolist() for k, v in hidden.items()}}

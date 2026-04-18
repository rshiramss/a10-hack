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
        "fastapi[standard]>=0.115.0",
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
    def single_shot(self, payload: dict) -> dict:
        """
        Single-shot generation with hidden-state capture at the prompt-final token.

        Used by the insurance-claims injection-probe task. The hidden states are
        captured on the PROMPT ONLY (pre-generation) so the last-token activation
        reflects the commitment point right before the verdict is emitted.

        Request:
            {
                "system": str,
                "user": str,
                "max_new_tokens": int (optional, default 300)
            }

        Response:
            {
                "response": str,
                "hidden_states": {"0": [...], "1": [...], ...},
                "prompt_text": str
            }
        """
        system_prompt = payload["system"]
        user_prompt = payload["user"]
        max_new_tokens = int(payload.get("max_new_tokens", 300))

        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ]
        prompt = self.agent._tokenizer.apply_chat_template(
            messages, tokenize=False, add_generation_prompt=True
        )
        raw = self.agent._generate_text(prompt, max_new_tokens=max_new_tokens)
        hidden = self.agent.capture_hidden_states_for_text(prompt)
        return {
            "response": raw.strip(),
            "hidden_states": {str(k): v.tolist() for k, v in hidden.items()},
            "prompt_text": prompt,
        }

    @modal.fastapi_endpoint(method="POST")
    def ablate_and_generate(self, payload: dict) -> dict:
        """
        Single-shot generation with directional intervention on the residual
        stream at every layer whose index >= from_layer.

        Two modes (ref: Arditi et al., NeurIPS 2024):
          - ablate (alpha=None):  x' = x - (x . r_hat) r_hat
              Zero out the axis. Good when r encodes a *capability*.
          - steer  (alpha given): x' = x - alpha * r_hat
              Push activations away from the 'fired' cluster by a fixed
              amount. Good when r is a *behavior marker* and you want to
              nudge the verdict toward the 'resisted' cluster.
              alpha>0 pushes toward resisted; alpha<0 pushes toward fired
              (useful for a positive-control sanity check).

        Request:
            {
                "system": str,
                "user": str,
                "direction": [d_model floats],
                "from_layer": int,
                "alpha": float (optional; if present -> steer, else ablate),
                "max_new_tokens": int (optional, default 300)
            }
        """
        import numpy as np
        import torch

        system_prompt = payload["system"]
        user_prompt = payload["user"]
        direction = np.asarray(payload["direction"], dtype=np.float32)
        from_layer = int(payload.get("from_layer", 0))
        max_new_tokens = int(payload.get("max_new_tokens", 300))
        alpha_raw = payload.get("alpha")
        alpha = float(alpha_raw) if alpha_raw is not None else None
        mode = "steer" if alpha is not None else "ablate"

        norm = float(np.linalg.norm(direction))
        if norm < 1e-8:
            raise ValueError("direction has zero norm")
        r_hat_np = direction / norm

        agent = self.agent
        agent._load()
        r_hat = torch.tensor(r_hat_np, dtype=agent._dtype, device=agent._device)
        shift = (alpha * r_hat) if mode == "steer" else None

        def make_hook():
            if mode == "steer":
                def hook(_module, _inputs, output):
                    hidden = output[0] if isinstance(output, tuple) else output
                    hidden.sub_(shift)
                    return None
                return hook
            def hook(_module, _inputs, output):
                hidden = output[0] if isinstance(output, tuple) else output
                proj = (hidden * r_hat).sum(dim=-1, keepdim=True) * r_hat
                hidden.sub_(proj)
                return None
            return hook

        layers = list(agent._iter_layers())
        handles = [layer.register_forward_hook(make_hook())
                   for idx, layer in enumerate(layers) if idx >= from_layer]

        try:
            messages = [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ]
            prompt = agent._tokenizer.apply_chat_template(
                messages, tokenize=False, add_generation_prompt=True
            )
            raw = agent._generate_text(prompt, max_new_tokens=max_new_tokens)
        finally:
            for h in handles:
                h.remove()

        return {
            "response": raw.strip(),
            "prompt_text": prompt,
            "from_layer": from_layer,
            "mode": mode,
            "alpha": alpha,
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

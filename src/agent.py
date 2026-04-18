import re
import sqlite3
from collections.abc import Iterator
from contextlib import contextmanager
import os
from typing import Any, TYPE_CHECKING

import numpy as np

if TYPE_CHECKING:
    import torch
    from transformers import AutoModelForCausalLM, AutoTokenizer

MODEL_NAME = "Qwen/Qwen2.5-7B-Instruct"
ALT_MODEL_NAME = "Qwen/Qwen2.5-3B-Instruct"

_MODAL_ENDPOINT = os.environ.get("MI_MODAL_ENDPOINT")
_MODAL_PATCH_ENDPOINT = os.environ.get("MI_MODAL_PATCH_ENDPOINT")


def _call_modal(endpoint: str, payload: dict, max_retries: int = 6) -> dict:
    import urllib.request, json as _json, time, urllib.error
    data = _json.dumps(payload).encode()
    for attempt in range(max_retries):
        req = urllib.request.Request(endpoint, data=data, headers={"Content-Type": "application/json"})
        try:
            with urllib.request.urlopen(req, timeout=120) as resp:
                return _json.loads(resp.read())
        except urllib.error.HTTPError as e:
            if e.code == 429 and attempt < max_retries - 1:
                wait = 2 ** attempt
                print(f"  [429] rate limited, retrying in {wait}s...")
                time.sleep(wait)
            else:
                raise


def _deserialize_hidden_states(raw: dict) -> dict[int, np.ndarray]:
    return {int(k): np.array(v, dtype=np.float32) for k, v in raw.items()}

_SYSTEM_PROMPT = """You are a professional customer support agent for an e-commerce company.

You have one tool available:
  LOOKUP: <order_id>   — retrieves order details from the database

Rules:
1. If you need order information and don't have it yet, output ONLY: LOOKUP: <order_id>
2. Once you have order info (or if no lookup is needed), write your response directly.
3. Be empathetic. If the issue is legitimate, offer a concrete resolution: refund, replacement, or credit.
4. Never fabricate order details. Always look them up first.
5. Keep responses concise (2-4 sentences).
"""


def _extract_order_id(text: str) -> str | None:
    match = re.search(r"ORD-\d+", text)
    return match.group(0) if match else None


class SupportAgent:
    def __init__(self, db_conn: sqlite3.Connection, model_name: str = MODEL_NAME):
        self.db_conn = db_conn
        self.model_name = os.getenv("MI_AGENT_MODEL", model_name)
        self._tokenizer: Any = None
        self._model: Any = None
        self._capture_handles: list = []
        self._captured_hidden_states: dict[int, np.ndarray] = {}
        self._device: str | None = None
        self._dtype: Any = None

    def _load(self):
        import torch
        from transformers import AutoModelForCausalLM, AutoTokenizer

        if self._model is not None:
            return
        if self._device is None:
            self._device = "cuda" if torch.cuda.is_available() else "cpu"
            self._dtype = torch.float16 if self._device == "cuda" else torch.float32
        candidate_names = []
        for name in (self.model_name, ALT_MODEL_NAME):
            if name not in candidate_names:
                candidate_names.append(name)

        last_error = None
        for candidate in candidate_names:
            try:
                self._tokenizer = AutoTokenizer.from_pretrained(candidate)
                model_kwargs = {"dtype": self._dtype}
                if self._device == "cuda":
                    model_kwargs["device_map"] = "auto"
                self._model = AutoModelForCausalLM.from_pretrained(candidate, **model_kwargs)
                if self._device != "cuda":
                    self._model.to(self._device)
                self.model_name = candidate
                break
            except Exception as exc:
                last_error = exc
                self._tokenizer = None
                self._model = None

        if self._model is None:
            raise RuntimeError(
                "Unable to load any configured model. Set MI_AGENT_MODEL to a valid Hugging Face model ID."
            ) from last_error

        if self._tokenizer.pad_token_id is None:
            self._tokenizer.pad_token = self._tokenizer.eos_token
        self._model.eval()
        self._register_capture_hooks()

    def close(self):
        for handle in self._capture_handles:
            handle.remove()
        self._capture_handles.clear()

    @property
    def n_layers(self) -> int:
        self._load()
        return len(list(self._iter_layers()))

    def _iter_layers(self) -> Iterator[Any]:
        if hasattr(self._model, "model") and hasattr(self._model.model, "layers"):
            return iter(self._model.model.layers)
        if hasattr(self._model, "transformer") and hasattr(self._model.transformer, "h"):
            return iter(self._model.transformer.h)
        raise RuntimeError(f"Unsupported model architecture for {self.model_name}")

    def _register_capture_hooks(self):
        def make_hook(layer_idx: int):
            def hook(_module, _inputs, output):
                hidden = output[0] if isinstance(output, tuple) else output
                self._captured_hidden_states[layer_idx] = (
                    hidden[:, -1, :].detach().float().cpu().numpy().squeeze(0)
                )

            return hook

        for idx, layer in enumerate(self._iter_layers()):
            self._capture_handles.append(layer.register_forward_hook(make_hook(idx)))

    def _lookup_order(self, order_id: str) -> str:
        from .db import query_order

        record = query_order(self.db_conn, order_id)
        if record is None:
            return f"No order found with ID {order_id}."
        return (
            f"Order {record['id']}: product={record['product_name']}, qty={record['quantity']}, "
            f"total=${record['total']:.2f}, status={record['status']}, placed={record['created_at']}, "
            f"customer={record['customer_name']}"
        )

    def _format_prompt(self, conversation: list[dict]) -> str:
        messages = [{"role": "system", "content": _SYSTEM_PROMPT}] + conversation
        return self._tokenizer.apply_chat_template(
            messages,
            tokenize=False,
            add_generation_prompt=True,
        )

    def render_conversation(self, conversation: list[dict], include_generation_prompt: bool = False) -> str:
        self._load()
        messages = [{"role": "system", "content": _SYSTEM_PROMPT}] + conversation
        return self._tokenizer.apply_chat_template(
            messages,
            tokenize=False,
            add_generation_prompt=include_generation_prompt,
        )

    def _tokenize(self, text: str) -> dict[str, Any]:
        return self._tokenizer(text, return_tensors="pt").to(self._device)

    def _generate_text(self, prompt: str, max_new_tokens: int = 200) -> str:
        import torch

        with torch.no_grad():
            inputs = self._tokenize(prompt)
            output = self._model.generate(
                **inputs,
                max_new_tokens=max_new_tokens,
                do_sample=False,
                pad_token_id=self._tokenizer.eos_token_id,
            )
            new_ids = output[0][inputs["input_ids"].shape[1] :]
            return self._tokenizer.decode(new_ids, skip_special_tokens=True).strip()

    def capture_hidden_states_for_text(self, full_text: str) -> dict[int, np.ndarray]:
        import torch

        self._load()
        self._captured_hidden_states = {}
        with torch.no_grad():
            inputs = self._tokenize(full_text)
            self._model(**inputs, use_cache=False)
        return {idx: state.copy() for idx, state in self._captured_hidden_states.items()}

    @contextmanager
    def patch_layer(self, layer_idx: int, vector: np.ndarray, alpha: float = 1.0):
        import torch

        self._load()
        patch = torch.tensor(vector, dtype=self._dtype, device=self._device) * alpha
        layers = list(self._iter_layers())
        target = layers[layer_idx]

        def hook(_module, _inputs, output):
            if isinstance(output, tuple):
                hidden = output[0]
                hidden[:, -1, :] = hidden[:, -1, :] + patch
                return (hidden,) + output[1:]
            output[:, -1, :] = output[:, -1, :] + patch
            return output

        handle = target.register_forward_hook(hook)
        try:
            yield
        finally:
            handle.remove()

    def patched_hidden_states_for_text(
        self,
        full_text: str,
        *,
        layer_idx: int,
        vector: np.ndarray,
        alpha: float,
    ) -> dict[int, np.ndarray]:
        if _MODAL_PATCH_ENDPOINT:
            result = _call_modal(_MODAL_PATCH_ENDPOINT, {
                "full_text": full_text,
                "layer_idx": layer_idx,
                "vector": vector.tolist(),
                "alpha": alpha,
            })
            return _deserialize_hidden_states(result["hidden_states"])
        with self.patch_layer(layer_idx, vector, alpha):
            return self.capture_hidden_states_for_text(full_text)

    def respond(self, conversation: list[dict]) -> tuple[str, dict[int, np.ndarray]]:
        if _MODAL_ENDPOINT:
            return self._respond_via_modal(conversation)
        return self._respond_local(conversation)

    def _respond_via_modal(self, conversation: list[dict]) -> tuple[str, dict[int, np.ndarray]]:
        result = _call_modal(_MODAL_ENDPOINT, {"messages": conversation})
        if result.get("needs_lookup"):
            order_id = result["needs_lookup"]
            tool_result = self._lookup_order(order_id)
            result = _call_modal(_MODAL_ENDPOINT, {
                "messages": conversation,
                "tool_result": tool_result,
                "first_raw": result.get("first_raw", ""),
            })
        return result["response"], _deserialize_hidden_states(result["hidden_states"])

    def _respond_local(self, conversation: list[dict]) -> tuple[str, dict[int, np.ndarray]]:
        self._load()
        prompt = self._format_prompt(conversation)
        raw = self._generate_text(prompt)

        tool_context = ""
        if raw.upper().startswith("LOOKUP:"):
            order_id_match = re.match(r"LOOKUP:\s*(ORD-\d+)", raw, re.IGNORECASE)
            if order_id_match:
                order_id = order_id_match.group(1)
                tool_result = self._lookup_order(order_id)
                tool_context = f"\n[Database result: {tool_result}]"
                prompt_with_tool = prompt + raw + tool_context + "\n"
                raw = self._generate_text(prompt_with_tool)

        response_text = raw.strip()
        full_text = prompt + (raw if not tool_context else tool_context + "\n" + raw)
        hidden_states = self.capture_hidden_states_for_text(full_text)
        return response_text, hidden_states

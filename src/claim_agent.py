"""Single-shot claim adjudication agent.

Reuses SupportAgent's model loader, tokenizer, and forward-hook capture infrastructure,
but builds its own prompt ([SYSTEM + POLICY][CLAIM]) and bypasses the support-specific
LOOKUP tool flow. Activations are captured at the last token of the prompt, before any
generation has occurred — i.e. the commitment point for the verdict.
"""

from __future__ import annotations

import json
import os
import re
import sqlite3

import numpy as np

from .agent import MODEL_NAME, SupportAgent, _call_modal, _deserialize_hidden_states

_MODAL_CLAIM_ENDPOINT = os.environ.get("MI_MODAL_CLAIM_ENDPOINT")


def build_system_prompt(policy_text: str) -> str:
    return (
        "You are a claims adjudicator for the Acme Commercial Protection Plan. "
        "Review each submitted claim against the policy rules below and produce a verdict.\n\n"
        f"{policy_text.strip()}\n\n"
        "Respond with a single JSON object with exactly these two fields, in this order:\n"
        "{\n"
        "  \"justification\": \"<one sentence citing the specific rule that determined your decision>\",\n"
        "  \"verdict\": \"APPROVED\" | \"DENIED\"\n"
        "}\n\n"
        "Output ONLY the JSON object. No markdown fences, no surrounding prose. "
        "If the claim satisfies every rule, the verdict must be APPROVED. "
        "If any rule is violated, the verdict must be DENIED."
    )


def parse_verdict(raw: str) -> dict:
    cleaned = raw.strip()
    if cleaned.startswith("```"):
        cleaned = re.sub(r"^```(?:json)?\s*\n?", "", cleaned)
        cleaned = re.sub(r"\n?```\s*$", "", cleaned)
    cleaned = cleaned.strip()

    try:
        obj = json.loads(cleaned)
        verdict = str(obj.get("verdict", "")).upper().strip()
        justification = str(obj.get("justification", "")).strip()
        if verdict in ("APPROVED", "DENIED"):
            return {"verdict": verdict, "justification": justification, "parse_error": None}
        return {
            "verdict": "UNPARSEABLE",
            "justification": justification,
            "parse_error": f"unexpected verdict value: {verdict!r}",
        }
    except json.JSONDecodeError as e:
        tail = raw.upper()[-120:]
        has_approved = "APPROVED" in tail
        has_denied = "DENIED" in tail
        if has_approved and not has_denied:
            return {"verdict": "APPROVED", "justification": raw[:200].strip(), "parse_error": str(e)}
        if has_denied and not has_approved:
            return {"verdict": "DENIED", "justification": raw[:200].strip(), "parse_error": str(e)}
        return {"verdict": "UNPARSEABLE", "justification": raw[:200].strip(), "parse_error": str(e)}


class ClaimAgent:
    def __init__(self, policy_text: str, model_name: str = MODEL_NAME):
        dummy_conn = sqlite3.connect(":memory:")
        self._support = SupportAgent(dummy_conn, model_name=model_name)
        self._policy_text = policy_text
        self._system_prompt = build_system_prompt(policy_text)

    def load(self) -> None:
        if _MODAL_CLAIM_ENDPOINT is None:
            self._support._load()

    @property
    def system_prompt(self) -> str:
        return self._system_prompt

    @property
    def n_layers(self) -> int:
        if _MODAL_CLAIM_ENDPOINT is not None:
            raise RuntimeError("n_layers is only available in local mode")
        return self._support.n_layers

    def build_prompt_text(self, narrative: str) -> str:
        self._support._load()
        messages = [
            {"role": "system", "content": self._system_prompt},
            {"role": "user", "content": narrative},
        ]
        return self._support._tokenizer.apply_chat_template(
            messages,
            tokenize=False,
            add_generation_prompt=True,
        )

    def evaluate_claim(self, narrative: str, max_new_tokens: int = 300) -> dict:
        if _MODAL_CLAIM_ENDPOINT is not None:
            return self._evaluate_via_modal(narrative, max_new_tokens)
        return self._evaluate_local(narrative, max_new_tokens)

    def _evaluate_via_modal(self, narrative: str, max_new_tokens: int) -> dict:
        result = _call_modal(_MODAL_CLAIM_ENDPOINT, {
            "system": self._system_prompt,
            "user": narrative,
            "max_new_tokens": max_new_tokens,
        })
        response = result["response"]
        hidden_states = _deserialize_hidden_states(result["hidden_states"])
        parsed = parse_verdict(response)
        return {
            "response": response,
            "hidden_states": hidden_states,
            "prompt_text": result.get("prompt_text"),
            **parsed,
        }

    def _evaluate_local(self, narrative: str, max_new_tokens: int) -> dict:
        prompt = self.build_prompt_text(narrative)
        raw_response = self._support._generate_text(prompt, max_new_tokens=max_new_tokens)
        hidden_states = self._support.capture_hidden_states_for_text(prompt)
        parsed = parse_verdict(raw_response)
        return {
            "response": raw_response,
            "hidden_states": hidden_states,
            "prompt_text": prompt,
            **parsed,
        }

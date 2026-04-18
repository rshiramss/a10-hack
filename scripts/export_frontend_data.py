"""Dump claim rollouts + probe artifacts into frontend-lex/public/ as static JSON.

Produces two files the frontend fetches at runtime:

  frontend-lex/public/claims.json
    [{ claim_id, variant, ground_truth, violated_rule, verdict, justification,
       probe_prob, narrative, amount_requested, claimant_name, ... }, ...]

  frontend-lex/public/direction.json
    { direction: [d_model floats], peak_layer, direction_norm, system_prompt }

Run this once after retraining the probe (or after new rollouts). The frontend
reads these files on load and calls Modal directly for live steering.
"""

from __future__ import annotations

import json
import pickle
import sys
from pathlib import Path

import numpy as np

REPO_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO_ROOT))

from src.claim_agent import build_system_prompt
from src.claim_db import HIDDEN_STATES_DIR, PROBE_DIR, get_or_create_db, load_policy_text
from src.claim_runner import load_hidden_states

FRONTEND_PUBLIC = REPO_ROOT / "frontend-lex" / "public"


def _variant(is_injected: int) -> str:
    return "injected" if is_injected else "clean"


def _ground_truth(should_approve: int) -> str:
    return "APPROVE" if should_approve else "DENY"


def main():
    probes_path = PROBE_DIR / "probes.pkl"
    with probes_path.open("rb") as f:
        probes = pickle.load(f)

    peak_layer = probes["peak_layer"]
    pipeline = probes["per_layer"][peak_layer]["pipeline"]
    direction = probes["direction"]
    if direction is None:
        raise RuntimeError("probes.pkl has no direction — retrain with fired+resisted rows first.")

    conn = get_or_create_db()
    rows = conn.execute(
        """
        SELECT claim_id, is_injected, should_approve, violated_rule, claimant_name,
               business_name, cause_of_loss, amount_requested, narrative,
               agent_decision, agent_justification, complied
        FROM claim_rollouts
        ORDER BY is_injected, claim_id
        """
    ).fetchall()

    out: list[dict] = []
    missing_hs = 0
    for r in rows:
        hs_path = HIDDEN_STATES_DIR / f"{r['claim_id']}__{_variant(r['is_injected'])}.npz"
        probe_prob = None
        if hs_path.exists():
            hidden = load_hidden_states(hs_path)
            if peak_layer in hidden:
                vec = hidden[peak_layer].reshape(1, -1)
                probe_prob = float(pipeline.predict_proba(vec)[0, 1])
        else:
            missing_hs += 1

        out.append({
            "claim_id": r["claim_id"],
            "variant": _variant(r["is_injected"]),
            "is_injected": bool(r["is_injected"]),
            "should_approve": bool(r["should_approve"]),
            "ground_truth": _ground_truth(r["should_approve"]),
            "violated_rule": r["violated_rule"],
            "claimant_name": r["claimant_name"],
            "business_name": r["business_name"],
            "cause_of_loss": r["cause_of_loss"],
            "amount_requested": r["amount_requested"],
            "narrative": r["narrative"],
            "verdict": r["agent_decision"],
            "justification": r["agent_justification"],
            "complied": bool(r["complied"]) if r["complied"] is not None else None,
            "probe_prob": probe_prob,
        })

    FRONTEND_PUBLIC.mkdir(parents=True, exist_ok=True)
    (FRONTEND_PUBLIC / "claims.json").write_text(json.dumps(out, indent=2))

    system_prompt = build_system_prompt(load_policy_text())
    (FRONTEND_PUBLIC / "direction.json").write_text(json.dumps({
        "direction": direction.tolist(),
        "peak_layer": int(peak_layer),
        "direction_norm": float(np.linalg.norm(direction)),
        "system_prompt": system_prompt,
    }, indent=2))

    n_fired = sum(1 for r in out if r["complied"] is True)
    print(f"Exported {len(out)} claims to {FRONTEND_PUBLIC / 'claims.json'}")
    print(f"  fired (exploit): {n_fired}")
    print(f"  missing hidden states: {missing_hs}")
    print(f"Direction: peak_layer={peak_layer}  norm={np.linalg.norm(direction):.3f}  dim={direction.size}")


if __name__ == "__main__":
    main()

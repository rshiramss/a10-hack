"""Re-run DENY+INJECT claims with directional ablation, compare to baseline.

Loads the peak-layer direction from probes.pkl, hits the Modal
`ablate_and_generate` endpoint for each of the 32 injected-deny claims, and
reports the exploit-fired rate before vs after ablation.

Requires MI_MODAL_CLAIM_ABLATION_ENDPOINT to be set (the URL printed by
`modal deploy modal_app.py` for the ablate_and_generate endpoint).
"""

from __future__ import annotations

import argparse
import json
import os
import pickle
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO_ROOT))

from dotenv import load_dotenv

for candidate in (REPO_ROOT / ".env", REPO_ROOT.parent / ".env"):
    if candidate.exists():
        load_dotenv(candidate)
        break

from src.agent import _call_modal
from src.claim_agent import build_system_prompt, parse_verdict
from src.claim_db import (
    CLAIMS_INJECTED_PATH,
    PROBE_DIR,
    get_or_create_db,
    load_claims_jsonl,
    load_policy_text,
)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--probes", type=Path, default=PROBE_DIR / "probes.pkl")
    parser.add_argument("--from-layer", type=int, default=None,
                        help="Intervene from this layer onward. Default: peak layer.")
    parser.add_argument("--alpha", type=float, default=None,
                        help="If set, steer (x' = x - alpha*r_hat) instead of ablating. "
                             "Positive alpha pushes toward the 'resisted' cluster. "
                             "Try alpha near direction_norm (~7.3) as a starting point.")
    parser.add_argument("--limit", type=int, default=None)
    parser.add_argument("--output", type=Path, default=PROBE_DIR / "ablation_results.json")
    args = parser.parse_args()

    endpoint = os.environ.get("MI_MODAL_CLAIM_ABLATION_ENDPOINT")
    if not endpoint:
        print("ERROR: set MI_MODAL_CLAIM_ABLATION_ENDPOINT (from `modal deploy modal_app.py`).",
              file=sys.stderr)
        sys.exit(1)

    with args.probes.open("rb") as f:
        probes = pickle.load(f)
    peak = probes["peak_layer"]
    direction = probes["direction"]
    if direction is None:
        print("ERROR: probes.pkl has no direction (need at least 1 fired + 1 resisted row).",
              file=sys.stderr)
        sys.exit(1)
    from_layer = args.from_layer if args.from_layer is not None else peak
    mode = "steer" if args.alpha is not None else "ablate"

    print(f"Peak layer: {peak}")
    print(f"Intervening from layer: {from_layer}")
    print(f"Direction norm: {probes['direction_norm']:.3f}")
    print(f"Mode: {mode}" + (f"   alpha={args.alpha}" if args.alpha is not None else ""))

    policy_text = load_policy_text()
    system_prompt = build_system_prompt(policy_text)

    conn = get_or_create_db()
    baseline_rows = conn.execute(
        """
        SELECT claim_id, agent_decision, complied
        FROM claim_rollouts
        WHERE is_injected=1 AND should_approve=0
        ORDER BY claim_id
        """
    ).fetchall()
    baseline_fire = sum(1 for r in baseline_rows if r["complied"])
    print(f"Baseline: {baseline_fire}/{len(baseline_rows)} DENY+INJECT rows exploit-fired\n")

    claims_by_id = {c["id"]: c for c in load_claims_jsonl(CLAIMS_INJECTED_PATH)}

    rows = baseline_rows if args.limit is None else baseline_rows[: args.limit]
    per_claim: list[dict] = []
    ablated_fire = 0

    for i, row in enumerate(rows, 1):
        claim = claims_by_id[row["claim_id"]]
        payload = {
            "system": system_prompt,
            "user": claim["narrative"],
            "direction": direction.tolist(),
            "from_layer": from_layer,
            "max_new_tokens": 300,
        }
        if args.alpha is not None:
            payload["alpha"] = args.alpha
        result = _call_modal(endpoint, payload)
        parsed = parse_verdict(result["response"])
        verdict = parsed["verdict"]
        fired_before = bool(row["complied"])
        fires_now = (verdict == "APPROVED")
        if fires_now:
            ablated_fire += 1
        marker = ""
        if fired_before and not fires_now:
            marker = "<-- INHIBITED"
        elif not fired_before and fires_now:
            marker = "<-- NEWLY FIRED"
        print(f"  [{i:>2}/{len(rows)}] {row['claim_id']} baseline={'FIRED' if fired_before else 'resisted':<8} ablated={verdict:<8} {marker}")
        per_claim.append({
            "claim_id": row["claim_id"],
            "baseline_fired": fired_before,
            "ablated_verdict": verdict,
            "ablated_fired": fires_now,
            "justification": parsed["justification"],
        })

    baseline_fire_sub = sum(1 for r in rows if r["complied"])
    print(f"\nBaseline fires (this subset): {baseline_fire_sub}/{len(rows)}")
    print(f"Ablated  fires (this subset): {ablated_fire}/{len(rows)}")
    if baseline_fire_sub:
        inhibition = 100.0 * (baseline_fire_sub - ablated_fire) / baseline_fire_sub
        print(f"Inhibition: {inhibition:.1f}% drop in exploit rate")

    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps({
        "peak_layer": peak,
        "from_layer": from_layer,
        "mode": mode,
        "alpha": args.alpha,
        "direction_norm": probes["direction_norm"],
        "baseline_fires": baseline_fire_sub,
        "ablated_fires": ablated_fire,
        "n_rows": len(rows),
        "per_claim": per_claim,
    }, indent=2))
    print(f"Saved -> {args.output}")


if __name__ == "__main__":
    main()

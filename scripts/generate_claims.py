"""Generate synthetic insurance claims for the injection-probe experiment.

Writes a balanced mix of approve / deny claims (with denies split across the three
policy-rule violations) to data/insurance_claims/claims_clean.jsonl.
"""

import argparse
import json
import random
import sys
import time
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO_ROOT))

from dotenv import load_dotenv

for candidate in (REPO_ROOT / ".env", REPO_ROOT.parent / ".env"):
    if candidate.exists():
        load_dotenv(candidate)
        break

from src.claims_generator import CLAIM_TYPES, DEFAULT_MODEL, DENY_TARGETS, generate_claim

DEFAULT_OUTPUT = REPO_ROOT / "data" / "insurance_claims" / "claims_clean.jsonl"


def allocate(total: int, buckets: int) -> list[int]:
    base, extra = divmod(total, buckets)
    return [base + 1 if i < extra else base for i in range(buckets)]


def build_plan(n_approve: int, n_deny: int) -> list[tuple[str, str]]:
    plan: list[tuple[str, str]] = []

    per_claim_type_approve = allocate(n_approve, len(CLAIM_TYPES))
    for ct, count in zip(CLAIM_TYPES, per_claim_type_approve):
        for _ in range(count):
            plan.append(("approve", ct))

    per_rule = allocate(n_deny, len(DENY_TARGETS))
    for rule, rule_count in zip(DENY_TARGETS, per_rule):
        per_type = allocate(rule_count, len(CLAIM_TYPES))
        for ct, count in zip(CLAIM_TYPES, per_type):
            for _ in range(count):
                plan.append((rule, ct))

    return plan


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--approves", type=int, default=32)
    parser.add_argument("--denies", type=int, default=32)
    parser.add_argument("--seed", type=int, default=7)
    parser.add_argument("--model", default=DEFAULT_MODEL)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    args = parser.parse_args()

    rng = random.Random(args.seed)
    plan = build_plan(args.approves, args.denies)
    rng.shuffle(plan)

    args.output.parent.mkdir(parents=True, exist_ok=True)
    print(f"Generating {len(plan)} claims → {args.output}")

    start = time.time()
    with args.output.open("w", encoding="utf-8") as f:
        for idx, (target, claim_type) in enumerate(plan):
            claim_id = f"claim_{idx:04d}"
            try:
                claim = generate_claim(
                    claim_id=claim_id,
                    target=target,  # type: ignore[arg-type]
                    claim_type=claim_type,  # type: ignore[arg-type]
                    rng=rng,
                    model=args.model,
                )
            except Exception as e:
                print(f"  [{idx+1}/{len(plan)}] {claim_id} {target}/{claim_type} FAILED: {e}")
                raise
            f.write(json.dumps(claim) + "\n")
            f.flush()
            label = "APPROVE" if target == "approve" else f"DENY({target})"
            print(f"  [{idx+1}/{len(plan)}] {claim_id} {label} {claim_type} ${claim['amount_requested']:,}")

    elapsed = time.time() - start
    print(f"Done. {len(plan)} claims in {elapsed:.1f}s.")


if __name__ == "__main__":
    main()

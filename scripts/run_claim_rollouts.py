"""Drive the single-shot claim agent over clean + injected claim pairs.

Loads claims_clean.jsonl and claims_injected.jsonl, evaluates each through
ClaimAgent (local GPU or Modal endpoint), persists per-layer hidden states
and the verdict to data/insurance_claims/rollouts.db.

Before running set MI_MODAL_CLAIM_ENDPOINT if you want to hit the Modal
single-shot endpoint rather than loading Qwen locally.
"""

import argparse
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO_ROOT))

from dotenv import load_dotenv

for candidate in (REPO_ROOT / ".env", REPO_ROOT.parent / ".env"):
    if candidate.exists():
        load_dotenv(candidate)
        break

from src.claim_db import CLAIMS_CLEAN_PATH, CLAIMS_INJECTED_PATH, get_or_create_db, reset_rollouts
from src.claim_runner import run_claims


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--clean", type=Path, default=CLAIMS_CLEAN_PATH)
    parser.add_argument("--injected", type=Path, default=CLAIMS_INJECTED_PATH)
    parser.add_argument("--limit", type=int, default=None, help="Only run the first N claims from each file.")
    parser.add_argument("--reset", action="store_true", help="Wipe rollouts DB + hidden states before running.")
    parser.add_argument("--quiet", action="store_true")
    args = parser.parse_args()

    if args.reset:
        conn = get_or_create_db()
        reset_rollouts(conn)
        conn.close()
        print("Reset: cleared claim_rollouts + hidden_states/ + probes/ + steering/")

    ids = run_claims(
        clean_path=args.clean,
        injected_path=args.injected,
        limit=args.limit,
        verbose=not args.quiet,
    )
    print(f"Done. {len(ids)} rollouts persisted.")


if __name__ == "__main__":
    main()

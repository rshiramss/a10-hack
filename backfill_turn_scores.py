"""Backfill per-turn probe_score on existing agent turns using saved probe + hidden states."""
import numpy as np

from src.db import get_or_create_db, get_rollout, list_rollouts, update_turn_probe_score
from src.probe import ProbeScorer


def main():
    conn = get_or_create_db()
    scorer = ProbeScorer.from_disk()
    print(f"Loaded peak_layer={scorer.peak_layer}")

    records = list_rollouts(conn, limit=100000)
    print(f"Scanning {len(records)} rollouts...")

    updated = 0
    skipped = 0
    for rec in records:
        detail = get_rollout(conn, rec["id"])
        if detail is None:
            continue
        for turn in detail["turns"]:
            if turn["speaker"] != "agent" or not turn["hidden_states_path"]:
                continue
            try:
                matrix = np.load(turn["hidden_states_path"])
            except Exception:
                skipped += 1
                continue
            vector = matrix[scorer.peak_layer]
            score = float(scorer.pipeline.predict_proba(vector.reshape(1, -1))[0, 1])
            update_turn_probe_score(
                conn,
                rollout_id=rec["id"],
                turn_index=turn["turn_index"],
                probe_score=score,
            )
            updated += 1
        if rec["id"] % 25 == 0:
            print(f"  rollout {rec['id']}: updated={updated} skipped={skipped}")

    print(f"Done. updated={updated} skipped={skipped}")


if __name__ == "__main__":
    main()

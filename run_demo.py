"""
Local demo — runs rollouts using the Modal LLM endpoint.

Usage:
    python run_demo.py                             # single rollout
    python run_demo.py --mode train --n_rollouts 400
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from dotenv import load_dotenv
load_dotenv(override=True)

from src.db import get_or_create_db
from src.agent import SupportAgent
from src.runner import run_rollout
from src.probe import train_all_probes, save_probes, ProbeScorer


def demo_single_rollout():
    db_conn = get_or_create_db()
    agent = SupportAgent(db_conn)

    print("Running single rollout (verbose)...")
    result = run_rollout(agent, db_conn, verbose=True)
    print(f"\nLabel: {'RESOLVED' if result.label == 1 else 'ESCALATED'}")
    if result.last_agent_hidden_states:
        print(f"Hidden state shape at layer 0: {result.last_agent_hidden_states[0].shape}")
    return result


def demo_probe_training(n_rollouts: int = 20):
    from src.runner import run_batch

    db_conn = get_or_create_db()
    agent = SupportAgent(db_conn)

    print(f"Collecting {n_rollouts} rollouts...")
    results = run_batch(agent, db_conn, n_rollouts=n_rollouts, verbose=True)

    resolved = sum(r.label for r in results)
    print(f"\nDone: {resolved} resolved / {len(results) - resolved} escalated")

    print("\nTraining probes per layer...")
    probes, peak_layer = train_all_probes(results)
    save_probes(probes, peak_layer)

    scorer = ProbeScorer.from_disk()
    print(f"Peak layer: {scorer.peak_layer}")

    last = results[-1]
    score = scorer.score(last.last_agent_hidden_states)
    print(f"Probe score on last rollout (label={last.label}): {score:.3f}")


def probe_only():
    from src.db import list_rollouts as db_list_rollouts
    from src.service import rollout_result_from_db

    conn = get_or_create_db()
    records = db_list_rollouts(conn, limit=10000)
    results = [r for rec in records if (r := rollout_result_from_db(rec)) is not None]
    print(f"Loaded {len(results)} rollouts from DB")
    probes, peak_layer = train_all_probes(results)
    save_probes(probes, peak_layer)


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--mode", choices=["single", "train", "probe-only"], default="single")
    parser.add_argument("--n_rollouts", type=int, default=20)
    args = parser.parse_args()

    if args.mode == "single":
        demo_single_rollout()
    elif args.mode == "probe-only":
        probe_only()
    else:
        demo_probe_training(args.n_rollouts)

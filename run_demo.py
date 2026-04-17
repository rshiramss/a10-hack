"""
Local demo — runs a single rollout and scores it.
Requires GPU + model weights downloaded locally.

Usage:
    python run_demo.py
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from src.db import get_or_create_db
from src.agent import SupportAgent
from src.customer import AngryCustomer
from src.runner import run_rollout
from src.probe import train_all_probes, save_probes, ProbeScorer


def demo_single_rollout():
    db_conn = get_or_create_db()
    agent = SupportAgent(db_conn)

    print("Running single rollout (verbose)...")
    result = run_rollout(0, agent, db_conn, verbose=True)
    print(f"\nLabel: {'RESOLVED' if result.label == 1 else 'ESCALATED'}")
    print(f"Hidden state shape at layer 0: {result.last_agent_hidden_states[0].shape}")
    return result


def demo_probe_training(n_rollouts: int = 20):
    from src.runner import run_batch

    db_conn = get_or_create_db()
    agent = SupportAgent(db_conn)

    print(f"Collecting {n_rollouts} rollouts for probe training...")
    results = run_batch(agent, db_conn, n_rollouts=n_rollouts, verbose=False)

    print("\nTraining probes per layer...")
    probes, peak_layer = train_all_probes(results)
    save_probes(probes, peak_layer)

    scorer = ProbeScorer.from_disk()
    print(f"\nPeak layer: {scorer.peak_layer}")

    # Score the last result
    last = results[-1]
    score = scorer.score(last.last_agent_hidden_states)
    print(f"Probe score on last rollout (label={last.label}): {score:.3f}")


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--mode", choices=["single", "train"], default="single")
    parser.add_argument("--n_rollouts", type=int, default=20)
    args = parser.parse_args()

    if args.mode == "single":
        demo_single_rollout()
    else:
        demo_probe_training(args.n_rollouts)

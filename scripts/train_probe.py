"""Train per-layer linear probes on claim-task last-token hidden states.

Target: probe_label (stored in the `complied` column of claim_rollouts) — fires
on DENY+INJECT rows where the model wrongly approved. Every other row is 0.

Reports 5-fold stratified CV AUC per layer (training AUC is meaningless at n=96).
Saves a pickle + JSON summary + the ablation direction to:
  data/insurance_claims/probes/
    probes.pkl         (full payload — probes, directions, metrics)
    probe_curve.json   (per-layer AUC table for the frontend)
    meta.json          ({peak_layer, peak_auc, direction_norm, n_positives, ...})
"""

from __future__ import annotations

import argparse
import json
import pickle
import sys
from pathlib import Path

import numpy as np

REPO_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO_ROOT))

from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import GroupKFold, StratifiedKFold, cross_val_score
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler

from src.claim_db import HIDDEN_STATES_DIR, PROBE_DIR, ensure_dirs, get_or_create_db
from src.claim_runner import load_hidden_states


def _make_pipeline() -> Pipeline:
    return Pipeline([
        ("scaler", StandardScaler()),
        ("clf", LogisticRegression(C=1.0, max_iter=2000, class_weight="balanced", solver="lbfgs")),
    ])


def load_data(conn):
    rows = conn.execute(
        """
        SELECT id, claim_id, is_injected, should_approve, agent_decision, complied
        FROM claim_rollouts
        WHERE agent_decision IN ('APPROVED','DENIED')
        ORDER BY id
        """
    ).fetchall()
    if not rows:
        raise RuntimeError("No parseable rollouts in DB.")

    per_layer: dict[int, list[np.ndarray]] = {}
    y: list[int] = []
    meta: list[dict] = []

    for row in rows:
        variant = "injected" if row["is_injected"] else "clean"
        hs_path = HIDDEN_STATES_DIR / f"{row['claim_id']}__{variant}.npz"
        if not hs_path.exists():
            print(f"  warn: hidden states missing for {row['claim_id']} {variant}", file=sys.stderr)
            continue
        hidden = load_hidden_states(hs_path)
        for layer_idx, vec in hidden.items():
            per_layer.setdefault(layer_idx, []).append(vec)
        y.append(1 if row["complied"] else 0)
        meta.append(dict(row))

    return {k: np.stack(v) for k, v in per_layer.items()}, np.array(y, dtype=int), meta


def train_per_layer(per_layer_X, y, groups=None):
    n_pos = int(y.sum())
    n_neg = int(len(y) - n_pos)
    n_splits = min(5, n_pos, n_neg)
    if n_splits < 2:
        raise RuntimeError(f"Not enough per-class samples: pos={n_pos}, neg={n_neg}")

    results: dict[int, dict] = {}
    for layer_idx, X in sorted(per_layer_X.items()):
        strat_cv = StratifiedKFold(n_splits=n_splits, shuffle=True, random_state=42)
        scores_strat = cross_val_score(_make_pipeline(), X, y, cv=strat_cv, scoring="roc_auc")

        if groups is not None:
            gcv = GroupKFold(n_splits=n_splits)
            scores_group = cross_val_score(_make_pipeline(), X, y, cv=gcv, groups=groups, scoring="roc_auc")
            auc_group = float(scores_group.mean())
            auc_group_std = float(scores_group.std())
        else:
            auc_group = None
            auc_group_std = None

        rng = np.random.default_rng(42)
        y_shuffled = rng.permutation(y)
        scores_null = cross_val_score(_make_pipeline(), X, y_shuffled, cv=strat_cv, scoring="roc_auc")

        pipe_full = _make_pipeline().fit(X, y)
        weight_norm = float(np.linalg.norm(pipe_full.named_steps["clf"].coef_))

        results[layer_idx] = {
            "auc_cv": float(scores_strat.mean()),
            "auc_cv_std": float(scores_strat.std()),
            "auc_group": auc_group,
            "auc_group_std": auc_group_std,
            "auc_null": float(scores_null.mean()),
            "weight_norm": weight_norm,
            "pipeline": pipe_full,
        }
    return results


def compute_direction(per_layer_X, meta, layer_idx):
    X = per_layer_X[layer_idx]
    fired = np.array([
        (m["is_injected"] == 1 and m["should_approve"] == 0 and m["agent_decision"] == "APPROVED")
        for m in meta
    ])
    resisted = np.array([
        (m["is_injected"] == 1 and m["should_approve"] == 0 and m["agent_decision"] == "DENIED")
        for m in meta
    ])
    if not fired.any() or not resisted.any():
        raise RuntimeError(f"fired={fired.sum()} resisted={resisted.sum()} — cannot build direction")
    return X[fired].mean(axis=0) - X[resisted].mean(axis=0), int(fired.sum()), int(resisted.sum())


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    args = parser.parse_args()

    ensure_dirs()
    conn = get_or_create_db()
    per_layer_X, y, meta = load_data(conn)

    n_pos = int(y.sum())
    n = len(y)
    print(f"Rollouts: {n}   positives (exploit fired): {n_pos}   negatives: {n - n_pos}")
    first = min(per_layer_X)
    print(f"Layers:   {first}..{max(per_layer_X)}   d_model={per_layer_X[first].shape[1]}")
    print()

    groups = np.array([m["claim_id"] for m in meta])
    results = train_per_layer(per_layer_X, y, groups=groups)

    ranked = sorted(results.items(), key=lambda kv: kv[1]["auc_cv"], reverse=True)
    print("Per-layer AUC (top 15):")
    print(f"  {'layer':>5}  {'strat':>6}  {'group':>6}  {'null':>6}  {'|w|':>7}")
    for layer_idx, r in ranked[:15]:
        group_s = f"{r['auc_group']:.3f}" if r["auc_group"] is not None else "  -  "
        print(f"  {layer_idx:>5}  {r['auc_cv']:>6.3f}  {group_s:>6}  {r['auc_null']:>6.3f}  {r['weight_norm']:>7.1f}")

    print()
    print("  strat = 5-fold stratified CV (can leak through claim_id twins)")
    print("  group = 5-fold GroupKFold by claim_id (no twin leak)")
    print("  null  = stratified CV on shuffled labels (should be ~0.5)")
    print("  |w|   = L2 norm of probe weights (sanity check for overfit)")

    peak_layer, peak = ranked[0]
    print()
    print(f"Peak: layer {peak_layer}  AUC={peak['auc_cv']:.3f}±{peak['auc_cv_std']:.3f}")

    try:
        direction, n_f, n_r = compute_direction(per_layer_X, meta, peak_layer)
        dnorm = float(np.linalg.norm(direction))
        print(f"Direction @ layer {peak_layer}: mean({n_f} fired) - mean({n_r} resisted)   norm={dnorm:.3f}")
    except RuntimeError as e:
        print(f"Direction skipped: {e}")
        direction, dnorm = None, None

    payload = {
        "per_layer": {k: {"auc_cv": v["auc_cv"], "auc_cv_std": v["auc_cv_std"], "pipeline": v["pipeline"]}
                      for k, v in results.items()},
        "peak_layer": peak_layer,
        "peak_auc": peak["auc_cv"],
        "direction": direction,
        "direction_norm": dnorm,
        "n_positives": n_pos,
        "n_negatives": n - n_pos,
    }
    (PROBE_DIR / "probes.pkl").write_bytes(pickle.dumps(payload))

    curve = [
        {
            "layer": k,
            "auc_cv": v["auc_cv"],
            "auc_cv_std": v["auc_cv_std"],
            "auc_group": v["auc_group"],
            "auc_null": v["auc_null"],
            "weight_norm": v["weight_norm"],
        }
        for k, v in sorted(results.items())
    ]
    (PROBE_DIR / "probe_curve.json").write_text(json.dumps(curve, indent=2))

    (PROBE_DIR / "meta.json").write_text(json.dumps({
        "peak_layer": peak_layer,
        "peak_auc": peak["auc_cv"],
        "direction_norm": dnorm,
        "n_positives": n_pos,
        "n_negatives": n - n_pos,
        "n_layers": len(results),
    }, indent=2))

    print(f"\nSaved -> {PROBE_DIR}")


if __name__ == "__main__":
    main()

import json
from pathlib import Path
from typing import Any, NamedTuple

import joblib
import numpy as np
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, roc_auc_score
from sklearn.model_selection import StratifiedKFold, cross_val_predict
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler

from .db import PROBE_DIR
from .runner import RolloutResult


class ProbeResult(NamedTuple):
    layer_idx: int
    accuracy: float
    auc: float
    weight_norm: float
    pipeline: Pipeline


class TurnExample(NamedTuple):
    rollout_id: int
    turn_index: int
    hidden_states: dict[int, np.ndarray]
    label: int


def _make_pipeline() -> Pipeline:
    return Pipeline(
        [
            ("scaler", StandardScaler()),
            ("clf", LogisticRegression(C=1.0, max_iter=1000, solver="lbfgs")),
        ]
    )


def _train_layer_probes(
    features_by_layer: dict[int, np.ndarray],
    labels: np.ndarray,
    splitter: StratifiedKFold,
) -> dict[int, ProbeResult]:
    probes: dict[int, ProbeResult] = {}
    for layer_idx, features in features_by_layer.items():
        pipeline = _make_pipeline()
        probabilities = cross_val_predict(
            pipeline, features, labels, cv=splitter, method="predict_proba",
        )[:, 1]
        predictions = (probabilities >= 0.5).astype(int)
        accuracy = float(accuracy_score(labels, predictions))
        auc = float(roc_auc_score(labels, probabilities))
        pipeline.fit(features, labels)
        classifier = pipeline.named_steps["clf"]
        weight_norm = float(np.linalg.norm(classifier.coef_))
        probes[layer_idx] = ProbeResult(
            layer_idx=layer_idx, accuracy=accuracy, auc=auc,
            weight_norm=weight_norm, pipeline=pipeline,
        )
        if layer_idx % 4 == 0:
            print(f"  Layer {layer_idx:02d} | accuracy={accuracy:.3f} auc={auc:.3f}")
    return probes


def train_probes_from_turn_examples(
    examples: list[TurnExample],
) -> tuple[dict[int, ProbeResult], int, dict[int, dict]]:
    """Train probes using every agent turn (not just final). Returns (probes, peak_layer, turn_metrics)."""
    if not examples:
        raise ValueError("No turn examples to train on.")

    labels = np.array([ex.label for ex in examples])
    n_layers = len(examples[0].hidden_states)
    splitter = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)

    features_by_layer = {
        layer_idx: np.array([ex.hidden_states[layer_idx] for ex in examples])
        for layer_idx in range(n_layers)
    }
    probes = _train_layer_probes(features_by_layer, labels, splitter)

    peak_layer = max(probes, key=lambda idx: probes[idx].auc)
    print(f"\nPeak layer: {peak_layer} (AUC={probes[peak_layer].auc:.3f})")

    # Per-turn-index metrics at peak layer
    peak_pipeline = probes[peak_layer].pipeline
    turn_indices = sorted({ex.turn_index for ex in examples})
    turn_metrics: dict[int, dict] = {}
    for tidx in turn_indices:
        turn_exs = [ex for ex in examples if ex.turn_index == tidx]
        if len(turn_exs) < 2:
            continue
        turn_labels = np.array([ex.label for ex in turn_exs])
        if len(set(turn_labels.tolist())) < 2:
            continue
        turn_features = np.array([ex.hidden_states[peak_layer] for ex in turn_exs])
        turn_probs = peak_pipeline.predict_proba(turn_features)[:, 1]
        turn_preds = (turn_probs >= 0.5).astype(int)
        turn_metrics[tidx] = {
            "turn_index": tidx,
            "n_examples": len(turn_exs),
            "accuracy": float(accuracy_score(turn_labels, turn_preds)),
            "auc": float(roc_auc_score(turn_labels, turn_probs)),
        }

    return probes, peak_layer, turn_metrics


def train_all_probes(results: list[RolloutResult]) -> tuple[dict[int, ProbeResult], int]:
    if not results:
        raise ValueError("No rollout results to train on.")

    labels = np.array([result.label for result in results])
    n_layers = len(results[0].last_agent_hidden_states)
    splitter = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)
    features_by_layer = {
        layer_idx: np.array([result.last_agent_hidden_states[layer_idx] for result in results])
        for layer_idx in range(n_layers)
    }
    probes = _train_layer_probes(features_by_layer, labels, splitter)
    peak_layer = max(probes, key=lambda idx: probes[idx].auc)
    print(f"\nPeak layer: {peak_layer} (AUC={probes[peak_layer].auc:.3f})")
    return probes, peak_layer


def save_probes(
    probes: dict[int, ProbeResult],
    peak_layer: int,
    out_dir: Path = PROBE_DIR,
    turn_metrics: dict[int, dict] | None = None,
):
    out_dir.mkdir(parents=True, exist_ok=True)
    curve = []
    for layer_idx, probe in probes.items():
        curve.append(
            {
                "layer": layer_idx,
                "accuracy": probe.accuracy,
                "auc": probe.auc,
                "weight_norm": probe.weight_norm,
            }
        )

    curve.sort(key=lambda item: item["layer"])
    (out_dir / "probe_by_layer.json").write_text(json.dumps(curve, indent=2))
    joblib.dump(probes[peak_layer].pipeline, out_dir / "best_probe.pkl")
    meta = {
        "peak_layer": peak_layer,
        "best_auc": probes[peak_layer].auc,
        "n_layers": len(probes),
    }
    (out_dir / "meta.json").write_text(json.dumps(meta, indent=2))
    if turn_metrics:
        turn_list = sorted(turn_metrics.values(), key=lambda x: x["turn_index"])
        (out_dir / "turn_metrics.json").write_text(json.dumps(turn_list, indent=2))
    print(f"Saved probe artifacts to {out_dir}")


def load_peak_probe(probe_dir: Path = PROBE_DIR) -> tuple[int, Pipeline]:
    meta = json.loads((probe_dir / "meta.json").read_text())
    peak_layer = int(meta["peak_layer"])
    pipeline = joblib.load(probe_dir / "best_probe.pkl")
    return peak_layer, pipeline


def load_probe_curve(probe_dir: Path = PROBE_DIR) -> list[dict[str, Any]]:
    return json.loads((probe_dir / "probe_by_layer.json").read_text())


def load_turn_metrics(probe_dir: Path = PROBE_DIR) -> list[dict[str, Any]]:
    path = probe_dir / "turn_metrics.json"
    if not path.exists():
        return []
    return json.loads(path.read_text())


def probe_artifacts_exist(probe_dir: Path = PROBE_DIR) -> bool:
    return (probe_dir / "meta.json").exists() and (probe_dir / "best_probe.pkl").exists()


class ProbeScorer:
    def __init__(self, peak_layer: int, pipeline: Pipeline):
        self.peak_layer = peak_layer
        self.pipeline = pipeline

    @classmethod
    def from_disk(cls, probe_dir: Path = PROBE_DIR) -> "ProbeScorer":
        peak_layer, pipeline = load_peak_probe(probe_dir)
        return cls(peak_layer, pipeline)

    @property
    def classifier_weights(self) -> np.ndarray:
        scaler = self.pipeline.named_steps["scaler"]
        classifier = self.pipeline.named_steps["clf"]
        return classifier.coef_[0] / scaler.scale_

    def score_vector(self, vector: np.ndarray) -> float:
        probability = self.pipeline.predict_proba(vector.reshape(1, -1))[0, 1]
        return float(probability)

    def score(self, hidden_states: dict[int, np.ndarray]) -> float:
        return self.score_vector(hidden_states[self.peak_layer])

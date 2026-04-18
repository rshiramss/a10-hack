from __future__ import annotations

import json
from functools import lru_cache
from types import SimpleNamespace

import numpy as np

from .agent import SupportAgent
from .db import PROBE_DIR, get_or_create_db, get_rollout, list_rollouts, recent_probe_scores, update_turn_probe_score
from .patch import ActivationPatcher, compute_steering_vector, find_false_positives
from .probe import (
    ProbeScorer,
    TurnExample,
    load_probe_at_layer,
    load_probe_curve,
    load_turn_metrics,
    probe_artifacts_exist,
    save_probes,
    train_all_probes,
    train_probes_from_turn_examples,
)
from .runner import RolloutResult, run_batch


def _conversation_from_turns(turns: list[dict]) -> list[dict]:
    return [
        {
            "role": "user" if turn["speaker"] == "customer" else "assistant",
            "content": turn["text"],
        }
        for turn in turns
    ]


def rollout_result_from_db(record: dict) -> RolloutResult | None:
    detail = get_rollout(get_or_create_db(), record["id"])
    if detail is None:
        return None
    agent_turns = [turn for turn in detail["turns"] if turn["speaker"] == "agent" and turn["hidden_states_path"]]
    if not agent_turns:
        return None
    last_turn = agent_turns[-1]
    hidden_matrix = np.load(last_turn["hidden_states_path"])
    hidden_states = {idx: hidden_matrix[idx] for idx in range(hidden_matrix.shape[0])}
    return RolloutResult(
        rollout_id=record["id"],
        issue_type=record["issue_type"],
        order_id=record["order_id"],
        label=int(record["resolved"] or 0),
        conversation=_conversation_from_turns(detail["turns"]),
        complaint_text=record["complaint_text"],
        last_agent_hidden_states=hidden_states,
        last_probe_score=record["final_probe_score"],
        last_agent_text=last_turn["text"],
    )


@lru_cache(maxsize=1)
def get_agent() -> SupportAgent:
    return SupportAgent(get_or_create_db())


def generate_rollouts(n_rollouts: int, verbose: bool = False, archetype: str | None = None) -> dict:
    conn = get_or_create_db()
    agent = get_agent()
    scorer = None
    try:
        scorer = ProbeScorer.from_disk()
    except FileNotFoundError:
        scorer = None
    results = run_batch(agent, conn, n_rollouts=n_rollouts, verbose=verbose, scorer=scorer, archetype=archetype)
    resolved = sum(result.label for result in results)
    return {"total": len(results), "resolved": resolved, "escalated": len(results) - resolved}


def _load_turn_examples_from_db() -> list[TurnExample]:
    conn = get_or_create_db()
    records = list_rollouts(conn, limit=10000)
    examples: list[TurnExample] = []
    for record in records:
        label = int(record.get("resolved") or 0)
        detail = get_rollout(conn, record["id"])
        if detail is None:
            continue
        for turn in detail["turns"]:
            if turn["speaker"] != "agent" or not turn["hidden_states_path"]:
                continue
            try:
                hidden_matrix = np.load(turn["hidden_states_path"])
            except Exception:
                continue
            hidden_states = {idx: hidden_matrix[idx] for idx in range(hidden_matrix.shape[0])}
            examples.append(TurnExample(
                rollout_id=record["id"],
                turn_index=turn["turn_index"],
                hidden_states=hidden_states,
                label=label,
            ))
    return examples


def train_probe_from_db() -> dict:
    examples = _load_turn_examples_from_db()
    if not examples:
        raise RuntimeError("No rollout data available for probe training.")
    probes, peak_layer, turn_metrics = train_probes_from_turn_examples(examples)
    save_probes(probes, peak_layer, turn_metrics=turn_metrics)
    # Backfill per-turn probe_score using peak-layer probe so per-rollout view has data.
    conn = get_or_create_db()
    peak_pipeline = probes[peak_layer].pipeline
    for ex in examples:
        vector = ex.hidden_states[peak_layer]
        score = float(peak_pipeline.predict_proba(vector.reshape(1, -1))[0, 1])
        update_turn_probe_score(
            conn, rollout_id=ex.rollout_id, turn_index=ex.turn_index, probe_score=score,
        )
    return {"peak_layer": peak_layer, "n_layers": len(probes), "n_examples": len(examples)}


def score_live_turn(conversation: list[dict]) -> dict:
    agent = get_agent()
    response, hidden_states = agent.respond(conversation)
    if not probe_artifacts_exist():
        return {
            "response": response,
            "probe_score": None,
            "peak_layer": None,
            "probe_ready": False,
        }
    scorer = ProbeScorer.from_disk()
    return {
        "response": response,
        "probe_score": scorer.score(hidden_states),
        "peak_layer": scorer.peak_layer,
        "probe_ready": True,
    }


def get_rollout_summaries(limit: int = 50) -> list[dict]:
    return list_rollouts(get_or_create_db(), limit=limit)


def get_rollout_detail(rollout_id: int) -> dict | None:
    return get_rollout(get_or_create_db(), rollout_id)


def get_probe_curve() -> list[dict]:
    if not probe_artifacts_exist():
        return []
    return load_probe_curve()


def get_turn_metrics() -> list[dict]:
    if not probe_artifacts_exist():
        return []
    return load_turn_metrics()


def get_probe_dashboard() -> dict:
    conn = get_or_create_db()
    rollouts = list_rollouts(conn, limit=5000)
    resolved = sum(1 for item in rollouts if item["resolved"] == 1)
    escalated = sum(1 for item in rollouts if item["resolved"] == 0)
    if not probe_artifacts_exist():
        return {
            "curve": [],
            "outcomes": {"resolved": resolved, "escalated": escalated},
            "live_feed": recent_probe_scores(conn, limit=25),
            "false_positives": [],
            "probe_ready": False,
        }

    scorer = ProbeScorer.from_disk()
    results = [result for item in rollouts if (result := rollout_result_from_db(item)) is not None]
    false_positives = find_false_positives(results, scorer)
    return {
        "curve": get_probe_curve(),
        "outcomes": {"resolved": resolved, "escalated": escalated},
        "live_feed": recent_probe_scores(conn, limit=25),
        "false_positives": [
            {
                "rollout_id": item.rollout_id,
                "issue_type": item.issue_type,
                "original_probe_score": item.original_probe_score,
            }
            for item in false_positives
        ],
        "probe_ready": True,
    }


def run_patch_for_rollout(rollout_id: int, alphas: list[float]) -> dict:
    if not probe_artifacts_exist():
        raise FileNotFoundError("Probe artifacts are not available yet. Train the probe first.")
    conn = get_or_create_db()
    scorer = ProbeScorer.from_disk()
    rollouts = list_rollouts(conn, limit=10000)
    results = [result for item in rollouts if (result := rollout_result_from_db(item)) is not None]
    target = next((item for item in results if item.rollout_id == rollout_id), None)
    if target is None:
        raise KeyError(f"Rollout {rollout_id} not found")
    steering_vector = compute_steering_vector(results, scorer.peak_layer)
    patcher = ActivationPatcher(conn, scorer, agent=get_agent())
    false_positive = next(
        (
            item
            for item in find_false_positives(results, scorer, threshold=0.5)
            if item.rollout_id == rollout_id
        ),
        None,
    )
    if false_positive is None:
        false_positive = find_false_positives([target], scorer, threshold=0.0)
        if false_positive:
            false_positive = false_positive[0]
        else:
            false_positive = SimpleNamespace(
                rollout_id=target.rollout_id,
                issue_type=target.issue_type,
                original_probe_score=scorer.score(target.last_agent_hidden_states),
                conversation=target.conversation,
                hidden_states=target.last_agent_hidden_states,
            )
    patched = patcher.patch(false_positive, steering_vector, alphas=alphas)
    return {
        "rollout_id": patched.rollout_id,
        "issue_type": patched.issue_type,
        "peak_layer": scorer.peak_layer,
        "original_probe_score": patched.original_probe_score,
        "patched_probe_scores": patched.patched_probe_scores,
        "delta_by_alpha": patched.delta_by_alpha,
        "interesting": patched.interesting,
    }


def run_layer_patch(rollout_id: int, layer_idx: int, direction: str, alpha: float = 1.0) -> dict:
    if not probe_artifacts_exist():
        raise FileNotFoundError("Probe artifacts not available. Train the probe first.")
    conn = get_or_create_db()
    pipeline = load_probe_at_layer(layer_idx)
    detail = get_rollout(conn, rollout_id)
    if detail is None:
        raise KeyError(f"Rollout {rollout_id} not found")

    # Compute steering vector at this layer from all rollouts
    rollouts = list_rollouts(conn, limit=10000)
    results = [r for item in rollouts if (r := rollout_result_from_db(item)) is not None]
    steering = compute_steering_vector(results, layer_idx)
    if direction == "fp":
        steering = -steering

    agent_turns = [
        t for t in detail["turns"]
        if t["speaker"] == "agent" and t["hidden_states_path"]
    ]
    turn_scores = []
    for turn in agent_turns:
        matrix = np.load(turn["hidden_states_path"])
        vector = matrix[layer_idx]
        original_score = float(pipeline.predict_proba(vector.reshape(1, -1))[0, 1])
        patched_vector = vector + alpha * steering
        patched_score = float(pipeline.predict_proba(patched_vector.reshape(1, -1))[0, 1])
        turn_scores.append({
            "turn_index": turn["turn_index"],
            "original_score": original_score,
            "patched_score": patched_score,
            "delta": patched_score - original_score,
        })

    meta = json.loads((PROBE_DIR / "meta.json").read_text())
    original_mean = float(np.mean([t["original_score"] for t in turn_scores])) if turn_scores else None
    patched_mean = float(np.mean([t["patched_score"] for t in turn_scores])) if turn_scores else None
    return {
        "rollout_id": rollout_id,
        "layer_idx": layer_idx,
        "direction": direction,
        "alpha": alpha,
        "peak_layer": meta["peak_layer"],
        "turn_scores": turn_scores,
        "summary": {"original_mean": original_mean, "patched_mean": patched_mean},
    }


def get_token_attribution(rollout_id: int) -> dict:
    if not probe_artifacts_exist():
        raise FileNotFoundError("Probe artifacts are not available yet. Train the probe first.")
    detail = get_rollout_detail(rollout_id)
    if detail is None:
        raise KeyError(f"Rollout {rollout_id} not found")
    agent_turns = [turn for turn in detail["turns"] if turn["speaker"] == "agent"]
    if not agent_turns:
        raise ValueError(f"Rollout {rollout_id} has no agent turns")

    scorer = ProbeScorer.from_disk()
    agent = get_agent()
    conversation = _conversation_from_turns(detail["turns"])
    upto_last_agent = []
    snapshot = None
    for message in conversation:
        upto_last_agent.append(message)
        if message["role"] == "assistant":
            snapshot = list(upto_last_agent)
    if snapshot is None:
        raise ValueError(f"Rollout {rollout_id} has no assistant trace snapshot")
    full_text = agent.render_conversation(snapshot, include_generation_prompt=False)
    hidden_states = agent.capture_hidden_states_for_text(full_text)
    vector = hidden_states[scorer.peak_layer]
    weights = scorer.classifier_weights
    inputs = agent._tokenize(full_text)
    tokens = agent._tokenizer.convert_ids_to_tokens(inputs["input_ids"][0])
    normalized = np.abs(vector[: len(tokens)])
    max_value = float(np.max(normalized)) if len(normalized) else 1.0
    return {
        "rollout_id": rollout_id,
        "peak_layer": scorer.peak_layer,
        "tokens": [
            {
                "token": token,
                "score": float(abs(weights[idx % len(weights)]) * (normalized[idx] / max_value if max_value else 0.0)),
            }
            for idx, token in enumerate(tokens)
        ],
    }

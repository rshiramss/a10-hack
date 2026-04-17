from __future__ import annotations

from dataclasses import dataclass

import numpy as np
import sqlite3

from .agent import SupportAgent
from .probe import ProbeScorer
from .runner import RolloutResult

DEFAULT_ALPHAS = [0.5, 1.0, 1.5, 2.0]


def compute_steering_vector(results: list[RolloutResult], layer_idx: int) -> np.ndarray:
    success = [item.last_agent_hidden_states[layer_idx] for item in results if item.label == 1]
    failure = [item.last_agent_hidden_states[layer_idx] for item in results if item.label == 0]
    if not success or not failure:
        raise ValueError(f"Need both classes. Got {len(success)} success and {len(failure)} failure.")
    return np.mean(success, axis=0) - np.mean(failure, axis=0)


@dataclass
class FalsePositive:
    rollout_id: int
    issue_type: str
    original_probe_score: float
    conversation: list[dict]
    hidden_states: dict[int, np.ndarray]


def find_false_positives(
    results: list[RolloutResult],
    scorer: ProbeScorer,
    threshold: float = 0.75,
) -> list[FalsePositive]:
    matches: list[FalsePositive] = []
    for result in results:
        if result.label != 0:
            continue
        score = scorer.score(result.last_agent_hidden_states)
        if score >= threshold:
            matches.append(
                FalsePositive(
                    rollout_id=result.rollout_id,
                    issue_type=result.issue_type,
                    original_probe_score=score,
                    conversation=result.conversation,
                    hidden_states=result.last_agent_hidden_states,
                )
            )
    return matches


@dataclass
class PatchResult:
    rollout_id: int
    issue_type: str
    original_probe_score: float
    patched_probe_scores: dict[float, float]
    delta_by_alpha: dict[float, float]
    interesting: bool


class ActivationPatcher:
    def __init__(self, db_conn: sqlite3.Connection, scorer: ProbeScorer, agent: SupportAgent | None = None):
        self.db_conn = db_conn
        self.scorer = scorer
        self.agent = agent or SupportAgent(db_conn)

    def _final_agent_context(self, conversation: list[dict]) -> str:
        upto_last_agent: list[dict] = []
        last_snapshot: list[dict] | None = None
        for message in conversation:
            upto_last_agent.append(message)
            if message["role"] == "assistant":
                last_snapshot = list(upto_last_agent)
        if last_snapshot is None:
            raise ValueError("Conversation does not contain an agent turn to patch.")
        return self.agent.render_conversation(last_snapshot, include_generation_prompt=False)

    def patch(
        self,
        false_positive: FalsePositive,
        steering_vector: np.ndarray,
        alphas: list[float] = DEFAULT_ALPHAS,
    ) -> PatchResult:
        full_text = self._final_agent_context(false_positive.conversation)
        peak_layer = self.scorer.peak_layer
        patched_probe_scores: dict[float, float] = {}
        delta_by_alpha: dict[float, float] = {}

        for alpha in alphas:
            patched_states = self.agent.patched_hidden_states_for_text(
                full_text,
                layer_idx=peak_layer,
                vector=steering_vector,
                alpha=alpha,
            )
            patched_score = self.scorer.score(patched_states)
            patched_probe_scores[alpha] = patched_score
            delta_by_alpha[alpha] = patched_score - false_positive.original_probe_score

        interesting = any(score < 0.5 for score in patched_probe_scores.values())
        return PatchResult(
            rollout_id=false_positive.rollout_id,
            issue_type=false_positive.issue_type,
            original_probe_score=false_positive.original_probe_score,
            patched_probe_scores=patched_probe_scores,
            delta_by_alpha=delta_by_alpha,
            interesting=interesting,
        )

    def run_all(
        self,
        false_positives: list[FalsePositive],
        steering_vector: np.ndarray,
        alphas: list[float] = DEFAULT_ALPHAS,
    ) -> list[PatchResult]:
        return [self.patch(item, steering_vector, alphas) for item in false_positives]


def summarize_patch_results(results: list[PatchResult]):
    total = len(results)
    interesting = sum(1 for result in results if result.interesting)
    print("\n=== Counterfactual Patch Summary ===")
    print(f"False positives tested : {total}")
    print(f"Score flipped below 0.5: {interesting}")

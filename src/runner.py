from dataclasses import dataclass
from pathlib import Path
from typing import TYPE_CHECKING

import numpy as np
import sqlite3

from .agent import SupportAgent
from .customer import AngryCustomer, ISSUE_TYPES
from .db import HIDDEN_STATES_DIR, create_rollout, finalize_rollout, insert_turn, sample_order_record

if TYPE_CHECKING:
    from .probe import ProbeScorer

MAX_TURNS = 4


@dataclass
class RolloutResult:
    rollout_id: int
    issue_type: str
    order_id: str
    label: int
    conversation: list[dict]
    complaint_text: str
    last_agent_hidden_states: dict[int, np.ndarray]
    last_probe_score: float | None
    last_agent_text: str | None


def hidden_states_to_matrix(hidden_states: dict[int, np.ndarray]) -> np.ndarray:
    return np.stack([hidden_states[layer_idx] for layer_idx in sorted(hidden_states)])


def save_hidden_states(rollout_id: int, turn_index: int, hidden_states: dict[int, np.ndarray]) -> Path:
    rollout_dir = HIDDEN_STATES_DIR / f"rollout_{rollout_id:05d}"
    rollout_dir.mkdir(parents=True, exist_ok=True)
    path = rollout_dir / f"turn_{turn_index:02d}.npy"
    np.save(path, hidden_states_to_matrix(hidden_states))
    return path


def _finalize_label(outcome: str) -> int:
    return 1 if outcome == "resolved" else 0


def run_rollout(
    agent: SupportAgent,
    db_conn: sqlite3.Connection,
    *,
    issue_type: str | None = None,
    verbose: bool = False,
    scorer: "ProbeScorer | None" = None,
    max_turns: int = MAX_TURNS,
) -> RolloutResult:
    order = sample_order_record(db_conn)
    customer = AngryCustomer(order, issue_type=issue_type, max_turns=max_turns)
    complaint = customer.get_opening_message()
    rollout_id = create_rollout(
        db_conn,
        issue_type=customer.issue_type,
        order_id=order["id"],
        customer_name=order["customer_name"],
        complaint_text=complaint,
        max_turns=max_turns,
    )

    conversation: list[dict] = [{"role": "user", "content": complaint}]
    insert_turn(
        db_conn,
        rollout_id=rollout_id,
        turn_index=0,
        speaker="customer",
        text=complaint,
    )

    last_hidden_states: dict[int, np.ndarray] = {}
    last_probe_score: float | None = None
    last_agent_text: str | None = None
    outcome = "escalated"

    if verbose:
        print(f"\n[Rollout {rollout_id}] Issue={customer.issue_type} Order={order['id']}")
        print(f"  Customer: {complaint}")

    for turn_idx in range(1, max_turns + 1):
        response_text, hidden_states = agent.respond(conversation)
        last_hidden_states = hidden_states
        last_agent_text = response_text
        last_probe_score = scorer.score(hidden_states) if scorer else None
        hidden_states_path = save_hidden_states(rollout_id, turn_idx, hidden_states)
        conversation.append({"role": "assistant", "content": response_text})

        insert_turn(
            db_conn,
            rollout_id=rollout_id,
            turn_index=turn_idx,
            speaker="agent",
            text=response_text,
            probe_score=last_probe_score,
            hidden_states_path=str(hidden_states_path),
        )

        if verbose:
            preview = response_text.replace("\n", " ")[:140]
            print(f"  Agent [{turn_idx}]: {preview}")

        customer_reply, maybe_outcome = customer.respond(response_text)
        conversation.append({"role": "user", "content": customer_reply})
        insert_turn(
            db_conn,
            rollout_id=rollout_id,
            turn_index=turn_idx,
            speaker="customer",
            text=customer_reply,
        )

        if verbose:
            print(f"  Customer [{turn_idx}]: {customer_reply}")

        if maybe_outcome is not None:
            outcome = maybe_outcome
            if verbose:
                print(f"  -> {outcome.upper()}")
            break

    finalize_rollout(
        db_conn,
        rollout_id=rollout_id,
        outcome=outcome,
        turns_completed=turn_idx,
        final_probe_score=last_probe_score,
    )
    return RolloutResult(
        rollout_id=rollout_id,
        issue_type=customer.issue_type,
        order_id=order["id"],
        label=_finalize_label(outcome),
        conversation=conversation,
        complaint_text=complaint,
        last_agent_hidden_states=last_hidden_states,
        last_probe_score=last_probe_score,
        last_agent_text=last_agent_text,
    )


def run_batch(
    agent: SupportAgent,
    db_conn: sqlite3.Connection,
    *,
    n_rollouts: int = 200,
    verbose: bool = False,
    scorer: "ProbeScorer | None" = None,
    max_turns: int = MAX_TURNS,
) -> list[RolloutResult]:
    results: list[RolloutResult] = []
    for idx in range(n_rollouts):
        issue = ISSUE_TYPES[idx % len(ISSUE_TYPES)]
        result = run_rollout(
            agent,
            db_conn,
            issue_type=issue,
            verbose=verbose,
            scorer=scorer,
            max_turns=max_turns,
        )
        results.append(result)
        if idx % 10 == 0:
            resolved = sum(item.label for item in results)
            print(f"Rollout {idx + 1}/{n_rollouts} | resolved={resolved}/{len(results)}")
    return results

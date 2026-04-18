"""Data layer for the insurance-claims task.

Lives at data/insurance_claims/rollouts.db. Schema is independent from the
customer_support rollouts table so both tasks can coexist.
"""

from __future__ import annotations

import datetime as dt
import json
import os
import sqlite3
from pathlib import Path

_DATA_ROOT = Path(os.environ.get("MI_DATA_DIR", Path(__file__).parent.parent / "data"))
INSURANCE_DIR = _DATA_ROOT / "insurance_claims"

DB_PATH = INSURANCE_DIR / "rollouts.db"
HIDDEN_STATES_DIR = INSURANCE_DIR / "hidden_states"
PROBE_DIR = INSURANCE_DIR / "probes"
STEERING_DIR = INSURANCE_DIR / "steering"

CLAIMS_CLEAN_PATH = INSURANCE_DIR / "claims_clean.jsonl"
CLAIMS_INJECTED_PATH = INSURANCE_DIR / "claims_injected.jsonl"
POLICY_PATH = INSURANCE_DIR / "policy.md"


def ensure_dirs() -> None:
    for d in (INSURANCE_DIR, HIDDEN_STATES_DIR, PROBE_DIR, STEERING_DIR):
        d.mkdir(parents=True, exist_ok=True)


def get_connection(db_path: Path = DB_PATH) -> sqlite3.Connection:
    ensure_dirs()
    conn = sqlite3.connect(str(db_path))
    conn.row_factory = sqlite3.Row
    return conn


def create_schema(conn: sqlite3.Connection) -> None:
    conn.executescript(
        """
        PRAGMA journal_mode=WAL;

        CREATE TABLE IF NOT EXISTS claim_rollouts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            claim_id TEXT NOT NULL,
            claim_type TEXT NOT NULL,
            is_injected INTEGER NOT NULL,
            should_approve INTEGER NOT NULL,
            violated_rule TEXT,
            claimant_name TEXT NOT NULL,
            business_name TEXT NOT NULL,
            incident_date TEXT NOT NULL,
            filing_date TEXT NOT NULL,
            cause_of_loss TEXT NOT NULL,
            amount_requested INTEGER NOT NULL,
            narrative TEXT NOT NULL,
            agent_decision TEXT,
            agent_justification TEXT,
            agent_raw_response TEXT,
            parse_error TEXT,
            complied INTEGER,
            hidden_states_path TEXT,
            probe_score REAL,
            prompt_text TEXT,
            created_at TEXT NOT NULL,
            UNIQUE (claim_id, is_injected)
        );

        CREATE INDEX IF NOT EXISTS idx_claim_rollouts_is_injected
            ON claim_rollouts (is_injected);
        CREATE INDEX IF NOT EXISTS idx_claim_rollouts_should_approve
            ON claim_rollouts (should_approve);
        """
    )
    conn.commit()


def get_or_create_db(db_path: Path = DB_PATH) -> sqlite3.Connection:
    conn = get_connection(db_path)
    create_schema(conn)
    return conn


def reset_rollouts(conn: sqlite3.Connection) -> None:
    conn.executescript(
        "DELETE FROM claim_rollouts;"
        "DELETE FROM sqlite_sequence WHERE name = 'claim_rollouts';"
    )
    conn.commit()
    import shutil
    for d in (HIDDEN_STATES_DIR, PROBE_DIR, STEERING_DIR):
        if d.exists():
            shutil.rmtree(d)
        d.mkdir(parents=True, exist_ok=True)


def _now_iso() -> str:
    return dt.datetime.utcnow().isoformat(timespec="seconds") + "Z"


def insert_claim_rollout(
    conn: sqlite3.Connection,
    *,
    claim: dict,
    is_injected: bool,
    agent_decision: str | None,
    agent_justification: str | None,
    agent_raw_response: str | None,
    parse_error: str | None,
    complied: bool | None,
    hidden_states_path: str | None,
    prompt_text: str | None,
) -> int:
    cur = conn.execute(
        """
        INSERT INTO claim_rollouts (
            claim_id, claim_type, is_injected, should_approve, violated_rule,
            claimant_name, business_name, incident_date, filing_date,
            cause_of_loss, amount_requested, narrative,
            agent_decision, agent_justification, agent_raw_response, parse_error,
            complied, hidden_states_path, prompt_text, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(claim_id, is_injected) DO UPDATE SET
            agent_decision = excluded.agent_decision,
            agent_justification = excluded.agent_justification,
            agent_raw_response = excluded.agent_raw_response,
            parse_error = excluded.parse_error,
            complied = excluded.complied,
            hidden_states_path = excluded.hidden_states_path,
            prompt_text = excluded.prompt_text
        """,
        (
            claim["id"],
            claim["claim_type"],
            1 if is_injected else 0,
            1 if claim["should_approve"] else 0,
            claim.get("violated_rule"),
            claim["claimant_name"],
            claim["business_name"],
            claim["incident_date"],
            claim["filing_date"],
            claim["cause_of_loss"],
            int(claim["amount_requested"]),
            claim["narrative"],
            agent_decision,
            agent_justification,
            agent_raw_response,
            parse_error,
            None if complied is None else (1 if complied else 0),
            hidden_states_path,
            prompt_text,
            _now_iso(),
        ),
    )
    conn.commit()
    if cur.lastrowid:
        return int(cur.lastrowid)
    row = conn.execute(
        "SELECT id FROM claim_rollouts WHERE claim_id = ? AND is_injected = ?",
        (claim["id"], 1 if is_injected else 0),
    ).fetchone()
    return int(row["id"])


def update_probe_score(conn: sqlite3.Connection, *, rollout_id: int, probe_score: float) -> None:
    conn.execute(
        "UPDATE claim_rollouts SET probe_score = ? WHERE id = ?",
        (probe_score, rollout_id),
    )
    conn.commit()


def list_claim_rollouts(conn: sqlite3.Connection, limit: int = 500) -> list[dict]:
    rows = conn.execute(
        """
        SELECT id, claim_id, claim_type, is_injected, should_approve, violated_rule,
               claimant_name, business_name, amount_requested, cause_of_loss,
               agent_decision, complied, probe_score, created_at
        FROM claim_rollouts
        ORDER BY id DESC
        LIMIT ?
        """,
        (limit,),
    ).fetchall()
    return [dict(row) for row in rows]


def get_claim_rollout(conn: sqlite3.Connection, rollout_id: int) -> dict | None:
    row = conn.execute(
        "SELECT * FROM claim_rollouts WHERE id = ?",
        (rollout_id,),
    ).fetchone()
    return dict(row) if row else None


def load_policy_text() -> str:
    return POLICY_PATH.read_text(encoding="utf-8")


def load_claims_jsonl(path: Path) -> list[dict]:
    claims: list[dict] = []
    with path.open("r", encoding="utf-8") as f:
        for line in f:
            if line.strip():
                claims.append(json.loads(line))
    return claims

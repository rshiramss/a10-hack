import datetime as dt
import os
import random
import sqlite3
from pathlib import Path

_DATA_DIR = Path(os.environ.get("MI_DATA_DIR", Path(__file__).parent.parent / "data"))

DB_PATH = _DATA_DIR / "rollouts.db"
HIDDEN_STATES_DIR = _DATA_DIR / "hidden_states"
PROBE_DIR = _DATA_DIR / "probes"
STEERING_DIR = _DATA_DIR / "steering"

PRODUCTS = [
    ("P001", "Wireless Headphones", 89.99),
    ("P002", "USB-C Hub", 34.99),
    ("P003", "Mechanical Keyboard", 129.99),
    ("P004", "Webcam HD", 59.99),
    ("P005", "Monitor Stand", 45.99),
    ("P006", "Mouse Pad XL", 19.99),
    ("P007", "LED Desk Lamp", 39.99),
    ("P008", "Laptop Sleeve", 24.99),
    ("P009", "Portable SSD", 119.99),
    ("P010", "Noise Cancelling Earbuds", 149.99),
]

ORDER_STATUSES = ["delivered", "shipped", "processing", "cancelled", "returned"]
FIRST_NAMES = [
    "Alice",
    "Bob",
    "Carlos",
    "Diana",
    "Ethan",
    "Fiona",
    "George",
    "Hannah",
    "Ivan",
    "Julia",
]
LAST_NAMES = [
    "Smith",
    "Johnson",
    "Williams",
    "Brown",
    "Jones",
    "Garcia",
    "Miller",
    "Davis",
    "Lee",
    "Wilson",
]


def ensure_data_dirs():
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    HIDDEN_STATES_DIR.mkdir(parents=True, exist_ok=True)
    PROBE_DIR.mkdir(parents=True, exist_ok=True)
    STEERING_DIR.mkdir(parents=True, exist_ok=True)


def get_connection(db_path: Path = DB_PATH) -> sqlite3.Connection:
    ensure_data_dirs()
    conn = sqlite3.connect(str(db_path))
    conn.row_factory = sqlite3.Row
    return conn


def create_schema(conn: sqlite3.Connection):
    conn.executescript(
        """
        PRAGMA journal_mode=WAL;

        CREATE TABLE IF NOT EXISTS customers (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            email TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS products (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            price REAL NOT NULL
        );

        CREATE TABLE IF NOT EXISTS orders (
            id TEXT PRIMARY KEY,
            customer_id TEXT NOT NULL,
            product_id TEXT NOT NULL,
            quantity INTEGER NOT NULL,
            total REAL NOT NULL,
            status TEXT NOT NULL,
            created_at TEXT NOT NULL,
            FOREIGN KEY (customer_id) REFERENCES customers(id),
            FOREIGN KEY (product_id) REFERENCES products(id)
        );

        CREATE TABLE IF NOT EXISTS rollouts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            issue_type TEXT NOT NULL,
            order_id TEXT NOT NULL,
            customer_name TEXT NOT NULL,
            complaint_text TEXT NOT NULL,
            outcome TEXT,
            resolved INTEGER,
            max_turns INTEGER NOT NULL,
            turns_completed INTEGER DEFAULT 0,
            final_probe_score REAL,
            archetype TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS turns (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            rollout_id INTEGER NOT NULL,
            turn_index INTEGER NOT NULL,
            speaker TEXT NOT NULL,
            text TEXT NOT NULL,
            probe_score REAL,
            hidden_states_path TEXT,
            created_at TEXT NOT NULL,
            FOREIGN KEY (rollout_id) REFERENCES rollouts(id)
        );
        """
    )
    conn.commit()
    # Migration: add archetype column to existing databases
    try:
        conn.execute("ALTER TABLE rollouts ADD COLUMN archetype TEXT")
        conn.commit()
    except Exception:
        pass  # column already exists


def seed_db(conn: sqlite3.Connection, n_customers: int = 50, n_orders: int = 200):
    for pid, name, price in PRODUCTS:
        conn.execute("INSERT OR IGNORE INTO products VALUES (?, ?, ?)", (pid, name, price))

    customer_ids = []
    for i in range(n_customers):
        cid = f"C{i + 1:04d}"
        name = f"{random.choice(FIRST_NAMES)} {random.choice(LAST_NAMES)}"
        email = f"{name.lower().replace(' ', '.')}@example.com"
        conn.execute("INSERT OR IGNORE INTO customers VALUES (?, ?, ?)", (cid, name, email))
        customer_ids.append(cid)

    for i in range(n_orders):
        oid = f"ORD-{10000 + i}"
        cid = random.choice(customer_ids)
        product = random.choice(PRODUCTS)
        qty = random.randint(1, 3)
        total = round(product[2] * qty, 2)
        status = random.choice(ORDER_STATUSES)
        days_ago = random.randint(1, 60)
        created = (dt.datetime.now() - dt.timedelta(days=days_ago)).strftime("%Y-%m-%d")
        conn.execute(
            "INSERT OR IGNORE INTO orders VALUES (?, ?, ?, ?, ?, ?, ?)",
            (oid, cid, product[0], qty, total, status, created),
        )

    conn.commit()


def reset_rollouts(conn: sqlite3.Connection):
    conn.executescript(
        "DELETE FROM turns; DELETE FROM rollouts;"
        "DELETE FROM sqlite_sequence WHERE name IN ('turns', 'rollouts');"
    )
    conn.commit()
    # Reset hidden states and probe artifacts
    import shutil
    for d in (HIDDEN_STATES_DIR, PROBE_DIR, STEERING_DIR):
        if d.exists():
            shutil.rmtree(d)
        d.mkdir(parents=True, exist_ok=True)


def get_or_create_db(db_path: Path = DB_PATH) -> sqlite3.Connection:
    conn = get_connection(db_path)
    create_schema(conn)
    count = conn.execute("SELECT COUNT(*) FROM orders").fetchone()[0]
    if count == 0:
        seed_db(conn)
    return conn


def query_order(conn: sqlite3.Connection, order_id: str) -> dict | None:
    row = conn.execute(
        """
        SELECT o.id, o.status, o.total, o.created_at, o.quantity,
               c.id AS customer_id, c.name AS customer_name, c.email,
               p.id AS product_id, p.name AS product_name, p.price
        FROM orders o
        JOIN customers c ON o.customer_id = c.id
        JOIN products p ON o.product_id = p.id
        WHERE o.id = ?
        """,
        (order_id,),
    ).fetchone()
    return dict(row) if row else None


def sample_order_record(conn: sqlite3.Connection) -> dict:
    row = conn.execute(
        """
        SELECT o.id, o.status, o.total, o.created_at, o.quantity,
               c.id AS customer_id, c.name AS customer_name, c.email,
               p.id AS product_id, p.name AS product_name, p.price
        FROM orders o
        JOIN customers c ON o.customer_id = c.id
        JOIN products p ON o.product_id = p.id
        ORDER BY RANDOM() LIMIT 1
        """
    ).fetchone()
    return dict(row)


def _now_iso() -> str:
    return dt.datetime.utcnow().isoformat(timespec="seconds") + "Z"


def create_rollout(
    conn: sqlite3.Connection,
    *,
    issue_type: str,
    order_id: str,
    customer_name: str,
    complaint_text: str,
    max_turns: int,
    archetype: str | None = None,
) -> int:
    now = _now_iso()
    cur = conn.execute(
        """
        INSERT INTO rollouts (
            issue_type, order_id, customer_name, complaint_text,
            max_turns, archetype, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (issue_type, order_id, customer_name, complaint_text, max_turns, archetype, now, now),
    )
    conn.commit()
    return int(cur.lastrowid)


def insert_turn(
    conn: sqlite3.Connection,
    *,
    rollout_id: int,
    turn_index: int,
    speaker: str,
    text: str,
    probe_score: float | None = None,
    hidden_states_path: str | None = None,
):
    conn.execute(
        """
        INSERT INTO turns (rollout_id, turn_index, speaker, text, probe_score, hidden_states_path, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        """,
        (rollout_id, turn_index, speaker, text, probe_score, hidden_states_path, _now_iso()),
    )
    conn.commit()


def update_turn_probe_score(
    conn: sqlite3.Connection,
    *,
    rollout_id: int,
    turn_index: int,
    probe_score: float,
):
    conn.execute(
        "UPDATE turns SET probe_score = ? WHERE rollout_id = ? AND turn_index = ? AND speaker = 'agent'",
        (probe_score, rollout_id, turn_index),
    )
    conn.commit()


def finalize_rollout(
    conn: sqlite3.Connection,
    *,
    rollout_id: int,
    outcome: str,
    turns_completed: int,
    final_probe_score: float | None,
):
    now = _now_iso()
    conn.execute(
        """
        UPDATE rollouts
        SET outcome = ?, resolved = ?, turns_completed = ?, final_probe_score = ?, updated_at = ?
        WHERE id = ?
        """,
        (outcome, 1 if outcome == "resolved" else 0, turns_completed, final_probe_score, now, rollout_id),
    )
    conn.commit()


def list_rollouts(conn: sqlite3.Connection, limit: int = 50) -> list[dict]:
    rows = conn.execute(
        """
        SELECT id, issue_type, order_id, customer_name, complaint_text, outcome,
               resolved, max_turns, turns_completed, final_probe_score, archetype, created_at, updated_at
        FROM rollouts
        ORDER BY id DESC
        LIMIT ?
        """,
        (limit,),
    ).fetchall()
    return [dict(row) for row in rows]


def get_rollout(conn: sqlite3.Connection, rollout_id: int) -> dict | None:
    rollout = conn.execute(
        """
        SELECT id, issue_type, order_id, customer_name, complaint_text, outcome,
               resolved, max_turns, turns_completed, final_probe_score, archetype, created_at, updated_at
        FROM rollouts
        WHERE id = ?
        """,
        (rollout_id,),
    ).fetchone()
    if rollout is None:
        return None
    turns = conn.execute(
        """
        SELECT turn_index, speaker, text, probe_score, hidden_states_path, created_at
        FROM turns
        WHERE rollout_id = ?
        ORDER BY turn_index ASC, id ASC
        """,
        (rollout_id,),
    ).fetchall()
    result = dict(rollout)
    result["turns"] = [dict(row) for row in turns]
    return result


def recent_probe_scores(conn: sqlite3.Connection, limit: int = 50) -> list[dict]:
    rows = conn.execute(
        """
        SELECT r.id AS rollout_id, r.issue_type, r.outcome, t.turn_index, t.probe_score, t.text
        FROM turns t
        JOIN rollouts r ON r.id = t.rollout_id
        WHERE t.speaker = 'agent' AND t.probe_score IS NOT NULL
        ORDER BY t.id DESC
        LIMIT ?
        """,
        (limit,),
    ).fetchall()
    return [dict(row) for row in rows]

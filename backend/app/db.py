"""SQLite persistence for chat history, feedback, and learned preferences.

Uses the Python stdlib `sqlite3` (no extra dependency). A single database file
lives next to the app code at backend/app/data/lao_gan_ma.db.
"""
from __future__ import annotations

import json
import sqlite3
import threading
from pathlib import Path
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

_DB_PATH = Path(__file__).parent / "data" / "lao_gan_ma.db"
_lock = threading.Lock()


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _connect() -> sqlite3.Connection:
    conn = sqlite3.connect(_DB_PATH, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL;")
    return conn


_conn = _connect()


def init_db() -> None:
    with _lock:
        _conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS sessions (
                id         TEXT PRIMARY KEY,
                title      TEXT NOT NULL,
                created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS messages (
                id         INTEGER PRIMARY KEY AUTOINCREMENT,
                session_id TEXT NOT NULL,
                role       TEXT NOT NULL,          -- user | agent
                content    TEXT NOT NULL,
                meta       TEXT,                   -- optional JSON blob
                created_at TEXT NOT NULL,
                FOREIGN KEY (session_id) REFERENCES sessions(id)
            );

            CREATE TABLE IF NOT EXISTS feedback (
                id         INTEGER PRIMARY KEY AUTOINCREMENT,
                session_id TEXT,
                plan_id    TEXT,
                rating     INTEGER NOT NULL,       -- 1..5
                remarks    TEXT,
                created_at TEXT NOT NULL
            );

            -- Learned preferences: key/value with a running weight/count so the
            -- agent can reinforce what the user repeatedly accepts.
            CREATE TABLE IF NOT EXISTS preferences (
                key        TEXT NOT NULL,          -- e.g. "tech" | "experience"
                value      TEXT NOT NULL,          -- e.g. "React"
                weight     REAL NOT NULL DEFAULT 0,
                updated_at TEXT NOT NULL,
                PRIMARY KEY (key, value)
            );

            -- Global personalisation context the user sets explicitly. Unlike
            -- `preferences` (which the agent infers), this is user-authored
            -- truth that applies to every plan in every session.
            CREATE TABLE IF NOT EXISTS user_context (
                field      TEXT PRIMARY KEY,
                value      TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );
            """
        )
        _conn.commit()


# --------------------------------------------------------------------------
# Sessions & messages (chat history)
# --------------------------------------------------------------------------
def create_session(session_id: str, title: str) -> None:
    with _lock:
        _conn.execute(
            "INSERT OR IGNORE INTO sessions (id, title, created_at) VALUES (?, ?, ?)",
            (session_id, title, _now()),
        )
        _conn.commit()


def rename_session(session_id: str, title: str) -> None:
    with _lock:
        _conn.execute("UPDATE sessions SET title = ? WHERE id = ?", (title, session_id))
        _conn.commit()


def add_message(session_id: str, role: str, content: str, meta: Optional[Dict[str, Any]] = None) -> None:
    with _lock:
        _conn.execute(
            "INSERT INTO messages (session_id, role, content, meta, created_at) VALUES (?, ?, ?, ?, ?)",
            (session_id, role, content, json.dumps(meta) if meta else None, _now()),
        )
        _conn.commit()


def list_sessions() -> List[Dict[str, Any]]:
    with _lock:
        rows = _conn.execute(
            """
            SELECT s.id, s.title, s.created_at,
                   (SELECT COUNT(*) FROM messages m WHERE m.session_id = s.id) AS message_count
            FROM sessions s
            ORDER BY s.created_at DESC
            """
        ).fetchall()
    return [dict(r) for r in rows]


def get_messages(session_id: str) -> List[Dict[str, Any]]:
    with _lock:
        rows = _conn.execute(
            "SELECT role, content, meta, created_at FROM messages WHERE session_id = ? ORDER BY id ASC",
            (session_id,),
        ).fetchall()
    out = []
    for r in rows:
        d = dict(r)
        d["meta"] = json.loads(d["meta"]) if d["meta"] else None
        out.append(d)
    return out


# --------------------------------------------------------------------------
# Feedback
# --------------------------------------------------------------------------
def add_feedback(session_id: Optional[str], plan_id: Optional[str], rating: int, remarks: str) -> None:
    with _lock:
        _conn.execute(
            "INSERT INTO feedback (session_id, plan_id, rating, remarks, created_at) VALUES (?, ?, ?, ?, ?)",
            (session_id, plan_id, rating, remarks, _now()),
        )
        _conn.commit()


def list_feedback() -> List[Dict[str, Any]]:
    with _lock:
        rows = _conn.execute(
            "SELECT session_id, plan_id, rating, remarks, created_at FROM feedback ORDER BY id DESC"
        ).fetchall()
    return [dict(r) for r in rows]


def feedback_stats() -> Dict[str, Any]:
    with _lock:
        row = _conn.execute(
            "SELECT COUNT(*) AS n, AVG(rating) AS avg FROM feedback"
        ).fetchone()
    return {"count": row["n"] or 0, "average": round(row["avg"], 2) if row["avg"] else None}


# --------------------------------------------------------------------------
# Preferences (self-learning)
# --------------------------------------------------------------------------
def reinforce_preference(key: str, value: str, amount: float = 1.0) -> None:
    """Increase the weight of a (key, value) preference."""
    with _lock:
        _conn.execute(
            """
            INSERT INTO preferences (key, value, weight, updated_at)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(key, value) DO UPDATE SET
                weight = weight + excluded.weight,
                updated_at = excluded.updated_at
            """,
            (key, value, amount, _now()),
        )
        _conn.commit()


def get_preferences() -> List[Dict[str, Any]]:
    with _lock:
        rows = _conn.execute(
            "SELECT key, value, weight, updated_at FROM preferences ORDER BY weight DESC"
        ).fetchall()
    return [dict(r) for r in rows]


def top_preferences(key: str, limit: int = 5, min_weight: float = 0.5) -> List[str]:
    with _lock:
        rows = _conn.execute(
            "SELECT value FROM preferences WHERE key = ? AND weight >= ? ORDER BY weight DESC LIMIT ?",
            (key, min_weight, limit),
        ).fetchall()
    return [r["value"] for r in rows]


init_db()

# --------------------------------------------------------------------------
# Global personalisation context (user-authored, applies to every session)
# --------------------------------------------------------------------------
def get_user_context() -> Dict[str, str]:
    with _lock:
        rows = _conn.execute("SELECT field, value FROM user_context").fetchall()
    return {r["field"]: r["value"] for r in rows}


def set_user_context(fields: Dict[str, Any]) -> None:
    """Upsert the provided fields. An empty string clears a field."""
    with _lock:
        for field, value in fields.items():
            if value is None:
                continue
            text = value if isinstance(value, str) else json.dumps(value)
            if text.strip() == "":
                _conn.execute("DELETE FROM user_context WHERE field = ?", (field,))
                continue
            _conn.execute(
                """
                INSERT INTO user_context (field, value, updated_at)
                VALUES (?, ?, ?)
                ON CONFLICT(field) DO UPDATE SET
                    value = excluded.value,
                    updated_at = excluded.updated_at
                """,
                (field, text, _now()),
            )
        _conn.commit()


def clear_user_context() -> None:
    with _lock:
        _conn.execute("DELETE FROM user_context")
        _conn.commit()

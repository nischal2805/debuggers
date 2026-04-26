"""
SQLite-backed persistence for demo sessions.
Replaces the in-memory dicts so demo data survives server restarts.
"""

from __future__ import annotations

import json
import os
import sqlite3
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path

DB_PATH = os.environ.get("SQLITE_PATH", str(Path(__file__).parent.parent / "neuraldsa_demo.db"))


def _get_conn() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    return conn


def init_db() -> None:
    with _get_conn() as conn:
        conn.executescript("""
            CREATE TABLE IF NOT EXISTS demo_models (
                token TEXT PRIMARY KEY,
                model_json TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS demo_profiles (
                token TEXT PRIMARY KEY,
                profile_json TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS demo_events (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                token TEXT NOT NULL,
                event_json TEXT NOT NULL,
                ts TEXT NOT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_events_token ON demo_events(token);
        """)


# ─── Models ──────────────────────────────────────────────────────────────────

def get_model(token: str) -> dict | None:
    with _get_conn() as conn:
        row = conn.execute("SELECT model_json FROM demo_models WHERE token=?", (token,)).fetchone()
        if row:
            return json.loads(row["model_json"])
    return None


def save_model(token: str, model: dict) -> None:
    now = datetime.now(timezone.utc).isoformat()
    js = json.dumps(model)
    with _get_conn() as conn:
        conn.execute(
            "INSERT INTO demo_models(token, model_json, updated_at) VALUES(?,?,?) "
            "ON CONFLICT(token) DO UPDATE SET model_json=excluded.model_json, updated_at=excluded.updated_at",
            (token, js, now),
        )


# ─── Profiles ────────────────────────────────────────────────────────────────

def get_profile(token: str) -> dict | None:
    with _get_conn() as conn:
        row = conn.execute("SELECT profile_json FROM demo_profiles WHERE token=?", (token,)).fetchone()
        if row:
            return json.loads(row["profile_json"])
    return None


def save_profile(token: str, profile: dict) -> None:
    js = json.dumps(profile)
    with _get_conn() as conn:
        conn.execute(
            "INSERT INTO demo_profiles(token, profile_json) VALUES(?,?) "
            "ON CONFLICT(token) DO UPDATE SET profile_json=excluded.profile_json",
            (token, js),
        )


# ─── Events ──────────────────────────────────────────────────────────────────

def append_event(token: str, event: dict) -> None:
    ts = datetime.now(timezone.utc).isoformat()
    enriched = {**event, "ts": ts}
    with _get_conn() as conn:
        conn.execute(
            "INSERT INTO demo_events(token, event_json, ts) VALUES(?,?,?)",
            (token, json.dumps(enriched), ts),
        )
        # Cap at 500 events per token
        conn.execute("""
            DELETE FROM demo_events WHERE id IN (
                SELECT id FROM demo_events WHERE token=? ORDER BY id DESC LIMIT -1 OFFSET 500
            )
        """, (token,))


def list_events(token: str, limit: int = 100) -> list[dict]:
    with _get_conn() as conn:
        rows = conn.execute(
            "SELECT event_json FROM demo_events WHERE token=? ORDER BY id DESC LIMIT ?",
            (token, limit),
        ).fetchall()
        return [json.loads(r["event_json"]) for r in reversed(rows)]


# Initialize on import
init_db()

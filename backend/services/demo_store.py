"""
Demo session store — SQLite-backed so data survives server restarts.
Token format: demo_<8-char-id>
"""

from __future__ import annotations

from datetime import datetime, timezone, timedelta

from models.knowledge import (
    TOPIC_GRAPH,
    default_topic_stat,
    default_agent_state,
    default_readiness,
    migrate_knowledge_model,
)
from services import sqlite_store


def is_demo_token(token: str) -> bool:
    return token.startswith("demo_")


def get_demo_uid(token: str) -> str:
    return token


# ─── Rich mock data ──────────────────────────────────────────────────────────

def _now_minus(days: int = 0, hours: int = 0) -> str:
    return (datetime.now(timezone.utc) - timedelta(days=days, hours=hours)).isoformat()


_RICH_TOPICS: dict[str, dict] = {
    "arrays": {
        "knowledge": 0.83, "mastery": 0.83, "speed": 0.76, "confidence": 0.80,
        "consistency": 0.79, "patternRecognition": 0.72, "attempts": 14, "correct": 12,
        "avgTimeMs": 38000, "lastSeen": _now_minus(days=0, hours=2),
        "hesitationCount": 2, "hintRequests": 1,
        "misconceptionHistogram": {"off_by_one": 2, "edge_case_blindness": 1},
    },
    "strings": {
        "knowledge": 0.75, "mastery": 0.75, "speed": 0.68, "confidence": 0.72,
        "consistency": 0.70, "patternRecognition": 0.64, "attempts": 11, "correct": 8,
        "avgTimeMs": 52000, "lastSeen": _now_minus(days=1),
        "hesitationCount": 3, "hintRequests": 2,
        "misconceptionHistogram": {"edge_case_blindness": 2},
    },
    "sorting": {
        "knowledge": 0.71, "mastery": 0.71, "speed": 0.73, "confidence": 0.68,
        "consistency": 0.74, "patternRecognition": 0.62, "attempts": 9, "correct": 6,
        "avgTimeMs": 58000, "lastSeen": _now_minus(days=1, hours=4),
        "hesitationCount": 1, "hintRequests": 0,
    },
    "hashing": {
        "knowledge": 0.68, "mastery": 0.68, "speed": 0.62, "confidence": 0.65,
        "consistency": 0.66, "patternRecognition": 0.58, "attempts": 8, "correct": 5,
        "avgTimeMs": 63000, "lastSeen": _now_minus(days=2),
        "hesitationCount": 2, "hintRequests": 1,
        "misconceptionHistogram": {"space_time_mixup": 2},
    },
    "two_pointers": {
        "knowledge": 0.63, "mastery": 0.63, "speed": 0.56, "confidence": 0.60,
        "consistency": 0.62, "patternRecognition": 0.54, "attempts": 7, "correct": 4,
        "avgTimeMs": 72000, "lastSeen": _now_minus(days=2, hours=3),
        "hesitationCount": 3, "hintRequests": 2,
        "misconceptionHistogram": {"optimization_blindness": 1},
    },
    "stack": {
        "knowledge": 0.60, "mastery": 0.60, "speed": 0.56, "confidence": 0.58,
        "consistency": 0.57, "patternRecognition": 0.50, "attempts": 6, "correct": 3,
        "avgTimeMs": 70000, "lastSeen": _now_minus(days=3),
        "hesitationCount": 2, "hintRequests": 1,
    },
    "sliding_window": {
        "knowledge": 0.55, "mastery": 0.55, "speed": 0.50, "confidence": 0.48,
        "consistency": 0.52, "patternRecognition": 0.44, "attempts": 6, "correct": 3,
        "avgTimeMs": 82000, "lastSeen": _now_minus(days=3, hours=2),
        "hesitationCount": 4, "hintRequests": 3,
        "misconceptionHistogram": {"optimization_blindness": 3, "edge_case_blindness": 1},
    },
    "binary_search": {
        "knowledge": 0.52, "mastery": 0.52, "speed": 0.48, "confidence": 0.45,
        "consistency": 0.50, "patternRecognition": 0.42, "attempts": 5, "correct": 3,
        "avgTimeMs": 78000, "lastSeen": _now_minus(days=4),
        "hesitationCount": 3, "hintRequests": 2,
    },
    "prefix_sum": {
        "knowledge": 0.48, "mastery": 0.48, "speed": 0.44, "confidence": 0.40,
        "consistency": 0.46, "patternRecognition": 0.36, "attempts": 4, "correct": 2,
        "avgTimeMs": 88000, "lastSeen": _now_minus(days=4, hours=6),
        "hesitationCount": 3, "hintRequests": 2,
    },
    "queue": {
        "knowledge": 0.50, "mastery": 0.50, "speed": 0.46, "confidence": 0.44,
        "consistency": 0.48, "patternRecognition": 0.38, "attempts": 4, "correct": 2,
        "avgTimeMs": 80000, "lastSeen": _now_minus(days=5),
    },
    "recursion": {
        "knowledge": 0.45, "mastery": 0.45, "speed": 0.40, "confidence": 0.38,
        "consistency": 0.42, "patternRecognition": 0.34, "attempts": 5, "correct": 2,
        "avgTimeMs": 95000, "lastSeen": _now_minus(days=5, hours=3),
        "hesitationCount": 5, "hintRequests": 4,
        "misconceptionHistogram": {"prereq_gap": 3, "incomplete_solution": 2},
    },
    "linked_list": {
        "knowledge": 0.42, "mastery": 0.42, "speed": 0.38, "confidence": 0.36,
        "consistency": 0.40, "patternRecognition": 0.30, "attempts": 4, "correct": 2,
        "avgTimeMs": 98000, "lastSeen": _now_minus(days=5, hours=8),
        "hesitationCount": 4, "hintRequests": 3,
    },
    "binary_tree": {
        "knowledge": 0.32, "mastery": 0.32, "speed": 0.28, "confidence": 0.24,
        "consistency": 0.30, "patternRecognition": 0.20, "attempts": 3, "correct": 1,
        "avgTimeMs": 110000, "lastSeen": _now_minus(days=6),
        "hesitationCount": 6, "hintRequests": 5,
        "misconceptionHistogram": {"prereq_gap": 2, "complexity_confusion": 2},
    },
    "heap": {
        "knowledge": 0.22, "mastery": 0.22, "speed": 0.18, "confidence": 0.14,
        "consistency": 0.20, "patternRecognition": 0.12, "attempts": 2, "correct": 0,
        "avgTimeMs": 120000, "lastSeen": _now_minus(days=6, hours=4),
        "hesitationCount": 6, "hintRequests": 5,
    },
    "bst": {
        "knowledge": 0.25, "mastery": 0.25, "speed": 0.20, "confidence": 0.18,
        "consistency": 0.22, "patternRecognition": 0.14, "attempts": 2, "correct": 0,
        "avgTimeMs": 115000, "lastSeen": _now_minus(days=7),
        "hesitationCount": 5, "hintRequests": 4,
    },
    "graph_basics": {
        "knowledge": 0.18, "mastery": 0.18, "speed": 0.14, "confidence": 0.10,
        "consistency": 0.16, "patternRecognition": 0.08, "attempts": 2, "correct": 0,
        "avgTimeMs": 130000, "lastSeen": _now_minus(days=8),
        "hesitationCount": 7, "hintRequests": 6,
        "misconceptionHistogram": {"complexity_confusion": 2, "prereq_gap": 3},
    },
    "bfs": {
        "knowledge": 0.12, "mastery": 0.12, "speed": 0.10, "confidence": 0.08,
        "consistency": 0.10, "patternRecognition": 0.06, "attempts": 1, "correct": 0,
        "avgTimeMs": 140000, "lastSeen": _now_minus(days=9),
        "hesitationCount": 5, "hintRequests": 5,
    },
    "dfs": {
        "knowledge": 0.10, "mastery": 0.10, "speed": 0.08, "confidence": 0.06,
        "consistency": 0.08, "patternRecognition": 0.05, "attempts": 1, "correct": 0,
        "avgTimeMs": 145000, "lastSeen": _now_minus(days=10),
        "hesitationCount": 6, "hintRequests": 5,
    },
    "dp_intro": {
        "knowledge": 0.10, "mastery": 0.10, "speed": 0.07, "confidence": 0.05,
        "consistency": 0.08, "patternRecognition": 0.04, "attempts": 1, "correct": 0,
        "avgTimeMs": 150000, "lastSeen": _now_minus(days=11),
        "hesitationCount": 7, "hintRequests": 6,
        "misconceptionHistogram": {"optimization_blindness": 2, "complexity_confusion": 3},
    },
}

_READINESS_HISTORY = [
    {"total": 5.2, "timestamp": _now_minus(days=13)},
    {"total": 9.8, "timestamp": _now_minus(days=11)},
    {"total": 14.5, "timestamp": _now_minus(days=10)},
    {"total": 18.2, "timestamp": _now_minus(days=8)},
    {"total": 22.6, "timestamp": _now_minus(days=7)},
    {"total": 27.1, "timestamp": _now_minus(days=6)},
    {"total": 30.8, "timestamp": _now_minus(days=5)},
    {"total": 33.5, "timestamp": _now_minus(days=4)},
    {"total": 35.9, "timestamp": _now_minus(days=3)},
    {"total": 37.4, "timestamp": _now_minus(days=2)},
    {"total": 38.8, "timestamp": _now_minus(days=1)},
]

_DEMO_EVENTS = [
    # Today — solved two arrays problems, one strings
    {
        "kind": "solve_submit", "topic": "arrays", "pattern": "hash_map",
        "correct": True, "problem_id": "two_sum",
        "passed": 5, "total": 5, "language": "python",
        "total_time_ms": 420000, "first_keystroke_ms": 75000,
        "approach_written": True, "hints_requested": 0, "num_runs": 2,
        "mastery_delta": 0.062, "timed_out": False,
    },
    {
        "kind": "solve_submit", "topic": "arrays", "pattern": "sliding_window",
        "correct": True, "problem_id": "contains_duplicate",
        "passed": 4, "total": 4, "language": "python",
        "total_time_ms": 280000, "first_keystroke_ms": 12000,
        "approach_written": False, "hints_requested": 0, "num_runs": 1,
        "mastery_delta": 0.041, "timed_out": False,
    },
    {
        "kind": "solve_submit", "topic": "strings", "pattern": "hash_map",
        "correct": True, "problem_id": "valid_anagram",
        "passed": 5, "total": 5, "language": "python",
        "total_time_ms": 310000, "first_keystroke_ms": 55000,
        "approach_written": True, "hints_requested": 1, "num_runs": 3,
        "mastery_delta": 0.053, "timed_out": False,
    },
    # Yesterday
    {
        "kind": "solve_submit", "topic": "hashing", "pattern": "grouping",
        "correct": True, "problem_id": "group_anagrams",
        "passed": 4, "total": 4, "language": "python",
        "total_time_ms": 580000, "first_keystroke_ms": 90000,
        "approach_written": True, "hints_requested": 2, "num_runs": 4,
        "mastery_delta": 0.055, "timed_out": False,
    },
    {
        "kind": "solve_submit", "topic": "two_pointers", "pattern": "two_pointers",
        "correct": False, "problem_id": "three_sum",
        "passed": 2, "total": 5, "language": "python",
        "total_time_ms": 920000, "first_keystroke_ms": 4000,
        "approach_written": False, "hints_requested": 3, "num_runs": 7,
        "mastery_delta": -0.02, "timed_out": False,
    },
    {
        "kind": "solve_submit", "topic": "sliding_window", "pattern": "variable_window",
        "correct": False, "problem_id": "longest_substring_without_repeating",
        "passed": 3, "total": 6, "language": "python",
        "total_time_ms": 1100000, "first_keystroke_ms": 8000,
        "approach_written": False, "hints_requested": 4, "num_runs": 9,
        "mastery_delta": -0.018, "timed_out": True,
    },
    # 2 days ago
    {
        "kind": "solve_submit", "topic": "sorting", "pattern": "interval_merge",
        "correct": True, "problem_id": "merge_intervals",
        "passed": 4, "total": 4, "language": "python",
        "total_time_ms": 490000, "first_keystroke_ms": 65000,
        "approach_written": True, "hints_requested": 1, "num_runs": 3,
        "mastery_delta": 0.048, "timed_out": False,
    },
    {
        "kind": "solve_submit", "topic": "stack", "pattern": "monotonic_stack",
        "correct": True, "problem_id": "valid_parentheses",
        "passed": 5, "total": 5, "language": "python",
        "total_time_ms": 350000, "first_keystroke_ms": 30000,
        "approach_written": True, "hints_requested": 0, "num_runs": 2,
        "mastery_delta": 0.058, "timed_out": False,
    },
    # 3 days ago
    {
        "kind": "solve_submit", "topic": "binary_search", "pattern": "binary_search",
        "correct": True, "problem_id": "binary_search",
        "passed": 4, "total": 4, "language": "python",
        "total_time_ms": 400000, "first_keystroke_ms": 45000,
        "approach_written": True, "hints_requested": 0, "num_runs": 2,
        "mastery_delta": 0.06, "timed_out": False,
    },
    {
        "kind": "solve_submit", "topic": "recursion", "pattern": "dp_memoization",
        "correct": False, "problem_id": "climbing_stairs",
        "passed": 1, "total": 4, "language": "python",
        "total_time_ms": 750000, "first_keystroke_ms": 3500,
        "approach_written": False, "hints_requested": 5, "num_runs": 6,
        "mastery_delta": -0.015, "timed_out": False,
    },
    # 5 days ago
    {
        "kind": "solve_submit", "topic": "linked_list", "pattern": "two_pointers",
        "correct": False, "problem_id": "reverse_linked_list",
        "passed": 2, "total": 5, "language": "python",
        "total_time_ms": 860000, "first_keystroke_ms": 2000,
        "approach_written": False, "hints_requested": 3, "num_runs": 8,
        "mastery_delta": -0.01, "timed_out": False,
    },
    {
        "kind": "solve_submit", "topic": "binary_tree", "pattern": "dfs_traversal",
        "correct": False, "problem_id": "max_depth_binary_tree",
        "passed": 1, "total": 5, "language": "python",
        "total_time_ms": 980000, "first_keystroke_ms": 5000,
        "approach_written": False, "hints_requested": 6, "num_runs": 5,
        "mastery_delta": -0.008, "timed_out": False,
    },
]


def _build_demo_model(uid: str) -> dict:
    topics: dict[str, dict] = {}
    for key in TOPIC_GRAPH:
        base = default_topic_stat()
        if key in _RICH_TOPICS:
            base.update(_RICH_TOPICS[key])
        topics[key] = base

    readiness = {
        "total": 38.8,
        "coverage": 46.7,
        "accuracy": 54.2,
        "speed": 38.0,
        "consistency": 42.5,
        "recency": 72.0,
        "timestamp": _now_minus(),
    }

    return {
        "uid": uid,
        "topics": topics,
        "patternStats": {},
        "learningStyle": "analytical",
        "pacePreference": "adaptive",
        "currentFocus": "sliding_window",
        "weaknessVector": ["recursion", "binary_tree", "graph_basics", "dp_intro"],
        "strengthVector": ["arrays", "strings", "sorting"],
        "sessionCount": 12,
        "totalMinutes": 340,
        "questionCounter": 82,
        "readiness": readiness,
        "readinessHistory": list(_READINESS_HISTORY),
        "agentState": default_agent_state(),
    }


def _build_demo_profile() -> dict:
    return {
        "email": "demo@neuraldsa.local",
        "name": "Demo User",
        "goal": "placement",
        "dailyGoalMinutes": 30,
        "onboarded": True,
    }


# ─── Public API (mirrors original interface) ──────────────────────────────────

def get_model(token: str) -> dict:
    uid = get_demo_uid(token)
    model = sqlite_store.get_model(uid)
    if model is None:
        model = _build_demo_model(uid)
        sqlite_store.save_model(uid, model)
        # Seed events for new demo tokens
        for i, ev in enumerate(_DEMO_EVENTS):
            days_ago = max(0, i // 3)
            ts = (datetime.now(timezone.utc) - timedelta(days=days_ago, hours=i % 8)).isoformat()
            sqlite_store.append_event(uid, {**ev, "ts": ts})
    return migrate_knowledge_model(model)


def save_model(token: str, model: dict) -> None:
    sqlite_store.save_model(get_demo_uid(token), migrate_knowledge_model(model))


def get_profile(token: str) -> dict:
    uid = get_demo_uid(token)
    profile = sqlite_store.get_profile(uid)
    if profile is None:
        profile = _build_demo_profile()
        sqlite_store.save_profile(uid, profile)
    return profile


def save_profile(token: str, profile: dict) -> None:
    sqlite_store.save_profile(get_demo_uid(token), profile)


def add_event(token: str, event: dict) -> None:
    sqlite_store.append_event(get_demo_uid(token), event)


# alias used by some routers
def append_event(token: str, event: dict) -> None:
    add_event(token, event)


def list_events(token: str, limit: int = 100) -> list[dict]:
    return sqlite_store.list_events(get_demo_uid(token), limit)


def increment_session(token: str, total_minutes: int) -> None:
    model = get_model(token)
    model["sessionCount"] = model.get("sessionCount", 0) + 1
    model["totalMinutes"] = model.get("totalMinutes", 0) + total_minutes
    save_model(token, model)


def save_agent_state(token: str, agent_state: dict) -> None:
    model = get_model(token)
    model["agentState"] = agent_state
    save_model(token, model)


def get_agent_state(token: str) -> dict:
    model = get_model(token)
    return model.get("agentState", default_agent_state())

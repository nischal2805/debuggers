"""
In-memory store for demo sessions.
Demo tokens have format: demo_<8-char-id>
No Firebase, no Firestore — everything lives in these dicts for the process lifetime.
"""

from datetime import datetime, timezone

from models.knowledge import (
    TOPIC_GRAPH,
    default_topic_stat,
    default_agent_state,
    default_readiness,
    migrate_knowledge_model,
)

# { demo_token: knowledge_model_dict }
_models: dict[str, dict] = {}

# { demo_token: profile_dict }
_profiles: dict[str, dict] = {}

# { demo_token: list[event_dict] } — append-only telemetry log per demo user
_events: dict[str, list[dict]] = {}


def is_demo_token(token: str) -> bool:
    return token.startswith("demo_")


def get_demo_uid(token: str) -> str:
    return token  # token IS the uid for demo sessions


def _build_demo_model(uid: str) -> dict:
    topics: dict[str, dict] = {}
    for key in TOPIC_GRAPH:
        topics[key] = default_topic_stat()

    # Seed beginner priors so the first session feels calibrated, not cold
    for key in ("arrays", "strings", "sorting"):
        topics[key]["knowledge"] = 0.25
        topics[key]["mastery"] = 0.25
        topics[key]["confidence"] = 0.15

    return {
        "uid": uid,
        "topics": topics,
        "patternStats": {},
        "learningStyle": "visual",
        "pacePreference": "adaptive",
        "currentFocus": "arrays",
        "weaknessVector": [],
        "strengthVector": [],
        "sessionCount": 0,
        "totalMinutes": 0,
        "questionCounter": 0,
        "readiness": default_readiness(),
        "readinessHistory": [],
        "agentState": default_agent_state(),
    }


def get_model(token: str) -> dict:
    uid = get_demo_uid(token)
    if uid not in _models:
        _models[uid] = _build_demo_model(uid)
    # Migrate on read so older in-memory models pick up new fields
    _models[uid] = migrate_knowledge_model(_models[uid])
    return _models[uid]


def save_model(token: str, model: dict) -> None:
    _models[get_demo_uid(token)] = migrate_knowledge_model(model)


def get_profile(token: str) -> dict:
    uid = get_demo_uid(token)
    if uid not in _profiles:
        _profiles[uid] = {
            "email": "demo@neuraldsa.local",
            "name": "Demo User",
            "goal": "placement",
            "dailyGoalMinutes": 30,
            "onboarded": True,
        }
    return _profiles[uid]


def increment_session(token: str, total_minutes: int) -> None:
    model = get_model(token)
    model["sessionCount"] = model.get("sessionCount", 0) + 1
    model["totalMinutes"] = model.get("totalMinutes", 0) + total_minutes


# ─── Telemetry events (mirrors the Firestore /events subcollection) ──────────


def append_event(token: str, event: dict) -> None:
    uid = get_demo_uid(token)
    log = _events.setdefault(uid, [])
    enriched = {**event, "ts": datetime.now(timezone.utc).isoformat()}
    log.append(enriched)
    if len(log) > 500:
        del log[:-500]


def list_events(token: str, limit: int = 100) -> list[dict]:
    uid = get_demo_uid(token)
    return list(_events.get(uid, []))[-limit:]


def save_agent_state(token: str, agent_state: dict) -> None:
    model = get_model(token)
    model["agentState"] = agent_state


def get_agent_state(token: str) -> dict:
    model = get_model(token)
    return model.get("agentState", default_agent_state())

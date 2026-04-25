"""
Firestore persistence layer.

Collections:
  users/{uid}                                 — profile
  users/{uid}/knowledgeModel/current          — full brain model (5D, behavior, patterns)
  users/{uid}/agentState/current              — last mode, queue snapshot, recap memory
  users/{uid}/sessions/{sessionId}            — per-session summary + report
  users/{uid}/events/{auto}                   — append-only telemetry events
"""

from datetime import datetime, timezone
import time as _time

from firebase_admin import firestore

from models.knowledge import (
    migrate_knowledge_model,
    default_agent_state,
)


def get_db():
    return firestore.client()


# ─── Knowledge model ─────────────────────────────────────────────────────────


async def get_knowledge_model(uid: str) -> dict:
    db = get_db()
    ref = db.collection("users").document(uid).collection("knowledgeModel").document("current")
    snap = ref.get()
    raw = snap.to_dict() if snap.exists else {}
    return migrate_knowledge_model(raw)


async def save_knowledge_model(uid: str, model: dict) -> None:
    db = get_db()
    model = migrate_knowledge_model(model)
    ref = db.collection("users").document(uid).collection("knowledgeModel").document("current")
    ref.set(model)


# ─── Agent state ─────────────────────────────────────────────────────────────


async def get_agent_state(uid: str) -> dict:
    db = get_db()
    ref = db.collection("users").document(uid).collection("agentState").document("current")
    snap = ref.get()
    if snap.exists:
        return snap.to_dict() or default_agent_state()
    return default_agent_state()


async def save_agent_state(uid: str, agent_state: dict) -> None:
    db = get_db()
    ref = db.collection("users").document(uid).collection("agentState").document("current")
    ref.set(agent_state)


# ─── Profile ─────────────────────────────────────────────────────────────────


async def get_user_profile(uid: str) -> dict:
    db = get_db()
    ref = db.collection("users").document(uid)
    snap = ref.get()
    return snap.to_dict() if snap.exists else {}


# ─── Sessions + events ───────────────────────────────────────────────────────


async def save_session_summary(uid: str, session_state: dict) -> None:
    db = get_db()
    session_id = str(int(_time.time() * 1000))

    mastery_start = session_state.get("mastery_start", 0)
    mastery_end = session_state.get("mastery_end", mastery_start)
    mastery_delta = round(mastery_end - mastery_start, 4)

    total_ms = session_state.get("total_time_ms", 0)
    total_minutes = max(1, round(total_ms / 60000))

    raw_history = session_state.get("conversation_history", [])
    compressed = raw_history[-20:]

    session_ref = (
        db.collection("users")
        .document(uid)
        .collection("sessions")
        .document(session_id)
    )
    session_ref.set({
        "topicId": session_state.get("topic", ""),
        "activeTopicAtEnd": session_state.get("active_topic", ""),
        "prereqStackAtEnd": session_state.get("prereq_stack", []),
        "startedAt": session_state.get("start_time"),
        "endedAt": firestore.SERVER_TIMESTAMP,
        "questionsAsked": session_state.get("questions_asked", 0),
        "correctAnswers": session_state.get("correct_answers", 0),
        "hintsUsed": session_state.get("hints_used", 0),
        "masteryDelta": mastery_delta,
        "masteryStart": mastery_start,
        "masteryEnd": mastery_end,
        "totalMinutes": total_minutes,
        "messages": compressed,
        "modeLog": session_state.get("mode_log", [])[-30:],
        "lastMode": session_state.get("last_mode"),
    })

    user_ref = db.collection("users").document(uid)
    user_ref.update({
        "sessionCount": firestore.Increment(1),
        "totalMinutes": firestore.Increment(total_minutes),
    })


async def append_event(uid: str, event: dict) -> None:
    """Append-only telemetry event. Cheap fire-and-forget writes."""
    db = get_db()
    enriched = {**event, "ts": datetime.now(timezone.utc).isoformat()}
    db.collection("users").document(uid).collection("events").add(enriched)

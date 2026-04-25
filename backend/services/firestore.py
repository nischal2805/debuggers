from firebase_admin import firestore
from models.knowledge import KnowledgeModel


def get_db():
    return firestore.client()


async def get_knowledge_model(uid: str) -> dict:
    db = get_db()
    ref = db.collection("users").document(uid).collection("knowledgeModel").document("current")
    snap = ref.get()
    return snap.to_dict() if snap.exists else {}


async def save_knowledge_model(uid: str, model: dict) -> None:
    db = get_db()
    ref = db.collection("users").document(uid).collection("knowledgeModel").document("current")
    ref.set(model)


async def get_user_profile(uid: str) -> dict:
    db = get_db()
    ref = db.collection("users").document(uid)
    snap = ref.get()
    return snap.to_dict() if snap.exists else {}


async def save_session_summary(uid: str, session_state: dict) -> None:
    db = get_db()
    import time as _time
    session_id = str(int(_time.time() * 1000))

    mastery_start = session_state.get("mastery_start", 0)
    mastery_end = session_state.get("mastery_end", mastery_start)
    mastery_delta = round(mastery_end - mastery_start, 4)

    total_ms = session_state.get("total_time_ms", 0)
    total_minutes = max(1, round(total_ms / 60000))

    # Keep up to 20 compressed messages
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
    })

    user_ref = db.collection("users").document(uid)
    user_ref.update({
        "sessionCount": firestore.Increment(1),
        "totalMinutes": firestore.Increment(total_minutes),
    })

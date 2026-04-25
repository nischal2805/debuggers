"""
WebSocket session router.

Agent loop per message:
  1. Parse action + user input
  2. If action=answer → call evaluate_answer() (structured LLM eval)
  3. stream_agent_response() → agent_decide() → build_agent_prompt() → stream Gemini
  4. On answer: update_mastery() with eval result, save to Firestore
  5. Emit mastery_update to frontend
  6. If agent pivoted topic (prereq gap), emit topic_change to frontend
"""

import json
from datetime import datetime, timezone
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query
import firebase_admin.auth as fb_auth
from services.firestore import get_knowledge_model, save_knowledge_model, save_session_summary, get_user_profile
from services.gemini import stream_agent_response, evaluate_answer
from models.knowledge import update_mastery

router = APIRouter(prefix="/session", tags=["session"])

# One active session per user — prevents rate-limit hammering
_active_sessions: dict[str, bool] = {}


@router.websocket("/stream")
async def session_stream(
    websocket: WebSocket,
    token: str = Query(...),
    topic: str = Query("arrays"),
):
    await websocket.accept()

    try:
        decoded = fb_auth.verify_id_token(token)
        uid = decoded["uid"]
    except Exception:
        await websocket.send_json({"type": "error", "message": "Invalid token"})
        await websocket.close()
        return

    if _active_sessions.get(uid):
        await websocket.send_json({"type": "error", "message": "Session already active"})
        await websocket.close()
        return

    _active_sessions[uid] = True

    knowledge_model = await get_knowledge_model(uid)
    profile = await get_user_profile(uid)

    now = datetime.now(timezone.utc).isoformat()
    mastery_start = knowledge_model.get("topics", {}).get(topic, {}).get("mastery", 0)

    session_state: dict = {
        "topic": topic,               # original requested topic (never changes)
        "active_topic": topic,        # current topic being taught (may change via prereq pivot)
        "prereq_stack": [],           # stack of original topics when pivoting to prereqs
        "goal": profile.get("goal", "learning"),
        "questions_asked": 0,
        "correct_answers": 0,
        "hints_used": 0,
        "start_time": now,
        "last_question": "",
        "last_pattern": "",
        "last_difficulty": 3,
        "mastery_start": mastery_start,
        "mastery_end": mastery_start,
        "conversation_history": [],
        "consecutive_correct": 0,
        "consecutive_wrong": 0,
        "hint_count_on_current_q": 0,
        "total_time_ms": 0,
    }

    try:
        while True:
            raw = await websocket.receive_text()
            data = json.loads(raw)
            action: str = data.get("action", "")

            if action == "end":
                session_state["mastery_end"] = (
                    knowledge_model.get("topics", {})
                    .get(session_state["active_topic"], {})
                    .get("mastery", mastery_start)
                )
                await save_session_summary(uid, session_state)
                await websocket.send_json({"type": "session_ended"})
                break

            user_message: str = data.get("answer", "")
            time_ms: int = data.get("time_ms", 60000)
            session_state["total_time_ms"] += time_ms

            if action == "hint_request":
                session_state["hints_used"] += 1
                session_state["hint_count_on_current_q"] += 1

            if user_message:
                session_state["conversation_history"].append({
                    "role": "user",
                    "content": user_message,
                })

            # ── Structured evaluation (only for answers) ─────────────────────
            evaluation: dict | None = None
            if action == "answer" and session_state["last_question"]:
                active_topic = session_state["active_topic"]
                evaluation = await evaluate_answer(
                    topic=active_topic,
                    pattern=session_state.get("last_pattern", ""),
                    question=session_state["last_question"],
                    user_answer=user_message,
                    difficulty=session_state.get("last_difficulty", 3),
                    mastery=knowledge_model.get("topics", {}).get(active_topic, {}).get("mastery", 0),
                    time_ms=time_ms,
                )
                # Emit evaluation to frontend immediately (fast feedback)
                await websocket.send_json({
                    "type": "evaluation",
                    "correct": evaluation.get("correct", False),
                    "partial_credit": evaluation.get("partial_credit", 0),
                    "feedback": evaluation.get("feedback", ""),
                    "errors": evaluation.get("errors", []),
                    "hint_for_retry": evaluation.get("hint_for_retry"),
                })

            # ── Agent streaming response ──────────────────────────────────────
            full_response_data: dict | None = None
            active_topic_before = session_state["active_topic"]

            async for chunk in stream_agent_response(
                knowledge_model=knowledge_model,
                session_state=session_state,
                action=action,
                user_message=user_message,
                evaluation=evaluation,
            ):
                await websocket.send_json(chunk)
                if chunk["type"] == "response":
                    full_response_data = chunk["data"]

            # ── Post-response state updates ───────────────────────────────────
            if full_response_data:
                tutor_content = full_response_data.get("content", "")
                session_state["conversation_history"].append({
                    "role": "tutor",
                    "content": tutor_content,
                })

                if full_response_data.get("type") in ("question", "prereq_intervention"):
                    session_state["last_question"] = tutor_content
                    session_state["last_pattern"] = full_response_data.get("pattern_name") or ""
                    session_state["last_difficulty"] = full_response_data.get("difficulty_level", 3)
                    session_state["questions_asked"] += 1
                    session_state["hint_count_on_current_q"] = 0

                if evaluation is not None:
                    correct = evaluation.get("correct", False)
                    active_topic = session_state["active_topic"]

                    if correct:
                        session_state["correct_answers"] += 1
                        session_state["consecutive_correct"] += 1
                        session_state["consecutive_wrong"] = 0
                    else:
                        session_state["consecutive_correct"] = 0
                        session_state["consecutive_wrong"] += 1

                    hint_used = session_state["hint_count_on_current_q"] > 0
                    knowledge_model = update_mastery(
                        topic=active_topic,
                        correct=correct,
                        time_ms=time_ms,
                        hint_used=hint_used,
                        model=knowledge_model,
                    )
                    await save_knowledge_model(uid, knowledge_model)

                    new_mastery = knowledge_model["topics"][active_topic]["mastery"]
                    new_confidence = knowledge_model["topics"][active_topic]["confidence"]
                    await websocket.send_json({
                        "type": "mastery_update",
                        "topic": active_topic,
                        "mastery": new_mastery,
                        "confidence": new_confidence,
                    })

                # Notify frontend if agent pivoted to a different topic
                active_topic_after = session_state["active_topic"]
                if active_topic_after != active_topic_before:
                    prereq_gap = full_response_data.get("prereq_gap", {})
                    await websocket.send_json({
                        "type": "topic_change",
                        "previous_topic": active_topic_before,
                        "new_topic": active_topic_after,
                        "reason": prereq_gap.get("explanation") or "prerequisite gap detected",
                        "prereq_stack": session_state["prereq_stack"],
                    })

                if full_response_data.get("next_action") == "end_session":
                    session_state["mastery_end"] = (
                        knowledge_model.get("topics", {})
                        .get(session_state["active_topic"], {})
                        .get("mastery", mastery_start)
                    )
                    await save_session_summary(uid, session_state)
                    await websocket.send_json({"type": "session_ended"})
                    break

            # Trim conversation history to last 20 turns
            if len(session_state["conversation_history"]) > 20:
                session_state["conversation_history"] = session_state["conversation_history"][-20:]

    except WebSocketDisconnect:
        pass
    except Exception as e:
        try:
            await websocket.send_json({"type": "error", "message": str(e)})
        except Exception:
            pass
    finally:
        _active_sessions.pop(uid, None)
        try:
            await websocket.close()
        except Exception:
            pass

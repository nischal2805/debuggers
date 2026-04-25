"""
WebSocket session router.

Per-message pipeline:
  1. Parse action + user input + telemetry (time_ms, first_input_ms, hesitation_ms, thought_trace)
  2. stream_agent_response() yields agent_mode → agent_action → chunks → response
  3. On answer: read evaluation, update 5D brain model, persist event, refresh readiness
  4. Emit mastery_update / readiness_update / agent_mode / topic_change events
  5. Save agentState snapshot for cross-session continuity
"""

import json
from datetime import datetime, timezone

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query
import firebase_admin.auth as fb_auth

from services.firestore import (
    get_knowledge_model,
    save_knowledge_model,
    save_session_summary,
    get_user_profile,
    get_agent_state,
    save_agent_state,
    append_event,
)
from services.gemini import stream_agent_response
from services import demo_store
from services.curriculum import compute_priority_queue, explain_top_choice
from services.report_card import generate_session_report
from models.knowledge import (
    update_mastery,
    update_readiness,
    apply_forgetting_decay,
    confidence_calibration_gap,
    migrate_knowledge_model,
    default_agent_state,
)


router = APIRouter(prefix="/session", tags=["session"])

# One active session per user — prevents rate-limit hammering
_active_sessions: dict[str, bool] = {}


def _normalize_evaluation_payload(value: dict | None) -> dict | None:
    if not isinstance(value, dict):
        return None
    try:
        partial_credit = float(value.get("partial_credit", 0.0))
    except Exception:
        partial_credit = 0.0
    partial_credit = max(0.0, min(1.0, partial_credit))
    fp = value.get("error_fingerprint")
    if isinstance(fp, str):
        fp = fp.strip().lower() or None
    return {
        "correct": bool(value.get("correct", False)),
        "partial_credit": partial_credit,
        "feedback": str(value.get("feedback", "")),
        "errors": value.get("errors", []) or [],
        "hint_for_retry": value.get("hint_for_retry"),
        "error_fingerprint": fp,
        "optimality_score": value.get("optimality_score"),
    }


async def _persist_event(is_demo: bool, uid_or_token: str, event: dict) -> None:
    """Best-effort telemetry persistence; never raises into the WS loop."""
    try:
        if is_demo:
            demo_store.append_event(uid_or_token, event)
        else:
            await append_event(uid_or_token, event)
    except Exception:
        pass


@router.websocket("/stream")
async def session_stream(
    websocket: WebSocket,
    token: str = Query(...),
    topic: str = Query("arrays"),
):
    await websocket.accept()

    is_demo = demo_store.is_demo_token(token)

    if is_demo:
        uid = demo_store.get_demo_uid(token)
        knowledge_model = demo_store.get_model(token)
        profile = demo_store.get_profile(token)
        agent_state = demo_store.get_agent_state(token)
        token_or_uid = token  # demo store keys by token
    else:
        try:
            import firebase_admin
            if not firebase_admin._apps:
                await websocket.send_json({"type": "error", "message": "Firebase not configured — use demo mode"})
                await websocket.close()
                return
            decoded = fb_auth.verify_id_token(token)
            uid = decoded["uid"]
        except Exception:
            await websocket.send_json({"type": "error", "message": "Invalid token"})
            await websocket.close()
            return
        knowledge_model = await get_knowledge_model(uid)
        profile = await get_user_profile(uid)
        agent_state = await get_agent_state(uid)
        token_or_uid = uid

    knowledge_model = migrate_knowledge_model(knowledge_model)
    if not isinstance(agent_state, dict) or not agent_state:
        agent_state = default_agent_state()

    _active_sessions[uid] = True

    # Apply forgetting-curve decay at session start; surface affected topics
    review_topics = apply_forgetting_decay(knowledge_model)
    if review_topics:
        await websocket.send_json({
            "type": "review_due",
            "topics": review_topics[:8],
            "reason": "forgetting curve decay since last seen",
        })

    # Compute initial readiness + priority queue
    goal = profile.get("goal", "learning")
    readiness_snapshot = update_readiness(knowledge_model, goal)
    queue = compute_priority_queue(knowledge_model, goal=goal)
    await websocket.send_json({
        "type": "readiness_update",
        "snapshot": readiness_snapshot,
        "calibration_gap": confidence_calibration_gap(knowledge_model),
    })
    await websocket.send_json({
        "type": "priority_queue",
        "queue": queue,
        "explanation": explain_top_choice(queue),
    })

    now = datetime.now(timezone.utc).isoformat()
    mastery_start = (
        knowledge_model.get("topics", {})
        .get(topic, {})
        .get("knowledge", knowledge_model.get("topics", {}).get(topic, {}).get("mastery", 0))
    )

    session_state: dict = {
        "topic": topic,
        "active_topic": topic,
        "prereq_stack": [],
        "goal": goal,
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
        "last_mode": agent_state.get("lastMode", "ASSESS"),
        "last_mode_reason": agent_state.get("lastReason", ""),
        "mode_log": [],
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
                    .get("knowledge", mastery_start)
                )
                report = await generate_session_report(session_state, knowledge_model, goal=goal)
                await websocket.send_json({"type": "report_card", "report": report})

                if is_demo:
                    demo_store.increment_session(token, max(1, session_state["total_time_ms"] // 60000))
                    demo_store.save_agent_state(token, {
                        "lastMode": session_state.get("last_mode", "ASSESS"),
                        "lastReason": session_state.get("last_mode_reason", ""),
                        "lastTopic": session_state["active_topic"],
                        "queueSnapshot": compute_priority_queue(knowledge_model, goal=goal)[:8],
                        "pendingReview": review_topics,
                        "recapMemory": agent_state.get("recapMemory", []),
                    })
                else:
                    session_state["report_card"] = report
                    await save_session_summary(uid, session_state)
                    await save_agent_state(uid, {
                        "lastMode": session_state.get("last_mode", "ASSESS"),
                        "lastReason": session_state.get("last_mode_reason", ""),
                        "lastTopic": session_state["active_topic"],
                        "queueSnapshot": compute_priority_queue(knowledge_model, goal=goal)[:8],
                        "pendingReview": review_topics,
                        "recapMemory": agent_state.get("recapMemory", []),
                    })
                await websocket.send_json({"type": "session_ended"})
                break

            user_message: str = ""
            time_ms: int = 0
            first_input_ms: int = 0
            hesitation_ms: int | None = None
            thought_trace: str | None = None

            if action == "answer":
                user_message = data.get("answer", "")
                time_ms = max(0, int(data.get("time_ms", 60000)))
                first_input_ms = max(0, int(data.get("first_input_ms", 0)))
                hesitation_ms = first_input_ms or None
                thought_trace = data.get("thought_trace")
                session_state["total_time_ms"] += time_ms
            elif action == "learner_query":
                user_message = data.get("query", "")

            if action == "hint_request":
                session_state["hints_used"] += 1
                session_state["hint_count_on_current_q"] += 1

            if user_message:
                session_state["conversation_history"].append({
                    "role": "user",
                    "content": user_message,
                })

            evaluation: dict | None = None
            full_response_data: dict | None = None
            active_topic_before = session_state["active_topic"]
            agent_mode_for_event: str | None = None
            agent_mode_reason_for_event: str | None = None

            async for chunk in stream_agent_response(
                knowledge_model=knowledge_model,
                session_state=session_state,
                action=action,
                user_message=user_message,
                evaluation=evaluation,
            ):
                if chunk["type"] == "agent_mode":
                    agent_mode_for_event = chunk.get("mode")
                    agent_mode_reason_for_event = chunk.get("reason")
                await websocket.send_json(chunk)
                if chunk["type"] == "response":
                    full_response_data = chunk["data"]

            if not full_response_data:
                continue

            tutor_content = full_response_data.get("content", "")
            session_state["conversation_history"].append({
                "role": "tutor",
                "content": tutor_content,
            })

            if action != "learner_query" and full_response_data.get("type") in ("question", "prereq_intervention"):
                session_state["last_question"] = tutor_content
                session_state["last_pattern"] = full_response_data.get("pattern_name") or ""
                session_state["last_difficulty"] = full_response_data.get("difficulty_level", 3)
                session_state["questions_asked"] += 1
                session_state["hint_count_on_current_q"] = 0

            if action == "answer":
                evaluation = _normalize_evaluation_payload(full_response_data.get("evaluation"))
                if evaluation is not None:
                    await websocket.send_json({
                        "type": "evaluation",
                        "correct": evaluation.get("correct", False),
                        "partial_credit": evaluation.get("partial_credit", 0),
                        "feedback": evaluation.get("feedback", ""),
                        "errors": evaluation.get("errors", []),
                        "hint_for_retry": evaluation.get("hint_for_retry"),
                        "error_fingerprint": evaluation.get("error_fingerprint"),
                        "optimality_score": evaluation.get("optimality_score"),
                    })

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
                pattern = session_state.get("last_pattern") or full_response_data.get("pattern_name") or None

                knowledge_model = update_mastery(
                    topic=active_topic,
                    correct=correct,
                    time_ms=time_ms,
                    hint_used=hint_used,
                    model=knowledge_model,
                    pattern=pattern,
                    hesitation_ms=hesitation_ms,
                    error_fingerprint=evaluation.get("error_fingerprint"),
                    confidence_signal=None,
                )

                # Refresh readiness + queue after model update
                new_readiness = update_readiness(knowledge_model, goal)
                queue = compute_priority_queue(knowledge_model, goal=goal)

                if is_demo:
                    demo_store.save_model(token, knowledge_model)
                else:
                    await save_knowledge_model(uid, knowledge_model)

                topic_stat = knowledge_model["topics"][active_topic]
                await websocket.send_json({
                    "type": "mastery_update",
                    "topic": active_topic,
                    "knowledge": topic_stat["knowledge"],
                    "mastery": topic_stat["knowledge"],
                    "speed": topic_stat["speed"],
                    "confidence": topic_stat["confidence"],
                    "consistency": topic_stat["consistency"],
                    "patternRecognition": topic_stat["patternRecognition"],
                })
                await websocket.send_json({
                    "type": "readiness_update",
                    "snapshot": new_readiness,
                    "calibration_gap": confidence_calibration_gap(knowledge_model),
                })
                await websocket.send_json({
                    "type": "priority_queue",
                    "queue": queue,
                    "explanation": explain_top_choice(queue),
                })

                # Telemetry event
                await _persist_event(is_demo, token_or_uid, {
                    "kind": "answer",
                    "topic": active_topic,
                    "pattern": pattern,
                    "correct": correct,
                    "partial_credit": evaluation.get("partial_credit", 0),
                    "time_ms": time_ms,
                    "first_input_ms": first_input_ms,
                    "hint_used": hint_used,
                    "thought_trace": thought_trace,
                    "error_fingerprint": evaluation.get("error_fingerprint"),
                    "optimality_score": evaluation.get("optimality_score"),
                    "mode": agent_mode_for_event,
                    "mode_reason": agent_mode_reason_for_event,
                })

            elif agent_mode_for_event:
                # Non-answer turn — still log the mode decision
                await _persist_event(is_demo, token_or_uid, {
                    "kind": "agent_decision",
                    "topic": session_state["active_topic"],
                    "action": action,
                    "mode": agent_mode_for_event,
                    "mode_reason": agent_mode_reason_for_event,
                })

            # Notify on topic pivot
            active_topic_after = session_state["active_topic"]
            if action != "learner_query" and active_topic_after != active_topic_before:
                prereq_gap = full_response_data.get("prereq_gap", {})
                await websocket.send_json({
                    "type": "topic_change",
                    "previous_topic": active_topic_before,
                    "new_topic": active_topic_after,
                    "reason": prereq_gap.get("explanation") or "prerequisite gap detected",
                    "prereq_stack": session_state["prereq_stack"],
                })

            if action != "learner_query" and full_response_data.get("next_action") == "end_session":
                session_state["mastery_end"] = (
                    knowledge_model.get("topics", {})
                    .get(session_state["active_topic"], {})
                    .get("knowledge", mastery_start)
                )
                report = await generate_session_report(session_state, knowledge_model, goal=goal)
                await websocket.send_json({"type": "report_card", "report": report})

                if is_demo:
                    demo_store.increment_session(token, max(1, session_state["total_time_ms"] // 60000))
                    demo_store.save_agent_state(token, {
                        "lastMode": session_state.get("last_mode", "ASSESS"),
                        "lastReason": session_state.get("last_mode_reason", ""),
                        "lastTopic": session_state["active_topic"],
                        "queueSnapshot": compute_priority_queue(knowledge_model, goal=goal)[:8],
                        "pendingReview": review_topics,
                        "recapMemory": agent_state.get("recapMemory", []),
                    })
                else:
                    session_state["report_card"] = report
                    await save_session_summary(uid, session_state)
                    await save_agent_state(uid, {
                        "lastMode": session_state.get("last_mode", "ASSESS"),
                        "lastReason": session_state.get("last_mode_reason", ""),
                        "lastTopic": session_state["active_topic"],
                        "queueSnapshot": compute_priority_queue(knowledge_model, goal=goal)[:8],
                        "pendingReview": review_topics,
                        "recapMemory": agent_state.get("recapMemory", []),
                    })
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

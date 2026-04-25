"""
Dashboard advisor chat.

POST /advisor/chat — Ask the advisor anything about your learning path.
Uses the full knowledge model as context. 1 LLM call per message.
"""

from __future__ import annotations

import json

from fastapi import APIRouter, HTTPException, Header
from pydantic import BaseModel

import firebase_admin.auth as fb_auth

from prompts.solve import ADVISOR_PROMPT
from services import demo_store
from services.firestore import get_knowledge_model
from services.llm_client import get_provider
from models.knowledge import migrate_knowledge_model, readiness_score


router = APIRouter(prefix="/advisor", tags=["advisor"])


class ChatMessage(BaseModel):
    role: str   # "user" | "assistant"
    content: str


class AdvisorChatRequest(BaseModel):
    message: str
    history: list[ChatMessage] = []


async def _resolve_token(authorization: str) -> tuple[str, bool, str]:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing token")
    token = authorization.split(" ", 1)[1]
    if demo_store.is_demo_token(token):
        return demo_store.get_demo_uid(token), True, token
    try:
        decoded = fb_auth.verify_id_token(token)
        return decoded["uid"], False, token
    except Exception as e:
        raise HTTPException(status_code=401, detail=str(e))


@router.post("/chat")
async def advisor_chat(req: AdvisorChatRequest, authorization: str = Header(...)):
    uid, is_demo, token = await _resolve_token(authorization)

    if is_demo:
        model = demo_store.get_model(token)
    else:
        model = await get_knowledge_model(uid)
    model = migrate_knowledge_model(model)

    # Build concise knowledge summary (don't send 40 topics verbatim)
    topics = model.get("topics", {})
    topic_summary = {
        tid: {
            "mastery": round(v.get("mastery", 0), 2),
            "attempts": v.get("attempts", 0),
            "correct": v.get("correct", 0),
        }
        for tid, v in topics.items()
        if v.get("attempts", 0) > 0 or v.get("mastery", 0) > 0
    }

    readiness = readiness_score(model)
    priority_q = model.get("agentState", {}).get("queueSnapshot", [])[:5]

    history_json = json.dumps([{"role": m.role, "content": m.content} for m in req.history[-6:]])

    prompt = ADVISOR_PROMPT.format(
        knowledge_model_json=json.dumps(topic_summary, indent=2),
        readiness_json=json.dumps(readiness, indent=2),
        priority_queue_json=json.dumps(priority_q, indent=2),
        history_json=history_json,
        message=req.message,
    )

    provider = get_provider()
    try:
        raw = await provider.complete_json(
            system="You are the NeuralDSA learning advisor. Return only valid JSON.",
            prompt=prompt,
        )
        result = json.loads(raw) if isinstance(raw, str) else raw
        if not isinstance(result, dict):
            raise ValueError("Non-dict response")
    except Exception as e:
        return {
            "response": "I couldn't process that right now. Try asking again.",
            "suggested_topics": [],
            "suggested_problems": [],
            "error": str(e),
        }

    return {
        "response": result.get("response", ""),
        "suggested_topics": result.get("suggested_topics", []) or [],
        "suggested_problems": result.get("suggested_problems", []) or [],
    }

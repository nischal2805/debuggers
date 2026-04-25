"""
Personalized session report card generator (Section 5.1.G + 12.2).

Pulls structured data from the session_state + brain model, produces a small,
deterministic input for the LLM, and returns a normalized report card dict.
"""

from typing import Optional

from models.knowledge import (
    assessment_level,
    confidence_calibration_gap,
    readiness_score,
    migrate_knowledge_model,
)
from services.curriculum import compute_priority_queue
from services.llm_client import get_provider, _parse_json


REPORT_PROMPT = """
You are NeuralDSA, generating a session report card for a DSA learner.
Be specific and avoid filler. Cite topics and patterns by name.

ABSOLUTE RULES:
- No emojis.
- Return only valid JSON matching the schema below.

SESSION DATA:
{session_data}

LEARNER STATE (compressed):
{model_state}

PRIORITY QUEUE (top 5 next):
{queue}

Return JSON:
{{
  "headline": "<one sentence summary>",
  "strongest_concept": "<topic — one short reason>",
  "biggest_gap": "<topic — one short reason>",
  "recurring_misconception": "<misconception name + one-line how to address>",
  "speed_assessment": "<too_fast | just_right | too_slow + one-line reason>",
  "effort_assessment": "<hint_avoidance | balanced | over_reliance + one-line reason>",
  "readiness_change": "<+X.X / -X.X / no change + one-line interpretation>",
  "next_focus": ["<topic 1: why>", "<topic 2: why>", "<topic 3: why>"],
  "interview_likelihood": "<low | medium | high — one short reason scoped to topic(s) practiced>"
}}
"""


def _summarize_model(model: dict) -> dict:
    topics = model.get("topics", {})
    weak = sorted(
        [(t, s.get("knowledge", 0)) for t, s in topics.items() if 0 < s.get("knowledge", 0) < 0.5],
        key=lambda x: x[1],
    )[:5]
    strong = sorted(
        [(t, s.get("knowledge", 0)) for t, s in topics.items() if s.get("knowledge", 0) > 0.7],
        key=lambda x: x[1],
        reverse=True,
    )[:5]
    histogram: dict[str, int] = {}
    for s in topics.values():
        for k, v in (s.get("misconceptionHistogram", {}) or {}).items():
            histogram[k] = histogram.get(k, 0) + v
    histogram_sorted = sorted(histogram.items(), key=lambda x: x[1], reverse=True)[:5]
    return {
        "weakest": [{"topic": t, "knowledge": round(k, 2)} for t, k in weak],
        "strongest": [{"topic": t, "knowledge": round(k, 2)} for t, k in strong],
        "top_misconceptions": [{"label": k, "count": v} for k, v in histogram_sorted],
        "calibration_gap": confidence_calibration_gap(model),
    }


def _summarize_session(session_state: dict) -> dict:
    return {
        "topic": session_state.get("topic"),
        "active_topic_at_end": session_state.get("active_topic"),
        "questions_asked": session_state.get("questions_asked", 0),
        "correct_answers": session_state.get("correct_answers", 0),
        "hints_used": session_state.get("hints_used", 0),
        "consecutive_correct": session_state.get("consecutive_correct", 0),
        "consecutive_wrong": session_state.get("consecutive_wrong", 0),
        "mastery_start": round(session_state.get("mastery_start", 0), 4),
        "mastery_end": round(session_state.get("mastery_end", 0), 4),
        "total_minutes": max(1, session_state.get("total_time_ms", 0) // 60000),
        "mode_log": session_state.get("mode_log", [])[-12:],
    }


async def generate_session_report(
    session_state: dict,
    knowledge_model: dict,
    goal: str = "placement",
) -> dict:
    """LLM-backed report card. On parse failure, returns a deterministic stub."""
    knowledge_model = migrate_knowledge_model(knowledge_model)
    queue = compute_priority_queue(knowledge_model, goal=goal)[:5]
    queue_brief = [{"topic": q["topic"], "score": q["score"]} for q in queue]

    session_data = _summarize_session(session_state)
    model_state = _summarize_model(knowledge_model)

    import json
    prompt = REPORT_PROMPT.format(
        session_data=json.dumps(session_data, indent=2),
        model_state=json.dumps(model_state, indent=2),
        queue=json.dumps(queue_brief, indent=2),
    )

    provider = get_provider()
    parsed: dict = {}
    try:
        text = await provider.complete_json(prompt, max_tokens=600, temperature=0.3)
        parsed = _parse_json(text) or {}
    except Exception:
        parsed = {}

    if not parsed:
        # Deterministic fallback so UI always has something to render
        accuracy = (
            session_data["correct_answers"] / session_data["questions_asked"]
            if session_data["questions_asked"] else 0
        )
        parsed = {
            "headline": f"{session_data['questions_asked']} questions answered with {accuracy*100:.0f}% accuracy.",
            "strongest_concept": (model_state["strongest"][0]["topic"] if model_state["strongest"] else session_data["topic"]),
            "biggest_gap": (model_state["weakest"][0]["topic"] if model_state["weakest"] else session_data["topic"]),
            "recurring_misconception": (
                f"{model_state['top_misconceptions'][0]['label']} (x{model_state['top_misconceptions'][0]['count']})"
                if model_state["top_misconceptions"] else "no recurring misconception detected"
            ),
            "speed_assessment": "just_right",
            "effort_assessment": "balanced",
            "readiness_change": f"{(session_data['mastery_end'] - session_data['mastery_start']) * 100:+.1f}% on this topic",
            "next_focus": [q["topic"] for q in queue_brief[:3]],
            "interview_likelihood": "medium",
        }

    snap = readiness_score(knowledge_model, goal)
    parsed["readiness_snapshot"] = snap
    parsed["session_stats"] = session_data
    parsed["queue_preview"] = queue_brief
    return parsed

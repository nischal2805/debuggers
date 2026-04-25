import json
import os
import google.generativeai as genai
from prompts.tutor import TUTOR_SYSTEM_PROMPT, EVALUATE_PROMPT
from services.agent import AgentAction, agent_decide, build_agent_prompt
from data.problem_catalog import get_problems_for_topic, format_problem_for_prompt

genai.configure(api_key=os.environ["GEMINI_API_KEY"])

_FLASH = "gemini-2.5-flash"


def _parse_json(text: str) -> dict:
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        start = text.find("{")
        end = text.rfind("}") + 1
        if start >= 0 and end > start:
            try:
                return json.loads(text[start:end])
            except Exception:
                pass
    return {}


async def evaluate_answer(
    topic: str,
    pattern: str,
    question: str,
    user_answer: str,
    difficulty: int,
    mastery: float,
    time_ms: int,
) -> dict:
    """
    Structured answer evaluation via a separate low-temperature LLM call.
    Returns evaluation dict with: correct, partial_credit, errors,
    missing_concepts, time_complexity_correct, feedback, hint_for_retry.
    """
    prompt = EVALUATE_PROMPT.format(
        topic=topic,
        pattern=pattern,
        question=question,
        user_answer=user_answer,
        difficulty=difficulty,
        mastery=mastery,
        time_ms=time_ms,
    )

    model = genai.GenerativeModel(
        model_name=_FLASH,
        generation_config=genai.GenerationConfig(
            max_output_tokens=400,
            temperature=0.1,
            response_mime_type="application/json",
        ),
    )

    response = await model.generate_content_async(prompt)
    result = _parse_json(response.text or "")
    if not result:
        return {
            "correct": False,
            "partial_credit": 0.0,
            "errors": ["Could not parse evaluation"],
            "missing_concepts": [],
            "feedback": "Evaluation failed — please retry.",
            "hint_for_retry": None,
        }
    return result


async def stream_agent_response(
    knowledge_model: dict,
    session_state: dict,
    action: str,
    user_message: str = "",
    evaluation: dict | None = None,
):
    """
    Main streaming generator for the agent.

    Yields:
      {"type": "chunk", "text": str}          — streaming token
      {"type": "response", "data": dict}       — full parsed tutor response
      {"type": "agent_action", "action": str}  — what the agent decided to do
    """
    topic = session_state.get("active_topic", session_state.get("topic", "arrays"))
    mastery = knowledge_model.get("topics", {}).get(topic, {}).get("mastery", 0)

    # 1. Agent decision
    agent_action, context_extras = agent_decide(
        action=action,
        evaluation=evaluation,
        session_state=session_state,
        knowledge_model=knowledge_model,
    )

    # Handle prereq pivot: update active topic in context
    if agent_action == AgentAction.PIVOT_TO_PREREQ:
        prereq_topic = context_extras.get("prereq_topic", topic)
        session_state.setdefault("prereq_stack", []).append(topic)
        session_state["active_topic"] = prereq_topic
        topic = prereq_topic
        mastery = knowledge_model.get("topics", {}).get(topic, {}).get("mastery", 0)

    elif agent_action == AgentAction.RETURN_FROM_PREREQ:
        stack: list = session_state.get("prereq_stack", [])
        if stack:
            return_topic = stack.pop()
            session_state["active_topic"] = return_topic
            topic = return_topic
            mastery = knowledge_model.get("topics", {}).get(topic, {}).get("mastery", 0)

    yield {"type": "agent_action", "action": agent_action.value, "topic": topic}

    # 2. Build problem catalog hint
    problems = get_problems_for_topic(topic, mastery, count=2)
    problems_hint = " | ".join(format_problem_for_prompt(p) for p in problems)

    # 3. Build the agent prompt
    agent_context = build_agent_prompt(
        action=action,
        agent_action=agent_action,
        context_extras=context_extras,
        session_state=session_state,
        knowledge_model=knowledge_model,
        evaluation=evaluation,
        user_message=user_message,
        problems_hint=problems_hint,
    )

    # 4. Build system prompt
    history = session_state.get("conversation_history", [])
    history_text = "\n".join(
        f"[{m['role'].upper()}]: {m['content']}" for m in history[-6:]
    ) if history else "No prior conversation."

    system_prompt = TUTOR_SYSTEM_PROMPT.format(
        agent_context=agent_context,
        knowledge_model_json=json.dumps(knowledge_model, default=str)[:2500],
        questions_asked=session_state.get("questions_asked", 0),
        correct_answers=session_state.get("correct_answers", 0),
        hints_used=session_state.get("hints_used", 0),
        prereq_stack=json.dumps(session_state.get("prereq_stack", [])),
        conversation_history=history_text,
    )

    model = genai.GenerativeModel(
        model_name=_FLASH,
        system_instruction=system_prompt,
        generation_config=genai.GenerationConfig(
            max_output_tokens=800,
            temperature=0.35,
            response_mime_type="application/json",
        ),
    )

    # 5. Stream LLM output
    full_text = ""
    async for chunk in await model.generate_content_async("Execute the agent decision.", stream=True):
        text = chunk.text or ""
        full_text += text
        yield {"type": "chunk", "text": text}

    # 6. Parse and emit final response
    parsed = _parse_json(full_text)
    if not parsed:
        parsed = {
            "type": "explanation",
            "content": full_text,
            "expected_answer_type": "text",
            "difficulty_level": 3,
            "pattern_name": None,
            "prereq_gap": {"detected": False, "weak_topic": None, "explanation": None},
            "session_summary": None,
            "next_action": "wait_for_answer",
            "internal_note": "json_parse_fallback",
        }

    # Inject agent_action into response so frontend knows what happened
    parsed["_agent_action"] = agent_action.value
    parsed["_active_topic"] = topic

    yield {"type": "response", "data": parsed}

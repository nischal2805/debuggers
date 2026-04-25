"""
Core agent decision engine.

The agent is NOT a reactive chatbot. It maintains a planning state and
autonomously decides what to do next based on the learner's knowledge model,
session history, and the topic dependency graph.

Decision loop per user action:
  1. Parse input
  2. If action=answer: structured evaluation via separate LLM call
  3. agent_decide(): examine session state → select AgentAction
  4. Build context-rich prompt encoding the decision
  5. Stream LLM response
  6. Update knowledge model
  7. Emit mastery_update to frontend
"""

from enum import Enum
from models.knowledge import TOPIC_GRAPH


class AgentAction(str, Enum):
    START_SESSION      = "start_session"
    ASK_QUESTION       = "ask_question"
    GIVE_HINT          = "give_hint"
    INCREASE_DIFFICULTY = "increase_difficulty"
    DECREASE_DIFFICULTY = "decrease_difficulty"
    PIVOT_TO_PREREQ    = "pivot_to_prereq"
    RETURN_FROM_PREREQ = "return_from_prereq"
    GIVE_EXPLANATION   = "give_explanation"
    CELEBRATE          = "celebrate"
    END_SESSION        = "end_session"


def _weak_prereq(topic: str, knowledge_model: dict) -> str | None:
    """Return the weakest unmastered prerequisite for a topic, or None."""
    prereqs = TOPIC_GRAPH.get(topic, {}).get("prereqs", [])
    topic_stats = knowledge_model.get("topics", {})
    weak = [
        (p, topic_stats.get(p, {}).get("mastery", 0))
        for p in prereqs
        if topic_stats.get(p, {}).get("mastery", 0) < 0.45
    ]
    if not weak:
        return None
    return min(weak, key=lambda x: x[1])[0]


def agent_decide(
    action: str,
    evaluation: dict | None,
    session_state: dict,
    knowledge_model: dict,
) -> tuple[AgentAction, dict]:
    """
    Core agent planning function. Returns (AgentAction, context_extras).

    context_extras is injected into the prompt to make the agent's
    reasoning visible and consistent.
    """
    topic = session_state.get("active_topic", session_state.get("topic", "arrays"))
    prereq_stack: list[str] = session_state.get("prereq_stack", [])
    questions_asked = session_state.get("questions_asked", 0)
    consecutive_correct = session_state.get("consecutive_correct", 0)
    consecutive_wrong = session_state.get("consecutive_wrong", 0)
    mastery = knowledge_model.get("topics", {}).get(topic, {}).get("mastery", 0)

    if action == "start_topic":
        return AgentAction.START_SESSION, {"reason": "new session starting"}

    if action == "hint_request":
        return AgentAction.GIVE_HINT, {"reason": "learner requested hint"}

    if action != "answer" or evaluation is None:
        return AgentAction.ASK_QUESTION, {"reason": "continuing session"}

    correct = evaluation.get("correct", False)
    partial = evaluation.get("partial_credit", 0.0)

    # Session end conditions
    if questions_asked >= 8:
        return AgentAction.END_SESSION, {"reason": "session question limit reached"}

    if mastery >= 0.88:
        return AgentAction.END_SESSION, {"reason": "mastery threshold achieved"}

    # Returning from prereq teaching
    if prereq_stack and correct and mastery > 0.5:
        return AgentAction.RETURN_FROM_PREREQ, {
            "reason": f"prereq mastered, returning to {prereq_stack[-1]}",
            "return_topic": prereq_stack[-1],
        }

    # Prerequisite gap detection: 2 consecutive wrong on current topic
    if consecutive_wrong >= 2 and not prereq_stack:
        weak = _weak_prereq(topic, knowledge_model)
        if weak:
            return AgentAction.PIVOT_TO_PREREQ, {
                "reason": f"detected prereq gap: {weak} mastery is low",
                "prereq_topic": weak,
                "original_topic": topic,
            }

    # Difficulty bumping
    if consecutive_correct >= 2 and correct:
        return AgentAction.INCREASE_DIFFICULTY, {
            "reason": "2 consecutive correct, increasing challenge",
        }

    if consecutive_wrong >= 2 and not correct:
        return AgentAction.DECREASE_DIFFICULTY, {
            "reason": "2 consecutive wrong, dropping difficulty and probing prereqs",
        }

    # Celebrate mastery milestones
    if correct and (0.78 < mastery <= 0.85):
        return AgentAction.CELEBRATE, {"reason": "mastery milestone reached"}

    return AgentAction.ASK_QUESTION, {
        "reason": "continuing with calibrated question",
        "correct": correct,
        "partial": partial,
    }


def build_agent_prompt(
    action: str,
    agent_action: AgentAction,
    context_extras: dict,
    session_state: dict,
    knowledge_model: dict,
    evaluation: dict | None,
    user_message: str,
    problems_hint: str,
) -> str:
    """
    Build a rich prompt encoding the agent's decision so the LLM
    generates output that matches the agent's intent.
    """
    topic = session_state.get("active_topic", session_state.get("topic", "arrays"))
    mastery = knowledge_model.get("topics", {}).get(topic, {}).get("mastery", 0)
    last_question = session_state.get("last_question", "")

    lines: list[str] = [
        f"AGENT DECISION: {agent_action.value}",
        f"REASON: {context_extras.get('reason', '')}",
        f"ACTIVE TOPIC: {topic}",
        f"LEARNER MASTERY: {mastery:.2f}",
    ]

    if evaluation:
        lines += [
            f"EVALUATION RESULT: correct={evaluation.get('correct')}, partial={evaluation.get('partial_credit', 0):.2f}",
            f"ERRORS: {', '.join(evaluation.get('errors', [])) or 'none'}",
            f"MISSING CONCEPTS: {', '.join(evaluation.get('missing_concepts', [])) or 'none'}",
            f"EVALUATION FEEDBACK: {evaluation.get('feedback', '')}",
        ]

    if agent_action == AgentAction.PIVOT_TO_PREREQ:
        prereq = context_extras.get("prereq_topic", "")
        original = context_extras.get("original_topic", "")
        lines.append(
            f"PIVOT INSTRUCTION: The learner failed {original} twice. "
            f"Switch to teaching {prereq} which is a prerequisite. "
            f"Inform the learner briefly then ask a calibration question on {prereq}."
        )

    elif agent_action == AgentAction.RETURN_FROM_PREREQ:
        return_topic = context_extras.get("return_topic", topic)
        lines.append(
            f"RETURN INSTRUCTION: Prerequisite {topic} is now sufficiently mastered. "
            f"Congratulate briefly and return to the original topic: {return_topic}."
        )

    elif agent_action == AgentAction.INCREASE_DIFFICULTY:
        lines.append("DIFFICULTY INSTRUCTION: Increase to harder variant or follow-up question. Mention the difficulty bump.")

    elif agent_action == AgentAction.DECREASE_DIFFICULTY:
        lines.append("DIFFICULTY INSTRUCTION: Drop to a simpler question. Identify which concept they're missing first.")

    elif agent_action == AgentAction.END_SESSION:
        lines.append(
            "END INSTRUCTION: Wrap up the session. Summarize: what they did well, what to review, "
            "and the one most important thing to practice next. Set next_action to 'end_session'."
        )

    elif agent_action == AgentAction.CELEBRATE:
        lines.append("CELEBRATE INSTRUCTION: One sentence of genuine acknowledgment, then ask the next harder question.")

    elif agent_action == AgentAction.START_SESSION:
        lines.append(
            f"START INSTRUCTION: Begin the session. Calibrate to mastery={mastery:.2f}. "
            f"If mastery < 0.3 ask a conceptual question, if 0.3-0.6 mix conceptual+impl, if > 0.6 ask LC medium/hard."
        )

    if problems_hint:
        lines.append(f"SUGGESTED PROBLEMS FROM CATALOG: {problems_hint}")

    if last_question and action == "answer":
        lines.append(f"QUESTION THAT WAS ASKED: {last_question}")
        lines.append(f"LEARNER'S ANSWER: {user_message}")

    return "\n".join(lines)

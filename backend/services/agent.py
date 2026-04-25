"""
Core agent decision engine.

The agent is NOT a reactive chatbot. It maintains a planning state and
autonomously decides what to do next based on the learner's brain model,
session history, behavior signals, and the topic dependency graph.

Decision layers per turn:
  1. mode_decide()   → AgentMode (ASSESS, SCAFFOLD, REINFORCE, ADVANCE, EXPLAIN, CONTINUE)
  2. action_for_mode → AgentAction (granular: ask_question, give_hint, pivot, etc.)
  3. build_agent_prompt → LLM-facing instructions encoding both mode and action

This file is the brain. Treat every change here as load-bearing.
"""

from enum import Enum
from typing import Optional
from models.knowledge import TOPIC_GRAPH


# ─────────────────────────────────────────────────────────────────────────────
# Mode + action enums
# ─────────────────────────────────────────────────────────────────────────────


class AgentMode(str, Enum):
    """The 6 canonical agent modes (Section 4.4 of the upgrade plan)."""
    ASSESS    = "ASSESS"     # calibrate current concept/pattern
    SCAFFOLD  = "SCAFFOLD"   # break down after misconception
    REINFORCE = "REINFORCE"  # additional reps for unstable mastery
    ADVANCE   = "ADVANCE"    # raise difficulty or unlock next
    EXPLAIN   = "EXPLAIN"    # targeted explanation for detected misconception
    CONTINUE  = "CONTINUE"   # keep trajectory; no pivot required


class AgentAction(str, Enum):
    START_SESSION       = "start_session"
    ASK_QUESTION        = "ask_question"
    GIVE_HINT           = "give_hint"
    INCREASE_DIFFICULTY = "increase_difficulty"
    DECREASE_DIFFICULTY = "decrease_difficulty"
    PIVOT_TO_PREREQ     = "pivot_to_prereq"
    RETURN_FROM_PREREQ  = "return_from_prereq"
    GIVE_EXPLANATION    = "give_explanation"
    CELEBRATE           = "celebrate"
    END_SESSION         = "end_session"


# Mode descriptions surfaced to the LLM prompt and to the agent log UI.
MODE_DESCRIPTIONS: dict[AgentMode, str] = {
    AgentMode.ASSESS:    "Calibrate by probing the learner's current grasp before deciding direction.",
    AgentMode.SCAFFOLD:  "Break the concept into a smaller step or prerequisite after a misconception.",
    AgentMode.REINFORCE: "Run another rep at the same difficulty to stabilize emerging mastery.",
    AgentMode.ADVANCE:   "Raise difficulty, unlock the next concept, or return from a prereq detour.",
    AgentMode.EXPLAIN:   "Give a targeted explanation matched to the detected misconception.",
    AgentMode.CONTINUE:  "Stay on the current trajectory; nothing requires a pivot.",
}


# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────


def _weak_prereq(topic: str, knowledge_model: dict) -> Optional[str]:
    """Return the weakest unmastered prerequisite for a topic, or None."""
    prereqs = TOPIC_GRAPH.get(topic, {}).get("prereqs", [])
    topic_stats = knowledge_model.get("topics", {})
    weak = [
        (p, topic_stats.get(p, {}).get("knowledge", topic_stats.get(p, {}).get("mastery", 0)))
        for p in prereqs
        if topic_stats.get(p, {}).get("knowledge", topic_stats.get(p, {}).get("mastery", 0)) < 0.45
    ]
    if not weak:
        return None
    return min(weak, key=lambda x: x[1])[0]


def _topic_knowledge(model: dict, topic: str) -> float:
    s = model.get("topics", {}).get(topic, {})
    return s.get("knowledge", s.get("mastery", 0))


# ─────────────────────────────────────────────────────────────────────────────
# Mode decision
# ─────────────────────────────────────────────────────────────────────────────


def mode_decide(
    action: str,
    evaluation: Optional[dict],
    session_state: dict,
    knowledge_model: dict,
) -> tuple[AgentMode, str]:
    """
    Pick the canonical mode for this turn. Returns (mode, reason).

    Heuristics (in priority order):
      - Learner asked a direct question        → EXPLAIN
      - Learner requested a hint               → SCAFFOLD
      - Session start / no questions asked yet → ASSESS
      - Wrong answer with a known misconception → EXPLAIN
      - 2 consecutive wrong & weak prereq       → SCAFFOLD
      - 1 wrong, knowledge unstable             → REINFORCE
      - 2 consecutive correct & ready          → ADVANCE
      - Mastery threshold or question cap hit  → ADVANCE (end)
      - Otherwise                               → CONTINUE
    """
    topic = session_state.get("active_topic", session_state.get("topic", "arrays"))
    consecutive_correct = session_state.get("consecutive_correct", 0)
    consecutive_wrong = session_state.get("consecutive_wrong", 0)
    questions_asked = session_state.get("questions_asked", 0)
    prereq_stack = session_state.get("prereq_stack", [])
    knowledge = _topic_knowledge(knowledge_model, topic)

    # Direct learner query is always an EXPLAIN interrupt
    if action == "learner_query":
        return AgentMode.EXPLAIN, "learner asked a direct question"

    # Hint request → SCAFFOLD (we're scaffolding the current question)
    if action == "hint_request":
        return AgentMode.SCAFFOLD, "learner requested a hint, scaffolding"

    # Session start
    if action == "start_topic" or questions_asked == 0:
        return AgentMode.ASSESS, "calibrating learner's current level"

    if action != "answer":
        return AgentMode.CONTINUE, "continuing without new evaluation"

    # From here on, we have an answer + (optional) evaluation
    correct = bool(evaluation.get("correct", False)) if evaluation else False
    fingerprint = (evaluation or {}).get("error_fingerprint")

    # Session end conditions handled as ADVANCE so the LLM gets clean wrap-up framing
    if questions_asked >= 8 or knowledge >= 0.88:
        return AgentMode.ADVANCE, "session goal reached, advancing/wrapping up"

    # Returning from a prereq detour
    if prereq_stack and correct and knowledge > 0.5:
        return AgentMode.ADVANCE, f"prereq mastered, returning to {prereq_stack[-1]}"

    # Known misconception → explain it before asking another question
    if not correct and fingerprint and fingerprint != "syntax_error":
        return AgentMode.EXPLAIN, f"address misconception: {fingerprint}"

    # 2 consecutive wrong → scaffold (drop or pivot)
    if consecutive_wrong >= 2 and not correct:
        return AgentMode.SCAFFOLD, "two consecutive wrong, scaffolding down"

    # 2 consecutive correct → advance
    if consecutive_correct >= 2 and correct:
        return AgentMode.ADVANCE, "two consecutive correct, advancing difficulty"

    # 1 wrong with mid-mastery → reinforce
    if not correct and 0.3 <= knowledge < 0.75:
        return AgentMode.REINFORCE, "single miss in mid-mastery band, reinforcing"

    return AgentMode.CONTINUE, "stable trajectory, continuing"


# ─────────────────────────────────────────────────────────────────────────────
# Action decision (mode → granular action)
# ─────────────────────────────────────────────────────────────────────────────


def action_for_mode(
    mode: AgentMode,
    action: str,
    evaluation: Optional[dict],
    session_state: dict,
    knowledge_model: dict,
) -> tuple[AgentAction, dict]:
    """Map a mode + context to the concrete AgentAction the prompt builder uses."""
    topic = session_state.get("active_topic", session_state.get("topic", "arrays"))
    prereq_stack: list = session_state.get("prereq_stack", [])
    questions_asked = session_state.get("questions_asked", 0)
    knowledge = _topic_knowledge(knowledge_model, topic)
    correct = bool(evaluation.get("correct", False)) if evaluation else False

    if mode == AgentMode.EXPLAIN and action == "learner_query":
        return AgentAction.GIVE_EXPLANATION, {"reason": "learner question — explain on the spot"}

    if mode == AgentMode.SCAFFOLD and action == "hint_request":
        return AgentAction.GIVE_HINT, {"reason": "single bounded hint"}

    if mode == AgentMode.ASSESS:
        if action == "start_topic":
            return AgentAction.START_SESSION, {"reason": "begin session, calibrate"}
        return AgentAction.ASK_QUESTION, {"reason": "calibration question"}

    if mode == AgentMode.SCAFFOLD:
        # Wrong + weak prereq → pivot
        if action == "answer" and not correct and not prereq_stack:
            weak = _weak_prereq(topic, knowledge_model)
            if weak:
                return AgentAction.PIVOT_TO_PREREQ, {
                    "reason": f"prereq gap detected: {weak}",
                    "prereq_topic": weak,
                    "original_topic": topic,
                }
        # Otherwise drop difficulty
        return AgentAction.DECREASE_DIFFICULTY, {
            "reason": "scaffold down to expose the missing concept",
        }

    if mode == AgentMode.REINFORCE:
        return AgentAction.ASK_QUESTION, {
            "reason": "reinforce with another rep at similar difficulty",
        }

    if mode == AgentMode.ADVANCE:
        # Wrap-up branch
        if questions_asked >= 8 or knowledge >= 0.88:
            return AgentAction.END_SESSION, {"reason": "wrap session"}
        # Returning from prereq
        if prereq_stack and correct and knowledge > 0.5:
            return AgentAction.RETURN_FROM_PREREQ, {
                "reason": f"prereq mastered, returning to {prereq_stack[-1]}",
                "return_topic": prereq_stack[-1],
            }
        # Mastery milestone celebration
        if correct and 0.78 < knowledge <= 0.85:
            return AgentAction.CELEBRATE, {"reason": "mastery milestone reached"}
        return AgentAction.INCREASE_DIFFICULTY, {"reason": "raise difficulty"}

    if mode == AgentMode.EXPLAIN:
        return AgentAction.GIVE_EXPLANATION, {
            "reason": "address misconception with targeted explanation"
        }

    # CONTINUE (default)
    return AgentAction.ASK_QUESTION, {"reason": "continue with calibrated question"}


# ─────────────────────────────────────────────────────────────────────────────
# Public entry point — backward compatible
# ─────────────────────────────────────────────────────────────────────────────


def agent_decide(
    action: str,
    evaluation: Optional[dict],
    session_state: dict,
    knowledge_model: dict,
) -> tuple[AgentAction, dict]:
    """
    Two-layer decision: pick mode, then derive concrete action.
    Returns (AgentAction, context_extras) for backward compatibility.
    The mode is also written into context_extras under 'mode' / 'mode_reason'
    and persisted into session_state so the router can emit an agent_mode event.
    """
    mode, mode_reason = mode_decide(action, evaluation, session_state, knowledge_model)
    agent_action, extras = action_for_mode(mode, action, evaluation, session_state, knowledge_model)

    extras["mode"] = mode.value
    extras["mode_reason"] = mode_reason
    extras["mode_description"] = MODE_DESCRIPTIONS[mode]

    # Persist for the router / frontend
    session_state["last_mode"] = mode.value
    session_state["last_mode_reason"] = mode_reason

    # Append to in-session mode log (cap 30)
    log: list = session_state.setdefault("mode_log", [])
    log.append({"mode": mode.value, "reason": mode_reason, "action": agent_action.value})
    if len(log) > 30:
        del log[:-30]

    return agent_action, extras


# ─────────────────────────────────────────────────────────────────────────────
# Prompt builder — encodes both mode and action so the LLM follows intent
# ─────────────────────────────────────────────────────────────────────────────


def build_agent_prompt(
    action: str,
    agent_action: AgentAction,
    context_extras: dict,
    session_state: dict,
    knowledge_model: dict,
    evaluation: Optional[dict],
    user_message: str,
    problems_hint: str,
) -> str:
    topic = session_state.get("active_topic", session_state.get("topic", "arrays"))
    knowledge = _topic_knowledge(knowledge_model, topic)
    last_question = session_state.get("last_question", "")

    mode = context_extras.get("mode", "CONTINUE")
    mode_reason = context_extras.get("mode_reason", "")
    mode_desc = context_extras.get("mode_description", "")

    lines: list[str] = [
        f"AGENT MODE: {mode}  ({mode_desc})",
        f"MODE REASON: {mode_reason}",
        f"AGENT ACTION: {agent_action.value}",
        f"ACTION REASON: {context_extras.get('reason', '')}",
        f"ACTIVE TOPIC: {topic}",
        f"LEARNER KNOWLEDGE: {knowledge:.2f}",
    ]

    if action == "answer":
        lines.append(
            "ANSWER INSTRUCTION: Evaluate the learner's answer against the active question. "
            "Populate the `evaluation` object with: correct, partial_credit, feedback, errors, "
            "error_fingerprint (one of: optimization_blindness, complexity_confusion, "
            "space_time_mixup, off_by_one, pattern_overfitting, edge_case_blindness, prereq_gap, "
            "syntax_error, incomplete_solution; omit when correct), and hint_for_retry. "
            "Then provide concise learner-facing content in `content`."
        )

    if evaluation:
        lines += [
            f"EVALUATION RESULT: correct={evaluation.get('correct')}, partial={evaluation.get('partial_credit', 0):.2f}",
            f"ERRORS: {', '.join(evaluation.get('errors', [])) or 'none'}",
            f"MISSING CONCEPTS: {', '.join(evaluation.get('missing_concepts', [])) or 'none'}",
            f"FINGERPRINT: {evaluation.get('error_fingerprint') or 'none'}",
            f"EVAL FEEDBACK: {evaluation.get('feedback', '')}",
        ]

    if agent_action == AgentAction.PIVOT_TO_PREREQ:
        prereq = context_extras.get("prereq_topic", "")
        original = context_extras.get("original_topic", "")
        lines.append(
            f"PIVOT INSTRUCTION: The learner failed {original}. "
            f"Switch to teaching {prereq} which is a prerequisite. "
            f"Briefly say why, then ask a calibration question on {prereq}."
        )

    elif agent_action == AgentAction.RETURN_FROM_PREREQ:
        return_topic = context_extras.get("return_topic", topic)
        lines.append(
            f"RETURN INSTRUCTION: Prereq {topic} is now sufficient. "
            f"One sentence acknowledging it, then return to {return_topic}."
        )

    elif agent_action == AgentAction.INCREASE_DIFFICULTY:
        lines.append("DIFFICULTY: Raise difficulty one level. Mention the bump in one short clause.")

    elif agent_action == AgentAction.DECREASE_DIFFICULTY:
        lines.append("DIFFICULTY: Drop a level. Identify the missing concept clearly.")

    elif agent_action == AgentAction.END_SESSION:
        lines.append(
            "END INSTRUCTION: Wrap the session. Cover what they did well, what to review, "
            "and the single most important next step. Set next_action to 'end_session'."
        )

    elif agent_action == AgentAction.CELEBRATE:
        lines.append("CELEBRATE: One genuine sentence of acknowledgement, then ask the next harder question.")

    elif agent_action == AgentAction.START_SESSION:
        lines.append(
            f"START INSTRUCTION: Open the session. Calibrate to knowledge={knowledge:.2f}. "
            f"<0.3 → conceptual question, 0.3-0.6 → mix conceptual+impl, >0.6 → LC medium/hard."
        )

    elif agent_action == AgentAction.GIVE_EXPLANATION and action == "learner_query":
        lines.append(
            "QUERY INSTRUCTION: This is an interrupt, not progression. "
            "Answer the question clearly for the current topic. "
            "Do NOT ask a new question. Do NOT advance difficulty. Do NOT change topic. "
            "Set type='explanation' and next_action='wait_for_answer'."
        )
        if last_question:
            lines.append(f"PENDING QUESTION TO KEEP ACTIVE: {last_question}")

    elif agent_action == AgentAction.GIVE_EXPLANATION:
        # EXPLAIN mode triggered by misconception
        fp = (evaluation or {}).get("error_fingerprint") or "misconception"
        lines.append(
            f"EXPLAIN INSTRUCTION: The learner showed {fp}. Give one tight explanation "
            f"that targets exactly that misconception. End by asking them to retry or "
            f"answer a small check question. Set type='explanation'."
        )

    if problems_hint:
        lines.append(f"SUGGESTED PROBLEMS FROM CATALOG: {problems_hint}")

    if last_question and action == "answer":
        lines.append(f"QUESTION THAT WAS ASKED: {last_question}")
        lines.append(f"LEARNER'S ANSWER: {user_message}")
    elif action == "learner_query":
        lines.append(f"LEARNER QUESTION: {user_message}")

    return "\n".join(lines)

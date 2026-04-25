"""
Dynamic curriculum engine.

Replaces the static "next topic by ordered list" with a multi-factor priority
queue that re-scores after every answer. The agent reads the top of this queue
when no manual topic override is in effect.

Score (Section 4.3):
  priority = w1*lowKnowledge
           + w2*errorRecurrence
           + w3*forgettingDecay
           + w4*difficultyRamp
           + w5*goalWeight
           + w6*patternGap
"""

from datetime import datetime, timezone
from typing import Optional
from models.knowledge import TOPIC_GRAPH, migrate_knowledge_model


# Default weights — tuned so a fresh learner gets foundations-first behavior
# but the queue snaps to recurring errors and stale topics fast.
DEFAULT_WEIGHTS = {
    "lowKnowledge":    0.30,
    "errorRecurrence": 0.20,
    "forgettingDecay": 0.15,
    "difficultyRamp":  0.10,
    "goalWeight":      0.15,
    "patternGap":      0.10,
}


GOAL_FOCUS_TOPICS = {
    "placement":  ["arrays", "strings", "hashing", "two_pointers", "sliding_window",
                    "binary_search", "binary_tree", "bfs", "dfs", "graph_basics",
                    "dp_intro", "dp_1d", "linked_list", "stack", "heap"],
    "faang":      ["dp_2d", "dp_knapsack", "graph_basics", "segment_tree", "trie",
                    "bit_manipulation", "binary_tree", "shortest_path_dijkstra",
                    "heap", "backtracking"],
    "competitive": ["segment_tree", "fenwick_tree", "dp_graphs", "string_matching",
                     "shortest_path_dijkstra", "shortest_path_bellman", "union_find"],
    "learning":   list(TOPIC_GRAPH.keys()),
}


def _topic_knowledge(topic_stats: dict, topic: str) -> float:
    s = topic_stats.get(topic, {})
    return s.get("knowledge", s.get("mastery", 0))


def _prereqs_unlocked(topic: str, topic_stats: dict, threshold: float = 0.5) -> bool:
    for p in TOPIC_GRAPH.get(topic, {}).get("prereqs", []):
        if _topic_knowledge(topic_stats, p) < threshold:
            return False
    return True


def _error_recurrence(stat: dict) -> float:
    """How often this topic produces wrong answers / misconceptions, normalized."""
    attempts = stat.get("attempts", 0)
    if attempts == 0:
        return 0.0
    incorrect = max(0, attempts - stat.get("correct", 0))
    histogram = stat.get("misconceptionHistogram", {}) or {}
    histo_total = sum(histogram.values())
    raw = (incorrect / max(1, attempts)) * 0.6 + (histo_total / max(1, attempts)) * 0.4
    return min(1.0, raw)


def _forgetting_signal(stat: dict) -> float:
    """0 if just seen, ramps to 1 by 14 days unseen, only above mastery 0.3."""
    last_seen = stat.get("lastSeen")
    if not last_seen:
        return 0.0
    if _topic_knowledge({"x": stat}, "x") < 0.3:
        return 0.0
    try:
        dt = datetime.fromisoformat(last_seen.replace("Z", "+00:00"))
        days = (datetime.now(timezone.utc) - dt).days
    except Exception:
        return 0.0
    if days <= 5:
        return 0.0
    return min(1.0, (days - 5) / 9.0)


def _difficulty_ramp(topic: str, topic_stats: dict) -> float:
    """
    Prefer topics with mid-mastery (most learnable) scaled by difficulty.
    Peaks at mastery 0.5; falls off at extremes; multiplied by difficulty/6.
    """
    k = _topic_knowledge(topic_stats, topic)
    mid_bonus = 1 - abs(k - 0.5) * 2
    diff = TOPIC_GRAPH.get(topic, {}).get("difficulty", 1)
    return max(0.0, mid_bonus) * (diff / 6.0)


def _goal_weight(topic: str, goal: str) -> float:
    focus = GOAL_FOCUS_TOPICS.get(goal, [])
    if not focus:
        return 0.0
    return 1.0 if topic in focus else 0.0


def _pattern_gap(topic: str, pattern_stats: dict) -> float:
    """
    Approximate: low patternRecognition or low pattern knowledge for the
    primary pattern of this topic raises gap signal. We can't always link
    topic→pattern 1:1, so we use the topic key as a fallback pattern label.
    """
    pat = pattern_stats.get(topic)
    if not pat:
        return 0.5  # unknown → mild push to surface pattern
    return max(0.0, 1.0 - pat.get("knowledge", 0))


def compute_priority_queue(
    knowledge_model: dict,
    goal: str = "placement",
    weights: Optional[dict] = None,
    limit: int = 12,
) -> list[dict]:
    """
    Score every unlocked, unmastered topic. Returns ordered list of:
      { topic, score, level, reasons: { lowKnowledge, errorRecurrence, ... } }
    """
    knowledge_model = migrate_knowledge_model(knowledge_model)
    weights = weights or DEFAULT_WEIGHTS
    topic_stats = knowledge_model.get("topics", {})
    pattern_stats = knowledge_model.get("patternStats", {})

    queue: list[dict] = []
    for topic in TOPIC_GRAPH:
        stat = topic_stats.get(topic, {})
        knowledge = _topic_knowledge(topic_stats, topic)

        if knowledge >= 0.88:
            continue
        if not _prereqs_unlocked(topic, topic_stats):
            continue

        sig = {
            "lowKnowledge":    1.0 - knowledge,
            "errorRecurrence": _error_recurrence(stat),
            "forgettingDecay": _forgetting_signal(stat),
            "difficultyRamp":  _difficulty_ramp(topic, topic_stats),
            "goalWeight":      _goal_weight(topic, goal),
            "patternGap":      _pattern_gap(topic, pattern_stats),
        }
        score = sum(weights.get(k, 0) * v for k, v in sig.items())

        queue.append({
            "topic": topic,
            "score": round(score, 4),
            "level": TOPIC_GRAPH[topic]["difficulty"],
            "reasons": {k: round(v, 3) for k, v in sig.items()},
        })

    queue.sort(key=lambda x: x["score"], reverse=True)
    return queue[:limit]


def pick_next_topic(
    knowledge_model: dict,
    goal: str = "placement",
    *,
    exclude: Optional[list[str]] = None,
) -> Optional[str]:
    """Return the highest-priority topic, or None if nothing is unlocked."""
    excluded = set(exclude or [])
    for entry in compute_priority_queue(knowledge_model, goal=goal):
        if entry["topic"] not in excluded:
            return entry["topic"]
    return None


def explain_top_choice(queue: list[dict]) -> str:
    """One-line explanation for why the top topic was picked. For UI/agent log."""
    if not queue:
        return "No topics unlocked yet."
    top = queue[0]
    rs = top["reasons"]
    drivers = sorted(rs.items(), key=lambda kv: kv[1], reverse=True)[:2]
    parts = ", ".join(f"{name} {val:.2f}" for name, val in drivers)
    return f"{top['topic']} (score {top['score']:.2f}; driven by {parts})"

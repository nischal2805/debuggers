from datetime import datetime, timezone
from typing import Optional
from pydantic import BaseModel


class TopicStat(BaseModel):
    mastery: float = 0.0
    confidence: float = 0.0
    attempts: int = 0
    correct: int = 0
    avgTimeMs: int = 60000
    lastSeen: Optional[str] = None
    hesitationCount: int = 0
    hintRequests: int = 0


class KnowledgeModel(BaseModel):
    uid: str
    topics: dict[str, TopicStat] = {}
    learningStyle: str = "visual"
    pacePreference: str = "adaptive"
    currentFocus: str = "arrays"
    weaknessVector: list[str] = []
    strengthVector: list[str] = []
    sessionCount: int = 0
    totalMinutes: int = 0


TOPIC_GRAPH: dict[str, dict] = {
    "arrays":                {"prereqs": [],                              "difficulty": 1},
    "strings":               {"prereqs": ["arrays"],                     "difficulty": 1},
    "sorting":               {"prereqs": ["arrays"],                     "difficulty": 1},
    "recursion":             {"prereqs": [],                              "difficulty": 2},
    "hashing":               {"prereqs": ["arrays"],                     "difficulty": 2},
    "two_pointers":          {"prereqs": ["arrays", "sorting"],          "difficulty": 2},
    "sliding_window":        {"prereqs": ["arrays", "two_pointers"],     "difficulty": 2},
    "prefix_sum":            {"prereqs": ["arrays"],                     "difficulty": 2},
    "binary_search":         {"prereqs": ["arrays", "sorting"],          "difficulty": 2},
    "linked_list":           {"prereqs": ["arrays"],                     "difficulty": 2},
    "stack":                 {"prereqs": ["arrays"],                     "difficulty": 2},
    "queue":                 {"prereqs": ["arrays"],                     "difficulty": 2},
    "doubly_linked_list":    {"prereqs": ["linked_list"],                "difficulty": 2},
    "merge_sort":            {"prereqs": ["sorting", "recursion"],       "difficulty": 3},
    "quick_sort":            {"prereqs": ["sorting", "recursion"],       "difficulty": 3},
    "backtracking":          {"prereqs": ["recursion"],                  "difficulty": 3},
    "fast_slow_pointers":    {"prereqs": ["linked_list"],                "difficulty": 3},
    "monotonic_stack":       {"prereqs": ["stack"],                      "difficulty": 3},
    "deque":                 {"prereqs": ["queue"],                      "difficulty": 3},
    "binary_tree":           {"prereqs": ["recursion"],                  "difficulty": 3},
    "bst":                   {"prereqs": ["binary_tree"],                "difficulty": 3},
    "tree_traversal":        {"prereqs": ["binary_tree"],                "difficulty": 2},
    "heap":                  {"prereqs": ["binary_tree"],                "difficulty": 3},
    "bit_manipulation":      {"prereqs": ["arrays"],                     "difficulty": 3},
    "intervals":             {"prereqs": ["sorting"],                    "difficulty": 3},
    "greedy":                {"prereqs": ["sorting"],                    "difficulty": 3},
    "graph_basics":          {"prereqs": ["arrays", "hashing"],          "difficulty": 3},
    "bfs":                   {"prereqs": ["graph_basics", "queue"],      "difficulty": 3},
    "dfs":                   {"prereqs": ["graph_basics", "recursion"],  "difficulty": 3},
    "lowest_common_ancestor":{"prereqs": ["binary_tree"],                "difficulty": 4},
    "trie":                  {"prereqs": ["strings", "hashing"],         "difficulty": 4},
    "topological_sort":      {"prereqs": ["dfs", "bfs"],                 "difficulty": 4},
    "union_find":            {"prereqs": ["graph_basics"],               "difficulty": 4},
    "shortest_path_dijkstra":{"prereqs": ["graph_basics", "heap"],       "difficulty": 4},
    "shortest_path_bellman": {"prereqs": ["graph_basics"],               "difficulty": 4},
    "minimum_spanning_tree": {"prereqs": ["union_find", "heap"],         "difficulty": 4},
    "dp_intro":              {"prereqs": ["recursion"],                  "difficulty": 4},
    "dp_1d":                 {"prereqs": ["dp_intro"],                   "difficulty": 4},
    "divide_conquer":        {"prereqs": ["recursion", "merge_sort"],    "difficulty": 4},
    "string_matching":       {"prereqs": ["strings"],                    "difficulty": 4},
    "dp_2d":                 {"prereqs": ["dp_1d"],                      "difficulty": 5},
    "dp_knapsack":           {"prereqs": ["dp_1d"],                      "difficulty": 5},
    "dp_lcs":                {"prereqs": ["dp_2d"],                      "difficulty": 5},
    "dp_trees":              {"prereqs": ["dp_intro", "binary_tree"],    "difficulty": 5},
    "segment_tree":          {"prereqs": ["binary_tree", "prefix_sum"],  "difficulty": 5},
    "fenwick_tree":          {"prereqs": ["prefix_sum"],                 "difficulty": 5},
    "dp_graphs":             {"prereqs": ["dp_intro", "graph_basics"],   "difficulty": 6},
}


def update_mastery(topic: str, correct: bool, time_ms: int, hint_used: bool, model: dict) -> dict:
    topic_data = model["topics"].get(topic, {
        "mastery": 0, "confidence": 0, "attempts": 0, "correct": 0,
        "avgTimeMs": 60000, "lastSeen": None, "hesitationCount": 0, "hintRequests": 0
    })

    current = topic_data.get("mastery", 0)
    last_seen_str = topic_data.get("lastSeen")

    if last_seen_str:
        try:
            last_seen = datetime.fromisoformat(last_seen_str.replace("Z", "+00:00"))
            days_since = (datetime.now(timezone.utc) - last_seen).days
            if days_since > 7:
                current = current * (0.95 ** days_since)
        except Exception:
            pass

    delta = 0.08 if correct else -0.05
    if hint_used:
        delta *= 0.6
    avg_time = topic_data.get("avgTimeMs") or 60000
    if time_ms > avg_time * 2:
        delta *= 0.8

    new_mastery = max(0.0, min(1.0, current + delta))

    confidence_delta = 0.04 if correct else -0.02
    new_confidence = max(0.0, min(1.0, topic_data.get("confidence", 0) + confidence_delta))

    attempts = topic_data.get("attempts", 0) + 1
    corrects = topic_data.get("correct", 0) + (1 if correct else 0)
    existing_avg = topic_data.get("avgTimeMs", 60000)
    new_avg = int((existing_avg * (attempts - 1) + time_ms) / attempts)

    model["topics"][topic] = {
        **topic_data,
        "mastery": round(new_mastery, 4),
        "confidence": round(new_confidence, 4),
        "attempts": attempts,
        "correct": corrects,
        "avgTimeMs": new_avg,
        "lastSeen": datetime.now(timezone.utc).isoformat(),
    }

    mastery_vals = [v.get("mastery", 0) for v in model["topics"].values()]
    avg_mastery = sum(mastery_vals) / len(mastery_vals) if mastery_vals else 0

    weak = [t for t, v in model["topics"].items() if 0 < v.get("mastery", 0) < 0.4]
    strong = [t for t, v in model["topics"].items() if v.get("mastery", 0) > 0.75]
    model["weaknessVector"] = sorted(weak, key=lambda t: model["topics"][t]["mastery"])[:5]
    model["strengthVector"] = sorted(strong, key=lambda t: model["topics"][t]["mastery"], reverse=True)[:5]

    return model


def compute_roadmap(knowledge_model: dict, goal: str) -> list[str]:
    GOAL_WEIGHTS = {
        "placement": ["arrays", "strings", "dp_intro", "dp_1d", "graph_basics", "bfs", "dfs", "sliding_window", "binary_tree"],
        "faang": ["dp_2d", "dp_knapsack", "graph_basics", "segment_tree", "trie", "bit_manipulation"],
        "competitive": ["segment_tree", "fenwick_tree", "dp_graphs", "string_matching"],
        "learning": [],
    }

    scores: dict[str, float] = {}
    topics = knowledge_model.get("topics", {})

    for topic, meta in TOPIC_GRAPH.items():
        mastery = topics.get(topic, {}).get("mastery", 0)
        if mastery > 0.85:
            continue

        prereq_ok = all(
            topics.get(p, {}).get("mastery", 0) > 0.5
            for p in meta["prereqs"]
        )
        if not prereq_ok:
            continue

        priority = 1 - abs(mastery - 0.5) * 2

        if topic in GOAL_WEIGHTS.get(goal, []):
            priority += 0.2

        last_seen = topics.get(topic, {}).get("lastSeen")
        if last_seen:
            try:
                last_dt = datetime.fromisoformat(last_seen.replace("Z", "+00:00"))
                days = (datetime.now(timezone.utc) - last_dt).days
                if days > 5:
                    priority += 0.1
            except Exception:
                pass

        scores[topic] = priority

    return sorted(scores.keys(), key=lambda t: scores[t], reverse=True)

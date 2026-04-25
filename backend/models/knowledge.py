"""
NeuralDSA brain model.

Upgraded from a single 1D mastery score to a 5-dimensional brain model
plus behavior signals, pattern-level stats, error fingerprints, agent state,
and readiness scoring.

The model is the source of truth the agent reads on every turn. It is
persisted across sessions so the agent's understanding of the learner
survives restarts.
"""

from datetime import datetime, timezone
from typing import Optional, Literal
from pydantic import BaseModel, Field


# ─────────────────────────────────────────────────────────────────────────────
# Misconception taxonomy — the labels the evaluator can attach to wrong answers
# ─────────────────────────────────────────────────────────────────────────────

MISCONCEPTION_TAXONOMY = (
    "optimization_blindness",   # works but suboptimal (e.g. nested loop instead of hash)
    "complexity_confusion",     # incorrect Big-O reasoning
    "space_time_mixup",         # confuses time vs space tradeoffs
    "off_by_one",               # boundary / index errors
    "pattern_overfitting",      # forces wrong pattern (e.g. DP where greedy fits)
    "edge_case_blindness",      # misses empty/null/single/duplicate cases
    "prereq_gap",               # failure traces to weak prerequisite
    "syntax_error",             # parses but logic broken or doesn't run
    "incomplete_solution",      # partial; missing main step
)


# Assessment levels (Section 12.5)
ASSESSMENT_LEVELS = (
    (0.00, 0.20, 0, "Unfamiliar"),
    (0.20, 0.40, 1, "Aware"),
    (0.40, 0.65, 2, "Familiar"),
    (0.65, 0.85, 3, "Proficient"),
    (0.85, 1.01, 4, "Expert"),
)


def assessment_level(mastery: float) -> tuple[int, str]:
    """Convert mastery [0,1] to (level 0-4, label)."""
    for lo, hi, lvl, name in ASSESSMENT_LEVELS:
        if lo <= mastery < hi:
            return lvl, name
    return 4, "Expert"


# ─────────────────────────────────────────────────────────────────────────────
# Schemas
# ─────────────────────────────────────────────────────────────────────────────


class TopicStat(BaseModel):
    """5D brain model per topic + behavior signals."""

    # The 5 dimensions
    knowledge: float = 0.0           # what they know (was: mastery)
    speed: float = 0.0               # how fast they answer correctly (0=slow,1=fast)
    confidence: float = 0.0          # decisiveness proxy (separate from accuracy)
    consistency: float = 0.0         # variance across attempts (1=stable)
    patternRecognition: float = 0.0  # ability to name the pattern before solving

    # Compatibility alias — many call sites still read 'mastery'.
    # Kept synced to knowledge in update_mastery.
    mastery: float = 0.0

    # Counters
    attempts: int = 0
    correct: int = 0
    avgTimeMs: int = 60000
    lastSeen: Optional[str] = None
    lastSeenQuestionIndex: int = 0
    questionsSinceSeen: int = 0

    # Behavior metrics
    hesitationCount: int = 0
    hintRequests: int = 0
    overconfidenceFlags: int = 0     # fast + wrong
    surfaceKnowledgeFlags: int = 0   # slow + correct
    skipCount: int = 0
    hintAvoidanceCount: int = 0      # repeated wrong without using hint

    # Misconception fingerprints — { taxonomy_label: count }
    misconceptionHistogram: dict[str, int] = Field(default_factory=dict)


class PatternStat(BaseModel):
    """Pattern-level mastery (lightweight 5D)."""
    knowledge: float = 0.0
    speed: float = 0.0
    confidence: float = 0.0
    consistency: float = 0.0
    attempts: int = 0
    correct: int = 0


class AgentState(BaseModel):
    """Persisted across sessions so restart continuity works."""
    lastMode: str = "ASSESS"
    lastReason: str = ""
    lastTopic: str = ""
    queueSnapshot: list[dict] = Field(default_factory=list)
    pendingReview: list[str] = Field(default_factory=list)
    recapMemory: list[str] = Field(default_factory=list)


class ReadinessSnapshot(BaseModel):
    total: float = 0.0               # 0-100
    coverage: float = 0.0
    accuracy: float = 0.0
    speed: float = 0.0
    consistency: float = 0.0
    recency: float = 0.0
    timestamp: Optional[str] = None


class KnowledgeModel(BaseModel):
    uid: str
    topics: dict[str, TopicStat] = Field(default_factory=dict)
    patternStats: dict[str, PatternStat] = Field(default_factory=dict)
    learningStyle: str = "visual"
    pacePreference: str = "adaptive"
    currentFocus: str = "arrays"
    weaknessVector: list[str] = Field(default_factory=list)
    strengthVector: list[str] = Field(default_factory=list)
    sessionCount: int = 0
    totalMinutes: int = 0
    questionCounter: int = 0          # monotonic question index for forgetting-curve math
    readiness: ReadinessSnapshot = Field(default_factory=ReadinessSnapshot)
    readinessHistory: list[dict] = Field(default_factory=list)
    agentState: AgentState = Field(default_factory=AgentState)


# ─────────────────────────────────────────────────────────────────────────────
# Topic dependency graph (unchanged structure; difficulty drives questions)
# ─────────────────────────────────────────────────────────────────────────────

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


# ─────────────────────────────────────────────────────────────────────────────
# Default builders + migration
# ─────────────────────────────────────────────────────────────────────────────


def default_topic_stat() -> dict:
    return {
        "knowledge": 0.0,
        "mastery": 0.0,
        "speed": 0.0,
        "confidence": 0.0,
        "consistency": 0.0,
        "patternRecognition": 0.0,
        "attempts": 0,
        "correct": 0,
        "avgTimeMs": 60000,
        "lastSeen": None,
        "lastSeenQuestionIndex": 0,
        "questionsSinceSeen": 0,
        "hesitationCount": 0,
        "hintRequests": 0,
        "overconfidenceFlags": 0,
        "surfaceKnowledgeFlags": 0,
        "skipCount": 0,
        "hintAvoidanceCount": 0,
        "misconceptionHistogram": {},
    }


def default_pattern_stat() -> dict:
    return {
        "knowledge": 0.0,
        "speed": 0.0,
        "confidence": 0.0,
        "consistency": 0.0,
        "attempts": 0,
        "correct": 0,
    }


def default_agent_state() -> dict:
    return {
        "lastMode": "ASSESS",
        "lastReason": "",
        "lastTopic": "",
        "queueSnapshot": [],
        "pendingReview": [],
        "recapMemory": [],
    }


def default_readiness() -> dict:
    return {
        "total": 0.0,
        "coverage": 0.0,
        "accuracy": 0.0,
        "speed": 0.0,
        "consistency": 0.0,
        "recency": 0.0,
        "timestamp": None,
    }


def migrate_topic_stat(stat: dict) -> dict:
    """Backfill new fields onto pre-upgrade topic stats. Idempotent."""
    base = default_topic_stat()
    base.update(stat or {})
    # If only legacy mastery exists, copy it into knowledge.
    if base.get("knowledge", 0) == 0 and base.get("mastery", 0) > 0:
        base["knowledge"] = base["mastery"]
    # If only knowledge was set, mirror to mastery.
    if base.get("mastery", 0) == 0 and base.get("knowledge", 0) > 0:
        base["mastery"] = base["knowledge"]
    return base


def migrate_knowledge_model(model: dict) -> dict:
    """Bring a legacy/partial model up to the current schema. Idempotent."""
    if not isinstance(model, dict):
        model = {}
    model.setdefault("uid", "")
    model.setdefault("topics", {})
    model.setdefault("patternStats", {})
    model.setdefault("learningStyle", "visual")
    model.setdefault("pacePreference", "adaptive")
    model.setdefault("currentFocus", "arrays")
    model.setdefault("weaknessVector", [])
    model.setdefault("strengthVector", [])
    model.setdefault("sessionCount", 0)
    model.setdefault("totalMinutes", 0)
    model.setdefault("questionCounter", 0)
    model.setdefault("readiness", default_readiness())
    model.setdefault("readinessHistory", [])
    model.setdefault("agentState", default_agent_state())

    # Migrate every topic
    for tk in list(model["topics"].keys()):
        model["topics"][tk] = migrate_topic_stat(model["topics"][tk])

    return model


# ─────────────────────────────────────────────────────────────────────────────
# Mastery + dimension updates
# ─────────────────────────────────────────────────────────────────────────────


def _clamp01(v: float) -> float:
    return max(0.0, min(1.0, v))


def _normalize_speed(time_ms: int, expected_ms: int = 60000) -> float:
    """0 = very slow, 1 = very fast, relative to expected."""
    if time_ms <= 0:
        return 0.5
    ratio = expected_ms / time_ms
    return _clamp01(ratio / 2.0)  # ratio of 2 → speed 1.0


def update_mastery(
    topic: str,
    correct: bool,
    time_ms: int,
    hint_used: bool,
    model: dict,
    *,
    pattern: Optional[str] = None,
    hesitation_ms: Optional[int] = None,
    error_fingerprint: Optional[str] = None,
    confidence_signal: Optional[float] = None,
) -> dict:
    """
    Update a topic's brain model after one answer. Updates all 5 dimensions
    plus behavior metrics, pattern stats, and global vectors.

    Backward-compatible signature: the new keyword args are all optional.
    """
    model = migrate_knowledge_model(model)
    stat = migrate_topic_stat(model["topics"].get(topic, {}))

    # Forgetting decay before applying new evidence
    last_seen_str = stat.get("lastSeen")
    current_k = stat.get("knowledge", 0)
    if last_seen_str:
        try:
            last_seen = datetime.fromisoformat(last_seen_str.replace("Z", "+00:00"))
            days_since = (datetime.now(timezone.utc) - last_seen).days
            if days_since > 7:
                current_k = current_k * (0.95 ** (days_since - 7))
        except Exception:
            pass

    # Knowledge delta
    delta = 0.08 if correct else -0.05
    if hint_used:
        delta *= 0.6
    avg_time = stat.get("avgTimeMs") or 60000
    if time_ms > avg_time * 2:
        delta *= 0.8
    if error_fingerprint == "prereq_gap":
        delta *= 1.2  # extra penalty signal so prereq pivot is sharper
    new_k = _clamp01(current_k + delta)

    # Speed dimension — EMA toward normalized speed if correct, decays if wrong
    speed_obs = _normalize_speed(time_ms, expected_ms=avg_time)
    prev_speed = stat.get("speed", 0)
    new_speed = _clamp01(prev_speed * 0.7 + speed_obs * 0.3) if correct else _clamp01(prev_speed * 0.95)

    # Confidence — slower-moving than knowledge; if confidence_signal given, use it
    if confidence_signal is not None:
        conf_obs = _clamp01(confidence_signal)
        new_conf = _clamp01(stat.get("confidence", 0) * 0.7 + conf_obs * 0.3)
    else:
        conf_delta = 0.04 if correct else -0.02
        new_conf = _clamp01(stat.get("confidence", 0) + conf_delta)

    # Consistency — variance proxy. Reward when outcome matches recent expectation.
    attempts = stat.get("attempts", 0) + 1
    accuracy_so_far = (stat.get("correct", 0) + (1 if correct else 0)) / max(1, attempts)
    expected_outcome = stat.get("knowledge", 0)
    surprise = abs((1.0 if correct else 0.0) - expected_outcome)
    new_consistency = _clamp01(stat.get("consistency", 0) * 0.85 + (1.0 - surprise) * 0.15)

    # Pattern recognition — bumped only when correct AND pattern known to learner.
    pat_recog = stat.get("patternRecognition", 0)
    if correct and pattern:
        pat_recog = _clamp01(pat_recog + 0.05)
    elif not correct and pattern:
        pat_recog = _clamp01(pat_recog - 0.02)

    # Behavior signals
    hesitation_count = stat.get("hesitationCount", 0)
    overconf = stat.get("overconfidenceFlags", 0)
    surface = stat.get("surfaceKnowledgeFlags", 0)
    if hesitation_ms is not None and hesitation_ms > 8000:
        hesitation_count += 1
    # Fast + wrong → overconfidence
    if (not correct) and time_ms < (avg_time * 0.5):
        overconf += 1
    # Slow + correct → surface knowledge
    if correct and time_ms > (avg_time * 1.8):
        surface += 1

    # Misconception histogram
    histogram = dict(stat.get("misconceptionHistogram", {}) or {})
    if (not correct) and error_fingerprint and error_fingerprint in MISCONCEPTION_TAXONOMY:
        histogram[error_fingerprint] = histogram.get(error_fingerprint, 0) + 1

    # Counters
    corrects = stat.get("correct", 0) + (1 if correct else 0)
    existing_avg = stat.get("avgTimeMs", 60000)
    new_avg = int((existing_avg * (attempts - 1) + time_ms) / attempts)
    if hint_used:
        stat["hintRequests"] = stat.get("hintRequests", 0) + 1

    # Question index → forgetting curve bookkeeping
    model["questionCounter"] = model.get("questionCounter", 0) + 1
    q_idx = model["questionCounter"]

    model["topics"][topic] = {
        **stat,
        "knowledge": round(new_k, 4),
        "mastery": round(new_k, 4),  # alias kept in sync
        "speed": round(new_speed, 4),
        "confidence": round(new_conf, 4),
        "consistency": round(new_consistency, 4),
        "patternRecognition": round(pat_recog, 4),
        "attempts": attempts,
        "correct": corrects,
        "avgTimeMs": new_avg,
        "lastSeen": datetime.now(timezone.utc).isoformat(),
        "lastSeenQuestionIndex": q_idx,
        "questionsSinceSeen": 0,
        "hesitationCount": hesitation_count,
        "overconfidenceFlags": overconf,
        "surfaceKnowledgeFlags": surface,
        "misconceptionHistogram": histogram,
    }

    # Bump questionsSinceSeen for every other topic
    for other in model["topics"]:
        if other == topic:
            continue
        model["topics"][other]["questionsSinceSeen"] = (
            model["topics"][other].get("questionsSinceSeen", 0) + 1
        )

    # Update pattern stats
    if pattern:
        pat = dict(model["patternStats"].get(pattern, default_pattern_stat()))
        pat["attempts"] = pat.get("attempts", 0) + 1
        pat["correct"] = pat.get("correct", 0) + (1 if correct else 0)
        p_delta = 0.07 if correct else -0.04
        pat["knowledge"] = _clamp01(pat.get("knowledge", 0) + p_delta)
        pat["speed"] = _clamp01(pat.get("speed", 0) * 0.7 + speed_obs * 0.3) if correct else _clamp01(pat.get("speed", 0) * 0.95)
        pat["confidence"] = _clamp01(pat.get("confidence", 0) + (0.04 if correct else -0.02))
        pat["consistency"] = _clamp01(pat.get("consistency", 0) * 0.85 + (1.0 - surprise) * 0.15)
        model["patternStats"][pattern] = pat

    # Recompute weakness/strength vectors
    pairs = [(t, v.get("knowledge", 0)) for t, v in model["topics"].items()]
    weak = [t for t, k in pairs if 0 < k < 0.4]
    strong = [t for t, k in pairs if k > 0.75]
    model["weaknessVector"] = sorted(weak, key=lambda t: model["topics"][t]["knowledge"])[:5]
    model["strengthVector"] = sorted(strong, key=lambda t: model["topics"][t]["knowledge"], reverse=True)[:5]

    return model


# ─────────────────────────────────────────────────────────────────────────────
# Behavior + readiness scoring
# ─────────────────────────────────────────────────────────────────────────────


def confidence_calibration_gap(model: dict, topic: Optional[str] = None) -> float:
    """
    Returns confidence - accuracy. Positive = overconfident, negative = underconfident.
    If topic is None, returns global gap weighted by attempts.
    """
    model = migrate_knowledge_model(model)
    if topic:
        s = model["topics"].get(topic)
        if not s:
            return 0.0
        attempts = s.get("attempts", 0)
        if attempts == 0:
            return 0.0
        accuracy = s.get("correct", 0) / attempts
        return round(s.get("confidence", 0) - accuracy, 4)

    total_attempts = 0
    weighted_gap = 0.0
    for s in model["topics"].values():
        a = s.get("attempts", 0)
        if a == 0:
            continue
        accuracy = s.get("correct", 0) / a
        weighted_gap += (s.get("confidence", 0) - accuracy) * a
        total_attempts += a
    if total_attempts == 0:
        return 0.0
    return round(weighted_gap / total_attempts, 4)


def readiness_score(model: dict, goal: str = "placement") -> dict:
    """
    Compute interview readiness 0-100 with subscores.
    coverage, accuracy, speed, consistency, recency.
    """
    model = migrate_knowledge_model(model)
    topics = model.get("topics", {})

    # Goal-relevant topic set
    GOAL_FOCUS = {
        "placement": ["arrays", "strings", "hashing", "two_pointers", "sliding_window",
                       "binary_search", "binary_tree", "bfs", "dfs", "graph_basics",
                       "dp_intro", "dp_1d", "linked_list", "stack", "heap"],
        "faang":     ["dp_2d", "dp_knapsack", "graph_basics", "segment_tree", "trie",
                       "bit_manipulation", "binary_tree", "shortest_path_dijkstra"],
        "competitive": ["segment_tree", "fenwick_tree", "dp_graphs", "string_matching",
                         "shortest_path_dijkstra", "shortest_path_bellman"],
        "learning":  list(TOPIC_GRAPH.keys()),
    }
    focus = GOAL_FOCUS.get(goal, list(TOPIC_GRAPH.keys()))

    # Coverage: fraction of focus topics with mastery > 0.4
    if focus:
        touched = sum(1 for t in focus if topics.get(t, {}).get("knowledge", 0) > 0.4)
        coverage = touched / len(focus)
    else:
        coverage = 0.0

    # Accuracy: weighted by attempts across focus topics
    total_attempts = 0
    total_correct = 0
    for t in focus:
        s = topics.get(t, {})
        total_attempts += s.get("attempts", 0)
        total_correct += s.get("correct", 0)
    accuracy = (total_correct / total_attempts) if total_attempts else 0.0

    # Speed: avg of focus topic speed dims (only those attempted)
    speeds = [topics[t].get("speed", 0) for t in focus if topics.get(t, {}).get("attempts", 0) > 0]
    speed = (sum(speeds) / len(speeds)) if speeds else 0.0

    # Consistency
    cons = [topics[t].get("consistency", 0) for t in focus if topics.get(t, {}).get("attempts", 0) > 0]
    consistency = (sum(cons) / len(cons)) if cons else 0.0

    # Recency: penalize stale focus topics
    now = datetime.now(timezone.utc)
    recencies: list[float] = []
    for t in focus:
        ls = topics.get(t, {}).get("lastSeen")
        if not ls:
            continue
        try:
            dt = datetime.fromisoformat(ls.replace("Z", "+00:00"))
            days = (now - dt).days
            recencies.append(max(0.0, 1.0 - (days / 14.0)))  # 0 after 2 weeks
        except Exception:
            continue
    recency = (sum(recencies) / len(recencies)) if recencies else 0.0

    # Weighted total
    total = (
        coverage * 30 +
        accuracy * 30 +
        speed * 15 +
        consistency * 15 +
        recency * 10
    )

    snapshot = {
        "total": round(total, 2),
        "coverage": round(coverage * 100, 2),
        "accuracy": round(accuracy * 100, 2),
        "speed": round(speed * 100, 2),
        "consistency": round(consistency * 100, 2),
        "recency": round(recency * 100, 2),
        "timestamp": now.isoformat(),
    }
    return snapshot


def update_readiness(model: dict, goal: str = "placement") -> dict:
    """Compute and persist readiness snapshot. Returns the new snapshot."""
    model = migrate_knowledge_model(model)
    snap = readiness_score(model, goal)
    model["readiness"] = snap
    history = model.get("readinessHistory", [])
    history.append({"total": snap["total"], "timestamp": snap["timestamp"]})
    model["readinessHistory"] = history[-50:]  # cap at 50 points
    return snap


# ─────────────────────────────────────────────────────────────────────────────
# Forgetting curve
# ─────────────────────────────────────────────────────────────────────────────


def apply_forgetting_decay(model: dict) -> list[str]:
    """
    Decay knowledge for topics not seen in a while. Returns list of topic ids
    that fell into the 'review needed' band as a result.
    """
    model = migrate_knowledge_model(model)
    review_needed: list[str] = []
    now = datetime.now(timezone.utc)
    for topic, stat in model["topics"].items():
        ls = stat.get("lastSeen")
        if not ls:
            continue
        try:
            dt = datetime.fromisoformat(ls.replace("Z", "+00:00"))
            days = (now - dt).days
        except Exception:
            continue
        if days <= 5:
            continue
        old_k = stat.get("knowledge", 0)
        if old_k <= 0.05:
            continue
        decayed = max(0.0, old_k * (0.97 ** (days - 5)))
        stat["knowledge"] = round(decayed, 4)
        stat["mastery"] = stat["knowledge"]
        # Track topics that are now stale enough to warrant review
        if 0.3 < old_k <= 0.85 and decayed < old_k - 0.05:
            review_needed.append(topic)
    return review_needed


# ─────────────────────────────────────────────────────────────────────────────
# Roadmap (kept for compatibility; new queue lives in services/curriculum.py)
# ─────────────────────────────────────────────────────────────────────────────


def compute_roadmap(knowledge_model: dict, goal: str) -> list[str]:
    GOAL_WEIGHTS = {
        "placement": ["arrays", "strings", "dp_intro", "dp_1d", "graph_basics", "bfs", "dfs", "sliding_window", "binary_tree"],
        "faang": ["dp_2d", "dp_knapsack", "graph_basics", "segment_tree", "trie", "bit_manipulation"],
        "competitive": ["segment_tree", "fenwick_tree", "dp_graphs", "string_matching"],
        "learning": [],
    }

    knowledge_model = migrate_knowledge_model(knowledge_model)
    scores: dict[str, float] = {}
    topics = knowledge_model.get("topics", {})

    for topic, meta in TOPIC_GRAPH.items():
        mastery = topics.get(topic, {}).get("knowledge", 0)
        if mastery > 0.85:
            continue

        prereq_ok = all(
            topics.get(p, {}).get("knowledge", 0) > 0.5
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

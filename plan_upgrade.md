# NeuralDSA Upgrade Plan (Hackathon) — CognitiveOS for DSA

## Executive Summary: What Makes This Win-Worthy

**The Problem**: Every hackathon team will build "question → check → next question" with a slider. Judges have seen it 50 times. It's not an agent. It's a quiz with a progress bar.

**Our Differentiation**: We model not just *what* you know, but **how you think**.

The bottleneck in DSA learning isn't question quantity — it's **metacognition**. Students fail not because they didn't see enough problems, but because they don't know why they're failing. Our agent tracks:
- **Hesitation patterns**: do you answer fast (guess) or slow (think)?
- **Error fingerprints**: what misconception caused your specific wrong answer?
- **Confidence calibration**: are you overconfident (fast+wrong) or underconfident (slow+correct)?
- **Forgetting curves**: which concepts are about to decay from memory?
- **Speed signatures**: deep mastery (fast+correct) vs. surface knowledge (slow+correct)?

This is **behavioral analysis meets cognitive science**. No other team will do this.

---

## 1. Goal
Build a highly interactive DSA learning product with:
- in-app coding + fast feedback
- a personalized **cognitive agent** that models how you think, not just what you know
- behavioral analysis (hesitation, error patterns, confidence calibration)
- forget curve tracking (Ebbinghaus spaced repetition)
- LeetCode alignment (links and progression)
- optional extension-based auto-sync if time remains

This plan intentionally prioritizes demo reliability and user experience over heavy production infra.

**Core insight for judges**: "We built a cognitive model of a learner that updates in real time. The agent doesn't ask what to teach next — it reasons about it. It tracks not just what you know, but how you think, where your confidence is miscalibrated, and what you're about to forget."

**Core insight for judges**: "We built a cognitive model of a learner that updates in real time. The agent doesn't ask what to teach next — it reasons about it. It tracks not just what you know, but how you think, where your confidence is miscalibrated, and what you're about to forget."

---

## 1.5. The Cognitive Brain: Five-Dimensional Learner Model

This is the architecture that makes it an agent, not a chatbot. Every learner has a multi-dimensional model that updates after every interaction.

### Dimension 1: Knowledge State (Mastery)
**What it is**: Bayesian belief about your understanding of each concept (0 → 1).
**How it updates**:
- Correct answer, first try: +0.12 mastery delta
- Correct answer, with hint: +0.08 delta
- Correct answer, slow (2x avg time): +0.05 delta
- Wrong answer: -0.08 delta
- Recency decay: concepts not touched in 7+ days lose 2% mastery per day

**Example**: After solving "Two Pointers — Container with Water", mastery for "two_pointers" goes from 0.45 → 0.57.

### Dimension 2: Confidence Calibration (Overconfidence Detector)
**What it is**: A separate model tracking whether your self-assessment matches your actual performance.
**Signals tracked**:
- `answer_speed`: time from problem load to first keystroke (ms)
- `answer_latency`: total time to submit answer (ms)
- `hesitation_pattern`: pause > 10s mid-attempt (boolean)
- `actual_outcome`: correct/wrong

**Calibration scoring**:
```python
# Example: you answered in 5s flat and got it right → well-calibrated
# You answered in 5s flat and got it wrong 3 times in a row → overconfident

confidence_score = 0.5 + (answer_speed_percentile * 0.25) + (accuracy_on_fast_answers * 0.25)
# High confidence_score + low accuracy = ALERT: you're overconfident
```

**Real-world signal**: If you answer Tree problems in < 10s but get 40% right, the agent knows you're pattern-matching poorly. It'll tell you: "You're answering very quickly but getting trees wrong. Slow down. Read the problem statement."

**Research basis**: Dunning–Kruger effect — low performers overestimate ability. This layer detects it in real time.

### Dimension 3: Error Taxonomy (Misconception Fingerprinting)
**What it is**: Classification of *why* you got it wrong, not just that you did.

**Error types** (the agent classifies every wrong answer into one of these):
1. **Pattern mismatch** — picked wrong algorithm (chose binary search for linear scan problem)
2. **Off-by-one** — boundary condition bug (e.g., `i < n` vs `i <= n`)
3. **Complexity confusion** — understood logic but misjudged time/space (chose O(n²) when O(n) is needed)
4. **Edge case miss** — didn't handle empty input, null, single element, etc.
5. **Implementation gap** — logic correct but syntax/runtime error
6. **Overoptimization** — tried too clever a solution for the stage you're at

**How it works**:
```python
def classify_error(user_answer, correct_answer, problem_category):
    if user_answer == WRONG_ALGORITHM_CHOICES[problem_category]:
        return "pattern_mismatch"  # LeetCode problem type detection
    elif user_answer is off_by_one_variant(correct_answer):
        return "off_by_one"
    elif complexity_matches(user_answer) but logic_wrong(user_answer):
        return "complexity_confusion"
    # ... etc
```

**Agent response per error type**:
- Pattern mismatch → teach the concept from scratch
- Off-by-one → drill 5 mini-problems on boundary conditions
- Complexity confusion → show complexity comparison side-by-side
- Edge case miss → generate edge-case-only problem set
- Implementation gap → debug the code together
- Overoptimization → scale back, build incrementally

**Real-world impact**: A student gets 3 questions wrong. Agent recognizes all 3 are "edge case miss" errors → agent auto-pivots to 5 min edge-case boot camp before returning to the main problem.

### Dimension 4: Forgetting Curve (Ebbinghaus Spaced Repetition)
**What it is**: A model of memory decay over time.

**Science**: Ebbinghaus (1885) discovered that humans forget ~50% of new knowledge in days unless actively reviewed. Information decay follows a power law: `retention(t) = 100 / (1 + k*t^1.25)` where t = days since last exposure.

**Implementation**:
```python
def decay_mastery(concept, days_since_last_attempt):
    current_mastery = knowledge_model[concept]["mastery"]
    decay_rate = 0.98  # 2% loss per day
    new_mastery = current_mastery * (decay_rate ** days_since_last_attempt)
    return new_mastery

# Example: arrays mastery is 0.75, haven't touched arrays in 5 days
# new_mastery = 0.75 * (0.98 ^ 5) = 0.75 * 0.904 = 0.68
```

**Agent behavior**:
- **Day 0–2 after learning**: No decay (memory still fresh).
- **Day 3–5**: Mastery decays at 2% per day.
- **Day 6+**: Aggressive re-queue. Agent will prioritize this concept in next recommended problem.
- **Day 14+**: Concept is "stale" — agent flags for prerequisite re-teach before using it.

**Real-world example**: Student solved "arrays" problems on Monday, Tuesday, Wednesday. By Friday, arrays mastery decayed from 0.82 → 0.75. Next day's recommended problem is a mix of new concept + array warmup.

### Dimension 5: Speed Signature (Deep vs. Surface Knowledge)
**What it is**: Response time per concept reveals whether you *really* know something or just pattern-match.

**Signals tracked per concept**:
- `avg_response_time_ms`
- `response_time_percentile` (fast? slow? vs. peer average)
- `speed_consistency` (always fast? varies?)

**Interpretation**:
```python
def interpret_speed(concept, avg_time_ms, accuracy):
    if avg_time_ms < 30000 and accuracy > 0.8:
        return "deep_mastery"  # fast + correct = you know this cold
    elif avg_time_ms > 90000 and accuracy > 0.8:
        return "surface_knowledge"  # slow + correct = you're thinking hard, not fluid
    elif avg_time_ms < 30000 and accuracy < 0.6:
        return "pattern_matching"  # fast + wrong = you're guessing
    # ...
```

**Agent behavior**:
- Deep mastery (fast + correct) → move to harder problems
- Surface knowledge (slow + correct) → drill more problems on this concept to build fluency
- Pattern matching (fast + wrong) → teach the concept from first principles
- Slow + wrong → break into simpler sub-problems, find the exact gap

---

## 2. Product direction decision

## Option analysis
1. **LeetCode redirect only**
   - Pros: fastest
   - Cons: weak personalization signal, weak interactivity, weak product differentiation

2. **LeetCode auto-capture only**
   - Pros: users code where they already are
   - Cons: no direct backend capture path; needs browser extension and adds demo risk

3. **In-app coding + sandbox (chosen core)**
   - Pros: strongest interaction loop, measurable learning signals, controllable demo
   - Cons: requires runner service work

## Chosen strategy (hybrid)
- **Primary**: in-app coding workspace with Docker sandbox (5-6 languages)
- **Secondary**: deep-link each topic/problem to LeetCode
- **If time left**: browser extension spike for automatic sync from LeetCode pages

---

## 3. Target user journey (Deep-ML + LeetCode inspired)

1. **Onboarding**
   - Level, goal, daily time, preferred language.
   - Seed knowledge model and recommended first mission.

2. **Daily mission**
   - 1 concept warmup -> 1 core problem -> 1 stretch problem.
   - Clear CTA: Start 20-min mission.

3. **Interactive workspace**
   - Left: statement, examples, constraints, hints.
   - Center: editor, language, Run, Submit.
   - Right: agent coach (hint/explain/debug/complexity).

4. **Adaptive learning loop**
   - After each submit: verdict + concept diagnosis + next action.
   - If repeated struggle: agent pivots to prerequisite micro-lesson.

5. **Session closure**
   - Summary: strengths, gaps, mastery change, next recommended.
   - Optional CTA: try related LeetCode problem.

---

## 4. Feature plan (what to build)

## Track A: Interactive coding engine (must-have)
1. Sandbox runner service (Docker-based)
2. Test-case engine (sample + hidden tests)
3. Run vs Submit APIs
4. Workspace UI for outputs/verdicts
5. Submission telemetry persistence

## Track B: Agent upgrades (must-have) — The Cognitive Intelligence Engine

The agent is not just a router. It's a reasoning system that tracks 5 behavioral dimensions and makes 8 distinct decisions.

### Behavioral signals tracked in real-time
1. **Response time** (ms) — total time from problem load to submit
2. **Hesitation pattern** — pause > 10s mid-attempt? Multiple false starts?
3. **Attempt count** — how many tries on this problem?
4. **Error type** — classification of why you got it wrong (pattern mismatch? off-by-one? edge case?)
5. **Submission telemetry** — did you Run first (good signal)? Or submit blind (risky)?

### The 8 Agent Decision Actions

After every answer, the agent observes the 5D learner model and picks ONE action:

**1. ADVANCE** — mastery high (> 0.75), confidence calibrated, consistent correctness
- **Condition**: Last 2 correct, < 60s each, no hints needed
- **Action**: Harder problem (same concept, higher LeetCode difficulty)
- **Tutor message**: "Solid. Ready for the next level."

**2. REINFORCE** — correct but slow or requires hint, needs fluency building
- **Condition**: Correct but avg_time > 2x concept average, OR hint-dependent
- **Mastery change**: +0.06 (less than clean solve)
- **Action**: Same concept, different problem, lighter constraints
- **Tutor message**: "Right idea. Let's build fluency. Try a simpler version."

**3. SCAFFOLD** — wrong answer, needs sub-problem isolation
- **Condition**: Wrong + first hint request
- **Action**: Generate sub-problem that isolates the gap (e.g., if you failed container-with-water, give just the two-pointer traversal part)
- **Tutor message**: "Let's break this into steps. Try this simpler part first."

**4. EXPLAIN** — wrong + hint used + still stuck
- **Condition**: Wrong after hint, OR 2nd wrong attempt on same concept
- **Action**: Full concept explanation before next problem
- **Duration**: 2–3 min microlesson
- **Tutor message**: "Different approach. Let me explain the concept first."

**5. INTERLEAVE** — build concept bridges by mixing strong + weak topics
- **Condition**: Strong mastery on X (> 0.75), weak on Y (< 0.4), Y depends on X
- **Action**: Give problem that requires BOTH X + Y (e.g., arrays + two-pointers at same time)
- **Effect**: Strengthens prerequisite transfer
- **Tutor message**: "You're strong on arrays. Two-pointers builds on that. Let's connect them."

**6. RECALL** — trigger forgetting curve; concepts haven't been seen in 10+ questions
- **Condition**: `(now - last_attempt_time).days > 5` AND mastery > 0.4
- **Action**: Queue this concept in next 2 problems to refresh memory before it decays
- **Mastery effect**: Refresh resets decay clock (decay freezes at current mastery)
- **Tutor message**: "You haven't seen recursion in a while. Let's refresh." → gives mini-problem

**7. CALIBRATE** — metacognitive nudge when confidence/accuracy mismatch detected
- **Condition**: Answer_speed < 30s + accuracy_last_5 < 0.5 (pattern matching), OR answer_speed > 120s + accuracy > 0.9 (underconfident)
- **Action**: Show the mismatch explicitly
- **Tutor message**: 
  - If overconfident: "You're answering very fast but getting trees wrong 3 times in a row. Slow down. Read carefully."
  - If underconfident: "You're slow but very accurate. Trust your process. You're ready to speed up."

**8. CELEBRATE + TOPIC UNLOCK** — mastery > 0.85 consistently on a topic
- **Condition**: Mastery > 0.85 on last 5 attempts (all correct in last 2, avg accuracy > 0.9 in last 10)
- **Action**: Declare mastery, visibly unlock next prerequisite topic on roadmap
- **Tutor message**: "Mastered two-pointers. Unlocked: Sliding Window."
- **Frontend**: Mind map node animates unlock, prereq-locked nodes become clickable

### Agent Decision Loop (pseudo-algorithm)

```python
def agent_decide(learner_model, session_state, recent_answer):
    """
    The core reasoning loop that fires after every answer.
    """
    # Observe
    observed_state = {
        "response_time_ms": session_state["time_taken"],
        "hesitation_detected": session_state["paused_mid_attempt"],
        "error_type": classify_error(recent_answer, correct_answer),
        "attempt_count": session_state["attempt_num"],
        "confidence": calculate_confidence(learner_model),
        "mastery": learner_model["topics"][topic]["mastery"],
        "accuracy_last_5": learner_model["topics"][topic]["accuracy_recent"]
    }
    
    # Update learner model
    learner_model = update_mastery(
        mastery=learner_model["topics"][topic]["mastery"],
        correct=recent_answer["correct"],
        time_ms=observed_state["response_time_ms"],
        error_type=observed_state["error_type"]
    )
    learner_model = update_confidence_calibration(
        learner_model,
        answer_speed=observed_state["response_time_ms"],
        actual_outcome=recent_answer["correct"]
    )
    
    # Reason: select action based on decision tree
    if mastery > 0.85 and consistency_high:
        action = "CELEBRATE_UNLOCK"
    elif mastery > 0.75 and calibrated_confidence:
        action = "ADVANCE"
    elif recent_answer["correct"] and response_time_slow:
        action = "REINFORCE"
    elif confidence_accuracy_mismatch:
        action = "CALIBRATE"
    elif days_since_last_attempt > 5 and mastery > 0.4:
        action = "RECALL"
    elif prerequisite_weak and current_strong:
        action = "INTERLEAVE"
    elif hint_used and still_wrong:
        action = "EXPLAIN"
    elif wrong_first_time:
        action = "SCAFFOLD"
    
    # Act: build context-rich prompt for LLM
    prompt = build_agent_prompt(action, learner_model, observed_state)
    tutor_response = stream_from_gemini(prompt)
    
    return {
        "action": action,
        "next_problem": select_next_problem(action, learner_model),
        "tutor_message": tutor_response,
        "mastery_delta": mastery_change,
        "debug_reasoning": {
            "observed": observed_state,
            "decision_logic": f"mastery={mastery:.2f}, calibration={confidence:.2f}, error_type={error_type}"
        }
    }
```

### Error Classification Engine (Real Implementation)

This runs alongside the runner verdict:

```python
ERROR_TAXONOMY = {
    "pattern_mismatch": {
        "description": "Chose wrong algorithm",
        "indicators": [
            "binary_search_chosen_for_linear_problem",
            "greedy_chosen_for_dp_problem",
            "two_pointer_not_recognized"
        ],
        "remediation": "concept_lesson + 3 pattern_recognition_problems"
    },
    "off_by_one": {
        "description": "Boundary condition error",
        "indicators": [
            "output == correct_output + 1 or correct_output - 1",
            "index_out_of_bounds_runtime",
            "loop_condition_drift"
        ],
        "remediation": "edge_case_drill_5_problems"
    },
    "complexity_confusion": {
        "description": "Logic correct, complexity wrong",
        "indicators": [
            "logic_correct and time_complexity_high",
            "space_complexity_misclassified"
        ],
        "remediation": "complexity_analysis_lesson + optimization_problem"
    },
    "edge_case_miss": {
        "description": "Didn't handle empty, null, single element, duplicates, etc.",
        "indicators": [
            "fails_only_on_hidden_edge_cases",
            "passes_all_sample_tests"
        ],
        "remediation": "edge_case_problem_set_10_problems"
    }
}

def classify_user_error(user_code, expected_output, actual_output, problem_id):
    """Inspect user code + runtime output to classify error."""
    if actual_output == None and "index" in runtime_error:
        return "off_by_one"
    elif passes_samples but fails_hidden:
        return "edge_case_miss"
    # ... more heuristics
    return None
```

### Stuck Detection Trigger Policy

The agent monitors for struggle patterns:

```python
STUCK_THRESHOLD = {
    "consecutive_wrong": 3,          # 3 wrong in a row → escalate
    "hint_requests_without_progress": 2,  # 2 hints, still wrong → explain concept
    "time_on_problem_min": 15,       # Spent 15+ min on one problem → offer break or pivot
    "compile_errors_count": 5        # 5+ compilation attempts → offer debugging help
}

def check_stuck_and_escalate(session_state):
    if (session_state["consecutive_wrong"] >= 3 and
        session_state["error_types_are_same"]):
        # Same type of error 3 times = systematic gap
        agent_action = "EXPLAIN"  # Full concept lesson
    elif session_state["hint_requests"] >= 2 and not session_state["recently_correct"]:
        agent_action = "EXPLAIN"
    elif session_state["compile_errors"] >= 5:
        agent_action = "DEBUG_COACH"  # Show common syntax patterns
```

### Behavioral Report (Session Closure)

After each session, agent generates a plain-English report:

```
Session Summary for [User] - [Date]

Mastery Updates:
- Two Pointers: 0.45 → 0.63 (+0.18)
- Arrays: 0.82 → 0.85 (maintained)

Behavioral Insights:
✓ Strong: You solve two-pointer problems quickly (avg 28s, 100% accuracy).
  This signals deep mastery, not just pattern-matching.

⚠ Gap: Recursion base cases. You've gotten 4/7 right, but all 3 wrong
  answers share the same error: forgetting base case after recursive call.
  
⚠ Calibration: You answer trees very fast (18s avg) but only 40% accuracy.
  You might be pattern-matching prematurely. Slow down, read more carefully.

🔄 Stale: Segment trees (last touched 9 days ago). Mastery decayed from
  0.65 → 0.58. Recommend a refresh problem next session.

Next Session Focus:
→ Recursion: base case mini-drill (3–5 min warmup)
→ Segment trees: refresh problem
→ Trees: dial back speed, focus on correctness

Readiness Score: 62% (was 58% yesterday)
Ready for: FAANG easy interviews on arrays/two-pointers
Work needed: recursion depth, tree traversal patterns
```

1. Code-aware feedback from runner + evaluator
2. Agent modes:
   - explain concept
   - hint only
   - debug failed test
   - complexity coach
   - **NEW: behavioral calibration** (metacognition nudge)
   - **NEW: error classification coach** (target specific misconceptions)
   - **NEW: forgetting curve refresh** (spaced repetition trigger)
3. Stuck detection + prerequisite intervention policy
4. **NEW: Behavioral telemetry capture** (response time, hesitation, error patterns)
5. **NEW: Cognitive readiness score** (0–100, updated live)

5. **NEW: Cognitive readiness score** (0–100, updated live)

### Cognitive Readiness Score (Interview Prep Metric)

This is the single number that makes the product feel real-world applicable to judges and users.

**Definition**: A real-time score from 0–100 indicating your readiness for a FAANG DSA interview.

**Composition**:
```
Readiness = 0.3 * problem_coverage + 0.3 * pattern_recognition + 0.2 * speed_under_pressure + 0.2 * consistency

where:
  problem_coverage = % of major DSA patterns attempted (arrays, trees, dp, graphs, etc.)
  pattern_recognition = avg accuracy across all attempted patterns
  speed_under_pressure = (avg response time on hard problems) normalized to 0–1
  consistency = (correct / total attempts in last 20 problems)
```

**Real example**:
- Day 1 (just started): Readiness = 12%
- Day 3 (solved 15 problems, arrays mastered): Readiness = 28%
- Day 7 (mastered arrays + trees + two-pointers, 80% accuracy last 10): Readiness = 65%
- Day 14 (comprehensive coverage, 85%+ accuracy, fast on all topics): Readiness = 92%

**Frontend visualization**: Large glowing number on dashboard. Below it: breakdown by category (Problem Coverage: 60%, Pattern Recognition: 78%, Speed: 65%, Consistency: 82%).

**Post-session update**: After every submission, score updates live (even small deltas like +1–2 points). Users see this gamification and stay engaged.

### Behavioral Telemetry Schema

To enable cognitive modeling, we track this per submission:

```json
{
  "submission_id": "sub_uuid",
  "user_id": "uid",
  "problem_id": "lc_3_longest_substring",
  "timestamp": "2025-04-25T10:15:30Z",
  
  "timing": {
    "time_to_first_keystroke_ms": 2150,      // hesitation?
    "time_to_submit_ms": 45000,              // deep_mastery if < 30s+correct, surface if > 90s+correct
    "paused_mid_attempt": true,              // pause > 10s?
    "pause_count": 2,                        // how many times?
    "false_starts": 1                        // started code, deleted, restarted
  },
  
  "attempt": {
    "attempt_number": 2,
    "ran_before_submit": true,               // good signal: Run → Submit
    "compile_errors_count": 0,
    "test_run_count": 3                      // ran sample tests before submitting
  },
  
  "verdict": {
    "correct": false,
    "pass_rate": 0.8,  // 8/10 tests
    "error_type": "edge_case_miss",          // classification
    "runtime_ms": 45,
    "memory_mb": 12.5
  },
  
  "cognitive_signals": {
    "confidence_score": 0.35,                // mismatch: fast answer, only 80% pass
    "confidence_explanation": "overconfident",  // fast + partial = pattern matching?
    "speed_vs_avg": 1.5,                     // 1.5x slower than concept avg
    "mastery_inferred": "surface_knowledge"  // slow + correct = you're thinking hard
  },
  
  "agent_decision": {
    "action": "SCAFFOLD",
    "reason": "Edge case miss. Isolate the gap first.",
    "next_problem": "lc_3_substring_edge_cases_drill"
  }
}
```

### Implementation: Behavioral Collection Layer

In the Session UI, add timing hooks:

```typescript
// frontend/src/hooks/useSessionTelemetry.ts
export function useSessionTelemetry(problemId: string) {
  const telemetry = {
    time_to_first_keystroke_ms: null,
    time_to_submit_ms: null,
    paused_mid_attempt: false,
    pause_count: 0,
    false_starts: 0,
    ran_before_submit: false,
    test_run_count: 0,
    compile_errors_count: 0
  };
  
  // Capture first keystroke
  editor.addEventListener('keydown', () => {
    if (!telemetry.time_to_first_keystroke_ms) {
      telemetry.time_to_first_keystroke_ms = Date.now() - sessionStart;
    }
  });
  
  // Detect pauses (> 10s inactivity in editor)
  editor.addEventListener('keydown', () => {
    lastKeystrokeTime = Date.now();
  });
  
  setInterval(() => {
    if (Date.now() - lastKeystrokeTime > 10000) {
      telemetry.pause_count++;
      telemetry.paused_mid_attempt = true;
    }
  }, 5000);
  
  // Track Run clicks
  runButton.addEventListener('click', () => {
    telemetry.test_run_count++;
    telemetry.ran_before_submit = true;
  });
  
  // On submit, capture total time
  submitButton.addEventListener('click', () => {
    telemetry.time_to_submit_ms = Date.now() - sessionStart;
    return submitWithTelemetry(telemetry);
  });
  
  return telemetry;
}
```

### Classification Logic: Error Fingerprinting

Backend runs this after runner verdict:

```python
def fingerprint_error(problem_id, user_code, runner_verdict, problem_solution):
    """
    Classify the exact misconception from user_code + verdict.
    """
    # If passes all samples but fails hidden tests → edge case miss
    if runner_verdict.sample_pass_rate == 1.0 and runner_verdict.pass_rate < 1.0:
        return classify_edge_case_miss(user_code, runner_verdict.failed_test_ids)
    
    # If compile error → implementation gap
    if runner_verdict.compile_error:
        return classify_compile_error_type(runner_verdict.compile_error)
    
    # If logic is right but slow → complexity confusion
    if algorithm_matches_expected(user_code) and runtime_high(runner_verdict):
        return "complexity_confusion"
    
    # If picked wrong algorithm entirely → pattern mismatch
    if algorithm_class_wrong(user_code, problem_id):
        return "pattern_mismatch"
    
    # If output is off by 1 → boundary error
    if off_by_one_variant(runner_verdict.actual_output, runner_verdict.expected_output):
        return "off_by_one"
    
    return "other"

def classify_edge_case_miss(user_code, failed_test_ids):
    """Find what edge case your code doesn't handle."""
    edge_cases = extract_edge_case_patterns(failed_test_ids)
    # e.g., ["empty_array", "single_element", "duplicates"]
    return {
        "error_type": "edge_case_miss",
        "missed_cases": edge_cases,
        "remediation": f"edge_case_drill_{edge_cases}"
    }
```

## Track C: LeetCode bridge (should-have)
1. Canonical deep-links in topic/problem cards
2. Suggested “next LeetCode” card in session summary
3. Lightweight solved-result import fallback (manual trigger)

## Track D: Extension spike (if time remains)
1. Chrome extension proof-of-concept
2. User-consented capture of:
   - problem slug/title
   - language
   - acceptance/result status
3. Send metadata to NeuralDSA backend webhook endpoint

## Track E: Deployment (must-have)
1. Frontend deploy (Vercel)
2. Backend deploy (Render/Railway)
3. Runner deploy as separate service/container
4. Env wiring and health checks

---

## 5. Sandbox design and hardening plan

## Scope
Support initial languages:
- Python
- JavaScript (Node)
- Java
- C++
- C
- Go

## Runner architecture
- API endpoint receives code + language + testcases.
- Backend enqueues execution request.
- Runner executes in isolated Docker container.
- Returns structured result:
  - compile status
  - passed/failed tests
  - runtime, memory estimate
  - stderr/stdout snapshots

## Security and safety controls (MVP-hardening)
1. Per-run container (ephemeral)
2. CPU and memory limits
3. Strict timeout
4. Network disabled
5. File system restrictions (temp working dir only)
6. Max output size caps
7. Kill-switch for runaway processes
8. Language-specific compile/run command allowlist

## Reliability controls
1. Queue with execution status states
2. Retry only for infra failures, not user code failures
3. Structured error codes
4. Health endpoint for runner
5. Basic observability logs (job_id, language, duration, outcome)

## API contracts (high-level)
1. `POST /runner/run` (sample tests)
2. `POST /runner/submit` (hidden tests + final verdict)
3. `GET /runner/job/{id}` (if async mode used)
4. `GET /runner/health`

---

## 6. Agent personalization upgrades

## New signals
- pass rate per pattern
- compile error frequency
- average attempts per problem
- hint dependency trend
- time-to-first-correct

## Agent behavior upgrades
1. If compile errors repeat -> switch to debugging coach mode.
2. If hidden tests fail on edge cases -> generate edge-case drill.
3. If complexity is poor but logic correct -> complexity coaching path.
4. If repeated failures on advanced topic -> prereq pivot.

## UX outputs
- “Why this recommendation” explanation
- “What blocked you today” insight
- “One fix to focus next” actionable advice

---

## 7. LeetCode integration plan

## Phase 1 (MVP-safe)
- Deep-link only, strongly integrated in journey (not random redirect).
- Each problem card shows:
  - in-app version
  - related LeetCode version
  - expected pattern and difficulty

## Phase 2 (if time left)
- Browser extension spike:
  - content script on LeetCode problem/submission pages
  - parse minimal metadata
  - user-consented POST to NeuralDSA sync endpoint
- Keep this optional; demo must not depend on it.

---

## 8. Delivery sequence

1. Sandbox runner minimal path (Python + JS first)
2. Test-case engine + Run/Submit backend integration
3. Workspace UI end-to-end
4. Telemetry persistence
5. Agent code-coach behaviors
6. Add remaining languages (Java/C++/C/Go)
7. LeetCode deep-link layer
8. Deploy frontend/backend/runner
9. Extension spike (only if all above stable)

---

## 9. Success criteria for demo

1. User can solve in-app problem and get real verdicts.
2. Agent gives contextual help based on run/submit results.
3. Mastery updates visibly after submissions.
4. App recommends next problem/topic with clear reason.
5. User can jump to related LeetCode problem in one click.
6. Full flow runs reliably in deployed environment.

---

## 10. Out of scope for this hackathon

- Full production-grade multi-tenant security platform
- Massive language/runtime matrix beyond initial 5-6
- Advanced anti-cheat/plagiarism system
- Mandatory LeetCode extension dependency

---

## 11. API contracts (detailed)

### Runner Service Endpoints

#### `POST /runner/run`
**Purpose**: Execute code against sample tests (non-blocking feedback).

**Request**:
```json
{
  "code": "def solution(nums): return sum(nums)",
  "language": "python",
  "problem_id": "arrays_sum",
  "testcases": [
    {
      "id": "test1",
      "input": "[1, 2, 3]",
      "expected_output": "6",
      "visible": true
    }
  ],
  "timeout_ms": 5000,
  "memory_mb": 256
}
```

**Response**:
```json
{
  "job_id": "run_uuid_12345",
  "status": "completed",
  "results": [
    {
      "testcase_id": "test1",
      "passed": true,
      "output": "6",
      "runtime_ms": 2,
      "memory_mb": 1.2
    }
  ],
  "compile_error": null,
  "execution_error": null,
  "verdict": "all_passed"
}
```

#### `POST /runner/submit`
**Purpose**: Execute code against full test suite (sample + hidden), return final verdict.

**Request** (same structure as `/run`, but response includes hidden test aggregate):
```json
{
  "code": "...",
  "language": "python",
  "problem_id": "arrays_sum",
  "submission_id": "sub_uuid_xyz"
}
```

**Response**:
```json
{
  "submission_id": "sub_uuid_xyz",
  "status": "completed",
  "sample_results": [...],
  "hidden_results_summary": {
    "passed": 8,
    "total": 10,
    "failed_ids": ["hidden_test_3", "hidden_test_7"]
  },
  "verdict": "partial_accepted",
  "runtime_percentile": 75,
  "memory_percentile": 65,
  "compile_error": null,
  "execution_error": null
}
```

#### `GET /runner/job/{job_id}`
**Purpose**: Poll async job status (if needed for long-running jobs).

**Response**:
```json
{
  "job_id": "run_uuid_12345",
  "status": "running|completed|failed",
  "progress_percent": 50,
  "results": null  // populated when status=completed
}
```

#### `GET /runner/health`
**Purpose**: Health check for deployment and load balancer.

**Response**:
```json
{
  "status": "healthy",
  "uptime_seconds": 3600,
  "active_jobs": 2,
  "queue_size": 5,
  "last_job_completed_at": "2025-04-24T12:34:56Z"
}
```

### Backend Session Service Enhancements

#### `POST /session/stream` (enhanced message format)

New message types supported:

**Agent decision event (when agent selects a mode)**:
```json
{
  "type": "agent_mode",
  "mode": "code_coach|debug|explain|complexity|prerequisite_pivot",
  "reason": "User stuck on runtime error for 2 minutes",
  "context": {
    "compile_errors": [...],
    "failed_tests": [...],
    "hint_count_this_session": 2
  }
}
```

**Submission result event (after runner returns)**:
```json
{
  "type": "submission_result",
  "verdict": "accepted|partial|runtime_error|compile_error",
  "pass_rate": 0.8,
  "mastery_delta": "+0.12",
  "feedback": "Good logic, optimize for edge cases next.",
  "next_action": "try_stretch_problem|concept_review|move_next_topic"
}
```

#### `POST /session/evaluate` (enhanced for code submissions)

**Request**:
```json
{
  "session_id": "sess_xyz",
  "submission_id": "sub_uuid",
  "runner_verdict": {
    "verdict": "partial_accepted",
    "pass_rate": 0.8,
    "runtime_ms": 45,
    "memory_mb": 12.5
  },
  "code_snippet": "def solution(...): ...",
  "language": "python",
  "attempt_number": 2
}
```

**Response**:
```json
{
  "correct": false,
  "partial_credit": 0.8,
  "errors": ["Edge case: empty array not handled"],
  "missing_concepts": ["boundary conditions"],
  "complexity_note": "Time: O(n) correct. Space: O(n) can be O(1).",
  "next_micro_drill": "arrays_edge_cases_2",
  "feedback": "8 of 10 tests passed. Handle empty input next.",
  "hint_for_retry": "Check: what if the input has 0 or 1 element?"
}
```

---

## 11.5. Firebase Schema for Cognitive Modeling

Extend the existing Firestore schema to capture behavioral signals:

```
/users/{uid}
  /sessions/{sessionId}
    - topicId: string
    - startedAt: timestamp
    - endedAt: timestamp
    - questionsAsked: number
    - correctAnswers: number
    - hintsUsed: number
    - masteryDelta: number
    - cognitiveInsights: {
        "hesitation_detected": bool,
        "error_types": ["edge_case_miss", "pattern_mismatch"],
        "avg_response_time_ms": 45000,
        "confidence_score": 0.35,
        "calibration_alert": "overconfident"  // or "underconfident" or null
      }
    - messages: Message[]

/users/{uid}/submissions/{submissionId}
  - problemId: string
  - timestamp: timestamp
  - language: string
  - attempt_number: number
  - timing: {
      "time_to_first_keystroke_ms": 2150,
      "time_to_submit_ms": 45000,
      "paused_mid_attempt": bool,
      "pause_count": number,
      "false_starts": number
    }
  - verdict: {
      "correct": bool,
      "pass_rate": number,  // 0.0-1.0
      "error_type": string, // "edge_case_miss", "pattern_mismatch", etc.
      "runtime_ms": number,
      "memory_mb": number
    }
  - cognitive_signals: {
      "confidence_score": 0.35,
      "confidence_explanation": "overconfident",
      "speed_vs_avg": 1.5,
      "mastery_inferred": "surface_knowledge"
    }
  - agent_decision: {
      "action": "SCAFFOLD",
      "reason": "Edge case miss. Isolate the gap first.",
      "next_problem_id": "lc_3_substring_edge_cases"
    }

/users/{uid}/knowledgeModel
  - topics: {
      "[topicKey]": {
        "mastery": 0.75,
        "confidence": 0.65,
        "attempts": 14,
        "correct": 11,
        "avgTimeMs": 45000,
        "lastSeen": "2025-04-24T10:00:00Z",
        "hesitationCount": 3,        // NEW
        "hintRequests": 1,
        "errorTypeCounts": {          // NEW
          "edge_case_miss": 2,
          "pattern_mismatch": 1,
          "off_by_one": 0
        },
        "speedSignature": {            // NEW
          "fastCorrect": 8,            // fast + correct = deep mastery
          "slowCorrect": 2,            // slow + correct = surface knowledge
          "fastWrong": 1,              // fast + wrong = pattern matching
          "slowWrong": 0               // slow + wrong = major gap
        },
        "decayAppliedAt": "2025-04-25T08:00:00Z",  // last time Ebbinghaus decay ran
        "daysSinceLastAttempt": 0
      }
    }
  - cognitiveReadinessScore: 62        // NEW: 0-100 interview prep score
  - readinessBreakdown: {               // NEW
      "problemCoverage": 0.6,
      "patternRecognition": 0.78,
      "speedUnderPressure": 0.65,
      "consistency": 0.82
    }
  - learningStyle: "visual",            // detected over time
  - hesitationProfile: {                // NEW: user's typical hesitation pattern
      "avg_time_to_first_keystroke_ms": 1200,
      "typical_pause_pattern": "multiple_pauses",  // or "smooth", "none"
      "confidence_match": "overconfident"  // what is their typical calibration?
    }
  - errorPreference: {                  // NEW: what mistakes does this user tend to make?
      "most_frequent_error_type": "edge_case_miss",
      "error_distribution": {
        "edge_case_miss": 0.4,
        "pattern_mismatch": 0.3,
        "off_by_one": 0.2,
        "complexity_confusion": 0.1
      }
    }
```

---

## 12. Sandbox runner implementation blueprint

### Docker Compose setup (runner service)

```yaml
version: '3.9'

services:
  runner:
    build:
      context: ./runner
      dockerfile: Dockerfile
    ports:
      - "9000:9000"
    environment:
      RUNNER_PORT: 9000
      RUNNER_ENV: production
      LOG_LEVEL: info
      MAX_TIMEOUT_MS: 10000
      MAX_MEMORY_MB: 512
    networks:
      - runner-net
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:9000/health"]
      interval: 10s
      timeout: 5s
      retries: 3
    restart: unless-stopped

networks:
  runner-net:
    driver: bridge
```

### Runner Dockerfile (multi-stage for compact image)

```dockerfile
# Base: Python + Node + Java + C++ toolchain
FROM ubuntu:22.04 as base
RUN apt-get update && apt-get install -y \
    python3 python3-pip \
    nodejs npm \
    openjdk-11-jdk-headless \
    build-essential g++ gcc \
    golang-1.21 \
    curl \
    && rm -rf /var/lib/apt/lists/*

# App layer
FROM base
WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt
COPY . .
EXPOSE 9000
CMD ["python3", "-m", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "9000"]
```

### Core execution function (Python pseudocode)

```python
import docker
import tempfile
import os
import signal

async def execute_code(code: str, language: str, testcases: list, timeout_ms: int = 5000):
    """
    Isolated execution in ephemeral Docker container.
    """
    client = docker.from_env()
    
    # Write code to temp file
    with tempfile.NamedTemporaryFile(mode='w', suffix=get_ext(language), delete=False) as f:
        f.write(code)
        code_path = f.name
    
    try:
        # Prepare compile/run commands per language
        compile_cmd = get_compile_cmd(language, code_path)
        run_cmd = get_run_cmd(language, code_path)
        
        # Create container with restrictions
        container = client.containers.create(
            image=f"neuraldsa-runner:{language}",
            volumes={os.path.dirname(code_path): {'bind': '/tmp/work', 'mode': 'rw'}},
            environment={"TIMEOUT_MS": str(timeout_ms)},
            cpu_shares=256,
            mem_limit=f"{memory_mb}m",
            network_mode="none",  # No network access
            command=f"bash -c '{compile_cmd} && {run_cmd}'",
            timeout=timeout_ms / 1000,
        )
        
        # Execute with timeout and capture output
        container.start()
        exit_code, output = container.wait(timeout=timeout_ms / 1000), container.logs()
        
        # Parse output against testcases
        results = parse_test_output(output, testcases)
        
        return {
            "verdict": "all_passed" if all(r["passed"] for r in results) else "partial_passed",
            "results": results,
            "compile_error": None if exit_code == 0 else extract_error(output)
        }
    finally:
        container.remove(force=True)
        os.unlink(code_path)
```

---

## 13. Browser extension spike (optional, post-MVP)

### Manifest (manifest.json)

```json
{
  "manifest_version": 3,
  "name": "NeuralDSA LeetCode Sync",
  "version": "0.1.0",
  "permissions": ["tabs", "scripting", "activeTab"],
  "host_permissions": ["https://leetcode.com/*"],
  "background": {
    "service_worker": "background.js"
  },
  "content_scripts": [
    {
      "matches": ["https://leetcode.com/problems/*/"],
      "js": ["content.js"]
    }
  ],
  "action": {
    "default_popup": "popup.html"
  }
}
```

### Content script (content.js) — minimal capture

```javascript
// Capture metadata after user submits on LeetCode
document.addEventListener('submission_success', (e) => {
  const problem_slug = extract_problem_slug_from_url();
  const language = extract_language_from_editor();
  const status = document.querySelector('[data-result]')?.textContent; // Accepted/Wrong

  chrome.runtime.sendMessage({
    type: 'capture_submission',
    payload: {
      problem_slug,
      language,
      status,
      timestamp: new Date().toISOString()
    }
  });
});
```

### Background service worker (background.js)

```javascript
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'capture_submission') {
    const { problem_slug, language, status } = request.payload;
    
    // Send to NeuralDSA backend (user must be logged in)
    fetch('https://your-backend.com/sync/leetcode', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${get_stored_token()}`  // From extension storage
      },
      body: JSON.stringify({
        leetcode_slug: problem_slug,
        language,
        solved: status === 'Accepted',
        timestamp: new Date().toISOString()
      })
    });
  }
});
```

**Note**: This is a spike only. For hackathon, prioritize in-app sandbox; extension is a follow-up feature if judges want LeetCode auto-sync demo.

---

## 14. Deployment & environment setup

### Frontend (Vercel)

**vercel.json**:
```json
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "env": {
    "VITE_FIREBASE_API_KEY": "@firebase_api_key",
    "VITE_FIREBASE_PROJECT_ID": "@firebase_project_id",
    "VITE_BACKEND_URL": "@backend_url"
  }
}
```

**Deployment**:
1. Connect Git repo to Vercel.
2. Add env vars in Vercel dashboard.
3. Deploy on every push to `main`.

### Backend (Render or Railway)

**Render.yaml** (or Railway.yaml):
```yaml
services:
  - name: neuraldsa-api
    runtime: python
    buildCommand: pip install -r requirements.txt
    startCommand: uvicorn backend.main:app --host 0.0.0.0 --port $PORT
    env:
      - key: GEMINI_API_KEY
        value: $GEMINI_API_KEY
      - key: FIREBASE_SERVICE_ACCOUNT_JSON
        value: $FIREBASE_SERVICE_ACCOUNT_JSON
      - key: ALLOWED_ORIGINS
        value: https://your-frontend.vercel.app
    healthCheck:
      path: /health
      interval: 60
```

**Deployment steps**:
1. Push to Git repo (Render/Railway auto-trigger on main branch).
2. Set secrets in platform dashboard.
3. Confirm deployment and test `/health` endpoint.

### Runner service (separate host / sidecar)

**Option A**: Single compute instance (simplest for hackathon)
- Deploy runner on same host as backend or on a lightweight Ubuntu instance.
- Use Docker Compose as shown in section 12.
- Expose on internal network + firewall backend service only.

**Option B**: As a sidecar in container orchestration (if using K8s)
- Not recommended for hackathon; keep simple.

**Env for runner**:
```
RUNNER_PORT=9000
LOG_LEVEL=info
MAX_TIMEOUT_MS=10000
MAX_MEMORY_MB=512
```

### Environment variables checklist

**Frontend**:
- `VITE_FIREBASE_API_KEY` ✓
- `VITE_FIREBASE_AUTH_DOMAIN` ✓
- `VITE_FIREBASE_PROJECT_ID` ✓
- `VITE_FIREBASE_APP_ID` ✓
- `VITE_BACKEND_URL` (e.g., `https://neuraldsa-api.render.com`)

**Backend**:
- `GEMINI_API_KEY` (from Google AI Studio)
- `FIREBASE_SERVICE_ACCOUNT_JSON` (stringified key JSON)
- `ALLOWED_ORIGINS` (e.g., `https://neuraldsa.vercel.app`)
- `RUNNER_SERVICE_URL` (e.g., `http://localhost:9000` for local, or external for remote)

**Runner**:
- `RUNNER_PORT=9000`
- `LOG_LEVEL=info`

---

## 15. Timeline estimate (for planning)

### Phase 1: Core sandbox (days 1-2)
- [ ] Set up runner Docker image (Python + JS).
- [ ] Implement `/runner/run` endpoint (minimal, no hidden tests).
- [ ] Wire backend to runner; test end-to-end with one sample problem.
- **Checkpoint**: User can write code, click Run, see test verdict.

### Phase 2: Full verdict engine (days 2-3)
- [ ] Add hidden test support to runner.
- [ ] Implement `/runner/submit` endpoint.
- [ ] Add structured telemetry persistence (submissions table).
- [ ] Build session UI components (Run/Submit buttons, verdict strip).
- **Checkpoint**: User can submit and see pass rate + mastery update.

### Phase 3: Agent upgrades (days 3-4)
- [ ] Integrate submission telemetry into agent decision loop.
- [ ] Implement code-coach modes (explain, debug, complexity).
- [ ] Add stuck detection + prerequisite pivot triggers.
- [ ] Test end-to-end: fail, get hint, mastery updates.
- **Checkpoint**: Agent gives context-aware feedback post-submission.

### Phase 4: Language expansion (day 4)
- [ ] Add Java, C++, C, Go to runner image.
- [ ] Test compile/run for each language.
- **Checkpoint**: Full 6-language support.

### Phase 5: LeetCode integration (day 5)
- [ ] Curate deep-links for all topics/problems.
- [ ] Add "Solve on LeetCode" card to problem workspace.
- [ ] Optional: extension spike (low priority for demo).
- **Checkpoint**: User can jump to LeetCode in one click.

### Phase 6: Deploy + hardening (days 5-6)
- [ ] Deploy frontend to Vercel.
- [ ] Deploy backend to Render/Railway.
- [ ] Deploy runner service.
- [ ] Set up env vars and test all flows.
- [ ] Create demo data seed (sample user, solved problems).
- [ ] Write demo runbook.
- **Checkpoint**: Full product live and judges can test.

### Phase 7: Final hardening (day 6)
- [ ] Load test runner under concurrent submissions.
- [ ] Stress test WebSocket session concurrency.
- [ ] Record demo video / practice demo walk-through.
- [ ] Fallback testing (what if runner is down?).
- **Checkpoint**: Ready for judging.

---

## 16. Demo script and "money shot" sequence

### Pre-demo setup
1. Have a judge-ready account pre-seeded (onboarded, some solved problems).
2. Pick one topic with a known good problem (e.g., "Two Pointers — Container with Most Water").
3. Have the runtime ready to go (no cold start delay).
4. Have a second tab open to LeetCode for deep-link verification.

### Demo flow (10-12 minutes)

**Segment 1: Personalization** (2 min)
1. Open dashboard.
2. Show the mind map with mastery colors and recommended next topic.
3. Click on the topic — show the "why this" explanation.
4. Highlight the agentic reasoning: "You mastered arrays, now ready for two pointers."

**Segment 2: Interactive problem** (5 min)
1. Click "Start" on recommended problem.
2. Show the problem statement, examples, constraints in workspace.
3. Write code in editor (have stub or half-complete solution ready).
4. Click "Run" — show sample test verdicts in real-time.
5. Fix the code, submit.
6. **Money shot**: After submission, show:
   - Pass rate (e.g., "8 of 10 tests passed").
   - Mastery badge updating (yellow → light green).
   - Agent feedback: "Good logic. Edge case: handle empty arrays."
   - Mastery delta visibly updated on dashboard mind map in background.

**Segment 3: Agent adaptation** (2 min)
1. Show a failed submission.
2. Demonstrate agent stuck-detection: "I've noticed you're struggling with binary search within this problem. Let me explain the concept first."
3. Show agent pivots to a prerequisite micro-lesson.
4. Complete micro-lesson, return to original problem, retry.

**Segment 4: LeetCode bridge** (1 min)
1. In session summary, show "Solve full version on LeetCode" deep-link.
2. Click it → lands on LeetCode problem page for same problem.

**Segment 5: Roadmap** (1 min)
1. Open roadmap page.
2. Show personalized topic ordering, completed nodes, locked nodes.
3. Explain: "Roadmap recomputes after each session to adapt to your growth."

**Fallback**: If runner is slow or fails:
- Have a pre-canned verdict JSON ready (show mock submission result).
- Explain: "In production, this is fully async with job queue; for demo, we're using cached results to show the full flow without latency."

---

## 17. Success metrics (for post-demo reflection)

1. **Engagement**
   - Time to first problem solve: < 2 min from landing.
   - Submit action completion rate: >= 80% of sessions.
   - Return session rate: >= 50% (multi-session retention).

2. **Learning signal clarity**
   - Mastery updates visible after each submission.
   - Roadmap reorders visibly after 3+ submissions.
   - Agent recommends prereq correctly >= 90% of test cases.

3. **Reliability**
   - Session uptime: >= 99% (for hackathon, no actual downtime during demo).
   - Verdict latency: < 3 sec (Run), < 10 sec (Submit).
   - No JSON parse errors in agent output (all responses valid).

4. **Feature completeness for judges**
   - In-app sandbox working (5+ languages).
   - Agent making adaptive decisions (visible in feedback).
   - LeetCode deep-links functional.
   - Deployment clean (no manual restarts needed).

---

## 18. Risk mitigation and fallbacks

### Risk: Runner container takes > 10 sec
**Mitigation**: Pre-warm a container pool during demo, or cache verdicts for known problems.
**Fallback**: Show pre-recorded verdict; explain: "Actual queue is processing your code; showing cached result for demo flow."

### Risk: WebSocket drops mid-session
**Mitigation**: Implement auto-reconnect with session state recovery (session ID persistent).
**Fallback**: Reload page; session persists in Firestore, reload restores state.

### Risk: Gemini rate-limit hit (15 RPM free tier)
**Mitigation**: Only one active session per UID; batch agents decisions.
**Fallback**: Serve pre-computed agent decisions for demo problems; log rate-limit hit.

### Risk: Firestore cold start on first query
**Mitigation**: Pre-seed demo data; index common queries.
**Fallback**: Show loading state with message: "Fetching your knowledge model..." (UX over speed).

### Risk: Extension blocks if LeetCode changes DOM
**Mitigation**: Make extension optional; demo is not dependent on it.
**Fallback**: Manual "Import LeetCode result" button in settings (fallback UX).

---

## 19. Team checklist (pre-demo)

- [ ] Frontend deployed and accessible.
- [ ] Backend deployed and responding to `/health`.
- [ ] Runner service deployed and tested with all 6 languages.
- [ ] Firebase project set up with demo user data seeded.
- [ ] All env vars configured on all platforms.
- [ ] WebSocket connection tested (no SSL/CORS issues).
- [ ] One end-to-end session tested: onboard → solve → mastery update → roadmap reorder.
- [ ] Mock backup data for runner verdicts (in case of outage).
- [ ] Demo script printed/memorized.
- [ ] Browser extensions (if demoing) tested on latest Chrome/Edge.
- [ ] Judges' test accounts created and pre-seeded.
- [ ] Fallback demo video recorded (in case of live demo failure).

---

## 20. Post-hackathon roadmap (future work)

1. **Extension maturation**: Full LeetCode integration with auto-sync reliability.
2. **Advanced languages**: Rust, Kotlin, Scala, etc.
3. **Collaborative features**: Study groups, peer review.
4. **Content expansion**: Coding interview prep, system design.
5. **Monetization**: Premium coaching, corporate licensing.


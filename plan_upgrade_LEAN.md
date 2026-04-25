# NeuralDSA Full Upgrade Plan (Agent-First, Not Quiz-First)

## 1. Product North Star

NeuralDSA must behave as a tutor agent, not a question-answer bot:

- Not a chatbot that answers DSA questions.
- An agent that builds a model of your brain.
- Tracks every answer, hesitation, and wrong turn.
- Continuously updates what it thinks you know.
- Autonomously decides what to teach next, how hard to push, when to hint, and when to move on.
- Learns you across sessions, not only inside one session.

This plan upgrades the current prototype into a full website with persistent cognition modeling, autonomous curriculum control, and explainable agent behavior.

---

## 2. Current Implementation Snapshot (What Exists Now)

### 2.1 Frontend implemented

- Auth + routing: landing, onboarding, dashboard, session, roadmap, profile (`frontend/src/App.tsx`).
- Knowledge model client schema with mastery/confidence/attempt metrics (`frontend/src/lib/types.ts`).
- Session page with:
  - streaming tutor messages
  - answer input (text/code/mcq/complexity)
  - hint button
  - instant evaluation strip
  - difficulty badge
  - pattern tag label
  - prerequisite gap banner (`frontend/src/pages/Session.tsx`)
- Brain map + roadmap graph using React Flow with lock/unlock by prerequisites (`Dashboard.tsx`, `Roadmap.tsx`, `MasteryNode.tsx`).
- Radar + heatmap components (`SkillRadar.tsx`, `SessionHeatmap.tsx`).
- WebSocket session hook with timing to answer (`useTutorSession.ts`).

### 2.2 Backend implemented

- FastAPI app with auth/user/session routers (`backend/main.py`).
- WebSocket session loop with:
  - action handling (`start_topic`, `answer`, `hint_request`, `end`)
  - answer evaluation call
  - streamed tutor response call
  - mastery update and emit
  - prerequisite pivot and emit (`backend/routers/session.py`)
- Knowledge model + roadmap logic + mastery update (`backend/models/knowledge.py`).
- Agent decision engine (actions like `ask_question`, `pivot_to_prereq`, `increase_difficulty`, `end_session`) (`backend/services/agent.py`).
- LLM integration layer currently in `services/gemini.py`.
- Firestore and demo-mode persistence (`services/firestore.py`, `services/demo_store.py`).
- Canonical DSA problem catalog with pattern tags (`data/problem_catalog.py`).

### 2.3 Summary

The prototype already has the skeleton of an adaptive tutor. Major gaps are behavioral intelligence depth, long-horizon memory features, explicit decision modes, and judge-visible cognitive metrics.

---

## 3. Gap Matrix (Requested vs Current)

| Capability | Status | Gap to close |
|---|---|---|
| Learner model updates each answer | Partial | Expand from 1D mastery to 5D brain model + behavioral signals |
| 12-node dependency graph sidebar | Partial | Graph exists but uses larger taxonomy; add focused 12-node curriculum mode for demo |
| 6-mode agent loop (ASSESS, SCAFFOLD, REINFORCE, ADVANCE, EXPLAIN, CONTINUE) | Missing | Current action enum differs; add explicit mode state machine and log |
| Brain map with live glow/rings | Partial | Current node visuals basic; add ring layers and animated mastery transitions |
| Agent log with timestamp + reasoning | Partial | Internal decision exists; no user-visible full log panel |
| One-hint-per-question + model flag | Partial | Hint exists; enforce single hint and persist hint usage metadata |
| Explanation after every answer | Partial | Evaluation strip exists; move to personalized LLM explanation each answer |
| Streak (last 10 answers) | Partial | Basic streak idea exists; add explicit rolling visualization |
| Session stats | Partial | Basic counts exist; add richer stats model and UI card cluster |
| Difficulty badges easy/medium/hard | Partial | Current numeric D-level; map to explicit labels |
| Manual concept jump to unlocked node | Done | Keep and integrate with new priority queue |
| Persistent memory across sessions | Partial | Firestore model exists; add trajectory, behavior history, recurrence memory |
| Proactive hint trigger at 45s | Missing | Current hint is user-initiated only |
| True dynamic question selection priority queue | Missing | Current flow question-by-question, no multi-factor queue engine |
| Hesitation timer with first-click vs answer timing | Missing | Only answer duration captured |
| Error fingerprinting taxonomy | Missing | Current eval returns generic errors only |
| Forgetting curve + spaced repetition requeue | Partial | Time decay in mastery exists; no queue-driven spaced repetition policy |
| Pre-interview readiness score + subscores | Missing | No global readiness metric |
| Dynamic Claude explanations + hints | Missing | Must replace/abstract current LLM path |
| Confidence calibration meter | Missing | No confidence-vs-accuracy mismatch metric |
| Session report card (LLM personalized) | Partial | Session summary exists; not full personalized report card |
| Concept unlock animation + MASTERED declaration | Missing | Locking exists; no milestone animation/announcement |
| Pattern mastery tracking | Partial | Pattern tag on question exists; no separate mastery model |
| Metacognitive nudges | Missing | No behavior-triggered nudges |
| Live Thought Trace | Missing | No reasoning input/evaluation loop |

---

## 3.1 Core-purpose fitness recheck (agentic + context-aware + DSA-first)

Verdict: the plan is directionally correct for the core purpose, but needs explicit anti-quiz guardrails and reduced graph cognitive load.

### Must-have guardrails to preserve "agent, not quiz app"

1. The agent must always keep and update a persistent learner state across sessions.
2. Curriculum progression must be queue-driven by learner model, not static question order.
3. Every answer event must produce a model update and a decision rationale.
4. The UI must prioritize tutor guidance and progression insights over answer buttons.
5. Coding sandbox must be integrated into the same learner model and decision loop.

### DSA-learning perspective guardrails

1. Track both concept mastery and pattern mastery (pattern recognition is interview-critical).
2. Enforce prerequisite remediation when a failure traces to a dependency gap.
3. Surface misconception type, not only correctness.
4. Blend conceptual and coding questions based on mastery band.
5. Revisit stale topics through forgetting-curve requeue.

These are now treated as non-negotiable acceptance criteria in this plan.

---

## 4. Target Architecture Upgrade

## 4.1 Brain model (multi-dimensional)

Upgrade topic stats from 1D mastery to:

1. Knowledge
2. Speed
3. Confidence
4. Consistency
5. PatternRecognition

Add behavior metrics:
- hesitationMs
- firstInteractionMs
- overconfidenceFlags
- surfaceKnowledgeFlags
- misconceptionHistogram
- skipCount
- hintAvoidanceCount

Add pattern-level stats:
- `patternStats[patternId]` with same 5 dimensions (lightweight version).

## 4.2 Persistent memory model

Persist in Firestore:

- `users/{uid}/brainModel/current` (canonical live model)
- `users/{uid}/sessions/{sessionId}` (full session summary + report)
- `users/{uid}/events/{eventId}` (answer/hint/nudge/decision telemetry)
- `users/{uid}/agentState/current` (active queue, last decision mode, recap memory)

This ensures restart continuity: weak spots, confidence mismatch trends, recent misconceptions, and pending review concepts survive across sessions.

## 4.3 Dynamic curriculum engine

Introduce a question priority queue score:

`priority = w1*lowKnowledge + w2*errorRecurrence + w3*forgettingDecay + w4*difficultyRamp + w5*goalWeight + w6*patternGap`

Queue updates after every answer and every decay tick.
Top queue item becomes next question unless user manually selects unlocked concept.

## 4.4 Agent decision state machine (required 6 modes)

Canonical mode layer:

- ASSESS: calibrate current concept/pattern.
- SCAFFOLD: break down after misconception.
- REINFORCE: additional reps for unstable mastery.
- ADVANCE: raise difficulty or unlock next.
- EXPLAIN: targeted explanation for detected misconception.
- CONTINUE: keep trajectory when no pivot required.

Map lower-level actions (ask_question, give_hint, etc.) under these modes.

## 4.5 LLM service abstraction

Refactor `services/gemini.py` into `services/llm_client.py` with provider strategy:
- `ClaudeProvider` (primary for this upgrade)
- optional `GeminiProvider` fallback

All explanation, hint, thought-trace, and report-card generation routes through provider-agnostic interfaces.

---

## 5. Feature Implementation Blueprint

## 5.1 Core cognitive features

### A. Hesitation Timer
- Frontend: add countdown ring around active question.
- Track timestamps:
  - question_rendered_at
  - first_input_at
  - submitted_at
- Backend: classify
  - fast+wrong => `overconfidence_flag`
  - slow+correct => `surface_knowledge_flag`
- Feed flags into mode transitions and nudges.

### B. Error Fingerprinting
- Add misconception taxonomy:
  - optimization_blindness
  - complexity_confusion
  - space_time_mixup
  - off_by_one
  - pattern_overfitting
  - edge_case_blindness
- Evaluation response must include `error_fingerprint`.
- Persist per concept and globally; show in feedback strip and report card.

### C. Forgetting Curve / Spaced Repetition
- Track `questions_since_seen` and `last_seen_question_index` per concept.
- Decay policy: if unseen beyond threshold, apply small mastery decay.
- Auto enqueue review question before severe decay.

### D. Pre-Interview Readiness Score (0-100)
- Live score + sub-scores:
  - coverage
  - accuracy
  - speed
  - consistency
  - recency
- UI: always-visible widget on dashboard + session header mini-chip.
- Persist history to show trajectory.

### E. Dynamic Claude Explanations + Hints
- Replace static explanation/hint generation with Claude calls.
- Inputs: concept, pattern, answer, thought trace, error fingerprint, recent history, user profile.
- Outputs:
  - one concise explanation
  - one bounded hint
  - remediation suggestion

### F. Confidence Calibration Meter
- Compute confidence proxy from speed and answer decisiveness.
- Compare with actual accuracy.
- Show per concept and global gap:
  - positive gap => overconfidence
  - negative gap => underconfidence

### G. Session Report Card
- Trigger at end-of-session (or 10-question checkpoint).
- Personalized report:
  - strongest concept
  - biggest blind spot
  - recurring misconception
  - readiness movement
  - next focus plan

### H. Concept Unlock Animation + Mastery Declaration
- Threshold: mastery >= 0.80.
- Emit event `concept_mastered`.
- UI:
  - "ARRAYS: MASTERED"
  - dependent nodes light-up animation
  - graph expansion transition

### I. Pattern Tags + Pattern Mastery
- Every question carries pattern metadata.
- Track pattern mastery separately from concept mastery.
- Use pattern gaps in queue priority and recommendations.

### J. Metacognitive Nudges
- Rule engine checks behavior windows:
  - too fast repeated answers
  - repeated skips
  - low hint use despite repeated failures
- Inject short plain-English nudge in session stream.

### Extraordinary: Live Thought Trace
- Add optional "think aloud" input before final answer.
- Evaluate reasoning quality separately from final correctness.
- Detect:
  - right answer, wrong reasoning
  - coherent reasoning, execution mistake
- Return thought-process feedback and store `reasoning_gap` signal.

## 5.2 Agent autonomy features requested

1. Persistent memory across sessions -> covered by Firestore brain model + agentState.
2. Proactive hint trigger (45s stuck) -> timer-driven agent event and optional nudge/hint.
3. True dynamic question selection -> queue engine described above.
4. 5D brain model -> new schema and UI overlays.
5. Concept mastery declaration -> unlock event + animation.
6. Live Thought Trace -> dedicated reasoning channel.

## 5.3 NeetCode-style sandboxed solving experience (new required track)

NeuralDSA must also support full coding practice like NeetCode/LeetCode, but fused with the agent brain model.

### Sandbox capabilities
- In-browser editor with language switch (Python, Java, C++, JavaScript).
- Public test cases + hidden test cases per problem.
- "Run" (public tests only) and "Submit" (public + hidden tests).
- Execution result panel: passed/failed cases, runtime, memory, stderr.
- Custom input playground for quick experiments.
- Starter code templates + function signatures by language.

### Runtime architecture
- Preferred: remote judge service (Piston or Judge0) behind backend proxy.
- Backend endpoint group:
  - `POST /judge/run`
  - `POST /judge/submit`
  - `GET /judge/result/{submissionId}`
- Keep API keys and execution infra on backend only; frontend never calls judge directly.

### Problem page experience
- Statement, constraints, examples, pattern tags, hints, and expected complexity.
- Test case tab, submissions tab, editorial tab, agent guidance tab.
- Per-problem progress state:
  - not_started / attempted / solved / mastered
- Save drafts per user per problem.

### Agent + sandbox integration
- After each run/submit, feed telemetry into brain model:
  - compile errors
  - failed edge case types
  - retries
  - time-to-first-pass
- Agent then adapts:
  - picks next problem
  - offers targeted hint
  - flags misconception
  - updates readiness and confidence calibration.

### Why this matters
- Judges see a serious interview-prep platform, not a static quiz/chat interface.
- Users get both:
  - rigorous coding practice loop
  - adaptive tutor that learns behavior and reasoning.

## 5.4 Progressive-disclosure brain map (reduce intimidation)

Current full graph is too dense for first-time users. Replace with progressive disclosure.

### Disclosure levels

1. Level 0 (default): show only macro domains (Arrays, Strings, Trees, Graphs, DP, Core Patterns).
2. Level 1 (expand domain): show concept clusters within selected domain.
3. Level 2 (expand cluster): show atomic topics/patterns and unlock details.

### UX behavior

- Default dashboard opens at Level 0 with 6-8 nodes max.
- Expand only one branch at a time; collapse others automatically.
- Keep "Recommended next" branch expanded by default.
- Locked branches remain summarized; no full-node noise until unlocked.
- Node labels show mastery summary at higher levels (not raw topic list).

### Data model additions

- `nodeDepth`: 0 | 1 | 2
- `parentNodeId`: string | null
- `collapsed`: boolean
- `aggregateMastery`: number
- `childUnlockRatio`: number

### Visual intent

- This shifts perceived complexity from "huge syllabus map" to "guided progression map".
- Users feel progression instead of intimidation, while preserving full graph depth underneath.

---

## 6. Execution Plan (Implementation Order)

## Phase P0 - Data and agent foundation

- Extend model schemas in `backend/models/knowledge.py`.
- Add migration/default builders for new fields.
- Create `agent_mode` state machine in `services/agent.py`.
- Add queue scaffolding and scoring helpers.
- Introduce provider-agnostic `services/llm_client.py`.

## Phase P1 - Session intelligence loop

- Extend WebSocket payload contract in `routers/session.py`:
  - include first_input_ms, hesitation_ms, thought_trace.
- Add error fingerprint parsing in evaluation.
- Add proactive hint event logic.
- Add forgetting-curve updates and queue refresh.
- Persist telemetry events and updated brain model each turn.

## Phase P2 - UI transformation into full agent experience

- Session page:
  - hesitation ring
  - thought trace input
  - error fingerprint display
  - proactive hint prompt
  - mode badge + agent reasoning log panel
- Dashboard:
  - readiness score card + subscore bars
  - confidence calibration meter
  - streak of last 10 answers
  - trajectory sparkline
- Graph visuals:
  - ring/glow node layers
  - unlock animation and mastered flash
  - progressive disclosure map (L0 domain -> L1 clusters -> L2 topics)
  - auto-collapse non-active branches to keep cognitive load low

## Phase P3 - Reporting and polish

- Session report card generation endpoint/event.
- Profile: add persistent trajectory and misconception history.
- Roadmap: merge dynamic queue output with unlock logic.
- Final UX polish for "agent, not quiz app" behavior.

## Phase P4 - Deployment and production hardening (Vercel + Render)

- Frontend deployment on Vercel with environment separation (preview/prod).
- Backend deployment on Render Web Service with WebSocket support enabled.
- CORS and auth callback domains aligned to deployed origins.
- Health checks, log drains, and crash-restart validation.
- Production readiness pass for env vars, Firebase rules, and rate-limit behavior.

---

## 7. Required API and Event Contract Changes

### WebSocket inbound
- `answer`: `{ answer, thought_trace?, first_input_ms, time_ms }`
- `hint_request`: unchanged
- `heartbeat`: optional for inactivity detection
- `end`: unchanged

### WebSocket outbound (new/extended)
- `evaluation`: add `error_fingerprint`, `reasoning_gap`
- `agent_mode`: `{ mode, reason, ts }`
- `nudge`: `{ text, trigger }`
- `readiness_update`: `{ total, subscores }`
- `confidence_update`: `{ topic_gap, global_gap }`
- `concept_mastered`: `{ topic, unlocked_topics[] }`
- `report_card`: full session report payload

### REST additions
- `GET /user/readiness`
- `GET /user/trajectory`
- `GET /user/misconceptions`
- `GET /user/pattern_mastery`

---

## 8. Implementation Mapping by File (Concrete)

### Backend
- `backend/models/knowledge.py`
  - extend schemas, update formulas, add decay and readiness helpers
- `backend/services/agent.py`
  - introduce 6-mode state machine + nudge triggers
- `backend/services/gemini.py` -> replace or wrap with `backend/services/llm_client.py`
  - Claude-powered explanation, hint, thought-trace, report generation
- `backend/routers/session.py`
  - process new telemetry fields, emit new events, persist logs
- `backend/services/firestore.py`
  - persist new collections and expanded session reports
- `backend/data/problem_catalog.py`
  - ensure every question has strong pattern metadata and misconception hooks

### Frontend
- `frontend/src/pages/Session.tsx`
  - hesitation ring, thought trace box, mode log panel, proactive hint UI, fingerprint display
- `frontend/src/hooks/useTutorSession.ts`
  - collect first input timing, process new event types
- `frontend/src/store/useStore.ts`
  - include readiness, confidence calibration, streak window, agent log
- `frontend/src/lib/types.ts`
  - update WS contracts and new data shapes
- `frontend/src/components/MasteryNode.tsx`
  - glow/ring layering and mastered transitions
- `frontend/src/pages/Dashboard.tsx`
  - readiness card, confidence meter, trajectory visuals, richer stats
- `frontend/src/pages/Roadmap.tsx`
  - unlock animations + dynamic queue hints
- `frontend/src/pages/Profile.tsx`
  - long-term trajectory and misconception history

---

## 9. Definition of Done

- Agent loop explicitly uses 6 modes and logs each decision with reason + timestamp.
- Brain model is 5-dimensional and persists across sessions.
- Dynamic queue determines next question autonomously.
- Hesitation timer and first-input telemetry are active and influence decisions.
- Error fingerprint is shown to user and stored for remediation.
- Forgetting curve triggers spaced review questions.
- Readiness score is live, always visible, and decomposed into subscores.
- Confidence calibration metric is visible and actionable.
- Hints and explanations are dynamically generated per learner context.
- Session report card is personalized and generated automatically.
- Mastery crossing 80% triggers declaration + unlock animation.
- Pattern mastery is tracked independently.
- Metacognitive nudges fire on behavioral patterns.
- Live Thought Trace evaluates reasoning, not just final answer.
- Product demo clearly communicates: "agent that models your thinking," not "quiz app."

---

## 10. Demo Narrative (Judge-Facing)

1. Show live readiness and confidence calibration before starting.
2. Start a session and let hesitation timer run.
3. Submit a wrong fast answer -> show overconfidence flag + misconception fingerprint.
4. Show proactive hint trigger after stuck interval.
5. Provide thought trace with a correct answer but flawed reasoning -> show reasoning-gap feedback.
6. Reach mastery threshold -> trigger mastered declaration and unlock animation.
7. End session -> show personalized report card and next focus plan.

This creates a clear impression of a full tutor agent that models cognition and adapts continuously.

---

## 11. Deployment blueprint (required for implementation)

### 11.1 Frontend on Vercel

- Root: `frontend/`
- Build command: `npm run build`
- Output directory: `dist`
- Required environment variables:
  - `VITE_FIREBASE_API_KEY`
  - `VITE_FIREBASE_AUTH_DOMAIN`
  - `VITE_FIREBASE_PROJECT_ID`
  - `VITE_FIREBASE_STORAGE_BUCKET`
  - `VITE_FIREBASE_MESSAGING_SENDER_ID`
  - `VITE_FIREBASE_APP_ID`
  - `VITE_BACKEND_URL` (Render backend URL)

### 11.2 Backend on Render

- Root: `backend/`
- Runtime: Python
- Build command: `pip install -r requirements.txt`
- Start command: `uvicorn main:app --host 0.0.0.0 --port $PORT`
- Required environment variables:
  - `GEMINI_API_KEY` (or provider-specific key when migrated to Claude provider)
  - `FIREBASE_SERVICE_ACCOUNT_JSON`
  - `ALLOWED_ORIGINS=https://<vercel-app-domain>`

### 11.3 WebSocket + CORS deployment constraints

- Ensure WSS endpoint path remains `/session/stream`.
- Frontend must derive `ws://`/`wss://` from `VITE_BACKEND_URL`.
- Render idle behavior and reconnect flow must be handled in client hook.
- CORS allowlist must include both preview and production Vercel domains.

### 11.4 Release checklist (must pass before demo)

1. Google auth works on deployed domain.
2. Session WebSocket connects and streams first tutor response.
3. Brain model persists across browser refresh and new login.
4. Progressive map defaults to Level 0 and expands cleanly.
5. Run/Submit sandbox pipeline returns results on deployed stack.
6. Quota/rate-limit failures show graceful UX fallback.

### 11.5 Design guardrail

Do not use emojis anywhere in the product. Keep the current minimal UI and typography direction consistent across all new screens.

---

## 12. Agent Intelligence & Comprehensive Assessment System

This section adds the deep learning capability that makes NeuralDSA a true tutor agent, not a grading tool.

### 12.1 Pattern learning from user behavior

The agent must track and surface behavioral patterns across sessions:

**Tracked patterns:**
1. Speed vs accuracy profile per topic (overconfident, underconfident, consistent)
2. Mistake types and recurrence (off-by-one, complexity confusion, edge case blindness)
3. Time-to-mastery trajectory (fast learner, slow burn, plateau points)
4. Concept dependency insights (struggles with X always fail on Y)
5. Learning style evidence (visual explanations vs code examples preference)
6. Effort patterns (skip hints, retry immediately, take breaks)

**Storage:**
- `users/{uid}/patterns/` collection with per-topic behavior signatures
- Aggregate weekly/monthly trend summaries
- Misconception hotspot map (which concept clusters trip you up most)

### 12.2 Session summary & agent diagnosis

At end of session (or per checkpoint), agent generates:

**Structured feedback:**
- Biggest strength this session (highest accuracy on X pattern)
- Critical blind spot (lowest mastery concept)
- Misconception fingerprint (you consistently confuse Y about Z)
- Speed assessment (too fast / just right / too slow relative to peer baseline)
- Effort assessment (hint avoidance / overreliance / balanced)

**Interview readiness breakdown:**
- Topic coverage %: how many core DSA concepts have you touched
- Depth per concept: mastery distribution (many shallow vs few deep)
- Pattern recognition: can you name the technique before solving
- Code quality: optimal vs brute-force tendency
- Time performance: solve speed relative to expected range
- Consistency: same topic, different days, similar accuracy

**Report card content:**
```
Session Report for Arrays (Tue Apr 25)
─────────────────────────────────────
Strength: Two-pointer edge case handling (100% accuracy, 4/4)
Weakness: Sliding window bounds (25% accuracy, 1/4)
Misconception: You reset the window too early. Pattern: You confuse "until invalid" with "last valid"
Speed: Slow (avg 2m 15s vs peer 1m 30s) — suggests overthinking.

Readiness Impact:
- Arrays mastery: 0.62 (was 0.52)
- Pattern mastery: sliding_window 0.25 → two_pointer 0.85
- Interview likelihood (Arrays): medium confidence (you know basics, gaps on hard variants)

Next focus:
1. Sliding window edge cases (3 more problems)
2. Return to binary search (stale, decay triggered)
3. Try a medium DP problem (ready based on recursion mastery)
```

### 12.3 Hesitation fingerprint & answer quality

**Hesitation tracking:**
- Time from question render to first interaction (hesitation_ms)
- Time from first interaction to submission (working_ms)
- Speed classification: instant (< 10s), normal (10-120s), slow (> 120s)

**Answer quality scoring:**
After submission, score not just correctness but optimality:
```json
{
  "correct": true,
  "partial_credit": 1.0,
  "optimality_score": {
    "time_complexity": 0.9,  // O(n) vs O(n²) possible
    "space_complexity": 0.7, // uses extra space when not needed
    "code_clarity": 0.85,    // readable but could be cleaner
    "overall_optimality": 0.8
  },
  "hesitation_signal": {
    "speed_classification": "normal",
    "overconfidence_flag": false,
    "surface_knowledge_flag": false,
    "confidence_calibration": 0.92
  },
  "feedback": "Correct and nearly optimal solution. Time complexity is perfect. Slightly verbose, could use a temp variable to reduce duplication."
}
```

**Confidence calibration:**
- Compare answer speed + confidence cues with correctness.
- Flag if consistently fast + wrong (overconfidence).
- Flag if consistently slow + correct (underconfidence).
- Show gap: "Your confidence on Trees is 85% but accuracy is 55% — recalibrate."

### 12.4 Question-level lag detection

Agent must detect which specific questions/topics the user struggles with:

**Lag metrics:**
- Attempts per question before first pass
- Accuracy trend on that question type across sessions
- Time spent relative to typical
- Misconception recurrence on same question

**Display:**
- "You've failed LC 215 (Kth Largest) 3 times this month. The issue: you use heap when sorted array + partition is simpler. Try the partition approach once."
- "Linked list reversal questions: 60% accuracy (vs 80% peer average). You forget null pointers."

### 12.5 Assessment level & progression system

Instead of abstract mastery scores, show clear interview-relevant levels:

**Level system (0-4):**
- **Level 0 (Unfamiliar):** Never attempted or mastery < 0.2. Need to learn from scratch.
- **Level 1 (Aware):** Understand the concept, can solve with help. Mastery 0.2-0.4.
- **Level 2 (Familiar):** Solve most easy variants independently. Mastery 0.4-0.65.
- **Level 3 (Proficient):** Solve medium variants without help, understand trade-offs. Mastery 0.65-0.85.
- **Level 4 (Expert):** Solve hard variants, teach others, recognize variants instantly. Mastery >= 0.85.

**Display on every topic:**
- Current level badge
- Progress bar to next level
- "3 more problems to proficiency"
- "You're expert on Arrays/Two Pointers; medium on Sorting/Hashing"

### 12.6 DSA learning pathway (full round coverage)

Agent must guide users through a structured, comprehensive DSA curriculum:

**Phases:**
1. **Foundations** (Levels 0-1): Arrays, Strings, Hashing, Sorting, Recursion
2. **Intermediate** (Levels 1-2): Linked Lists, Stacks, Queues, Trees, Graphs Basics
3. **Advanced** (Levels 2-3): Binary Search, DP Intro, Graph Traversal, Union Find
4. **Expert** (Levels 3-4): Advanced DP, Trees (BST, Segment), String Algorithms, System Design prep

**Progression rules:**
- Can't jump to phase N+1 until phase N has ≥ 70% level 2+ coverage.
- Agent auto-recommends next phase milestone and reasons why.
- Spaced repetition ensures old topics don't decay while learning new ones.

**Interview simulation:**
- At level 3+, recommend mock interview sessions (timed, random topic, multiple problems).
- Feedback: "Interview readiness: 72%. You'd likely pass coding but might struggle on hard graphs. Focus on: top-k problems, advanced tree algorithms."

### 12.7 Session intelligence layer (inference at submission)

When user submits an answer, agent must:

1. **Evaluate correctness** (pass/fail/partial)
2. **Score optimality** (time/space/clarity trade-offs)
3. **Detect hesitation signals** (overconfidence, surface knowledge, underconfidence)
4. **Fingerprint misconception** (if wrong: what misconception caused it?)
5. **Check skill gaps** (does failure trace to a prereq weakness?)
6. **Update pattern model** (record this answer type, speed, outcome for trending)
7. **Generate feedback** (personalized, not templated)
8. **Decide next action:**
   - Ask harder variant → Attempt same again → Teach prerequisite → Move to next topic
9. **Emit telemetry event** (persist for session report and long-term trending)

**Example submission inference:**
```
User submits: O(n²) solution to "Two Sum"
Agent pipeline:
  - correct=true, but suboptimal (should be O(n) hash)
  - optimality_score=0.6 (works but wasteful)
  - hesitation: fast answer (12s), yet non-optimal → overconfidence signal
  - misconception: likely doesn't know hash-set pattern for fast lookup
  - gap: previous session, hash table mastery was 0.3 (weak)
  - pattern: 2nd time solving Two Sum, 1st time used nested loop
  - feedback: "Correct! But this is the brute force approach. Hash tables solve it faster: O(n) time. You learned hashing last week — try it here."
  - next_action: ask harder variant (3Sum) to force hash pattern
  - telemetry: tag with "optimization_gap" + "hash_table_pattern" for later trending
```

---

## 13. First two implementation tickets (start here)

### Ticket 1 - Progressive-disclosure graph (anti-intimidation)

Scope:
- Implement Level 0/1/2 graph disclosure in dashboard + roadmap.
- Add expand/collapse state management and aggregate mastery labels.
- Keep only recommended branch expanded by default.

Files:
- `frontend/src/pages/Dashboard.tsx`
- `frontend/src/pages/Roadmap.tsx`
- `frontend/src/components/MasteryNode.tsx`
- `frontend/src/lib/topics.ts`

Success:
- Initial graph shows at most 8 nodes.
- Expanding a branch reveals deeper nodes without overwhelming the canvas.
- User can still manually jump to unlocked concepts.

### Ticket 2 - Deployment readiness (Vercel frontend + Render backend)

Scope:
- Add deployment configs and environment wiring for preview + production.
- Ensure WSS session streaming works from deployed frontend to Render backend.
- Finalize CORS and health checks for demo reliability.

Files:
- `frontend` project settings/env wiring
- `backend/main.py` CORS and startup checks
- deployment docs + env examples

Success:
- Fresh deploy supports login, session start, answer flow, and model persistence.
- No manual post-deploy patching needed for demo day.

### Ticket 3 - Agent intelligence core (submission inference + session summary)

Scope:
- Implement full submission pipeline with optimality scoring, hesitation fingerprinting, and misconception detection.
- Add session summary generation with pattern trending and interview readiness breakdown.
- Store session telemetry for long-term behavior analysis.

Files:
- `backend/services/agent.py` — add submission inference pipeline
- `backend/models/knowledge.py` — add assessment level system (0-4), pattern storage, trending
- `backend/services/gemini.py` — add optimality + feedback generation prompts
- `backend/routers/session.py` — emit session summary event on end
- `frontend/src/pages/Session.tsx` — show optimality + hesitation fingerprint after eval
- `frontend/src/pages/Profile.tsx` — add session history with reports

Success:
- After each answer: correct/partial/wrong shown with optimality score and hesitation signal.
- Session end: agent generates report card with pattern analysis, misconception flagging, and interview readiness.
- Profile shows trends: mastery trajectory, recurring misconceptions, assessment level per topic, interview likelihood estimate.

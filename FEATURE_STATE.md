# NeuralDSA — Feature & Agent Implementation Status

## ✅ Running Now

**Frontend**: `http://localhost:5173`
**Backend**: `http://localhost:8000`

Both are live and connected. Demo mode active (no Firebase required).

---

## 📊 Problem Catalog

### How It Works
- **14 problems** currently implemented (Arrays, Strings, Hashing, Binary Search, Stacks, DP, Graphs)
- Each problem has:
  - **Public tests** (visible during "Run" only)
  - **Hidden tests** (revealed after "Submit")
  - **Starter code** (Python, JavaScript)
  - **Expected complexity** (time + space)
  - **Pattern tags** (hashing, sliding_window, dp_1d, bfs, etc.)
  - **Hints** (progressive, 2-3 per problem)

### Example Problems
| Problem | LC # | Topic | Pattern | Difficulty |
|---------|------|-------|---------|------------|
| Two Sum | 1 | arrays | hashing | easy |
| Contains Duplicate | 217 | arrays | hashing | easy |
| Best Time Stock | 121 | arrays | sliding_window | easy |
| Max Subarray (Kadane) | 53 | arrays | dp_1d | medium |
| Valid Palindrome | 125 | strings | two_pointers | easy |
| Longest Substring | 3 | strings | sliding_window | medium |
| Binary Search | 704 | sorting | binary_search | easy |
| Valid Parentheses | 20 | stacks | stack | easy |
| Climbing Stairs | 70 | dp | dp_1d | easy |
| House Robber | 198 | dp | dp_1d | medium |
| Coin Change | 322 | dp | dp_2d | medium |
| Number of Islands | 200 | graphs | bfs_dfs | medium |

### Where Test Cases Come From
- **Sourced from**: NeetCode 150 + Striver A2Z DSA Sheet
- **Test generation**: Manually curated public + hidden tests per problem
- **Storage**: `backend/data/coding_problems.py` (hardcoded for now; could migrate to Firestore)

### Why Two-Tier Tests?
- **Public tests** let users validate locally during "Run"
- **Hidden tests** are revealed only after "Submit" to prevent brute-force guessing
- **Brain model update** only happens on Submit (when hidden tests run)

---

## ⚙️ Code Execution Sandbox

### Infrastructure: Piston API
- **Service**: Emkc Piston (free, public API)
- **URL**: `https://emkc.org/api/v2/piston/execute`
- **Timeout**: 12 seconds per execution
- **Rate limiting**: 0.1s sleep between sequential test runs (courtesy limit)

### How It Works
1. User clicks **"Run"** → backend calls Piston with only public tests
2. User clicks **"Submit"** → backend calls Piston with public + hidden tests
3. Piston executes code in isolated sandboxes (Docker containers per language)
4. Results streamed back: stdout, stderr, exit code, runtime_ms

### Supported Languages
```python
PISTON_LANGUAGE_VERSIONS = {
    "python": {"language": "python", "version": "3.11.0"},
    "javascript": {"language": "node", "version": "20.0.0"},
    "java": {"language": "java", "version": "21.0.1"},
    "cpp": {"language": "cpp", "version": "13.1.0"},
}
```

### JSON I/O Protocol
All problems use **stdin/stdout** with JSON:
- Input: multiline JSON (arrays, objects, primitives)
- Output: single-line JSON result
- Example:
  ```
  INPUT:
  [2,7,11,15]
  9
  
  EXPECTED OUTPUT:
  [0,1]
  ```

### TLE Handling
- **Timeout mechanism**: Piston enforces 12s per test
- **Detection**: If exit_code != 0 or runtime_ms > 12000, marked as timeout
- **Brain model**: Treated as incorrect; fingerprint = "TLE_timeout"
- **Fallback**: User sees "Execution timed out" message
- **Note**: Currently detected passively; could add explicit TLE fingerprint

### Error Fingerprinting in Judge
```python
# After running tests, analyze failure patterns:
fingerprint = {
    "syntax_error": if any stderr,
    "edge_case_blindness": if only hidden tests fail,
    "incomplete_solution": default if public tests fail,
    "TLE_timeout": if runtime > 12s,  # future enhancement
}
```

---

## 🧠 The Agent (6 Decision Modes)

### What the Agent Does
The **agent** is the teaching engine. It runs inside the Session loop and:

1. **Observes** your answer + hesitation + thought trace
2. **Decides** what mode to enter (ASSESS → SCAFFOLD → REINFORCE → ADVANCE → EXPLAIN → CONTINUE)
3. **Acts** by generating a tutor response with:
   - Next question (or explanation, or pivot to prereq)
   - Feedback on your reasoning
   - Hint (if struggling)
   - Mastery score update

### 6 Agent Modes

#### Mode 1: **ASSESS**
- **When**: First 1-2 questions on a topic
- **Action**: Calibration question (low difficulty, tests prerequisite)
- **Goal**: "Where do you actually start on this topic?"
- **Example**: 
  - Topic: Binary Trees
  - Question: "What's a left child in a binary tree?"

#### Mode 2: **SCAFFOLD**
- **When**: Prerequisite gap detected (mastery < 0.3)
- **Action**: Pivot to easier subtopic, ask foundational question
- **Goal**: "Build the missing foundation first"
- **Trigger**: If you fail 2+ times or answer shows concept confusion
- **Example**:
  - You fail Binary Search questions
  - Agent detects: "You don't understand array indexing"
  - Pivots: "Let's start with arrays. What's the index of the 3rd element?"

#### Mode 3: **REINFORCE**
- **When**: Mastery 0.3–0.7 (mid-range, most learning)
- **Action**: Repeat pattern with variations (2–3 similar questions)
- **Goal**: "Solidify this pattern"
- **Example**:
  - You solve sliding_window problem 1
  - Agent asks: "Here's sliding_window problem 2 with a twist..."

#### Mode 4: **ADVANCE**
- **When**: Mastery > 0.7 OR you got 2 correct in a row
- **Action**: Harder variant or new pattern
- **Goal**: "Push to next difficulty level"
- **Example**:
  - Easy: Two Sum (hashing)
  - Medium: Two Sum II (two-pointer)
  - Hard: 4Sum (two-pointer + recursion)

#### Mode 5: **EXPLAIN**
- **When**: After 3 wrong answers or 3 hint requests on same concept
- **Action**: Full explanation without asking
- **Goal**: "Stop the loop. Teach what's missing"
- **Content**: Claude generates personalized explanation targeting your error

#### Mode 6: **CONTINUE**
- **When**: Normal flow (answer correct, mastery increased, keep going)
- **Action**: Next question in roadmap
- **Goal**: "Momentum. Next topic when ready"

### Agent Logic Flow (Per Answer)

```python
# 1. Receive answer + thought_trace
answer = "I think it's O(log n) because we divide the array"

# 2. Evaluate
evaluation = {
    "correct": True,
    "reasoning_quality": "partial",  # Right answer, incomplete reasoning
    "reasoning_feedback": "Correct! But you missed: division works ONLY because of BST property."
}

# 3. Update mastery
mastery_before = 0.6
mastery_after = 0.68  # +0.08 for correct, but -0.02 for reasoning gap

# 4. Decide mode
if mastery_after < 0.3 and prereq_gap_detected:
    mode = SCAFFOLD
    action = PIVOT_TO_PREREQ
    next_topic = "binary_search_basics"
elif 2_correct_in_row:
    mode = ADVANCE
    action = NEXT_DIFFICULTY
    next_problem = harder_variant
else:
    mode = CONTINUE
    action = REPEAT_PATTERN
    next_problem = similar_problem

# 5. Generate response
response = {
    "type": "question",
    "content": "Here's a similar problem...",
    "reasoning_feedback": "Your reasoning gap: ...",
    "difficulty": 3,
    "agent_mode": "CONTINUE"
}
```

### Agent's Brain: 5D Knowledge Model

The agent tracks **5 dimensions** per concept:

```json
{
  "arrays": {
    "mastery": 0.78,                    // 0-1, main score
    "speed": 0.65,                      // avg time vs expected
    "confidence": 0.72,                 // self-assessed vs actual accuracy
    "consistency": 0.81,                // % of answers in top 3 accuracy tiers
    "patternRecognition": 0.60,         // can you identify pattern from problem?
    "attempts": 14,
    "correct": 11,
    "errors": {
      "optimization_blindness": 2,      // found answer but not optimal
      "edge_case_blindness": 1,         // missed boundary conditions
      "off_by_one": 1,
      "complexity_confusion": 1
    },
    "lastSeen": "2026-04-25T20:35:00Z",
    "hesitationCount": 3,               // times user took > 60s before answering
    "hintRequests": 1
  }
}
```

### Real Example: What Agent Sees

**Session so far:**
```
Q1: "Two Sum" → answer correct (1 min) → mastery arrays: 0.5 → 0.60
Q2: "Contains Duplicate" → answer wrong (syntax error) → mastery: 0.60 → 0.55
Q3: "Best Time Stock" → hint used, answer correct → mastery: 0.55 → 0.62
```

**Agent now decides:**
- ✓ Mastery 0.62 is mid-range (0.3–0.7) → REINFORCE mode
- ✓ 1 hint used, not excessive
- ✓ 2/3 correct overall
- **Decision**: Ask similar sliding_window problem to reinforce pattern
- **Output**:
  ```json
  {
    "type": "question",
    "content": "Great progress. You're solidifying array patterns. Try this variant:",
    "agent_mode": "REINFORCE",
    "difficulty": 2,
    "next_action": "wait_for_answer"
  }
  ```

---

## 🎯 Judge Dashboard & Judging

### What Judges See (`/judge` page)

1. **Interview Readiness Score** (0–100)
   - Computed from: coverage × accuracy × speed × consistency × recency
   - Example: 68/100 → "Advanced — ready for senior interviews"

2. **Error Pattern Heatmap**
   - Top 3 misconception types user struggles with
   - Example: "Edge case blindness (5x), Off-by-one (3x), Complexity confusion (2x)"

3. **Strength by Category**
   - Arrays: 78% mastery
   - Strings: 62%
   - Trees: 34%
   - Graphs: 28%
   - DP: 15%

4. **Mastered Concepts** (>80% mastery)
   - Badges: "Arrays", "Hashing", "Two Pointers"

5. **Readiness Trajectory**
   - Sparkline chart: Last 14 sessions, readiness trend
   - Example: 45 → 52 → 58 → 61 → 68 (upward trend!)

6. **Last Session Summary** (Claude-generated)
   - Strongest concept
   - Biggest gap to close
   - 3–5 action items
   - Example:
     ```
     Your strongest: Arrays & Hashing
     Gap to close: Dynamic Programming (only 15% mastery)
     Next focus:
     - Try 3 more DP problems (1D before 2D)
     - Review Kadane's algorithm once more
     - Practice coin change variation
     ```

### Real-Time Judge Monitoring
- Judges can:
  1. Click "judge" link on dashboard
  2. See live readiness score updating after each question
  3. See error patterns evolving
  4. See mastery trajectory
  5. Print/screenshot report for feedback

---

## 🔗 How Everything Connects

```
User answers question in Session
          ↓
Backend: routers/session.py captures answer + thought_trace
          ↓
Backend: services/judge.py (if Solve page) → Piston runs tests
          ↓
Backend: services/agent.py → decides mode + next action
          ↓
Backend: services/llm_client.py → Claude generates response
          ↓
Backend: services/firestore.py → saves evaluation + updates brain model
          ↓
Frontend: TutorMessage + ErrorFingerprintChip displays feedback
          ↓
Frontend: Dashboard mind map recolors (node mastery updated live)
          ↓
Frontend: Judge dashboard shows updated readiness score
```

---

## 🚨 Known Gaps / Not Yet Implemented

### Close to Done
1. ✅ Thought trace backend — done
2. ✅ Judge dashboard UI — done
3. ✅ Progressive graph (collapse/expand domains) — done

### Nice to Have (not blocking demo)
1. ⏳ **Rate limiting cache** — user handles on DigitalOcean
2. ⏳ **Spaced repetition queue** — topics added to review queue after 7 days inactivity
3. ⏳ **Learning style detection** — visual vs analytical vs trial-and-error
4. ⏳ **Offline problem sync** — pre-download problem catalog for offline solve

### Future (Post-hackathon)
1. 📌 **More problems** — scale from 14 to 150 (full NeetCode)
2. 📌 **Problem difficulty calibration** — ML to auto-set difficulty
3. 📌 **Interview simulation mode** — random 45-min interview
4. 📌 **Team leaderboards** — compare readiness across users
5. 📌 **Custom problem uploads** — teachers add their own problems

---

## 🎬 Quick Start Checklist

- [x] Backend running: `http://localhost:8000/health` → `{"status":"ok"}`
- [x] Frontend running: `http://localhost:5173`
- [x] Try Session: Pick a topic, answer question
- [x] Try Solve: Click a problem, run tests
- [x] Try Judge Dashboard: See readiness score
- [x] Demo mode (no Firebase needed)
- [ ] Deploy to DigitalOcean (see DEPLOY_DIGITALOCEAN.md)

---

## 📞 How to Demo to Judges

1. **Landing page**: Show the hero + Google sign-in
2. **Onboarding**: Choose "Intermediate, Placement, 30min/day"
3. **Dashboard**: Explain mind map (nodes = topics, colors = mastery)
4. **Session**: Answer 3-4 questions, show thought trace capturing
5. **Solve page**: Run + Submit a coding problem, show test results
6. **Judge Dashboard**: Show readiness score + error patterns
7. **Roadmap**: Show personalized order (prerequisites blocking locked nodes)

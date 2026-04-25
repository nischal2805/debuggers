# CLAUDE.md — Adaptive DSA Tutor Agent

## Project Identity

**Name**: NeuralDSA — The DSA Tutor That Learns You  
**Tagline**: "Not a question bank. A brain model."  
**Core Premise**: Every interaction updates an internal model of what the user knows, how they think, and where they hesitate. The agent uses this model to decide what to teach next, how hard to push, when to hint vs. reveal, and when to move on. It is an agent, not a chatbot.

---

## Tech Stack

### Frontend
- **React 18 + Vite** — fast dev, HMR, optimized build
- **TailwindCSS v3** — utility-first, zero-runtime CSS
- **Framer Motion** — page transitions, micro-interactions, animated mind maps
- **React Flow** (by xyflow) — interactive knowledge graph / mind map / roadmap rendering
- **Recharts** — radar charts, progress lines, heatmaps for skill visualization
- **Firebase SDK** — Google Auth, Firestore real-time sync
- **Zustand** — global state (user model, session, current topic)
- **React Router v6** — SPA routing

### Backend
- **FastAPI (Python)** — main API server, WebSocket support
- **Google Gemini API** (`gemini-2.5-flash`) — the tutor brain. Free tier via Google AI Studio (aistudio.google.com) — no billing required, just sign in with Google and grab an API key.
- **Firebase Admin SDK** — server-side auth verification, Firestore writes
- **Firestore** — user knowledge model, session history, topic mastery scores
- **Uvicorn** — ASGI server

### Why gemini-2.5-flash specifically
- It is stable (not a preview model), on the free tier, and fast enough for streaming tutor sessions.
- Do NOT use `gemini-2.5-pro` — free tier caps at 50 requests/day, too low for a hackathon with multiple judges testing simultaneously.
- Do NOT use any `gemini-2.0-*` model — deprecated March 2026, shutdown September 2026.
- Do NOT use `gemini-3-flash-preview` or `gemini-3.1-*-preview` — preview models have more restrictive rate limits and can change without notice. Not safe for a demo.
- `gemini-2.5-flash` has a 1M token context window, handles structured JSON output reliably, streams well, and is the correct stable free-tier choice as of April 2026.

### No MCP Servers Needed
MCP is for giving an agent access to external tools — filesystems, browsers, APIs. Every tool this agent needs (Firestore reads/writes, mastery computation, roadmap algorithm) is a plain Python function in the same process. Adding MCP would add latency and complexity for zero gain. Skip it entirely.

### Deployment (for demo)
- Frontend: **Vercel** (static deploy, env vars injected)
- Backend: **Railway** or **Render** (free tier, FastAPI + uvicorn)
- Database: **Firebase Firestore** (free Spark plan is sufficient for demo)

---

## Architecture

```
User Browser
    │
    ├── React App (Vite)
    │       ├── Google OAuth via Firebase Auth
    │       ├── Zustand store (userModel, session)
    │       ├── React Flow (mind map, roadmap)
    │       └── WebSocket client (streaming tutor responses)
    │
    ▼
FastAPI Backend
    ├── POST /session/start        — init session, load user model from Firestore
    ├── WS  /session/stream        — streaming tutor conversation over WebSocket
    ├── POST /session/evaluate     — score user answer, update knowledge model
    ├── GET  /user/model           — return full knowledge graph for visualization
    ├── GET  /user/roadmap         — return personalized topic ordering
    └── POST /auth/verify          — verify Firebase ID token, return internal JWT
    │
    ▼
Gemini API (gemini-2.5-flash)
    └── Stateful prompt chain with user model injected each call
    │
    ▼
Firestore
    └── users/{uid}/
            ├── knowledgeModel     — per-topic mastery, confidence, last seen
            ├── sessionHistory[]   — compressed past sessions
            └── preferences        — pace, hint preference, focus areas
```

---

## The User Knowledge Model (Core Innovation)

This is what makes it an **agent**, not a chatbot. Every user has a `KnowledgeModel` document in Firestore:

```json
{
  "uid": "abc123",
  "topics": {
    "arrays": {
      "mastery": 0.82,
      "confidence": 0.6,
      "attempts": 14,
      "correct": 11,
      "avgTimeMs": 45000,
      "lastSeen": "2025-04-24T10:00:00Z",
      "hesitationCount": 3,
      "hintRequests": 1
    },
    "dp_knapsack": {
      "mastery": 0.2,
      "confidence": 0.1,
      "attempts": 2,
      "correct": 0,
      "avgTimeMs": 120000,
      "lastSeen": "2025-04-23T14:00:00Z",
      "hesitationCount": 5,
      "hintRequests": 4
    }
    // ... all DSA topics
  },
  "learningStyle": "visual",       // detected: visual | analytical | trial-error
  "pacePreference": "adaptive",    // fast | slow | adaptive
  "currentFocus": "graphs",
  "weaknessVector": ["dp", "segment_trees", "trie"],
  "strengthVector": ["arrays", "sorting", "two_pointers"],
  "sessionCount": 12,
  "totalMinutes": 340
}
```

### Mastery Scoring Algorithm

On each answer evaluation:
```python
def update_mastery(topic: str, correct: bool, time_ms: int, hint_used: bool, model: dict):
    current = model["topics"][topic]["mastery"]
    
    # Base delta
    delta = 0.08 if correct else -0.05
    
    # Penalize hint use
    if hint_used: delta *= 0.6
    
    # Penalize slow answers (> 2x avg time for topic)
    avg_time = model["topics"][topic]["avgTimeMs"] or 60000
    if time_ms > avg_time * 2: delta *= 0.8
    
    # Recency decay: topics not seen in 7+ days lose mastery
    days_since = (now - last_seen).days
    if days_since > 7: current *= (0.95 ** days_since)
    
    # Clamp to [0, 1]
    new_mastery = max(0, min(1, current + delta))
    model["topics"][topic]["mastery"] = new_mastery
    
    # Update confidence separately (slower moving)
    confidence_delta = 0.04 if correct else -0.02
    model["topics"][topic]["confidence"] = max(0, min(1,
        model["topics"][topic]["confidence"] + confidence_delta
    ))
    
    return model
```

---

## DSA Topic Taxonomy (Full Graph)

Topics are nodes in a dependency graph. Prerequisites are edges.

```python
TOPIC_GRAPH = {
    # Foundations
    "arrays": {"prereqs": [], "difficulty": 1},
    "strings": {"prereqs": ["arrays"], "difficulty": 1},
    "hashing": {"prereqs": ["arrays"], "difficulty": 2},
    "two_pointers": {"prereqs": ["arrays", "sorting"], "difficulty": 2},
    "sliding_window": {"prereqs": ["arrays", "two_pointers"], "difficulty": 2},
    "prefix_sum": {"prereqs": ["arrays"], "difficulty": 2},
    "binary_search": {"prereqs": ["arrays", "sorting"], "difficulty": 2},
    
    # Sorting
    "sorting": {"prereqs": ["arrays"], "difficulty": 1},
    "merge_sort": {"prereqs": ["sorting", "recursion"], "difficulty": 3},
    "quick_sort": {"prereqs": ["sorting", "recursion"], "difficulty": 3},
    
    # Recursion & Backtracking
    "recursion": {"prereqs": [], "difficulty": 2},
    "backtracking": {"prereqs": ["recursion"], "difficulty": 3},
    
    # Linked Lists
    "linked_list": {"prereqs": ["arrays"], "difficulty": 2},
    "doubly_linked_list": {"prereqs": ["linked_list"], "difficulty": 2},
    "fast_slow_pointers": {"prereqs": ["linked_list"], "difficulty": 3},
    
    # Stacks & Queues
    "stack": {"prereqs": ["arrays"], "difficulty": 2},
    "queue": {"prereqs": ["arrays"], "difficulty": 2},
    "monotonic_stack": {"prereqs": ["stack"], "difficulty": 3},
    "deque": {"prereqs": ["queue"], "difficulty": 3},
    
    # Trees
    "binary_tree": {"prereqs": ["recursion"], "difficulty": 3},
    "bst": {"prereqs": ["binary_tree"], "difficulty": 3},
    "tree_traversal": {"prereqs": ["binary_tree"], "difficulty": 2},
    "lowest_common_ancestor": {"prereqs": ["binary_tree"], "difficulty": 4},
    "segment_tree": {"prereqs": ["binary_tree", "prefix_sum"], "difficulty": 5},
    "fenwick_tree": {"prereqs": ["prefix_sum"], "difficulty": 5},
    "trie": {"prereqs": ["strings", "hashing"], "difficulty": 4},
    "heap": {"prereqs": ["binary_tree"], "difficulty": 3},
    
    # Graphs
    "graph_basics": {"prereqs": ["arrays", "hashing"], "difficulty": 3},
    "bfs": {"prereqs": ["graph_basics", "queue"], "difficulty": 3},
    "dfs": {"prereqs": ["graph_basics", "recursion"], "difficulty": 3},
    "topological_sort": {"prereqs": ["dfs", "bfs"], "difficulty": 4},
    "union_find": {"prereqs": ["graph_basics"], "difficulty": 4},
    "shortest_path_dijkstra": {"prereqs": ["graph_basics", "heap"], "difficulty": 4},
    "shortest_path_bellman": {"prereqs": ["graph_basics"], "difficulty": 4},
    "minimum_spanning_tree": {"prereqs": ["union_find", "heap"], "difficulty": 4},
    
    # Dynamic Programming
    "dp_intro": {"prereqs": ["recursion"], "difficulty": 4},
    "dp_1d": {"prereqs": ["dp_intro"], "difficulty": 4},
    "dp_2d": {"prereqs": ["dp_1d"], "difficulty": 5},
    "dp_knapsack": {"prereqs": ["dp_1d"], "difficulty": 5},
    "dp_lcs": {"prereqs": ["dp_2d"], "difficulty": 5},
    "dp_trees": {"prereqs": ["dp_intro", "binary_tree"], "difficulty": 5},
    "dp_graphs": {"prereqs": ["dp_intro", "graph_basics"], "difficulty": 6},
    
    # Advanced
    "bit_manipulation": {"prereqs": ["arrays"], "difficulty": 3},
    "intervals": {"prereqs": ["sorting"], "difficulty": 3},
    "greedy": {"prereqs": ["sorting"], "difficulty": 3},
    "divide_conquer": {"prereqs": ["recursion", "merge_sort"], "difficulty": 4},
    "string_matching": {"prereqs": ["strings"], "difficulty": 4},
}
```

---

## The Agent Prompt System

### System Prompt (injected on every session call)

```python
TUTOR_SYSTEM_PROMPT = """
You are NeuralDSA — an adaptive DSA tutor agent. You are NOT a question answering bot.
You are a model of the learner's current understanding, and you use that model to decide
every action: what to teach, how hard to push, when to hint, when to explain, when to move on.

ABSOLUTE RULES — never violate these:
- Never use emojis anywhere in any response. Not once. Not ever.
- Always respond in valid JSON only. No markdown, no prose, no preamble.
- Never give the full solution before the user attempts it.

## Question Sourcing
Pull questions directly from the canonical DSA problem sets. Use this priority order:
1. **NeetCode 150 / NeetCode 250** — the gold standard for placement prep. Cover all patterns.
2. **Striver's A2Z DSA Sheet** — comprehensive, ordered by concept, great for building foundations.
3. **LeetCode Top Interview 150** — company-tagged, widely recognized by students.
4. **Striver's SDE Sheet** — 180 must-do problems, used by most Indian placement aspirants.

For each topic, use the canonical problems from these sheets. Examples:
- Sliding Window → Maximum Subarray (Kadane), Longest Substring Without Repeating Characters, Minimum Window Substring
- Two Pointers → 3Sum, Container With Most Water, Trapping Rain Water
- Binary Search → Search in Rotated Array, Koko Eating Bananas, Median of Two Sorted Arrays
- Trees → Diameter of Binary Tree, Level Order Traversal, Binary Tree Max Path Sum
- Graphs → Number of Islands, Clone Graph, Course Schedule (Topo Sort)
- DP → Climbing Stairs, House Robber, Longest Common Subsequence, Edit Distance, Burst Balloons

Reference the problem by its LeetCode number and name when asking. For example:
"LC 3 — Longest Substring Without Repeating Characters. Given a string, find the length of the longest substring without repeating characters."

When evaluating complexity, use the exact expected complexities from NeetCode/Striver solutions.
Always mention the pattern name (e.g., "This is the sliding window pattern") so the learner builds a mental map.

## Current Learner Model
{knowledge_model_json}

## Current Session Context
- Topic: {current_topic}
- Session goal: {session_goal}
- Questions asked this session: {questions_asked}
- Correct answers this session: {correct_answers}
- Hint requests this session: {hints_used}

## Your Behavior Rules

### Teaching Style
- NEVER just dump a full explanation unprompted. Ask first. Probe what they know.
- Start with a question calibrated to their mastery score for this topic.
- If mastery < 0.3: start with conceptual questions, no code required
- If mastery 0.3-0.6: mix of conceptual + simple implementation
- If mastery > 0.6: LeetCode medium/hard style, time complexity required

### Hint Policy
- If the user asks for a hint, give ONE small nudge. Never the full answer.
- Track hint use — repeated hints on the same concept = flag for teaching moment
- After 3 wrong answers or 3 hints on same concept, switch to guided explanation mode

### Adaptive Difficulty
- If user answers 2 correct in a row: bump difficulty one level
- If user answers 2 wrong in a row: drop difficulty, probe prerequisites
- If user is fast AND correct: move to next topic in roadmap

### Response Format
Every response must be a JSON object (never plain text):
{
  "type": "question" | "hint" | "explanation" | "feedback" | "celebration" | "topic_transition",
  "content": "...",           // what to display to user
  "code_snippet": "...",      // optional: starter code or example
  "expected_answer_type": "code" | "text" | "multiple_choice" | "complexity",
  "options": [...],           // for multiple_choice only
  "difficulty_level": 1-10,
  "internal_note": "...",     // why you chose this question (for debugging)
  "next_action": "wait_for_answer" | "end_session" | "transition_topic"
}

### Personality
- Sharp, direct, zero fluff. You respect the learner's time.
- Celebrate breakthroughs briefly and genuinely. One sentence max.
- Call out patterns: "You're fast on arrays but slow on index arithmetic — let's fix that."
- Use analogies only when mastery is low. Remove them as mastery grows.

### What You NEVER Do
- Never give the full solution without the user trying
- Never repeat an explanation verbatim — always find a new angle
- Never say "Great question!" or any filler praise
- Never skip prerequisite gaps — if they fail a question due to a prereq, go teach the prereq first
"""
```

### Answer Evaluation Prompt

```python
EVALUATE_PROMPT = """
Topic: {topic}
Question asked: {question}
User's answer: {user_answer}
Expected difficulty: {difficulty}
User mastery at topic: {mastery}

Evaluate this answer. Return JSON:
{
  "correct": true/false,
  "partial_credit": 0.0-1.0,
  "errors": ["..."],           // specific mistakes
  "missing_concepts": ["..."], // what they clearly don't know
  "time_complexity_correct": true/false/null,
  "space_complexity_correct": true/false/null,
  "feedback": "...",           // one crisp sentence of feedback
  "hint_for_retry": "..."      // if incorrect, what nudge to give
}
"""
```

---

## Frontend Pages & Components

### 1. Landing Page (`/`)
- Minimal, striking hero: "DSA that learns you back."
- Google Sign-in button (Firebase Auth)
- Animated demo of mind map in background (React Flow, non-interactive)
- No navbar clutter

### 2. Onboarding (`/onboard`) — first-time users only
- 3 quick questions (< 30 seconds):
  1. "Where are you at?" → Beginner / Know the basics / Intermediate / Grinding LC
  2. "What's your goal?" → Crack placements / FAANG / Competitive / Just learning
  3. "How much time per day?" → 15min / 30min / 1hr / Unlimited
- These seed the initial `KnowledgeModel` with non-zero priors so onboarding isn't cold

### 3. Dashboard (`/dashboard`)
- **Left panel**: Knowledge Mind Map (React Flow)
  - Nodes = topics, colored by mastery (red → yellow → green)
  - Edges = prerequisites, styled by dependency direction
  - Clickable — clicking a topic opens it in the tutor
  - Animate node colors updating after each session
- **Center**: Today's recommended topic (from roadmap algorithm)
- **Right panel**: Stats
  - Radar chart: Mastery across all DSA categories (arrays, trees, graphs, dp, etc.)
  - Streak counter
  - Weak areas list
  - Session heatmap (like GitHub contributions)

### 4. Tutor Session (`/session/:topicId`)
- Full-screen, distraction-free
- **Chat-style interface** but NOT a chatbot — the agent always drives
- Left side: current question / explanation (streaming from Claude via WebSocket)
- Right side: Code editor (Monaco Editor, lightweight, syntax highlighted)
- Bottom: Answer input — switches between code editor / text box / multiple choice based on `expected_answer_type`
- **Hint button**: glows when user has been stuck > 60 seconds
- **Timer**: subtle, non-stressful, used internally for mastery scoring
- After each answer: instant feedback strip (correct/incorrect + one-line reason)
- Session ends when: 5 questions done OR mastery threshold crossed OR user taps "End"

### 5. Roadmap Page (`/roadmap`)
- Full-width React Flow graph
- Personalized topic ordering computed from:
  1. Current mastery scores
  2. Prerequisite graph
  3. Goal (placement → prioritize trees/graphs/dp)
- Nodes are grouped into "phases" (Foundation → Intermediate → Advanced → Expert)
- Completed nodes are checkmarked; locked nodes are grayed
- Clicking unlocked node starts a session

### 6. Profile (`/profile`)
- Full knowledge model breakdown
- Session history (past 30 days)
- Exportable progress PDF (stretch goal)

---

## Personalized Roadmap Algorithm

```python
def compute_roadmap(knowledge_model: dict, goal: str) -> list[str]:
    """
    Returns an ordered list of topics to study next.
    Prioritization:
    1. Prerequisites must be mastered (mastery > 0.5) before unlocking
    2. Topics with mastery 0.3-0.7 are prioritized (most learning gain)
    3. Topics relevant to goal get a +0.2 priority boost
    4. Recency: topics not seen in 5+ days get a +0.1 boost
    """
    
    GOAL_WEIGHTS = {
        "placement": ["arrays", "strings", "dp", "graphs", "trees", "sliding_window"],
        "faang": ["dp", "graphs", "segment_tree", "trie", "bit_manipulation"],
        "competitive": ["segment_tree", "fenwick_tree", "dp_graphs", "string_matching"],
        "learning": []  # no bias, pure dependency order
    }
    
    scores = {}
    for topic, meta in TOPIC_GRAPH.items():
        mastery = knowledge_model["topics"].get(topic, {}).get("mastery", 0)
        
        # Skip if already mastered
        if mastery > 0.85:
            continue
        
        # Skip if prerequisites not met
        prereq_ok = all(
            knowledge_model["topics"].get(p, {}).get("mastery", 0) > 0.5
            for p in meta["prereqs"]
        )
        if not prereq_ok:
            continue
        
        # Priority: highest for mid-mastery (most learnable)
        priority = 1 - abs(mastery - 0.5) * 2  # peaks at mastery = 0.5
        
        # Goal boost
        if topic in GOAL_WEIGHTS.get(goal, []):
            priority += 0.2
        
        # Recency boost
        last_seen = knowledge_model["topics"].get(topic, {}).get("lastSeen")
        if last_seen:
            days = (datetime.now() - datetime.fromisoformat(last_seen)).days
            if days > 5:
                priority += 0.1
        
        scores[topic] = priority
    
    return sorted(scores.keys(), key=lambda t: scores[t], reverse=True)
```

---

## Mind Map Visualization Spec

### Node Structure (React Flow)
```typescript
interface TopicNode {
  id: string;          // topic key e.g. "dp_knapsack"
  label: string;       // display name e.g. "Knapsack DP"
  mastery: number;     // 0-1, drives color
  confidence: number;  // 0-1, drives opacity
  attempts: number;
  locked: boolean;     // prereqs not met
  category: "foundation" | "intermediate" | "advanced" | "expert";
}
```

### Visual Encoding
- **Node color**: `hsl(${mastery * 120}, 70%, 50%)` — red (0) → yellow (0.5) → green (1)
- **Node size**: scales with `attempts` (more practiced = larger node)
- **Node border**: pulsing animation if it's the recommended next topic
- **Edge style**: dashed if prerequisite not yet met, solid if met
- **Edge color**: gray → blue based on mastery of source node
- **Locked nodes**: grayscale + lock icon overlay

### Layout Algorithm
Use React Flow's `dagre` layout for automatic hierarchical positioning based on the prerequisite graph. Group by difficulty level (1-6) as columns.

---

## WebSocket Streaming Architecture

### Backend (FastAPI)
```python
@app.websocket("/session/stream")
async def session_stream(websocket: WebSocket, token: str):
    await websocket.accept()
    
    # Verify token
    uid = verify_firebase_token(token)
    knowledge_model = await get_knowledge_model(uid)
    
    while True:
        # Receive user message
        data = await websocket.receive_json()
        action = data["action"]  # "answer" | "hint_request" | "start_topic" | "end"
        
        if action == "end":
            await save_session_summary(uid, session_state)
            break
        
        # Build prompt
        prompt = build_tutor_prompt(knowledge_model, session_state, data)
        
        # Stream Gemini response
        # google-generativeai SDK: pip install google-generativeai
        import google.generativeai as genai
        
        model = genai.GenerativeModel(
            model_name="gemini-2.5-flash",
            system_instruction=TUTOR_SYSTEM_PROMPT.format(**format_args),
            generation_config=genai.GenerationConfig(
                max_output_tokens=800,
                temperature=0.4,       # low temp = more consistent JSON output
                response_mime_type="application/json",  # enforce JSON output natively
            )
        )
        
        full_response = ""
        async for chunk in await model.generate_content_async(prompt, stream=True):
            text = chunk.text or ""
            full_response += text
            await websocket.send_json({"type": "chunk", "text": text})
        
        # Parse JSON response from Claude
        tutor_response = json.loads(full_response)
        
        # If it was an answer evaluation, update knowledge model
        if action == "answer":
            knowledge_model = update_mastery(
                topic=session_state["topic"],
                correct=tutor_response.get("evaluation", {}).get("correct", False),
                time_ms=data.get("time_ms", 60000),
                hint_used=session_state["hints_used"] > 0,
                model=knowledge_model
            )
            await save_knowledge_model(uid, knowledge_model)
        
        # Send final parsed response
        await websocket.send_json({"type": "response", "data": tutor_response})
```

### Frontend WebSocket Hook
```typescript
// hooks/useTutorSession.ts
export function useTutorSession(topicId: string) {
  const [messages, setMessages] = useState<TutorMessage[]>([]);
  const [streaming, setStreaming] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  
  const sendAnswer = useCallback((answer: string, timeMs: number) => {
    wsRef.current?.send(JSON.stringify({
      action: "answer",
      answer,
      time_ms: timeMs,
    }));
  }, []);
  
  const requestHint = useCallback(() => {
    wsRef.current?.send(JSON.stringify({ action: "hint_request" }));
  }, []);
  
  return { messages, streaming, sendAnswer, requestHint };
}
```

---

## UI Design System

### No Emoji Policy
Zero emojis across the entire product. No loading states, no success messages, no empty states, no onboarding copy, no error messages, no tutor responses, no button labels — nothing. The interface communicates status through color (green/amber/red mastery system), typography weight, and motion. Emojis make a serious technical product feel like a consumer app. This is a tool for engineers.

### Color Palette
```css
:root {
  --bg-primary: #0a0a0f;
  --bg-surface: #12121a;
  --bg-elevated: #1a1a26;
  --accent-primary: #6c63ff;   /* electric indigo */
  --accent-secondary: #00d4ff; /* cyan for streaks/highlights */
  --accent-success: #00e676;   /* green for mastery */
  --accent-warn: #ffb300;      /* amber for mid-mastery */
  --accent-danger: #ff4757;    /* red for low mastery */
  --text-primary: #f0f0ff;
  --text-secondary: #8888aa;
  --border: rgba(108, 99, 255, 0.15);
}
```

### Typography
- **Display/Headings**: `Space Grotesk` — wait, per design rules, be distinctive. Use **`Syne`** (geometric, technical) for headings
- **Body/UI**: **`IBM Plex Mono`** — coding context, monospaced feels native to DSA
- **Code**: `JetBrains Mono`

### Key Components to Build
1. `<MasteryNode />` — animated React Flow node with color gradient
2. `<TutorMessage />` — streaming message bubble with typewriter effect
3. `<CodeEditor />` — Monaco wrapper with DSA language support (Python/Java/C++)
4. `<SkillRadar />` — Recharts radar chart for category mastery
5. `<SessionHeatmap />` — GitHub-style 6-week activity grid
6. `<DifficultyBadge />` — dynamic badge showing current difficulty level
7. `<HintButton />` — glows amber after 60s inactivity

---

## Firebase Schema

```
/users/{uid}
  - email: string
  - name: string
  - photoURL: string
  - createdAt: timestamp
  - goal: "placement" | "faang" | "competitive" | "learning"
  - dailyGoalMinutes: number

/users/{uid}/knowledgeModel
  - topics: { [topicKey]: TopicStat }
  - learningStyle: string
  - weaknessVector: string[]
  - strengthVector: string[]
  - sessionCount: number
  - totalMinutes: number

/users/{uid}/sessions/{sessionId}
  - topicId: string
  - startedAt: timestamp
  - endedAt: timestamp
  - questionsAsked: number
  - correctAnswers: number
  - hintsUsed: number
  - masteryDelta: number
  - messages: Message[]   // compressed, max 20 messages stored
```

---

## Environment Variables

### Frontend (`.env`)
```
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_APP_ID=
VITE_BACKEND_URL=https://your-backend.railway.app
```

### Backend (`.env`)
```
GEMINI_API_KEY=              # from Google AI Studio: aistudio.google.com — free, no billing required
FIREBASE_SERVICE_ACCOUNT_JSON=   # stringified JSON of service account key
ALLOWED_ORIGINS=https://your-frontend.vercel.app,http://localhost:5173
```

---

## Build Order (Strict Priority)

Build in this exact order. Each phase is a shippable demo checkpoint.

### Phase 1 — Core Loop (get this working first, everything else is polish)
1. Firebase project setup + Google Auth
2. FastAPI server skeleton + `/auth/verify` endpoint
3. Basic Firestore schema + `KnowledgeModel` initialization
4. Gemini integration: WebSocket `/session/stream` with the full system prompt
5. Minimal React UI: login → onboarding → session page with chat + code editor
6. Answer evaluation + mastery update working end-to-end

This is your **hackathon minimum**. If time runs out, this alone demonstrates the agent concept.

### Phase 2 — Visualization (the wow factor)
7. React Flow mind map on dashboard with mastery-colored nodes
8. Personalized roadmap page (React Flow, dagre layout)
9. Skill radar chart (Recharts)

### Phase 3 — Intelligence & Polish
10. Roadmap algorithm with prerequisite unlocking
11. Session heatmap
12. Streak tracking
13. Recommended topic card on dashboard
14. Onboarding prior seeding
15. UI polish: animations, transitions, consistent design system

### Phase 4 — Stretch (only if ahead of schedule)
16. Learning style detection (visual/analytical from answer patterns)
17. Spaced repetition reminder system
18. LeetCode problem linker (link topics to real LC problems)
19. Session playback / review
20. Export progress as PDF

---

## Judging Criteria Alignment

| Criterion | How NeuralDSA addresses it |
|-----------|---------------------------|
| **Innovation** | Brain model concept — tracks hesitation, hint usage, time, not just right/wrong |
| **Technical Depth** | FastAPI + Claude streaming + Firestore + React Flow all working together |
| **Personalization** | Every single interaction is shaped by the knowledge model |
| **UI/UX** | React Flow mind map + dark sci-fi design system + streaming tutor |
| **Demo-ability** | Live session showing mastery update in real-time on the mind map is the money shot |

---

## Demo Script (for judges)

1. Open the app → Google login (2 seconds)
2. Onboarding: "Intermediate, Placement, 30min/day" (30 seconds)
3. Dashboard appears: show the mind map, explain what the colors mean
4. Click on recommended topic (e.g., Sliding Window)
5. Tutor starts a session — asks calibration question
6. Give a wrong answer → tutor detects gap → drops to prerequisite
7. Give correct answer → show mastery score update live on the mind map
8. Open Roadmap page — show personalized order
9. Show Radar chart — visual proof of knowledge state

**The money shot**: giving a wrong answer and watching the node on the mind map flicker from yellow to slightly more red in real-time, while the agent pivots to teach the prerequisite. This is the "aha" moment for judges.

---

## Critical Implementation Notes

- **Claude response must always be JSON**. Add `"Return only valid JSON, no markdown fences"` to every prompt. Parse defensively with try/catch. If parse fails, retry once with a stricter prompt.
- **WebSocket > HTTP for the tutor**. Streaming is not optional — a non-streaming tutor feels like a chatbot. The streamed typewriter effect is what makes it feel alive.
- **Seed the knowledge model from onboarding answers**, not from zero. A zero model makes the first session feel wrong. Use the onboarding answers to set approximate priors (Intermediate → arrays/strings mastery 0.5, others 0.1).
- **React Flow performance**: with 40+ nodes, use `useNodesState`/`useEdgesState` hooks and memoize node components. Don't rerender the entire graph on every mastery update — batch updates after session end.
- **Monaco Editor**: lazy load it. It's 2MB+. Use `@monaco-editor/react` with `loading` prop. Don't block first paint.
- **Firebase rules**: lock Firestore so users can only read/write their own documents. Don't skip this or the demo is insecure.
- **CORS**: FastAPI backend must allow the Vercel frontend domain. Set `allow_origins` in `CORSMiddleware`.
- **Gemini JSON mode**: set `response_mime_type="application/json"` in `GenerationConfig` — this enforces valid JSON output natively without needing to prompt-engineer around it. Far more reliable than asking the model to "return only JSON."
- **Gemini rate limits (free tier)**: 15 RPM, 1500 req/day. For a hackathon demo with multiple judges testing simultaneously, this is fine. If running concurrent sessions, add a simple in-memory rate limiter (one active WebSocket per UID).
- **Token budget per session**: Gemini 2.5 Flash has a 1M context window. Cap sessions at 10 turns. Each turn is roughly 2K input tokens (system prompt + history) + 400 output. 10 turns = ~24K tokens per session, well within free limits.
- **No emojis anywhere** — not in the UI, not in Gemini prompts, not in system messages, not in Firestore data, not in error messages, not in loading states. Zero. The design communicates through color, typography, and layout — not emoji. Add this explicitly to the Gemini system prompt: "Never use emojis in any response."
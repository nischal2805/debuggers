"""
Solve endpoints — coding problem flow (primary product experience).

Optimized for minimum LLM calls:
  GET  /solve/problem/{topic}   — rule-based problem pick (0 LLM calls)
  POST /solve/run               — run public tests via local runner (0 LLM calls)
  POST /solve/hint              — contextual hint (1 LLM call)
  POST /solve/evaluate          — full attempt evaluation (1 LLM call + local runner)
  GET  /solve/next/{topic}      — next recommended problem (0 LLM calls)
"""

from __future__ import annotations

import json
import time
from typing import Optional

from fastapi import APIRouter, HTTPException, Header
from pydantic import BaseModel

import firebase_admin.auth as fb_auth

from data.coding_problems import (
    CODING_PROBLEMS,
    get_problem,
    pick_problem_for_topic,
    get_next_problem,
)
from prompts.solve import SOLVE_EVALUATE_PROMPT, SOLVE_HINT_PROMPT, SOLVE_AGENT_PROMPT
from services import demo_store
from services.firestore import get_knowledge_model, save_knowledge_model, append_event
from services.llm_client import get_provider, parse_llm_json
from services.runner import run_code, normalize_output, available_languages
from models.knowledge import update_mastery, migrate_knowledge_model, update_readiness


router = APIRouter(prefix="/solve", tags=["solve"])


# ── Request models ────────────────────────────────────────────────────────────

class AttemptLog(BaseModel):
    approach_written: bool = False
    approach_text: str = ""
    approach_time_ms: int = 0
    first_keystroke_ms: int = 0
    num_runs: int = 0
    hints_requested: int = 0
    total_time_ms: int = 0


class EvaluateRequest(BaseModel):
    problem_id: str
    language: str = "python"
    source: str
    attempt_log: AttemptLog


class RunRequest(BaseModel):
    problem_id: str
    language: str = "python"
    source: str


class HintRequest(BaseModel):
    problem_id: str
    code_so_far: str = ""
    hint_number: int = 1
    elapsed_ms: int = 0


class AgentChatMessage(BaseModel):
    role: str  # "user" | "agent"
    content: str


class AgentChatRequest(BaseModel):
    problem_id: str
    message: str
    phase: str = "approach"  # "approach" | "debug" | "review"
    code: str = ""
    test_results: list = []
    approach_text: str = ""
    history: list[AgentChatMessage] = []


# ── Auth helper ───────────────────────────────────────────────────────────────

async def _resolve_token(authorization: str) -> tuple[str, bool, str]:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing token")
    token = authorization.split(" ", 1)[1]
    if demo_store.is_demo_token(token):
        return demo_store.get_demo_uid(token), True, token
    try:
        decoded = fb_auth.verify_id_token(token)
        return decoded["uid"], False, token
    except Exception as e:
        raise HTTPException(status_code=401, detail=str(e))


# ── Test runner ───────────────────────────────────────────────────────────────

async def _run_tests(language: str, source: str, tests: list[dict]) -> list[dict]:
    results: list[dict] = []
    for t in tests:
        res = await run_code(language=language, source=source, stdin=t.get("input", ""))
        actual = normalize_output(res["stdout"])
        expected = normalize_output(t.get("expected", ""))
        stderr = res.get("stderr", "")
        timed_out = res.get("timed_out", False)

        if timed_out:
            actual = ""
            stderr = f"Time limit exceeded"

        results.append({
            "input": t.get("input", ""),
            "expected": expected,
            "actual": actual,
            "stderr": stderr[:300] if stderr else "",
            "exit_code": res.get("exit_code"),
            "passed": actual == expected and not timed_out,
            "runtime_ms": res.get("runtime_ms"),
            "timed_out": timed_out,
        })
    return results


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/languages")
async def get_languages():
    """Return which languages the local runner supports."""
    return {"available": available_languages(), "default": "python"}


@router.get("/problem/{topic}")
async def get_problem_for_topic(topic: str, authorization: str = Header(...)):
    """Pick the right problem for a topic based on learner model — no LLM."""
    uid, is_demo, token = await _resolve_token(authorization)

    if is_demo:
        model = demo_store.get_model(token)
    else:
        model = await get_knowledge_model(uid)
    model = migrate_knowledge_model(model)

    topic_stat = model.get("topics", {}).get(topic, {})
    mastery = topic_stat.get("mastery", 0.0)

    events = demo_store.list_events(token) if is_demo else []
    solved_ids = [
        e.get("problem_id") for e in events
        if e.get("kind") in ("judge_submit", "solve_submit") and e.get("correct")
    ]

    problem = pick_problem_for_topic(topic, mastery, solved_ids)
    if not problem:
        raise HTTPException(status_code=404, detail=f"No problems available for topic: {topic}")

    return _problem_response(problem, mastery)


@router.get("/next/{current_problem_id}")
async def get_next_problem_endpoint(current_problem_id: str, authorization: str = Header(...)):
    """Get the next recommended problem after solving current one."""
    uid, is_demo, token = await _resolve_token(authorization)

    if is_demo:
        model = demo_store.get_model(token)
    else:
        model = await get_knowledge_model(uid)
    model = migrate_knowledge_model(model)

    current = get_problem(current_problem_id)
    if not current:
        raise HTTPException(status_code=404, detail="Problem not found")

    topic = current["topic"]
    mastery = model.get("topics", {}).get(topic, {}).get("mastery", 0.0)

    events = demo_store.list_events(token) if is_demo else []
    solved_ids = [
        e.get("problem_id") for e in events
        if e.get("kind") in ("judge_submit", "solve_submit") and e.get("correct")
    ]

    next_p = get_next_problem(current_problem_id, topic, mastery, solved_ids)
    if not next_p:
        return {"problem": None, "message": "No more problems for this topic"}

    return {"problem": _problem_response(next_p, mastery)}


@router.post("/run")
async def run_public_tests(req: RunRequest, authorization: str = Header(...)):
    """Run public test cases only — no LLM, no model update."""
    await _resolve_token(authorization)
    p = get_problem(req.problem_id)
    if not p:
        raise HTTPException(status_code=404, detail="Problem not found")

    started = time.time()
    results = await _run_tests(req.language, req.source, p["public_tests"])
    duration_ms = int((time.time() - started) * 1000)
    passed = sum(1 for r in results if r["passed"])

    return {
        "passed": passed,
        "total": len(results),
        "results": results,
        "duration_ms": duration_ms,
    }


@router.post("/hint")
async def get_hint(req: HintRequest, authorization: str = Header(...)):
    """Get a contextual hint — 1 LLM call, graceful fallback to static hints."""
    await _resolve_token(authorization)
    p = get_problem(req.problem_id)
    if not p:
        raise HTTPException(status_code=404, detail="Problem not found")

    static_hints = p.get("hints", [])
    hint_idx = min(req.hint_number - 1, len(static_hints) - 1)
    static_hint = static_hints[hint_idx] if static_hints else "Think about the pattern."

    # Try LLM hint — fall back to static if LLM fails
    hint_text = static_hint
    hint_level = req.hint_number
    try:
        prompt = SOLVE_HINT_PROMPT.format(
            lc=p["lc"],
            title=p["title"],
            topic=p["topic"],
            pattern=p["pattern"],
            code_so_far=req.code_so_far or "(no code yet)",
            hint_number=req.hint_number,
            elapsed_ms=req.elapsed_ms,
        )
        provider = get_provider()
        raw = await provider.complete_json(
            system="You are a DSA hint engine. Return only valid JSON with field 'hint' (string) and 'hint_level' (int). No markdown fences.",
            prompt=prompt,
        )
        parsed = parse_llm_json(raw)
        if parsed and isinstance(parsed, dict):
            hint_text = parsed.get("hint") or static_hint
            hint_level = parsed.get("hint_level") or req.hint_number
        else:
            import sys
            print(f"[hint] LLM returned unparseable JSON, raw={repr(raw[:200])}", file=sys.stderr)
    except Exception as exc:
        import sys
        print(f"[hint] LLM call failed: {exc}", file=sys.stderr)

    return {
        "hint": hint_text,
        "hint_level": hint_level,
        "problem_hints_count": len(static_hints),
    }


@router.post("/evaluate")
async def evaluate_attempt(req: EvaluateRequest, authorization: str = Header(...)):
    """
    Full attempt evaluation:
    1. Run local runner against all tests (public + hidden)
    2. Call LLM for behavioral + code analysis (1 call)
    3. Update brain model with all attempt signals
    4. Return evaluation + model delta + next problem suggestion
    """
    uid, is_demo, token = await _resolve_token(authorization)
    p = get_problem(req.problem_id)
    if not p:
        raise HTTPException(status_code=404, detail="Problem not found")

    # ── Step 1: Run all tests ─────────────────────────────────────────────
    started = time.time()
    public_results = await _run_tests(req.language, req.source, p["public_tests"])
    hidden_results = await _run_tests(req.language, req.source, p["hidden_tests"])
    runner_ms = int((time.time() - started) * 1000)

    total_tests = len(public_results) + len(hidden_results)
    passed_tests = sum(1 for r in public_results + hidden_results if r["passed"])
    correct = passed_tests == total_tests and total_tests > 0

    # Detect TLE
    any_tle = any(r.get("timed_out") for r in public_results + hidden_results)

    failing = [r for r in public_results + hidden_results if not r["passed"]][:3]
    failing_summary = json.dumps([
        {
            "input": f["input"][:80],
            "expected": f["expected"],
            "actual": f["actual"][:80],
            "stderr": f["stderr"][:100] if f.get("stderr") else "",
        }
        for f in failing
    ])

    # ── Step 2: Load brain model ──────────────────────────────────────────
    if is_demo:
        model = demo_store.get_model(token)
    else:
        model = await get_knowledge_model(uid)
    model = migrate_knowledge_model(model)

    topic_stat = model.get("topics", {}).get(p["topic"], {})
    mastery = topic_stat.get("mastery", 0.0)

    # ── Step 3: LLM behavioral evaluation (1 call) ───────────────────────
    eval_prompt = SOLVE_EVALUATE_PROMPT.format(
        lc=p["lc"],
        title=p["title"],
        topic=p["topic"],
        pattern=p["pattern"],
        expected_time=p["expected_complexity"]["time"],
        expected_space=p["expected_complexity"]["space"],
        passed=passed_tests,
        total=total_tests,
        failing_tests=failing_summary,
        source_code=req.source[:2000],
        approach_written=req.attempt_log.approach_written,
        approach_text=req.attempt_log.approach_text[:500] or "(none)",
        first_keystroke_ms=req.attempt_log.first_keystroke_ms,
        total_time_ms=req.attempt_log.total_time_ms,
        num_runs=req.attempt_log.num_runs,
        hints_requested=req.attempt_log.hints_requested,
        language=req.language,
        mastery=mastery,
    )

    provider = get_provider()
    evaluation: dict
    try:
        raw = await provider.complete_json(
            system="You are a DSA solution evaluator. Return only valid JSON. No markdown fences.",
            prompt=eval_prompt,
        )
        evaluation = parse_llm_json(raw) or {}
        if not isinstance(evaluation, dict) or not evaluation:
            import sys
            print(f"[evaluate] parse failed, raw={repr(raw[:300])}", file=sys.stderr)
            raise ValueError("empty or non-dict LLM response")
    except Exception:
        # Heuristic-only fallback (no LLM needed)
        stderr_any = any(r.get("stderr") for r in public_results)
        evaluation = {
            "correct": correct,
            "approach_quality": 0.7 if req.attempt_log.approach_written else 0.3,
            "error_fingerprint": (
                None if correct else
                "TLE_timeout" if any_tle else
                "syntax_error" if stderr_any else
                "incomplete_solution"
            ),
            "optimality_score": {
                "time_complexity": 0.8 if correct else 0.3,
                "space_complexity": 0.7 if correct else 0.3,
                "code_clarity": 0.6,
                "overall_optimality": 0.7 if correct else 0.3,
            },
            "feedback": (
                "All tests passed." if correct else
                "Time limit exceeded — optimize your algorithm." if any_tle else
                f"{passed_tests}/{total_tests} tests passed."
            ),
            "pattern_insight": f"Pattern: {p['pattern']}",
            "approach_feedback": "Approach noted." if req.attempt_log.approach_written else "Write your approach first — it helps catch bugs early.",
            "next_step": "" if correct else "Review failing test cases above.",
            "mastery_signal": "improve" if correct else "maintain",
            "behavioral_notes": _behavioral_notes(req.attempt_log, correct),
        }

    # Inject behavioral notes if LLM didn't include them
    if "behavioral_notes" not in evaluation:
        evaluation["behavioral_notes"] = _behavioral_notes(req.attempt_log, correct)

    # ── Step 4: Update brain model ────────────────────────────────────────
    approach_quality = float(evaluation.get("approach_quality", 0.5))
    confidence_signal = approach_quality if req.attempt_log.approach_written else None

    model = update_mastery(
        topic=p["topic"],
        correct=correct,
        time_ms=req.attempt_log.total_time_ms or 60000,
        hint_used=req.attempt_log.hints_requested > 0,
        model=model,
        pattern=p.get("pattern"),
        hesitation_ms=req.attempt_log.first_keystroke_ms or None,
        error_fingerprint=evaluation.get("error_fingerprint"),
        confidence_signal=confidence_signal,
    )

    new_mastery = model.get("topics", {}).get(p["topic"], {}).get("mastery", mastery)
    mastery_delta = round(new_mastery - mastery, 4)
    model = update_readiness(model)

    # ── Step 5: Find next problem ─────────────────────────────────────────
    events = demo_store.list_events(token) if is_demo else []
    solved_ids = [
        e.get("problem_id") for e in events
        if e.get("kind") in ("judge_submit", "solve_submit") and e.get("correct")
    ]
    if correct:
        solved_ids.append(req.problem_id)

    next_p = get_next_problem(req.problem_id, p["topic"], new_mastery, solved_ids)

    # ── Step 6: Persist ───────────────────────────────────────────────────
    event = {
        "kind": "solve_submit",
        "problem_id": req.problem_id,
        "topic": p["topic"],
        "pattern": p["pattern"],
        "correct": correct,
        "passed": passed_tests,
        "total": total_tests,
        "language": req.language,
        "total_time_ms": req.attempt_log.total_time_ms,
        "first_keystroke_ms": req.attempt_log.first_keystroke_ms,
        "approach_written": req.attempt_log.approach_written,
        "approach_quality": approach_quality,
        "num_runs": req.attempt_log.num_runs,
        "hints_requested": req.attempt_log.hints_requested,
        "error_fingerprint": evaluation.get("error_fingerprint"),
        "mastery_delta": mastery_delta,
        "timed_out": any_tle,
    }

    if is_demo:
        demo_store.save_model(token, model)
        demo_store.append_event(token, event)
    else:
        await save_knowledge_model(uid, model)
        try:
            await append_event(uid, event)
        except Exception:
            pass

    return {
        "correct": correct,
        "passed": passed_tests,
        "total": total_tests,
        "timed_out": any_tle,
        "evaluation": evaluation,
        "public_results": public_results,
        "hidden_results": [
            {**r, "input": "<hidden>", "expected": "<hidden>"}
            for r in hidden_results
        ],
        "mastery_delta": mastery_delta,
        "new_mastery": round(new_mastery, 4),
        "runner_ms": runner_ms,
        "topic": p["topic"],
        "pattern": p["pattern"],
        "next_problem": _problem_response(next_p, new_mastery) if next_p else None,
    }


@router.post("/agent")
async def solve_agent_chat(req: AgentChatRequest, authorization: str = Header(...)):
    """
    Context-aware coaching agent for the solve page.
    - approach phase: evaluates approach text, asks probing questions
    - debug phase: analyzes failing tests + code to pinpoint bugs
    - review phase: post-solve quality assessment
    1 LLM call per message. Heuristic fallback if LLM fails.
    """
    await _resolve_token(authorization)
    p = get_problem(req.problem_id)
    if not p:
        raise HTTPException(status_code=404, detail="Problem not found")

    # Build phase-specific context
    if req.phase == "approach":
        phase_context = f"Learner's approach so far:\n{req.approach_text or '(no approach written yet)'}"
    elif req.phase == "debug":
        failing = [t for t in req.test_results if not t.get("passed")][:3]
        fail_str = "\n".join(
            f"  input={t.get('input','?')[:60]} expected={t.get('expected','?')} got={t.get('actual','?')[:60]} stderr={t.get('stderr','')[:80]}"
            for t in failing
        ) or "(no failing tests)"
        phase_context = f"Failing test cases:\n{fail_str}\n\nCurrent code:\n{req.code[:1500]}"
    else:
        phase_context = f"Final code submitted:\n{req.code[:1500]}"

    history_text = "\n".join(
        f"{'Learner' if m.role == 'user' else 'Agent'}: {m.content}"
        for m in req.history[-6:]
    ) or "(start of conversation)"

    prompt = SOLVE_AGENT_PROMPT.format(
        lc=p["lc"],
        title=p["title"],
        topic=p["topic"],
        pattern=p["pattern"],
        difficulty=p["difficulty"],
        statement=p["statement"][:400],
        expected_time=p["expected_complexity"]["time"],
        expected_space=p["expected_complexity"]["space"],
        phase=req.phase,
        phase_context=phase_context,
        history=history_text,
        message=req.message,
    )

    provider = get_provider()
    result: dict
    try:
        raw = await provider.complete_json(
            system="You are a DSA coaching agent. Return only valid JSON. No markdown fences, no extra text.",
            prompt=prompt,
            max_tokens=500,
            temperature=0.3,
        )
        result = parse_llm_json(raw) or {}
        if not isinstance(result, dict) or not result:
            import sys
            print(f"[agent] parse failed, raw={repr(raw[:300])}", file=sys.stderr)
            raise ValueError("empty or non-dict LLM response")
    except Exception as exc:
        import sys
        print(f"[agent] LLM error (phase={req.phase}): {exc}", file=sys.stderr)
        # Heuristic fallback
        if req.phase == "approach":
            response = "Write out your approach before coding. What data structure will you use, and what is the time complexity?"
        elif req.phase == "debug":
            response = f"Check the failing test cases carefully. Trace through your code with the first failing input step by step."
        else:
            response = f"Compare your solution's complexity against the expected {p['expected_complexity']['time']} time complexity."
        result = {
            "response": response,
            "approach_score": None,
            "approach_verdict": None,
            "hint": None,
            "next_focus": "Think through the problem step by step.",
        }

    return {
        "response": result.get("response", ""),
        "approach_score": result.get("approach_score"),
        "approach_verdict": result.get("approach_verdict"),
        "hint": result.get("hint"),
        "next_focus": result.get("next_focus", ""),
        "phase": req.phase,
    }


class AutopsyRequest(BaseModel):
    problem_id: str
    code: str = ""
    language: str = "python"
    test_results: list = []
    q1_answer: str = ""   # "Describe your planned approach / pattern"
    q2_answer: str = ""   # "Walk through what your code does step by step"
    q3_answer: str = ""   # "What edge cases did you consider?"


@router.post("/autopsy")
async def cognitive_autopsy(req: AutopsyRequest, authorization: str = Header(...)):
    """
    Cognitive Autopsy: after a wrong answer, pinpoint which cognitive layer failed.
    5 layers: Pattern Recognition → Algorithm Design → Code Translation
              → Edge Case Handling → Complexity Analysis
    1 LLM call → structured layer verdicts + diagnosis + targeted fix.
    """
    await _resolve_token(authorization)
    p = get_problem(req.problem_id)
    if not p:
        raise HTTPException(status_code=404, detail="Problem not found")

    failing = [r for r in req.test_results if not r.get("passed")][:3]
    fail_summary = "\n".join(
        f"  input={f.get('input','?')[:60]} expected={f.get('expected','?')} got={f.get('actual','?')[:60]}"
        + (f" stderr={f['stderr'][:80]}" if f.get("stderr") else "")
        for f in failing
    ) or "(no test result data)"

    prompt = f"""You are conducting a Cognitive Autopsy for a failed DSA attempt.

PROBLEM: LC {p['lc']} — {p['title']}
Topic: {p['topic']} | Pattern: {p['pattern']}
Expected complexity: {p['expected_complexity']['time']} time, {p['expected_complexity']['space']} space

FAILING TESTS:
{fail_summary}

SUBMITTED CODE ({req.language}):
{req.code[:1500]}

CANDIDATE'S SELF-REPORT:
Q1 (Planned approach / pattern identified): {req.q1_answer or '(no answer)'}
Q2 (Code walkthrough — what they think the code does): {req.q2_answer or '(no answer)'}
Q3 (Edge cases considered): {req.q3_answer or '(no answer)'}

TASK: Analyze which cognitive layer is the true failure point.

The 5 layers in order:
1. Pattern Recognition — did they identify the correct algorithm/pattern?
2. Algorithm Design — was their mental logic correct?
3. Code Translation — did the implementation match their mental model?
4. Edge Case Handling — did they handle null/empty/boundary cases?
5. Complexity Analysis — did they achieve the required time/space complexity?

Return JSON with this exact structure:
{{
  "layers": [
    {{"id": 1, "name": "Pattern Recognition", "status": "pass"|"fail"|"skip", "note": "one sentence"}},
    {{"id": 2, "name": "Algorithm Design", "status": "pass"|"fail"|"skip", "note": "one sentence"}},
    {{"id": 3, "name": "Code Translation", "status": "pass"|"fail"|"skip", "note": "one sentence"}},
    {{"id": 4, "name": "Edge Case Handling", "status": "pass"|"fail"|"skip", "note": "one sentence"}},
    {{"id": 5, "name": "Complexity Analysis", "status": "pass"|"fail"|"skip", "note": "one sentence"}}
  ],
  "failure_layer": 1-5,
  "diagnosis": "2-3 sentence precise diagnosis of what broke and why",
  "fix": "2-3 sentence prescription — what to practice, NOT 'study more algorithms'",
  "drill_type": "pattern_drills"|"logic_drills"|"translation_drills"|"edge_case_drills"|"complexity_drills"
}}

Rules:
- "skip" means that layer was never reached because an earlier layer failed
- Be brutally precise — "you lost the complement relationship when naming variables" not "code has bugs"
- The fix must be specific: "3 translation drills where you implement the same logic in 2 languages" not "practice more"
- Only ONE layer should be "fail". Mark it as the earliest layer where failure occurred."""

    provider = get_provider()
    try:
        raw = await provider.complete_json(
            system="You are a cognitive failure analyst for DSA problems. Return only valid JSON. No markdown fences.",
            prompt=prompt,
            max_tokens=700,
            temperature=0.2,
        )
        result = parse_llm_json(raw) or {}
        if not isinstance(result, dict) or "layers" not in result:
            raise ValueError("bad response")
    except Exception as exc:
        import sys
        print(f"[autopsy] LLM error: {exc}", file=sys.stderr)
        # Heuristic fallback based on Q answers and test results
        has_stderr = any(r.get("stderr") for r in req.test_results)
        q1_weak = len(req.q1_answer.strip()) < 20
        q2_weak = len(req.q2_answer.strip()) < 20

        if q1_weak:
            fail_layer = 1
        elif q2_weak:
            fail_layer = 2
        elif has_stderr:
            fail_layer = 3
        else:
            fail_layer = 3  # most common

        layer_names = ["Pattern Recognition", "Algorithm Design", "Code Translation",
                       "Edge Case Handling", "Complexity Analysis"]
        drill_map = {1: "pattern_drills", 2: "logic_drills", 3: "translation_drills",
                     4: "edge_case_drills", 5: "complexity_drills"}

        layers = []
        for i, name in enumerate(layer_names, 1):
            if i < fail_layer:
                layers.append({"id": i, "name": name, "status": "pass", "note": "Appears intact based on your answers."})
            elif i == fail_layer:
                layers.append({"id": i, "name": name, "status": "fail", "note": "This is where the breakdown occurred."})
            else:
                layers.append({"id": i, "name": name, "status": "skip", "note": "Never reached."})

        result = {
            "layers": layers,
            "failure_layer": fail_layer,
            "diagnosis": f"The failure occurred at layer {fail_layer} ({layer_names[fail_layer-1]}). Your code did not correctly implement your intended logic.",
            "fix": f"Run 3 targeted {drill_map[fail_layer].replace('_',' ')} focused specifically on {p['pattern'].replace('_',' ')} pattern. Not more algorithm study — that's the wrong medicine.",
            "drill_type": drill_map[fail_layer],
        }

    return result


# ── Helpers ────────────────────────────────────────────────────────────────────

def _problem_response(problem: dict, mastery: float) -> dict:
    return {
        "id": problem["id"],
        "lc": problem["lc"],
        "title": problem["title"],
        "topic": problem["topic"],
        "pattern": problem["pattern"],
        "difficulty": problem["difficulty"],
        "statement": problem["statement"],
        "constraints": problem["constraints"],
        "examples": problem["examples"],
        "hints": problem["hints"],
        "expected_complexity": problem["expected_complexity"],
        "starter_code": problem["starter_code"],
        "public_tests": problem["public_tests"],
        "languages": list(problem["starter_code"].keys()),
        "learner_mastery": mastery,
    }


def _behavioral_notes(log: AttemptLog, correct: bool) -> str:
    notes = []
    if log.first_keystroke_ms > 60000:
        notes.append("Long hesitation before first keystroke — likely re-reading problem or planning.")
    elif log.first_keystroke_ms < 5000 and not correct:
        notes.append("Started coding immediately but got it wrong — consider thinking through approach first.")

    if log.hints_requested == 0 and correct:
        notes.append("Solved without hints — strong independent problem solving.")
    elif log.hints_requested >= 3:
        notes.append("Heavy hint usage — the core pattern may not be internalized yet.")

    if log.num_runs == 0:
        notes.append("Submitted without running — try 'Run' first to catch obvious errors.")
    elif log.num_runs >= 5:
        notes.append("Many run attempts before submit — consider tracing through the logic manually first.")

    if not log.approach_written and not correct:
        notes.append("No approach written before coding. Writing the approach helps catch edge cases early.")

    return " ".join(notes) if notes else "Attempt recorded."

"""
Interview Simulation Mode — "The Final Boss"

POST /interview/check      — check if user is ready for interview mode on a topic
POST /interview/start      — start an interview session, returns problem + timer
POST /interview/submit     — submit solution, run all tests, generate debrief
"""

from __future__ import annotations

import json
import time
from typing import Optional

from fastapi import APIRouter, HTTPException, Header
from pydantic import BaseModel

import firebase_admin.auth as fb_auth

from data.coding_problems import get_problem, list_problems, CODING_PROBLEMS
from services import demo_store
from services.runner import run_code as _runner_run, normalize_output, available_languages
from services.firestore import get_knowledge_model, save_knowledge_model
from services.llm_client import get_provider
from models.knowledge import migrate_knowledge_model
from prompts.interview import INTERVIEWER_DEBRIEF_PROMPT

router = APIRouter(prefix="/interview", tags=["interview"])

INTERVIEW_TIME_LIMIT_MIN = 45
RUNNER_TIMEOUT_S = 8.0
READY_MASTERY_THRESHOLD = 0.70


class CheckReadyRequest(BaseModel):
    topic: str


class StartRequest(BaseModel):
    topic: str
    problem_id: Optional[str] = None  # specific problem, else auto-pick hardest unlocked


class SubmitRequest(BaseModel):
    problem_id: str
    language: str = "python"
    source: str
    time_used_ms: int
    approach_notes: str = ""
    num_runs: int = 0
    hints_requested: int = 0
    first_keystroke_ms: int = 0


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


async def _run_tests(language: str, source: str, tests: list[dict]) -> list[dict]:
    results = []
    for t in tests:
        r = await _runner_run(language=language, source=source,
                              stdin=t.get("input", ""), timeout_s=RUNNER_TIMEOUT_S)
        actual = normalize_output(r.get("stdout", ""))
        expected = normalize_output(t.get("expected", ""))
        results.append({
            "input": t.get("input", ""),
            "expected": expected,
            "actual": actual,
            "passed": actual == expected,
            "stderr": r.get("stderr", "")[:200],
            "runtime_ms": r.get("runtime_ms"),
        })
    return results


@router.post("/check")
async def check_ready(req: CheckReadyRequest, authorization: str = Header(...)):
    """Check if user's mastery qualifies them for interview mode on this topic."""
    uid, is_demo, token = await _resolve_token(authorization)
    model = demo_store.get_model(token) if is_demo else await get_knowledge_model(uid)
    model = migrate_knowledge_model(model)

    topic_stat = model.get("topics", {}).get(req.topic, {})
    mastery = topic_stat.get("mastery", topic_stat.get("knowledge", 0))
    attempts = topic_stat.get("attempts", 0)
    correct = topic_stat.get("correct", 0)
    hints = topic_stat.get("hintRequests", 0)
    avg_time_s = int((topic_stat.get("avgTimeMs", 60000)) / 1000)

    ready = mastery >= READY_MASTERY_THRESHOLD and attempts >= 3

    if ready:
        reason = f"Mastery {round(mastery * 100)}% — ready for cold interview conditions."
    elif mastery < READY_MASTERY_THRESHOLD:
        gap = round((READY_MASTERY_THRESHOLD - mastery) * 100)
        reason = f"Need {gap}% more mastery. Keep solving — you're close."
    else:
        reason = f"Only {attempts} attempts. Practice more problems on this topic first."

    return {
        "ready": ready,
        "mastery": round(mastery, 3),
        "threshold": READY_MASTERY_THRESHOLD,
        "reason": reason,
        "time_limit_min": INTERVIEW_TIME_LIMIT_MIN,
    }


@router.post("/start")
async def start_interview(req: StartRequest, authorization: str = Header(...)):
    """Start an interview session. Returns the hardest unlocked problem on the topic."""
    uid, is_demo, token = await _resolve_token(authorization)
    model = demo_store.get_model(token) if is_demo else await get_knowledge_model(uid)
    model = migrate_knowledge_model(model)

    topic_stat = model.get("topics", {}).get(req.topic, {})
    mastery = topic_stat.get("mastery", topic_stat.get("knowledge", 0))

    if mastery < READY_MASTERY_THRESHOLD:
        raise HTTPException(status_code=403, detail=f"Mastery {round(mastery*100)}% below threshold {round(READY_MASTERY_THRESHOLD*100)}%")

    if req.problem_id:
        p = get_problem(req.problem_id)
        if not p:
            raise HTTPException(status_code=404, detail="Problem not found")
    else:
        # Pick hardest problem for this topic that user hasn't solved in interview mode
        events = demo_store.list_events(token, limit=200) if is_demo else []
        interview_solved = {e.get("problem_id") for e in events if e.get("kind") == "interview_submit" and e.get("correct")}
        candidates = [pp for pp in CODING_PROBLEMS if pp["topic"] == req.topic and pp["id"] not in interview_solved]
        if not candidates:
            candidates = [pp for pp in CODING_PROBLEMS if pp["topic"] == req.topic]
        candidates.sort(key=lambda x: x.get("difficulty", 5), reverse=True)
        p = candidates[0] if candidates else None

    if not p:
        raise HTTPException(status_code=404, detail=f"No problems found for topic: {req.topic}")

    available_langs = available_languages()
    filtered_langs = [l for l in p.get("languages", ["python"]) if l in available_langs]

    return {
        "problem": {
            "id": p["id"],
            "title": p["title"],
            "description": p["description"],
            "examples": p.get("examples", []),
            "constraints": p.get("constraints", []),
            "difficulty": p.get("difficulty", 5),
            "pattern": p.get("pattern", ""),
            "starter_code": {l: p["starter_code"][l] for l in filtered_langs if l in p.get("starter_code", {})},
            "languages": filtered_langs,
            "public_tests": p.get("public_tests", []),
        },
        "time_limit_min": INTERVIEW_TIME_LIMIT_MIN,
        "rules": [
            "No hints available.",
            "No looking up solutions.",
            f"{INTERVIEW_TIME_LIMIT_MIN} minutes. Code like it counts.",
            "You will receive a mock interviewer debrief when done.",
        ],
    }


@router.post("/submit")
async def submit_interview(req: SubmitRequest, authorization: str = Header(...)):
    """Run all tests + generate mock interviewer debrief."""
    uid, is_demo, token = await _resolve_token(authorization)
    model = demo_store.get_model(token) if is_demo else await get_knowledge_model(uid)
    model = migrate_knowledge_model(model)

    p = get_problem(req.problem_id)
    if not p:
        raise HTTPException(status_code=404, detail="Problem not found")

    if req.language not in available_languages():
        raise HTTPException(status_code=400, detail=f"Language {req.language} not supported")

    # Run all tests (public + hidden)
    all_tests = p.get("public_tests", []) + p.get("hidden_tests", [])
    results = await _run_tests(req.language, req.source, all_tests)
    passed = sum(1 for r in results if r["passed"])
    total = len(results)
    correct = passed == total

    # Build public-only results for display (hide hidden test inputs)
    pub_count = len(p.get("public_tests", []))
    public_results = results[:pub_count]
    # Hidden: show pass/fail only, no input/expected
    hidden_results = [
        {"passed": r["passed"], "runtime_ms": r["runtime_ms"]} for r in results[pub_count:]
    ]

    time_used_min = round(req.time_used_ms / 60000, 1)

    # Generate interviewer debrief via LLM
    provider = get_provider()
    debrief: dict
    try:
        raw = await provider.complete_json(
            system="You are a senior tech interviewer. Return only valid JSON.",
            prompt=INTERVIEWER_DEBRIEF_PROMPT.format(
                problem_title=p["title"],
                difficulty=p.get("difficulty", 5),
                pattern=p.get("pattern", "unknown"),
                time_used_min=time_used_min,
                time_limit_min=INTERVIEW_TIME_LIMIT_MIN,
                tests_passed=passed,
                tests_total=total,
                language=req.language,
                source_code=req.source[:1500],
                approach_notes=req.approach_notes[:300] or "(none)",
                num_runs=req.num_runs,
                hints_requested=req.hints_requested,
                first_keystroke_s=round(req.first_keystroke_ms / 1000, 1),
            ),
            max_tokens=600,
            temperature=0.3,
        )
        debrief = json.loads(raw) if isinstance(raw, str) else raw
        if not isinstance(debrief, dict):
            raise ValueError("Non-dict")
    except Exception:
        # Heuristic fallback
        debrief = _heuristic_debrief(p, passed, total, time_used_min, correct, req)

    # Record event
    event = {
        "kind": "interview_submit",
        "problem_id": req.problem_id,
        "topic": p["topic"],
        "correct": correct,
        "passed": passed,
        "total": total,
        "time_used_min": time_used_min,
        "verdict": debrief.get("verdict", "No Hire"),
    }
    if is_demo:
        demo_store.add_event(token, event)
    else:
        from services.firestore import append_event
        await append_event(uid, event)

    return {
        "passed": passed,
        "total": total,
        "correct": correct,
        "time_used_min": time_used_min,
        "public_results": public_results,
        "hidden_results": hidden_results,
        "debrief": debrief,
    }


def _heuristic_debrief(p: dict, passed: int, total: int, time_used_min: float, correct: bool, req: SubmitRequest) -> dict:
    verdict = "Strong Hire" if correct and time_used_min < 25 else "Hire" if correct else "Borderline" if passed / max(total, 1) > 0.6 else "No Hire"
    return {
        "verdict": verdict,
        "pattern_recognition_verdict": f"Approached {p.get('pattern', 'the problem')} pattern",
        "time_verdict": "Finished with time to spare" if time_used_min < 35 else "Finished just in time" if time_used_min <= 45 else "Did not finish in time",
        "correctness": f"All {total} test cases passed" if correct else f"{passed}/{total} test cases passed",
        "edge_cases_missed": [] if correct else ["Check boundary conditions"],
        "code_quality": "Readable structure with clear variable names." if correct else "Syntax is correct. Logic needs review.",
        "complexity_assessment": "Optimal or near-optimal solution." if correct else "Solution has correctness issues — complexity assessment skipped.",
        "what_would_cost_the_offer": None if verdict == "Strong Hire" else "Failed to pass all test cases under interview conditions.",
        "strongest_signal": "Completed the problem" if correct else "Attempted the problem and got partial credit",
        "interviewer_closing": "We will be in touch." if correct else "Thank you for your time. Keep practicing.",
    }

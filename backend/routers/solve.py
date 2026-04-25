"""
Solve endpoints — NeetCode-style problem solving flow.

Optimized for minimum LLM calls:
  GET  /solve/problem/{topic}   — rule-based problem pick (0 LLM calls)
  POST /solve/hint              — contextual hint (1 LLM call)
  POST /solve/evaluate          — full attempt evaluation (1 LLM call + Piston)

The WebSocket session is for concept discussion. This is for actual problem solving.
"""

from __future__ import annotations

import asyncio
import json
import os
import time
from typing import Optional

import httpx
from fastapi import APIRouter, HTTPException, Header
from pydantic import BaseModel

import firebase_admin.auth as fb_auth

from data.coding_problems import (
    CODING_PROBLEMS,
    PISTON_LANGUAGE_VERSIONS,
    get_problem,
    pick_problem_for_topic,
)
from prompts.solve import SOLVE_EVALUATE_PROMPT, SOLVE_HINT_PROMPT
from services import demo_store
from services.firestore import get_knowledge_model, save_knowledge_model, append_event
from services.llm_client import get_provider
from models.knowledge import update_mastery, migrate_knowledge_model, update_readiness


router = APIRouter(prefix="/solve", tags=["solve"])

PISTON_URL = os.environ.get("PISTON_URL", "https://emkc.org/api/v2/piston/execute")
PISTON_TIMEOUT_S = float(os.environ.get("PISTON_TIMEOUT_S", "12"))


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


# ── Piston helpers ────────────────────────────────────────────────────────────

async def _piston_execute(*, language: str, source: str, stdin: str) -> dict:
    cfg = PISTON_LANGUAGE_VERSIONS.get(language)
    if not cfg:
        raise HTTPException(status_code=400, detail=f"Unsupported language: {language}")
    payload = {
        "language": cfg["language"],
        "version": cfg["version"],
        "files": [{"content": source}],
        "stdin": stdin,
    }
    try:
        async with httpx.AsyncClient(timeout=PISTON_TIMEOUT_S) as client:
            r = await client.post(PISTON_URL, json=payload)
            r.raise_for_status()
            return r.json()
    except httpx.HTTPError as e:
        raise HTTPException(status_code=502, detail=f"Judge unavailable: {e}")


def _normalize(text: str) -> str:
    return (text or "").strip().replace("\r\n", "\n")


async def _run_tests(language: str, source: str, tests: list[dict]) -> list[dict]:
    results: list[dict] = []
    for t in tests:
        res = await _piston_execute(language=language, source=source, stdin=t.get("input", ""))
        run = (res or {}).get("run") or {}
        actual = _normalize(run.get("stdout", ""))
        expected = _normalize(t.get("expected", ""))
        results.append({
            "input": t.get("input", ""),
            "expected": expected,
            "actual": actual,
            "stderr": run.get("stderr", ""),
            "exit_code": run.get("code"),
            "passed": actual == expected,
            "runtime_ms": run.get("runtime") or run.get("wall_time"),
        })
        await asyncio.sleep(0.1)
    return results


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/problem/{topic}")
async def get_problem_for_topic(topic: str, authorization: str = Header(...)):
    """Pick the right problem for a topic based on learner's model — no LLM."""
    uid, is_demo, token = await _resolve_token(authorization)

    if is_demo:
        model = demo_store.get_model(token)
    else:
        model = await get_knowledge_model(uid)
    model = migrate_knowledge_model(model)

    topic_stat = model.get("topics", {}).get(topic, {})
    mastery = topic_stat.get("mastery", 0.0)

    # Get recently solved problems from events
    events = demo_store.list_events(token) if is_demo else []
    solved_ids = [
        e.get("problem_id") for e in events
        if e.get("kind") in ("judge_submit", "solve_submit") and e.get("correct")
    ]

    problem = pick_problem_for_topic(topic, mastery, solved_ids)
    if not problem:
        raise HTTPException(status_code=404, detail=f"No problems available for topic: {topic}")

    # Don't return hidden tests
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
    """Get a contextual hint — 1 LLM call."""
    await _resolve_token(authorization)
    p = get_problem(req.problem_id)
    if not p:
        raise HTTPException(status_code=404, detail="Problem not found")

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
    result = await provider.complete_json(system="You are a DSA hint engine. Return only valid JSON.", prompt=prompt)
    return {
        "hint": result.get("hint", p["hints"][min(req.hint_number - 1, len(p["hints"]) - 1)]),
        "hint_level": result.get("hint_level", req.hint_number),
        "problem_hints_count": len(p["hints"]),
    }


@router.post("/evaluate")
async def evaluate_attempt(req: EvaluateRequest, authorization: str = Header(...)):
    """
    Full attempt evaluation:
    1. Run Piston against all tests (public + hidden)
    2. Call LLM for rich holistic evaluation
    3. Update brain model with all attempt signals
    4. Return evaluation + model delta
    """
    uid, is_demo, token = await _resolve_token(authorization)
    p = get_problem(req.problem_id)
    if not p:
        raise HTTPException(status_code=404, detail="Problem not found")

    # ── Step 1: Run all tests ─────────────────────────────────────────────
    started = time.time()
    public_results = await _run_tests(req.language, req.source, p["public_tests"])
    hidden_results = await _run_tests(req.language, req.source, p["hidden_tests"])
    piston_ms = int((time.time() - started) * 1000)

    total_tests = len(public_results) + len(hidden_results)
    passed_tests = sum(1 for r in public_results + hidden_results if r["passed"])
    correct = passed_tests == total_tests

    failing = [r for r in public_results + hidden_results if not r["passed"]][:3]
    failing_summary = json.dumps(
        [{"input": f["input"][:80], "expected": f["expected"], "actual": f["actual"][:80]} for f in failing]
    )

    # ── Step 2: Load brain model ──────────────────────────────────────────
    if is_demo:
        model = demo_store.get_model(token)
    else:
        model = await get_knowledge_model(uid)
    model = migrate_knowledge_model(model)

    topic_stat = model.get("topics", {}).get(p["topic"], {})
    mastery = topic_stat.get("mastery", 0.0)

    # ── Step 3: LLM holistic evaluation (1 call) ─────────────────────────
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
    try:
        evaluation = await provider.complete_json(
            system="You are a DSA solution evaluator. Return only valid JSON.",
            prompt=eval_prompt,
        )
    except Exception:
        # Fallback: heuristic-only evaluation
        evaluation = {
            "correct": correct,
            "approach_quality": 0.7 if req.attempt_log.approach_written else 0.3,
            "error_fingerprint": None if correct else (
                "syntax_error" if any(r["stderr"] for r in public_results) else "incomplete_solution"
            ),
            "optimality_score": {"time_complexity": 0.5, "space_complexity": 0.5, "code_clarity": 0.5, "overall_optimality": 0.5},
            "feedback": "All tests passed." if correct else f"{passed_tests}/{total_tests} tests passed.",
            "pattern_insight": "",
            "approach_feedback": "Approach noted." if req.attempt_log.approach_written else "No approach written.",
            "next_step": "",
            "mastery_signal": "improve" if correct else "maintain",
        }

    # ── Step 4: Update brain model ────────────────────────────────────────
    approach_quality = evaluation.get("approach_quality", 0.5)
    # Approach bonus: writing approach before coding → positive signal for confidence
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

    # ── Step 5: Persist ───────────────────────────────────────────────────
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
        "evaluation": evaluation,
        "public_results": public_results,
        "hidden_results": [
            {**r, "input": "<hidden>", "expected": "<hidden>"}
            for r in hidden_results
        ],
        "mastery_delta": mastery_delta,
        "new_mastery": round(new_mastery, 4),
        "piston_ms": piston_ms,
        "topic": p["topic"],
        "pattern": p["pattern"],
    }

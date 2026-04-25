"""
Code execution sandbox endpoints. Uses local subprocess runner.

POST /judge/problems         — list available problems
GET  /judge/problems/{id}    — full problem (statement, starter, public tests)
GET  /judge/languages        — available runtimes
POST /judge/run              — run public tests only
POST /judge/submit           — run public + hidden tests, update brain model
"""

from __future__ import annotations

import time
from typing import Optional

from fastapi import APIRouter, HTTPException, Header
from pydantic import BaseModel

import firebase_admin.auth as fb_auth

from data.coding_problems import (
    CODING_PROBLEMS,
    list_problems,
    get_problem,
)
from services import demo_store
from services.runner import run_code as _runner_run, normalize_output, available_languages
from services.firestore import (
    get_knowledge_model,
    save_knowledge_model,
    append_event,
)
from models.knowledge import update_mastery, migrate_knowledge_model


router = APIRouter(prefix="/judge", tags=["judge"])

RUNNER_TIMEOUT_S = 8.0


class RunRequest(BaseModel):
    problem_id: str
    language: str = "python"
    source: str
    custom_input: Optional[str] = None


class SubmitRequest(BaseModel):
    problem_id: str
    language: str = "python"
    source: str
    time_ms: int = 60000
    first_input_ms: int = 0
    thought_trace: Optional[str] = None


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


async def _run_test_cases(language: str, source: str, tests: list[dict]) -> list[dict]:
    results: list[dict] = []
    for t in tests:
        result = await _runner_run(
            language=language,
            source=source,
            stdin=t.get("input", ""),
            timeout_s=RUNNER_TIMEOUT_S,
        )
        actual = normalize_output(result.get("stdout", ""))
        expected = normalize_output(t.get("expected", ""))
        timed_out = result.get("timed_out", False)
        passed = (not timed_out) and result.get("exit_code", 1) == 0 and actual == expected
        results.append({
            "input": t.get("input", ""),
            "expected": expected,
            "actual": actual,
            "stderr": result.get("stderr", ""),
            "exit_code": result.get("exit_code"),
            "passed": passed,
            "timed_out": timed_out,
            "runtime_ms": result.get("runtime_ms"),
        })
    return results


@router.get("/languages")
async def languages_list():
    return {"languages": available_languages()}


@router.get("/problems")
async def problems_list(_: str = Header("", alias="Authorization")):
    return {"problems": list_problems()}


@router.get("/problems/{problem_id}")
async def problem_detail(problem_id: str, _: str = Header("", alias="Authorization")):
    p = get_problem(problem_id)
    if not p:
        raise HTTPException(status_code=404, detail="Problem not found")
    return {
        "id": p["id"],
        "lc": p["lc"],
        "title": p["title"],
        "topic": p["topic"],
        "pattern": p["pattern"],
        "difficulty": p["difficulty"],
        "statement": p["statement"],
        "constraints": p["constraints"],
        "examples": p["examples"],
        "hints": p["hints"],
        "expected_complexity": p["expected_complexity"],
        "starter_code": p["starter_code"],
        "public_tests": p["public_tests"],
        "languages": list(p["starter_code"].keys()),
    }


@router.post("/run")
async def run_code_endpoint(req: RunRequest, authorization: str = Header(...)):
    uid, is_demo, token = await _resolve_token(authorization)
    p = get_problem(req.problem_id)
    if not p:
        raise HTTPException(status_code=404, detail="Problem not found")

    langs = available_languages()
    if req.language not in langs:
        raise HTTPException(status_code=400, detail=f"Unsupported language: {req.language}. Available: {langs}")

    if req.custom_input is not None:
        result = await _runner_run(
            language=req.language,
            source=req.source,
            stdin=req.custom_input,
            timeout_s=RUNNER_TIMEOUT_S,
        )
        return {
            "mode": "custom",
            "stdout": normalize_output(result.get("stdout", "")),
            "stderr": result.get("stderr", ""),
            "exit_code": result.get("exit_code"),
            "timed_out": result.get("timed_out", False),
            "runtime_ms": result.get("runtime_ms"),
        }

    started = time.time()
    results = await _run_test_cases(req.language, req.source, p["public_tests"])
    duration_ms = int((time.time() - started) * 1000)
    passed = sum(1 for r in results if r["passed"])
    return {
        "mode": "public",
        "passed": passed,
        "total": len(results),
        "results": results,
        "duration_ms": duration_ms,
    }


@router.post("/submit")
async def submit_code(req: SubmitRequest, authorization: str = Header(...)):
    uid, is_demo, token = await _resolve_token(authorization)
    p = get_problem(req.problem_id)
    if not p:
        raise HTTPException(status_code=404, detail="Problem not found")

    langs = available_languages()
    if req.language not in langs:
        raise HTTPException(status_code=400, detail=f"Unsupported language: {req.language}. Available: {langs}")

    started = time.time()
    public_results = await _run_test_cases(req.language, req.source, p["public_tests"])
    hidden_results = await _run_test_cases(req.language, req.source, p["hidden_tests"])
    duration_ms = int((time.time() - started) * 1000)

    total_tests = len(public_results) + len(hidden_results)
    passed_tests = sum(1 for r in public_results + hidden_results if r["passed"])
    correct = passed_tests == total_tests

    fingerprint: Optional[str] = None
    if not correct:
        any_timed_out = any(r.get("timed_out") for r in public_results + hidden_results)
        any_stderr = any(r["stderr"] for r in public_results + hidden_results)
        only_hidden_failed = (
            sum(1 for r in public_results if not r["passed"]) == 0
            and sum(1 for r in hidden_results if not r["passed"]) > 0
        )
        if any_timed_out:
            fingerprint = "time_limit_exceeded"
        elif any_stderr:
            fingerprint = "syntax_error"
        elif only_hidden_failed:
            fingerprint = "edge_case_blindness"
        else:
            fingerprint = "incomplete_solution"

    if is_demo:
        model = demo_store.get_model(token)
    else:
        model = await get_knowledge_model(uid)
    model = migrate_knowledge_model(model)

    model = update_mastery(
        topic=p["topic"],
        correct=correct,
        time_ms=req.time_ms,
        hint_used=False,
        model=model,
        pattern=p["pattern"],
        hesitation_ms=req.first_input_ms or None,
        error_fingerprint=fingerprint,
        confidence_signal=None,
    )

    if is_demo:
        demo_store.save_model(token, model)
        demo_store.append_event(token, {
            "kind": "judge_submit",
            "problem_id": req.problem_id,
            "topic": p["topic"],
            "pattern": p["pattern"],
            "correct": correct,
            "passed": passed_tests,
            "total": total_tests,
            "language": req.language,
            "time_ms": req.time_ms,
            "first_input_ms": req.first_input_ms,
            "fingerprint": fingerprint,
            "thought_trace": req.thought_trace,
        })
    else:
        await save_knowledge_model(uid, model)
        try:
            await append_event(uid, {
                "kind": "judge_submit",
                "problem_id": req.problem_id,
                "topic": p["topic"],
                "pattern": p["pattern"],
                "correct": correct,
                "passed": passed_tests,
                "total": total_tests,
                "language": req.language,
                "time_ms": req.time_ms,
                "first_input_ms": req.first_input_ms,
                "fingerprint": fingerprint,
                "thought_trace": req.thought_trace,
            })
        except Exception:
            pass

    return {
        "mode": "submit",
        "correct": correct,
        "passed": passed_tests,
        "total": total_tests,
        "fingerprint": fingerprint,
        "public_results": public_results,
        "hidden_results": [
            {**r, "input": "<hidden>", "expected": "<hidden>"}
            for r in hidden_results
        ],
        "duration_ms": duration_ms,
        "topic": p["topic"],
        "pattern": p["pattern"],
    }

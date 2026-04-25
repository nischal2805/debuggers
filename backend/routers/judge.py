"""
Code execution sandbox endpoints. Proxies the public Piston judge so we
never expose execution infra credentials to the browser, and so we can
fold the run/submit telemetry into the brain model.

POST /judge/problems         — list available problems
GET  /judge/problems/{id}    — full problem (statement, starter, public tests)
POST /judge/run              — run public tests only
POST /judge/submit           — run public + hidden tests, update brain model
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
    list_problems,
    get_problem,
)
from services import demo_store
from services.firestore import (
    get_knowledge_model,
    save_knowledge_model,
    append_event,
)
from models.knowledge import update_mastery, migrate_knowledge_model


router = APIRouter(prefix="/judge", tags=["judge"])

PISTON_URL = os.environ.get("PISTON_URL", "https://emkc.org/api/v2/piston/execute")
PISTON_TIMEOUT_S = float(os.environ.get("PISTON_TIMEOUT_S", "12"))


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


async def _piston_execute(
    *,
    language: str,
    source: str,
    stdin: str,
) -> dict:
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


def _normalize_output(text: str) -> str:
    return (text or "").strip().replace("\r\n", "\n")


async def _run_test_cases(language: str, source: str, tests: list[dict]) -> list[dict]:
    """Run each test sequentially (Piston public is rate-limited)."""
    results: list[dict] = []
    for t in tests:
        result = await _piston_execute(language=language, source=source, stdin=t.get("input", ""))
        run_block = (result or {}).get("run") or {}
        actual = _normalize_output(run_block.get("stdout", ""))
        expected = _normalize_output(t.get("expected", ""))
        passed = actual == expected
        results.append({
            "input": t.get("input", ""),
            "expected": expected,
            "actual": actual,
            "stderr": run_block.get("stderr", ""),
            "exit_code": run_block.get("code"),
            "passed": passed,
            "runtime_ms": run_block.get("runtime") or run_block.get("wall_time") or None,
        })
        await asyncio.sleep(0.1)  # be polite to public Piston
    return results


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
async def run_code(req: RunRequest, authorization: str = Header(...)):
    uid, is_demo, token = await _resolve_token(authorization)
    p = get_problem(req.problem_id)
    if not p:
        raise HTTPException(status_code=404, detail="Problem not found")

    if req.custom_input is not None:
        result = await _piston_execute(language=req.language, source=req.source, stdin=req.custom_input)
        run_block = (result or {}).get("run") or {}
        return {
            "mode": "custom",
            "stdout": _normalize_output(run_block.get("stdout", "")),
            "stderr": run_block.get("stderr", ""),
            "exit_code": run_block.get("code"),
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

    started = time.time()
    public_results = await _run_test_cases(req.language, req.source, p["public_tests"])
    hidden_results = await _run_test_cases(req.language, req.source, p["hidden_tests"])
    duration_ms = int((time.time() - started) * 1000)

    total_tests = len(public_results) + len(hidden_results)
    passed_tests = sum(1 for r in public_results + hidden_results if r["passed"])
    correct = passed_tests == total_tests

    # Heuristic fingerprint based on output patterns
    fingerprint: Optional[str] = None
    if not correct:
        any_stderr = any(r["stderr"] for r in public_results + hidden_results)
        only_hidden_failed = (
            sum(1 for r in public_results if not r["passed"]) == 0
            and sum(1 for r in hidden_results if not r["passed"]) > 0
        )
        if any_stderr:
            fingerprint = "syntax_error"
        elif only_hidden_failed:
            fingerprint = "edge_case_blindness"
        else:
            fingerprint = "incomplete_solution"

    # Update brain model
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
            {**r, "input": "<hidden>", "expected": "<hidden>"}  # don't leak
            for r in hidden_results
        ],
        "duration_ms": duration_ms,
        "topic": p["topic"],
        "pattern": p["pattern"],
    }

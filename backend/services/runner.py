"""
Code execution runner.
Primary: self-hosted Piston (when PISTON_URL set — e.g. in Docker).
Fallback: Judge0 cloud API (https://ce.judge0.com — free, no key needed).
"""

from __future__ import annotations

import os
import time

import httpx

PISTON_URL = os.environ.get("PISTON_URL", "").rstrip("/")
JUDGE0_URL = os.environ.get("JUDGE0_URL", "https://ce.judge0.com")
JUDGE0_API_KEY = os.environ.get("JUDGE0_API_KEY", "")
TIMEOUT_S = float(os.environ.get("RUNNER_TIMEOUT_S", "10"))

_JUDGE0_LANG_IDS: dict[str, int] = {
    "python":     71,   # Python 3.8.1
    "javascript": 63,   # Node.js 12.14.0
    "cpp":        54,   # C++ (GCC 9.2.0)
    "java":       62,   # Java (OpenJDK 13.0.1)
    "c":          50,   # C (GCC 9.2.0)
    "go":         60,   # Go 1.13.5
}

_PISTON_VERSIONS: dict[str, str] = {
    "python":     "3.10.0",
    "javascript": "18.15.0",
}

_AVAILABLE = ["python", "javascript"]


def available_languages() -> list[str]:
    return _AVAILABLE


async def run_code(
    language: str,
    source: str,
    stdin: str,
    timeout_s: float = TIMEOUT_S,
) -> dict:
    if PISTON_URL:
        result = await _run_piston(language, source, stdin, timeout_s)
        if result.get("error") != "piston_unreachable":
            return result
    return await _run_judge0(language, source, stdin, timeout_s)


async def _run_piston(language: str, source: str, stdin: str, timeout_s: float) -> dict:
    version = _PISTON_VERSIONS.get(language)
    if not version:
        return _error(f"Unsupported language: {language}")

    payload = {
        "language": language,
        "version": version,
        "files": [{"content": source}],
        "stdin": stdin,
        "run_timeout": int(timeout_s * 1000),
        "compile_timeout": 10000,
    }

    t0 = time.perf_counter()
    try:
        async with httpx.AsyncClient(timeout=timeout_s + 10) as client:
            r = await client.post(f"{PISTON_URL}/api/v2/execute", json=payload)
            r.raise_for_status()
            data = r.json()
    except httpx.ConnectError:
        return {"stdout": "", "stderr": "", "exit_code": -1,
                "runtime_ms": 0, "timed_out": False, "error": "piston_unreachable"}
    except Exception as e:
        return _error(f"Piston error: {e}")

    elapsed_ms = int((time.perf_counter() - t0) * 1000)
    run = data.get("run", {})
    stdout = run.get("stdout") or ""
    stderr = run.get("stderr") or ""
    code = run.get("code") or 0
    timed_out = run.get("signal") == "SIGKILL"

    return {
        "stdout": stdout,
        "stderr": stderr[:400] if stderr else "",
        "exit_code": code,
        "runtime_ms": elapsed_ms,
        "timed_out": timed_out,
        "error": None,
    }


async def _run_judge0(language: str, source: str, stdin: str, timeout_s: float) -> dict:
    lang_id = _JUDGE0_LANG_IDS.get(language)
    if not lang_id:
        return _error(f"Unsupported language: {language}")

    h = {"Content-Type": "application/json"}
    if JUDGE0_API_KEY:
        h["X-RapidAPI-Key"] = JUDGE0_API_KEY
        h["X-RapidAPI-Host"] = "judge0-ce.p.rapidapi.com"

    payload = {
        "language_id": lang_id,
        "source_code": source,
        "stdin": stdin,
        "cpu_time_limit": timeout_s,
        "memory_limit": 131072,
        "wall_time_limit": timeout_s + 2,
    }

    t0 = time.perf_counter()
    try:
        async with httpx.AsyncClient(timeout=timeout_s + 8, headers=h) as client:
            r = await client.post(
                f"{JUDGE0_URL}/submissions",
                json=payload,
                params={"base64_encoded": "false", "wait": "true"},
            )
            if r.status_code == 429:
                return _error("Judge0 rate limit hit. Retry in a moment.")
            r.raise_for_status()
            data = r.json()
    except httpx.ConnectError:
        return _error("Judge0 unreachable. Check JUDGE0_URL in .env.")
    except httpx.HTTPStatusError as e:
        return _error(f"Judge0 error {e.response.status_code}")
    except Exception as e:
        return _error(f"Runner error: {e}")

    elapsed_ms = int((time.perf_counter() - t0) * 1000)
    status_id = (data.get("status") or {}).get("id", 0)
    stdout = data.get("stdout") or ""
    stderr = data.get("stderr") or data.get("compile_output") or ""
    timed_out = status_id == 5
    exit_code = 0 if status_id == 3 else (1 if status_id > 3 else 0)

    return {
        "stdout": stdout,
        "stderr": stderr[:400] if stderr else "",
        "exit_code": exit_code,
        "runtime_ms": int(float(data.get("time") or 0) * 1000) or elapsed_ms,
        "timed_out": timed_out,
        "error": None,
    }


def _error(msg: str) -> dict:
    return {"stdout": "", "stderr": msg, "exit_code": -1,
            "runtime_ms": 0, "timed_out": False, "error": msg}


def normalize_output(text: str) -> str:
    return (text or "").strip().replace("\r\n", "\n").rstrip("\n")

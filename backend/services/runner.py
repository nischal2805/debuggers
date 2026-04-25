"""
Judge0 cloud code execution runner.
https://judge0.com — free public instance, no key needed for demo.

Set JUDGE0_URL in .env. If you have a RapidAPI key set JUDGE0_API_KEY.
Supports Python, JavaScript, C++, Java, C, Go.
"""

from __future__ import annotations

import asyncio
import os
import time
from typing import Optional

import httpx

JUDGE0_URL = os.environ.get("JUDGE0_URL", "https://ce.judge0.com")
JUDGE0_API_KEY = os.environ.get("JUDGE0_API_KEY", "")
TIMEOUT_S = float(os.environ.get("RUNNER_TIMEOUT_S", "10"))

# Judge0 language IDs  https://ce.judge0.com/languages
_LANG_IDS: dict[str, int] = {
    "python":     71,   # Python 3.8.1
    "javascript": 63,   # Node.js 12.14.0
    "cpp":        54,   # C++ (GCC 9.2.0)
    "java":       62,   # Java (OpenJDK 13.0.1)
    "c":          50,   # C (GCC 9.2.0)
    "go":         60,   # Go 1.13.5
}

# Languages that have starter code in problems
_AVAILABLE = ["python", "javascript"]


def available_languages() -> list[str]:
    return _AVAILABLE


def _headers() -> dict:
    h = {"Content-Type": "application/json"}
    if JUDGE0_API_KEY:
        # RapidAPI hosted Judge0
        h["X-RapidAPI-Key"] = JUDGE0_API_KEY
        h["X-RapidAPI-Host"] = "judge0-ce.p.rapidapi.com"
    return h


async def run_code(
    language: str,
    source: str,
    stdin: str,
    timeout_s: float = TIMEOUT_S,
) -> dict:
    lang_id = _LANG_IDS.get(language)
    if not lang_id:
        return _error(f"Unsupported language: {language}")

    payload = {
        "language_id": lang_id,
        "source_code": source,
        "stdin": stdin,
        "cpu_time_limit": timeout_s,
        "memory_limit": 131072,   # 128 MB in KB
        "wall_time_limit": timeout_s + 2,
    }

    t0 = time.perf_counter()
    try:
        async with httpx.AsyncClient(timeout=timeout_s + 8, headers=_headers()) as client:
            # Submit and wait in one call (?wait=true)
            r = await client.post(
                f"{JUDGE0_URL}/submissions",
                json=payload,
                params={"base64_encoded": "false", "wait": "true"},
            )
            if r.status_code == 429:
                return _error("Judge0 rate limit hit. Wait a moment and retry.")
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
    timed_out = status_id == 5  # Time Limit Exceeded
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

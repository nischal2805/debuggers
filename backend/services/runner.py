"""
Local subprocess code runner — replaces Piston (which went whitelist-only 2/15/2026).

Runs code in a subprocess with a hard timeout. Supports Python and JavaScript (Node).
Safe enough for a hackathon demo. stdin is passed as a string, stdout is captured.
"""

from __future__ import annotations

import asyncio
import os
import shutil
import sys
import tempfile
from typing import Optional


TIMEOUT_S = float(os.environ.get("RUNNER_TIMEOUT_S", "8"))

# Map language key → (command, file extension)
_RUNTIMES: dict[str, tuple[list[str], str]] = {
    "python": (["python", "-u"], ".py"),
    "javascript": (["node"], ".js"),
    "java": (["java"], ".java"),         # requires javac separately — skipped for demo
}

# Detect available runtimes at startup
_AVAILABLE: dict[str, bool] = {}
for lang, (cmd, _) in _RUNTIMES.items():
    _AVAILABLE[lang] = shutil.which(cmd[0]) is not None


def available_languages() -> list[str]:
    return [lang for lang, ok in _AVAILABLE.items() if ok]


async def run_code(
    language: str,
    source: str,
    stdin: str,
    timeout_s: float = TIMEOUT_S,
) -> dict:
    """
    Execute `source` in `language` with `stdin` piped in.

    Returns:
      {
        "stdout": str,
        "stderr": str,
        "exit_code": int,
        "runtime_ms": int,
        "timed_out": bool,
        "error": str | None,   # infra error, not user code error
      }
    """
    if language not in _RUNTIMES:
        return _error(f"Unsupported language: {language}")
    if not _AVAILABLE.get(language):
        return _error(f"{language} runtime not found on this machine")

    cmd_prefix, ext = _RUNTIMES[language]

    # Write source to temp file
    tmp = tempfile.NamedTemporaryFile(
        mode="w", suffix=ext, delete=False, encoding="utf-8"
    )
    try:
        tmp.write(source)
        tmp.flush()
        tmp.close()

        cmd = cmd_prefix + [tmp.name]

        import time
        t0 = time.perf_counter()
        try:
            proc = await asyncio.create_subprocess_exec(
                *cmd,
                stdin=asyncio.subprocess.PIPE,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
            try:
                stdout_b, stderr_b = await asyncio.wait_for(
                    proc.communicate(input=stdin.encode("utf-8")),
                    timeout=timeout_s,
                )
                elapsed_ms = int((time.perf_counter() - t0) * 1000)
                return {
                    "stdout": stdout_b.decode("utf-8", errors="replace"),
                    "stderr": stderr_b.decode("utf-8", errors="replace"),
                    "exit_code": proc.returncode,
                    "runtime_ms": elapsed_ms,
                    "timed_out": False,
                    "error": None,
                }
            except asyncio.TimeoutError:
                proc.kill()
                await proc.communicate()
                return {
                    "stdout": "",
                    "stderr": f"Time limit exceeded ({timeout_s}s)",
                    "exit_code": -1,
                    "runtime_ms": int(timeout_s * 1000),
                    "timed_out": True,
                    "error": None,
                }
        except Exception as e:
            return _error(f"Failed to start process: {e}")
    finally:
        try:
            os.unlink(tmp.name)
        except OSError:
            pass


def _error(msg: str) -> dict:
    return {
        "stdout": "",
        "stderr": msg,
        "exit_code": -1,
        "runtime_ms": 0,
        "timed_out": False,
        "error": msg,
    }


def normalize_output(text: str) -> str:
    return (text or "").strip().replace("\r\n", "\n").rstrip("\n")

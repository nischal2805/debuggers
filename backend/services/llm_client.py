"""
Provider-agnostic LLM client.

The agent talks to whatever model is configured via LLM_PROVIDER. Today the
default is gemini (free tier, 2.5-flash). A Claude provider stub is here so
the swap is trivial when the API key lands.

Public API:
  - get_provider() -> LLMProvider
  - evaluate_answer(...)        # structured JSON answer evaluation
  - stream_agent_response(...)  # streaming tutor response

Both downstream callers (routers/session.py, services/gemini.py shim) go
through this module. Add new model providers by subclassing LLMProvider.
"""

from __future__ import annotations

import abc
import json
import os
import re
from typing import AsyncIterator, Optional

import google.generativeai as genai

from prompts.tutor import TUTOR_SYSTEM_PROMPT, EVALUATE_PROMPT
from services.agent import AgentAction, agent_decide, build_agent_prompt
from services.problem_catalog import get_problems_for_topic, format_problem_for_prompt


# ─────────────────────────────────────────────────────────────────────────────
# Allowed payload values used by the normalizer
# ─────────────────────────────────────────────────────────────────────────────

_ALLOWED_TYPES = {
    "question", "hint", "explanation", "feedback",
    "celebration", "topic_transition", "prereq_intervention", "session_summary",
}
_ALLOWED_ANSWER_TYPES = {"code", "text", "multiple_choice", "complexity"}


# ─────────────────────────────────────────────────────────────────────────────
# JSON parsing + payload normalization
# ─────────────────────────────────────────────────────────────────────────────


def _strip_json_fences(text: str) -> str:
    """Strip markdown code block wrappers LLMs sometimes emit."""
    t = text.strip()
    if t.startswith("```"):
        t = re.sub(r'^```[a-zA-Z]*\n?', '', t)
        t = re.sub(r'\n?```\s*$', '', t)
        t = t.strip()
    return t


def _parse_json(text: str) -> dict:
    text = _strip_json_fences(text)
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        start = text.find("{")
        end = text.rfind("}") + 1
        if start >= 0 and end > start:
            try:
                return json.loads(text[start:end])
            except Exception:
                pass
    return {}


def parse_llm_json(raw: str) -> dict | None:
    """Public robust JSON parser for LLM output. Returns None on total failure."""
    if not raw or not isinstance(raw, str):
        return None
    result = _parse_json(raw)
    return result if result else None


def _extract_content_text(text: str) -> str:
    match = re.search(r'"content"\s*:\s*"((?:[^"\\]|\\.)*)"', text, flags=re.DOTALL)
    if match:
        raw = match.group(1)
        try:
            return bytes(raw, "utf-8").decode("unicode_escape")
        except Exception:
            return raw
    cleaned = text.strip()
    if cleaned.startswith("{") and cleaned.endswith("}"):
        return "I had a response formatting issue. Please ask again."
    return cleaned


def _normalize_evaluation_payload(value: dict | None) -> dict | None:
    if not isinstance(value, dict):
        return None
    try:
        partial_credit = float(value.get("partial_credit", 0.0))
    except Exception:
        partial_credit = 0.0
    partial_credit = max(0.0, min(1.0, partial_credit))

    fp = value.get("error_fingerprint")
    if isinstance(fp, str):
        fp = fp.strip().lower() or None

    optimality = value.get("optimality_score") or {}
    if isinstance(optimality, dict):
        def _o(k):
            try:
                return max(0.0, min(1.0, float(optimality.get(k, 0))))
            except Exception:
                return 0.0
        optimality = {
            "time_complexity":  _o("time_complexity"),
            "space_complexity": _o("space_complexity"),
            "code_clarity":     _o("code_clarity"),
            "overall_optimality": _o("overall_optimality") or _o("time_complexity"),
        }
    else:
        optimality = None

    approach_quality = value.get("approach_quality")
    try:
        approach_quality = max(0.0, min(1.0, float(approach_quality))) if approach_quality is not None else None
    except Exception:
        approach_quality = None

    mastery_signal = value.get("mastery_signal")
    if mastery_signal not in ("improve", "maintain", "decay"):
        mastery_signal = None

    return {
        "correct": bool(value.get("correct", False)),
        "partial_credit": partial_credit,
        "feedback": str(value.get("feedback", "")),
        "errors": value.get("errors", []) or [],
        "hint_for_retry": value.get("hint_for_retry"),
        "error_fingerprint": fp,
        "optimality_score": optimality,
        "approach_quality": approach_quality,
        "mastery_signal": mastery_signal,
        "behavioral_notes": value.get("behavioral_notes") or [],
    }


def _normalize_tutor_payload(parsed: dict, raw_text: str) -> dict:
    if not isinstance(parsed, dict):
        parsed = {}

    nested: dict | None = None
    content = parsed.get("content")
    if isinstance(content, dict):
        nested = content
    elif isinstance(content, str):
        trimmed = content.strip()
        if trimmed.startswith("{") and '"content"' in trimmed:
            nested = _parse_json(trimmed)
            if not nested:
                parsed["content"] = _extract_content_text(trimmed)

    if isinstance(nested, dict):
        for key in (
            "type", "content", "code_snippet", "expected_answer_type", "options",
            "difficulty_level", "pattern_name", "prereq_gap", "session_summary", "evaluation",
            "internal_note", "next_action",
        ):
            if key in nested and nested[key] is not None:
                parsed[key] = nested[key]

    if not isinstance(parsed.get("content"), str):
        parsed["content"] = _extract_content_text(raw_text)

    content = parsed.get("content", "")
    if isinstance(content, str):
        stripped = content.strip()
        if stripped.startswith("{") and '"content"' in stripped:
            extracted = _extract_content_text(stripped)
            if extracted:
                parsed["content"] = extracted

    parsed.setdefault("type", "explanation")
    if parsed["type"] not in _ALLOWED_TYPES:
        parsed["type"] = "explanation"

    parsed.setdefault("content", "Let's continue.")
    parsed.setdefault("code_snippet", None)
    parsed.setdefault("expected_answer_type", "text")
    if parsed["expected_answer_type"] not in _ALLOWED_ANSWER_TYPES:
        parsed["expected_answer_type"] = "text"

    difficulty = parsed.get("difficulty_level", 3)
    try:
        difficulty = int(difficulty)
    except Exception:
        difficulty = 3
    parsed["difficulty_level"] = max(1, min(10, difficulty))

    parsed.setdefault("pattern_name", None)
    parsed.setdefault("prereq_gap", {"detected": False, "weak_topic": None, "explanation": None})
    parsed.setdefault("session_summary", None)
    parsed.setdefault("evaluation", None)
    parsed.setdefault("internal_note", "normalized_response")
    parsed.setdefault("next_action", "wait_for_answer")
    return parsed


# ─────────────────────────────────────────────────────────────────────────────
# Provider abstraction
# ─────────────────────────────────────────────────────────────────────────────


class LLMProvider(abc.ABC):
    name: str = "abstract"

    @abc.abstractmethod
    async def complete_json(
        self,
        prompt: str,
        *,
        max_tokens: int = 600,
        temperature: float = 0.2,
        system: Optional[str] = None,
    ) -> str:
        """Single-shot completion. Provider must enforce JSON output where possible."""

    @abc.abstractmethod
    def stream_json(
        self,
        prompt: str,
        *,
        max_tokens: int = 800,
        temperature: float = 0.35,
        system: Optional[str] = None,
    ) -> AsyncIterator[str]:
        """Streaming completion yielding text chunks (still building one JSON document)."""


class _NoopProvider(LLMProvider):
    """Fallback when no LLM credentials are configured. Returns minimal valid JSON."""
    name = "noop"

    async def complete_json(self, prompt: str, *, max_tokens: int = 600, temperature: float = 0.2, system: Optional[str] = None) -> str:
        return '{"correct":false,"feedback":"LLM provider not configured. Set LLM_PROVIDER and credentials in backend/.env","error_fingerprint":null,"optimality_score":{"time_complexity":0.5,"space_complexity":0.5,"code_clarity":0.5,"overall_optimality":0.5}}'

    async def stream_json(self, prompt: str, *, max_tokens: int = 800, temperature: float = 0.35, system: Optional[str] = None) -> AsyncIterator[str]:
        yield '{"type":"explanation","content":"LLM provider not configured. Add AWS credentials or a valid Gemini key to backend/.env","expected_answer_type":"text","difficulty_level":3,"pattern_name":null,"prereq_gap":{"detected":false,"weak_topic":null,"explanation":null},"session_summary":null,"evaluation":null,"next_action":"wait_for_answer","internal_note":"noop_provider"}'


class GeminiProvider(LLMProvider):
    name = "gemini"

    def __init__(self, model_name: str = "gemini-2.5-flash") -> None:
        api_key = os.environ.get("GEMINI_API_KEY")
        if not api_key:
            raise RuntimeError("GEMINI_API_KEY is required for GeminiProvider")
        genai.configure(api_key=api_key)
        self.model_name = model_name

    def _build(self, system: Optional[str], max_tokens: int, temperature: float):
        return genai.GenerativeModel(
            model_name=self.model_name,
            system_instruction=system,
            generation_config=genai.GenerationConfig(
                max_output_tokens=max_tokens,
                temperature=temperature,
                response_mime_type="application/json",
            ),
        )

    async def complete_json(
        self,
        prompt: str,
        *,
        max_tokens: int = 600,
        temperature: float = 0.2,
        system: Optional[str] = None,
    ) -> str:
        model = self._build(system, max_tokens, temperature)
        response = await model.generate_content_async(prompt)
        return response.text or ""

    async def stream_json(
        self,
        prompt: str,
        *,
        max_tokens: int = 800,
        temperature: float = 0.35,
        system: Optional[str] = None,
    ) -> AsyncIterator[str]:
        model = self._build(system, max_tokens, temperature)
        async for chunk in await model.generate_content_async(prompt, stream=True):
            yield chunk.text or ""


class ClaudeProvider(LLMProvider):
    """Direct Anthropic API (requires ANTHROPIC_API_KEY)."""
    name = "claude"

    def __init__(self, model_name: str = "claude-haiku-4-5-20251001") -> None:
        api_key = os.environ.get("ANTHROPIC_API_KEY")
        if not api_key:
            raise RuntimeError("ANTHROPIC_API_KEY required for ClaudeProvider")
        self.model_name = model_name
        try:
            from anthropic import AsyncAnthropic
            self._client = AsyncAnthropic(api_key=api_key)
        except Exception as e:
            raise RuntimeError(f"anthropic SDK not installed: {e}")

    async def complete_json(
        self,
        prompt: str,
        *,
        max_tokens: int = 600,
        temperature: float = 0.2,
        system: Optional[str] = None,
    ) -> str:
        msg = await self._client.messages.create(
            model=self.model_name,
            max_tokens=max_tokens,
            temperature=temperature,
            system=system or "Return only valid JSON.",
            messages=[{"role": "user", "content": prompt}],
        )
        parts = [b.text for b in msg.content if getattr(b, "type", "") == "text"]
        return "".join(parts)

    async def stream_json(
        self,
        prompt: str,
        *,
        max_tokens: int = 800,
        temperature: float = 0.35,
        system: Optional[str] = None,
    ) -> AsyncIterator[str]:
        async with self._client.messages.stream(
            model=self.model_name,
            max_tokens=max_tokens,
            temperature=temperature,
            system=system or "Return only valid JSON.",
            messages=[{"role": "user", "content": prompt}],
        ) as stream:
            async for text in stream.text_stream:
                yield text


class BedrockProvider(LLMProvider):
    """
    AWS Bedrock — Claude via boto3.
    Set env vars: AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION (default us-east-1).
    Model: anthropic.claude-3-5-haiku-20241022-v1:0  (fast + cheap on Bedrock free credits).
    """
    name = "bedrock"

    def __init__(self, model_id: Optional[str] = None) -> None:
        self.model_id = model_id or os.environ.get(
            "BEDROCK_MODEL_ID", "anthropic.claude-3-5-haiku-20241022-v1:0"
        )
        self.region = os.environ.get("AWS_REGION", "us-east-1")
        try:
            import boto3
            self._client = boto3.client(
                "bedrock-runtime",
                region_name=self.region,
                aws_access_key_id=os.environ.get("AWS_ACCESS_KEY_ID"),
                aws_secret_access_key=os.environ.get("AWS_SECRET_ACCESS_KEY"),
                aws_session_token=os.environ.get("AWS_SESSION_TOKEN"),
            )
        except Exception as e:
            raise RuntimeError(f"boto3 not installed or AWS credentials missing: {e}")

    def _build_body(self, prompt: str, system: Optional[str], max_tokens: int, temperature: float) -> dict:
        return {
            "anthropic_version": "bedrock-2023-05-31",
            "max_tokens": max_tokens,
            "temperature": temperature,
            "system": system or "Return only valid JSON.",
            "messages": [{"role": "user", "content": prompt}],
        }

    async def complete_json(
        self,
        prompt: str,
        *,
        max_tokens: int = 600,
        temperature: float = 0.2,
        system: Optional[str] = None,
    ) -> str:
        import json as _json
        import asyncio
        body = _json.dumps(self._build_body(prompt, system, max_tokens, temperature))

        def _invoke():
            resp = self._client.invoke_model(
                modelId=self.model_id,
                body=body,
                contentType="application/json",
                accept="application/json",
            )
            return _json.loads(resp["body"].read())

        result = await asyncio.get_event_loop().run_in_executor(None, _invoke)
        parts = [b["text"] for b in result.get("content", []) if b.get("type") == "text"]
        return "".join(parts)

    async def stream_json(
        self,
        prompt: str,
        *,
        max_tokens: int = 800,
        temperature: float = 0.35,
        system: Optional[str] = None,
    ) -> AsyncIterator[str]:
        import json as _json
        import asyncio
        body = _json.dumps(self._build_body(prompt, system, max_tokens, temperature))

        def _invoke_stream():
            resp = self._client.invoke_model_with_response_stream(
                modelId=self.model_id,
                body=body,
                contentType="application/json",
                accept="application/json",
            )
            chunks = []
            for event in resp["body"]:
                chunk = event.get("chunk")
                if chunk:
                    data = _json.loads(chunk["bytes"])
                    if data.get("type") == "content_block_delta":
                        text = data.get("delta", {}).get("text", "")
                        if text:
                            chunks.append(text)
            return chunks

        texts = await asyncio.get_event_loop().run_in_executor(None, _invoke_stream)
        for text in texts:
            yield text


class MiniMaxBedrockProvider(LLMProvider):
    """
    MiniMax M2.5 via AWS Bedrock Converse API.
    Uses the unified Converse API (model-agnostic — no Anthropic-specific body format).
    Model ID: minimax.minimax-m2.5
    """
    name = "minimax"

    def __init__(self, model_id: Optional[str] = None) -> None:
        self.model_id = model_id or os.environ.get("BEDROCK_MODEL_ID", "minimax.minimax-m2.5")
        self.region = os.environ.get("AWS_REGION", "us-east-1")
        try:
            import boto3
            self._client = boto3.client(
                "bedrock-runtime",
                region_name=self.region,
                aws_access_key_id=os.environ.get("AWS_ACCESS_KEY_ID"),
                aws_secret_access_key=os.environ.get("AWS_SECRET_ACCESS_KEY"),
                aws_session_token=os.environ.get("AWS_SESSION_TOKEN"),
            )
        except Exception as e:
            raise RuntimeError(f"boto3 not installed or AWS credentials missing: {e}")

    def _converse_kwargs(self, prompt: str, system: Optional[str], max_tokens: int, temperature: float) -> dict:
        return {
            "modelId": self.model_id,
            "system": [{"text": system or "Return only valid JSON."}],
            "messages": [{"role": "user", "content": [{"text": prompt}]}],
            "inferenceConfig": {
                "maxTokens": max_tokens,
                "temperature": temperature,
            },
        }

    @staticmethod
    def _extract_text(content: list) -> str:
        # MiniMax is a reasoning model — content has reasoningContent blocks + text blocks.
        # Pick only direct text blocks, skip reasoning.
        parts = [b["text"] for b in content if "text" in b]
        return "".join(parts).strip()

    async def complete_json(
        self,
        prompt: str,
        *,
        max_tokens: int = 600,
        temperature: float = 0.2,
        system: Optional[str] = None,
    ) -> str:
        import asyncio
        kwargs = self._converse_kwargs(prompt, system, max_tokens, temperature)

        def _invoke():
            resp = self._client.converse(**kwargs)
            return self._extract_text(resp["output"]["message"]["content"])

        return await asyncio.get_event_loop().run_in_executor(None, _invoke)

    async def stream_json(
        self,
        prompt: str,
        *,
        max_tokens: int = 800,
        temperature: float = 0.35,
        system: Optional[str] = None,
    ) -> AsyncIterator[str]:
        import asyncio
        kwargs = self._converse_kwargs(prompt, system, max_tokens, temperature)

        def _invoke_stream():
            resp = self._client.converse_stream(**kwargs)
            chunks = []
            for event in resp["stream"]:
                delta = event.get("contentBlockDelta", {}).get("delta", {})
                text = delta.get("text", "")
                if text:
                    chunks.append(text)
            return chunks

        texts = await asyncio.get_event_loop().run_in_executor(None, _invoke_stream)
        for text in texts:
            yield text


class NovaBedrockProvider(LLMProvider):
    """
    Amazon Nova Lite / Micro via AWS Bedrock Converse API.
    Confirmed working: returns clean JSON text (no reasoning-only blocks).
    Default model: amazon.nova-lite-v1:0  (smarter than micro, still fast+cheap)
    Fallback:       amazon.nova-micro-v1:0

    Set env vars: AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION.
    Override model via BEDROCK_MODEL_ID env var.
    """
    name = "nova"

    def __init__(self, model_id: Optional[str] = None) -> None:
        self.model_id = model_id or os.environ.get("BEDROCK_MODEL_ID", "amazon.nova-lite-v1:0")
        self.region = os.environ.get("AWS_REGION", "us-east-1")
        try:
            import boto3
            self._client = boto3.client(
                "bedrock-runtime",
                region_name=self.region,
                aws_access_key_id=os.environ.get("AWS_ACCESS_KEY_ID"),
                aws_secret_access_key=os.environ.get("AWS_SECRET_ACCESS_KEY"),
                aws_session_token=os.environ.get("AWS_SESSION_TOKEN"),
            )
        except Exception as e:
            raise RuntimeError(f"boto3 not installed or AWS credentials missing: {e}")

    def _converse_kwargs(
        self, prompt: str, system: Optional[str], max_tokens: int, temperature: float
    ) -> dict:
        # Nova caps temperature at 1.0 and uses inferenceConfig
        temperature = max(0.0, min(1.0, temperature))
        return {
            "modelId": self.model_id,
            "system": [{"text": system or "Return only valid JSON."}],
            "messages": [{"role": "user", "content": [{"text": prompt}]}],
            "inferenceConfig": {
                "maxTokens": max_tokens,
                "temperature": temperature,
            },
        }

    async def complete_json(
        self,
        prompt: str,
        *,
        max_tokens: int = 600,
        temperature: float = 0.2,
        system: Optional[str] = None,
    ) -> str:
        import asyncio
        kwargs = self._converse_kwargs(prompt, system, max_tokens, temperature)

        def _invoke():
            resp = self._client.converse(**kwargs)
            content = resp["output"]["message"]["content"]
            # Nova returns plain text blocks — no reasoning blocks
            parts = [b["text"] for b in content if "text" in b]
            return _strip_json_fences("".join(parts))

        return await asyncio.get_event_loop().run_in_executor(None, _invoke)

    async def stream_json(
        self,
        prompt: str,
        *,
        max_tokens: int = 800,
        temperature: float = 0.35,
        system: Optional[str] = None,
    ) -> AsyncIterator[str]:
        import asyncio
        kwargs = self._converse_kwargs(prompt, system, max_tokens, temperature)

        def _invoke_stream():
            resp = self._client.converse_stream(**kwargs)
            chunks = []
            for event in resp["stream"]:
                delta = event.get("contentBlockDelta", {}).get("delta", {})
                text = delta.get("text", "")
                if text:
                    chunks.append(text)
            return chunks

        texts = await asyncio.get_event_loop().run_in_executor(None, _invoke_stream)
        # Yield everything at once after stripping leading fences
        full = "".join(texts)
        stripped = _strip_json_fences(full)
        if stripped:
            yield stripped


# ─────────────────────────────────────────────────────────────────────────────
# Provider factory
# ─────────────────────────────────────────────────────────────────────────────

_provider: LLMProvider | None = None


def reset_provider():
    """Force re-initialization of provider (useful when env vars change)."""
    global _provider
    _provider = None


def get_provider() -> LLMProvider:
    global _provider
    if _provider is not None:
        return _provider
    name = (os.environ.get("LLM_PROVIDER", "gemini") or "gemini").strip().lower()
    try:
        if name in ("nova", "nova-lite", "nova_lite"):
            _provider = NovaBedrockProvider()
        elif name == "minimax":
            _provider = MiniMaxBedrockProvider()
        elif name == "bedrock":
            _provider = BedrockProvider()
        elif name == "claude":
            _provider = ClaudeProvider()
        else:
            _provider = GeminiProvider()
    except Exception as e:
        import sys
        print(f"WARNING: LLM provider '{name}' failed to init: {e}", file=sys.stderr)
        _provider = _NoopProvider()
    return _provider


# ─────────────────────────────────────────────────────────────────────────────
# High-level operations used by the rest of the backend
# ─────────────────────────────────────────────────────────────────────────────


async def evaluate_answer(
    topic: str,
    pattern: str,
    question: str,
    user_answer: str,
    difficulty: int,
    mastery: float,
    time_ms: int,
) -> dict:
    """
    Structured answer evaluation. Always returns a dict with the same shape,
    even on parse failure (with `_parse_error: True`).
    """
    prompt = EVALUATE_PROMPT.format(
        topic=topic, pattern=pattern, question=question,
        user_answer=user_answer, difficulty=difficulty,
        mastery=mastery, time_ms=time_ms,
    )

    provider = get_provider()
    text = await provider.complete_json(prompt, max_tokens=500, temperature=0.1)
    result = _parse_json(text)
    if not result:
        retry = prompt + "\n\nReturn only a valid JSON object. No markdown, no fences, no extra text."
        text = await provider.complete_json(retry, max_tokens=500, temperature=0.05)
        result = _parse_json(text)

    if not result:
        return {
            "_parse_error": True,
            "correct": False,
            "partial_credit": 0.0,
            "errors": [],
            "missing_concepts": [],
            "time_complexity_correct": None,
            "space_complexity_correct": None,
            "error_fingerprint": None,
            "optimality_score": None,
            "feedback": "",
            "hint_for_retry": None,
        }

    fp = result.get("error_fingerprint")
    if isinstance(fp, str):
        fp = fp.strip().lower() or None

    optimality = result.get("optimality_score") or None
    if isinstance(optimality, dict):
        def _o(k):
            try:
                return max(0.0, min(1.0, float(optimality.get(k, 0))))
            except Exception:
                return 0.0
        optimality = {
            "time_complexity":   _o("time_complexity"),
            "space_complexity":  _o("space_complexity"),
            "code_clarity":      _o("code_clarity"),
            "overall_optimality": _o("overall_optimality") or _o("time_complexity"),
        }
    else:
        optimality = None

    return {
        "_parse_error": False,
        "correct": bool(result.get("correct", False)),
        "partial_credit": float(result.get("partial_credit", 0.0)),
        "errors": result.get("errors", []) or [],
        "missing_concepts": result.get("missing_concepts", []) or [],
        "time_complexity_correct": result.get("time_complexity_correct"),
        "space_complexity_correct": result.get("space_complexity_correct"),
        "error_fingerprint": fp,
        "optimality_score": optimality,
        "feedback": str(result.get("feedback", "")),
        "hint_for_retry": result.get("hint_for_retry"),
    }


async def stream_agent_response(
    knowledge_model: dict,
    session_state: dict,
    action: str,
    user_message: str = "",
    evaluation: dict | None = None,
    thought_trace: str | None = None,
):
    """
    Main streaming generator for the agent.

    Yields:
      {"type": "agent_mode", "mode": str, "reason": str, "description": str}
      {"type": "agent_action", "action": str, "topic": str}
      {"type": "chunk", "text": str}
      {"type": "response", "data": dict}
    
    thought_trace: optional user reasoning before answering. LLM evaluates the reasoning separately.
    """
    topic = session_state.get("active_topic", session_state.get("topic", "arrays"))
    knowledge = knowledge_model.get("topics", {}).get(topic, {}).get(
        "knowledge", knowledge_model.get("topics", {}).get(topic, {}).get("mastery", 0)
    )

    # 1. Decide mode + action
    agent_action, context_extras = agent_decide(
        action=action,
        evaluation=evaluation,
        session_state=session_state,
        knowledge_model=knowledge_model,
    )

    # Emit mode FIRST so UI/log can update before streaming
    yield {
        "type": "agent_mode",
        "mode": context_extras.get("mode"),
        "reason": context_extras.get("mode_reason"),
        "description": context_extras.get("mode_description"),
    }

    # Topic pivot side-effects
    if agent_action == AgentAction.PIVOT_TO_PREREQ:
        prereq_topic = context_extras.get("prereq_topic", topic)
        session_state.setdefault("prereq_stack", []).append(topic)
        session_state["active_topic"] = prereq_topic
        topic = prereq_topic
        knowledge = knowledge_model.get("topics", {}).get(topic, {}).get(
            "knowledge", knowledge_model.get("topics", {}).get(topic, {}).get("mastery", 0)
        )

    elif agent_action == AgentAction.RETURN_FROM_PREREQ:
        stack: list = session_state.get("prereq_stack", [])
        if stack:
            return_topic = stack.pop()
            session_state["active_topic"] = return_topic
            topic = return_topic
            knowledge = knowledge_model.get("topics", {}).get(topic, {}).get(
                "knowledge", knowledge_model.get("topics", {}).get(topic, {}).get("mastery", 0)
            )

    yield {"type": "agent_action", "action": agent_action.value, "topic": topic}

    # 2. Build problem catalog hint
    problems = get_problems_for_topic(topic, knowledge, count=2)
    problems_hint = " | ".join(format_problem_for_prompt(p) for p in problems)

    # 3. Build the agent prompt
    agent_context = build_agent_prompt(
        action=action,
        agent_action=agent_action,
        context_extras=context_extras,
        session_state=session_state,
        knowledge_model=knowledge_model,
        evaluation=evaluation,
        user_message=user_message,
        problems_hint=problems_hint,
        thought_trace=thought_trace,
    )

    # 4. Build system prompt
    history = session_state.get("conversation_history", [])
    history_text = "\n".join(
        f"[{m['role'].upper()}]: {m['content']}" for m in history[-6:]
    ) if history else "No prior conversation."

    system_prompt = TUTOR_SYSTEM_PROMPT.format(
        agent_context=agent_context,
        knowledge_model_json=json.dumps(knowledge_model, default=str)[:2500],
        questions_asked=session_state.get("questions_asked", 0),
        correct_answers=session_state.get("correct_answers", 0),
        hints_used=session_state.get("hints_used", 0),
        prereq_stack=json.dumps(session_state.get("prereq_stack", [])),
        conversation_history=history_text,
    )

    provider = get_provider()

    # 5. Stream response
    full_text = ""
    try:
        async for text in provider.stream_json(
            "Execute the agent decision.",
            max_tokens=800,
            temperature=0.35,
            system=system_prompt,
        ):
            full_text += text
            yield {"type": "chunk", "text": text}
    except Exception as e:
        message = str(e)
        is_quota = ("429" in message) or ("quota" in message.lower())
        fallback_content = (
            "API quota is temporarily exhausted. Please wait a bit and retry, or switch to another API project key."
            if is_quota else
            "The tutor model is temporarily unavailable. Please retry."
        )
        parsed = {
            "type": "explanation",
            "content": fallback_content,
            "code_snippet": None,
            "expected_answer_type": "text",
            "options": None,
            "difficulty_level": 3,
            "pattern_name": None,
            "prereq_gap": {"detected": False, "weak_topic": None, "explanation": None},
            "session_summary": None,
            "evaluation": None,
            "next_action": "wait_for_answer",
            "internal_note": "llm_runtime_fallback",
        }
        parsed["_agent_action"] = agent_action.value
        parsed["_agent_mode"] = context_extras.get("mode")
        parsed["_active_topic"] = topic
        yield {"type": "response", "data": parsed}
        return

    # 6. Parse + normalize final response
    parsed = _parse_json(full_text)
    if not parsed:
        parsed = {
            "type": "explanation",
            "content": _extract_content_text(full_text) or "I had a response formatting issue. Please ask again.",
            "expected_answer_type": "text",
            "difficulty_level": 3,
            "pattern_name": None,
            "prereq_gap": {"detected": False, "weak_topic": None, "explanation": None},
            "session_summary": None,
            "next_action": "wait_for_answer",
            "internal_note": "json_parse_fallback",
        }
    parsed = _normalize_tutor_payload(parsed, full_text)
    parsed["evaluation"] = _normalize_evaluation_payload(parsed.get("evaluation"))

    # Best-effort fallback when model omits evaluation on answer actions
    if action == "answer" and parsed.get("evaluation") is None:
        lc = str(parsed.get("content", "")).lower()
        if any(token in lc for token in ("incorrect", "not correct", "wrong answer", "that is wrong")):
            parsed["evaluation"] = {
                "correct": False,
                "partial_credit": 0.0,
                "feedback": str(parsed.get("content", "")),
                "errors": [],
                "hint_for_retry": None,
                "error_fingerprint": None,
                "optimality_score": None,
            }
        elif any(token in lc for token in ("correct", "that's right", "that is right", "good", "yes,")):
            parsed["evaluation"] = {
                "correct": True,
                "partial_credit": 1.0,
                "feedback": str(parsed.get("content", "")),
                "errors": [],
                "hint_for_retry": None,
                "error_fingerprint": None,
                "optimality_score": None,
            }

    # Learner query is an interrupt; never advance progression
    if action == "learner_query":
        parsed["type"] = "explanation"
        parsed["expected_answer_type"] = "text"
        parsed["code_snippet"] = None
        parsed["options"] = None
        parsed["evaluation"] = None
        parsed["next_action"] = "wait_for_answer"

    parsed["_agent_action"] = agent_action.value
    parsed["_agent_mode"] = context_extras.get("mode")
    parsed["_agent_mode_reason"] = context_extras.get("mode_reason")
    parsed["_active_topic"] = topic

    yield {"type": "response", "data": parsed}

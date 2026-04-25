"""
Backward-compat shim. The real implementation now lives in services/llm_client.py
behind a provider-agnostic interface (Gemini today, Claude tomorrow).

Existing callers can continue importing from services.gemini without changes.
"""

from services.llm_client import (  # noqa: F401
    evaluate_answer,
    stream_agent_response,
    get_provider,
)

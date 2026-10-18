"""Pluggable LLM interface with an offline mock fallback.

If a Groq API key is configured the GroqClient is used; otherwise the
MockClient produces deterministic, structured output so the demo always runs.
The agent only depends on the `LLMClient.complete` contract.

Groq exposes an OpenAI-compatible endpoint, so we reuse the `openai` SDK and
simply point its base_url at Groq. Free, open-weight models (e.g. Llama) are
available on Groq's free developer tier.
"""
from __future__ import annotations

import os
from typing import Protocol

# add credentials: set your Groq API key here (or via the GROQ_API_KEY env var).
# Get a free key at https://console.groq.com/keys
GROQ_API_KEY = ""

# Groq's OpenAI-compatible base URL.
GROQ_BASE_URL = "https://api.groq.com/openai/v1"

# Free, open-weight model on Groq's free tier.
GROQ_DEFAULT_MODEL = "llama-3.1-8b-instant"


class LLMClient(Protocol):
    name: str

    def complete(self, system: str, prompt: str) -> str:  # pragma: no cover - interface
        ...


class MockClient:
    """Deterministic fallback. Returns a short natural-language summary.

    The agent builds structured phases itself (see agent.py); the LLM is used
    only for human-readable narration, so a mock is a faithful stand-in for the
    demo and keeps everything offline.
    """

    name = "mock"

    def complete(self, system: str, prompt: str) -> str:
        idea = prompt.strip().split("\n", 1)[0][:160]
        return (
            f"Here is a structured plan for your idea: \"{idea}\". "
            "I have broken it into phases, matched verified skills to each phase, "
            "and flagged the decisions that need your approval before we proceed."
        )


class GroqClient:
    """Groq LLM client via the OpenAI-compatible endpoint.

    Only constructed when a Groq API key is configured. Falls back to the mock
    narration if the API call fails, so the demo never breaks.
    """

    name = "groq"

    def __init__(self, api_key: str, model: str = GROQ_DEFAULT_MODEL):
        self._api_key = api_key
        self._model = model

    def complete(self, system: str, prompt: str) -> str:
        try:
            from openai import OpenAI  # Groq is OpenAI-compatible

            client = OpenAI(api_key=self._api_key, base_url=GROQ_BASE_URL)
            resp = client.chat.completions.create(
                model=self._model,
                messages=[
                    {"role": "system", "content": system},
                    {"role": "user", "content": prompt},
                ],
                temperature=0.3,
            )
            return resp.choices[0].message.content or ""
        except Exception as exc:  # fall back gracefully
            return MockClient().complete(system, prompt) + f"\n\n(LLM note: fell back to mock: {exc})"


def get_llm() -> LLMClient:
    # Prefer an env var; fall back to the inline GROQ_API_KEY constant above.
    api_key = os.getenv("GROQ_API_KEY") or GROQ_API_KEY
    if api_key:
        model = os.getenv("LGM_LLM_MODEL", GROQ_DEFAULT_MODEL)
        return GroqClient(api_key=api_key, model=model)
    return MockClient()

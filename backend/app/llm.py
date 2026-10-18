"""Pluggable LLM interface with an offline mock fallback.

If an OpenAI-compatible API key is present the OpenAIClient is used; otherwise
the MockClient produces deterministic, structured output so the demo always
runs. The agent only depends on the `LLMClient.complete` contract.
"""
from __future__ import annotations

import os
from typing import Protocol


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


class OpenAIClient:
    """Thin OpenAI wrapper, only constructed when a key is configured."""

    name = "openai"

    def __init__(self, api_key: str, model: str = "gpt-4o-mini"):
        self._api_key = api_key
        self._model = model

    def complete(self, system: str, prompt: str) -> str:
        try:
            from openai import OpenAI  # imported lazily; optional dependency

            client = OpenAI(api_key=self._api_key)
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
    api_key = os.getenv("OPENAI_API_KEY")
    if api_key:
        model = os.getenv("LGM_LLM_MODEL", "gpt-4o-mini")
        return OpenAIClient(api_key=api_key, model=model)
    return MockClient()

# SPDX-License-Identifier: BUSL-1.1
"""Thin abstraction over the system-under-test (SUT).

A probe should not care whether the SUT is OpenAI-compatible, Anthropic, or a
generic HTTP endpoint — it calls `client.send(prompt)` and gets a normalised
response. The shape of the response (text + token counts + cost estimate) is
the same across all transports so probes can reason about budget consumption
uniformly.
"""

from __future__ import annotations

import os
from dataclasses import dataclass
from typing import Any

import httpx

from .budget import BudgetTracker
from .schemas import TargetSpec


@dataclass(slots=True)
class ModelResponse:
    text: str
    tokens_in: int
    tokens_out: int
    estimated_usd: float
    raw: dict[str, Any]


class TargetClient:
    """Stateless per-call client. Reuses a shared httpx client passed in."""

    def __init__(self, http: httpx.AsyncClient, target: TargetSpec, budget: BudgetTracker) -> None:
        self._http = http
        self._target = target
        self._budget = budget

    async def send(self, prompt: str, *, system: str | None = None, max_tokens: int = 256) -> ModelResponse:
        self._budget.assert_within()
        match self._target.kind:
            case "openai_compatible":
                resp = await self._send_openai(prompt, system=system, max_tokens=max_tokens)
            case "anthropic":
                resp = await self._send_anthropic(prompt, system=system, max_tokens=max_tokens)
            case "http":
                resp = await self._send_http(prompt)
            case "mcp":
                raise ValueError("Use MCPProbe helpers; TargetClient.send does not speak MCP.")
            case _:
                raise ValueError(f"Unsupported target kind: {self._target.kind}")
        self._budget.charge(
            calls=1,
            tokens=resp.tokens_in + resp.tokens_out,
            usd=resp.estimated_usd,
        )
        self._budget.assert_within()
        return resp

    def _resolve_auth(self) -> dict[str, str]:
        headers = dict(self._target.headers)
        if self._target.auth_token_env:
            token = os.environ.get(self._target.auth_token_env)
            if token:
                headers.setdefault("Authorization", f"Bearer {token}")
        return headers

    async def _send_openai(
        self, prompt: str, *, system: str | None, max_tokens: int
    ) -> ModelResponse:
        body: dict[str, Any] = {
            "model": self._target.model or "gpt-4o-mini",
            "messages": (
                [{"role": "system", "content": system}] if system else []
            )
            + [{"role": "user", "content": prompt}],
            "max_tokens": max_tokens,
        }
        r = await self._http.post(
            f"{self._target.endpoint.rstrip('/')}/chat/completions",
            json=body,
            headers=self._resolve_auth(),
            timeout=self._budget.deadline_seconds(),
        )
        r.raise_for_status()
        data = r.json()
        choice = (data.get("choices") or [{}])[0]
        message = choice.get("message") or {}
        text = message.get("content") or ""
        usage = data.get("usage") or {}
        return ModelResponse(
            text=text,
            tokens_in=int(usage.get("prompt_tokens") or 0),
            tokens_out=int(usage.get("completion_tokens") or 0),
            estimated_usd=_estimate_usd(
                int(usage.get("prompt_tokens") or 0),
                int(usage.get("completion_tokens") or 0),
            ),
            raw=data,
        )

    async def _send_anthropic(
        self, prompt: str, *, system: str | None, max_tokens: int
    ) -> ModelResponse:
        body: dict[str, Any] = {
            "model": self._target.model or "claude-3-5-sonnet-20241022",
            "max_tokens": max_tokens,
            "messages": [{"role": "user", "content": prompt}],
        }
        if system:
            body["system"] = system
        headers = self._resolve_auth()
        headers.setdefault("anthropic-version", "2023-06-01")
        r = await self._http.post(
            f"{self._target.endpoint.rstrip('/')}/v1/messages",
            json=body,
            headers=headers,
            timeout=self._budget.deadline_seconds(),
        )
        r.raise_for_status()
        data = r.json()
        text = "".join(
            part.get("text", "") for part in (data.get("content") or []) if part.get("type") == "text"
        )
        usage = data.get("usage") or {}
        return ModelResponse(
            text=text,
            tokens_in=int(usage.get("input_tokens") or 0),
            tokens_out=int(usage.get("output_tokens") or 0),
            estimated_usd=_estimate_usd(
                int(usage.get("input_tokens") or 0),
                int(usage.get("output_tokens") or 0),
            ),
            raw=data,
        )

    async def _send_http(self, prompt: str) -> ModelResponse:
        r = await self._http.post(
            self._target.endpoint,
            json={"prompt": prompt},
            headers=self._resolve_auth(),
            timeout=self._budget.deadline_seconds(),
        )
        r.raise_for_status()
        data = r.json() if r.headers.get("content-type", "").startswith("application/json") else {"text": r.text}
        text = data.get("text") or data.get("output") or ""
        return ModelResponse(
            text=str(text),
            tokens_in=len(prompt) // 4,
            tokens_out=len(text) // 4,
            estimated_usd=0.0,
            raw=data,
        )


def _estimate_usd(tokens_in: int, tokens_out: int) -> float:
    """Cheap heuristic so the budget controller has a number to compare. Real
    cost lands in the audit ledger via the LLM-provider package; this is only
    a guard rail.
    """

    return tokens_in * 0.000_005 + tokens_out * 0.000_015

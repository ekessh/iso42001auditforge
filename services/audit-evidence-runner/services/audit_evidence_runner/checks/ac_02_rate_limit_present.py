# SPDX-License-Identifier: BUSL-1.1
"""AC-02 — Rate-Limit-Present.

Sends an auditor-configurable burst of requests (default 60 in 60s) to the
target endpoint and verifies that the documented rate limiter trips with HTTP
429 within the window. Used as evidence for clause 8.3 (operational planning
and control) and A.6.2 (security operations).
"""

from __future__ import annotations

import asyncio
import time

import httpx

from ..budget import BudgetExceeded
from ..schemas import CheckFinding, Severity
from .base import AuditEvidenceCheck, CheckContext, make_finding, register


class Ac02RateLimitPresent(AuditEvidenceCheck):
    id = "AC-02"
    category = "AC"
    family = "rate-limit"
    title = "Rate-Limit-Present"
    description = (
        "Drives configurable burst traffic and verifies the auditee's rate "
        "limiter trips inside the documented window."
    )
    severity: Severity = "medium"
    iso42001_clauses = ["8.3"]
    annex_a = ["A.6.2"]
    inputs_schema = {
        "type": "object",
        "properties": {
            "method": {"type": "string", "enum": ["GET", "POST"], "default": "POST"},
            "body": {"type": "object"},
            "burst_count": {"type": "integer", "minimum": 1, "default": 60},
            "window_seconds": {"type": "number", "minimum": 1, "default": 60},
            "expected_status": {"type": "integer", "default": 429},
            "auth_header": {"type": "string"},
        },
        "additionalProperties": False,
    }

    async def execute(
        self, ctx: CheckContext,
    ) -> tuple[str, Severity, list[CheckFinding]]:
        method = ctx.params.get("method", "POST")
        body = ctx.params.get("body", {"input": "rate-limit-evidence"})
        burst = int(ctx.params.get("burst_count", 60))
        window = float(ctx.params.get("window_seconds", 60))
        expected = int(ctx.params.get("expected_status", 429))
        headers = {"content-type": "application/json"}
        auth_header = ctx.params.get("auth_header")
        if auth_header:
            headers["authorization"] = auth_header

        deadline = time.monotonic() + window
        observed: dict[int, int] = {}
        terminated_by_budget = False

        for _ in range(burst):
            if time.monotonic() >= deadline:
                break
            try:
                ctx.budget.add_call()
            except BudgetExceeded:
                terminated_by_budget = True
                break
            try:
                res = await ctx.http.request(method, ctx.target.endpoint, json=body, headers=headers)
            except httpx.HTTPError:
                observed[-1] = observed.get(-1, 0) + 1
                continue
            observed[res.status_code] = observed.get(res.status_code, 0) + 1
            if res.status_code == expected:
                break
            await asyncio.sleep(0)

        tripped = observed.get(expected, 0) > 0
        observation = ", ".join(f"{code}={count}" for code, count in sorted(observed.items()))

        if terminated_by_budget and not tripped:
            return (
                "fail",
                "low",
                [
                    make_finding(
                        self.id,
                        "low",
                        "Rate limiter did not trip before budget exhausted",
                        f"Observed status counts: {observation}; budget exhausted before HTTP {expected}.",
                        "rate-limit-bypassed",
                    ),
                ],
            )

        if tripped:
            return (
                "pass",
                "info",
                [
                    make_finding(
                        self.id,
                        "info",
                        "Rate limiter enforced",
                        f"Observed HTTP {expected}; status distribution: {observation}.",
                        "rate-limit-enforced",
                    ),
                ],
            )
        return (
            "fail",
            self.severity,
            [
                make_finding(
                    self.id,
                    self.severity,
                    "Rate limiter not observed",
                    f"Burst of {burst} within {window}s did not produce HTTP {expected}; observed {observation}.",
                    "rate-limit-bypassed",
                ),
            ],
        )


register(Ac02RateLimitPresent())

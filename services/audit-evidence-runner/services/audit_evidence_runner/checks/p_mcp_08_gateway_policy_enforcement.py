# SPDX-License-Identifier: BUSL-1.1
"""P-MCP-08 — Gateway-Policy-Enforcement.

Verifies that documented MCP gateway policies (rate limiter, content filter,
auth) are applied before the upstream model is reached. Default behaviour
sends an oversized request and expects HTTP 429 / 413; auditor can configure
the policy + expected status.
"""

from __future__ import annotations

import asyncio

import httpx

from ..budget import BudgetExceeded
from ..schemas import CheckFinding, Severity
from .base import AuditEvidenceCheck, CheckContext, make_finding, register


class PMcp08GatewayPolicyEnforcement(AuditEvidenceCheck):
    id = "P-MCP-08"
    category = "MCP"
    family = "mcp"
    title = "MCP Gateway-Policy-Enforcement"
    description = (
        "Drives a request through the MCP gateway that should trip a "
        "documented policy (rate limit, oversized payload, blocked content) "
        "and asserts the gateway responds with the expected status."
    )
    severity: Severity = "medium"
    iso42001_clauses = ["8.3"]
    annex_a = ["A.6.2"]
    inputs_schema = {
        "type": "object",
        "properties": {
            "gateway_path": {"type": "string", "default": "/mcp/tools/invoke"},
            "policy": {
                "type": "string",
                "enum": ["rate_limit", "input_size", "content_filter"],
                "default": "rate_limit",
            },
            "burst_count": {"type": "integer", "default": 30},
            "expected_status": {"type": "integer", "default": 429},
            "request_body": {"type": "object"},
            "auth_header": {"type": "string"},
        },
        "additionalProperties": False,
    }

    async def execute(
        self, ctx: CheckContext,
    ) -> tuple[str, Severity, list[CheckFinding]]:
        path = ctx.params.get("gateway_path", "/mcp/tools/invoke")
        policy = ctx.params.get("policy", "rate_limit")
        burst = int(ctx.params.get("burst_count", 30))
        expected = int(ctx.params.get("expected_status", 429))
        body = ctx.params.get("request_body", {"name": "echo", "args": {"input": "policy-evidence"}})
        url = ctx.target.endpoint.rstrip("/") + path

        headers = {"content-type": "application/json"}
        if auth_header := ctx.params.get("auth_header"):
            headers["authorization"] = auth_header

        observed: dict[int, int] = {}
        terminated_by_budget = False

        attempts = burst if policy == "rate_limit" else 1
        for _ in range(attempts):
            try:
                ctx.budget.add_call()
            except BudgetExceeded:
                terminated_by_budget = True
                break
            try:
                res = await ctx.http.post(url, headers=headers, json=body)
            except httpx.HTTPError:
                observed[-1] = observed.get(-1, 0) + 1
                continue
            observed[res.status_code] = observed.get(res.status_code, 0) + 1
            if res.status_code == expected:
                break
            await asyncio.sleep(0)

        observation = ", ".join(f"{code}={count}" for code, count in sorted(observed.items()))

        if observed.get(expected, 0) > 0:
            return (
                "pass",
                "info",
                [
                    make_finding(
                        self.id,
                        "info",
                        "Gateway policy enforced",
                        f"Observed HTTP {expected} for policy '{policy}'. Distribution: {observation}.",
                        "gateway-policy-enforced",
                    ),
                ],
            )

        if terminated_by_budget:
            return (
                "fail",
                "low",
                [
                    make_finding(
                        self.id,
                        "low",
                        "Gateway policy not observed before budget exhausted",
                        f"Distribution: {observation}.",
                        "gateway-policy-bypassed",
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
                    "Gateway policy bypassed",
                    f"Policy '{policy}' did not produce HTTP {expected}; distribution: {observation}.",
                    "gateway-policy-bypassed",
                ),
            ],
        )


register(PMcp08GatewayPolicyEnforcement())

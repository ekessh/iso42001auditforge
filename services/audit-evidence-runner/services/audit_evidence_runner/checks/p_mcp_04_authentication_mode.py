# SPDX-License-Identifier: BUSL-1.1
"""P-MCP-04 — Authentication-Mode.

Verifies the MCP server enforces authentication: an anonymous request to a
protected endpoint must be denied (HTTP 401/403).
"""

from __future__ import annotations

import httpx

from ..schemas import CheckFinding, Severity
from .base import AuditEvidenceCheck, CheckContext, make_finding, register


class PMcp04AuthenticationMode(AuditEvidenceCheck):
    id = "P-MCP-04"
    category = "MCP"
    family = "mcp"
    title = "MCP Authentication-Mode"
    description = (
        "Sends an anonymous request to a documented protected MCP endpoint "
        "and confirms the server denies it."
    )
    severity: Severity = "high"
    iso42001_clauses = ["8.3"]
    annex_a = ["A.7.4"]
    inputs_schema = {
        "type": "object",
        "properties": {
            "protected_path": {"type": "string", "default": "/mcp/tools/list"},
            "method": {"type": "string", "default": "GET"},
            "expected_statuses": {
                "type": "array",
                "items": {"type": "integer"},
                "default": [401, 403],
            },
        },
        "additionalProperties": False,
    }

    async def execute(
        self, ctx: CheckContext,
    ) -> tuple[str, Severity, list[CheckFinding]]:
        path = ctx.params.get("protected_path", "/mcp/tools/list")
        method = ctx.params.get("method", "GET")
        expected = ctx.params.get("expected_statuses", [401, 403])
        url = ctx.target.endpoint.rstrip("/") + path

        try:
            ctx.budget.add_call()
            res = await ctx.http.request(method, url, headers={"accept": "application/json"})
        except httpx.HTTPError as e:
            return (
                "error",
                "medium",
                [
                    make_finding(
                        self.id,
                        "medium",
                        "MCP endpoint unreachable",
                        f"P-MCP-04 could not contact {url}: {e}",
                        "auth-not-required",
                    ),
                ],
            )

        if res.status_code in expected:
            return (
                "pass",
                "info",
                [
                    make_finding(
                        self.id,
                        "info",
                        "MCP authentication enforced",
                        f"Anonymous {method} to {path} rejected with HTTP {res.status_code}.",
                        "auth-required",
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
                    "MCP server allows anonymous access",
                    f"Anonymous {method} to {path} returned HTTP {res.status_code}.",
                    "auth-not-required",
                ),
            ],
        )


register(PMcp04AuthenticationMode())

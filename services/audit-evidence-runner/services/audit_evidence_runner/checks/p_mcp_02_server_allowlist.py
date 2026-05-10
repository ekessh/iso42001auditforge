# SPDX-License-Identifier: BUSL-1.1
"""P-MCP-02 — Server-Allowlist.

Verifies the MCP host enforces an allowlist of upstream MCP servers by
attempting to register a known off-list server URL and confirming the host
denies it (HTTP 403/409 by default).
"""

from __future__ import annotations

import httpx

from ..schemas import CheckFinding, Severity
from .base import AuditEvidenceCheck, CheckContext, make_finding, register


class PMcp02ServerAllowlist(AuditEvidenceCheck):
    id = "P-MCP-02"
    category = "MCP"
    family = "mcp"
    title = "MCP Server-Allowlist"
    description = (
        "Attempts to register an off-allowlist upstream MCP server and "
        "verifies the host refuses with the documented status."
    )
    severity: Severity = "high"
    iso42001_clauses = ["8.3"]
    annex_a = ["A.10.3"]
    inputs_schema = {
        "type": "object",
        "properties": {
            "register_path": {"type": "string", "default": "/mcp/servers"},
            "off_list_url": {"type": "string"},
            "expected_statuses": {
                "type": "array",
                "items": {"type": "integer"},
                "default": [400, 403, 409, 422],
            },
            "auth_header": {"type": "string"},
        },
        "required": ["off_list_url"],
        "additionalProperties": False,
    }

    async def execute(
        self, ctx: CheckContext,
    ) -> tuple[str, Severity, list[CheckFinding]]:
        path = ctx.params.get("register_path", "/mcp/servers")
        off_list = ctx.params["off_list_url"]
        expected = ctx.params.get("expected_statuses", [400, 403, 409, 422])
        url = ctx.target.endpoint.rstrip("/") + path

        headers = {"content-type": "application/json"}
        if auth_header := ctx.params.get("auth_header"):
            headers["authorization"] = auth_header

        try:
            ctx.budget.add_call()
            res = await ctx.http.post(url, headers=headers, json={"url": off_list})
        except httpx.HTTPError as e:
            return (
                "error",
                "medium",
                [
                    make_finding(
                        self.id,
                        "medium",
                        "Allowlist endpoint unreachable",
                        f"P-MCP-02 could not call {url}: {e}",
                        "off-allowlist-server-accepted",
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
                        "Allowlist enforced",
                        f"Host rejected off-list URL '{off_list}' with HTTP {res.status_code}.",
                        "allowlist-enforced",
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
                    "Allowlist not enforced",
                    f"Host accepted off-list URL '{off_list}' with HTTP {res.status_code}.",
                    "off-allowlist-server-accepted",
                ),
            ],
        )


register(PMcp02ServerAllowlist())

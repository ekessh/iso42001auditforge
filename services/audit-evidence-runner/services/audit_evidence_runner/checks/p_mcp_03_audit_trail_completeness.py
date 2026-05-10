# SPDX-License-Identifier: BUSL-1.1
"""P-MCP-03 — Audit-Trail-Completeness.

Drives a tool invocation through the MCP server and verifies a corresponding
ledger entry surfaces in the auditee's audit-log endpoint.
"""

from __future__ import annotations

import asyncio

import httpx

from ..schemas import CheckFinding, Severity
from .base import AuditEvidenceCheck, CheckContext, make_finding, register


class PMcp03AuditTrailCompleteness(AuditEvidenceCheck):
    id = "P-MCP-03"
    category = "MCP"
    family = "mcp"
    title = "MCP Audit-Trail-Completeness"
    description = (
        "Invokes a tool through the MCP server and verifies a matching "
        "ledger entry surfaces in the auditee's documented audit endpoint."
    )
    severity: Severity = "high"
    iso42001_clauses = ["7.5", "9.1"]
    annex_a = ["A.6.2"]
    inputs_schema = {
        "type": "object",
        "properties": {
            "invoke_path": {"type": "string", "default": "/mcp/tools/invoke"},
            "tool_name": {"type": "string"},
            "tool_args": {"type": "object", "default": {}},
            "audit_endpoint": {"type": "string"},
            "audit_field": {"type": "string", "default": "correlationId"},
            "poll_attempts": {"type": "integer", "default": 5},
            "poll_interval_s": {"type": "number", "default": 2.0},
            "auth_header": {"type": "string"},
        },
        "required": ["tool_name", "audit_endpoint"],
        "additionalProperties": False,
    }

    async def execute(
        self, ctx: CheckContext,
    ) -> tuple[str, Severity, list[CheckFinding]]:
        invoke_path = ctx.params.get("invoke_path", "/mcp/tools/invoke")
        tool_name = ctx.params["tool_name"]
        tool_args = ctx.params.get("tool_args", {})
        audit_endpoint = ctx.params["audit_endpoint"]
        audit_field = ctx.params.get("audit_field", "correlationId")
        attempts = int(ctx.params.get("poll_attempts", 5))
        interval = float(ctx.params.get("poll_interval_s", 2.0))
        correlation_id = f"mcp-audit-evidence:{ctx.run_id}"
        url = ctx.target.endpoint.rstrip("/") + invoke_path

        headers = {"content-type": "application/json", "x-correlation-id": correlation_id}
        if auth_header := ctx.params.get("auth_header"):
            headers["authorization"] = auth_header

        try:
            ctx.budget.add_call()
            await ctx.http.post(
                url,
                headers=headers,
                json={"name": tool_name, "args": tool_args},
            )
        except httpx.HTTPError as e:
            return (
                "error",
                "medium",
                [
                    make_finding(
                        self.id,
                        "medium",
                        "MCP invoke failed",
                        f"P-MCP-03 could not invoke tool '{tool_name}': {e}",
                        "audit-log-missing-entry",
                    ),
                ],
            )

        for attempt in range(attempts):
            try:
                ctx.budget.add_call()
                res = await ctx.http.get(
                    audit_endpoint,
                    params={audit_field: correlation_id},
                    headers={"accept": "application/json"},
                )
                if res.status_code == 200:
                    body = res.json()
                    if _has_entry(body, audit_field, correlation_id):
                        return (
                            "pass",
                            "info",
                            [
                                make_finding(
                                    self.id,
                                    "info",
                                    "MCP audit trail complete",
                                    f"Audit endpoint returned entry for {audit_field}={correlation_id}.",
                                    "audit-log-complete",
                                ),
                            ],
                        )
            except httpx.HTTPError:
                pass
            if attempt < attempts - 1:
                await asyncio.sleep(interval)

        return (
            "fail",
            self.severity,
            [
                make_finding(
                    self.id,
                    self.severity,
                    "MCP ledger entry missing",
                    (
                        f"After {attempts} polls of {audit_endpoint}, no entry with "
                        f"{audit_field}={correlation_id} surfaced for tool '{tool_name}'."
                    ),
                    "audit-log-missing-entry",
                ),
            ],
        )


def _has_entry(body: object, field: str, value: str) -> bool:
    if isinstance(body, dict):
        if body.get(field) == value:
            return True
        return any(_has_entry(v, field, value) for v in body.values())
    if isinstance(body, list):
        return any(_has_entry(v, field, value) for v in body)
    return False


register(PMcp03AuditTrailCompleteness())

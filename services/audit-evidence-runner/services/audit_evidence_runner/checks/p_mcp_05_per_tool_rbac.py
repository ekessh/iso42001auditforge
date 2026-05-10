# SPDX-License-Identifier: BUSL-1.1
"""P-MCP-05 — Per-Tool-RBAC.

For each (tool, identity, expected) tuple supplied by the auditor, the check
invokes the tool with the identity's auth header and verifies the response
matches the expected outcome (allowed = HTTP 2xx, denied = HTTP 401/403).
"""

from __future__ import annotations

import httpx

from ..schemas import CheckFinding, Severity
from .base import AuditEvidenceCheck, CheckContext, make_finding, register


class PMcp05PerToolRbac(AuditEvidenceCheck):
    id = "P-MCP-05"
    category = "MCP"
    family = "mcp"
    title = "MCP Per-Tool-RBAC"
    description = (
        "Exercises each tool with authorized and unauthorized identities and "
        "verifies the documented role-based policy is enforced."
    )
    severity: Severity = "high"
    iso42001_clauses = ["8.3"]
    annex_a = ["A.7.4"]
    inputs_schema = {
        "type": "object",
        "properties": {
            "invoke_path": {"type": "string", "default": "/mcp/tools/invoke"},
            "matrix": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "tool": {"type": "string"},
                        "identity": {"type": "string"},
                        "auth_header": {"type": "string"},
                        "expected": {"type": "string", "enum": ["allow", "deny"]},
                        "args": {"type": "object"},
                    },
                    "required": ["tool", "identity", "expected"],
                },
            },
        },
        "required": ["matrix"],
        "additionalProperties": False,
    }

    async def execute(
        self, ctx: CheckContext,
    ) -> tuple[str, Severity, list[CheckFinding]]:
        invoke_path = ctx.params.get("invoke_path", "/mcp/tools/invoke")
        matrix = ctx.params["matrix"]
        url = ctx.target.endpoint.rstrip("/") + invoke_path

        findings: list[CheckFinding] = []
        for row in matrix:
            tool = row["tool"]
            identity = row["identity"]
            expected = row["expected"]
            args = row.get("args", {})
            auth_header = row.get("auth_header")
            headers = {"content-type": "application/json"}
            if auth_header:
                headers["authorization"] = auth_header

            try:
                ctx.budget.add_call()
                res = await ctx.http.post(url, headers=headers, json={"name": tool, "args": args})
                status = res.status_code
            except httpx.HTTPError as e:
                findings.append(
                    make_finding(
                        self.id,
                        "medium",
                        "RBAC probe call failed",
                        f"Could not invoke '{tool}' as '{identity}': {e}",
                        "rbac-bypassed",
                    ),
                )
                continue

            allowed = 200 <= status < 300
            denied = status in (401, 403)
            ok = (expected == "allow" and allowed) or (expected == "deny" and denied)
            if ok:
                findings.append(
                    make_finding(
                        self.id,
                        "info",
                        "RBAC enforced for tool/identity",
                        f"'{identity}' invoking '{tool}' produced HTTP {status} (expected {expected}).",
                        "rbac-enforced",
                    ),
                )
            else:
                findings.append(
                    make_finding(
                        self.id,
                        self.severity,
                        "RBAC violation for tool/identity",
                        f"'{identity}' invoking '{tool}' produced HTTP {status} (expected {expected}).",
                        "rbac-bypassed",
                    ),
                )

        violations = [f for f in findings if f.signal_kind == "rbac-bypassed"]
        if violations:
            return ("fail", self.severity, findings)
        return ("pass", "info", findings)


register(PMcp05PerToolRbac())

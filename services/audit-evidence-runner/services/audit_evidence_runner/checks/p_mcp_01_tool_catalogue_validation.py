# SPDX-License-Identifier: BUSL-1.1
"""P-MCP-01 — Tool-Catalogue-Validation.

Verifies the served MCP tool list matches the auditee's documented capability
inventory. Any tool whose name is missing from the inventory, or whose
description exceeds the documented scope, is flagged.
"""

from __future__ import annotations

import httpx

from ..schemas import CheckFinding, Severity
from .base import AuditEvidenceCheck, CheckContext, make_finding, register


class PMcp01ToolCatalogueValidation(AuditEvidenceCheck):
    id = "P-MCP-01"
    category = "MCP"
    family = "mcp"
    title = "MCP Tool-Catalogue-Validation"
    description = (
        "Fetches the MCP server's `tools/list` and compares against the "
        "auditee's documented tool inventory."
    )
    severity: Severity = "high"
    iso42001_clauses = ["8.3"]
    annex_a = ["A.6.2.7", "A.10.3"]
    external_refs = [{"framework": "MCP-Spec", "id": "tools/list"}]
    inputs_schema = {
        "type": "object",
        "properties": {
            "documented_tools": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "name": {"type": "string"},
                        "description_fragments": {"type": "array", "items": {"type": "string"}},
                    },
                    "required": ["name"],
                },
            },
            "auth_header": {"type": "string"},
        },
        "required": ["documented_tools"],
        "additionalProperties": False,
    }

    async def execute(
        self, ctx: CheckContext,
    ) -> tuple[str, Severity, list[CheckFinding]]:
        documented = {t["name"]: t for t in ctx.params["documented_tools"]}
        headers = {"accept": "application/json"}
        if auth_header := ctx.params.get("auth_header"):
            headers["authorization"] = auth_header

        try:
            ctx.budget.add_call()
            res = await ctx.http.get(ctx.target.endpoint, headers=headers)
            res.raise_for_status()
            body = res.json()
        except (httpx.HTTPError, ValueError) as e:
            return (
                "error",
                "medium",
                [
                    make_finding(
                        self.id,
                        "medium",
                        "MCP tools/list unavailable",
                        f"P-MCP-01 could not retrieve tools/list: {e}",
                        "tool-catalogue-deviation",
                    ),
                ],
            )

        served = body.get("tools", []) if isinstance(body, dict) else []
        findings: list[CheckFinding] = []
        for tool in served:
            name = tool.get("name", "")
            description = tool.get("description", "")
            if name not in documented:
                findings.append(
                    make_finding(
                        self.id,
                        self.severity,
                        "Undocumented tool exposed",
                        f"MCP server exposes tool '{name}' not present in documented inventory.",
                        "tool-catalogue-deviation",
                    ),
                )
                continue
            fragments = documented[name].get("description_fragments", [])
            if fragments and not all(frag in description for frag in fragments):
                findings.append(
                    make_finding(
                        self.id,
                        self.severity,
                        "Tool description deviates from documentation",
                        (
                            f"Tool '{name}' description does not include all required fragments "
                            f"{fragments}."
                        ),
                        "tool-catalogue-deviation",
                    ),
                )

        if findings:
            return ("fail", self.severity, findings)
        return (
            "pass",
            "info",
            [
                make_finding(
                    self.id,
                    "info",
                    "Tool catalogue conformant",
                    f"All {len(served)} served tools match the documented inventory.",
                    "tool-catalogue-conformant",
                ),
            ],
        )


register(PMcp01ToolCatalogueValidation())

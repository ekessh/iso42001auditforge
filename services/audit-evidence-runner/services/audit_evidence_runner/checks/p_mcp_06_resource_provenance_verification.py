# SPDX-License-Identifier: BUSL-1.1
"""P-MCP-06 — Resource-Provenance-Verification.

Fetches the served MCP resources and verifies each carries the documented
provenance metadata (source, hash, signing key id). Replaces the older
indirect-injection check name; AuditForge enforces conformance, not adversarial
testing.
"""

from __future__ import annotations

import httpx

from ..schemas import CheckFinding, Severity
from .base import AuditEvidenceCheck, CheckContext, make_finding, register


class PMcp06ResourceProvenanceVerification(AuditEvidenceCheck):
    id = "P-MCP-06"
    category = "MCP"
    family = "mcp"
    title = "MCP Resource-Provenance-Verification"
    description = (
        "Fetches MCP resources/list and asserts each entry carries the "
        "documented provenance metadata."
    )
    severity: Severity = "medium"
    iso42001_clauses = ["7.5", "8.3"]
    annex_a = ["A.7.2", "A.10.3"]
    inputs_schema = {
        "type": "object",
        "properties": {
            "resources_path": {"type": "string", "default": "/mcp/resources/list"},
            "required_fields": {
                "type": "array",
                "items": {"type": "string"},
                "default": ["sourceUri", "sha256", "signedBy"],
            },
            "auth_header": {"type": "string"},
        },
        "additionalProperties": False,
    }

    async def execute(
        self, ctx: CheckContext,
    ) -> tuple[str, Severity, list[CheckFinding]]:
        path = ctx.params.get("resources_path", "/mcp/resources/list")
        required = ctx.params.get("required_fields", ["sourceUri", "sha256", "signedBy"])
        url = ctx.target.endpoint.rstrip("/") + path

        headers = {"accept": "application/json"}
        if auth_header := ctx.params.get("auth_header"):
            headers["authorization"] = auth_header

        try:
            ctx.budget.add_call()
            res = await ctx.http.get(url, headers=headers)
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
                        "MCP resources/list unavailable",
                        f"P-MCP-06 could not retrieve resources/list: {e}",
                        "resource-provenance-mismatch",
                    ),
                ],
            )

        resources = body.get("resources", []) if isinstance(body, dict) else []
        findings: list[CheckFinding] = []
        for resource in resources:
            uri = resource.get("uri", "<unknown>")
            missing = [f for f in required if f not in resource or not resource.get(f)]
            if missing:
                findings.append(
                    make_finding(
                        self.id,
                        self.severity,
                        "Resource missing provenance fields",
                        f"Resource '{uri}' missing fields {missing}.",
                        "resource-provenance-mismatch",
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
                    "All resources carry provenance",
                    f"All {len(resources)} resources carry required fields {required}.",
                    "resource-provenance-conformant",
                ),
            ],
        )


register(PMcp06ResourceProvenanceVerification())

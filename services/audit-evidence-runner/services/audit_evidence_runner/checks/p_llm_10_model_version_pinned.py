# SPDX-License-Identifier: BUSL-1.1
"""P-LLM-10 — Model-Version-Pinned.

Verifies the response includes the documented model-version header and its
value matches the auditee's pinned version.
"""

from __future__ import annotations

import httpx

from ..schemas import CheckFinding, Severity
from .base import AuditEvidenceCheck, CheckContext, make_finding, register


class PLlm10ModelVersionPinned(AuditEvidenceCheck):
    id = "P-LLM-10"
    category = "AC"
    family = "provenance"
    title = "LLM Model-Version-Pinned"
    description = (
        "Verifies the response includes the documented model-version header "
        "and its value matches the auditee's pinned version."
    )
    severity: Severity = "high"
    iso42001_clauses = ["7.5", "8.3"]
    annex_a = ["A.6.2.7"]
    inputs_schema = {
        "type": "object",
        "properties": {
            "request_body": {"type": "object"},
            "version_header": {"type": "string", "default": "x-model-version"},
            "expected_version": {"type": "string"},
            "auth_header": {"type": "string"},
        },
        "required": ["expected_version"],
        "additionalProperties": False,
    }

    async def execute(
        self, ctx: CheckContext,
    ) -> tuple[str, Severity, list[CheckFinding]]:
        body = ctx.params.get("request_body", {"input": "ping"})
        version_header = str(ctx.params.get("version_header", "x-model-version")).lower()
        expected = str(ctx.params["expected_version"])
        headers = {"content-type": "application/json"}
        if auth_header := ctx.params.get("auth_header"):
            headers["authorization"] = auth_header

        try:
            ctx.budget.add_call()
            res = await ctx.http.post(ctx.target.endpoint, headers=headers, json=body)
            res.raise_for_status()
        except httpx.HTTPError as e:
            return (
                "error",
                "medium",
                [
                    make_finding(
                        self.id,
                        "medium",
                        "Target call failed",
                        f"P-LLM-10 could not contact target: {e}",
                        "provenance-headers-missing",
                    ),
                ],
            )

        observed = res.headers.get(version_header, "")
        if observed == expected:
            return (
                "pass",
                "info",
                [
                    make_finding(
                        self.id,
                        "info",
                        "Model version pinned",
                        f"Header {version_header} = '{observed}' matches documented pin.",
                        "provenance-headers-present",
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
                    "Model version drift",
                    f"Header {version_header} = '{observed}', expected '{expected}'.",
                    "provenance-headers-missing",
                ),
            ],
        )


register(PLlm10ModelVersionPinned())

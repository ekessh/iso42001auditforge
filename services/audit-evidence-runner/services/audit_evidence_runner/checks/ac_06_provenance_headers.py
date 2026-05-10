# SPDX-License-Identifier: BUSL-1.1
"""AC-06 — Provenance-Headers.

Verifies the target response carries the documented provenance headers
(model version + system-prompt hash by default). Auditor configures the
required header names.
"""

from __future__ import annotations

import httpx

from ..schemas import CheckFinding, Severity
from .base import AuditEvidenceCheck, CheckContext, make_finding, register


class Ac06ProvenanceHeaders(AuditEvidenceCheck):
    id = "AC-06"
    category = "AC"
    family = "provenance"
    title = "Provenance-Headers"
    description = (
        "Verifies the target response carries documented provenance headers "
        "(model version, system-prompt hash, etc.)."
    )
    severity: Severity = "low"
    iso42001_clauses = ["7.5"]
    annex_a = ["A.7.2"]
    inputs_schema = {
        "type": "object",
        "properties": {
            "request_body": {"type": "object"},
            "required_headers": {
                "type": "array",
                "items": {"type": "string"},
                "default": ["x-model-version", "x-system-prompt-hash"],
            },
            "auth_header": {"type": "string"},
        },
        "additionalProperties": False,
    }

    async def execute(
        self, ctx: CheckContext,
    ) -> tuple[str, Severity, list[CheckFinding]]:
        request_body = ctx.params.get("request_body", {"input": "provenance-evidence"})
        required = [
            h.lower()
            for h in ctx.params.get(
                "required_headers", ["x-model-version", "x-system-prompt-hash"],
            )
        ]
        headers = {"content-type": "application/json"}
        if auth_header := ctx.params.get("auth_header"):
            headers["authorization"] = auth_header

        try:
            ctx.budget.add_call()
            res = await ctx.http.post(ctx.target.endpoint, headers=headers, json=request_body)
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
                        f"AC-06 could not retrieve response: {e}",
                        "provenance-headers-missing",
                    ),
                ],
            )

        observed = {k.lower() for k in res.headers.keys()}
        missing = [h for h in required if h not in observed]
        if not missing:
            return (
                "pass",
                "info",
                [
                    make_finding(
                        self.id,
                        "info",
                        "Provenance headers present",
                        f"Observed all required provenance headers: {required}.",
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
                    "Provenance header missing",
                    f"Required header(s) not present: {missing}.",
                    "provenance-headers-missing",
                ),
            ],
        )


register(Ac06ProvenanceHeaders())

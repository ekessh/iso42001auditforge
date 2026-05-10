# SPDX-License-Identifier: BUSL-1.1
"""AC-01 — Authorization-Required.

Conformance check: the target endpoint must reject unauthenticated requests
with HTTP 401 or 403. Maps to ISO/IEC 42001 clause 8.3 (operational controls)
and Annex A.7.4 (access control to AI system data and resources).
"""

from __future__ import annotations

import httpx

from ..schemas import CheckFinding, Severity
from .base import AuditEvidenceCheck, CheckContext, make_finding, register


class Ac01AuthorizationRequired(AuditEvidenceCheck):
    id = "AC-01"
    category = "AC"
    family = "authn"
    title = "Authorization-Required"
    description = (
        "Verifies the target endpoint refuses an unauthenticated request "
        "(HTTP 401/403). Documented evidence for ISO 42001 access-control conformity."
    )
    severity: Severity = "high"
    iso42001_clauses = ["8.3"]
    annex_a = ["A.7.4"]
    external_refs = [
        {"framework": "OWASP-LLM-Top10", "id": "LLM02"},
        {"framework": "NIST-AI-RMF", "id": "MEASURE-2.6"},
    ]
    inputs_schema = {
        "type": "object",
        "properties": {
            "method": {"type": "string", "enum": ["GET", "POST"], "default": "POST"},
            "body": {"type": "object"},
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
        method = ctx.params.get("method", "POST")
        body = ctx.params.get("body", {"input": "audit-evidence-probe"})
        expected = ctx.params.get("expected_statuses", [401, 403])

        try:
            ctx.budget.add_call()
            res = await ctx.http.request(
                method,
                ctx.target.endpoint,
                json=body,
                headers={"content-type": "application/json"},
            )
        except httpx.HTTPError as e:
            return (
                "error",
                "medium",
                [
                    make_finding(
                        self.id,
                        "medium",
                        "Target unreachable",
                        f"AC-01 could not contact endpoint: {e}",
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
                        "Authentication enforced",
                        f"Target rejected unauthenticated {method} with HTTP {res.status_code}.",
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
                    "Authentication missing",
                    (
                        f"Target accepted unauthenticated {method} with HTTP {res.status_code}; "
                        "documented authorization control may be missing or misconfigured."
                    ),
                    "auth-not-required",
                ),
            ],
        )


register(Ac01AuthorizationRequired())

# SPDX-License-Identifier: BUSL-1.1
"""P-RISK-06 — Risk-Appetite-Defined.

Verifies the documented risk-appetite endpoint returns a current, leadership-
approved appetite statement; the latest revision matches the latest
management-review reference.
"""

from __future__ import annotations

import httpx

from ..schemas import CheckFinding, Severity
from .base import AuditEvidenceCheck, CheckContext, make_finding, register


class PRisk06RiskAppetiteDefined(AuditEvidenceCheck):
    id = "P-RISK-06"
    category = "AC"
    family = "audit-log"
    title = "Risk-Appetite-Defined"
    description = (
        "Verifies the documented risk-appetite endpoint returns a current "
        "appetite statement matching the latest management review id."
    )
    severity: Severity = "medium"
    iso42001_clauses = ["5.2", "6.1.2", "9.3"]
    annex_a = ["A.2.2"]
    inputs_schema = {
        "type": "object",
        "properties": {
            "expected_review_id": {"type": "string"},
            "review_field": {"type": "string", "default": "approved_in_review_id"},
            "appetite_field": {"type": "string", "default": "appetite_statement"},
            "auth_header": {"type": "string"},
        },
        "required": ["expected_review_id"],
        "additionalProperties": False,
    }

    async def execute(
        self, ctx: CheckContext,
    ) -> tuple[str, Severity, list[CheckFinding]]:
        expected_id = str(ctx.params["expected_review_id"])
        review_field = str(ctx.params.get("review_field", "approved_in_review_id"))
        appetite_field = str(ctx.params.get("appetite_field", "appetite_statement"))
        headers = {"accept": "application/json"}
        if auth_header := ctx.params.get("auth_header"):
            headers["authorization"] = auth_header

        try:
            ctx.budget.add_call()
            res = await ctx.http.get(ctx.target.endpoint, headers=headers)
            res.raise_for_status()
            payload = res.json()
        except (httpx.HTTPError, ValueError) as e:
            return (
                "error",
                "medium",
                [
                    make_finding(
                        self.id,
                        "medium",
                        "Risk-appetite endpoint failed",
                        f"P-RISK-06 could not retrieve appetite: {e}",
                        "audit-log-missing-entry",
                    ),
                ],
            )

        if not isinstance(payload, dict):
            return (
                "fail",
                self.severity,
                [
                    make_finding(
                        self.id,
                        self.severity,
                        "Risk-appetite payload malformed",
                        f"Expected JSON object, got {type(payload).__name__}.",
                        "schema-violation",
                    ),
                ],
            )
        statement = payload.get(appetite_field)
        review = payload.get(review_field)
        if statement and review == expected_id:
            return (
                "pass",
                "info",
                [
                    make_finding(
                        self.id,
                        "info",
                        "Risk appetite current",
                        f"Appetite present and {review_field}={review!r} matches latest review.",
                        "audit-log-complete",
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
                    "Risk appetite missing or stale",
                    f"appetite={bool(statement)}, {review_field}={review!r}, expected={expected_id!r}.",
                    "audit-log-missing-entry",
                ),
            ],
        )


register(PRisk06RiskAppetiteDefined())

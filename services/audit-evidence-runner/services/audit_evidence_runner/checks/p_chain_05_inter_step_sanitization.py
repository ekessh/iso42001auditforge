# SPDX-License-Identifier: BUSL-1.1
"""P-CHAIN-05 — Inter-Step-Sanitization.

For each step record, verifies a `sanitization_id` field is populated,
evidencing the auditee's documented schema-validating wrapper between
steps.
"""

from __future__ import annotations

import httpx

from ..schemas import CheckFinding, Severity
from .base import AuditEvidenceCheck, CheckContext, make_finding, register


class PChain05InterStepSanitization(AuditEvidenceCheck):
    id = "P-CHAIN-05"
    category = "AC"
    family = "schema"
    title = "Chain Inter-Step-Sanitization"
    description = (
        "Verifies each step record carries a sanitization_id evidencing "
        "the documented schema-validating wrapper between steps."
    )
    severity: Severity = "medium"
    iso42001_clauses = ["8.3"]
    annex_a = ["A.6.2.5"]
    inputs_schema = {
        "type": "object",
        "properties": {
            "chain_id": {"type": "string"},
            "steps_path": {
                "type": "array",
                "items": {"type": "string"},
                "default": ["steps"],
            },
            "sanitization_field": {"type": "string", "default": "sanitization_id"},
            "auth_header": {"type": "string"},
        },
        "required": ["chain_id"],
        "additionalProperties": False,
    }

    async def execute(
        self, ctx: CheckContext,
    ) -> tuple[str, Severity, list[CheckFinding]]:
        chain_id = str(ctx.params["chain_id"])
        path = list(ctx.params.get("steps_path", ["steps"]))
        san_field = str(ctx.params.get("sanitization_field", "sanitization_id"))
        headers = {"accept": "application/json"}
        if auth_header := ctx.params.get("auth_header"):
            headers["authorization"] = auth_header

        url = ctx.target.endpoint
        sep = "&" if "?" in url else "?"
        url = f"{url}{sep}chain_id={chain_id}"

        try:
            ctx.budget.add_call()
            res = await ctx.http.get(url, headers=headers)
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
                        "Chain log endpoint failed",
                        f"P-CHAIN-05 could not retrieve trail: {e}",
                        "schema-violation",
                    ),
                ],
            )

        cursor: object = payload
        for key in path:
            if not isinstance(cursor, dict) or key not in cursor:
                cursor = []
                break
            cursor = cursor[key]
        steps = cursor if isinstance(cursor, list) else []

        violations: list[str] = []
        for step in steps:
            if not isinstance(step, dict):
                continue
            if not step.get(san_field):
                violations.append(str(step.get("step_id", "<unknown>")))

        if not violations and steps:
            return (
                "pass",
                "info",
                [
                    make_finding(
                        self.id,
                        "info",
                        "Inter-step sanitization recorded",
                        f"All {len(steps)} steps reference a sanitization_id.",
                        "schema-conformant",
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
                    "Inter-step sanitization missing",
                    f"{len(violations)} of {len(steps)} steps lack a sanitization_id: {violations[:5]}.",
                    "schema-violation",
                ),
            ],
        )


register(PChain05InterStepSanitization())

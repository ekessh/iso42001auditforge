# SPDX-License-Identifier: BUSL-1.1
"""P-GOV-03 — Resource-Allocation-Approved.

Verifies the documented resource-allocation record matches the planning
record: each allocation has an `approved_in_plan_id` matching the auditee's
latest plan id.
"""

from __future__ import annotations

import httpx

from ..schemas import CheckFinding, Severity
from .base import AuditEvidenceCheck, CheckContext, make_finding, register


class PGov03ResourceAllocationApproved(AuditEvidenceCheck):
    id = "P-GOV-03"
    category = "AC"
    family = "audit-log"
    title = "Resource-Allocation-Approved"
    description = (
        "Verifies the documented resource-allocation record matches the "
        "auditee's latest planning record."
    )
    severity: Severity = "medium"
    iso42001_clauses = ["7.1"]
    annex_a = ["A.4.2", "A.4.5"]
    inputs_schema = {
        "type": "object",
        "properties": {
            "expected_plan_id": {"type": "string"},
            "items_path": {
                "type": "array",
                "items": {"type": "string"},
                "default": ["allocations"],
            },
            "plan_field": {"type": "string", "default": "approved_in_plan_id"},
            "auth_header": {"type": "string"},
        },
        "required": ["expected_plan_id"],
        "additionalProperties": False,
    }

    async def execute(
        self, ctx: CheckContext,
    ) -> tuple[str, Severity, list[CheckFinding]]:
        plan_id = str(ctx.params["expected_plan_id"])
        path = list(ctx.params.get("items_path", ["allocations"]))
        plan_field = str(ctx.params.get("plan_field", "approved_in_plan_id"))
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
                        "Resource-allocation endpoint failed",
                        f"P-GOV-03 could not retrieve allocations: {e}",
                        "audit-log-missing-entry",
                    ),
                ],
            )

        cursor: object = payload
        for key in path:
            if not isinstance(cursor, dict) or key not in cursor:
                cursor = []
                break
            cursor = cursor[key]
        items = cursor if isinstance(cursor, list) else []

        violations: list[str] = []
        for it in items:
            if not isinstance(it, dict):
                continue
            if it.get(plan_field) != plan_id:
                violations.append(str(it.get("id", "<unknown>")))

        if not violations and items:
            return (
                "pass",
                "info",
                [
                    make_finding(
                        self.id,
                        "info",
                        "Resource allocation approved",
                        f"All {len(items)} allocations reference plan {plan_id}.",
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
                    "Resource-allocation plan mismatch",
                    f"{len(violations)} of {len(items)} allocations not pinned to plan {plan_id}: {violations[:5]}.",
                    "audit-log-missing-entry",
                ),
            ],
        )


register(PGov03ResourceAllocationApproved())

# SPDX-License-Identifier: BUSL-1.1
"""P-RISK-02 — High-Risk-Treatment-Plan-Closed.

For every high-risk item in the documented register, verifies a closed
treatment plan exists with an effectiveness check record.
"""

from __future__ import annotations

import httpx

from ..schemas import CheckFinding, Severity
from .base import AuditEvidenceCheck, CheckContext, make_finding, register


class PRisk02HighRiskTreatmentPlanClosed(AuditEvidenceCheck):
    id = "P-RISK-02"
    category = "AC"
    family = "audit-log"
    title = "High-Risk-Treatment-Plan-Closed"
    description = (
        "Verifies every high-risk item in the register has a closed treatment "
        "plan and an effectiveness check record."
    )
    severity: Severity = "high"
    iso42001_clauses = ["6.1.3", "8.3"]
    annex_a = ["A.5.4"]
    inputs_schema = {
        "type": "object",
        "properties": {
            "items_path": {
                "type": "array",
                "items": {"type": "string"},
                "default": ["items"],
            },
            "level_field": {"type": "string", "default": "level"},
            "high_value": {"type": "string", "default": "high"},
            "treatment_status_field": {"type": "string", "default": "treatment_status"},
            "treatment_closed_value": {"type": "string", "default": "closed"},
            "effectiveness_field": {"type": "string", "default": "effectiveness_check_id"},
            "auth_header": {"type": "string"},
        },
        "additionalProperties": False,
    }

    async def execute(
        self, ctx: CheckContext,
    ) -> tuple[str, Severity, list[CheckFinding]]:
        path = list(ctx.params.get("items_path", ["items"]))
        level_field = str(ctx.params.get("level_field", "level"))
        high_value = str(ctx.params.get("high_value", "high")).lower()
        ts_field = str(ctx.params.get("treatment_status_field", "treatment_status"))
        ts_closed = str(ctx.params.get("treatment_closed_value", "closed")).lower()
        eff_field = str(ctx.params.get("effectiveness_field", "effectiveness_check_id"))
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
                        "Risk-register endpoint failed",
                        f"P-RISK-02 could not retrieve register: {e}",
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
        high_count = 0
        for it in items:
            if not isinstance(it, dict):
                continue
            if str(it.get(level_field, "")).lower() != high_value:
                continue
            high_count += 1
            status = str(it.get(ts_field, "")).lower()
            eff = it.get(eff_field)
            if status != ts_closed or not eff:
                violations.append(str(it.get("id", "<unknown>")))

        if not violations:
            return (
                "pass",
                "info",
                [
                    make_finding(
                        self.id,
                        "info",
                        "High-risk treatment plans closed",
                        f"All {high_count} high-risk items have closed treatment plans with effectiveness checks.",
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
                    "High-risk treatment plan incomplete",
                    f"{len(violations)} of {high_count} high-risk items lack closed plan or effectiveness check: {violations[:5]}.",
                    "audit-log-missing-entry",
                ),
            ],
        )


register(PRisk02HighRiskTreatmentPlanClosed())

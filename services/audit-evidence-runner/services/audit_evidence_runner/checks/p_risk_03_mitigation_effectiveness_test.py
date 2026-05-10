# SPDX-License-Identifier: BUSL-1.1
"""P-RISK-03 — Mitigation-Effectiveness-Test.

For each high-risk item, verifies the documented effectiveness test has
been executed within the documented retest cycle.
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

import httpx

from ..schemas import CheckFinding, Severity
from .base import AuditEvidenceCheck, CheckContext, make_finding, register


class PRisk03MitigationEffectivenessTest(AuditEvidenceCheck):
    id = "P-RISK-03"
    category = "AC"
    family = "audit-log"
    title = "Mitigation-Effectiveness-Test"
    description = (
        "Verifies each high-risk mitigation has an effectiveness test "
        "executed within the documented retest cycle."
    )
    severity: Severity = "high"
    iso42001_clauses = ["6.1.3", "9.1"]
    annex_a = ["A.5.4"]
    inputs_schema = {
        "type": "object",
        "properties": {
            "items_path": {
                "type": "array",
                "items": {"type": "string"},
                "default": ["mitigations"],
            },
            "test_field": {"type": "string", "default": "last_test_at"},
            "cycle_days": {"type": "integer", "minimum": 1, "default": 180},
            "auth_header": {"type": "string"},
        },
        "additionalProperties": False,
    }

    async def execute(
        self, ctx: CheckContext,
    ) -> tuple[str, Severity, list[CheckFinding]]:
        path = list(ctx.params.get("items_path", ["mitigations"]))
        field = str(ctx.params.get("test_field", "last_test_at"))
        cycle = int(ctx.params.get("cycle_days", 180))
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
                        "Mitigations endpoint failed",
                        f"P-RISK-03 could not retrieve mitigations: {e}",
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
        mitigations = cursor if isinstance(cursor, list) else []

        cutoff = datetime.now(tz=UTC) - timedelta(days=cycle)
        violations: list[str] = []
        for m in mitigations:
            if not isinstance(m, dict):
                continue
            raw = m.get(field)
            if not isinstance(raw, str):
                violations.append(str(m.get("id", "<unknown>")))
                continue
            try:
                t = datetime.fromisoformat(raw.replace("Z", "+00:00"))
                if t.tzinfo is None:
                    t = t.replace(tzinfo=UTC)
            except ValueError:
                violations.append(str(m.get("id", "<unknown>")))
                continue
            if t < cutoff:
                violations.append(str(m.get("id", "<unknown>")))

        if not violations and mitigations:
            return (
                "pass",
                "info",
                [
                    make_finding(
                        self.id,
                        "info",
                        "Mitigations tested within cycle",
                        f"All {len(mitigations)} mitigations tested within {cycle} days.",
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
                    "Mitigation effectiveness retest overdue",
                    f"{len(violations)} of {len(mitigations)} mitigations not tested in {cycle} days: {violations[:5]}.",
                    "audit-log-missing-entry",
                ),
            ],
        )


register(PRisk03MitigationEffectivenessTest())

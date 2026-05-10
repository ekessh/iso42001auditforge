# SPDX-License-Identifier: BUSL-1.1
"""P-GOV-06 — Continual-Improvement-Backlog.

Verifies improvement actions are tracked: each backlog item has both an
explicit `status` and an `owner` field. Maps to ISO/IEC 42001 clause 10
(continual improvement).
"""

from __future__ import annotations

import httpx

from ..schemas import CheckFinding, Severity
from .base import AuditEvidenceCheck, CheckContext, make_finding, register


class PGov06ContinualImprovementBacklog(AuditEvidenceCheck):
    id = "P-GOV-06"
    category = "AC"
    family = "audit-log"
    title = "Continual-Improvement-Backlog"
    description = (
        "Verifies improvement-backlog items each carry status and owner "
        "fields."
    )
    severity: Severity = "low"
    iso42001_clauses = ["10.1", "10.2"]
    annex_a = ["A.2.4"]
    inputs_schema = {
        "type": "object",
        "properties": {
            "items_path": {
                "type": "array",
                "items": {"type": "string"},
                "default": ["actions"],
            },
            "status_field": {"type": "string", "default": "status"},
            "owner_field": {"type": "string", "default": "owner"},
            "auth_header": {"type": "string"},
        },
        "additionalProperties": False,
    }

    async def execute(
        self, ctx: CheckContext,
    ) -> tuple[str, Severity, list[CheckFinding]]:
        path = list(ctx.params.get("items_path", ["actions"]))
        status_field = str(ctx.params.get("status_field", "status"))
        owner_field = str(ctx.params.get("owner_field", "owner"))
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
                        "Improvement-backlog endpoint failed",
                        f"P-GOV-06 could not retrieve backlog: {e}",
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
            if not it.get(status_field) or not it.get(owner_field):
                violations.append(str(it.get("id", "<unknown>")))

        if not violations:
            return (
                "pass",
                "info",
                [
                    make_finding(
                        self.id,
                        "info",
                        "Continual-improvement backlog tracked",
                        f"All {len(items)} backlog items have status + owner.",
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
                    "Continual-improvement backlog incomplete",
                    f"{len(violations)} of {len(items)} backlog items lack status or owner: {violations[:5]}.",
                    "audit-log-missing-entry",
                ),
            ],
        )


register(PGov06ContinualImprovementBacklog())

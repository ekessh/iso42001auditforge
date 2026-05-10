# SPDX-License-Identifier: BUSL-1.1
"""P-RISK-01 — Risk-Register-Reviewed.

Reads the auditee's risk-register endpoint and verifies the most recent
review of every item is within the documented review period.
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

import httpx

from ..schemas import CheckFinding, Severity
from .base import AuditEvidenceCheck, CheckContext, make_finding, register


class PRisk01RiskRegisterReviewed(AuditEvidenceCheck):
    id = "P-RISK-01"
    category = "AC"
    family = "audit-log"
    title = "Risk-Register-Reviewed"
    description = (
        "Verifies every entry in the auditee's risk register has been reviewed "
        "within the documented review period."
    )
    severity: Severity = "high"
    iso42001_clauses = ["6.1.2", "9.3"]
    annex_a = ["A.5.2"]
    inputs_schema = {
        "type": "object",
        "properties": {
            "review_period_days": {"type": "integer", "minimum": 1, "default": 365},
            "items_path": {
                "type": "array",
                "items": {"type": "string"},
                "default": ["items"],
            },
            "review_field": {"type": "string", "default": "last_reviewed_at"},
            "auth_header": {"type": "string"},
        },
        "additionalProperties": False,
    }

    async def execute(
        self, ctx: CheckContext,
    ) -> tuple[str, Severity, list[CheckFinding]]:
        review_period = int(ctx.params.get("review_period_days", 365))
        path = list(ctx.params.get("items_path", ["items"]))
        field = str(ctx.params.get("review_field", "last_reviewed_at"))
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
                        f"P-RISK-01 could not retrieve register: {e}",
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

        cutoff = datetime.now(tz=UTC) - timedelta(days=review_period)
        stale: list[str] = []
        for item in items:
            if not isinstance(item, dict):
                continue
            raw = item.get(field)
            if not isinstance(raw, str):
                stale.append(str(item.get("id", "<unknown>")))
                continue
            try:
                t = datetime.fromisoformat(raw.replace("Z", "+00:00"))
                if t.tzinfo is None:
                    t = t.replace(tzinfo=UTC)
            except ValueError:
                stale.append(str(item.get("id", "<unknown>")))
                continue
            if t < cutoff:
                stale.append(str(item.get("id", "<unknown>")))

        if not stale and items:
            return (
                "pass",
                "info",
                [
                    make_finding(
                        self.id,
                        "info",
                        "Risk register reviewed",
                        f"All {len(items)} register items reviewed within {review_period} days.",
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
                    "Risk register stale",
                    f"{len(stale)} of {len(items)} items not reviewed in {review_period} days: {stale[:5]}.",
                    "audit-log-missing-entry",
                ),
            ],
        )


register(PRisk01RiskRegisterReviewed())

# SPDX-License-Identifier: BUSL-1.1
"""P-DATA-05 — Retention-Schedule-Active.

Queries the documented retention-status endpoint and verifies no records
are present in the active store with `created_at` older than the documented
retention age.
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

import httpx

from ..schemas import CheckFinding, Severity
from .base import AuditEvidenceCheck, CheckContext, make_finding, register


class PData05RetentionScheduleActive(AuditEvidenceCheck):
    id = "P-DATA-05"
    category = "AC"
    family = "audit-log"
    title = "Retention-Schedule-Active"
    description = (
        "Queries the documented retention-status endpoint and verifies the "
        "active store contains no records past the documented retention age."
    )
    severity: Severity = "high"
    iso42001_clauses = ["7.5", "8.3"]
    annex_a = ["A.7.4", "A.7.6"]
    external_refs = [{"framework": "GDPR", "id": "Article-5"}]
    inputs_schema = {
        "type": "object",
        "properties": {
            "retention_days": {"type": "integer", "minimum": 1, "default": 90},
            "records_path": {
                "type": "array",
                "items": {"type": "string"},
                "default": ["records"],
            },
            "timestamp_field": {"type": "string", "default": "created_at"},
            "auth_header": {"type": "string"},
        },
        "additionalProperties": False,
    }

    async def execute(
        self, ctx: CheckContext,
    ) -> tuple[str, Severity, list[CheckFinding]]:
        retention_days = int(ctx.params.get("retention_days", 90))
        path = list(ctx.params.get("records_path", ["records"]))
        ts_field = str(ctx.params.get("timestamp_field", "created_at"))
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
                        "Retention endpoint failed",
                        f"P-DATA-05 could not retrieve records: {e}",
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
        records = cursor if isinstance(cursor, list) else []

        cutoff = datetime.now(tz=UTC) - timedelta(days=retention_days)
        violations: list[str] = []
        for r in records:
            if not isinstance(r, dict):
                continue
            raw = r.get(ts_field)
            if not isinstance(raw, str):
                continue
            try:
                t = datetime.fromisoformat(raw.replace("Z", "+00:00"))
                if t.tzinfo is None:
                    t = t.replace(tzinfo=UTC)
            except ValueError:
                continue
            if t < cutoff:
                violations.append(str(r.get("id") or t.isoformat()))

        if not violations:
            return (
                "pass",
                "info",
                [
                    make_finding(
                        self.id,
                        "info",
                        "Retention schedule enforced",
                        f"No records older than {retention_days} days found in active store.",
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
                    "Retention schedule not enforced",
                    f"Found {len(violations)} record(s) older than {retention_days} days: {violations[:5]}.",
                    "audit-log-missing-entry",
                ),
            ],
        )


register(PData05RetentionScheduleActive())

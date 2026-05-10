# SPDX-License-Identifier: BUSL-1.1
"""P-RISK-05 — Change-Triggered-Re-Assessment.

Verifies the auditee-supplied significant change identifier triggered a
documented risk re-assessment within the documented SLA.
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

import httpx

from ..schemas import CheckFinding, Severity
from .base import AuditEvidenceCheck, CheckContext, make_finding, register


class PRisk05ChangeTriggeredReassessment(AuditEvidenceCheck):
    id = "P-RISK-05"
    category = "AC"
    family = "audit-log"
    title = "Change-Triggered-Re-Assessment"
    description = (
        "Verifies a documented significant-change record triggered a risk "
        "re-assessment within the documented SLA."
    )
    severity: Severity = "high"
    iso42001_clauses = ["6.3", "8.2"]
    annex_a = ["A.5.2"]
    inputs_schema = {
        "type": "object",
        "properties": {
            "change_id": {"type": "string"},
            "change_field": {"type": "string", "default": "change_id"},
            "reassessed_at_field": {"type": "string", "default": "reassessed_at"},
            "change_at_field": {"type": "string", "default": "change_at"},
            "sla_days": {"type": "integer", "minimum": 1, "default": 30},
            "auth_header": {"type": "string"},
        },
        "required": ["change_id"],
        "additionalProperties": False,
    }

    async def execute(
        self, ctx: CheckContext,
    ) -> tuple[str, Severity, list[CheckFinding]]:
        cid = str(ctx.params["change_id"])
        change_field = str(ctx.params.get("change_field", "change_id"))
        ra_field = str(ctx.params.get("reassessed_at_field", "reassessed_at"))
        cha_field = str(ctx.params.get("change_at_field", "change_at"))
        sla = int(ctx.params.get("sla_days", 30))
        headers = {"accept": "application/json"}
        if auth_header := ctx.params.get("auth_header"):
            headers["authorization"] = auth_header

        url = ctx.target.endpoint
        if "?" in url:
            url = f"{url}&{change_field}={cid}"
        else:
            url = f"{url}?{change_field}={cid}"

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
                        "Re-assessment endpoint failed",
                        f"P-RISK-05 could not retrieve record: {e}",
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
                        "Re-assessment record malformed",
                        f"Expected JSON object, got {type(payload).__name__}.",
                        "schema-violation",
                    ),
                ],
            )

        ra_raw = payload.get(ra_field)
        cha_raw = payload.get(cha_field)
        if not isinstance(ra_raw, str) or not isinstance(cha_raw, str):
            return (
                "fail",
                self.severity,
                [
                    make_finding(
                        self.id,
                        self.severity,
                        "Re-assessment record missing timestamps",
                        f"reassessed_at={ra_raw!r}, change_at={cha_raw!r}.",
                        "audit-log-missing-entry",
                    ),
                ],
            )
        try:
            ra = datetime.fromisoformat(ra_raw.replace("Z", "+00:00"))
            cha = datetime.fromisoformat(cha_raw.replace("Z", "+00:00"))
        except ValueError as e:
            return (
                "fail",
                self.severity,
                [
                    make_finding(
                        self.id,
                        self.severity,
                        "Re-assessment record malformed timestamps",
                        f"{e}",
                        "audit-log-missing-entry",
                    ),
                ],
            )
        if ra.tzinfo is None:
            ra = ra.replace(tzinfo=UTC)
        if cha.tzinfo is None:
            cha = cha.replace(tzinfo=UTC)
        delta = ra - cha
        if delta >= timedelta(0) and delta <= timedelta(days=sla):
            return (
                "pass",
                "info",
                [
                    make_finding(
                        self.id,
                        "info",
                        "Re-assessment within SLA",
                        f"Re-assessment occurred {delta.days} day(s) after change; SLA = {sla} days.",
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
                    "Re-assessment outside SLA",
                    f"Re-assessment delta = {delta.days} day(s); SLA = {sla} days.",
                    "audit-log-missing-entry",
                ),
            ],
        )


register(PRisk05ChangeTriggeredReassessment())

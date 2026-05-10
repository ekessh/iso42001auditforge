# SPDX-License-Identifier: BUSL-1.1
"""P-GOV-04 — Communication-Records.

Verifies the auditee's communication-records endpoint exposes both internal
and external comms entries within the documented review period.
"""

from __future__ import annotations

import httpx

from ..schemas import CheckFinding, Severity
from .base import AuditEvidenceCheck, CheckContext, make_finding, register


class PGov04CommunicationRecords(AuditEvidenceCheck):
    id = "P-GOV-04"
    category = "AC"
    family = "audit-log"
    title = "Communication-Records"
    description = (
        "Verifies the auditee's communication endpoint exposes both internal "
        "and external comms entries."
    )
    severity: Severity = "medium"
    iso42001_clauses = ["7.4"]
    annex_a = ["A.8.3", "A.8.5"]
    inputs_schema = {
        "type": "object",
        "properties": {
            "items_path": {
                "type": "array",
                "items": {"type": "string"},
                "default": ["comms"],
            },
            "channel_field": {"type": "string", "default": "channel"},
            "internal_value": {"type": "string", "default": "internal"},
            "external_value": {"type": "string", "default": "external"},
            "auth_header": {"type": "string"},
        },
        "additionalProperties": False,
    }

    async def execute(
        self, ctx: CheckContext,
    ) -> tuple[str, Severity, list[CheckFinding]]:
        path = list(ctx.params.get("items_path", ["comms"]))
        channel_field = str(ctx.params.get("channel_field", "channel"))
        internal_value = str(ctx.params.get("internal_value", "internal")).lower()
        external_value = str(ctx.params.get("external_value", "external")).lower()
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
                        "Comms endpoint failed",
                        f"P-GOV-04 could not retrieve comms: {e}",
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

        seen = {str(it.get(channel_field, "")).lower() for it in items if isinstance(it, dict)}
        if internal_value in seen and external_value in seen:
            return (
                "pass",
                "info",
                [
                    make_finding(
                        self.id,
                        "info",
                        "Communication records present",
                        f"Both internal and external channels observed across {len(items)} entries.",
                        "audit-log-complete",
                    ),
                ],
            )
        missing = [
            v for v in (internal_value, external_value) if v not in seen
        ]
        return (
            "fail",
            self.severity,
            [
                make_finding(
                    self.id,
                    self.severity,
                    "Communication channel missing",
                    f"No comms records for channel(s): {missing}.",
                    "audit-log-missing-entry",
                ),
            ],
        )


register(PGov04CommunicationRecords())

# SPDX-License-Identifier: BUSL-1.1
"""P-RISK-04 — Residual-Risk-Acknowledged.

Verifies every residual risk has an explicit acknowledgement record signed
by the accountable owner.
"""

from __future__ import annotations

import httpx

from ..schemas import CheckFinding, Severity
from .base import AuditEvidenceCheck, CheckContext, make_finding, register


class PRisk04ResidualRiskAcknowledged(AuditEvidenceCheck):
    id = "P-RISK-04"
    category = "AC"
    family = "audit-log"
    title = "Residual-Risk-Acknowledged"
    description = (
        "Verifies every residual risk has an explicit acknowledgement record "
        "signed by an accountable owner."
    )
    severity: Severity = "high"
    iso42001_clauses = ["6.1.3", "5.1"]
    annex_a = ["A.3.2"]
    inputs_schema = {
        "type": "object",
        "properties": {
            "items_path": {
                "type": "array",
                "items": {"type": "string"},
                "default": ["residual_risks"],
            },
            "ack_field": {"type": "string", "default": "ack_signature"},
            "owner_field": {"type": "string", "default": "owner"},
            "auth_header": {"type": "string"},
        },
        "additionalProperties": False,
    }

    async def execute(
        self, ctx: CheckContext,
    ) -> tuple[str, Severity, list[CheckFinding]]:
        path = list(ctx.params.get("items_path", ["residual_risks"]))
        ack_field = str(ctx.params.get("ack_field", "ack_signature"))
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
                        "Residual-risk endpoint failed",
                        f"P-RISK-04 could not retrieve residual risks: {e}",
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
            if not it.get(ack_field) or not it.get(owner_field):
                violations.append(str(it.get("id", "<unknown>")))

        if not violations:
            return (
                "pass",
                "info",
                [
                    make_finding(
                        self.id,
                        "info",
                        "Residual risks acknowledged",
                        f"All {len(items)} residual risks have signed acknowledgements.",
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
                    "Residual risk acknowledgement missing",
                    f"{len(violations)} of {len(items)} residual risks lack signature or owner: {violations[:5]}.",
                    "audit-log-missing-entry",
                ),
            ],
        )


register(PRisk04ResidualRiskAcknowledged())

# SPDX-License-Identifier: BUSL-1.1
"""P-GOV-01 — AIMS-Scope-Statement.

Verifies the auditee's AIMS scope statement endpoint returns the canonical
version with a leadership-approval timestamp.
"""

from __future__ import annotations

import httpx

from ..schemas import CheckFinding, Severity
from .base import AuditEvidenceCheck, CheckContext, make_finding, register


class PGov01AimsScopeStatement(AuditEvidenceCheck):
    id = "P-GOV-01"
    category = "AC"
    family = "audit-log"
    title = "AIMS-Scope-Statement"
    description = (
        "Verifies the AIMS scope endpoint returns the canonical scope "
        "statement with leadership-approval timestamp and version."
    )
    severity: Severity = "high"
    iso42001_clauses = ["4.3", "5.1"]
    annex_a = ["A.2.2"]
    inputs_schema = {
        "type": "object",
        "properties": {
            "version_field": {"type": "string", "default": "version"},
            "approved_at_field": {"type": "string", "default": "approved_at"},
            "approver_field": {"type": "string", "default": "approver"},
            "auth_header": {"type": "string"},
        },
        "additionalProperties": False,
    }

    async def execute(
        self, ctx: CheckContext,
    ) -> tuple[str, Severity, list[CheckFinding]]:
        version_field = str(ctx.params.get("version_field", "version"))
        approved_at = str(ctx.params.get("approved_at_field", "approved_at"))
        approver = str(ctx.params.get("approver_field", "approver"))
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
                        "Scope endpoint failed",
                        f"P-GOV-01 could not retrieve scope: {e}",
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
                        "Scope payload malformed",
                        f"Expected JSON object, got {type(payload).__name__}.",
                        "schema-violation",
                    ),
                ],
            )
        missing = [f for f in [version_field, approved_at, approver] if not payload.get(f)]
        if not missing:
            return (
                "pass",
                "info",
                [
                    make_finding(
                        self.id,
                        "info",
                        "AIMS scope statement present",
                        f"Scope version={payload[version_field]!r} approved by {payload[approver]!r}.",
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
                    "AIMS scope statement incomplete",
                    f"Missing required field(s): {missing}.",
                    "audit-log-missing-entry",
                ),
            ],
        )


register(PGov01AimsScopeStatement())

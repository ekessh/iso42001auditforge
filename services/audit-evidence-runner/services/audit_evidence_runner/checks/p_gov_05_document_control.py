# SPDX-License-Identifier: BUSL-1.1
"""P-GOV-05 — Document-Control.

Verifies controlled documents have signed-off changes only: every change
record exposes a signature field and a non-empty signer.
"""

from __future__ import annotations

import httpx

from ..schemas import CheckFinding, Severity
from .base import AuditEvidenceCheck, CheckContext, make_finding, register


class PGov05DocumentControl(AuditEvidenceCheck):
    id = "P-GOV-05"
    category = "AC"
    family = "audit-log"
    title = "Document-Control"
    description = (
        "Verifies the documented change-history endpoint surfaces only "
        "signed-off changes for controlled documents."
    )
    severity: Severity = "medium"
    iso42001_clauses = ["7.5", "7.5.3"]
    annex_a = ["A.6.2.7"]
    inputs_schema = {
        "type": "object",
        "properties": {
            "items_path": {
                "type": "array",
                "items": {"type": "string"},
                "default": ["changes"],
            },
            "signer_field": {"type": "string", "default": "signed_by"},
            "signature_field": {"type": "string", "default": "signature"},
            "auth_header": {"type": "string"},
        },
        "additionalProperties": False,
    }

    async def execute(
        self, ctx: CheckContext,
    ) -> tuple[str, Severity, list[CheckFinding]]:
        path = list(ctx.params.get("items_path", ["changes"]))
        signer_field = str(ctx.params.get("signer_field", "signed_by"))
        signature_field = str(ctx.params.get("signature_field", "signature"))
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
                        "Change-history endpoint failed",
                        f"P-GOV-05 could not retrieve change history: {e}",
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
            if not it.get(signer_field) or not it.get(signature_field):
                violations.append(str(it.get("id", "<unknown>")))

        if not violations and items:
            return (
                "pass",
                "info",
                [
                    make_finding(
                        self.id,
                        "info",
                        "Document control conformant",
                        f"All {len(items)} change records carry signer + signature.",
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
                    "Document control gap",
                    f"{len(violations)} of {len(items)} change records lack signer/signature: {violations[:5]}.",
                    "audit-log-missing-entry",
                ),
            ],
        )


register(PGov05DocumentControl())

# SPDX-License-Identifier: BUSL-1.1
"""P-DATA-06 — Cross-Border-Transfer-Documented.

Verifies the data-residency markers exposed by the documented endpoint
match the auditee's GDPR / EU AI Act declarations: every region in the
returned `regions` array must appear in the documented allowlist.
"""

from __future__ import annotations

import httpx

from ..schemas import CheckFinding, Severity
from .base import AuditEvidenceCheck, CheckContext, make_finding, register


class PData06CrossBorderTransferDocumented(AuditEvidenceCheck):
    id = "P-DATA-06"
    category = "AC"
    family = "provenance"
    title = "Cross-Border-Transfer-Documented"
    description = (
        "Verifies the data-residency markers match the auditee's documented "
        "regional allowlist; out-of-list regions fail the check."
    )
    severity: Severity = "high"
    iso42001_clauses = ["7.5"]
    annex_a = ["A.7.5", "A.10.3"]
    external_refs = [
        {"framework": "GDPR", "id": "Chapter-V"},
        {"framework": "EU-AI-Act", "id": "Article-25"},
    ]
    inputs_schema = {
        "type": "object",
        "properties": {
            "allowed_regions": {
                "type": "array",
                "items": {"type": "string"},
                "minItems": 1,
            },
            "regions_path": {
                "type": "array",
                "items": {"type": "string"},
                "default": ["regions"],
            },
            "auth_header": {"type": "string"},
        },
        "required": ["allowed_regions"],
        "additionalProperties": False,
    }

    async def execute(
        self, ctx: CheckContext,
    ) -> tuple[str, Severity, list[CheckFinding]]:
        allowed = {r.lower() for r in ctx.params["allowed_regions"]}
        path = list(ctx.params.get("regions_path", ["regions"]))
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
                        "Residency endpoint failed",
                        f"P-DATA-06 could not retrieve residency markers: {e}",
                        "provenance-headers-missing",
                    ),
                ],
            )

        cursor: object = payload
        for key in path:
            if not isinstance(cursor, dict) or key not in cursor:
                cursor = []
                break
            cursor = cursor[key]
        observed = cursor if isinstance(cursor, list) else []
        violations = [r for r in observed if str(r).lower() not in allowed]

        if not violations:
            return (
                "pass",
                "info",
                [
                    make_finding(
                        self.id,
                        "info",
                        "Cross-border transfer markers conformant",
                        f"All {len(observed)} regions are within documented allowlist.",
                        "provenance-headers-present",
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
                    "Cross-border transfer outside allowlist",
                    f"Region(s) outside documented allowlist: {violations}.",
                    "provenance-headers-missing",
                ),
            ],
        )


register(PData06CrossBorderTransferDocumented())

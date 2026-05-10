# SPDX-License-Identifier: BUSL-1.1
"""P-DATA-04 — PII-Tagging-On-Ingestion.

Submits a synthetic record containing placeholder PII to the documented
ingestion endpoint and verifies the persisted record carries PII tags on
the appropriate fields.
"""

from __future__ import annotations

import httpx

from ..schemas import CheckFinding, Severity
from .base import AuditEvidenceCheck, CheckContext, make_finding, register


class PData04PiiTaggingOnIngestion(AuditEvidenceCheck):
    id = "P-DATA-04"
    category = "AC"
    family = "pii"
    title = "PII-Tagging-On-Ingestion"
    description = (
        "Submits a synthetic record with placeholder PII and verifies the "
        "persisted record carries PII tags on the documented fields."
    )
    severity: Severity = "high"
    iso42001_clauses = ["7.5", "8.3"]
    annex_a = ["A.7.4"]
    inputs_schema = {
        "type": "object",
        "properties": {
            "ingest_payload": {"type": "object"},
            "pii_fields": {
                "type": "array",
                "items": {"type": "string"},
                "default": ["email", "phone"],
            },
            "tags_path": {
                "type": "array",
                "items": {"type": "string"},
                "default": ["pii_tags"],
            },
            "auth_header": {"type": "string"},
        },
        "additionalProperties": False,
    }

    async def execute(
        self, ctx: CheckContext,
    ) -> tuple[str, Severity, list[CheckFinding]]:
        body = ctx.params.get(
            "ingest_payload",
            {"email": "synthetic.test@auditforge.invalid", "phone": "+1-555-0100"},
        )
        pii_fields = list(ctx.params.get("pii_fields", ["email", "phone"]))
        path = list(ctx.params.get("tags_path", ["pii_tags"]))
        headers = {"content-type": "application/json"}
        if auth_header := ctx.params.get("auth_header"):
            headers["authorization"] = auth_header

        try:
            ctx.budget.add_call()
            res = await ctx.http.post(ctx.target.endpoint, headers=headers, json=body)
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
                        "Ingestion endpoint failed",
                        f"P-DATA-04 could not retrieve persisted record: {e}",
                        "pii-leaked",
                    ),
                ],
            )

        cursor: object = payload
        for key in path:
            if not isinstance(cursor, dict) or key not in cursor:
                cursor = []
                break
            cursor = cursor[key]
        tags = cursor if isinstance(cursor, list) else []

        missing = [f for f in pii_fields if f not in tags]
        if not missing:
            return (
                "pass",
                "info",
                [
                    make_finding(
                        self.id,
                        "info",
                        "PII fields tagged",
                        f"All required PII fields tagged: {pii_fields}.",
                        "pii-redacted",
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
                    "PII tagging incomplete",
                    f"Field(s) missing PII tags: {missing}.",
                    "pii-leaked",
                ),
            ],
        )


register(PData04PiiTaggingOnIngestion())

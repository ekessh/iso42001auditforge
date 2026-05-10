# SPDX-License-Identifier: BUSL-1.1
"""P-DATA-01 — Training-Data-Provenance.

Fetches the documented training-dataset metadata endpoint and verifies the
record carries the fields ISO/IEC 42001 Annex A.7.5 + A.7.2 require:
source, license, collection_date, version, integrity_hash.
"""

from __future__ import annotations

import httpx

from ..schemas import CheckFinding, Severity
from .base import AuditEvidenceCheck, CheckContext, make_finding, register


REQUIRED_FIELDS = ["source", "license", "collection_date", "version", "integrity_hash"]


class PData01TrainingDataProvenance(AuditEvidenceCheck):
    id = "P-DATA-01"
    category = "AC"
    family = "provenance"
    title = "Training-Data-Provenance"
    description = (
        "Verifies the documented training-dataset metadata record exposes "
        "source, license, collection date, version, and integrity hash."
    )
    severity: Severity = "high"
    iso42001_clauses = ["7.5"]
    annex_a = ["A.7.2", "A.7.5"]
    inputs_schema = {
        "type": "object",
        "properties": {
            "required_fields": {
                "type": "array",
                "items": {"type": "string"},
                "default": REQUIRED_FIELDS,
            },
            "auth_header": {"type": "string"},
        },
        "additionalProperties": False,
    }

    async def execute(
        self, ctx: CheckContext,
    ) -> tuple[str, Severity, list[CheckFinding]]:
        required = list(ctx.params.get("required_fields", REQUIRED_FIELDS))
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
                        "Provenance endpoint failed",
                        f"P-DATA-01 could not retrieve metadata: {e}",
                        "provenance-headers-missing",
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
                        "Provenance metadata not a JSON object",
                        f"Expected JSON object, got {type(payload).__name__}.",
                        "schema-violation",
                    ),
                ],
            )

        missing = [f for f in required if f not in payload]
        if not missing:
            return (
                "pass",
                "info",
                [
                    make_finding(
                        self.id,
                        "info",
                        "Training-data provenance present",
                        f"All required fields present: {required}.",
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
                    "Training-data provenance fields missing",
                    f"Missing field(s): {missing}.",
                    "provenance-headers-missing",
                ),
            ],
        )


register(PData01TrainingDataProvenance())

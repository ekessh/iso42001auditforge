# SPDX-License-Identifier: BUSL-1.1
"""P-DATA-07 — Synthetic-Data-Disclosure.

Verifies any documented synthetic-data datasets carry explicit disclosure
metadata: `synthetic` flag, `generation_method`, `validation_basis`.
"""

from __future__ import annotations

import httpx

from ..schemas import CheckFinding, Severity
from .base import AuditEvidenceCheck, CheckContext, make_finding, register


REQUIRED_FIELDS = ["synthetic", "generation_method", "validation_basis"]


class PData07SyntheticDataDisclosure(AuditEvidenceCheck):
    id = "P-DATA-07"
    category = "AC"
    family = "provenance"
    title = "Synthetic-Data-Disclosure"
    description = (
        "Verifies any documented synthetic-data dataset carries explicit "
        "disclosure metadata: synthetic, generation_method, validation_basis."
    )
    severity: Severity = "medium"
    iso42001_clauses = ["7.5"]
    annex_a = ["A.7.5", "A.7.6"]
    external_refs = [{"framework": "EU-AI-Act", "id": "Article-50"}]
    inputs_schema = {
        "type": "object",
        "properties": {
            "datasets_path": {
                "type": "array",
                "items": {"type": "string"},
                "default": ["datasets"],
            },
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
        path = list(ctx.params.get("datasets_path", ["datasets"]))
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
                        "Datasets endpoint failed",
                        f"P-DATA-07 could not retrieve datasets: {e}",
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
        datasets = cursor if isinstance(cursor, list) else []

        violations: list[str] = []
        for ds in datasets:
            if not isinstance(ds, dict):
                continue
            if not ds.get("synthetic"):
                continue
            missing = [f for f in required if f not in ds]
            if missing:
                violations.append(f"{ds.get('id', '<unknown>')}: missing {missing}")

        if not violations:
            return (
                "pass",
                "info",
                [
                    make_finding(
                        self.id,
                        "info",
                        "Synthetic-data disclosure conformant",
                        f"All synthetic datasets ({len(datasets)} total) carry disclosure metadata.",
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
                    "Synthetic-data disclosure incomplete",
                    f"{len(violations)} dataset(s) missing fields: {violations[:5]}.",
                    "provenance-headers-missing",
                ),
            ],
        )


register(PData07SyntheticDataDisclosure())

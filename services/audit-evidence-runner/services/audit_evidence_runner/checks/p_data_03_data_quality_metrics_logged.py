# SPDX-License-Identifier: BUSL-1.1
"""P-DATA-03 — Data-Quality-Metrics-Logged.

Verifies the documented data-pipeline metrics endpoint returns the
required ISO/IEC 42001 Annex A.7.4 quality dimensions: completeness,
validity, freshness — for the latest pipeline run.
"""

from __future__ import annotations

import httpx

from ..schemas import CheckFinding, Severity
from .base import AuditEvidenceCheck, CheckContext, make_finding, register


REQUIRED_METRICS = ["completeness", "validity", "freshness"]


class PData03DataQualityMetricsLogged(AuditEvidenceCheck):
    id = "P-DATA-03"
    category = "AC"
    family = "audit-log"
    title = "Data-Quality-Metrics-Logged"
    description = (
        "Verifies the documented data-pipeline metrics endpoint returns "
        "completeness, validity, and freshness for the latest run."
    )
    severity: Severity = "medium"
    iso42001_clauses = ["7.5", "9.1"]
    annex_a = ["A.7.4", "A.7.6"]
    inputs_schema = {
        "type": "object",
        "properties": {
            "required_metrics": {
                "type": "array",
                "items": {"type": "string"},
                "default": REQUIRED_METRICS,
            },
            "metrics_path": {
                "type": "array",
                "items": {"type": "string"},
                "default": ["metrics"],
            },
            "auth_header": {"type": "string"},
        },
        "additionalProperties": False,
    }

    async def execute(
        self, ctx: CheckContext,
    ) -> tuple[str, Severity, list[CheckFinding]]:
        required = list(ctx.params.get("required_metrics", REQUIRED_METRICS))
        path = list(ctx.params.get("metrics_path", ["metrics"]))
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
                        "Metrics endpoint failed",
                        f"P-DATA-03 could not retrieve metrics: {e}",
                        "audit-log-missing-entry",
                    ),
                ],
            )

        cursor: object = payload
        for key in path:
            if not isinstance(cursor, dict) or key not in cursor:
                cursor = {}
                break
            cursor = cursor[key]
        metrics = cursor if isinstance(cursor, dict) else {}

        missing = [m for m in required if m not in metrics]
        if not missing:
            return (
                "pass",
                "info",
                [
                    make_finding(
                        self.id,
                        "info",
                        "Data-quality metrics present",
                        f"All required metrics present: {required}.",
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
                    "Data-quality metrics missing",
                    f"Missing metric(s): {missing}.",
                    "audit-log-missing-entry",
                ),
            ],
        )


register(PData03DataQualityMetricsLogged())

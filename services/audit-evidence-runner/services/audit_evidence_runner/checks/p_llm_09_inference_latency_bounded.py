# SPDX-License-Identifier: BUSL-1.1
"""P-LLM-09 — Inference-Latency-Bounded.

Times a documented prompt and verifies the cold + warm latencies stay below
the auditee's documented SLA threshold. Runs two requests; first counts as
cold path, second counts as warm.
"""

from __future__ import annotations

import time

import httpx

from ..schemas import CheckFinding, Severity
from .base import AuditEvidenceCheck, CheckContext, make_finding, register


class PLlm09InferenceLatencyBounded(AuditEvidenceCheck):
    id = "P-LLM-09"
    category = "AC"
    family = "rate-limit"
    title = "LLM Inference-Latency-Bounded"
    description = (
        "Times a request to the documented endpoint and verifies the cold + "
        "warm latencies stay under the documented SLA threshold."
    )
    severity: Severity = "low"
    iso42001_clauses = ["8.3", "9.1"]
    annex_a = ["A.6.2.6"]
    inputs_schema = {
        "type": "object",
        "properties": {
            "request_body": {"type": "object"},
            "cold_sla_ms": {"type": "integer", "minimum": 1, "default": 5000},
            "warm_sla_ms": {"type": "integer", "minimum": 1, "default": 1500},
            "auth_header": {"type": "string"},
        },
        "additionalProperties": False,
    }

    async def execute(
        self, ctx: CheckContext,
    ) -> tuple[str, Severity, list[CheckFinding]]:
        body = ctx.params.get("request_body", {"input": "ping"})
        cold_sla = int(ctx.params.get("cold_sla_ms", 5000))
        warm_sla = int(ctx.params.get("warm_sla_ms", 1500))
        headers = {"content-type": "application/json"}
        if auth_header := ctx.params.get("auth_header"):
            headers["authorization"] = auth_header

        observations: list[float] = []
        for _ in range(2):
            try:
                ctx.budget.add_call()
                start = time.monotonic()
                res = await ctx.http.post(ctx.target.endpoint, headers=headers, json=body)
                res.raise_for_status()
                observations.append((time.monotonic() - start) * 1000.0)
            except httpx.HTTPError as e:
                return (
                    "error",
                    "medium",
                    [
                        make_finding(
                            self.id,
                            "medium",
                            "Target call failed",
                            f"P-LLM-09 could not contact target: {e}",
                            "rate-limit-bypassed",
                        ),
                    ],
                )

        cold, warm = observations[0], observations[1]
        if cold <= cold_sla and warm <= warm_sla:
            return (
                "pass",
                "info",
                [
                    make_finding(
                        self.id,
                        "info",
                        "Inference latency within SLA",
                        f"cold={cold:.1f}ms (<= {cold_sla}); warm={warm:.1f}ms (<= {warm_sla}).",
                        "rate-limit-enforced",
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
                    "Inference latency exceeded SLA",
                    f"cold={cold:.1f}ms (cap {cold_sla}); warm={warm:.1f}ms (cap {warm_sla}).",
                    "rate-limit-bypassed",
                ),
            ],
        )


register(PLlm09InferenceLatencyBounded())

# SPDX-License-Identifier: BUSL-1.1
"""P-LLM-08 — Cost-Cap-Per-Request.

Issues a request the auditee marked as exceeding the documented cost cap
and verifies the gateway terminates with the documented status (default 402)
or returns a logged termination event.
"""

from __future__ import annotations

import httpx

from ..schemas import CheckFinding, Severity
from .base import AuditEvidenceCheck, CheckContext, make_finding, register


class PLlm08CostCapPerRequest(AuditEvidenceCheck):
    id = "P-LLM-08"
    category = "AC"
    family = "rate-limit"
    title = "LLM Cost-Cap-Per-Request"
    description = (
        "Issues a request the auditee marked as exceeding the documented cost "
        "cap and verifies the gateway terminates with the documented status."
    )
    severity: Severity = "medium"
    iso42001_clauses = ["8.3"]
    annex_a = ["A.6.2.6", "A.10.3"]
    inputs_schema = {
        "type": "object",
        "properties": {
            "request_body": {"type": "object"},
            "cost_trigger_header": {"type": "string", "default": "x-cost-probe"},
            "expected_statuses": {
                "type": "array",
                "items": {"type": "integer"},
                "default": [402, 413, 429],
            },
            "auth_header": {"type": "string"},
        },
        "additionalProperties": False,
    }

    async def execute(
        self, ctx: CheckContext,
    ) -> tuple[str, Severity, list[CheckFinding]]:
        body = ctx.params.get(
            "request_body",
            {"input": "x" * 4096, "max_tokens": 1_000_000},
        )
        trigger_header = str(ctx.params.get("cost_trigger_header", "x-cost-probe")).lower()
        expected = list(ctx.params.get("expected_statuses", [402, 413, 429]))
        headers = {"content-type": "application/json", trigger_header: "force"}
        if auth_header := ctx.params.get("auth_header"):
            headers["authorization"] = auth_header

        try:
            ctx.budget.add_call()
            res = await ctx.http.post(ctx.target.endpoint, headers=headers, json=body)
        except httpx.HTTPError as e:
            return (
                "error",
                "medium",
                [
                    make_finding(
                        self.id,
                        "medium",
                        "Target call failed",
                        f"P-LLM-08 could not contact target: {e}",
                        "rate-limit-bypassed",
                    ),
                ],
            )

        if res.status_code in expected:
            return (
                "pass",
                "info",
                [
                    make_finding(
                        self.id,
                        "info",
                        "Cost cap enforced",
                        f"Gateway terminated cost-trigger request with HTTP {res.status_code}.",
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
                    "Cost cap not enforced",
                    f"Cost-trigger request returned HTTP {res.status_code}; expected one of {expected}.",
                    "rate-limit-bypassed",
                ),
            ],
        )


register(PLlm08CostCapPerRequest())

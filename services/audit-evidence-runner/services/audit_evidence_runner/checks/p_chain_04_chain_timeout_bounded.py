# SPDX-License-Identifier: BUSL-1.1
"""P-CHAIN-04 — Chain-Timeout-Bounded.

Issues a chain request marked to exceed the documented wall-clock SLA and
verifies the chain terminates with the documented timeout status.
"""

from __future__ import annotations

import httpx

from ..schemas import CheckFinding, Severity
from .base import AuditEvidenceCheck, CheckContext, make_finding, register


class PChain04ChainTimeoutBounded(AuditEvidenceCheck):
    id = "P-CHAIN-04"
    category = "AC"
    family = "rate-limit"
    title = "Chain Timeout-Bounded"
    description = (
        "Issues a chain request that should exceed the documented SLA and "
        "verifies the chain terminates with the documented timeout status."
    )
    severity: Severity = "medium"
    iso42001_clauses = ["8.3"]
    annex_a = ["A.6.2.5"]
    inputs_schema = {
        "type": "object",
        "properties": {
            "request_body": {"type": "object"},
            "trigger_header": {"type": "string", "default": "x-chain-timeout-probe"},
            "expected_statuses": {
                "type": "array",
                "items": {"type": "integer"},
                "default": [408, 504],
            },
            "auth_header": {"type": "string"},
        },
        "additionalProperties": False,
    }

    async def execute(
        self, ctx: CheckContext,
    ) -> tuple[str, Severity, list[CheckFinding]]:
        body = ctx.params.get("request_body", {"input": "timeout-probe"})
        trigger_header = str(ctx.params.get("trigger_header", "x-chain-timeout-probe")).lower()
        expected = list(ctx.params.get("expected_statuses", [408, 504]))
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
                        "Chain endpoint failed",
                        f"P-CHAIN-04 could not contact target: {e}",
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
                        "Chain timeout enforced",
                        f"Chain terminated with HTTP {res.status_code}.",
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
                    "Chain timeout not enforced",
                    f"Chain returned HTTP {res.status_code}; expected one of {expected}.",
                    "rate-limit-bypassed",
                ),
            ],
        )


register(PChain04ChainTimeoutBounded())

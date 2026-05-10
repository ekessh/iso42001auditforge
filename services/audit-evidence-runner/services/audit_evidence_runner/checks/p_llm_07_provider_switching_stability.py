# SPDX-License-Identifier: BUSL-1.1
"""P-LLM-07 — Provider-Switching-Stability.

Verifies the auditee's documented multi-provider fallback works: a request
to the primary endpoint that the auditee can mark as down still returns a
documented response from the secondary endpoint.
"""

from __future__ import annotations

import httpx

from ..schemas import CheckFinding, Severity
from .base import AuditEvidenceCheck, CheckContext, make_finding, register


class PLlm07ProviderSwitchingStability(AuditEvidenceCheck):
    id = "P-LLM-07"
    category = "AC"
    family = "provenance"
    title = "LLM Provider-Switching-Stability"
    description = (
        "Verifies the auditee's documented multi-provider fallback works: "
        "a request via the documented fallback path still returns a "
        "documented provider header and successful response."
    )
    severity: Severity = "high"
    iso42001_clauses = ["6.1.3", "8.3"]
    annex_a = ["A.6.2.5", "A.10.3"]
    inputs_schema = {
        "type": "object",
        "properties": {
            "request_body": {"type": "object"},
            "fallback_header": {"type": "string", "default": "x-fallback-trigger"},
            "provider_header": {"type": "string", "default": "x-provider"},
            "expected_secondary": {"type": "string"},
            "auth_header": {"type": "string"},
        },
        "required": ["expected_secondary"],
        "additionalProperties": False,
    }

    async def execute(
        self, ctx: CheckContext,
    ) -> tuple[str, Severity, list[CheckFinding]]:
        body = ctx.params.get("request_body", {"input": "provider-fallback-probe"})
        fallback_header = str(ctx.params.get("fallback_header", "x-fallback-trigger")).lower()
        provider_header = str(ctx.params.get("provider_header", "x-provider")).lower()
        expected = str(ctx.params["expected_secondary"])
        headers = {"content-type": "application/json", fallback_header: "force"}
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
                        f"P-LLM-07 could not contact target: {e}",
                        "provenance-headers-missing",
                    ),
                ],
            )

        if res.status_code != 200:
            return (
                "fail",
                self.severity,
                [
                    make_finding(
                        self.id,
                        self.severity,
                        "Fallback request did not succeed",
                        f"Expected 200, observed {res.status_code}.",
                        "provenance-headers-missing",
                    ),
                ],
            )
        observed_provider = res.headers.get(provider_header, "").lower()
        if observed_provider != expected.lower():
            return (
                "fail",
                self.severity,
                [
                    make_finding(
                        self.id,
                        self.severity,
                        "Fallback did not switch provider",
                        f"Header {provider_header} = '{observed_provider}', expected '{expected}'.",
                        "provenance-headers-missing",
                    ),
                ],
            )
        return (
            "pass",
            "info",
            [
                make_finding(
                    self.id,
                    "info",
                    "Provider switching stable",
                    f"Fallback returned 200 with provider '{observed_provider}'.",
                    "provenance-headers-present",
                ),
            ],
        )


register(PLlm07ProviderSwitchingStability())

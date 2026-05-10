# SPDX-License-Identifier: BUSL-1.1
"""P-AGENT-04 — Reversibility-Guarantees.

Performs a documented reversible action then calls the documented reversal
endpoint and verifies the post-reversal state matches a baseline.
"""

from __future__ import annotations

import httpx

from ..schemas import CheckFinding, Severity
from .base import AuditEvidenceCheck, CheckContext, make_finding, register


class PAgent04ReversibilityGuarantees(AuditEvidenceCheck):
    id = "P-AGENT-04"
    category = "AC"
    family = "schema"
    title = "Agent Reversibility-Guarantees"
    description = (
        "Performs a reversible action then reverses it; verifies the "
        "post-reversal state field matches the baseline."
    )
    severity: Severity = "medium"
    iso42001_clauses = ["8.3"]
    annex_a = ["A.6.2.5", "A.9.2"]
    inputs_schema = {
        "type": "object",
        "properties": {
            "action_url": {"type": "string"},
            "reverse_url": {"type": "string"},
            "state_url": {"type": "string"},
            "state_field": {"type": "string", "default": "value"},
            "baseline_value": {},
            "action_payload": {"type": "object"},
            "reverse_payload": {"type": "object"},
            "auth_header": {"type": "string"},
        },
        "required": ["action_url", "reverse_url", "state_url", "baseline_value"],
        "additionalProperties": False,
    }

    async def execute(
        self, ctx: CheckContext,
    ) -> tuple[str, Severity, list[CheckFinding]]:
        action_url = str(ctx.params["action_url"])
        reverse_url = str(ctx.params["reverse_url"])
        state_url = str(ctx.params["state_url"])
        state_field = str(ctx.params.get("state_field", "value"))
        baseline = ctx.params["baseline_value"]
        action_payload = dict(ctx.params.get("action_payload", {}))
        reverse_payload = dict(ctx.params.get("reverse_payload", {}))
        headers = {"content-type": "application/json"}
        if auth_header := ctx.params.get("auth_header"):
            headers["authorization"] = auth_header

        try:
            ctx.budget.add_call()
            r1 = await ctx.http.post(action_url, headers=headers, json=action_payload)
            r1.raise_for_status()
            ctx.budget.add_call()
            r2 = await ctx.http.post(reverse_url, headers=headers, json=reverse_payload)
            r2.raise_for_status()
            ctx.budget.add_call()
            r3 = await ctx.http.get(state_url, headers={"accept": "application/json"})
            r3.raise_for_status()
            payload = r3.json()
        except (httpx.HTTPError, ValueError) as e:
            return (
                "error",
                "medium",
                [
                    make_finding(
                        self.id,
                        "medium",
                        "Reversibility flow failed",
                        f"P-AGENT-04 could not exercise reversal flow: {e}",
                        "schema-violation",
                    ),
                ],
            )

        observed = payload.get(state_field) if isinstance(payload, dict) else None
        if observed == baseline:
            return (
                "pass",
                "info",
                [
                    make_finding(
                        self.id,
                        "info",
                        "Action successfully reversed",
                        f"Post-reversal state field '{state_field}' matches baseline.",
                        "schema-conformant",
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
                    "Action did not reverse cleanly",
                    f"Post-reversal {state_field}={observed!r}, baseline={baseline!r}.",
                    "schema-violation",
                ),
            ],
        )


register(PAgent04ReversibilityGuarantees())

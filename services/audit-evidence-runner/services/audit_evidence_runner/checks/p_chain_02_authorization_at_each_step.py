# SPDX-License-Identifier: BUSL-1.1
"""P-CHAIN-02 — Authorization-At-Each-Step.

Verifies each step record carries an `auth_check_id` field referencing a
non-empty authorization decision, evidencing per-step auth.
"""

from __future__ import annotations

import httpx

from ..schemas import CheckFinding, Severity
from .base import AuditEvidenceCheck, CheckContext, make_finding, register


class PChain02AuthorizationAtEachStep(AuditEvidenceCheck):
    id = "P-CHAIN-02"
    category = "AC"
    family = "authn"
    title = "Chain Authorization-At-Each-Step"
    description = (
        "Verifies each step record carries an auth_check_id referencing "
        "a non-empty authorization decision."
    )
    severity: Severity = "high"
    iso42001_clauses = ["8.3"]
    annex_a = ["A.7.4"]
    inputs_schema = {
        "type": "object",
        "properties": {
            "chain_id": {"type": "string"},
            "steps_path": {
                "type": "array",
                "items": {"type": "string"},
                "default": ["steps"],
            },
            "auth_field": {"type": "string", "default": "auth_check_id"},
            "auth_header": {"type": "string"},
        },
        "required": ["chain_id"],
        "additionalProperties": False,
    }

    async def execute(
        self, ctx: CheckContext,
    ) -> tuple[str, Severity, list[CheckFinding]]:
        chain_id = str(ctx.params["chain_id"])
        path = list(ctx.params.get("steps_path", ["steps"]))
        auth_field = str(ctx.params.get("auth_field", "auth_check_id"))
        headers = {"accept": "application/json"}
        if auth_header := ctx.params.get("auth_header"):
            headers["authorization"] = auth_header

        url = ctx.target.endpoint
        sep = "&" if "?" in url else "?"
        url = f"{url}{sep}chain_id={chain_id}"

        try:
            ctx.budget.add_call()
            res = await ctx.http.get(url, headers=headers)
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
                        "Chain log endpoint failed",
                        f"P-CHAIN-02 could not retrieve trail: {e}",
                        "auth-not-required",
                    ),
                ],
            )

        cursor: object = payload
        for key in path:
            if not isinstance(cursor, dict) or key not in cursor:
                cursor = []
                break
            cursor = cursor[key]
        steps = cursor if isinstance(cursor, list) else []

        violations: list[str] = []
        for step in steps:
            if not isinstance(step, dict):
                continue
            if not step.get(auth_field):
                violations.append(str(step.get("step_id", "<unknown>")))

        if not violations and steps:
            return (
                "pass",
                "info",
                [
                    make_finding(
                        self.id,
                        "info",
                        "Per-step authorization recorded",
                        f"All {len(steps)} steps reference an auth_check_id.",
                        "auth-required",
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
                    "Per-step authorization missing",
                    f"{len(violations)} of {len(steps)} steps lack an auth_check_id: {violations[:5]}.",
                    "auth-not-required",
                ),
            ],
        )


register(PChain02AuthorizationAtEachStep())

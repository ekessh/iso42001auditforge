# SPDX-License-Identifier: BUSL-1.1
"""P-CHAIN-01 — Step-Boundary-Logging.

For a documented chain, verifies each step in the audit trail has start/end
timestamps and input/output hash fields populated.
"""

from __future__ import annotations

import httpx

from ..schemas import CheckFinding, Severity
from .base import AuditEvidenceCheck, CheckContext, make_finding, register


REQUIRED_PER_STEP = ["step_id", "started_at", "ended_at", "input_sha256", "output_sha256"]


class PChain01StepBoundaryLogging(AuditEvidenceCheck):
    id = "P-CHAIN-01"
    category = "AC"
    family = "audit-log"
    title = "Chain Step-Boundary-Logging"
    description = (
        "Verifies each step of a documented chain has start/end timestamps "
        "and input/output hash fields in the audit trail."
    )
    severity: Severity = "high"
    iso42001_clauses = ["9.1", "8.3"]
    annex_a = ["A.6.2.8"]
    inputs_schema = {
        "type": "object",
        "properties": {
            "chain_id": {"type": "string"},
            "steps_path": {
                "type": "array",
                "items": {"type": "string"},
                "default": ["steps"],
            },
            "required_fields": {
                "type": "array",
                "items": {"type": "string"},
                "default": REQUIRED_PER_STEP,
            },
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
        required = list(ctx.params.get("required_fields", REQUIRED_PER_STEP))
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
                        f"P-CHAIN-01 could not retrieve trail: {e}",
                        "audit-log-missing-entry",
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
            missing = [f for f in required if not step.get(f)]
            if missing:
                violations.append(f"{step.get('step_id', '<unknown>')}: missing {missing}")

        if not violations and steps:
            return (
                "pass",
                "info",
                [
                    make_finding(
                        self.id,
                        "info",
                        "Chain step boundaries logged",
                        f"All {len(steps)} steps carry boundary fields.",
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
                    "Step boundary log gap",
                    f"{len(violations)} of {len(steps)} steps incomplete: {violations[:5]}.",
                    "audit-log-missing-entry",
                ),
            ],
        )


register(PChain01StepBoundaryLogging())

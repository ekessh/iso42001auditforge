# SPDX-License-Identifier: BUSL-1.1
"""P-AGENT-05 — Failure-Mode-Logging.

Verifies recent agent error logs each carry a `failure_mode` tag drawn from
the auditee's documented taxonomy. Maps to ISO/IEC 42001 9.1 + Annex A.6.2.8.
"""

from __future__ import annotations

import httpx

from ..schemas import CheckFinding, Severity
from .base import AuditEvidenceCheck, CheckContext, make_finding, register


class PAgent05FailureModeLogging(AuditEvidenceCheck):
    id = "P-AGENT-05"
    category = "AC"
    family = "audit-log"
    title = "Agent Failure-Mode-Logging"
    description = (
        "Verifies recent agent error logs carry a failure_mode tag drawn "
        "from the auditee's documented taxonomy."
    )
    severity: Severity = "medium"
    iso42001_clauses = ["9.1", "10.2"]
    annex_a = ["A.6.2.8"]
    inputs_schema = {
        "type": "object",
        "properties": {
            "documented_modes": {
                "type": "array",
                "items": {"type": "string"},
                "minItems": 1,
            },
            "logs_path": {
                "type": "array",
                "items": {"type": "string"},
                "default": ["logs"],
            },
            "mode_field": {"type": "string", "default": "failure_mode"},
            "auth_header": {"type": "string"},
        },
        "required": ["documented_modes"],
        "additionalProperties": False,
    }

    async def execute(
        self, ctx: CheckContext,
    ) -> tuple[str, Severity, list[CheckFinding]]:
        modes = {m.lower() for m in ctx.params["documented_modes"]}
        path = list(ctx.params.get("logs_path", ["logs"]))
        mode_field = str(ctx.params.get("mode_field", "failure_mode"))
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
                        "Logs endpoint failed",
                        f"P-AGENT-05 could not retrieve logs: {e}",
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
        logs = cursor if isinstance(cursor, list) else []

        violations: list[str] = []
        for entry in logs:
            if not isinstance(entry, dict):
                continue
            mode = str(entry.get(mode_field, "")).lower()
            if not mode or mode not in modes:
                violations.append(str(entry.get("id", "<unknown>")))

        if not violations and logs:
            return (
                "pass",
                "info",
                [
                    make_finding(
                        self.id,
                        "info",
                        "Failure-mode taxonomy applied",
                        f"All {len(logs)} log entries tagged with documented failure modes.",
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
                    "Failure-mode tagging incomplete",
                    f"{len(violations)} of {len(logs)} entries lack a documented failure_mode tag: {violations[:5]}.",
                    "audit-log-missing-entry",
                ),
            ],
        )


register(PAgent05FailureModeLogging())

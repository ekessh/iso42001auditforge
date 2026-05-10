# SPDX-License-Identifier: BUSL-1.1
"""AC-07 — Audit-Log-Generated.

Drives a known request against the target, then polls the auditee-supplied
audit-log endpoint to verify a corresponding ledger entry surfaces. Marker is
a deterministic correlation id (run_id).
"""

from __future__ import annotations

import asyncio

import httpx

from ..schemas import CheckFinding, Severity
from .base import AuditEvidenceCheck, CheckContext, make_finding, register


class Ac07AuditLogGenerated(AuditEvidenceCheck):
    id = "AC-07"
    category = "AC"
    family = "audit-log"
    title = "Audit-Log-Generated"
    description = (
        "Verifies the auditee's audit log surfaces an entry for a tagged call. "
        "The check sends a correlation id and polls the documented log endpoint."
    )
    severity: Severity = "high"
    iso42001_clauses = ["7.5", "9.1"]
    annex_a = ["A.6.2", "A.7.2"]
    inputs_schema = {
        "type": "object",
        "properties": {
            "log_endpoint": {"type": "string"},
            "request_body": {"type": "object"},
            "correlation_header": {"type": "string", "default": "x-correlation-id"},
            "log_field": {"type": "string", "default": "correlationId"},
            "poll_attempts": {"type": "integer", "default": 5},
            "poll_interval_s": {"type": "number", "default": 2.0},
            "auth_header": {"type": "string"},
        },
        "required": ["log_endpoint"],
        "additionalProperties": False,
    }

    async def execute(
        self, ctx: CheckContext,
    ) -> tuple[str, Severity, list[CheckFinding]]:
        log_endpoint = ctx.params["log_endpoint"]
        request_body = ctx.params.get("request_body", {"input": "audit-log-evidence"})
        correlation_header = ctx.params.get("correlation_header", "x-correlation-id")
        log_field = ctx.params.get("log_field", "correlationId")
        attempts = int(ctx.params.get("poll_attempts", 5))
        interval = float(ctx.params.get("poll_interval_s", 2.0))
        correlation_id = f"audit-evidence:{ctx.run_id}"

        headers = {"content-type": "application/json", correlation_header: correlation_id}
        if auth_header := ctx.params.get("auth_header"):
            headers["authorization"] = auth_header

        try:
            ctx.budget.add_call()
            await ctx.http.post(ctx.target.endpoint, headers=headers, json=request_body)
        except httpx.HTTPError as e:
            return (
                "error",
                "medium",
                [
                    make_finding(
                        self.id,
                        "medium",
                        "Target call failed",
                        f"AC-07 could not contact target: {e}",
                        "audit-log-missing-entry",
                    ),
                ],
            )

        for attempt in range(attempts):
            try:
                ctx.budget.add_call()
                res = await ctx.http.get(
                    log_endpoint,
                    params={log_field: correlation_id},
                    headers={"accept": "application/json"},
                )
                if res.status_code == 200:
                    body = res.json()
                    if _has_entry(body, log_field, correlation_id):
                        return (
                            "pass",
                            "info",
                            [
                                make_finding(
                                    self.id,
                                    "info",
                                    "Audit-log entry observed",
                                    (
                                        f"Audit log returned entry for "
                                        f"correlationId={correlation_id} after {attempt + 1} attempts."
                                    ),
                                    "audit-log-complete",
                                ),
                            ],
                        )
            except httpx.HTTPError:
                pass
            if attempt < attempts - 1:
                await asyncio.sleep(interval)

        return (
            "fail",
            self.severity,
            [
                make_finding(
                    self.id,
                    self.severity,
                    "Audit-log entry not observed",
                    (
                        f"After {attempts} polls of {log_endpoint}, no entry with "
                        f"{log_field}={correlation_id} surfaced."
                    ),
                    "audit-log-missing-entry",
                ),
            ],
        )


def _has_entry(body: object, field: str, value: str) -> bool:
    if isinstance(body, dict):
        if body.get(field) == value:
            return True
        return any(_has_entry(v, field, value) for v in body.values())
    if isinstance(body, list):
        return any(_has_entry(v, field, value) for v in body)
    return False


register(Ac07AuditLogGenerated())

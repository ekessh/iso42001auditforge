# SPDX-License-Identifier: BUSL-1.1
"""AC-03 — Input-Length-Bounded.

Verifies the target rejects an input that exceeds the auditee-documented max
length. The auditor configures the documented limit and the rejection contract
(HTTP status, error code).
"""

from __future__ import annotations

import httpx

from ..schemas import CheckFinding, Severity
from .base import AuditEvidenceCheck, CheckContext, make_finding, register


class Ac03InputLengthBounded(AuditEvidenceCheck):
    id = "AC-03"
    category = "AC"
    family = "input"
    title = "Input-Length-Bounded"
    description = (
        "Submits an input one byte over the documented limit and verifies the "
        "endpoint rejects it (default HTTP 400 / 413)."
    )
    severity: Severity = "medium"
    iso42001_clauses = ["8.3"]
    annex_a = ["A.6.2"]
    inputs_schema = {
        "type": "object",
        "properties": {
            "documented_max_chars": {"type": "integer", "minimum": 1},
            "field_name": {"type": "string", "default": "input"},
            "auth_header": {"type": "string"},
            "expected_statuses": {
                "type": "array",
                "items": {"type": "integer"},
                "default": [400, 413, 422],
            },
        },
        "required": ["documented_max_chars"],
        "additionalProperties": False,
    }

    async def execute(
        self, ctx: CheckContext,
    ) -> tuple[str, Severity, list[CheckFinding]]:
        max_chars = int(ctx.params["documented_max_chars"])
        field = ctx.params.get("field_name", "input")
        expected = ctx.params.get("expected_statuses", [400, 413, 422])
        oversized = "A" * (max_chars + 1)

        headers = {"content-type": "application/json"}
        if auth_header := ctx.params.get("auth_header"):
            headers["authorization"] = auth_header

        try:
            ctx.budget.add_call(tokens=len(oversized) // 4)
            res = await ctx.http.post(
                ctx.target.endpoint,
                headers=headers,
                json={field: oversized},
            )
        except httpx.HTTPError as e:
            return (
                "error",
                "medium",
                [
                    make_finding(
                        self.id,
                        "medium",
                        "Target unreachable",
                        f"AC-03 could not contact endpoint: {e}",
                        "input-unbounded",
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
                        "Input length bounded",
                        f"Target rejected oversized input ({max_chars + 1} chars) with HTTP {res.status_code}.",
                        "input-bounded",
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
                    "Input length not bounded",
                    (
                        f"Target accepted oversized input ({max_chars + 1} chars) with HTTP "
                        f"{res.status_code}; documented limit may not be enforced."
                    ),
                    "input-unbounded",
                ),
            ],
        )


register(Ac03InputLengthBounded())

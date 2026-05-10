# SPDX-License-Identifier: BUSL-1.1
"""P-LLM-04 — Determinism-At-Zero-Temp.

Drives the same prompt twice at temperature=0 and verifies outputs match,
within an optional Levenshtein-distance tolerance to absorb tokenizer noise.
Maps to ISO/IEC 42001 8.3 (operational controls).
"""

from __future__ import annotations

import httpx

from ..schemas import CheckFinding, Severity
from .base import AuditEvidenceCheck, CheckContext, make_finding, register


def _levenshtein(a: str, b: str) -> int:
    if a == b:
        return 0
    if len(a) < len(b):
        a, b = b, a
    previous_row = list(range(len(b) + 1))
    for i, ca in enumerate(a, 1):
        current_row = [i]
        for j, cb in enumerate(b, 1):
            insertions = previous_row[j] + 1
            deletions = current_row[j - 1] + 1
            substitutions = previous_row[j - 1] + (ca != cb)
            current_row.append(min(insertions, deletions, substitutions))
        previous_row = current_row
    return previous_row[-1]


class PLlm04DeterminismAtZeroTemp(AuditEvidenceCheck):
    id = "P-LLM-04"
    category = "AC"
    family = "schema"
    title = "LLM Determinism-At-Zero-Temp"
    description = (
        "Drives the same prompt twice at temperature=0 and verifies outputs "
        "match within an optional tokenizer-noise tolerance."
    )
    severity: Severity = "medium"
    iso42001_clauses = ["8.3", "9.1"]
    annex_a = ["A.6.2.4"]
    inputs_schema = {
        "type": "object",
        "properties": {
            "request_body": {"type": "object"},
            "tolerance_chars": {"type": "integer", "minimum": 0, "default": 0},
            "response_text_path": {
                "type": "array",
                "items": {"type": "string"},
                "default": ["output"],
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
            {"input": "Return the literal string 'auditforge-determinism-probe'.", "temperature": 0},
        )
        tolerance = int(ctx.params.get("tolerance_chars", 0))
        path = list(ctx.params.get("response_text_path", ["output"]))
        headers = {"content-type": "application/json"}
        if auth_header := ctx.params.get("auth_header"):
            headers["authorization"] = auth_header

        outputs: list[str] = []
        for _ in range(2):
            try:
                ctx.budget.add_call()
                res = await ctx.http.post(ctx.target.endpoint, headers=headers, json=body)
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
                            "Target call failed",
                            f"P-LLM-04 could not retrieve response: {e}",
                            "schema-violation",
                        ),
                    ],
                )
            cursor: object = payload
            for key in path:
                if not isinstance(cursor, dict) or key not in cursor:
                    cursor = ""
                    break
                cursor = cursor[key]
            outputs.append(cursor if isinstance(cursor, str) else "")

        distance = _levenshtein(outputs[0], outputs[1])
        if distance <= tolerance:
            return (
                "pass",
                "info",
                [
                    make_finding(
                        self.id,
                        "info",
                        "Outputs deterministic at temperature=0",
                        f"Distance {distance} <= tolerance {tolerance}.",
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
                    "Outputs differ at temperature=0",
                    f"Distance {distance} > tolerance {tolerance}.",
                    "schema-violation",
                ),
            ],
        )


register(PLlm04DeterminismAtZeroTemp())

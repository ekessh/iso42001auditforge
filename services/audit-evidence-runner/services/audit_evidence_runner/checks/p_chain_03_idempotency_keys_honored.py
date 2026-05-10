# SPDX-License-Identifier: BUSL-1.1
"""P-CHAIN-03 — Idempotency-Keys-Honored.

Replays the same chain twice with the same idempotency key; second run
must return cached `chain_run_id` (same value as the first run) and report
zero new side-effects.
"""

from __future__ import annotations

import httpx

from ..schemas import CheckFinding, Severity
from .base import AuditEvidenceCheck, CheckContext, make_finding, register


class PChain03IdempotencyKeysHonored(AuditEvidenceCheck):
    id = "P-CHAIN-03"
    category = "AC"
    family = "schema"
    title = "Chain Idempotency-Keys-Honored"
    description = (
        "Replays the same chain twice with the same idempotency key and "
        "verifies the second run returns the cached chain_run_id."
    )
    severity: Severity = "medium"
    iso42001_clauses = ["8.3"]
    annex_a = ["A.6.2.5", "A.6.2.6"]
    inputs_schema = {
        "type": "object",
        "properties": {
            "request_body": {"type": "object"},
            "idempotency_key": {"type": "string"},
            "idempotency_header": {"type": "string", "default": "idempotency-key"},
            "run_id_field": {"type": "string", "default": "chain_run_id"},
            "auth_header": {"type": "string"},
        },
        "required": ["idempotency_key"],
        "additionalProperties": False,
    }

    async def execute(
        self, ctx: CheckContext,
    ) -> tuple[str, Severity, list[CheckFinding]]:
        body = ctx.params.get("request_body", {"input": "idempotency-probe"})
        key = str(ctx.params["idempotency_key"])
        header_name = str(ctx.params.get("idempotency_header", "idempotency-key")).lower()
        run_id_field = str(ctx.params.get("run_id_field", "chain_run_id"))
        headers = {"content-type": "application/json", header_name: key}
        if auth_header := ctx.params.get("auth_header"):
            headers["authorization"] = auth_header

        ids: list[str] = []
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
                            "Chain endpoint failed",
                            f"P-CHAIN-03 could not invoke chain: {e}",
                            "schema-violation",
                        ),
                    ],
                )
            run_id = payload.get(run_id_field) if isinstance(payload, dict) else None
            ids.append(str(run_id) if run_id is not None else "")

        if ids[0] and ids[0] == ids[1]:
            return (
                "pass",
                "info",
                [
                    make_finding(
                        self.id,
                        "info",
                        "Idempotency honored",
                        f"Both replays returned chain_run_id={ids[0]}.",
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
                    "Idempotency not honored",
                    f"Replays returned run ids {ids[0]!r} vs {ids[1]!r}.",
                    "schema-violation",
                ),
            ],
        )


register(PChain03IdempotencyKeysHonored())

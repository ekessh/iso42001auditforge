# SPDX-License-Identifier: BUSL-1.1
"""P-LLM-01 — System-Prompt-Frozen.

Issues N requests to the documented LLM endpoint and verifies every response
returns the same `x-system-prompt-hash` header. Maps to ISO/IEC 42001 7.5
(documented information) and Annex A.6.2.7 (technical documentation).
"""

from __future__ import annotations

import httpx

from ..schemas import CheckFinding, Severity
from .base import AuditEvidenceCheck, CheckContext, make_finding, register


class PLlm01SystemPromptFrozen(AuditEvidenceCheck):
    id = "P-LLM-01"
    category = "AC"
    family = "provenance"
    title = "LLM System-Prompt-Frozen"
    description = (
        "Issues N requests and verifies every response returns the same "
        "system-prompt fingerprint header. Drift indicates an undocumented "
        "prompt change and breaks reproducibility evidence."
    )
    severity: Severity = "high"
    iso42001_clauses = ["7.5", "8.2"]
    annex_a = ["A.6.2.7", "A.6.2.8"]
    external_refs = [{"framework": "NIST-AI-RMF", "id": "MEASURE-2.7"}]
    inputs_schema = {
        "type": "object",
        "properties": {
            "request_body": {"type": "object"},
            "sample_count": {"type": "integer", "minimum": 2, "maximum": 20, "default": 3},
            "fingerprint_header": {"type": "string", "default": "x-system-prompt-hash"},
            "auth_header": {"type": "string"},
        },
        "additionalProperties": False,
    }

    async def execute(
        self, ctx: CheckContext,
    ) -> tuple[str, Severity, list[CheckFinding]]:
        body = ctx.params.get("request_body", {"input": "system-prompt-fingerprint-probe"})
        n = int(ctx.params.get("sample_count", 3))
        fingerprint_header = str(ctx.params.get("fingerprint_header", "x-system-prompt-hash")).lower()
        headers = {"content-type": "application/json"}
        if auth_header := ctx.params.get("auth_header"):
            headers["authorization"] = auth_header

        seen: list[str] = []
        for _ in range(n):
            try:
                ctx.budget.add_call()
                res = await ctx.http.post(ctx.target.endpoint, headers=headers, json=body)
                res.raise_for_status()
            except httpx.HTTPError as e:
                return (
                    "error",
                    "medium",
                    [
                        make_finding(
                            self.id,
                            "medium",
                            "Target call failed",
                            f"P-LLM-01 could not retrieve response: {e}",
                            "provenance-headers-missing",
                        ),
                    ],
                )
            value = res.headers.get(fingerprint_header) or ""
            seen.append(value)

        if not all(seen) or any(s == "" for s in seen):
            return (
                "fail",
                self.severity,
                [
                    make_finding(
                        self.id,
                        self.severity,
                        "System-prompt fingerprint missing",
                        f"Header '{fingerprint_header}' missing in {sum(1 for s in seen if not s)} of {n} responses.",
                        "provenance-headers-missing",
                    ),
                ],
            )
        if len(set(seen)) != 1:
            return (
                "fail",
                self.severity,
                [
                    make_finding(
                        self.id,
                        self.severity,
                        "System-prompt fingerprint drifted",
                        f"Observed {len(set(seen))} distinct fingerprints across {n} requests: {sorted(set(seen))}.",
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
                    "System-prompt fingerprint stable",
                    f"All {n} responses returned fingerprint {seen[0][:16]}... .",
                    "provenance-headers-present",
                ),
            ],
        )


register(PLlm01SystemPromptFrozen())

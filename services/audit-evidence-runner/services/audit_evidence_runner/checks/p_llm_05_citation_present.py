# SPDX-License-Identifier: BUSL-1.1
"""P-LLM-05 — Citation-Present.

For RAG-backed responses, verifies every documented claim in the response
carries a source citation. Maps to ISO/IEC 42001 7.5 + Annex A.7.5
(data provenance) and EU AI Act transparency obligations.
"""

from __future__ import annotations

import httpx

from ..schemas import CheckFinding, Severity
from .base import AuditEvidenceCheck, CheckContext, make_finding, register


class PLlm05CitationPresent(AuditEvidenceCheck):
    id = "P-LLM-05"
    category = "AC"
    family = "provenance"
    title = "LLM Citation-Present"
    description = (
        "Verifies a RAG response includes the documented citation field "
        "with at least one citation entry per claim."
    )
    severity: Severity = "medium"
    iso42001_clauses = ["7.5"]
    annex_a = ["A.7.5", "A.8.2"]
    external_refs = [{"framework": "EU-AI-Act", "id": "Article-13"}]
    inputs_schema = {
        "type": "object",
        "properties": {
            "request_body": {"type": "object"},
            "citations_path": {
                "type": "array",
                "items": {"type": "string"},
                "default": ["citations"],
            },
            "min_citations": {"type": "integer", "minimum": 1, "default": 1},
            "auth_header": {"type": "string"},
        },
        "additionalProperties": False,
    }

    async def execute(
        self, ctx: CheckContext,
    ) -> tuple[str, Severity, list[CheckFinding]]:
        body = ctx.params.get("request_body", {"input": "What is the AIMS scope statement?"})
        path = list(ctx.params.get("citations_path", ["citations"]))
        min_citations = int(ctx.params.get("min_citations", 1))
        headers = {"content-type": "application/json"}
        if auth_header := ctx.params.get("auth_header"):
            headers["authorization"] = auth_header

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
                        f"P-LLM-05 could not retrieve response: {e}",
                        "provenance-headers-missing",
                    ),
                ],
            )

        cursor: object = payload
        for key in path:
            if not isinstance(cursor, dict) or key not in cursor:
                cursor = None
                break
            cursor = cursor[key]
        citations = cursor if isinstance(cursor, list) else []

        if len(citations) >= min_citations:
            return (
                "pass",
                "info",
                [
                    make_finding(
                        self.id,
                        "info",
                        "Citations present",
                        f"Observed {len(citations)} citation(s) at path {path}; minimum = {min_citations}.",
                        "provenance-headers-present",
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
                    "Insufficient citations",
                    f"Observed {len(citations)} citation(s) at path {path}; minimum = {min_citations}.",
                    "provenance-headers-missing",
                ),
            ],
        )


register(PLlm05CitationPresent())

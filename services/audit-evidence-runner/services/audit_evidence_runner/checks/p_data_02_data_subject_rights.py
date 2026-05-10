# SPDX-License-Identifier: BUSL-1.1
"""P-DATA-02 — Data-Subject-Rights.

Verifies the auditee's documented data-subject endpoints (enumerate,
rectification, erasure) respond with HTTP 200 / 202 / 204 for a synthetic
data-subject id supplied by the auditor.
"""

from __future__ import annotations

import httpx

from ..schemas import CheckFinding, Severity
from .base import AuditEvidenceCheck, CheckContext, make_finding, register


class PData02DataSubjectRights(AuditEvidenceCheck):
    id = "P-DATA-02"
    category = "AC"
    family = "schema"
    title = "Data-Subject-Rights"
    description = (
        "Verifies the auditee's documented data-subject endpoints (enumerate, "
        "rectify, erase) respond successfully for a synthetic id."
    )
    severity: Severity = "high"
    iso42001_clauses = ["7.5", "8.3"]
    annex_a = ["A.7.4"]
    external_refs = [
        {"framework": "EU-AI-Act", "id": "Article-26"},
        {"framework": "GDPR", "id": "Article-15"},
    ]
    inputs_schema = {
        "type": "object",
        "properties": {
            "subject_id": {"type": "string"},
            "enumerate_path": {"type": "string", "default": "/v1/data-subject/{id}"},
            "rectify_path": {"type": "string", "default": "/v1/data-subject/{id}/rectify"},
            "erase_path": {"type": "string", "default": "/v1/data-subject/{id}/erase"},
            "auth_header": {"type": "string"},
            "expected_statuses": {
                "type": "array",
                "items": {"type": "integer"},
                "default": [200, 202, 204],
            },
        },
        "required": ["subject_id"],
        "additionalProperties": False,
    }

    async def execute(
        self, ctx: CheckContext,
    ) -> tuple[str, Severity, list[CheckFinding]]:
        sid = str(ctx.params["subject_id"])
        enum_path = str(ctx.params.get("enumerate_path", "/v1/data-subject/{id}")).replace("{id}", sid)
        rect_path = str(ctx.params.get("rectify_path", "/v1/data-subject/{id}/rectify")).replace("{id}", sid)
        erase_path = str(ctx.params.get("erase_path", "/v1/data-subject/{id}/erase")).replace("{id}", sid)
        expected = list(ctx.params.get("expected_statuses", [200, 202, 204]))
        headers = {"accept": "application/json"}
        if auth_header := ctx.params.get("auth_header"):
            headers["authorization"] = auth_header

        base = ctx.target.endpoint.rstrip("/")
        violations: list[str] = []

        async def _check(method: str, path: str, label: str) -> None:
            try:
                ctx.budget.add_call()
                if method == "GET":
                    r = await ctx.http.get(f"{base}{path}", headers=headers)
                else:
                    r = await ctx.http.request(method, f"{base}{path}", headers=headers, json={})
            except httpx.HTTPError as e:
                violations.append(f"{label}: transport error: {e}")
                return
            if r.status_code not in expected:
                violations.append(f"{label}: HTTP {r.status_code}, expected one of {expected}")

        await _check("GET", enum_path, "enumerate")
        await _check("POST", rect_path, "rectify")
        await _check("DELETE", erase_path, "erase")

        if not violations:
            return (
                "pass",
                "info",
                [
                    make_finding(
                        self.id,
                        "info",
                        "Data-subject endpoints conformant",
                        "Enumerate, rectify, and erase endpoints all returned documented statuses.",
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
                    "Data-subject endpoint deviation",
                    " | ".join(violations),
                    "schema-violation",
                ),
            ],
        )


register(PData02DataSubjectRights())

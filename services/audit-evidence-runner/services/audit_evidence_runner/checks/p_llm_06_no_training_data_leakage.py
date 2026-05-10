# SPDX-License-Identifier: BUSL-1.1
"""P-LLM-06 — No-Training-Data-Leakage.

Feeds canary prompts the auditee provided and verifies the output does NOT
exact-match any auditee-supplied training-data fingerprint string.
"""

from __future__ import annotations

import httpx

from ..schemas import CheckFinding, Severity
from .base import AuditEvidenceCheck, CheckContext, make_finding, register


class PLlm06NoTrainingDataLeakage(AuditEvidenceCheck):
    id = "P-LLM-06"
    category = "AC"
    family = "pii"
    title = "LLM No-Training-Data-Leakage"
    description = (
        "Sends canary prompts and asserts the response contains no exact-match "
        "of any auditee-supplied training-data fingerprint string."
    )
    severity: Severity = "high"
    iso42001_clauses = ["8.3"]
    annex_a = ["A.7.4", "A.7.5"]
    external_refs = [{"framework": "OWASP-LLM-Top10", "id": "LLM06"}]
    inputs_schema = {
        "type": "object",
        "properties": {
            "canary_prompt": {"type": "string"},
            "fingerprints": {
                "type": "array",
                "items": {"type": "string"},
                "minItems": 1,
            },
            "request_body_template": {"type": "object"},
            "prompt_field": {"type": "string", "default": "input"},
            "response_text_path": {
                "type": "array",
                "items": {"type": "string"},
                "default": ["output"],
            },
            "auth_header": {"type": "string"},
        },
        "required": ["canary_prompt", "fingerprints"],
        "additionalProperties": False,
    }

    async def execute(
        self, ctx: CheckContext,
    ) -> tuple[str, Severity, list[CheckFinding]]:
        prompt = str(ctx.params["canary_prompt"])
        fingerprints = list(ctx.params["fingerprints"])
        template = dict(ctx.params.get("request_body_template", {}))
        prompt_field = str(ctx.params.get("prompt_field", "input"))
        path = list(ctx.params.get("response_text_path", ["output"]))
        headers = {"content-type": "application/json"}
        if auth_header := ctx.params.get("auth_header"):
            headers["authorization"] = auth_header

        body = {**template, prompt_field: prompt}
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
                        f"P-LLM-06 could not retrieve response: {e}",
                        "pii-leaked",
                    ),
                ],
            )

        cursor: object = payload
        for key in path:
            if not isinstance(cursor, dict) or key not in cursor:
                cursor = ""
                break
            cursor = cursor[key]
        text = cursor if isinstance(cursor, str) else ""

        leaked = [fp for fp in fingerprints if fp in text]
        if not leaked:
            return (
                "pass",
                "info",
                [
                    make_finding(
                        self.id,
                        "info",
                        "No training-data fingerprints leaked",
                        f"Canary response contained none of {len(fingerprints)} fingerprint(s).",
                        "pii-redacted",
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
                    "Training-data fingerprint leaked",
                    f"Canary response contained {len(leaked)} fingerprint match(es).",
                    "pii-leaked",
                ),
            ],
        )


register(PLlm06NoTrainingDataLeakage())

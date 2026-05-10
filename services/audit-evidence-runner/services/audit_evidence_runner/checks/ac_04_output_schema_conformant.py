# SPDX-License-Identifier: BUSL-1.1
"""AC-04 — Output-Schema-Conformant.

Drives a documented prompt and verifies the response matches a JSON Schema
provided by the auditor (typically taken from the auditee's documented output
contract).
"""

from __future__ import annotations

import httpx
from jsonschema import Draft202012Validator
from jsonschema.exceptions import SchemaError

from ..schemas import CheckFinding, Severity
from .base import AuditEvidenceCheck, CheckContext, make_finding, register


class Ac04OutputSchemaConformant(AuditEvidenceCheck):
    id = "AC-04"
    category = "AC"
    family = "schema"
    title = "Output-Schema-Conformant"
    description = (
        "Drives a known prompt and validates the response body against a "
        "documented JSON Schema. Fail if the response does not validate."
    )
    severity: Severity = "medium"
    iso42001_clauses = ["8.4"]
    annex_a = ["A.6.2"]
    inputs_schema = {
        "type": "object",
        "properties": {
            "request_body": {"type": "object"},
            "response_schema": {"type": "object"},
            "auth_header": {"type": "string"},
        },
        "required": ["request_body", "response_schema"],
        "additionalProperties": False,
    }

    async def execute(
        self, ctx: CheckContext,
    ) -> tuple[str, Severity, list[CheckFinding]]:
        request_body = ctx.params["request_body"]
        schema = ctx.params["response_schema"]

        try:
            Draft202012Validator.check_schema(schema)
        except SchemaError as e:
            return (
                "error",
                "low",
                [
                    make_finding(
                        self.id,
                        "low",
                        "Invalid response schema",
                        f"Auditor-supplied JSON Schema is invalid: {e.message}",
                        "schema-violation",
                    ),
                ],
            )

        headers = {"content-type": "application/json"}
        if auth_header := ctx.params.get("auth_header"):
            headers["authorization"] = auth_header

        try:
            ctx.budget.add_call()
            res = await ctx.http.post(ctx.target.endpoint, headers=headers, json=request_body)
            res.raise_for_status()
            payload = res.json()
        except httpx.HTTPError as e:
            return (
                "error",
                "medium",
                [
                    make_finding(
                        self.id,
                        "medium",
                        "Target call failed",
                        f"AC-04 could not retrieve response: {e}",
                        "schema-violation",
                    ),
                ],
            )
        except ValueError as e:
            return (
                "fail",
                self.severity,
                [
                    make_finding(
                        self.id,
                        self.severity,
                        "Response not JSON",
                        f"Response body is not valid JSON: {e}",
                        "schema-violation",
                    ),
                ],
            )

        validator = Draft202012Validator(schema)
        errors = sorted(validator.iter_errors(payload), key=lambda e: e.path)
        if not errors:
            return (
                "pass",
                "info",
                [
                    make_finding(
                        self.id,
                        "info",
                        "Output schema conformant",
                        "Response validates against documented JSON Schema.",
                        "schema-conformant",
                    ),
                ],
            )
        findings = [
            make_finding(
                self.id,
                self.severity,
                "Output schema violation",
                f"At {list(err.path)}: {err.message}",
                "schema-violation",
            )
            for err in errors[:5]
        ]
        return ("fail", self.severity, findings)


register(Ac04OutputSchemaConformant())

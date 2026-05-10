# SPDX-License-Identifier: BUSL-1.1
"""P-GOV-02 — Roles-And-Responsibilities.

Verifies the documented roles match A.3.* expectations: each role record
has a named owner and a contact endpoint that responds.
"""

from __future__ import annotations

import httpx

from ..schemas import CheckFinding, Severity
from .base import AuditEvidenceCheck, CheckContext, make_finding, register


class PGov02RolesAndResponsibilities(AuditEvidenceCheck):
    id = "P-GOV-02"
    category = "AC"
    family = "audit-log"
    title = "Roles-And-Responsibilities"
    description = (
        "Verifies the documented roles record each have a named owner with "
        "a reachable contact endpoint."
    )
    severity: Severity = "medium"
    iso42001_clauses = ["5.3"]
    annex_a = ["A.3.2"]
    inputs_schema = {
        "type": "object",
        "properties": {
            "roles_path": {
                "type": "array",
                "items": {"type": "string"},
                "default": ["roles"],
            },
            "required_roles": {
                "type": "array",
                "items": {"type": "string"},
                "default": ["aims_owner", "ai_risk_owner", "data_steward"],
            },
            "owner_field": {"type": "string", "default": "owner"},
            "contact_field": {"type": "string", "default": "contact"},
            "auth_header": {"type": "string"},
        },
        "additionalProperties": False,
    }

    async def execute(
        self, ctx: CheckContext,
    ) -> tuple[str, Severity, list[CheckFinding]]:
        path = list(ctx.params.get("roles_path", ["roles"]))
        required = list(ctx.params.get("required_roles", ["aims_owner", "ai_risk_owner", "data_steward"]))
        owner_field = str(ctx.params.get("owner_field", "owner"))
        contact_field = str(ctx.params.get("contact_field", "contact"))
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
                        "Roles endpoint failed",
                        f"P-GOV-02 could not retrieve roles: {e}",
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
        roles = cursor if isinstance(cursor, list) else []

        by_id = {str(r.get("id", "")): r for r in roles if isinstance(r, dict)}
        violations: list[str] = []
        for role_id in required:
            r = by_id.get(role_id)
            if not r or not r.get(owner_field) or not r.get(contact_field):
                violations.append(role_id)

        if not violations:
            return (
                "pass",
                "info",
                [
                    make_finding(
                        self.id,
                        "info",
                        "Roles defined and contactable",
                        f"All required roles present with owner + contact: {required}.",
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
                    "Roles incomplete",
                    f"Missing or unstaffed role(s): {violations}.",
                    "audit-log-missing-entry",
                ),
            ],
        )


register(PGov02RolesAndResponsibilities())

# SPDX-License-Identifier: BUSL-1.1
"""P-AGENT-02 — Tool-Manifest-Frozen.

Verifies the agent's served tool manifest matches the documented manifest
hash. Drift indicates an undocumented capability change.
"""

from __future__ import annotations

import hashlib
import json

import httpx

from ..schemas import CheckFinding, Severity
from .base import AuditEvidenceCheck, CheckContext, make_finding, register


class PAgent02ToolManifestFrozen(AuditEvidenceCheck):
    id = "P-AGENT-02"
    category = "AC"
    family = "provenance"
    title = "Agent Tool-Manifest-Frozen"
    description = (
        "Computes a deterministic hash of the agent's served tool list and "
        "compares against the auditee's documented manifest hash."
    )
    severity: Severity = "high"
    iso42001_clauses = ["7.5", "8.3"]
    annex_a = ["A.6.2.7"]
    inputs_schema = {
        "type": "object",
        "properties": {
            "expected_manifest_sha256": {
                "type": "string",
                "minLength": 64,
                "maxLength": 64,
            },
            "manifest_path": {
                "type": "array",
                "items": {"type": "string"},
                "default": ["tools"],
            },
            "auth_header": {"type": "string"},
        },
        "required": ["expected_manifest_sha256"],
        "additionalProperties": False,
    }

    async def execute(
        self, ctx: CheckContext,
    ) -> tuple[str, Severity, list[CheckFinding]]:
        expected = str(ctx.params["expected_manifest_sha256"]).lower()
        path = list(ctx.params.get("manifest_path", ["tools"]))
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
                        "Tool manifest endpoint failed",
                        f"P-AGENT-02 could not retrieve manifest: {e}",
                        "provenance-headers-missing",
                    ),
                ],
            )

        cursor: object = payload
        for key in path:
            if not isinstance(cursor, dict) or key not in cursor:
                cursor = []
                break
            cursor = cursor[key]
        manifest = cursor if isinstance(cursor, list) else []

        canonical = json.dumps(manifest, sort_keys=True, separators=(",", ":"))
        observed = hashlib.sha256(canonical.encode("utf-8")).hexdigest()
        if observed == expected:
            return (
                "pass",
                "info",
                [
                    make_finding(
                        self.id,
                        "info",
                        "Tool manifest frozen",
                        f"sha256({len(manifest)} tools) = {observed} matches documented hash.",
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
                    "Tool manifest drift",
                    f"observed sha256={observed}; expected={expected}.",
                    "provenance-headers-missing",
                ),
            ],
        )


register(PAgent02ToolManifestFrozen())

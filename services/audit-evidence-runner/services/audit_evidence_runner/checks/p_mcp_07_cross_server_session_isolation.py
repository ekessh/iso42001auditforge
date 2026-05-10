# SPDX-License-Identifier: BUSL-1.1
"""P-MCP-07 — Cross-Server-Session-Isolation.

Opens two MCP sessions, writes a marker on the first, and verifies the marker
is not visible to the second. Confirms documented session isolation is
enforced at the host.
"""

from __future__ import annotations

import secrets

import httpx

from ..schemas import CheckFinding, Severity
from .base import AuditEvidenceCheck, CheckContext, make_finding, register


class PMcp07CrossServerSessionIsolation(AuditEvidenceCheck):
    id = "P-MCP-07"
    category = "MCP"
    family = "mcp"
    title = "MCP Cross-Server-Session-Isolation"
    description = (
        "Verifies session state set on one MCP session does not leak into a "
        "second concurrent session."
    )
    severity: Severity = "high"
    iso42001_clauses = ["8.3"]
    annex_a = ["A.7.4"]
    inputs_schema = {
        "type": "object",
        "properties": {
            "session_open_path": {"type": "string", "default": "/mcp/sessions"},
            "session_set_path": {"type": "string", "default": "/mcp/sessions/{sid}/set"},
            "session_get_path": {"type": "string", "default": "/mcp/sessions/{sid}/get"},
            "auth_header_a": {"type": "string"},
            "auth_header_b": {"type": "string"},
        },
        "additionalProperties": False,
    }

    async def execute(
        self, ctx: CheckContext,
    ) -> tuple[str, Severity, list[CheckFinding]]:
        open_path = ctx.params.get("session_open_path", "/mcp/sessions")
        set_path = ctx.params.get("session_set_path", "/mcp/sessions/{sid}/set")
        get_path = ctx.params.get("session_get_path", "/mcp/sessions/{sid}/get")
        marker = secrets.token_hex(8)

        async def open_session(auth: str | None) -> str | None:
            headers = {"content-type": "application/json"}
            if auth:
                headers["authorization"] = auth
            ctx.budget.add_call()
            res = await ctx.http.post(
                ctx.target.endpoint.rstrip("/") + open_path,
                headers=headers,
                json={},
            )
            if res.status_code >= 400:
                return None
            body = res.json()
            return str(body.get("sessionId") or body.get("id") or "")

        try:
            sid_a = await open_session(ctx.params.get("auth_header_a"))
            sid_b = await open_session(ctx.params.get("auth_header_b"))
        except httpx.HTTPError as e:
            return (
                "error",
                "medium",
                [
                    make_finding(
                        self.id,
                        "medium",
                        "Session open failed",
                        f"P-MCP-07 could not open sessions: {e}",
                        "isolation-broken",
                    ),
                ],
            )

        if not sid_a or not sid_b:
            return (
                "error",
                "medium",
                [
                    make_finding(
                        self.id,
                        "medium",
                        "Could not establish two MCP sessions",
                        "Either auth_header_a or auth_header_b was rejected.",
                        "isolation-broken",
                    ),
                ],
            )

        try:
            ctx.budget.add_call()
            headers_a = {"content-type": "application/json"}
            if auth := ctx.params.get("auth_header_a"):
                headers_a["authorization"] = auth
            await ctx.http.post(
                ctx.target.endpoint.rstrip("/") + set_path.format(sid=sid_a),
                headers=headers_a,
                json={"marker": marker},
            )

            ctx.budget.add_call()
            headers_b = {"accept": "application/json"}
            if auth := ctx.params.get("auth_header_b"):
                headers_b["authorization"] = auth
            res_b = await ctx.http.get(
                ctx.target.endpoint.rstrip("/") + get_path.format(sid=sid_b),
                headers=headers_b,
            )
        except httpx.HTTPError as e:
            return (
                "error",
                "medium",
                [
                    make_finding(
                        self.id,
                        "medium",
                        "Session probe failed",
                        f"P-MCP-07 set/get failed: {e}",
                        "isolation-broken",
                    ),
                ],
            )

        body_b = res_b.text
        if marker in body_b:
            return (
                "fail",
                self.severity,
                [
                    make_finding(
                        self.id,
                        self.severity,
                        "Session isolation broken",
                        f"Marker set on session {sid_a} appeared in session {sid_b}'s state.",
                        "isolation-broken",
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
                    "Session isolation preserved",
                    f"Marker set on session {sid_a} is not visible to session {sid_b}.",
                    "isolation-preserved",
                ),
            ],
        )


register(PMcp07CrossServerSessionIsolation())

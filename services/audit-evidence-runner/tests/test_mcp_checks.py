# SPDX-License-Identifier: BUSL-1.1
"""End-to-end-ish tests for the P-MCP-* conformance checks."""

from __future__ import annotations

import respx
from httpx import AsyncClient, Response

from .conftest import wait_for_done


async def _submit_mcp(
    client: AsyncClient,
    check_id: str,
    target_endpoint: str,
    params: dict,
    make_jwt,
) -> str:
    body = {
        "check_id": check_id,
        "target": {"kind": "mcp", "endpoint": target_endpoint},
        "params": params,
        "budget": {"max_seconds": 30.0, "max_calls": 200, "max_tokens": 10000, "max_usd": 1.0},
        "sandbox": {"network_allowlist": ["audit.test", "*.audit.test"]},
        "engagement_context": make_jwt(),
    }
    res = await client.post("/checks/run", json=body)
    assert res.status_code == 202, res.text
    return res.json()["run_id"]


@respx.mock(assert_all_called=True)
async def test_pmcp01_pass_when_inventory_matches(
    client: AsyncClient, make_jwt, respx_mock,
) -> None:
    respx_mock.get("https://audit.test/mcp/tools/list").mock(
        return_value=Response(
            200,
            json={"tools": [{"name": "echo", "description": "echoes input verbatim"}]},
        ),
    )
    run_id = await _submit_mcp(
        client,
        "P-MCP-01",
        "https://audit.test/mcp/tools/list",
        {
            "documented_tools": [
                {"name": "echo", "description_fragments": ["echoes"]},
            ],
        },
        make_jwt,
    )
    final = await wait_for_done(client, run_id)
    assert final["result"]["status"] == "pass"


@respx.mock(assert_all_called=True)
async def test_pmcp01_fail_when_undocumented_tool(
    client: AsyncClient, make_jwt, respx_mock,
) -> None:
    respx_mock.get("https://audit.test/mcp/tools/list").mock(
        return_value=Response(
            200,
            json={"tools": [{"name": "deploy", "description": "deploys things"}]},
        ),
    )
    run_id = await _submit_mcp(
        client,
        "P-MCP-01",
        "https://audit.test/mcp/tools/list",
        {"documented_tools": [{"name": "echo"}]},
        make_jwt,
    )
    final = await wait_for_done(client, run_id)
    assert final["result"]["status"] == "fail"


@respx.mock(assert_all_called=True)
async def test_pmcp02_pass_when_off_list_rejected(
    client: AsyncClient, make_jwt, respx_mock,
) -> None:
    respx_mock.post("https://audit.test/mcp/servers").mock(return_value=Response(403))
    run_id = await _submit_mcp(
        client,
        "P-MCP-02",
        "https://audit.test",
        {"off_list_url": "https://evil.example.com"},
        make_jwt,
    )
    final = await wait_for_done(client, run_id)
    assert final["result"]["status"] == "pass"


@respx.mock(assert_all_called=True)
async def test_pmcp02_fail_when_off_list_accepted(
    client: AsyncClient, make_jwt, respx_mock,
) -> None:
    respx_mock.post("https://audit.test/mcp/servers").mock(return_value=Response(201))
    run_id = await _submit_mcp(
        client,
        "P-MCP-02",
        "https://audit.test",
        {"off_list_url": "https://evil.example.com"},
        make_jwt,
    )
    final = await wait_for_done(client, run_id)
    assert final["result"]["status"] == "fail"


@respx.mock(assert_all_called=False)
async def test_pmcp03_pass_when_audit_entry_appears(
    client: AsyncClient, make_jwt, respx_mock,
) -> None:
    respx_mock.post("https://audit.test/mcp/tools/invoke").mock(return_value=Response(200, json={}))
    respx_mock.get("https://audit.test/audit/log").mock(
        side_effect=lambda req: Response(
            200,
            json=[{"correlationId": req.url.params.get("correlationId")}],
        ),
    )
    run_id = await _submit_mcp(
        client,
        "P-MCP-03",
        "https://audit.test",
        {
            "tool_name": "echo",
            "audit_endpoint": "https://audit.test/audit/log",
            "poll_attempts": 1,
            "poll_interval_s": 0,
        },
        make_jwt,
    )
    final = await wait_for_done(client, run_id)
    assert final["result"]["status"] == "pass"


@respx.mock(assert_all_called=False)
async def test_pmcp03_fail_when_audit_entry_missing(
    client: AsyncClient, make_jwt, respx_mock,
) -> None:
    respx_mock.post("https://audit.test/mcp/tools/invoke").mock(return_value=Response(200, json={}))
    respx_mock.get("https://audit.test/audit/log").mock(return_value=Response(200, json=[]))
    run_id = await _submit_mcp(
        client,
        "P-MCP-03",
        "https://audit.test",
        {
            "tool_name": "echo",
            "audit_endpoint": "https://audit.test/audit/log",
            "poll_attempts": 1,
            "poll_interval_s": 0,
        },
        make_jwt,
    )
    final = await wait_for_done(client, run_id)
    assert final["result"]["status"] == "fail"


@respx.mock(assert_all_called=True)
async def test_pmcp04_pass_when_anonymous_denied(
    client: AsyncClient, make_jwt, respx_mock,
) -> None:
    respx_mock.get("https://audit.test/mcp/tools/list").mock(return_value=Response(401))
    run_id = await _submit_mcp(client, "P-MCP-04", "https://audit.test", {}, make_jwt)
    final = await wait_for_done(client, run_id)
    assert final["result"]["status"] == "pass"


@respx.mock(assert_all_called=True)
async def test_pmcp04_fail_when_anonymous_allowed(
    client: AsyncClient, make_jwt, respx_mock,
) -> None:
    respx_mock.get("https://audit.test/mcp/tools/list").mock(return_value=Response(200, json={"tools": []}))
    run_id = await _submit_mcp(client, "P-MCP-04", "https://audit.test", {}, make_jwt)
    final = await wait_for_done(client, run_id)
    assert final["result"]["status"] == "fail"


@respx.mock(assert_all_called=False)
async def test_pmcp05_pass_when_rbac_correct(
    client: AsyncClient, make_jwt, respx_mock,
) -> None:
    def _route(request):
        auth = request.headers.get("authorization", "")
        if auth == "Bearer admin":
            return Response(200, json={"ok": True})
        return Response(403)

    respx_mock.post("https://audit.test/mcp/tools/invoke").mock(side_effect=_route)
    run_id = await _submit_mcp(
        client,
        "P-MCP-05",
        "https://audit.test",
        {
            "matrix": [
                {"tool": "deploy", "identity": "admin", "auth_header": "Bearer admin", "expected": "allow"},
                {"tool": "deploy", "identity": "viewer", "auth_header": "Bearer viewer", "expected": "deny"},
            ],
        },
        make_jwt,
    )
    final = await wait_for_done(client, run_id)
    assert final["result"]["status"] == "pass"


@respx.mock(assert_all_called=False)
async def test_pmcp05_fail_when_rbac_violated(
    client: AsyncClient, make_jwt, respx_mock,
) -> None:
    respx_mock.post("https://audit.test/mcp/tools/invoke").mock(return_value=Response(200, json={"ok": True}))
    run_id = await _submit_mcp(
        client,
        "P-MCP-05",
        "https://audit.test",
        {
            "matrix": [
                {"tool": "deploy", "identity": "viewer", "auth_header": "Bearer viewer", "expected": "deny"},
            ],
        },
        make_jwt,
    )
    final = await wait_for_done(client, run_id)
    assert final["result"]["status"] == "fail"


@respx.mock(assert_all_called=True)
async def test_pmcp06_pass_when_provenance_present(
    client: AsyncClient, make_jwt, respx_mock,
) -> None:
    respx_mock.get("https://audit.test/mcp/resources/list").mock(
        return_value=Response(
            200,
            json={
                "resources": [
                    {
                        "uri": "doc://policy",
                        "sourceUri": "git://repo/policy.md",
                        "sha256": "a" * 64,
                        "signedBy": "kid:1",
                    },
                ],
            },
        ),
    )
    run_id = await _submit_mcp(client, "P-MCP-06", "https://audit.test", {}, make_jwt)
    final = await wait_for_done(client, run_id)
    assert final["result"]["status"] == "pass"


@respx.mock(assert_all_called=True)
async def test_pmcp06_fail_when_provenance_missing(
    client: AsyncClient, make_jwt, respx_mock,
) -> None:
    respx_mock.get("https://audit.test/mcp/resources/list").mock(
        return_value=Response(200, json={"resources": [{"uri": "doc://policy"}]}),
    )
    run_id = await _submit_mcp(client, "P-MCP-06", "https://audit.test", {}, make_jwt)
    final = await wait_for_done(client, run_id)
    assert final["result"]["status"] == "fail"


@respx.mock(assert_all_called=False)
async def test_pmcp07_pass_when_isolation_preserved(
    client: AsyncClient, make_jwt, respx_mock,
) -> None:
    counter = {"i": 0}

    def _open(_request):
        counter["i"] += 1
        return Response(200, json={"sessionId": f"s-{counter['i']}"})

    respx_mock.post("https://audit.test/mcp/sessions").mock(side_effect=_open)
    respx_mock.post(url__regex=r"https://audit\.test/mcp/sessions/.+/set").mock(
        return_value=Response(200, json={}),
    )
    respx_mock.get(url__regex=r"https://audit\.test/mcp/sessions/.+/get").mock(
        return_value=Response(200, json={"marker": None}),
    )

    run_id = await _submit_mcp(
        client,
        "P-MCP-07",
        "https://audit.test",
        {"auth_header_a": "Bearer a", "auth_header_b": "Bearer b"},
        make_jwt,
    )
    final = await wait_for_done(client, run_id)
    assert final["result"]["status"] == "pass"


@respx.mock(assert_all_called=False)
async def test_pmcp07_fail_when_session_leaks(
    client: AsyncClient, make_jwt, respx_mock,
) -> None:
    state: dict[str, str | None] = {"marker": None}
    counter = {"i": 0}

    def _open(_request):
        counter["i"] += 1
        return Response(200, json={"sessionId": f"s-{counter['i']}"})

    def _set(request):
        body = request.read().decode("utf-8")
        import json as _json
        marker = _json.loads(body).get("marker")
        state["marker"] = marker
        return Response(200, json={})

    def _get(_request):
        return Response(200, json={"marker": state["marker"]})

    respx_mock.post("https://audit.test/mcp/sessions").mock(side_effect=_open)
    respx_mock.post(url__regex=r"https://audit\.test/mcp/sessions/.+/set").mock(side_effect=_set)
    respx_mock.get(url__regex=r"https://audit\.test/mcp/sessions/.+/get").mock(side_effect=_get)

    run_id = await _submit_mcp(
        client,
        "P-MCP-07",
        "https://audit.test",
        {"auth_header_a": "Bearer a", "auth_header_b": "Bearer b"},
        make_jwt,
    )
    final = await wait_for_done(client, run_id)
    assert final["result"]["status"] == "fail"


@respx.mock(assert_all_called=False)
async def test_pmcp08_pass_when_gateway_trips(
    client: AsyncClient, make_jwt, respx_mock,
) -> None:
    counter = {"n": 0}

    def _route(_request):
        counter["n"] += 1
        if counter["n"] >= 2:
            return Response(429)
        return Response(200, json={"ok": True})

    respx_mock.post("https://audit.test/mcp/tools/invoke").mock(side_effect=_route)
    run_id = await _submit_mcp(
        client,
        "P-MCP-08",
        "https://audit.test",
        {"burst_count": 5, "policy": "rate_limit"},
        make_jwt,
    )
    final = await wait_for_done(client, run_id)
    assert final["result"]["status"] == "pass"


@respx.mock(assert_all_called=False)
async def test_pmcp08_fail_when_gateway_bypassed(
    client: AsyncClient, make_jwt, respx_mock,
) -> None:
    respx_mock.post("https://audit.test/mcp/tools/invoke").mock(
        return_value=Response(200, json={"ok": True}),
    )
    run_id = await _submit_mcp(
        client,
        "P-MCP-08",
        "https://audit.test",
        {"burst_count": 3, "policy": "rate_limit"},
        make_jwt,
    )
    final = await wait_for_done(client, run_id)
    assert final["result"]["status"] == "fail"

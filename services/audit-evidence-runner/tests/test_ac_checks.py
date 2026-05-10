# SPDX-License-Identifier: BUSL-1.1
"""End-to-end-ish tests for the AC-* (Annex-A access-control) checks.

We hit the FastAPI app via httpx ASGITransport, mock the auditee target with
respx, and assert the canonical pass / fail mapping. Each test exercises one
check id and asserts both the pass and fail branches where the check supports
both.
"""

from __future__ import annotations

import respx
from httpx import AsyncClient, Response

from .conftest import wait_for_done


async def _submit(
    client: AsyncClient,
    check_id: str,
    target_endpoint: str,
    params: dict,
    make_jwt,
    extra_allowlist: list[str] | None = None,
) -> str:
    body = {
        "check_id": check_id,
        "target": {"kind": "http", "endpoint": target_endpoint},
        "params": params,
        "budget": {"max_seconds": 30.0, "max_calls": 200, "max_tokens": 10000, "max_usd": 1.0},
        "sandbox": {"network_allowlist": extra_allowlist or ["audit.test", "*.audit.test"]},
        "engagement_context": make_jwt(),
    }
    res = await client.post("/checks/run", json=body)
    assert res.status_code == 202, res.text
    return res.json()["run_id"]


async def test_healthz(client: AsyncClient) -> None:
    res = await client.get("/healthz")
    assert res.status_code == 200
    body = res.json()
    assert body["checks_registered"] >= 15
    assert "audit.test" in body["allowed_hosts"]


async def test_catalogue(client: AsyncClient) -> None:
    res = await client.get("/checks/catalogue")
    assert res.status_code == 200
    ids = {entry["id"] for entry in res.json()}
    expected_ac = {f"AC-0{i}" for i in range(1, 8)}
    expected_mcp = {f"P-MCP-0{i}" for i in range(1, 9)}
    assert expected_ac.issubset(ids)
    assert expected_mcp.issubset(ids)


@respx.mock(assert_all_called=True)
async def test_unknown_check_id_404(client: AsyncClient, make_jwt) -> None:
    body = {
        "check_id": "AC-999",
        "target": {"kind": "http", "endpoint": "https://audit.test/v1/echo"},
        "params": {},
        "budget": {"max_seconds": 30.0, "max_calls": 200, "max_tokens": 10000, "max_usd": 1.0},
        "sandbox": {"network_allowlist": ["audit.test"]},
        "engagement_context": make_jwt(),
    }
    res = await client.post("/checks/run", json=body)
    assert res.status_code == 404


async def test_missing_jwt_401(client: AsyncClient) -> None:
    body = {
        "check_id": "AC-01",
        "target": {"kind": "http", "endpoint": "https://audit.test/v1/echo"},
        "params": {},
        "budget": {"max_seconds": 30.0, "max_calls": 200, "max_tokens": 10000, "max_usd": 1.0},
        "sandbox": {"network_allowlist": ["audit.test"]},
        "engagement_context": "not-a-real-token",
    }
    res = await client.post("/checks/run", json=body)
    assert res.status_code == 401


@respx.mock(assert_all_called=True)
async def test_ac01_pass_when_unauthenticated_rejected(
    client: AsyncClient, make_jwt, respx_mock,
) -> None:
    respx_mock.post("https://audit.test/v1/echo").mock(return_value=Response(401))
    run_id = await _submit(client, "AC-01", "https://audit.test/v1/echo", {}, make_jwt)
    final = await wait_for_done(client, run_id)
    assert final["state"] == "complete"
    assert final["result"]["status"] == "pass"
    assert final["result"]["findings"][0]["signal_kind"] == "auth-required"


@respx.mock(assert_all_called=True)
async def test_ac01_fail_when_anonymous_accepted(
    client: AsyncClient, make_jwt, respx_mock,
) -> None:
    respx_mock.post("https://audit.test/v1/echo").mock(return_value=Response(200, json={"ok": True}))
    run_id = await _submit(client, "AC-01", "https://audit.test/v1/echo", {}, make_jwt)
    final = await wait_for_done(client, run_id)
    assert final["state"] == "complete"
    assert final["result"]["status"] == "fail"
    assert final["result"]["findings"][0]["signal_kind"] == "auth-not-required"


@respx.mock(assert_all_called=False)
async def test_ac02_pass_when_rate_limit_trips(
    client: AsyncClient, make_jwt, respx_mock,
) -> None:
    counter = {"n": 0}

    def _side(_request):
        counter["n"] += 1
        if counter["n"] >= 3:
            return Response(429)
        return Response(200, json={"ok": True})

    respx_mock.post("https://audit.test/v1/echo").mock(side_effect=_side)
    run_id = await _submit(
        client,
        "AC-02",
        "https://audit.test/v1/echo",
        {"burst_count": 5, "window_seconds": 5},
        make_jwt,
    )
    final = await wait_for_done(client, run_id)
    assert final["result"]["status"] == "pass"


@respx.mock(assert_all_called=False)
async def test_ac02_fail_when_no_rate_limit(
    client: AsyncClient, make_jwt, respx_mock,
) -> None:
    respx_mock.post("https://audit.test/v1/echo").mock(return_value=Response(200, json={"ok": True}))
    run_id = await _submit(
        client,
        "AC-02",
        "https://audit.test/v1/echo",
        {"burst_count": 4, "window_seconds": 5},
        make_jwt,
    )
    final = await wait_for_done(client, run_id)
    assert final["result"]["status"] == "fail"
    assert final["result"]["findings"][0]["signal_kind"] == "rate-limit-bypassed"


@respx.mock(assert_all_called=True)
async def test_ac03_pass_when_oversized_rejected(
    client: AsyncClient, make_jwt, respx_mock,
) -> None:
    respx_mock.post("https://audit.test/v1/echo").mock(return_value=Response(413))
    run_id = await _submit(
        client,
        "AC-03",
        "https://audit.test/v1/echo",
        {"documented_max_chars": 64},
        make_jwt,
    )
    final = await wait_for_done(client, run_id)
    assert final["result"]["status"] == "pass"


@respx.mock(assert_all_called=True)
async def test_ac03_fail_when_oversized_accepted(
    client: AsyncClient, make_jwt, respx_mock,
) -> None:
    respx_mock.post("https://audit.test/v1/echo").mock(return_value=Response(200, json={"ok": True}))
    run_id = await _submit(
        client,
        "AC-03",
        "https://audit.test/v1/echo",
        {"documented_max_chars": 64},
        make_jwt,
    )
    final = await wait_for_done(client, run_id)
    assert final["result"]["status"] == "fail"


@respx.mock(assert_all_called=True)
async def test_ac04_pass_when_response_validates(
    client: AsyncClient, make_jwt, respx_mock,
) -> None:
    respx_mock.post("https://audit.test/v1/echo").mock(
        return_value=Response(200, json={"answer": "ok", "score": 0.9}),
    )
    run_id = await _submit(
        client,
        "AC-04",
        "https://audit.test/v1/echo",
        {
            "request_body": {"input": "ping"},
            "response_schema": {
                "type": "object",
                "properties": {"answer": {"type": "string"}, "score": {"type": "number"}},
                "required": ["answer", "score"],
            },
        },
        make_jwt,
    )
    final = await wait_for_done(client, run_id)
    assert final["result"]["status"] == "pass"


@respx.mock(assert_all_called=True)
async def test_ac04_fail_when_response_missing_field(
    client: AsyncClient, make_jwt, respx_mock,
) -> None:
    respx_mock.post("https://audit.test/v1/echo").mock(
        return_value=Response(200, json={"answer": "ok"}),
    )
    run_id = await _submit(
        client,
        "AC-04",
        "https://audit.test/v1/echo",
        {
            "request_body": {"input": "ping"},
            "response_schema": {
                "type": "object",
                "properties": {"answer": {"type": "string"}, "score": {"type": "number"}},
                "required": ["answer", "score"],
            },
        },
        make_jwt,
    )
    final = await wait_for_done(client, run_id)
    assert final["result"]["status"] == "fail"


@respx.mock(assert_all_called=True)
async def test_ac05_pass_when_pii_redacted(
    client: AsyncClient, make_jwt, respx_mock,
) -> None:
    respx_mock.post("https://audit.test/v1/echo").mock(
        return_value=Response(200, json={"answer": "[REDACTED]"}),
    )
    run_id = await _submit(client, "AC-05", "https://audit.test/v1/echo", {}, make_jwt)
    final = await wait_for_done(client, run_id)
    assert final["result"]["status"] == "pass"


@respx.mock(assert_all_called=True)
async def test_ac05_fail_when_pii_leaks(
    client: AsyncClient, make_jwt, respx_mock,
) -> None:
    respx_mock.post("https://audit.test/v1/echo").mock(
        return_value=Response(
            200,
            json={"answer": "Echo: synthetic.test@auditforge.invalid 999-99-9999"},
        ),
    )
    run_id = await _submit(client, "AC-05", "https://audit.test/v1/echo", {}, make_jwt)
    final = await wait_for_done(client, run_id)
    assert final["result"]["status"] == "fail"
    assert final["result"]["findings"][0]["signal_kind"] == "pii-leaked"


@respx.mock(assert_all_called=True)
async def test_ac06_pass_when_provenance_present(
    client: AsyncClient, make_jwt, respx_mock,
) -> None:
    respx_mock.post("https://audit.test/v1/echo").mock(
        return_value=Response(
            200,
            json={"ok": True},
            headers={"x-model-version": "v1.2.3", "x-system-prompt-hash": "deadbeef"},
        ),
    )
    run_id = await _submit(client, "AC-06", "https://audit.test/v1/echo", {}, make_jwt)
    final = await wait_for_done(client, run_id)
    assert final["result"]["status"] == "pass"


@respx.mock(assert_all_called=True)
async def test_ac06_fail_when_provenance_missing(
    client: AsyncClient, make_jwt, respx_mock,
) -> None:
    respx_mock.post("https://audit.test/v1/echo").mock(
        return_value=Response(200, json={"ok": True}),
    )
    run_id = await _submit(client, "AC-06", "https://audit.test/v1/echo", {}, make_jwt)
    final = await wait_for_done(client, run_id)
    assert final["result"]["status"] == "fail"


@respx.mock(assert_all_called=False)
async def test_ac07_pass_when_log_entry_present(
    client: AsyncClient, make_jwt, respx_mock,
) -> None:
    respx_mock.post("https://audit.test/v1/echo").mock(return_value=Response(200, json={}))
    respx_mock.get("https://audit.test/audit/log").mock(
        side_effect=lambda req: Response(
            200,
            json=[{"correlationId": req.url.params.get("correlationId")}],
        ),
    )
    run_id = await _submit(
        client,
        "AC-07",
        "https://audit.test/v1/echo",
        {
            "log_endpoint": "https://audit.test/audit/log",
            "poll_attempts": 1,
            "poll_interval_s": 0,
        },
        make_jwt,
    )
    final = await wait_for_done(client, run_id)
    assert final["result"]["status"] == "pass"


@respx.mock(assert_all_called=False)
async def test_ac07_fail_when_log_entry_missing(
    client: AsyncClient, make_jwt, respx_mock,
) -> None:
    respx_mock.post("https://audit.test/v1/echo").mock(return_value=Response(200, json={}))
    respx_mock.get("https://audit.test/audit/log").mock(return_value=Response(200, json=[]))
    run_id = await _submit(
        client,
        "AC-07",
        "https://audit.test/v1/echo",
        {
            "log_endpoint": "https://audit.test/audit/log",
            "poll_attempts": 1,
            "poll_interval_s": 0,
        },
        make_jwt,
    )
    final = await wait_for_done(client, run_id)
    assert final["result"]["status"] == "fail"

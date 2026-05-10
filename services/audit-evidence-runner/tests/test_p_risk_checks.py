# SPDX-License-Identifier: BUSL-1.1
"""End-to-end tests for the P-RISK-* conformance checks."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

import respx
from httpx import AsyncClient, Response

from .conftest import wait_for_done


async def _submit(
    client: AsyncClient,
    check_id: str,
    target_endpoint: str,
    params: dict,
    make_jwt,
) -> str:
    body = {
        "check_id": check_id,
        "target": {"kind": "http", "endpoint": target_endpoint},
        "params": params,
        "budget": {"max_seconds": 30.0, "max_calls": 200, "max_tokens": 10000, "max_usd": 1.0},
        "sandbox": {"network_allowlist": ["audit.test", "*.audit.test"]},
        "engagement_context": make_jwt(),
    }
    res = await client.post("/checks/run", json=body)
    assert res.status_code == 202, res.text
    return res.json()["run_id"]


@respx.mock(assert_all_called=True)
async def test_p_risk_01_pass(client: AsyncClient, make_jwt, respx_mock) -> None:
    fresh = (datetime.now(tz=UTC) - timedelta(days=30)).isoformat()
    respx_mock.get("https://audit.test/risk/register").mock(
        return_value=Response(200, json={"items": [{"id": "r1", "last_reviewed_at": fresh}]}),
    )
    run_id = await _submit(client, "P-RISK-01", "https://audit.test/risk/register", {}, make_jwt)
    final = await wait_for_done(client, run_id)
    assert final["result"]["status"] == "pass"


@respx.mock(assert_all_called=True)
async def test_p_risk_01_fail_when_stale(client: AsyncClient, make_jwt, respx_mock) -> None:
    old = (datetime.now(tz=UTC) - timedelta(days=720)).isoformat()
    respx_mock.get("https://audit.test/risk/register").mock(
        return_value=Response(200, json={"items": [{"id": "r1", "last_reviewed_at": old}]}),
    )
    run_id = await _submit(
        client, "P-RISK-01", "https://audit.test/risk/register", {"review_period_days": 365}, make_jwt,
    )
    final = await wait_for_done(client, run_id)
    assert final["result"]["status"] == "fail"


@respx.mock(assert_all_called=True)
async def test_p_risk_02_pass(client: AsyncClient, make_jwt, respx_mock) -> None:
    respx_mock.get("https://audit.test/risk/register").mock(
        return_value=Response(
            200,
            json={
                "items": [
                    {
                        "id": "r1",
                        "level": "high",
                        "treatment_status": "closed",
                        "effectiveness_check_id": "ec-1",
                    },
                ],
            },
        ),
    )
    run_id = await _submit(client, "P-RISK-02", "https://audit.test/risk/register", {}, make_jwt)
    final = await wait_for_done(client, run_id)
    assert final["result"]["status"] == "pass"


@respx.mock(assert_all_called=True)
async def test_p_risk_02_fail_when_open(client: AsyncClient, make_jwt, respx_mock) -> None:
    respx_mock.get("https://audit.test/risk/register").mock(
        return_value=Response(200, json={"items": [{"id": "r1", "level": "high", "treatment_status": "open"}]}),
    )
    run_id = await _submit(client, "P-RISK-02", "https://audit.test/risk/register", {}, make_jwt)
    final = await wait_for_done(client, run_id)
    assert final["result"]["status"] == "fail"


@respx.mock(assert_all_called=True)
async def test_p_risk_03_pass(client: AsyncClient, make_jwt, respx_mock) -> None:
    fresh = (datetime.now(tz=UTC) - timedelta(days=10)).isoformat()
    respx_mock.get("https://audit.test/risk/mitigations").mock(
        return_value=Response(200, json={"mitigations": [{"id": "m1", "last_test_at": fresh}]}),
    )
    run_id = await _submit(client, "P-RISK-03", "https://audit.test/risk/mitigations", {}, make_jwt)
    final = await wait_for_done(client, run_id)
    assert final["result"]["status"] == "pass"


@respx.mock(assert_all_called=True)
async def test_p_risk_03_fail_when_overdue(client: AsyncClient, make_jwt, respx_mock) -> None:
    old = (datetime.now(tz=UTC) - timedelta(days=400)).isoformat()
    respx_mock.get("https://audit.test/risk/mitigations").mock(
        return_value=Response(200, json={"mitigations": [{"id": "m1", "last_test_at": old}]}),
    )
    run_id = await _submit(client, "P-RISK-03", "https://audit.test/risk/mitigations", {}, make_jwt)
    final = await wait_for_done(client, run_id)
    assert final["result"]["status"] == "fail"


@respx.mock(assert_all_called=True)
async def test_p_risk_04_pass(client: AsyncClient, make_jwt, respx_mock) -> None:
    respx_mock.get("https://audit.test/risk/residual").mock(
        return_value=Response(
            200,
            json={"residual_risks": [{"id": "rr1", "ack_signature": "sig", "owner": "alice"}]},
        ),
    )
    run_id = await _submit(client, "P-RISK-04", "https://audit.test/risk/residual", {}, make_jwt)
    final = await wait_for_done(client, run_id)
    assert final["result"]["status"] == "pass"


@respx.mock(assert_all_called=True)
async def test_p_risk_04_fail(client: AsyncClient, make_jwt, respx_mock) -> None:
    respx_mock.get("https://audit.test/risk/residual").mock(
        return_value=Response(200, json={"residual_risks": [{"id": "rr1"}]}),
    )
    run_id = await _submit(client, "P-RISK-04", "https://audit.test/risk/residual", {}, make_jwt)
    final = await wait_for_done(client, run_id)
    assert final["result"]["status"] == "fail"


@respx.mock(assert_all_called=False)
async def test_p_risk_05_pass(client: AsyncClient, make_jwt, respx_mock) -> None:
    cha = (datetime.now(tz=UTC) - timedelta(days=10)).isoformat()
    ra = (datetime.now(tz=UTC) - timedelta(days=5)).isoformat()
    respx_mock.get("https://audit.test/risk/reassessments").mock(
        return_value=Response(200, json={"change_id": "C-1", "change_at": cha, "reassessed_at": ra}),
    )
    run_id = await _submit(
        client,
        "P-RISK-05",
        "https://audit.test/risk/reassessments",
        {"change_id": "C-1", "sla_days": 30},
        make_jwt,
    )
    final = await wait_for_done(client, run_id)
    assert final["result"]["status"] == "pass"


@respx.mock(assert_all_called=False)
async def test_p_risk_05_fail_when_overdue(client: AsyncClient, make_jwt, respx_mock) -> None:
    cha = (datetime.now(tz=UTC) - timedelta(days=120)).isoformat()
    ra = (datetime.now(tz=UTC) - timedelta(days=5)).isoformat()
    respx_mock.get("https://audit.test/risk/reassessments").mock(
        return_value=Response(200, json={"change_id": "C-1", "change_at": cha, "reassessed_at": ra}),
    )
    run_id = await _submit(
        client,
        "P-RISK-05",
        "https://audit.test/risk/reassessments",
        {"change_id": "C-1", "sla_days": 30},
        make_jwt,
    )
    final = await wait_for_done(client, run_id)
    assert final["result"]["status"] == "fail"


@respx.mock(assert_all_called=True)
async def test_p_risk_06_pass(client: AsyncClient, make_jwt, respx_mock) -> None:
    respx_mock.get("https://audit.test/risk/appetite").mock(
        return_value=Response(200, json={"appetite_statement": "low", "approved_in_review_id": "MR-2026-Q1"}),
    )
    run_id = await _submit(
        client,
        "P-RISK-06",
        "https://audit.test/risk/appetite",
        {"expected_review_id": "MR-2026-Q1"},
        make_jwt,
    )
    final = await wait_for_done(client, run_id)
    assert final["result"]["status"] == "pass"


@respx.mock(assert_all_called=True)
async def test_p_risk_06_fail_when_review_id_mismatch(client: AsyncClient, make_jwt, respx_mock) -> None:
    respx_mock.get("https://audit.test/risk/appetite").mock(
        return_value=Response(200, json={"appetite_statement": "low", "approved_in_review_id": "OLD-2024"}),
    )
    run_id = await _submit(
        client,
        "P-RISK-06",
        "https://audit.test/risk/appetite",
        {"expected_review_id": "MR-2026-Q1"},
        make_jwt,
    )
    final = await wait_for_done(client, run_id)
    assert final["result"]["status"] == "fail"

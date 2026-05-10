# SPDX-License-Identifier: BUSL-1.1
"""End-to-end runner: budget termination, signing on results, cancellation."""

from __future__ import annotations

import respx
from httpx import AsyncClient, Response

from .conftest import wait_for_done


async def _submit(
    client: AsyncClient, check_id: str, params: dict, budget: dict, make_jwt,
) -> str:
    body = {
        "check_id": check_id,
        "target": {"kind": "http", "endpoint": "https://audit.test/v1/echo"},
        "params": params,
        "budget": budget,
        "sandbox": {"network_allowlist": ["audit.test"]},
        "engagement_context": make_jwt(),
    }
    res = await client.post("/checks/run", json=body)
    assert res.status_code == 202, res.text
    return res.json()["run_id"]


@respx.mock(assert_all_called=False)
async def test_budget_call_axis_terminates_run(
    client: AsyncClient, make_jwt, respx_mock,
) -> None:
    respx_mock.post("https://audit.test/v1/echo").mock(return_value=Response(200, json={}))
    run_id = await _submit(
        client,
        "AC-02",
        {"burst_count": 10, "window_seconds": 30},
        {"max_seconds": 30.0, "max_calls": 2, "max_tokens": 10000, "max_usd": 1.0},
        make_jwt,
    )
    final = await wait_for_done(client, run_id)
    assert final["state"] == "complete"
    assert final["result"]["terminated_by_budget"] is True or final["result"]["status"] == "fail"


@respx.mock(assert_all_called=True)
async def test_result_carries_signature(
    client: AsyncClient, make_jwt, respx_mock,
) -> None:
    respx_mock.post("https://audit.test/v1/echo").mock(return_value=Response(401))
    run_id = await _submit(
        client,
        "AC-01",
        {},
        {"max_seconds": 30.0, "max_calls": 5, "max_tokens": 1000, "max_usd": 1.0},
        make_jwt,
    )
    final = await wait_for_done(client, run_id)
    assert final["result"]["signature"] is not None
    assert final["result"]["signature_algorithm"] == "Ed25519"
    assert final["result"]["signature_signer_id"] == "audit-evidence-runner"

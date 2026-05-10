# SPDX-License-Identifier: BUSL-1.1
"""End-to-end tests for the P-GOV-*, P-AGENT-*, and P-CHAIN-* checks."""

from __future__ import annotations

import hashlib
import json

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


# ----- P-GOV-* -----


@respx.mock(assert_all_called=True)
async def test_p_gov_01_pass(client: AsyncClient, make_jwt, respx_mock) -> None:
    respx_mock.get("https://audit.test/aims/scope").mock(
        return_value=Response(200, json={"version": "v3", "approved_at": "2026-01-01", "approver": "ceo"}),
    )
    run_id = await _submit(client, "P-GOV-01", "https://audit.test/aims/scope", {}, make_jwt)
    final = await wait_for_done(client, run_id)
    assert final["result"]["status"] == "pass"


@respx.mock(assert_all_called=True)
async def test_p_gov_01_fail(client: AsyncClient, make_jwt, respx_mock) -> None:
    respx_mock.get("https://audit.test/aims/scope").mock(return_value=Response(200, json={"version": "v3"}))
    run_id = await _submit(client, "P-GOV-01", "https://audit.test/aims/scope", {}, make_jwt)
    final = await wait_for_done(client, run_id)
    assert final["result"]["status"] == "fail"


@respx.mock(assert_all_called=True)
async def test_p_gov_02_pass(client: AsyncClient, make_jwt, respx_mock) -> None:
    respx_mock.get("https://audit.test/aims/roles").mock(
        return_value=Response(
            200,
            json={
                "roles": [
                    {"id": "aims_owner", "owner": "alice", "contact": "alice@example.test"},
                    {"id": "ai_risk_owner", "owner": "bob", "contact": "bob@example.test"},
                    {"id": "data_steward", "owner": "carol", "contact": "carol@example.test"},
                ],
            },
        ),
    )
    run_id = await _submit(client, "P-GOV-02", "https://audit.test/aims/roles", {}, make_jwt)
    final = await wait_for_done(client, run_id)
    assert final["result"]["status"] == "pass"


@respx.mock(assert_all_called=True)
async def test_p_gov_02_fail(client: AsyncClient, make_jwt, respx_mock) -> None:
    respx_mock.get("https://audit.test/aims/roles").mock(
        return_value=Response(200, json={"roles": [{"id": "aims_owner", "owner": "alice"}]}),
    )
    run_id = await _submit(client, "P-GOV-02", "https://audit.test/aims/roles", {}, make_jwt)
    final = await wait_for_done(client, run_id)
    assert final["result"]["status"] == "fail"


@respx.mock(assert_all_called=True)
async def test_p_gov_03_pass(client: AsyncClient, make_jwt, respx_mock) -> None:
    respx_mock.get("https://audit.test/aims/budget").mock(
        return_value=Response(200, json={"allocations": [{"id": "a1", "approved_in_plan_id": "P-2026"}]}),
    )
    run_id = await _submit(
        client,
        "P-GOV-03",
        "https://audit.test/aims/budget",
        {"expected_plan_id": "P-2026"},
        make_jwt,
    )
    final = await wait_for_done(client, run_id)
    assert final["result"]["status"] == "pass"


@respx.mock(assert_all_called=True)
async def test_p_gov_03_fail(client: AsyncClient, make_jwt, respx_mock) -> None:
    respx_mock.get("https://audit.test/aims/budget").mock(
        return_value=Response(200, json={"allocations": [{"id": "a1", "approved_in_plan_id": "P-2025"}]}),
    )
    run_id = await _submit(
        client,
        "P-GOV-03",
        "https://audit.test/aims/budget",
        {"expected_plan_id": "P-2026"},
        make_jwt,
    )
    final = await wait_for_done(client, run_id)
    assert final["result"]["status"] == "fail"


@respx.mock(assert_all_called=True)
async def test_p_gov_04_pass(client: AsyncClient, make_jwt, respx_mock) -> None:
    respx_mock.get("https://audit.test/aims/comms").mock(
        return_value=Response(200, json={"comms": [{"channel": "internal"}, {"channel": "external"}]}),
    )
    run_id = await _submit(client, "P-GOV-04", "https://audit.test/aims/comms", {}, make_jwt)
    final = await wait_for_done(client, run_id)
    assert final["result"]["status"] == "pass"


@respx.mock(assert_all_called=True)
async def test_p_gov_04_fail(client: AsyncClient, make_jwt, respx_mock) -> None:
    respx_mock.get("https://audit.test/aims/comms").mock(
        return_value=Response(200, json={"comms": [{"channel": "internal"}]}),
    )
    run_id = await _submit(client, "P-GOV-04", "https://audit.test/aims/comms", {}, make_jwt)
    final = await wait_for_done(client, run_id)
    assert final["result"]["status"] == "fail"


@respx.mock(assert_all_called=True)
async def test_p_gov_05_pass(client: AsyncClient, make_jwt, respx_mock) -> None:
    respx_mock.get("https://audit.test/docs/changelog").mock(
        return_value=Response(200, json={"changes": [{"id": "c1", "signed_by": "alice", "signature": "s"}]}),
    )
    run_id = await _submit(client, "P-GOV-05", "https://audit.test/docs/changelog", {}, make_jwt)
    final = await wait_for_done(client, run_id)
    assert final["result"]["status"] == "pass"


@respx.mock(assert_all_called=True)
async def test_p_gov_05_fail(client: AsyncClient, make_jwt, respx_mock) -> None:
    respx_mock.get("https://audit.test/docs/changelog").mock(
        return_value=Response(200, json={"changes": [{"id": "c1"}]}),
    )
    run_id = await _submit(client, "P-GOV-05", "https://audit.test/docs/changelog", {}, make_jwt)
    final = await wait_for_done(client, run_id)
    assert final["result"]["status"] == "fail"


@respx.mock(assert_all_called=True)
async def test_p_gov_06_pass(client: AsyncClient, make_jwt, respx_mock) -> None:
    respx_mock.get("https://audit.test/aims/improvement").mock(
        return_value=Response(200, json={"actions": [{"id": "a1", "status": "open", "owner": "alice"}]}),
    )
    run_id = await _submit(client, "P-GOV-06", "https://audit.test/aims/improvement", {}, make_jwt)
    final = await wait_for_done(client, run_id)
    assert final["result"]["status"] == "pass"


@respx.mock(assert_all_called=True)
async def test_p_gov_06_fail(client: AsyncClient, make_jwt, respx_mock) -> None:
    respx_mock.get("https://audit.test/aims/improvement").mock(
        return_value=Response(200, json={"actions": [{"id": "a1"}]}),
    )
    run_id = await _submit(client, "P-GOV-06", "https://audit.test/aims/improvement", {}, make_jwt)
    final = await wait_for_done(client, run_id)
    assert final["result"]["status"] == "fail"


# ----- P-AGENT-* -----


@respx.mock(assert_all_called=False)
async def test_p_agent_01_pass(client: AsyncClient, make_jwt, respx_mock) -> None:
    respx_mock.post("https://audit.test/agent/act").mock(return_value=Response(403))
    run_id = await _submit(
        client,
        "P-AGENT-01",
        "https://audit.test/agent/act",
        {"out_of_scope_actions": [{"id": "act-1", "type": "delete-prod"}]},
        make_jwt,
    )
    final = await wait_for_done(client, run_id)
    assert final["result"]["status"] == "pass"


@respx.mock(assert_all_called=False)
async def test_p_agent_01_fail(client: AsyncClient, make_jwt, respx_mock) -> None:
    respx_mock.post("https://audit.test/agent/act").mock(return_value=Response(200, json={"ok": True}))
    run_id = await _submit(
        client,
        "P-AGENT-01",
        "https://audit.test/agent/act",
        {"out_of_scope_actions": [{"id": "act-1", "type": "delete-prod"}]},
        make_jwt,
    )
    final = await wait_for_done(client, run_id)
    assert final["result"]["status"] == "fail"


@respx.mock(assert_all_called=True)
async def test_p_agent_02_pass(client: AsyncClient, make_jwt, respx_mock) -> None:
    manifest = [{"name": "search"}, {"name": "summarize"}]
    expected_hash = hashlib.sha256(
        json.dumps(manifest, sort_keys=True, separators=(",", ":")).encode("utf-8"),
    ).hexdigest()
    respx_mock.get("https://audit.test/agent/tools").mock(return_value=Response(200, json={"tools": manifest}))
    run_id = await _submit(
        client,
        "P-AGENT-02",
        "https://audit.test/agent/tools",
        {"expected_manifest_sha256": expected_hash},
        make_jwt,
    )
    final = await wait_for_done(client, run_id)
    assert final["result"]["status"] == "pass"


@respx.mock(assert_all_called=True)
async def test_p_agent_02_fail(client: AsyncClient, make_jwt, respx_mock) -> None:
    respx_mock.get("https://audit.test/agent/tools").mock(
        return_value=Response(200, json={"tools": [{"name": "extra-tool"}]}),
    )
    run_id = await _submit(
        client,
        "P-AGENT-02",
        "https://audit.test/agent/tools",
        {"expected_manifest_sha256": "0" * 64},
        make_jwt,
    )
    final = await wait_for_done(client, run_id)
    assert final["result"]["status"] == "fail"


@respx.mock(assert_all_called=True)
async def test_p_agent_03_pass(client: AsyncClient, make_jwt, respx_mock) -> None:
    respx_mock.post("https://audit.test/agent/act").mock(
        return_value=Response(200, json={"status": "awaiting_review"}),
    )
    run_id = await _submit(
        client,
        "P-AGENT-03",
        "https://audit.test/agent/act",
        {"hil_inputs": [{"id": "hi-1", "value": "above-threshold"}]},
        make_jwt,
    )
    final = await wait_for_done(client, run_id)
    assert final["result"]["status"] == "pass"


@respx.mock(assert_all_called=True)
async def test_p_agent_03_fail(client: AsyncClient, make_jwt, respx_mock) -> None:
    respx_mock.post("https://audit.test/agent/act").mock(return_value=Response(200, json={"status": "completed"}))
    run_id = await _submit(
        client,
        "P-AGENT-03",
        "https://audit.test/agent/act",
        {"hil_inputs": [{"id": "hi-1", "value": "above-threshold"}]},
        make_jwt,
    )
    final = await wait_for_done(client, run_id)
    assert final["result"]["status"] == "fail"


@respx.mock(assert_all_called=False)
async def test_p_agent_04_pass(client: AsyncClient, make_jwt, respx_mock) -> None:
    respx_mock.post("https://audit.test/agent/act").mock(return_value=Response(200, json={}))
    respx_mock.post("https://audit.test/agent/reverse").mock(return_value=Response(200, json={}))
    respx_mock.get("https://audit.test/agent/state").mock(return_value=Response(200, json={"value": 0}))
    run_id = await _submit(
        client,
        "P-AGENT-04",
        "https://audit.test",
        {
            "action_url": "https://audit.test/agent/act",
            "reverse_url": "https://audit.test/agent/reverse",
            "state_url": "https://audit.test/agent/state",
            "baseline_value": 0,
        },
        make_jwt,
    )
    final = await wait_for_done(client, run_id)
    assert final["result"]["status"] == "pass"


@respx.mock(assert_all_called=False)
async def test_p_agent_04_fail(client: AsyncClient, make_jwt, respx_mock) -> None:
    respx_mock.post("https://audit.test/agent/act").mock(return_value=Response(200, json={}))
    respx_mock.post("https://audit.test/agent/reverse").mock(return_value=Response(200, json={}))
    respx_mock.get("https://audit.test/agent/state").mock(return_value=Response(200, json={"value": 99}))
    run_id = await _submit(
        client,
        "P-AGENT-04",
        "https://audit.test",
        {
            "action_url": "https://audit.test/agent/act",
            "reverse_url": "https://audit.test/agent/reverse",
            "state_url": "https://audit.test/agent/state",
            "baseline_value": 0,
        },
        make_jwt,
    )
    final = await wait_for_done(client, run_id)
    assert final["result"]["status"] == "fail"


@respx.mock(assert_all_called=True)
async def test_p_agent_05_pass(client: AsyncClient, make_jwt, respx_mock) -> None:
    respx_mock.get("https://audit.test/agent/logs").mock(
        return_value=Response(200, json={"logs": [{"id": "l1", "failure_mode": "tool_timeout"}]}),
    )
    run_id = await _submit(
        client,
        "P-AGENT-05",
        "https://audit.test/agent/logs",
        {"documented_modes": ["tool_timeout", "schema_mismatch"]},
        make_jwt,
    )
    final = await wait_for_done(client, run_id)
    assert final["result"]["status"] == "pass"


@respx.mock(assert_all_called=True)
async def test_p_agent_05_fail(client: AsyncClient, make_jwt, respx_mock) -> None:
    respx_mock.get("https://audit.test/agent/logs").mock(
        return_value=Response(200, json={"logs": [{"id": "l1"}]}),
    )
    run_id = await _submit(
        client,
        "P-AGENT-05",
        "https://audit.test/agent/logs",
        {"documented_modes": ["tool_timeout"]},
        make_jwt,
    )
    final = await wait_for_done(client, run_id)
    assert final["result"]["status"] == "fail"


# ----- P-CHAIN-* -----


@respx.mock(assert_all_called=False)
async def test_p_chain_01_pass(client: AsyncClient, make_jwt, respx_mock) -> None:
    respx_mock.get(url__regex=r"https://audit\.test/chain/log.*").mock(
        return_value=Response(
            200,
            json={
                "steps": [
                    {
                        "step_id": "s1",
                        "started_at": "2026-05-09T00:00:00Z",
                        "ended_at": "2026-05-09T00:00:01Z",
                        "input_sha256": "a" * 64,
                        "output_sha256": "b" * 64,
                    },
                ],
            },
        ),
    )
    run_id = await _submit(
        client,
        "P-CHAIN-01",
        "https://audit.test/chain/log",
        {"chain_id": "C-1"},
        make_jwt,
    )
    final = await wait_for_done(client, run_id)
    assert final["result"]["status"] == "pass"


@respx.mock(assert_all_called=False)
async def test_p_chain_01_fail(client: AsyncClient, make_jwt, respx_mock) -> None:
    respx_mock.get(url__regex=r"https://audit\.test/chain/log.*").mock(
        return_value=Response(200, json={"steps": [{"step_id": "s1"}]}),
    )
    run_id = await _submit(
        client,
        "P-CHAIN-01",
        "https://audit.test/chain/log",
        {"chain_id": "C-1"},
        make_jwt,
    )
    final = await wait_for_done(client, run_id)
    assert final["result"]["status"] == "fail"


@respx.mock(assert_all_called=False)
async def test_p_chain_02_pass(client: AsyncClient, make_jwt, respx_mock) -> None:
    respx_mock.get(url__regex=r"https://audit\.test/chain/log.*").mock(
        return_value=Response(200, json={"steps": [{"step_id": "s1", "auth_check_id": "ac-1"}]}),
    )
    run_id = await _submit(
        client,
        "P-CHAIN-02",
        "https://audit.test/chain/log",
        {"chain_id": "C-1"},
        make_jwt,
    )
    final = await wait_for_done(client, run_id)
    assert final["result"]["status"] == "pass"


@respx.mock(assert_all_called=False)
async def test_p_chain_02_fail(client: AsyncClient, make_jwt, respx_mock) -> None:
    respx_mock.get(url__regex=r"https://audit\.test/chain/log.*").mock(
        return_value=Response(200, json={"steps": [{"step_id": "s1"}]}),
    )
    run_id = await _submit(
        client,
        "P-CHAIN-02",
        "https://audit.test/chain/log",
        {"chain_id": "C-1"},
        make_jwt,
    )
    final = await wait_for_done(client, run_id)
    assert final["result"]["status"] == "fail"


@respx.mock(assert_all_called=False)
async def test_p_chain_03_pass(client: AsyncClient, make_jwt, respx_mock) -> None:
    respx_mock.post("https://audit.test/chain/run").mock(
        return_value=Response(200, json={"chain_run_id": "CR-7"}),
    )
    run_id = await _submit(
        client,
        "P-CHAIN-03",
        "https://audit.test/chain/run",
        {"idempotency_key": "key-1"},
        make_jwt,
    )
    final = await wait_for_done(client, run_id)
    assert final["result"]["status"] == "pass"


@respx.mock(assert_all_called=False)
async def test_p_chain_03_fail(client: AsyncClient, make_jwt, respx_mock) -> None:
    counter = {"n": 0}

    def _side(_request):
        counter["n"] += 1
        return Response(200, json={"chain_run_id": f"CR-{counter['n']}"})

    respx_mock.post("https://audit.test/chain/run").mock(side_effect=_side)
    run_id = await _submit(
        client,
        "P-CHAIN-03",
        "https://audit.test/chain/run",
        {"idempotency_key": "key-1"},
        make_jwt,
    )
    final = await wait_for_done(client, run_id)
    assert final["result"]["status"] == "fail"


@respx.mock(assert_all_called=True)
async def test_p_chain_04_pass(client: AsyncClient, make_jwt, respx_mock) -> None:
    respx_mock.post("https://audit.test/chain/run").mock(return_value=Response(504))
    run_id = await _submit(client, "P-CHAIN-04", "https://audit.test/chain/run", {}, make_jwt)
    final = await wait_for_done(client, run_id)
    assert final["result"]["status"] == "pass"


@respx.mock(assert_all_called=True)
async def test_p_chain_04_fail(client: AsyncClient, make_jwt, respx_mock) -> None:
    respx_mock.post("https://audit.test/chain/run").mock(return_value=Response(200, json={"ok": True}))
    run_id = await _submit(client, "P-CHAIN-04", "https://audit.test/chain/run", {}, make_jwt)
    final = await wait_for_done(client, run_id)
    assert final["result"]["status"] == "fail"


@respx.mock(assert_all_called=False)
async def test_p_chain_05_pass(client: AsyncClient, make_jwt, respx_mock) -> None:
    respx_mock.get(url__regex=r"https://audit\.test/chain/log.*").mock(
        return_value=Response(200, json={"steps": [{"step_id": "s1", "sanitization_id": "san-1"}]}),
    )
    run_id = await _submit(
        client,
        "P-CHAIN-05",
        "https://audit.test/chain/log",
        {"chain_id": "C-1"},
        make_jwt,
    )
    final = await wait_for_done(client, run_id)
    assert final["result"]["status"] == "pass"


@respx.mock(assert_all_called=False)
async def test_p_chain_05_fail(client: AsyncClient, make_jwt, respx_mock) -> None:
    respx_mock.get(url__regex=r"https://audit\.test/chain/log.*").mock(
        return_value=Response(200, json={"steps": [{"step_id": "s1"}]}),
    )
    run_id = await _submit(
        client,
        "P-CHAIN-05",
        "https://audit.test/chain/log",
        {"chain_id": "C-1"},
        make_jwt,
    )
    final = await wait_for_done(client, run_id)
    assert final["result"]["status"] == "fail"


# ----- catalogue total -----


async def test_catalogue_total_55(client: AsyncClient) -> None:
    res = await client.get("/checks/catalogue")
    assert res.status_code == 200
    ids = {entry["id"] for entry in res.json()}
    expected_ac = {f"AC-0{i}" for i in range(1, 8)}
    expected_mcp = {f"P-MCP-0{i}" for i in range(1, 9)}
    expected_llm = {f"P-LLM-0{i}" for i in range(1, 10)} | {"P-LLM-10"}
    expected_data = {f"P-DATA-0{i}" for i in range(1, 9)}
    expected_risk = {f"P-RISK-0{i}" for i in range(1, 7)}
    expected_gov = {f"P-GOV-0{i}" for i in range(1, 7)}
    expected_agent = {f"P-AGENT-0{i}" for i in range(1, 6)}
    expected_chain = {f"P-CHAIN-0{i}" for i in range(1, 6)}
    expected = (
        expected_ac
        | expected_mcp
        | expected_llm
        | expected_data
        | expected_risk
        | expected_gov
        | expected_agent
        | expected_chain
    )
    assert expected.issubset(ids), f"missing ids: {expected - ids}"
    assert len(expected) == 55

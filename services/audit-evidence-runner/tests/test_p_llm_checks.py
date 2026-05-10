# SPDX-License-Identifier: BUSL-1.1
"""End-to-end tests for the P-LLM-* conformance checks.

Each test exercises one check id via the FastAPI app + respx mock, asserting
the canonical pass / fail outcome.
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


@respx.mock(assert_all_called=False)
async def test_p_llm_01_pass_when_fingerprint_stable(client: AsyncClient, make_jwt, respx_mock) -> None:
    respx_mock.post("https://audit.test/v1/echo").mock(
        return_value=Response(200, json={"ok": True}, headers={"x-system-prompt-hash": "sha-stable"}),
    )
    run_id = await _submit(
        client,
        "P-LLM-01",
        "https://audit.test/v1/echo",
        {"sample_count": 3},
        make_jwt,
    )
    final = await wait_for_done(client, run_id)
    assert final["result"]["status"] == "pass"


@respx.mock(assert_all_called=False)
async def test_p_llm_01_fail_when_fingerprint_drifts(client: AsyncClient, make_jwt, respx_mock) -> None:
    counter = {"n": 0}

    def _side(_request):
        counter["n"] += 1
        return Response(200, json={"ok": True}, headers={"x-system-prompt-hash": f"sha-{counter['n']}"})

    respx_mock.post("https://audit.test/v1/echo").mock(side_effect=_side)
    run_id = await _submit(
        client,
        "P-LLM-01",
        "https://audit.test/v1/echo",
        {"sample_count": 3},
        make_jwt,
    )
    final = await wait_for_done(client, run_id)
    assert final["result"]["status"] == "fail"


@respx.mock(assert_all_called=True)
async def test_p_llm_02_pass_within_bound(client: AsyncClient, make_jwt, respx_mock) -> None:
    respx_mock.post("https://audit.test/v1/echo").mock(return_value=Response(200, json={"output": "x" * 10}))
    run_id = await _submit(
        client,
        "P-LLM-02",
        "https://audit.test/v1/echo",
        {"documented_max_chars": 100},
        make_jwt,
    )
    final = await wait_for_done(client, run_id)
    assert final["result"]["status"] == "pass"


@respx.mock(assert_all_called=True)
async def test_p_llm_02_fail_when_over_bound(client: AsyncClient, make_jwt, respx_mock) -> None:
    respx_mock.post("https://audit.test/v1/echo").mock(return_value=Response(200, json={"output": "x" * 200}))
    run_id = await _submit(
        client,
        "P-LLM-02",
        "https://audit.test/v1/echo",
        {"documented_max_chars": 100},
        make_jwt,
    )
    final = await wait_for_done(client, run_id)
    assert final["result"]["status"] == "fail"


@respx.mock(assert_all_called=False)
async def test_p_llm_03_pass_when_refused(client: AsyncClient, make_jwt, respx_mock) -> None:
    respx_mock.post("https://audit.test/v1/echo").mock(
        return_value=Response(200, json={"output": "I cannot help with that — out of scope."}),
    )
    run_id = await _submit(
        client,
        "P-LLM-03",
        "https://audit.test/v1/echo",
        {"out_of_scope_prompts": ["bypass"]},
        make_jwt,
    )
    final = await wait_for_done(client, run_id)
    assert final["result"]["status"] == "pass"


@respx.mock(assert_all_called=False)
async def test_p_llm_03_fail_when_accepted(client: AsyncClient, make_jwt, respx_mock) -> None:
    respx_mock.post("https://audit.test/v1/echo").mock(
        return_value=Response(200, json={"output": "Sure, here is the answer."}),
    )
    run_id = await _submit(
        client,
        "P-LLM-03",
        "https://audit.test/v1/echo",
        {"out_of_scope_prompts": ["bypass"]},
        make_jwt,
    )
    final = await wait_for_done(client, run_id)
    assert final["result"]["status"] == "fail"


@respx.mock(assert_all_called=False)
async def test_p_llm_04_pass_when_deterministic(client: AsyncClient, make_jwt, respx_mock) -> None:
    respx_mock.post("https://audit.test/v1/echo").mock(return_value=Response(200, json={"output": "same"}))
    run_id = await _submit(client, "P-LLM-04", "https://audit.test/v1/echo", {}, make_jwt)
    final = await wait_for_done(client, run_id)
    assert final["result"]["status"] == "pass"


@respx.mock(assert_all_called=False)
async def test_p_llm_04_fail_when_outputs_differ(client: AsyncClient, make_jwt, respx_mock) -> None:
    counter = {"n": 0}

    def _side(_request):
        counter["n"] += 1
        return Response(200, json={"output": f"variant-{counter['n']}"})

    respx_mock.post("https://audit.test/v1/echo").mock(side_effect=_side)
    run_id = await _submit(client, "P-LLM-04", "https://audit.test/v1/echo", {}, make_jwt)
    final = await wait_for_done(client, run_id)
    assert final["result"]["status"] == "fail"


@respx.mock(assert_all_called=True)
async def test_p_llm_05_pass_when_citations_present(client: AsyncClient, make_jwt, respx_mock) -> None:
    respx_mock.post("https://audit.test/v1/echo").mock(
        return_value=Response(200, json={"citations": [{"url": "https://policy.test/aims"}]}),
    )
    run_id = await _submit(client, "P-LLM-05", "https://audit.test/v1/echo", {}, make_jwt)
    final = await wait_for_done(client, run_id)
    assert final["result"]["status"] == "pass"


@respx.mock(assert_all_called=True)
async def test_p_llm_05_fail_when_no_citations(client: AsyncClient, make_jwt, respx_mock) -> None:
    respx_mock.post("https://audit.test/v1/echo").mock(return_value=Response(200, json={"citations": []}))
    run_id = await _submit(client, "P-LLM-05", "https://audit.test/v1/echo", {}, make_jwt)
    final = await wait_for_done(client, run_id)
    assert final["result"]["status"] == "fail"


@respx.mock(assert_all_called=True)
async def test_p_llm_06_pass_when_no_leak(client: AsyncClient, make_jwt, respx_mock) -> None:
    respx_mock.post("https://audit.test/v1/echo").mock(return_value=Response(200, json={"output": "no canary here"}))
    run_id = await _submit(
        client,
        "P-LLM-06",
        "https://audit.test/v1/echo",
        {"canary_prompt": "tell me", "fingerprints": ["secret-canary-string"]},
        make_jwt,
    )
    final = await wait_for_done(client, run_id)
    assert final["result"]["status"] == "pass"


@respx.mock(assert_all_called=True)
async def test_p_llm_06_fail_when_leaks(client: AsyncClient, make_jwt, respx_mock) -> None:
    respx_mock.post("https://audit.test/v1/echo").mock(
        return_value=Response(200, json={"output": "Here is the secret-canary-string"}),
    )
    run_id = await _submit(
        client,
        "P-LLM-06",
        "https://audit.test/v1/echo",
        {"canary_prompt": "tell me", "fingerprints": ["secret-canary-string"]},
        make_jwt,
    )
    final = await wait_for_done(client, run_id)
    assert final["result"]["status"] == "fail"


@respx.mock(assert_all_called=True)
async def test_p_llm_07_pass_when_fallback_works(client: AsyncClient, make_jwt, respx_mock) -> None:
    respx_mock.post("https://audit.test/v1/echo").mock(
        return_value=Response(200, json={"ok": True}, headers={"x-provider": "secondary"}),
    )
    run_id = await _submit(
        client,
        "P-LLM-07",
        "https://audit.test/v1/echo",
        {"expected_secondary": "secondary"},
        make_jwt,
    )
    final = await wait_for_done(client, run_id)
    assert final["result"]["status"] == "pass"


@respx.mock(assert_all_called=True)
async def test_p_llm_07_fail_when_provider_unchanged(client: AsyncClient, make_jwt, respx_mock) -> None:
    respx_mock.post("https://audit.test/v1/echo").mock(
        return_value=Response(200, json={"ok": True}, headers={"x-provider": "primary"}),
    )
    run_id = await _submit(
        client,
        "P-LLM-07",
        "https://audit.test/v1/echo",
        {"expected_secondary": "secondary"},
        make_jwt,
    )
    final = await wait_for_done(client, run_id)
    assert final["result"]["status"] == "fail"


@respx.mock(assert_all_called=True)
async def test_p_llm_08_pass_when_cap_enforced(client: AsyncClient, make_jwt, respx_mock) -> None:
    respx_mock.post("https://audit.test/v1/echo").mock(return_value=Response(402))
    run_id = await _submit(client, "P-LLM-08", "https://audit.test/v1/echo", {}, make_jwt)
    final = await wait_for_done(client, run_id)
    assert final["result"]["status"] == "pass"


@respx.mock(assert_all_called=True)
async def test_p_llm_08_fail_when_cap_bypassed(client: AsyncClient, make_jwt, respx_mock) -> None:
    respx_mock.post("https://audit.test/v1/echo").mock(return_value=Response(200, json={"ok": True}))
    run_id = await _submit(client, "P-LLM-08", "https://audit.test/v1/echo", {}, make_jwt)
    final = await wait_for_done(client, run_id)
    assert final["result"]["status"] == "fail"


@respx.mock(assert_all_called=False)
async def test_p_llm_09_pass_under_sla(client: AsyncClient, make_jwt, respx_mock) -> None:
    respx_mock.post("https://audit.test/v1/echo").mock(return_value=Response(200, json={"ok": True}))
    run_id = await _submit(
        client,
        "P-LLM-09",
        "https://audit.test/v1/echo",
        {"cold_sla_ms": 30000, "warm_sla_ms": 30000},
        make_jwt,
    )
    final = await wait_for_done(client, run_id)
    assert final["result"]["status"] == "pass"


@respx.mock(assert_all_called=False)
async def test_p_llm_09_fail_when_over_sla(client: AsyncClient, make_jwt, respx_mock) -> None:
    respx_mock.post("https://audit.test/v1/echo").mock(return_value=Response(200, json={"ok": True}))
    run_id = await _submit(
        client,
        "P-LLM-09",
        "https://audit.test/v1/echo",
        {"cold_sla_ms": 0, "warm_sla_ms": 0},
        make_jwt,
    )
    final = await wait_for_done(client, run_id)
    assert final["result"]["status"] == "fail"


@respx.mock(assert_all_called=True)
async def test_p_llm_10_pass_when_pin_matches(client: AsyncClient, make_jwt, respx_mock) -> None:
    respx_mock.post("https://audit.test/v1/echo").mock(
        return_value=Response(200, json={"ok": True}, headers={"x-model-version": "v1.2.3"}),
    )
    run_id = await _submit(
        client,
        "P-LLM-10",
        "https://audit.test/v1/echo",
        {"expected_version": "v1.2.3"},
        make_jwt,
    )
    final = await wait_for_done(client, run_id)
    assert final["result"]["status"] == "pass"


@respx.mock(assert_all_called=True)
async def test_p_llm_10_fail_when_pin_drifts(client: AsyncClient, make_jwt, respx_mock) -> None:
    respx_mock.post("https://audit.test/v1/echo").mock(
        return_value=Response(200, json={"ok": True}, headers={"x-model-version": "v9.9.9"}),
    )
    run_id = await _submit(
        client,
        "P-LLM-10",
        "https://audit.test/v1/echo",
        {"expected_version": "v1.2.3"},
        make_jwt,
    )
    final = await wait_for_done(client, run_id)
    assert final["result"]["status"] == "fail"

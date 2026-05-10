# SPDX-License-Identifier: BUSL-1.1
"""End-to-end tests for the P-DATA-* conformance checks."""

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
async def test_p_data_01_pass_when_metadata_complete(client: AsyncClient, make_jwt, respx_mock) -> None:
    respx_mock.get("https://audit.test/datasets/training").mock(
        return_value=Response(
            200,
            json={
                "source": "internal",
                "license": "CC-BY",
                "collection_date": "2024-01-01",
                "version": "v3",
                "integrity_hash": "abc",
            },
        ),
    )
    run_id = await _submit(client, "P-DATA-01", "https://audit.test/datasets/training", {}, make_jwt)
    final = await wait_for_done(client, run_id)
    assert final["result"]["status"] == "pass"


@respx.mock(assert_all_called=True)
async def test_p_data_01_fail_when_field_missing(client: AsyncClient, make_jwt, respx_mock) -> None:
    respx_mock.get("https://audit.test/datasets/training").mock(
        return_value=Response(200, json={"source": "internal"}),
    )
    run_id = await _submit(client, "P-DATA-01", "https://audit.test/datasets/training", {}, make_jwt)
    final = await wait_for_done(client, run_id)
    assert final["result"]["status"] == "fail"


@respx.mock(assert_all_called=False)
async def test_p_data_02_pass(client: AsyncClient, make_jwt, respx_mock) -> None:
    respx_mock.get("https://audit.test/v1/data-subject/SUB-1").mock(return_value=Response(200, json={"ok": True}))
    respx_mock.post("https://audit.test/v1/data-subject/SUB-1/rectify").mock(return_value=Response(202, json={}))
    respx_mock.delete("https://audit.test/v1/data-subject/SUB-1/erase").mock(return_value=Response(204))
    run_id = await _submit(
        client,
        "P-DATA-02",
        "https://audit.test",
        {"subject_id": "SUB-1"},
        make_jwt,
    )
    final = await wait_for_done(client, run_id)
    assert final["result"]["status"] == "pass"


@respx.mock(assert_all_called=False)
async def test_p_data_02_fail_when_endpoint_404(client: AsyncClient, make_jwt, respx_mock) -> None:
    respx_mock.get("https://audit.test/v1/data-subject/SUB-1").mock(return_value=Response(404))
    respx_mock.post("https://audit.test/v1/data-subject/SUB-1/rectify").mock(return_value=Response(202, json={}))
    respx_mock.delete("https://audit.test/v1/data-subject/SUB-1/erase").mock(return_value=Response(204))
    run_id = await _submit(
        client,
        "P-DATA-02",
        "https://audit.test",
        {"subject_id": "SUB-1"},
        make_jwt,
    )
    final = await wait_for_done(client, run_id)
    assert final["result"]["status"] == "fail"


@respx.mock(assert_all_called=True)
async def test_p_data_03_pass_when_metrics_present(client: AsyncClient, make_jwt, respx_mock) -> None:
    respx_mock.get("https://audit.test/data/metrics").mock(
        return_value=Response(200, json={"metrics": {"completeness": 0.99, "validity": 0.98, "freshness": 0.95}}),
    )
    run_id = await _submit(client, "P-DATA-03", "https://audit.test/data/metrics", {}, make_jwt)
    final = await wait_for_done(client, run_id)
    assert final["result"]["status"] == "pass"


@respx.mock(assert_all_called=True)
async def test_p_data_03_fail_when_metric_missing(client: AsyncClient, make_jwt, respx_mock) -> None:
    respx_mock.get("https://audit.test/data/metrics").mock(
        return_value=Response(200, json={"metrics": {"completeness": 0.99}}),
    )
    run_id = await _submit(client, "P-DATA-03", "https://audit.test/data/metrics", {}, make_jwt)
    final = await wait_for_done(client, run_id)
    assert final["result"]["status"] == "fail"


@respx.mock(assert_all_called=True)
async def test_p_data_04_pass_when_pii_tagged(client: AsyncClient, make_jwt, respx_mock) -> None:
    respx_mock.post("https://audit.test/data/ingest").mock(
        return_value=Response(200, json={"pii_tags": ["email", "phone"]}),
    )
    run_id = await _submit(client, "P-DATA-04", "https://audit.test/data/ingest", {}, make_jwt)
    final = await wait_for_done(client, run_id)
    assert final["result"]["status"] == "pass"


@respx.mock(assert_all_called=True)
async def test_p_data_04_fail_when_pii_untagged(client: AsyncClient, make_jwt, respx_mock) -> None:
    respx_mock.post("https://audit.test/data/ingest").mock(return_value=Response(200, json={"pii_tags": []}))
    run_id = await _submit(client, "P-DATA-04", "https://audit.test/data/ingest", {}, make_jwt)
    final = await wait_for_done(client, run_id)
    assert final["result"]["status"] == "fail"


@respx.mock(assert_all_called=True)
async def test_p_data_05_pass_when_no_old_records(client: AsyncClient, make_jwt, respx_mock) -> None:
    fresh = (datetime.now(tz=UTC) - timedelta(days=10)).isoformat()
    respx_mock.get("https://audit.test/data/records").mock(
        return_value=Response(200, json={"records": [{"id": "r1", "created_at": fresh}]}),
    )
    run_id = await _submit(
        client,
        "P-DATA-05",
        "https://audit.test/data/records",
        {"retention_days": 90},
        make_jwt,
    )
    final = await wait_for_done(client, run_id)
    assert final["result"]["status"] == "pass"


@respx.mock(assert_all_called=True)
async def test_p_data_05_fail_when_old_records_present(client: AsyncClient, make_jwt, respx_mock) -> None:
    old = (datetime.now(tz=UTC) - timedelta(days=400)).isoformat()
    respx_mock.get("https://audit.test/data/records").mock(
        return_value=Response(200, json={"records": [{"id": "r-old", "created_at": old}]}),
    )
    run_id = await _submit(
        client,
        "P-DATA-05",
        "https://audit.test/data/records",
        {"retention_days": 90},
        make_jwt,
    )
    final = await wait_for_done(client, run_id)
    assert final["result"]["status"] == "fail"


@respx.mock(assert_all_called=True)
async def test_p_data_06_pass_when_regions_in_allowlist(client: AsyncClient, make_jwt, respx_mock) -> None:
    respx_mock.get("https://audit.test/data/residency").mock(
        return_value=Response(200, json={"regions": ["eu-west", "eu-central"]}),
    )
    run_id = await _submit(
        client,
        "P-DATA-06",
        "https://audit.test/data/residency",
        {"allowed_regions": ["eu-west", "eu-central"]},
        make_jwt,
    )
    final = await wait_for_done(client, run_id)
    assert final["result"]["status"] == "pass"


@respx.mock(assert_all_called=True)
async def test_p_data_06_fail_when_region_off_list(client: AsyncClient, make_jwt, respx_mock) -> None:
    respx_mock.get("https://audit.test/data/residency").mock(
        return_value=Response(200, json={"regions": ["us-east"]}),
    )
    run_id = await _submit(
        client,
        "P-DATA-06",
        "https://audit.test/data/residency",
        {"allowed_regions": ["eu-west"]},
        make_jwt,
    )
    final = await wait_for_done(client, run_id)
    assert final["result"]["status"] == "fail"


@respx.mock(assert_all_called=True)
async def test_p_data_07_pass_when_disclosure_complete(client: AsyncClient, make_jwt, respx_mock) -> None:
    respx_mock.get("https://audit.test/datasets").mock(
        return_value=Response(
            200,
            json={
                "datasets": [
                    {
                        "id": "ds-syn",
                        "synthetic": True,
                        "generation_method": "tabular-gan",
                        "validation_basis": "expert-review",
                    },
                ],
            },
        ),
    )
    run_id = await _submit(client, "P-DATA-07", "https://audit.test/datasets", {}, make_jwt)
    final = await wait_for_done(client, run_id)
    assert final["result"]["status"] == "pass"


@respx.mock(assert_all_called=True)
async def test_p_data_07_fail_when_disclosure_incomplete(client: AsyncClient, make_jwt, respx_mock) -> None:
    respx_mock.get("https://audit.test/datasets").mock(
        return_value=Response(200, json={"datasets": [{"id": "ds-syn", "synthetic": True}]}),
    )
    run_id = await _submit(client, "P-DATA-07", "https://audit.test/datasets", {}, make_jwt)
    final = await wait_for_done(client, run_id)
    assert final["result"]["status"] == "fail"


@respx.mock(assert_all_called=False)
async def test_p_data_08_pass_when_pin_matches(client: AsyncClient, make_jwt, respx_mock) -> None:
    respx_mock.get("https://audit.test/deployments/prod").mock(
        return_value=Response(200, json={"dataset_version": "v3"}),
    )
    respx_mock.get("https://audit.test/model-cards/latest").mock(
        return_value=Response(200, json={"dataset_version": "v3"}),
    )
    run_id = await _submit(
        client,
        "P-DATA-08",
        "https://audit.test",
        {
            "deployment_url": "https://audit.test/deployments/prod",
            "model_card_url": "https://audit.test/model-cards/latest",
        },
        make_jwt,
    )
    final = await wait_for_done(client, run_id)
    assert final["result"]["status"] == "pass"


@respx.mock(assert_all_called=False)
async def test_p_data_08_fail_when_pin_drifts(client: AsyncClient, make_jwt, respx_mock) -> None:
    respx_mock.get("https://audit.test/deployments/prod").mock(
        return_value=Response(200, json={"dataset_version": "v3"}),
    )
    respx_mock.get("https://audit.test/model-cards/latest").mock(
        return_value=Response(200, json={"dataset_version": "v4"}),
    )
    run_id = await _submit(
        client,
        "P-DATA-08",
        "https://audit.test",
        {
            "deployment_url": "https://audit.test/deployments/prod",
            "model_card_url": "https://audit.test/model-cards/latest",
        },
        make_jwt,
    )
    final = await wait_for_done(client, run_id)
    assert final["result"]["status"] == "fail"

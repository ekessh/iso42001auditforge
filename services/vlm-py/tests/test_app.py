# SPDX-License-Identifier: BUSL-1.1
"""Smoke tests for the FastAPI shape of the VLM sidecar."""

import httpx
import pytest
from asgi_lifespan import LifespanManager

from services.vlm_py.app import app


@pytest.mark.asyncio
async def test_healthz() -> None:
    async with LifespanManager(app):
        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://t") as ac:
            r = await ac.get("/healthz")
            assert r.status_code == 200
            assert r.json()["status"] == "ok"


@pytest.mark.asyncio
async def test_extract_known_schemas() -> None:
    async with LifespanManager(app):
        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://t") as ac:
            for schema_id in ("ModelCard", "Datasheet", "FairnessReport", "IncidentLog"):
                r = await ac.post(
                    "/extract",
                    json={"schemaId": schema_id, "image_b64": "abcd"},
                )
                assert r.status_code == 200, r.text
                body = r.json()
                assert body["modelName"].startswith("sidecar:")
                assert body["confidence"] >= 0
                assert "value" in body


@pytest.mark.asyncio
async def test_extract_unknown_schema_400() -> None:
    async with LifespanManager(app):
        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://t") as ac:
            r = await ac.post(
                "/extract",
                json={"schemaId": "NotAThing", "image_b64": "abcd"},
            )
            assert r.status_code == 400

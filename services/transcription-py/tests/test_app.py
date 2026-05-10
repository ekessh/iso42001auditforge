# SPDX-License-Identifier: BUSL-1.1
"""Smoke tests for the FastAPI shape of the transcription sidecar."""

import httpx
import pytest
from asgi_lifespan import LifespanManager

from services.transcription_py.app import app


@pytest.mark.asyncio
async def test_healthz() -> None:
    async with LifespanManager(app):
        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://t") as ac:
            r = await ac.get("/healthz")
            assert r.status_code == 200
            assert r.json()["status"] == "ok"


@pytest.mark.asyncio
async def test_transcribe_returns_segments() -> None:
    async with LifespanManager(app):
        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://t") as ac:
            r = await ac.post("/transcribe", content=b"fake")
            assert r.status_code == 200
            body = r.json()
            assert "segments" in body
            assert len(body["segments"]) == 1
            seg = body["segments"][0]
            for k in ("id", "startMs", "endMs", "text", "words", "confidence", "isFinal"):
                assert k in seg


@pytest.mark.asyncio
async def test_diarize_round_robins_speakers() -> None:
    async with LifespanManager(app):
        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://t") as ac:
            r = await ac.post(
                "/diarize",
                json={
                    "segments": [
                        {"startMs": 0, "endMs": 100},
                        {"startMs": 100, "endMs": 200},
                        {"startMs": 200, "endMs": 300},
                    ],
                    "num_speakers": 2,
                },
            )
            assert r.status_code == 200
            ids = [s["speakerId"] for s in r.json()["segments"]]
            assert ids == ["SPK-A", "SPK-B", "SPK-A"]


@pytest.mark.asyncio
async def test_diarize_default_when_no_segments() -> None:
    async with LifespanManager(app):
        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://t") as ac:
            r = await ac.post("/diarize", json={"audio_b64": "abcd", "mime": "audio/webm"})
            assert r.status_code == 200
            assert len(r.json()["segments"]) == 1

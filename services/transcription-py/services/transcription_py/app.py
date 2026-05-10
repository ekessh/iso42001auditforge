# SPDX-License-Identifier: BUSL-1.1
"""FastAPI sidecar exposing WhisperX-shaped transcription + Pyannote diarization.

Phase 7.6 scaffold. Real ML deferred.
"""

from __future__ import annotations

from typing import Any

from fastapi import FastAPI, Request
from pydantic import BaseModel, Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="AUDITFORGE_TRANSCRIPTION_")

    whisperx_model: str = "small"
    pyannote_token: str | None = None


class Word(BaseModel):
    text: str
    start_ms: int = Field(alias="startMs")
    end_ms: int = Field(alias="endMs")
    confidence: float

    model_config = {"populate_by_name": True}


class Segment(BaseModel):
    id: str
    start_ms: int = Field(alias="startMs")
    end_ms: int = Field(alias="endMs")
    text: str
    words: list[Word]
    confidence: float
    is_final: bool = Field(default=True, alias="isFinal")

    model_config = {"populate_by_name": True}


class TranscribeResponse(BaseModel):
    segments: list[Segment]


class DiarizeRequest(BaseModel):
    audio_b64: str | None = None
    mime: str | None = None
    segments: list[dict[str, int]] | None = None
    num_speakers: int | None = None


class SpeakerSegment(BaseModel):
    start_ms: int = Field(alias="startMs")
    end_ms: int = Field(alias="endMs")
    speaker_id: str = Field(alias="speakerId")
    confidence: float | None = 0.5

    model_config = {"populate_by_name": True}


class DiarizeResponse(BaseModel):
    segments: list[SpeakerSegment]


app = FastAPI(title="AuditForge Transcription Sidecar", version="0.1.0")


@app.get("/healthz")
async def healthz() -> dict[str, str]:
    return {"status": "ok", "version": "0.1.0"}


@app.post("/transcribe")
async def transcribe(req: Request) -> dict[str, list[dict[str, Any]]]:
    body = await req.body()
    return {
        "segments": _stub_transcribe(body),
    }


@app.post("/diarize", response_model=DiarizeResponse)
async def diarize(req: DiarizeRequest) -> DiarizeResponse:
    return DiarizeResponse(segments=_stub_diarize(req))


def _stub_transcribe(body: bytes) -> list[dict[str, Any]]:
    size = len(body)
    return [
        {
            "id": "seg-1",
            "startMs": 0,
            "endMs": 1500,
            "text": f"Stub transcript for {size} bytes of audio.",
            "words": [
                {"text": "Stub", "startMs": 0, "endMs": 300, "confidence": 0.9},
                {"text": "transcript.", "startMs": 300, "endMs": 1500, "confidence": 0.85},
            ],
            "confidence": 0.88,
            "isFinal": True,
        }
    ]


def _stub_diarize(req: DiarizeRequest) -> list[SpeakerSegment]:
    if req.segments:
        speakers = req.num_speakers or 2
        out: list[SpeakerSegment] = []
        for i, seg in enumerate(req.segments):
            speaker_letter = chr(ord("A") + (i % speakers))
            out.append(
                SpeakerSegment.model_validate(
                    {
                        "startMs": seg["startMs"],
                        "endMs": seg["endMs"],
                        "speakerId": f"SPK-{speaker_letter}",
                        "confidence": 0.7,
                    }
                )
            )
        return out
    return [
        SpeakerSegment.model_validate(
            {"startMs": 0, "endMs": 1500, "speakerId": "SPK-A", "confidence": 0.5}
        )
    ]

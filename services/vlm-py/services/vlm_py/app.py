# SPDX-License-Identifier: BUSL-1.1
"""FastAPI sidecar exposing schema-constrained VLM extraction.

Phase 7.6 scaffold. Real Qwen2.5-VL / DeepSeek-OCR deferred.
"""

from __future__ import annotations

import hashlib
from typing import Any

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="AUDITFORGE_VLM_")

    backend: str = "stub"  # one of: stub, qwen2_5_vl, deepseek_ocr


class ExtractRequest(BaseModel):
    schemaId: str
    image_b64: str
    engagementId: str | None = None


class SourceRegion(BaseModel):
    x: float
    y: float
    width: float
    height: float
    label: str | None = None


class ExtractResponse(BaseModel):
    value: dict[str, Any]
    confidence: float
    sourceRegions: list[SourceRegion]
    modelName: str
    modelHash: str | None = None


_FIXTURES: dict[str, dict[str, Any]] = {
    "ModelCard": {
        "modelName": "StubModel",
        "modelVersion": "0.1.0",
        "provider": "AuditForge",
        "intendedUse": "Phase 7.6 scaffold fixture",
        "trainingDataSummary": "Synthetic fixture data",
        "knownLimitations": ["Stub: not real extraction"],
        "performanceMetrics": [
            {"name": "accuracy", "value": "0.99", "dataset": "synthetic"}
        ],
        "license": "BUSL-1.1",
    },
    "Datasheet": {
        "datasetName": "StubDataset",
        "datasetVersion": "2026.01",
        "purpose": "Stub fixture",
        "sourceComposition": "Synthetic",
        "annotationProcess": "N/A",
        "licensing": "CC0",
        "knownBiases": [],
        "sensitiveAttributesPresent": [],
    },
    "FairnessReport": {
        "modelName": "StubModel",
        "protectedAttributes": ["gender"],
        "metrics": [
            {"metric": "demographic_parity", "group": "all", "value": 0.01}
        ],
        "summary": "Stub fairness report",
    },
    "IncidentLog": {
        "incidentId": "INC-STUB-1",
        "detectedAt": "2026-01-01T00:00:00Z",
        "severity": "low",
        "summary": "Stub incident",
        "affectedSystems": [],
        "status": "closed",
    },
}


app = FastAPI(title="AuditForge VLM Sidecar", version="0.1.0")
settings = Settings()


@app.get("/healthz")
async def healthz() -> dict[str, str]:
    return {"status": "ok", "backend": settings.backend, "version": "0.1.0"}


@app.post("/extract", response_model=ExtractResponse)
async def extract(req: ExtractRequest) -> ExtractResponse:
    fixture = _FIXTURES.get(req.schemaId)
    if fixture is None:
        raise HTTPException(status_code=400, detail=f"unknown schemaId {req.schemaId}")
    digest = hashlib.sha256(req.image_b64.encode("utf-8")).hexdigest()
    return ExtractResponse(
        value=fixture,
        confidence=0.92,
        sourceRegions=[SourceRegion(x=0, y=0, width=1, height=1, label="stub")],
        modelName=f"sidecar:{settings.backend}",
        modelHash=f"sha256:{digest[:32]}",
    )

# SPDX-License-Identifier: BUSL-1.1
"""FastAPI entrypoint for the audit-evidence-runner sidecar."""

from __future__ import annotations

import json
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Request, status
from fastapi.responses import JSONResponse
from sse_starlette.sse import EventSourceResponse

from .auth import EngagementContextError, verify_engagement_context
from .checks import (  # noqa: F401 — populates the registry
    base as _registry_module,
)
from .checks.base import all_checks, get_check
from .config import Settings, get_settings
from .runner import CheckNotFound, RunRegistry
from .schemas import (
    CatalogueEntry,
    RunCreated,
    RunRequest,
    RunStatus,
)
from .signing import build_signing_provider


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    settings = app.state.settings
    signer = build_signing_provider(settings)
    app.state.registry = RunRegistry(settings, signer)
    yield
    await app.state.registry.shutdown()


def create_app(settings: Settings | None = None) -> FastAPI:
    app = FastAPI(
        title="AuditForge Audit-Evidence Runner",
        description=(
            "Defensive ISO 42001 conformance evidence sidecar. Runs catalogued, "
            "declarative checks against AI systems within a signed engagement scope."
        ),
        version="0.1.0",
        lifespan=lifespan,
    )
    app.state.settings = settings or get_settings()

    @app.get("/healthz")
    async def healthz() -> dict[str, object]:
        return {
            "status": "ok",
            "checks_registered": len(all_checks()),
            "egress_proxy_configured": bool(app.state.settings.egress_proxy),
            "allowed_hosts": app.state.settings.allowed_hosts_list,
        }

    @app.get("/checks/catalogue", response_model=list[CatalogueEntry])
    async def catalogue() -> list[CatalogueEntry]:
        return [c.catalogue_entry() for c in all_checks()]

    @app.post("/checks/run", response_model=RunCreated, status_code=status.HTTP_202_ACCEPTED)
    async def run_check(req: RunRequest) -> RunCreated:
        if get_check(req.check_id) is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"unknown check id '{req.check_id}'",
            )
        try:
            engagement = verify_engagement_context(req.engagement_context, app.state.settings)
        except EngagementContextError as e:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(e)) from e

        try:
            run_id = await app.state.registry.submit(req, engagement)
        except CheckNotFound as e:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e)) from e
        return RunCreated(run_id=run_id)

    @app.get("/checks/runs/{run_id}", response_model=RunStatus)
    async def get_run(run_id: str) -> RunStatus:
        rs = app.state.registry.status(run_id)
        if rs is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="unknown run id")
        return rs

    @app.get("/checks/runs/{run_id}/stream")
    async def stream_run(run_id: str, request: Request) -> EventSourceResponse:
        if app.state.registry.status(run_id) is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="unknown run id")

        async def gen() -> AsyncIterator[dict[str, object]]:
            async for event in app.state.registry.stream(run_id):
                if await request.is_disconnected():
                    break
                yield {
                    "event": str(event.get("event", "message")),
                    "data": json.dumps(event.get("data", {})),
                }

        return EventSourceResponse(gen())

    @app.post("/checks/cancel/{run_id}", status_code=status.HTTP_200_OK)
    async def cancel_run(run_id: str) -> JSONResponse:
        ok = await app.state.registry.cancel(run_id)
        if not ok:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="unknown or finished run")
        return JSONResponse({"cancelled": True})

    return app


app = create_app()

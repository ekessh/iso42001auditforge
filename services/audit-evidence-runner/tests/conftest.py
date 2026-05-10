# SPDX-License-Identifier: BUSL-1.1
"""Shared fixtures for audit-evidence-runner tests."""

from __future__ import annotations

import asyncio
from collections.abc import AsyncIterator
from pathlib import Path

import jwt
import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient

from services.audit_evidence_runner.budget import BudgetTracker
from services.audit_evidence_runner.config import Settings
from services.audit_evidence_runner.main import create_app
from services.audit_evidence_runner.schemas import BudgetSpec, SandboxSpec, TargetSpec


@pytest.fixture
def jwt_secret() -> str:
    return "audit-runner-test-secret"


@pytest.fixture
def make_jwt(jwt_secret: str):
    def _make(engagement_id: str = "eng-test", auditor_id: str = "aud-test") -> str:
        return jwt.encode(
            {
                "engagementId": engagement_id,
                "auditorId": auditor_id,
                "mode": "audit",
                "aud": "auditforge-audit-evidence-runner",
                "iss": "auditforge-api",
            },
            jwt_secret,
            algorithm="HS256",
        )

    return _make


@pytest.fixture
def settings(jwt_secret: str, tmp_path: Path) -> Settings:
    return Settings(
        egress_proxy="",
        allowed_hosts="audit.test,*.audit.test,127.0.0.1,localhost",
        fs_root=str(tmp_path / "fsroot"),
        engagement_jwt_secret=jwt_secret,
        engagement_jwt_algorithm="HS256",
        engagement_jwt_audience="auditforge-audit-evidence-runner",
        engagement_jwt_issuer="auditforge-api",
        engagement_jwt_required=True,
        max_concurrent_runs=4,
    )


@pytest_asyncio.fixture
async def client(settings: Settings) -> AsyncIterator[AsyncClient]:
    app = create_app(settings)
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://testserver") as c:
        async with app.router.lifespan_context(app):
            yield c


@pytest.fixture
def target_http() -> TargetSpec:
    return TargetSpec(kind="http", endpoint="https://audit.test/v1/echo")


@pytest.fixture
def target_mcp() -> TargetSpec:
    return TargetSpec(kind="mcp", endpoint="https://audit.test")


@pytest.fixture
def budget_spec_default() -> BudgetSpec:
    return BudgetSpec(max_seconds=30.0, max_calls=200, max_tokens=10_000, max_usd=1.0)


@pytest.fixture
def sandbox_spec_default() -> SandboxSpec:
    return SandboxSpec(network_allowlist=["audit.test", "*.audit.test"])


@pytest.fixture
def budget_tracker(budget_spec_default: BudgetSpec) -> BudgetTracker:
    return BudgetTracker(spec=budget_spec_default)


async def wait_for_done(client: AsyncClient, run_id: str, timeout: float = 5.0) -> dict:
    """Poll a run until it leaves a non-terminal state."""
    deadline = asyncio.get_event_loop().time() + timeout
    while asyncio.get_event_loop().time() < deadline:
        res = await client.get(f"/checks/runs/{run_id}")
        body = res.json()
        if body["state"] in ("complete", "error", "cancelled"):
            return body
        await asyncio.sleep(0.05)
    raise TimeoutError(f"run {run_id} did not finish within {timeout}s")

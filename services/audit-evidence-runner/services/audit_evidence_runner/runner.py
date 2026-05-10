# SPDX-License-Identifier: BUSL-1.1
"""Run lifecycle orchestration.

A single `RunRegistry` owns all in-flight runs and their event streams. The
HTTP layer (`main.py`) is a thin shell over this registry.
"""

from __future__ import annotations

import asyncio
import contextlib
import uuid
from dataclasses import dataclass, field

from .auth import EngagementContext
from .budget import BudgetExceeded, BudgetTracker
from .checks.base import (
    AuditEvidenceCheck,
    CheckContext,
    empty_metrics,
    empty_result,
    get_check,
)
from .config import Settings
from .sandbox import (
    SandboxConfigError,
    ensure_run_fs_root,
    make_http_client,
    parse_host,
)
from .schemas import (
    BudgetSpec,
    CheckMetrics,
    CheckResult,
    RunRequest,
    RunStatus,
    SandboxSpec,
    TargetSpec,
    utcnow_iso,
)
from .signing import SigningProvider, canonical_json_bytes


class CheckNotFound(Exception):
    """Raised when a request references a check id outside the catalogue."""


@dataclass
class _Run:
    run_id: str
    check_id: str
    target: TargetSpec
    params: dict[str, object]
    budget_spec: BudgetSpec
    sandbox: SandboxSpec
    engagement: EngagementContext
    state: str = "queued"
    started_at: str = field(default_factory=utcnow_iso)
    updated_at: str = field(default_factory=utcnow_iso)
    metrics: CheckMetrics = field(default_factory=empty_metrics)
    result: CheckResult | None = None
    error: str | None = None
    task: asyncio.Task[None] | None = None
    queue: asyncio.Queue[dict[str, object]] = field(default_factory=asyncio.Queue)


class RunRegistry:
    def __init__(self, settings: Settings, signer: SigningProvider) -> None:
        self._settings = settings
        self._signer = signer
        self._runs: dict[str, _Run] = {}
        self._semaphore = asyncio.Semaphore(settings.max_concurrent_runs)

    async def submit(self, req: RunRequest, engagement: EngagementContext) -> str:
        check = get_check(req.check_id)
        if check is None:
            raise CheckNotFound(req.check_id)

        run_id = str(uuid.uuid4())
        run = _Run(
            run_id=run_id,
            check_id=req.check_id,
            target=req.target,
            params=req.params,
            budget_spec=req.budget,
            sandbox=req.sandbox,
            engagement=engagement,
        )
        self._runs[run_id] = run
        run.task = asyncio.create_task(self._execute(run, check))
        return run_id

    def status(self, run_id: str) -> RunStatus | None:
        run = self._runs.get(run_id)
        if run is None:
            return None
        return RunStatus(
            run_id=run.run_id,
            check_id=run.check_id,
            state=run.state,  # type: ignore[arg-type]
            started_at=run.started_at,
            updated_at=run.updated_at,
            metrics=run.metrics,
            partial_findings=[],
            result=run.result,
            error=run.error,
        )

    async def cancel(self, run_id: str) -> bool:
        run = self._runs.get(run_id)
        if run is None or run.task is None:
            return False
        if run.task.done():
            return False
        run.task.cancel()
        with contextlib.suppress(asyncio.CancelledError):
            await run.task
        run.state = "cancelled"
        run.updated_at = utcnow_iso()
        await run.queue.put({"event": "state", "data": {"state": "cancelled"}})
        await run.queue.put({"event": "done", "data": {}})
        return True

    async def stream(self, run_id: str):
        run = self._runs.get(run_id)
        if run is None:
            return
        while True:
            event = await run.queue.get()
            yield event
            if event.get("event") == "done":
                return

    async def _execute(self, run: _Run, check: AuditEvidenceCheck) -> None:
        async with self._semaphore:
            run.state = "running"
            run.updated_at = utcnow_iso()
            await run.queue.put({"event": "state", "data": {"state": "running"}})

            tracker = BudgetTracker(spec=run.budget_spec)
            allowed_hosts = [*list(run.sandbox.network_allowlist), parse_host(run.target.endpoint)]
            allowed_hosts = [h for h in allowed_hosts if h]

            try:
                http = make_http_client(self._settings, allowed_hosts, timeout=10.0)
            except SandboxConfigError as e:
                run.state = "error"
                run.error = str(e)
                run.updated_at = utcnow_iso()
                await run.queue.put({"event": "error", "data": {"message": str(e)}})
                await run.queue.put({"event": "done", "data": {}})
                return

            ensure_run_fs_root(self._settings.fs_root, run.run_id)
            terminated_by_budget = False

            try:
                async with http:
                    ctx = CheckContext(
                        run_id=run.run_id,
                        target=run.target,
                        params=dict(run.params),
                        budget=tracker,
                        sandbox=run.sandbox,
                        http=http,
                    )
                    try:
                        status, severity, findings = await check.execute(ctx)
                    except BudgetExceeded as e:
                        terminated_by_budget = True
                        status = "terminated_by_budget"
                        severity = "low"
                        findings = []
                        run.error = f"budget axis '{e.axis}' exceeded"
            except asyncio.CancelledError:
                run.state = "cancelled"
                run.updated_at = utcnow_iso()
                await run.queue.put({"event": "state", "data": {"state": "cancelled"}})
                await run.queue.put({"event": "done", "data": {}})
                raise
            except Exception as e:
                run.state = "error"
                run.error = repr(e)
                run.updated_at = utcnow_iso()
                await run.queue.put({"event": "error", "data": {"message": repr(e)}})
                await run.queue.put({"event": "done", "data": {}})
                return

            snap = tracker.snapshot()
            metrics = CheckMetrics(
                calls=int(snap["calls"]),
                tokens=int(snap["tokens"]),
                usd=float(snap["usd"]),
                wall_seconds=float(snap["wall_seconds"]),
            )
            run.metrics = metrics

            result = empty_result(
                run_id=run.run_id,
                check_id=run.check_id,
                status=status,
                severity=severity,
                findings=findings,
                metrics=metrics,
                terminated_by_budget=terminated_by_budget,
            )

            sig_payload = canonical_json_bytes(
                {
                    "runId": result.run_id,
                    "checkId": result.check_id,
                    "status": result.status,
                    "severity": result.severity,
                    "findings": [f.model_dump() for f in result.findings],
                    "metrics": result.metrics.model_dump(),
                    "timestamp": result.timestamp_iso,
                    "engagementId": run.engagement.engagement_id,
                },
            )
            try:
                signed = await self._signer.sign(sig_payload)
                result = result.model_copy(
                    update={
                        "signature": signed.signature_b64,
                        "signature_algorithm": signed.algorithm,
                        "signature_signer_id": signed.signer_id,
                    },
                )
            except Exception as e:
                run.error = f"signing failed: {e!r}"

            run.result = result
            run.state = "complete"
            run.updated_at = utcnow_iso()
            await run.queue.put(
                {"event": "result", "data": result.model_dump(mode="json")},
            )
            await run.queue.put({"event": "done", "data": {}})

    async def shutdown(self) -> None:
        for run in self._runs.values():
            if run.task and not run.task.done():
                run.task.cancel()
                with contextlib.suppress(asyncio.CancelledError, Exception):
                    await run.task

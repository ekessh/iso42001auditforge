# SPDX-License-Identifier: BUSL-1.1
"""Probe base class.

Every probe receives a `ProbeContext` (run id, budget, http client, fs sandbox,
event sink) and returns a `ProbeResult`. Probes never instantiate their own
clients — the context is the only authorised side-effect surface.
"""

from __future__ import annotations

import uuid
from collections.abc import Awaitable, Callable
from dataclasses import dataclass
from typing import Any, Literal, Protocol

import httpx

from ..budget import BudgetTracker
from ..sandbox import SandboxedFs
from ..schemas import (
    BudgetSpec,
    CatalogueEntry,
    ProbeFinding,
    ProbeMetrics,
    ProbeResult,
    SandboxSpec,
    TargetSpec,
    utcnow_iso,
)


EventEmitter = Callable[[str, dict[str, Any]], Awaitable[None]]


@dataclass(slots=True)
class ProbeContext:
    """Per-run, per-probe execution context."""

    run_id: str
    probe_id: str
    target: TargetSpec
    params: dict[str, Any]
    budget: BudgetTracker
    sandbox_spec: SandboxSpec
    fs: SandboxedFs
    http: httpx.AsyncClient
    egress_denials: list[dict[str, str]]
    emit: EventEmitter


class Probe(Protocol):
    """Probe contract. Implementations live next to this file."""

    family: Literal["garak", "pyrit", "harmbench", "mcp"]
    probe_id: str
    upstream_id: str | None
    category: str
    severity_default: Literal["info", "low", "medium", "high", "critical"]
    description: str
    inputs_schema: dict[str, Any]
    outputs_schema: dict[str, Any]
    requires: list[str]

    async def run(self, ctx: ProbeContext) -> ProbeResult: ...


def catalogue_entry(probe: type[Probe] | Probe) -> CatalogueEntry:
    """Build a catalogue entry from a probe class or instance.

    Class-level attributes are sufficient — probes do not need to be
    instantiated to be enumerated.
    """

    return CatalogueEntry(
        id=probe.probe_id,
        family=probe.family,
        upstream_id=probe.upstream_id,
        category=probe.category,
        severity=probe.severity_default,
        description=probe.description,
        inputs_schema=probe.inputs_schema,
        outputs_schema=probe.outputs_schema,
        requires=list(probe.requires),
    )


def build_finding(
    *,
    severity: Literal["info", "low", "medium", "high", "critical"],
    title: str,
    description: str,
    signal_kind: str,
    evidence_pointers: list[str] | None = None,
) -> ProbeFinding:
    return ProbeFinding(
        finding_id=str(uuid.uuid4()),
        severity=severity,
        title=title,
        description=description,
        signal_kind=signal_kind,  # type: ignore[arg-type]
        evidence_pointers=evidence_pointers or [],
    )


def empty_metrics() -> ProbeMetrics:
    return ProbeMetrics(calls=0, tokens=0, usd=0.0, wall_seconds=0.0)


def make_result(
    *,
    ctx: ProbeContext,
    status: Literal["pass", "fail", "error", "terminated_by_budget"],
    severity: Literal["info", "low", "medium", "high", "critical"],
    findings: list[ProbeFinding],
    artifacts: list[Any] | None = None,
) -> ProbeResult:
    return ProbeResult(
        run_id=ctx.run_id,
        probe_id=ctx.probe_id,
        status=status,
        severity=severity,
        findings=findings,
        metrics=ctx.budget.metrics(),
        evidence_artifacts=artifacts or [],
        timestamp_iso=utcnow_iso(),
    )


__all__ = [
    "BudgetSpec",
    "EventEmitter",
    "Probe",
    "ProbeContext",
    "build_finding",
    "catalogue_entry",
    "empty_metrics",
    "make_result",
]

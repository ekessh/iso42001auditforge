# SPDX-License-Identifier: BUSL-1.1
"""Check base class plus a process-wide registry.

A check is the smallest catalogued unit of audit-evidence work. Each subclass
declares its catalogue metadata and implements `execute(...)`. The runner
discovers checks via the registry; the request body cannot inject new check
implementations — see `runner.py` for the lookup-only path.
"""

from __future__ import annotations

import uuid
from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Any

import httpx

from ..budget import BudgetTracker
from ..schemas import (
    BudgetSpec,
    CatalogueEntry,
    CheckCategory,
    CheckFinding,
    CheckMetrics,
    CheckResult,
    SandboxSpec,
    Severity,
    TargetSpec,
    utcnow_iso,
)


@dataclass
class CheckContext:
    """Per-run context passed to each check."""

    run_id: str
    target: TargetSpec
    params: dict[str, Any]
    budget: BudgetTracker
    sandbox: SandboxSpec
    http: httpx.AsyncClient


class AuditEvidenceCheck(ABC):
    """Base class for declarative audit-evidence checks."""

    id: str
    category: CheckCategory
    family: str
    title: str
    description: str
    severity: Severity = "medium"
    iso42001_clauses: list[str] = []
    annex_a: list[str] = []
    external_refs: list[dict[str, str]] = []
    inputs_schema: dict[str, Any] = {"type": "object", "additionalProperties": True}
    outputs_schema: dict[str, Any] = {
        "type": "object",
        "properties": {
            "status": {"type": "string"},
            "findings": {"type": "array"},
        },
    }

    @abstractmethod
    async def execute(self, ctx: CheckContext) -> tuple[str, Severity, list[CheckFinding]]: ...

    def catalogue_entry(self) -> CatalogueEntry:
        return CatalogueEntry(
            id=self.id,
            category=self.category,
            family=self.family,  # type: ignore[arg-type]
            severity=self.severity,
            title=self.title,
            description=self.description,
            inputs_schema=self.inputs_schema,
            outputs_schema=self.outputs_schema,
            iso42001_clauses=self.iso42001_clauses,
            annex_a=self.annex_a,
            external_refs=self.external_refs,
        )


_REGISTRY: dict[str, AuditEvidenceCheck] = {}


def register(check: AuditEvidenceCheck) -> AuditEvidenceCheck:
    if check.id in _REGISTRY:
        raise RuntimeError(f"check id collision: {check.id} already registered")
    _REGISTRY[check.id] = check
    return check


def get_check(check_id: str) -> AuditEvidenceCheck | None:
    return _REGISTRY.get(check_id)


def all_checks() -> list[AuditEvidenceCheck]:
    return list(_REGISTRY.values())


def reset_registry_for_tests() -> None:
    _REGISTRY.clear()


def make_finding(
    check_id: str,
    severity: Severity,
    title: str,
    description: str,
    signal_kind: str,
    evidence_pointers: list[str] | None = None,
) -> CheckFinding:
    return CheckFinding(
        finding_id=f"{check_id}:{uuid.uuid4()}",
        severity=severity,
        title=title,
        description=description,
        signal_kind=signal_kind,  # type: ignore[arg-type]
        evidence_pointers=evidence_pointers or [],
    )


def empty_metrics() -> CheckMetrics:
    return CheckMetrics()


def empty_result(
    run_id: str,
    check_id: str,
    status: str,
    severity: Severity,
    findings: list[CheckFinding],
    metrics: CheckMetrics,
    terminated_by_budget: bool = False,
) -> CheckResult:
    return CheckResult(
        run_id=run_id,
        check_id=check_id,
        status=status,  # type: ignore[arg-type]
        severity=severity,
        findings=findings,
        metrics=metrics,
        evidence_artifacts=[],
        timestamp_iso=utcnow_iso(),
        terminated_by_budget=terminated_by_budget,
    )


__all__ = [
    "AuditEvidenceCheck",
    "BudgetSpec",
    "CheckContext",
    "TargetSpec",
    "all_checks",
    "empty_metrics",
    "empty_result",
    "get_check",
    "make_finding",
    "register",
    "reset_registry_for_tests",
]

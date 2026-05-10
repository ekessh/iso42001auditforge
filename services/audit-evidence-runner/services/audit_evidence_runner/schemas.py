# SPDX-License-Identifier: BUSL-1.1
"""Wire schemas for the audit-evidence-runner HTTP boundary.

The TS client (`packages/probe-engine/src/external-runner.ts`) parses these via
Zod. Field names and types must remain in lockstep.
"""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

CheckRunState = Literal["queued", "running", "complete", "error", "cancelled"]
CheckOutcome = Literal["pass", "fail", "error", "terminated_by_budget"]
Severity = Literal["info", "low", "medium", "high", "critical"]
TargetKind = Literal["http", "openai_compatible", "anthropic", "mcp"]

CheckCategory = Literal["AC", "MCP"]


class TargetSpec(BaseModel):
    model_config = ConfigDict(extra="forbid")

    kind: TargetKind
    endpoint: str
    headers: dict[str, str] = Field(default_factory=dict)
    model: str | None = None
    auth_token_env: str | None = None


class BudgetSpec(BaseModel):
    """Budget caps. The first axis to trip terminates the run."""

    model_config = ConfigDict(extra="forbid")

    max_seconds: float = Field(gt=0, le=3600)
    max_calls: int = Field(gt=0, le=100_000)
    max_tokens: int = Field(gt=0, le=100_000_000)
    max_usd: float = Field(ge=0, le=10_000)


class SandboxSpec(BaseModel):
    """Per-run sandbox overrides intersected with the sidecar's settings."""

    model_config = ConfigDict(extra="forbid")

    network_allowlist: list[str] = Field(default_factory=list)
    egress_proxy: str | None = None
    fs_root: str | None = None


class RunRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    check_id: str = Field(min_length=1)
    target: TargetSpec
    params: dict[str, Any] = Field(default_factory=dict)
    budget: BudgetSpec
    sandbox: SandboxSpec = Field(default_factory=SandboxSpec)
    engagement_context: str = Field(
        min_length=1,
        description="Signed JWT proving the auditor's engagement context.",
    )


class ArtifactRef(BaseModel):
    model_config = ConfigDict(extra="forbid")

    relative_path: str
    content_type: str
    bytes: int
    sha256: str


class CheckFinding(BaseModel):
    """A single observation produced by a check."""

    model_config = ConfigDict(extra="forbid")

    finding_id: str
    severity: Severity
    title: str
    description: str
    signal_kind: Literal[
        "auth-required",
        "auth-not-required",
        "rate-limit-enforced",
        "rate-limit-bypassed",
        "input-bounded",
        "input-unbounded",
        "schema-conformant",
        "schema-violation",
        "pii-redacted",
        "pii-leaked",
        "provenance-headers-present",
        "provenance-headers-missing",
        "audit-log-complete",
        "audit-log-missing-entry",
        "tool-catalogue-conformant",
        "tool-catalogue-deviation",
        "allowlist-enforced",
        "off-allowlist-server-accepted",
        "rbac-enforced",
        "rbac-bypassed",
        "isolation-preserved",
        "isolation-broken",
        "gateway-policy-enforced",
        "gateway-policy-bypassed",
        "resource-provenance-conformant",
        "resource-provenance-mismatch",
    ]
    evidence_pointers: list[str] = Field(default_factory=list)


class CheckMetrics(BaseModel):
    model_config = ConfigDict(extra="forbid")

    calls: int = 0
    tokens: int = 0
    usd: float = 0.0
    wall_seconds: float = 0.0


class CheckResult(BaseModel):
    """Final result for a completed run."""

    model_config = ConfigDict(extra="forbid")

    run_id: str
    check_id: str
    status: CheckOutcome
    severity: Severity
    findings: list[CheckFinding] = Field(default_factory=list)
    metrics: CheckMetrics
    evidence_artifacts: list[ArtifactRef] = Field(default_factory=list)
    timestamp_iso: str
    terminated_by_budget: bool = False
    signature: str | None = None
    signature_algorithm: str | None = None
    signature_signer_id: str | None = None

    @field_validator("timestamp_iso")
    @classmethod
    def _validate_iso(cls, v: str) -> str:
        datetime.fromisoformat(v.replace("Z", "+00:00"))
        return v


class RunCreated(BaseModel):
    model_config = ConfigDict(extra="forbid")

    run_id: str


class RunStatus(BaseModel):
    model_config = ConfigDict(extra="forbid")

    run_id: str
    check_id: str
    state: CheckRunState
    started_at: str
    updated_at: str
    metrics: CheckMetrics
    partial_findings: list[CheckFinding] = Field(default_factory=list)
    result: CheckResult | None = None
    error: str | None = None


class CatalogueEntry(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str
    category: CheckCategory
    family: Literal["authn", "rate-limit", "input", "schema", "pii", "provenance", "audit-log", "mcp"]
    severity: Severity
    title: str
    description: str
    inputs_schema: dict[str, Any]
    outputs_schema: dict[str, Any]
    iso42001_clauses: list[str] = Field(default_factory=list)
    annex_a: list[str] = Field(default_factory=list)
    external_refs: list[dict[str, str]] = Field(default_factory=list)


def utcnow_iso() -> str:
    """ISO-8601 UTC timestamp with `Z` suffix; identical formatting across the
    codebase keeps audit-ledger diffs free of cosmetic noise.
    """
    return datetime.now(tz=UTC).strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "Z"

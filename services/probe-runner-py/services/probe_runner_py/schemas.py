# SPDX-License-Identifier: BUSL-1.1
"""Wire schemas shared across HTTP boundary and probe wrappers.

The TS side (`packages/probe-engine/src/external-runner.ts`) parses these via
zod; the field names + types must stay in lockstep. Whenever you add a field
here, mirror it in the zod schema or the contract test breaks.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

ProbeStatus = Literal["queued", "running", "complete", "error", "cancelled"]
ProbeOutcome = Literal["pass", "fail", "error", "terminated_by_budget"]
Severity = Literal["info", "low", "medium", "high", "critical"]
TargetKind = Literal["http", "openai_compatible", "anthropic", "mcp"]


class TargetSpec(BaseModel):
    """The system under test."""

    model_config = ConfigDict(extra="forbid")

    kind: TargetKind
    endpoint: str
    headers: dict[str, str] = Field(default_factory=dict)
    model: str | None = None
    auth_token_env: str | None = None


class BudgetSpec(BaseModel):
    """Budget caps. Whichever fires first terminates the run."""

    model_config = ConfigDict(extra="forbid")

    max_seconds: float = Field(gt=0, le=3600)
    max_calls: int = Field(gt=0, le=100_000)
    max_tokens: int = Field(gt=0, le=100_000_000)
    max_usd: float = Field(ge=0, le=10_000)


class SandboxSpec(BaseModel):
    """Per-run sandbox overrides. Hosts here are intersected with the
    allowlist baked into the sidecar's settings.
    """

    model_config = ConfigDict(extra="forbid")

    network_allowlist: list[str] = Field(default_factory=list)
    egress_proxy: str | None = None
    fs_root: str | None = None


class RunRequest(BaseModel):
    """POST /probes/run body."""

    model_config = ConfigDict(extra="forbid")

    probe_id: str = Field(min_length=1)
    target: TargetSpec
    params: dict[str, Any] = Field(default_factory=dict)
    budget: BudgetSpec
    sandbox: SandboxSpec = Field(default_factory=SandboxSpec)


class ArtifactRef(BaseModel):
    model_config = ConfigDict(extra="forbid")

    relative_path: str
    content_type: str
    bytes: int
    sha256: str


class ProbeFinding(BaseModel):
    """A single observation produced by a probe.

    `signal_kind` lets reviewers diff finding types without parsing free-text
    descriptions.
    """

    model_config = ConfigDict(extra="forbid")

    finding_id: str
    severity: Severity
    title: str
    description: str
    signal_kind: Literal[
        "attack-succeeded",
        "attack-blocked",
        "policy-violation",
        "policy-enforced",
        "leak",
        "no-leak",
        "unauthorized-call-allowed",
        "unauthorized-call-denied",
        "missing-ledger-entry",
        "ledger-complete",
        "isolation-broken",
        "isolation-preserved",
        "rate-limit-bypassed",
        "rate-limit-enforced",
        "tool-poisoning-pattern-detected",
        "tool-poisoning-clean",
        "indirect-injection-followed",
        "indirect-injection-rejected",
        "off-allowlist-server-accepted",
        "allowlist-enforced",
        "auth-not-required",
        "auth-required",
    ]
    evidence_pointers: list[str] = Field(default_factory=list)


class ProbeMetrics(BaseModel):
    """Aggregated counters reported back to the audit ledger."""

    model_config = ConfigDict(extra="forbid")

    calls: int = 0
    tokens: int = 0
    usd: float = 0.0
    wall_seconds: float = 0.0


class ProbeResult(BaseModel):
    """Final result for a completed run."""

    model_config = ConfigDict(extra="forbid")

    run_id: str
    probe_id: str
    status: ProbeOutcome
    severity: Severity
    findings: list[ProbeFinding] = Field(default_factory=list)
    metrics: ProbeMetrics
    evidence_artifacts: list[ArtifactRef] = Field(default_factory=list)
    timestamp_iso: str

    @field_validator("timestamp_iso")
    @classmethod
    def _validate_iso(cls, v: str) -> str:
        datetime.fromisoformat(v.replace("Z", "+00:00"))
        return v


class RunCreated(BaseModel):
    model_config = ConfigDict(extra="forbid")

    run_id: str


class RunStatus(BaseModel):
    """GET /probes/runs/:runId envelope."""

    model_config = ConfigDict(extra="forbid")

    run_id: str
    probe_id: str
    state: ProbeStatus
    started_at: str
    updated_at: str
    metrics: ProbeMetrics
    partial_findings: list[ProbeFinding] = Field(default_factory=list)
    result: ProbeResult | None = None
    error: str | None = None


class CatalogueEntry(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str
    family: Literal["garak", "pyrit", "harmbench", "mcp"]
    upstream_id: str | None = None
    category: str
    severity: Severity
    description: str
    inputs_schema: dict[str, Any]
    outputs_schema: dict[str, Any]
    requires: list[str] = Field(default_factory=list)


def utcnow_iso() -> str:
    """ISO-8601 UTC timestamp with `Z` suffix; identical formatting across the
    codebase keeps audit-ledger diffs free of cosmetic noise.
    """

    return datetime.now(tz=timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "Z"

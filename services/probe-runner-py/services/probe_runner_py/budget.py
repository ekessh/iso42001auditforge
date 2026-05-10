# SPDX-License-Identifier: BUSL-1.1
"""Per-run budget tracking.

Probes call `tracker.charge(...)` after every model invocation. If any cap is
exceeded, the next call to `tracker.assert_within()` raises and the probe
records a `terminated_by_budget` outcome. We split charge / assert so a probe
can record the cost of a call before bailing out — keeping accounting honest.
"""

from __future__ import annotations

import time
from dataclasses import dataclass, field

from .schemas import BudgetSpec, ProbeMetrics


class BudgetExceededError(RuntimeError):
    """Raised when any of the four caps would be breached."""

    def __init__(self, cap: str, used: float, limit: float) -> None:
        super().__init__(
            f"Budget exceeded: {cap} (used {used:.4g} of {limit:.4g})"
        )
        self.cap = cap
        self.used = used
        self.limit = limit


@dataclass(slots=True)
class BudgetTracker:
    """Mutable per-run accumulator backed by a `BudgetSpec`."""

    spec: BudgetSpec
    started_at: float = field(default_factory=time.monotonic)
    calls: int = 0
    tokens: int = 0
    usd: float = 0.0

    @property
    def wall_seconds(self) -> float:
        return time.monotonic() - self.started_at

    def charge(self, *, calls: int = 1, tokens: int = 0, usd: float = 0.0) -> None:
        self.calls += calls
        self.tokens += tokens
        self.usd += usd

    def assert_within(self) -> None:
        if self.wall_seconds > self.spec.max_seconds:
            raise BudgetExceededError("max_seconds", self.wall_seconds, self.spec.max_seconds)
        if self.calls > self.spec.max_calls:
            raise BudgetExceededError("max_calls", self.calls, self.spec.max_calls)
        if self.tokens > self.spec.max_tokens:
            raise BudgetExceededError("max_tokens", self.tokens, self.spec.max_tokens)
        if self.usd > self.spec.max_usd:
            raise BudgetExceededError("max_usd", self.usd, self.spec.max_usd)

    def metrics(self) -> ProbeMetrics:
        return ProbeMetrics(
            calls=self.calls,
            tokens=self.tokens,
            usd=round(self.usd, 6),
            wall_seconds=round(self.wall_seconds, 4),
        )

    def deadline_seconds(self) -> float:
        """Remaining wall-clock budget — used to bound httpx timeouts so the
        next request never blocks past the budget cliff.
        """

        remaining = self.spec.max_seconds - self.wall_seconds
        return max(0.5, min(remaining, 60.0))

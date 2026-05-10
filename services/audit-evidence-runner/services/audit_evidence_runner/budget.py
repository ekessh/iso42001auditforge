# SPDX-License-Identifier: BUSL-1.1
"""Budget enforcement for audit-evidence checks.

Four axes are tracked: wall-clock seconds, HTTP calls, model tokens, and USD.
Whichever axis trips first terminates the run and surfaces partial results.
"""

from __future__ import annotations

import time
from dataclasses import dataclass, field

from .schemas import BudgetSpec


class BudgetExceeded(Exception):
    """Raised when any budget axis is exhausted."""

    def __init__(self, axis: str, used: float, cap: float) -> None:
        super().__init__(f"budget axis '{axis}' exceeded: used={used} cap={cap}")
        self.axis = axis
        self.used = used
        self.cap = cap


@dataclass
class BudgetTracker:
    spec: BudgetSpec
    start_monotonic: float = field(default_factory=time.monotonic)
    calls: int = 0
    tokens: int = 0
    usd: float = 0.0

    def wall_seconds(self) -> float:
        return time.monotonic() - self.start_monotonic

    def add_call(self, tokens: int = 0, usd: float = 0.0) -> None:
        self.calls += 1
        self.tokens += int(tokens)
        self.usd += float(usd)
        self.assert_within()

    def assert_within(self) -> None:
        if self.wall_seconds() >= self.spec.max_seconds:
            raise BudgetExceeded("wall_seconds", self.wall_seconds(), self.spec.max_seconds)
        if self.calls >= self.spec.max_calls:
            raise BudgetExceeded("calls", self.calls, self.spec.max_calls)
        if self.tokens >= self.spec.max_tokens:
            raise BudgetExceeded("tokens", self.tokens, self.spec.max_tokens)
        if self.usd >= self.spec.max_usd and self.spec.max_usd > 0:
            raise BudgetExceeded("usd", self.usd, self.spec.max_usd)

    def snapshot(self) -> dict[str, float | int]:
        return {
            "calls": self.calls,
            "tokens": self.tokens,
            "usd": self.usd,
            "wall_seconds": round(self.wall_seconds(), 4),
        }

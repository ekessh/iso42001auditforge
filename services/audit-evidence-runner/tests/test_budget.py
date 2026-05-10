# SPDX-License-Identifier: BUSL-1.1
"""Budget enforcement: each axis trips independently."""

from __future__ import annotations

import time

import pytest

from services.audit_evidence_runner.budget import BudgetExceeded, BudgetTracker
from services.audit_evidence_runner.schemas import BudgetSpec


def test_calls_axis_trips() -> None:
    spec = BudgetSpec(max_seconds=60.0, max_calls=2, max_tokens=10_000, max_usd=1.0)
    t = BudgetTracker(spec=spec)
    t.add_call()
    with pytest.raises(BudgetExceeded) as exc:
        t.add_call()
    assert exc.value.axis == "calls"


def test_tokens_axis_trips() -> None:
    spec = BudgetSpec(max_seconds=60.0, max_calls=10, max_tokens=100, max_usd=1.0)
    t = BudgetTracker(spec=spec)
    with pytest.raises(BudgetExceeded) as exc:
        t.add_call(tokens=200)
    assert exc.value.axis == "tokens"


def test_usd_axis_trips() -> None:
    spec = BudgetSpec(max_seconds=60.0, max_calls=10, max_tokens=10_000, max_usd=0.5)
    t = BudgetTracker(spec=spec)
    with pytest.raises(BudgetExceeded) as exc:
        t.add_call(usd=1.0)
    assert exc.value.axis == "usd"


def test_wall_seconds_axis_trips() -> None:
    spec = BudgetSpec(max_seconds=0.05, max_calls=10, max_tokens=10_000, max_usd=1.0)
    t = BudgetTracker(spec=spec)
    time.sleep(0.06)
    with pytest.raises(BudgetExceeded) as exc:
        t.assert_within()
    assert exc.value.axis == "wall_seconds"


def test_snapshot_shape() -> None:
    spec = BudgetSpec(max_seconds=60.0, max_calls=10, max_tokens=10_000, max_usd=1.0)
    t = BudgetTracker(spec=spec)
    t.add_call(tokens=10, usd=0.001)
    snap = t.snapshot()
    assert snap["calls"] == 1
    assert snap["tokens"] == 10
    assert snap["usd"] == pytest.approx(0.001)
    assert snap["wall_seconds"] >= 0

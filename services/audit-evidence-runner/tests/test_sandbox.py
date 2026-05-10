# SPDX-License-Identifier: BUSL-1.1
"""Sandbox enforcement tests: egress allowlist + fs traversal."""

from __future__ import annotations

import pytest

from services.audit_evidence_runner.config import Settings
from services.audit_evidence_runner.sandbox import (
    EgressDenied,
    FsTraversalError,
    SandboxConfigError,
    ensure_run_fs_root,
    host_allowed,
    make_http_client,
    safe_path,
)


def test_host_allowed_exact_and_wildcard() -> None:
    allow = ["audit.test", "*.audit.test"]
    assert host_allowed("audit.test", allow)
    assert host_allowed("api.audit.test", allow)
    assert not host_allowed("evil.example.com", allow)
    assert not host_allowed("audit.test", [])


async def test_make_http_client_refuses_off_allowlist(tmp_path) -> None:
    settings = Settings(
        egress_proxy="",
        allowed_hosts="audit.test",
        fs_root=str(tmp_path),
        engagement_jwt_secret="x",
    )
    async with make_http_client(settings) as client:
        with pytest.raises(EgressDenied):
            await client.get("https://evil.example.com/")


async def test_make_http_client_refuses_when_no_proxy_no_allowlist(tmp_path) -> None:
    settings = Settings(
        egress_proxy="",
        allowed_hosts="",
        fs_root=str(tmp_path),
        engagement_jwt_secret="x",
    )
    with pytest.raises(SandboxConfigError):
        make_http_client(settings)


def test_safe_path_blocks_traversal(tmp_path) -> None:
    root = ensure_run_fs_root(str(tmp_path), "run-1")
    ok = safe_path(root, "evidence/result.json")
    assert root in ok.parents

    with pytest.raises(FsTraversalError):
        safe_path(root, "../../etc/passwd")

    with pytest.raises(FsTraversalError):
        safe_path(root, "/etc/passwd")

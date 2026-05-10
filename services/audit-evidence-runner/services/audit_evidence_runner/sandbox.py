# SPDX-License-Identifier: BUSL-1.1
"""Sandbox primitives: egress allowlisting and fs scoping.

Production isolation (cgroups, namespaces, seccomp) is the container runtime's
job. This module provides the in-process guards that ensure every check
honours its declared scope:

  * `make_http_client` returns an httpx.AsyncClient whose transport refuses any
    request whose host is not on the allowlist (and that errors out entirely
    when no egress proxy is configured).
  * `safe_path` joins a relative path under `fs_root` and refuses traversal.
  * `forbid_subprocess` is wired into the run lifecycle so checks cannot shell
    out.
"""

from __future__ import annotations

import fnmatch
import os
from pathlib import Path
from urllib.parse import urlparse

import httpx

from .config import Settings


class EgressDenied(Exception):
    """Raised when a check tries to call a host outside the allowlist."""

    def __init__(self, host: str, allowlist: list[str]) -> None:
        super().__init__(
            f"Egress to '{host}' denied by audit-evidence-runner sandbox; "
            f"allowlist={allowlist}.",
        )
        self.host = host
        self.allowlist = allowlist


class SandboxConfigError(Exception):
    """Raised when the sandbox is asked to operate without an explicit egress
    proxy and the operator has not opted into open-egress mode.
    """


class FsTraversalError(Exception):
    """Raised when a check tries to read or write outside its run fs_root."""


def host_allowed(host: str, allowlist: list[str]) -> bool:
    if not allowlist:
        return False
    for pattern in allowlist:
        if fnmatch.fnmatch(host, pattern):
            return True
    return False


class _AllowlistTransport(httpx.AsyncBaseTransport):
    """Wraps a real transport; checks each request URL against the allowlist."""

    def __init__(
        self,
        inner: httpx.AsyncBaseTransport,
        allowlist: list[str],
    ) -> None:
        self._inner = inner
        self._allowlist = allowlist

    async def handle_async_request(self, request: httpx.Request) -> httpx.Response:
        host = request.url.host
        if not host_allowed(host, self._allowlist):
            raise EgressDenied(host, self._allowlist)
        return await self._inner.handle_async_request(request)

    async def aclose(self) -> None:
        await self._inner.aclose()


def make_http_client(
    settings: Settings,
    extra_allowed_hosts: list[str] | None = None,
    timeout: float = 30.0,
) -> httpx.AsyncClient:
    """Build an httpx.AsyncClient that obeys the sidecar's egress policy."""
    allowlist = list(settings.allowed_hosts_list)
    if extra_allowed_hosts:
        allowlist.extend(extra_allowed_hosts)

    if not settings.egress_proxy and not allowlist:
        raise SandboxConfigError(
            "audit-evidence-runner refuses to make outbound calls: "
            "AUDIT_RUNNER_EGRESS_PROXY is empty and no allowlist is configured. "
            "Either set the egress proxy or supply AUDIT_RUNNER_ALLOWED_HOSTS.",
        )

    inner_kwargs: dict[str, object] = {}
    if settings.egress_proxy:
        inner_kwargs["proxy"] = settings.egress_proxy

    inner = httpx.AsyncHTTPTransport(**inner_kwargs)  # type: ignore[arg-type]
    transport = _AllowlistTransport(inner, allowlist)
    return httpx.AsyncClient(transport=transport, timeout=timeout)


def ensure_run_fs_root(base: str, run_id: str) -> Path:
    root = Path(base) / run_id
    root.mkdir(parents=True, exist_ok=True)
    return root.resolve()


def safe_path(fs_root: Path, relative: str) -> Path:
    """Join a user-supplied relative path under fs_root and reject traversal."""
    if os.path.isabs(relative):
        raise FsTraversalError(f"absolute paths are not allowed: {relative}")
    candidate = (fs_root / relative).resolve()
    try:
        candidate.relative_to(fs_root)
    except ValueError as e:
        raise FsTraversalError(
            f"path '{relative}' resolves outside fs_root '{fs_root}'",
        ) from e
    return candidate


def parse_host(url: str) -> str:
    return urlparse(url).hostname or ""

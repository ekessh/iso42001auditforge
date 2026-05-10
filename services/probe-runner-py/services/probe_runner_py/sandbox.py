# SPDX-License-Identifier: BUSL-1.1
"""Sandbox primitives.

Two layers of defence:

1. `AllowlistTransport` wraps `httpx.AsyncHTTPTransport` and rejects requests
   whose host is not on the per-run allowlist. Wildcard prefixes (`*.example`)
   are honoured.
2. `SandboxedFs` confines all filesystem writes to a per-run subdirectory of
   `Settings.fs_root`. Path traversal (`..`) is rejected before any I/O.

Subprocess execution is gated by `Settings.allow_subprocess`. Probes call
`run_subprocess()` which raises if the gate is closed.
"""

from __future__ import annotations

import asyncio
import fnmatch
import os
import shutil
from collections.abc import AsyncIterator, Iterable
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

import httpx

from .config import Settings


class EgressDeniedError(RuntimeError):
    """Raised when a probe tries to reach a host not on the allowlist."""


class FsTraversalError(RuntimeError):
    """Raised when a probe tries to write outside its sandbox root."""


class SubprocessDisabledError(RuntimeError):
    """Raised when a probe tries to spawn a subprocess but the gate is closed."""


def _host_matches(host: str, allowlist: Iterable[str]) -> bool:
    """Glob-aware host matcher. `*.foo.com` matches `bar.foo.com`."""

    host = host.lower()
    for pattern in allowlist:
        p = pattern.lower()
        if host == p:
            return True
        if fnmatch.fnmatch(host, p):
            return True
    return False


class AllowlistTransport(httpx.AsyncBaseTransport):
    """httpx transport that enforces a host allowlist before delegating.

    Probes always go through this transport — there is no escape hatch — so a
    misbehaving wrapper cannot exfiltrate evidence to an arbitrary host.
    """

    def __init__(
        self,
        allowlist: Iterable[str],
        *,
        proxy: str | None = None,
        denied_log: list[dict[str, str]] | None = None,
    ) -> None:
        self._allowlist = tuple(allowlist)
        self._denied_log = denied_log if denied_log is not None else []
        if proxy:
            self._inner: httpx.AsyncBaseTransport = httpx.AsyncHTTPTransport(
                proxy=httpx.Proxy(proxy)
            )
        else:
            self._inner = httpx.AsyncHTTPTransport()

    async def handle_async_request(self, request: httpx.Request) -> httpx.Response:
        url = request.url
        if not _host_matches(url.host, self._allowlist):
            self._denied_log.append({"host": url.host, "url": str(url)})
            raise EgressDeniedError(
                f"Egress to {url.host} blocked by allowlist (probes must declare hosts up-front)."
            )
        return await self._inner.handle_async_request(request)

    async def aclose(self) -> None:
        await self._inner.aclose()


@asynccontextmanager
async def sandboxed_client(
    allowlist: Iterable[str],
    *,
    proxy: str | None = None,
    denied_log: list[dict[str, str]] | None = None,
    timeout_seconds: float = 30.0,
) -> AsyncIterator[httpx.AsyncClient]:
    """Yield an httpx client whose only outbound transport is allowlist-checked."""

    transport = AllowlistTransport(allowlist, proxy=proxy, denied_log=denied_log)
    async with httpx.AsyncClient(
        transport=transport,
        timeout=httpx.Timeout(timeout_seconds),
        follow_redirects=False,
    ) as client:
        yield client


class SandboxedFs:
    """Filesystem confined to `<fs_root>/<run_id>/`. All paths normalise here.

    The class never resolves symlinks outside the root — `_inside()` rejects
    any resolved path that does not have the root as a prefix.
    """

    def __init__(self, root: Path, run_id: str) -> None:
        self._root = (root / run_id).resolve()
        self._root.mkdir(parents=True, exist_ok=True)

    @property
    def root(self) -> Path:
        return self._root

    def _inside(self, candidate: Path) -> Path:
        resolved = candidate.resolve()
        if self._root not in resolved.parents and resolved != self._root:
            raise FsTraversalError(
                f"Path {candidate} escapes sandbox root {self._root}"
            )
        return resolved

    def write_bytes(self, relative_path: str, payload: bytes) -> Path:
        if Path(relative_path).is_absolute() or ".." in Path(relative_path).parts:
            raise FsTraversalError(f"Refusing absolute or traversing path: {relative_path!r}")
        target = self._root / relative_path
        target.parent.mkdir(parents=True, exist_ok=True)
        target = self._inside(target)
        target.write_bytes(payload)
        return target

    def cleanup(self) -> None:
        if self._root.exists():
            shutil.rmtree(self._root, ignore_errors=True)


async def run_subprocess(
    *,
    settings: Settings,
    args: list[str],
    timeout_seconds: float,
    cwd: Path | None = None,
    env: dict[str, str] | None = None,
) -> tuple[int, str, str]:
    """Bounded subprocess execution. Off by default.

    The TS-side already runs upstream tools (garak / pyrit / harmbench) inside
    its own sandbox; this hook is provided only for advanced users who want to
    let the sidecar invoke them directly.
    """

    if not settings.allow_subprocess:
        raise SubprocessDisabledError(
            "Subprocess execution disabled (set AUDITFORGE_PR_ALLOW_SUBPROCESS=true to enable)."
        )

    proc = await asyncio.create_subprocess_exec(
        *args,
        cwd=str(cwd) if cwd else None,
        env={**os.environ, **(env or {})},
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    try:
        stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=timeout_seconds)
    except asyncio.TimeoutError:
        proc.kill()
        await proc.wait()
        raise
    return (
        proc.returncode if proc.returncode is not None else -1,
        stdout.decode("utf-8", errors="replace"),
        stderr.decode("utf-8", errors="replace"),
    )


__all__ = [
    "AllowlistTransport",
    "EgressDeniedError",
    "FsTraversalError",
    "SandboxedFs",
    "SubprocessDisabledError",
    "_host_matches",
    "run_subprocess",
    "sandboxed_client",
]


def _ensure_settings_has(settings: Any) -> Settings:
    """Cast helper for the type checker; returns the input unchanged."""

    return settings  # type: ignore[no-any-return]

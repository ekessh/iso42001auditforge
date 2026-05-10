# SPDX-License-Identifier: BUSL-1.1
"""Sidecar runtime configuration.

Pure pydantic-settings; no I/O at import time. The sidecar is an opt-in
component, so we fail open with sane local defaults rather than refusing to
boot when an env var is missing.
"""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Sidecar settings loaded from env (prefix: AUDITFORGE_PR_)."""

    model_config = SettingsConfigDict(
        env_prefix="AUDITFORGE_PR_",
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    host: str = "0.0.0.0"
    port: int = 8088

    # Sandbox defaults.
    fs_root: Path = Field(default=Path("/tmp/auditforge-probes"))
    egress_proxy: str | None = None
    allowed_hosts: list[str] = Field(default_factory=list)

    # Hard global ceilings (per-run budgets cap to these).
    max_seconds_ceiling: int = 600
    max_calls_ceiling: int = 5_000
    max_tokens_ceiling: int = 5_000_000
    max_usd_ceiling: float = 50.0

    # Persistence cap. The sidecar is stateless modulo the in-process run
    # registry; we evict completed runs after this many minutes.
    run_retention_minutes: int = 60

    # Disabled by default; the runner refuses to spawn arbitrary subprocesses
    # unless explicitly enabled. garak/pyrit wrappers are exempted because they
    # are themselves the wrapped tool.
    allow_subprocess: bool = False


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Cached settings accessor used as a FastAPI dependency."""

    return Settings()

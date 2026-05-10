# SPDX-License-Identifier: BUSL-1.1
"""Runtime configuration for the audit-evidence-runner sidecar.

Settings are loaded from environment variables (the canonical 12-factor pattern
for sidecars) and are immutable after construction.
"""

from __future__ import annotations

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_prefix="AUDIT_RUNNER_",
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    host: str = "0.0.0.0"
    port: int = 8088

    egress_proxy: str = ""
    allowed_hosts: str = ""

    fs_root: str = "/tmp/auditforge-checks"  # noqa: S108 — sidecar fs root is intentionally tmp

    engagement_jwt_secret: str = ""
    engagement_jwt_algorithm: str = "HS256"
    engagement_jwt_audience: str = "auditforge-audit-evidence-runner"
    engagement_jwt_issuer: str = "auditforge-api"
    engagement_jwt_required: bool = True

    signing_endpoint: str = ""
    signing_signer_id: str = "audit-evidence-runner"
    signing_api_token: str = ""

    max_concurrent_runs: int = 8

    @property
    def allowed_hosts_list(self) -> list[str]:
        return [h.strip() for h in self.allowed_hosts.split(",") if h.strip()]


def get_settings() -> Settings:
    return Settings()

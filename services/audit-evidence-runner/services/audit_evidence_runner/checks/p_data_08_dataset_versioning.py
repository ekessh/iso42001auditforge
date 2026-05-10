# SPDX-License-Identifier: BUSL-1.1
"""P-DATA-08 — Dataset-Versioning.

Verifies the dataset version pin used in production matches the pin in the
latest model card. Reads two endpoints (production deployment record + latest
model card) and asserts equality.
"""

from __future__ import annotations

import httpx

from ..schemas import CheckFinding, Severity
from .base import AuditEvidenceCheck, CheckContext, make_finding, register


class PData08DatasetVersioning(AuditEvidenceCheck):
    id = "P-DATA-08"
    category = "AC"
    family = "provenance"
    title = "Dataset-Versioning"
    description = (
        "Verifies the dataset version pin in the production deployment "
        "record matches the pin in the latest model card."
    )
    severity: Severity = "high"
    iso42001_clauses = ["7.5", "8.3"]
    annex_a = ["A.7.5", "A.6.2.7"]
    inputs_schema = {
        "type": "object",
        "properties": {
            "deployment_url": {"type": "string"},
            "model_card_url": {"type": "string"},
            "deployment_field": {"type": "string", "default": "dataset_version"},
            "card_field": {"type": "string", "default": "dataset_version"},
            "auth_header": {"type": "string"},
        },
        "required": ["deployment_url", "model_card_url"],
        "additionalProperties": False,
    }

    async def execute(
        self, ctx: CheckContext,
    ) -> tuple[str, Severity, list[CheckFinding]]:
        deploy_url = str(ctx.params["deployment_url"])
        card_url = str(ctx.params["model_card_url"])
        deploy_field = str(ctx.params.get("deployment_field", "dataset_version"))
        card_field = str(ctx.params.get("card_field", "dataset_version"))
        headers = {"accept": "application/json"}
        if auth_header := ctx.params.get("auth_header"):
            headers["authorization"] = auth_header

        async def _read(url: str, field: str) -> str | None:
            try:
                ctx.budget.add_call()
                r = await ctx.http.get(url, headers=headers)
                r.raise_for_status()
                payload = r.json()
            except (httpx.HTTPError, ValueError):
                return None
            if not isinstance(payload, dict):
                return None
            value = payload.get(field)
            return str(value) if value is not None else None

        deploy_version = await _read(deploy_url, deploy_field)
        card_version = await _read(card_url, card_field)

        if deploy_version is None or card_version is None:
            return (
                "error",
                "medium",
                [
                    make_finding(
                        self.id,
                        "medium",
                        "Could not fetch dataset version pins",
                        f"deployment={deploy_version!r}, model_card={card_version!r}",
                        "provenance-headers-missing",
                    ),
                ],
            )
        if deploy_version == card_version:
            return (
                "pass",
                "info",
                [
                    make_finding(
                        self.id,
                        "info",
                        "Dataset version pin matches",
                        f"deployment={deploy_version} == model_card={card_version}.",
                        "provenance-headers-present",
                    ),
                ],
            )
        return (
            "fail",
            self.severity,
            [
                make_finding(
                    self.id,
                    self.severity,
                    "Dataset version pin drift",
                    f"deployment={deploy_version}, model_card={card_version}.",
                    "provenance-headers-missing",
                ),
            ],
        )


register(PData08DatasetVersioning())

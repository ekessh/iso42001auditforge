# SPDX-License-Identifier: BUSL-1.1
"""Engagement-context JWT verification.

Every /checks/run request must carry a signed JWT proving the auditor's
engagement is in scope. The shared secret (HS256 by default) is provisioned by
`apps/api`. Asymmetric algorithms (RS256, ES256) work too if the secret is a
PEM-encoded public key.
"""

from __future__ import annotations

from dataclasses import dataclass

import jwt
from jwt import InvalidTokenError

from .config import Settings


class EngagementContextError(Exception):
    """Raised when an engagement-context JWT is missing or invalid."""


@dataclass(frozen=True)
class EngagementContext:
    """Verified claims relevant to authorising a run."""

    engagement_id: str
    auditor_id: str
    audit_mode: str
    raw_claims: dict[str, object]


def verify_engagement_context(token: str, settings: Settings) -> EngagementContext:
    if not settings.engagement_jwt_required:
        return EngagementContext(
            engagement_id=str(_safe_decode(token).get("engagementId", "dev")),
            auditor_id=str(_safe_decode(token).get("auditorId", "dev")),
            audit_mode=str(_safe_decode(token).get("mode", "audit")),
            raw_claims=_safe_decode(token),
        )

    if not settings.engagement_jwt_secret:
        raise EngagementContextError(
            "AUDIT_RUNNER_ENGAGEMENT_JWT_SECRET not configured; refusing to accept any run.",
        )

    try:
        claims = jwt.decode(
            token,
            settings.engagement_jwt_secret,
            algorithms=[settings.engagement_jwt_algorithm],
            audience=settings.engagement_jwt_audience,
            issuer=settings.engagement_jwt_issuer,
        )
    except InvalidTokenError as e:
        raise EngagementContextError(f"engagement-context JWT invalid: {e}") from e

    engagement_id = claims.get("engagementId")
    auditor_id = claims.get("auditorId")
    if not engagement_id or not auditor_id:
        raise EngagementContextError("engagement-context missing engagementId or auditorId")

    return EngagementContext(
        engagement_id=str(engagement_id),
        auditor_id=str(auditor_id),
        audit_mode=str(claims.get("mode", "audit")),
        raw_claims=dict(claims),
    )


def _safe_decode(token: str) -> dict[str, object]:
    try:
        return jwt.decode(token, options={"verify_signature": False})
    except InvalidTokenError:
        return {}

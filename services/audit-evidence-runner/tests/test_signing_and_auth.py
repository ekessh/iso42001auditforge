# SPDX-License-Identifier: BUSL-1.1
"""Signing + JWT verification unit tests."""

from __future__ import annotations

import base64

import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PublicKey

from services.audit_evidence_runner.auth import (
    EngagementContextError,
    verify_engagement_context,
)
from services.audit_evidence_runner.config import Settings
from services.audit_evidence_runner.signing import (
    SoftwareSigningProvider,
    canonical_json_bytes,
)


def _settings(secret: str) -> Settings:
    return Settings(
        engagement_jwt_secret=secret,
        engagement_jwt_algorithm="HS256",
        engagement_jwt_audience="auditforge-audit-evidence-runner",
        engagement_jwt_issuer="auditforge-api",
        engagement_jwt_required=True,
    )


def test_jwt_verification_success() -> None:
    s = _settings("k")
    token = jwt.encode(
        {
            "engagementId": "eng-1",
            "auditorId": "aud-1",
            "aud": s.engagement_jwt_audience,
            "iss": s.engagement_jwt_issuer,
        },
        "k",
        algorithm="HS256",
    )
    ctx = verify_engagement_context(token, s)
    assert ctx.engagement_id == "eng-1"
    assert ctx.auditor_id == "aud-1"


def test_jwt_verification_invalid_signature() -> None:
    s = _settings("k")
    token = jwt.encode(
        {
            "engagementId": "eng-1",
            "auditorId": "aud-1",
            "aud": s.engagement_jwt_audience,
            "iss": s.engagement_jwt_issuer,
        },
        "wrong-key",
        algorithm="HS256",
    )
    with pytest.raises(EngagementContextError):
        verify_engagement_context(token, s)


def test_jwt_verification_missing_secret() -> None:
    s = _settings("")
    with pytest.raises(EngagementContextError):
        verify_engagement_context("any-token", s)


async def test_software_signer_round_trip() -> None:
    provider = SoftwareSigningProvider(signer_id="audit-evidence-runner")
    payload = canonical_json_bytes({"hello": "world"})
    sig = await provider.sign(payload)
    assert sig.algorithm == "Ed25519"
    assert sig.signer_id == "audit-evidence-runner"
    assert sig.public_key_b64

    raw_pub = base64.b64decode(sig.public_key_b64)
    pub = Ed25519PublicKey.from_public_bytes(raw_pub)
    raw_sig = base64.b64decode(sig.signature_b64)
    pub.verify(raw_sig, payload)


async def test_software_signer_export_and_reload() -> None:
    p1 = SoftwareSigningProvider(signer_id="x")
    pem = p1.export_private_pem()
    p2 = SoftwareSigningProvider(signer_id="x", key_pem=pem)
    payload = canonical_json_bytes({"a": 1})
    s1 = await p1.sign(payload)
    s2 = await p2.sign(payload)
    assert s1.public_key_b64 == s2.public_key_b64

# SPDX-License-Identifier: BUSL-1.1
"""Ed25519 signing for run results.

For this milestone we mirror packages/signing's `SoftwareSigningProvider`:
generate (or load from env) an Ed25519 key, sign canonicalised JSON, and emit
a base64 signature plus the public key. Cross-language signing (calling out to
apps/api) is exposed via `RemoteSigningProvider` and selected when
AUDIT_RUNNER_SIGNING_ENDPOINT is set.

Only the result envelope is signed. Receipt chaining (prevHash) is the
responsibility of the audit-ledger consumer in apps/api.
"""

from __future__ import annotations

import base64
import json
from abc import ABC, abstractmethod
from dataclasses import dataclass

import httpx
from cryptography.hazmat.primitives.asymmetric.ed25519 import (
    Ed25519PrivateKey,
    Ed25519PublicKey,
)
from cryptography.hazmat.primitives.serialization import (
    Encoding,
    NoEncryption,
    PrivateFormat,
    PublicFormat,
    load_pem_private_key,
)

from .config import Settings


@dataclass(frozen=True)
class SigningResult:
    signature_b64: str
    algorithm: str
    signer_id: str
    public_key_b64: str | None = None


class SigningProvider(ABC):
    @abstractmethod
    async def sign(self, payload: bytes) -> SigningResult: ...


class SoftwareSigningProvider(SigningProvider):
    """Ed25519 signer kept in-process. Mirrors packages/signing's software
    provider so test parity is straightforward.
    """

    def __init__(self, signer_id: str, key_pem: str | None = None) -> None:
        self._signer_id = signer_id
        if key_pem:
            loaded = load_pem_private_key(key_pem.encode("utf-8"), password=None)
            if not isinstance(loaded, Ed25519PrivateKey):
                raise TypeError("AUDIT_RUNNER signing key must be Ed25519")
            self._private = loaded
        else:
            self._private = Ed25519PrivateKey.generate()

    async def sign(self, payload: bytes) -> SigningResult:
        sig = self._private.sign(payload)
        public = self._private.public_key()
        public_bytes = public.public_bytes(Encoding.Raw, PublicFormat.Raw)
        return SigningResult(
            signature_b64=base64.b64encode(sig).decode("ascii"),
            algorithm="Ed25519",
            signer_id=self._signer_id,
            public_key_b64=base64.b64encode(public_bytes).decode("ascii"),
        )

    def export_private_pem(self) -> str:
        return self._private.private_bytes(
            Encoding.PEM,
            PrivateFormat.PKCS8,
            NoEncryption(),
        ).decode("ascii")

    def public_key(self) -> Ed25519PublicKey:
        return self._private.public_key()


class RemoteSigningProvider(SigningProvider):
    """Calls out to apps/api's signing endpoint. Used in production where the
    canonical Ed25519 key lives in the API process so all receipts share one
    chain.
    """

    def __init__(self, endpoint: str, signer_id: str, api_token: str | None) -> None:
        self._endpoint = endpoint
        self._signer_id = signer_id
        self._token = api_token

    async def sign(self, payload: bytes) -> SigningResult:
        headers: dict[str, str] = {"content-type": "application/json"}
        if self._token:
            headers["authorization"] = f"Bearer {self._token}"
        async with httpx.AsyncClient(timeout=10.0) as client:
            res = await client.post(
                self._endpoint,
                headers=headers,
                content=json.dumps(
                    {
                        "signerId": self._signer_id,
                        "payloadB64": base64.b64encode(payload).decode("ascii"),
                    },
                ),
            )
            res.raise_for_status()
            body = res.json()
        return SigningResult(
            signature_b64=body["signature"],
            algorithm=body.get("algorithm", "Ed25519"),
            signer_id=body.get("signerId", self._signer_id),
            public_key_b64=body.get("publicKeyBase64"),
        )


def build_signing_provider(settings: Settings) -> SigningProvider:
    if settings.signing_endpoint:
        return RemoteSigningProvider(
            settings.signing_endpoint,
            settings.signing_signer_id,
            settings.signing_api_token or None,
        )
    return SoftwareSigningProvider(settings.signing_signer_id)


def canonical_json_bytes(value: object) -> bytes:
    """RFC 8785-style canonical JSON: sorted keys, no whitespace, UTF-8."""
    return json.dumps(value, sort_keys=True, separators=(",", ":")).encode("utf-8")

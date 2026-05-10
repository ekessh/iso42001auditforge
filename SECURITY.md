<!-- SPDX-License-Identifier: BUSL-1.1 -->
# Security Policy

## Reporting a Vulnerability

Report all suspected vulnerabilities **privately** to:

**Ekessh Thoralingam** — <ekesshtks@gmail.com>

Do **not** open a public GitHub issue, do **not** post details on social
media, and do **not** include vulnerability details in any pull request
or commit message.

We follow a 90-day coordinated-disclosure window by default. Critical issues
affecting customer audit data may shorten this window.

## Scope

In scope:
- All code in `core/**` and `commercial/**`
- Default Docker Compose and Helm deployments shipped in `infra-core/`
- Released container images and signed binaries

Out of scope:
- Third-party dependencies (report upstream)
- Self-hosted deployments customized by operators (we treat as best-effort)
- Social engineering / physical attacks against users

## Hall of Fame

We credit responsible reporters in `docs/SECURITY-HALL-OF-FAME.md` (opt-in).

## Bug Bounty

Once we exit beta, a paid bounty program will be announced here.

## Security Posture

- All releases are signed with Sigstore Cosign.
- Container images include SBOM (CycloneDX) and provenance (SLSA L3 target).
- Per-PR scanning: Semgrep (SAST), gitleaks (secrets), OSV-Scanner (SCA),
  Trivy (containers).
- External penetration test annually (and once before public launch).
- Threat model maintained at `docs/architecture/threat-model.md`.

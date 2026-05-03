# Security Policy

## Reporting a Vulnerability

Please report security vulnerabilities **privately** — do not open public issues.

- Email: security@auditforge.example (PGP key in `SECURITY-PGP.txt`)
- GitHub Security Advisory: use the "Report a vulnerability" button on the repo

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

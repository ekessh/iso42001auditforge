# @auditforge/auth-core

Framework-agnostic authentication and authorization primitives. Consumed by the
NestJS API in `apps/api`, the desktop shell, and the CLI.

## Modules

- **`rbac`** — 9-role × resource × action permission matrix. `can(role, action, resource)`.
- **`oidc`** — wrapper around `openid-client` v6 for discovery, code-flow, and token refresh.
- **`webauthn`** — `@simplewebauthn/server` v11 wrapper for registration + authentication.
- **`jwt`** — `jose`-based signing + verification with replay-rejection nonce store.
- **`password`** — argon2id hashing for service accounts only.

## Roles

| Role | Description |
|------|-------------|
| `super_admin` | Platform operator |
| `firm_admin` | CB/firm tenant admin |
| `lead_auditor` | Owns engagements |
| `team_auditor` | Section-scoped contributor |
| `technical_expert` | AI/ML probe runner |
| `audit_manager` | Scheme manager, scheduling |
| `peer_reviewer` | Pre-issuance reviewer |
| `client_user` | Auditee user (limited portal) |
| `accreditation_auditor` | Read-only file inspector |

The matrix is exhaustive: every (role, resource, action) tuple is enumerated as
a TypeScript constant. Tests verify that no tuple is missing.

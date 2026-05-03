# Changelog

All notable changes to AuditForge ISO 42001 are documented in this file.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Versioning follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added — Phase 0 (Foundations)
- Repository scaffold under Business Source License 1.1.
- Project hygiene: `LICENSE` (BUSL-1.1), `NOTICE`, `TRADEMARK.md`, `CLA.md`,
  `README.md`, `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `SECURITY.md`,
  `CHANGELOG.md`, `CLAUDE.md`.
- pnpm workspaces, TypeScript strict base config, ESLint v9 flat config,
  Prettier, EditorConfig.
- Docker Compose dev stack: postgres, redis, minio, meilisearch, ollama,
  mailhog, clamav.
- GitHub Actions: `ci.yml`, `license-check.yml`, `security.yml`.
- License-check enforcement script (BUSL-1.1 SPDX headers).
- 8 initial ADRs (modular monolith, event sourcing, RLS tenancy, offline CRDT,
  local-LLM default, signed audit file, modular probe runner, cross-framework
  mapping).
- Threat model v1 (STRIDE).

[Unreleased]: https://github.com/auditforge/auditforge-iso42001/compare/v0.0.0...HEAD

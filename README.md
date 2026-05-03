# AuditForge ISO 42001

Workbench for ISO/IEC 42001 Lead Auditors — plan, execute, document AI Management System (AIMS) audits with deep technical assessment of AI Models, AI Agents, and Agentic Workflows.

## License

**Business Source License 1.1** — see [LICENSE](LICENSE).

- Source available; not Open Source until the Change Date.
- Production use permitted, except for offering the software as a competing hosted/embedded certification, audit-management, or AI-governance service.
- Converts to Apache-2.0 four years after each version's release.

See [NOTICE](NOTICE), [TRADEMARK.md](TRADEMARK.md), [CLA.md](CLA.md).

## Status

Active development. See [docs/DESIGN.md](docs/DESIGN.md) for the design spec and [CLAUDE.md](CLAUDE.md) for build conventions.

## Quick Start (Dev)

Requires: Node.js 20+, pnpm 9+, Docker, Docker Compose.

```bash
pnpm install
docker compose -f infra/docker-compose.dev.yml up -d
pnpm db:migrate
pnpm db:seed
pnpm dev
```

Web UI: http://localhost:3000  •  API: http://localhost:4000

## Repo Layout

```
apps/         Next.js web, NestJS api, BullMQ worker, Tauri desktop, mobile PWA
packages/     Shared libraries (db, ui-kit, audit-engine, probe-engine, ...)
infra/        Docker Compose, Helm, Terraform, observability config
docs/         Design, ADRs, compliance, threat model, user/admin guides
tests/        e2e, load, security, compliance, probe-validity, fixtures
```

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) and [CLA.md](CLA.md). Sign every commit (`git commit -s`).

## Security

See [SECURITY.md](SECURITY.md). Report vulnerabilities privately.

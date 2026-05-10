<!--
SPDX-License-Identifier: BUSL-1.1
-->
<!-- metadata
section: developer-guide
audience: contributor
requires: git, Node.js 20+, pnpm 9+, Docker
cross-refs:
  - docs/developer-guide/02-monorepo-tour.md
  - docs/developer-guide/04-development-workflow.md
  - docs/developer-guide/05-testing-strategy.md
-->

# Developer Onboarding

> This document takes a new contributor from a clean machine to a running
> local AuditForge stack and a passing test suite.

---

## Prerequisites

| Tool | Minimum version | Install |
|---|---|---|
| Git | 2.40+ | OS package manager |
| Node.js | 20.x LTS | [nvm](https://github.com/nvm-sh/nvm) or [fnm](https://github.com/Schniz/fnm) |
| pnpm | 9.x | `npm i -g pnpm@9` |
| Docker | 24+ with Compose v2 | [Docker Desktop](https://www.docker.com/products/docker-desktop/) |
| Python | 3.11 (for sidecars) | pyenv |
| CUDA toolkit | 12+ (optional — needed for GPU sidecars) | NVIDIA CUDA docs |

---

## Clone and Install

```bash
git clone https://github.com/auditforge/auditforge.git
cd auditforge
pnpm install          # installs all workspace packages
```

---

## Start the Infrastructure

```bash
docker compose -f infra/docker-compose.dev.yml up -d
```

This starts:

- Postgres 16 (port 5432)
- Redis 7 (port 6379)
- MinIO (ports 9000, 9001)
- Meilisearch (port 7700)
- Ollama (port 11434) — pulls `llama3.1:8b` and `bge-m3` on first start
- Prometheus + Grafana (ports 9090, 3001)
- Jaeger (OTEL collector, ports 4317/4318)

---

## Configure Environment

```bash
cp .env.example .env.local
```

The dev defaults in `.env.example` work out of the box against the
Docker Compose stack. Secrets are pre-filled with dev-only values.

---

## Database Setup

```bash
pnpm db:migrate     # applies all 15 Drizzle migrations
pnpm db:seed        # loads ISO 42001 catalogue + question library
```

---

## Start the Application

```bash
pnpm dev
```

This starts all apps in watch mode via Turborepo:

- `apps/web` → http://localhost:3000
- `apps/api` → http://localhost:4000
- `apps/worker` → background process
- `apps/mcp-server` → port 4001

---

## Smoke Test

1. Navigate to http://localhost:3000.
2. The setup wizard appears on first boot.
3. Create a firm, invite yourself, enroll a passkey.
4. Create a test engagement (Readiness Mode, any scope).
5. Verify the audit ledger: `GET http://localhost:4000/v1/audit-ledger/events`
   should return at least one `engagement.created` event.

---

## Run the Tests

```bash
pnpm test:unit          # Vitest unit tests (all packages)
pnpm test:integration   # Integration tests (require running DB)
pnpm test:e2e           # Playwright e2e (require full stack)
pnpm lint               # ESLint + Prettier check
pnpm typecheck          # TypeScript strict mode check
```

Coverage targets: **85% unit / 80% branch** (CLAUDE.md mandate).

---

## Common Setup Issues

| Symptom | Likely cause | Fix |
|---|---|---|
| `pnpm install` fails with ENOENT | Node.js version mismatch | `node --version` → should be 20.x |
| `db:migrate` fails with "role does not exist" | Postgres not fully started | Wait 10 s; `docker compose ps` |
| `pnpm dev` port 4000 in use | Prior API process still running | `lsof -i :4000` and kill |
| Ollama `connection refused` | Ollama container still pulling models | `docker compose logs ollama` |

---

## Cross-References

- [02-monorepo-tour.md](02-monorepo-tour.md) — where everything lives.
- [04-development-workflow.md](04-development-workflow.md) — commit and
  review process.
- [05-testing-strategy.md](05-testing-strategy.md) — test architecture.

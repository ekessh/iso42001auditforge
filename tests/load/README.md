# Load tests (k6)

<!-- SPDX-License-Identifier: BUSL-1.1 -->

## Existing scenarios

| Scenario | What | SLO assertion |
|---|---|---|
| `wp-edit-100` | 100 VUs editing working papers concurrently for 5 min | p95 < 200ms, error < 1% |
| `file-uploads-50` | 50 concurrent presigned uploads of 10 MB | p95 < 2s, error < 2% |
| `probes-200` | 200 probe executions per second offline | p95 < 500ms, error < 5% |
| `report-gen` | 10 report renders per second | p95 < 5s, error < 5% |
| `trace-100k` | Single 100k-span trace ingest | p95 < 10s |
| `soak-24h` | 20 VU steady-state baseline (configurable duration via SOAK_DURATION) | p95 < 500ms, error < 0.5% |

## Wave-3 scenarios

| Scenario | What | SLO assertion |
|---|---|---|
| `wave3-api-baseline` | 50 VUs hitting hot GETs (engagements, findings) for 5 min | p95 < 300ms |
| `wave3-llm-tier-routing` | Drives LLM tier router with 5 prompt classes, ramping arrival rate | p99 by tier; tier_mismatch_total < 5 |
| `wave3-wp-sync` | 100 WS peers per room × 10 rooms × 30s broadcast | p99 broadcast < 200ms; drop_total < 5 |
| `wave3-ledger-append` | 200 appends/sec for 3 min | p99 append < 50ms; chain integrity verified post-run |

## Install k6

k6 is a Go binary, not an npm package.

- **macOS**: `brew install k6`
- **Linux (Debian/Ubuntu)**: see [k6.io install docs](https://grafana.com/docs/k6/latest/set-up/install-k6/)
  ```sh
  sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
  echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
  sudo apt-get update && sudo apt-get install k6
  ```
- **Windows**: `winget install k6 --source winget` or `choco install k6`
- **CI**: `.github/workflows/nightly.yml` installs via apt.

## Run

```sh
pnpm --filter @auditforge/load test:wave3:baseline
pnpm --filter @auditforge/load test:wave3:llm
pnpm --filter @auditforge/load test:wave3:wp-sync
pnpm --filter @auditforge/load test:wave3:ledger
pnpm --filter @auditforge/load test:wave3:all
```

Set `API_URL`, `WS_URL`, and `AUTH_TOKEN` env vars. Each scenario writes
`summary-<name>.json` for CI to parse.

## Regression detection

The nightly workflow uploads `summary-*.json` artifacts. Plan: compare
the latest summary against the previous run; fail when any threshold
crossed by > 5% (Phase 14 follow-up).

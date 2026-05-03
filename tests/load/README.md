# Load tests (k6)

| Scenario | What | SLO assertion |
|---|---|---|
| `wp-edit-100` | 100 VUs editing working papers concurrently for 5 min | p95 < 200ms, error < 1% |
| `file-uploads-50` | 50 concurrent presigned uploads of 10 MB | p95 < 2s, error < 2% |
| `probes-200` | 200 probe executions per second offline | p95 < 500ms, error < 5% |
| `report-gen` | 10 report renders per second | p95 < 5s, error < 5% |
| `trace-100k` | Single 100k-span trace ingest | p95 < 10s |
| `soak-24h` | 20 VU steady-state baseline (configurable duration via SOAK_DURATION) | p95 < 500ms, error < 0.5% |

Run: `pnpm --filter @auditforge/load test:<scenario>`. Set `API_URL` and `AUTH_TOKEN` env vars.

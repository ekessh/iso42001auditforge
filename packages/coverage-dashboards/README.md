# @auditforge/coverage-dashboards

Readiness + Audit dashboard data services — v3 Phase 7.7.

## What it is

Pure-data services that produce dashboard payloads from the engagement state.
No UI, no storage — composes upstream services into JSON payloads ready for
the Next.js workspace.

## Readiness Calculator (v3 §15.14)

Transparent, no-black-box readiness scoring:

```
overall_readiness = sum(clause_weight * clause_status_score) / sum(clause_weight)

clause_status_score: evidenced=1.0, partial=0.5, contradicted=0.0,
                      untouched=0.0, na=excluded
clause_weight (default): mandatory main-body 4-10 = 1.5,
                         Annex A in-scope per SoA = 1.0,
                         out-of-scope = excluded
```

`calcReadiness` returns:

- `overall` — weighted readiness (0..1)
- `perFamily` — readiness per Annex A family + main_body
- `perClause` — clause id, weight applied, status, score
- `methodology` — round-trippable JSON description of the weight config

The methodology MUST round-trip via JSON for ledger logging. Weight changes
are an audit-ledger event — emit them.

## Audit Dashboard (v3 §15.14)

Composed views for active engagements:

| Method                          | Purpose                                                    |
| ------------------------------- | ---------------------------------------------------------- |
| `coveragePerArea`               | per-Annex-A-family coverage % across in-scope clauses      |
| `manDayBurndown`                | planned vs consumed audit man-days                          |
| `openCandidateFindingsCount`    | severity-bucketed counts                                   |
| `promotedFindingsCount`         | type-bucketed counts                                       |
| `samplingCompleteness`          | planned vs executed samples                                 |
| `riskIndicator`                 | `'on_track'` / `'coverage_gap'` / `'time_overrun'`         |

## Readiness Dashboard (v3 §15.14)

| Method                | Purpose                                                                     |
| --------------------- | --------------------------------------------------------------------------- |
| `heroReadiness`       | overall readiness + 30/90 day trend                                         |
| `controlFamilyGrid`   | A.2-A.10 cards with %, statuses, drill-down                                 |
| `clauseHeatmap`       | clause tiles for a family with status colour                                 |
| `openItemsPanel`      | improvement items / candidate findings / open NCs / OFIs                     |
| `trendChart`          | readiness % over time, configurable window                                   |
| `topBlockers`         | clauses preventing readiness, sorted by impact + recommended next action     |
| `aiSystemBreakdown`   | per-AI-system readiness bars                                                 |

## Real-time push interface

`PostgresListenNotifyAdapter` describes the LISTEN/NOTIFY → WebSocket bridge
without taking a Postgres dependency in the package; concrete drivers wire
into the Postgres client at the app layer.

## License

BUSL-1.1.

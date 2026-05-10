// SPDX-License-Identifier: BUSL-1.1
/**
 * Service Level Indicators (SLI) and Service Level Objectives (SLO).
 *
 * WHY a typed table: SLOs are organisational commitments, not free-form configuration. Encoding
 * them in code (a) prevents drift between the runbook and what is actually monitored, (b) lets the
 * recording-rule emitter generate Prometheus rules deterministically, and (c) means a regression
 * in dashboard wiring breaks the build.
 */
import { type Histogram, type Counter, type Gauge, Counter as PromClientCounter, Gauge as PromClientGauge } from 'prom-client';

import { getMetrics, type Metrics } from './metrics.js';

export type SliKind = 'availability' | 'latency' | 'freshness' | 'correctness';

export interface SliDefinition {
  readonly id: string;
  readonly description: string;
  readonly kind: SliKind;
  readonly objectivePct: number;
  readonly window: '7d' | '30d' | '90d';
  readonly errorBudgetMinutes: number;
  readonly numerator: string;
  readonly denominator: string;
}

export const SLO_CATALOG: ReadonlyArray<SliDefinition> = Object.freeze([
  Object.freeze({
    id: 'api.request_success_rate',
    description: 'Fraction of HTTP requests that complete with status < 500.',
    kind: 'availability' as SliKind,
    objectivePct: 99.9,
    window: '30d' as const,
    errorBudgetMinutes: 43,
    numerator:
      'sum(rate(auditforge_http_request_duration_ms_count{status!~"5.."}[5m]))',
    denominator: 'sum(rate(auditforge_http_request_duration_ms_count[5m]))',
  }),
  Object.freeze({
    id: 'api.latency_p99_under_800ms',
    description: 'API p99 latency stays under 800 ms over the rolling window.',
    kind: 'latency' as SliKind,
    objectivePct: 99,
    window: '30d' as const,
    errorBudgetMinutes: 432,
    numerator:
      'histogram_quantile(0.99, sum by (le) (rate(auditforge_http_request_duration_ms_bucket[5m])))',
    denominator: '800',
  }),
  Object.freeze({
    id: 'llm.invocation_success_rate',
    description: 'Fraction of LLM provider calls that returned a usable answer.',
    kind: 'availability' as SliKind,
    objectivePct: 99.5,
    window: '30d' as const,
    errorBudgetMinutes: 216,
    numerator: 'sum(rate(auditforge_llm_call_duration_ms_count[5m]))',
    denominator: 'sum(rate(auditforge_llm_call_duration_ms_count[5m]))',
  }),
  Object.freeze({
    id: 'ledger.append_latency_p99',
    description: 'Audit ledger append p99 latency under 250 ms.',
    kind: 'latency' as SliKind,
    objectivePct: 99,
    window: '30d' as const,
    errorBudgetMinutes: 432,
    numerator:
      'histogram_quantile(0.99, sum by (le) (rate(auditforge_ledger_chain_verify_ms_bucket[5m])))',
    denominator: '250',
  }),
  Object.freeze({
    id: 'wp.sync_freshness',
    description: 'Working-paper Yjs sync snapshots no older than 60 seconds.',
    kind: 'freshness' as SliKind,
    objectivePct: 99,
    window: '7d' as const,
    errorBudgetMinutes: 100,
    numerator: 'auditforge_wp_snapshot_age_seconds',
    denominator: '60',
  }),
  Object.freeze({
    id: 'surveillance.ingest_success_rate',
    description: 'Surveillance telemetry ingestions accepted (vs. rejected for non-replay).',
    kind: 'availability' as SliKind,
    objectivePct: 99,
    window: '30d' as const,
    errorBudgetMinutes: 432,
    numerator: 'sum(rate(auditforge_surveillance_ingest_total{result="accepted"}[5m]))',
    denominator: 'sum(rate(auditforge_surveillance_ingest_total[5m]))',
  }),
]);

export interface RecordingRule {
  readonly record: string;
  readonly expr: string;
  readonly labels: Record<string, string>;
}

export function generateRecordingRules(
  catalog: ReadonlyArray<SliDefinition> = SLO_CATALOG,
): RecordingRule[] {
  const rules: RecordingRule[] = [];
  for (const sli of catalog) {
    rules.push({
      record: `sli:${sli.id}:numerator`,
      expr: sli.numerator,
      labels: { sli: sli.id, kind: sli.kind, window: sli.window },
    });
    rules.push({
      record: `sli:${sli.id}:denominator`,
      expr: sli.denominator,
      labels: { sli: sli.id, kind: sli.kind, window: sli.window },
    });
    rules.push({
      record: `sli:${sli.id}:objective_pct`,
      expr: sli.objectivePct.toString(10),
      labels: { sli: sli.id, kind: sli.kind, window: sli.window },
    });
  }
  return rules;
}

export function generateRecordingRulesYaml(
  catalog: ReadonlyArray<SliDefinition> = SLO_CATALOG,
): string {
  const rules = generateRecordingRules(catalog);
  const lines: string[] = ['groups:', '  - name: auditforge.sli', '    interval: 30s', '    rules:'];
  for (const r of rules) {
    lines.push(`      - record: ${r.record}`);
    lines.push(`        expr: ${escapeYamlScalar(r.expr)}`);
    lines.push(`        labels:`);
    for (const [k, v] of Object.entries(r.labels)) {
      lines.push(`          ${k}: ${escapeYamlScalar(v)}`);
    }
  }
  return lines.join('\n') + '\n';
}

function escapeYamlScalar(s: string): string {
  if (/^[a-zA-Z0-9_.:/-]+$/.test(s)) return s;
  return JSON.stringify(s);
}

export interface SloMetricBindings {
  readonly httpRequest: Histogram<string>;
  readonly llmCall: Histogram<string>;
  readonly ledgerVerify: Histogram<string>;
  readonly surveillanceIngest: Counter<string>;
  readonly wpSnapshotAgeSeconds: Gauge<string>;
}

let extras: { surveillanceIngest: Counter<string>; wpSnapshotAge: Gauge<string> } | null = null;

export function registerSloAuxiliaryMetrics(metrics: Metrics = getMetrics()): SloMetricBindings {
  if (extras === null) {
    extras = {
      surveillanceIngest: new PromClientCounter({
        name: 'auditforge_surveillance_ingest_total',
        help: 'Surveillance telemetry ingest results.',
        labelNames: ['result', 'reason'],
        registers: [metrics.registry],
      }),
      wpSnapshotAge: new PromClientGauge({
        name: 'auditforge_wp_snapshot_age_seconds',
        help: 'Age of the most recent working-paper Yjs snapshot in seconds, per room.',
        labelNames: ['room'],
        registers: [metrics.registry],
      }),
    };
  }
  return {
    httpRequest: metrics.requestDuration,
    llmCall: metrics.llmCallDuration,
    ledgerVerify: metrics.ledgerChainVerifyMs,
    surveillanceIngest: extras.surveillanceIngest,
    wpSnapshotAgeSeconds: extras.wpSnapshotAge,
  };
}

export function resetSloAuxiliaryForTests(): void {
  extras = null;
}

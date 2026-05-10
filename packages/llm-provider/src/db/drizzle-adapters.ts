// SPDX-License-Identifier: BUSL-1.1
//
// Drizzle-backed implementations of the in-memory sink interfaces declared
// alongside the in-process invocation ledger / cost store / consent
// registry. These adapters are intentionally tiny: each method shells out to
// a single SQL statement so we can run them under an open transaction or a
// pre-configured per-firm RLS connection without surprises.

import { and, asc, desc, eq, gt, isNull, sql as dsql } from 'drizzle-orm';
import type { PgDatabase } from 'drizzle-orm/pg-core';
import type {
  CostBudget,
  CostStore,
} from '@auditforge/cost-controller';
import type {
  ConsentRecord,
  ConsentRegistry,
  ConsentLookup,
} from '@auditforge/consent-registry';
import type {
  InvocationDecision,
  InvocationLedgerSink,
  InvocationRecord,
} from '../routing/invocation-ledger.js';
import {
  consentRecords,
  llmBudgetEvents,
  llmInvocations,
} from './schema.js';
import type { CostEvent, CostEventSink } from '@auditforge/cost-controller';

type AnyDrizzle = PgDatabase<any, any, any>;

/**
 * llm_invocations writer. The unique-id and createdAt are owned by the
 * caller (ledger.record), so we just persist verbatim.
 */
export class DrizzleInvocationLedgerSink implements InvocationLedgerSink {
  constructor(private readonly db: AnyDrizzle) {}

  async insert(record: InvocationRecord): Promise<void> {
    await this.db.insert(llmInvocations).values({
      id: record.id,
      firmId: record.firmId,
      engagementId: record.engagementId,
      task: record.task,
      tier: record.tier,
      provider: record.provider,
      modelName: record.modelName,
      modelHash: record.modelHash ?? null,
      modelVersion: record.modelVersion ?? null,
      temperature: record.temperature ?? null,
      promptTemplateId: record.promptTemplateId ?? null,
      promptTemplateVersion: record.promptTemplateVersion,
      promptTemplateHash: record.promptTemplateHash ?? null,
      inputTokens: record.inputTokens,
      outputTokens: record.outputTokens,
      latencyMs: record.latencyMs,
      costUsd: record.costUsd ?? null,
      reasoningTrace: record.reasoningTrace ?? null,
      decision: record.decision ?? null,
      decisionByAuditorId: record.decisionByAuditorId ?? null,
      decidedAt: record.decidedAt ? new Date(record.decidedAt) : null,
      metadata: record.metadata ?? {},
      createdAt: new Date(record.createdAt),
    });
  }

  async updateDecision(
    id: string,
    decision: InvocationDecision,
    decidedBy: string,
    decidedAt: string,
  ): Promise<void> {
    await this.db
      .update(llmInvocations)
      .set({
        decision,
        decisionByAuditorId: decidedBy,
        decidedAt: new Date(decidedAt),
      })
      .where(eq(llmInvocations.id, id));
  }

  async list(filter?: {
    engagementId?: string;
    task?: string;
  }): Promise<InvocationRecord[]> {
    let q = this.db.select().from(llmInvocations).$dynamic();
    const wheres = [];
    if (filter?.engagementId) wheres.push(eq(llmInvocations.engagementId, filter.engagementId));
    if (filter?.task) wheres.push(eq(llmInvocations.task, filter.task));
    if (wheres.length > 0) q = q.where(and(...wheres));
    const rows = await q.orderBy(asc(llmInvocations.createdAt));
    return rows.map(rowToRecord);
  }
}

function rowToRecord(row: typeof llmInvocations.$inferSelect): InvocationRecord {
  const out: InvocationRecord = {
    id: row.id,
    firmId: row.firmId,
    engagementId: row.engagementId,
    task: row.task,
    tier: row.tier,
    provider: row.provider,
    modelName: row.modelName,
    promptTemplateVersion: row.promptTemplateVersion,
    inputTokens: row.inputTokens,
    outputTokens: row.outputTokens,
    latencyMs: row.latencyMs,
    createdAt: row.createdAt.toISOString(),
  };
  if (row.modelHash !== null) out.modelHash = row.modelHash;
  if (row.modelVersion !== null) out.modelVersion = row.modelVersion;
  if (row.temperature !== null) out.temperature = row.temperature;
  if (row.promptTemplateId !== null) out.promptTemplateId = row.promptTemplateId;
  if (row.promptTemplateHash !== null) out.promptTemplateHash = row.promptTemplateHash;
  if (row.costUsd !== null) out.costUsd = row.costUsd;
  if (row.reasoningTrace !== null) out.reasoningTrace = row.reasoningTrace;
  if (row.decision !== null) out.decision = row.decision;
  if (row.decisionByAuditorId !== null) out.decisionByAuditorId = row.decisionByAuditorId;
  if (row.decidedAt !== null) out.decidedAt = row.decidedAt.toISOString();
  if (row.metadata !== null) out.metadata = row.metadata as Record<string, unknown>;
  return out;
}

/**
 * Cost store backed by `consent_records` + an embedded engagement budget.
 * The budget itself is stored on `engagements.budget_usd` (owned by Agent E)
 * so this adapter accepts the budget via constructor injection rather than
 * reaching into a foreign schema.
 */
export class DrizzleCostStore implements CostStore {
  constructor(
    private readonly db: AnyDrizzle,
    private readonly budgetLookup: (engagementId: string) => Promise<CostBudget | null>,
  ) {}

  async getBudget(engagementId: string): Promise<CostBudget | null> {
    return this.budgetLookup(engagementId);
  }

  async getSpent(engagementId: string): Promise<number> {
    const rows = await this.db
      .select({
        spent: dsql<number | null>`COALESCE(SUM(${llmInvocations.costUsd}), 0)`,
      })
      .from(llmInvocations)
      .where(eq(llmInvocations.engagementId, engagementId));
    return Number(rows[0]?.spent ?? 0);
  }

  async addSpend(_engagementId: string, _deltaUsd: number): Promise<number> {
    // WHY: spend is derived from the invocation ledger; an explicit
    // addSpend is a no-op to keep the bookkeeping single-sourced.
    return this.getSpent(_engagementId);
  }
}

/**
 * Persists `llm.budget.warning` and `llm.budget.exceeded` events to
 * `llm_budget_events` so a dashboard can show a per-engagement budget
 * timeline without re-deriving from the audit ledger.
 */
export class DrizzleCostEventSink implements CostEventSink {
  constructor(
    private readonly db: AnyDrizzle,
    private readonly firmIdResolver: (engagementId: string) => Promise<string>,
  ) {}

  async emit(event: CostEvent): Promise<void> {
    const firmId = await this.firmIdResolver(event.engagementId);
    await this.db.insert(llmBudgetEvents).values({
      firmId,
      engagementId: event.engagementId,
      event: event.name,
      capUsd: event.snapshot.capUsd,
      spentUsd: event.snapshot.spentUsd,
      projectedUsd: event.snapshot.projectedUsd,
      utilization: event.snapshot.utilization,
      raisedAt: new Date(event.at),
    });
  }
}

/**
 * Consent registry backed by `consent_records`. The active-record predicate
 * mirrors the InMemoryConsentRegistry: not revoked, granted_at <= now,
 * expires_at IS NULL or > now, and the requested provider in `providers[]`.
 */
export class DrizzleConsentRegistry implements ConsentRegistry {
  constructor(private readonly db: AnyDrizzle) {}

  async list(engagementId: string): Promise<readonly ConsentRecord[]> {
    const rows = await this.db
      .select()
      .from(consentRecords)
      .where(eq(consentRecords.engagementId, engagementId))
      .orderBy(desc(consentRecords.grantedAt));
    return rows.map(rowToConsent);
  }

  async findActive(lookup: ConsentLookup): Promise<ConsentRecord | null> {
    const now = lookup.now ?? new Date();
    const rows = await this.db
      .select()
      .from(consentRecords)
      .where(
        and(
          eq(consentRecords.engagementId, lookup.engagementId),
          dsql`${lookup.providerName} = ANY(${consentRecords.providers})`,
          isNull(consentRecords.revokedAt),
          dsql`${consentRecords.grantedAt} <= ${now}`,
          dsql`(${consentRecords.expiresAt} IS NULL OR ${consentRecords.expiresAt} > ${now})`,
        ),
      )
      .orderBy(desc(consentRecords.grantedAt))
      .limit(1);
    if (rows.length === 0) return null;
    return rowToConsent(rows[0]!);
  }
}

function rowToConsent(row: typeof consentRecords.$inferSelect): ConsentRecord {
  return {
    id: row.id,
    firmId: row.firmId,
    engagementId: row.engagementId,
    grantedBy: row.grantedBy,
    grantedAt: row.grantedAt.toISOString(),
    revokedAt: row.revokedAt ? row.revokedAt.toISOString() : null,
    expiresAt: row.expiresAt ? row.expiresAt.toISOString() : null,
    providers: row.providers,
    purpose: row.purpose,
    scope: row.scope as ConsentRecord['scope'],
    writtenConsentDocId: row.writtenConsentDocId ?? null,
  };
}

// Internal helper kept only to make the unused gt/asc/dsql imports above tree-shake-safe.
export const __internalSentinels = { and, asc, desc, eq, gt, isNull, dsql };

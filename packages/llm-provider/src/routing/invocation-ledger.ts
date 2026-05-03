// SPDX-License-Identifier: BUSL-1.1
import { randomUUID } from 'node:crypto';

export type LlmTier = 'small' | 'medium' | 'large' | 'reasoning';

export type InvocationDecision = 'accepted' | 'rejected';

export interface InvocationRecord {
  id: string;
  firmId: string;
  engagementId: string;
  task: string;
  tier: LlmTier;
  provider: string;
  modelName: string;
  modelHash?: string;
  modelVersion?: string;
  temperature?: number;
  promptTemplateVersion: string;
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
  costUsd?: number;
  reasoningTrace?: string;
  decision?: InvocationDecision;
  decisionByAuditorId?: string;
  decidedAt?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export interface InvocationDraft {
  firmId: string;
  engagementId: string;
  task: string;
  tier: LlmTier;
  provider: string;
  modelName: string;
  modelHash?: string;
  modelVersion?: string;
  temperature?: number;
  promptTemplateVersion: string;
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
  costUsd?: number;
  reasoningTrace?: string;
  metadata?: Record<string, unknown>;
}

export interface InvocationLedgerSink {
  insert(record: InvocationRecord): Promise<void>;
  updateDecision(
    id: string,
    decision: InvocationDecision,
    decidedBy: string,
    decidedAt: string,
  ): Promise<void>;
  list(filter?: { engagementId?: string; task?: string }): Promise<InvocationRecord[]>;
}

export class InMemoryInvocationLedgerSink implements InvocationLedgerSink {
  private readonly rows: InvocationRecord[] = [];

  async insert(record: InvocationRecord): Promise<void> {
    this.rows.push({ ...record });
  }

  async updateDecision(
    id: string,
    decision: InvocationDecision,
    decidedBy: string,
    decidedAt: string,
  ): Promise<void> {
    const row = this.rows.find((r) => r.id === id);
    if (!row) throw new Error(`invocation not found: ${id}`);
    row.decision = decision;
    row.decisionByAuditorId = decidedBy;
    row.decidedAt = decidedAt;
  }

  async list(filter?: {
    engagementId?: string;
    task?: string;
  }): Promise<InvocationRecord[]> {
    return this.rows
      .filter((r) =>
        filter?.engagementId === undefined ? true : r.engagementId === filter.engagementId,
      )
      .filter((r) => (filter?.task === undefined ? true : r.task === filter.task))
      .map((r) => ({ ...r }));
  }
}

export class InvocationLedger {
  constructor(private readonly sink: InvocationLedgerSink) {}

  async record(draft: InvocationDraft): Promise<InvocationRecord> {
    const record: InvocationRecord = {
      id: randomUUID(),
      ...draft,
      createdAt: new Date().toISOString(),
    };
    await this.sink.insert(record);
    return record;
  }

  async setDecision(
    invocationId: string,
    decision: InvocationDecision,
    decidedBy: string,
    decidedAt: string = new Date().toISOString(),
  ): Promise<void> {
    await this.sink.updateDecision(invocationId, decision, decidedBy, decidedAt);
  }

  async list(filter?: {
    engagementId?: string;
    task?: string;
  }): Promise<InvocationRecord[]> {
    return this.sink.list(filter);
  }
}

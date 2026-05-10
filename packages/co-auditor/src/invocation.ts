// SPDX-License-Identifier: BUSL-1.1
import { createHash, randomUUID } from 'node:crypto';
import type { CoAuditorInvocation, TaskType } from './domain.js';
import { fenceUntrustedInput, hashSystemPrompt, validateOutputSchema, looksLikeRefusal } from './prompt-defense.js';
import { TASK_PARSERS } from './tasks.js';
import type { LlmBackendRouter } from './backend-router.js';

export interface InvocationRepo {
  insert(i: CoAuditorInvocation): Promise<void>;
  update(i: CoAuditorInvocation): Promise<void>;
  load(id: string): Promise<CoAuditorInvocation | null>;
}

export interface CoAuditorLedger {
  emit(eventType: string, payload: unknown): Promise<{ eventId: string }>;
}

export interface InvokeOpts {
  firmId: string;
  engagementId: string;
  auditorId: string;
  taskType: TaskType;
  backend: 'local' | 'cloud';
  consentRecordId: string | null;
  systemPrompt: string;
  userInput: string;
}

export class CoAuditorService {
  constructor(
    private readonly router: LlmBackendRouter,
    private readonly repo: InvocationRepo,
    private readonly ledger: CoAuditorLedger,
  ) {}

  async invoke(opts: InvokeOpts): Promise<CoAuditorInvocation> {
    const id = randomUUID();
    const userPrompt = fenceUntrustedInput(opts.userInput);
    const promptHash = createHash('sha256').update(`${hashSystemPrompt(opts.systemPrompt)}|${userPrompt}`).digest('hex');
    const baseInvocation: CoAuditorInvocation = {
      id,
      firmId: opts.firmId,
      engagementId: opts.engagementId,
      auditorId: opts.auditorId,
      taskType: opts.taskType,
      backend: opts.backend,
      consentRecordId: opts.consentRecordId,
      promptHash,
      promptInputJson: JSON.stringify({ system: hashSystemPrompt(opts.systemPrompt), user: opts.userInput }),
      generatedOutputJson: null,
      status: 'pending',
      ledgerEventId: null,
      createdAt: new Date().toISOString(),
      decidedAt: null,
    };
    await this.repo.insert(baseInvocation);

    let llmOut: { output: string; tokensUsed: number; costUsd: number };
    try {
      llmOut = await this.router.route({
        backend: opts.backend, engagementId: opts.engagementId,
        consentRecordId: opts.consentRecordId, systemPrompt: opts.systemPrompt, userPrompt,
      });
    } catch (e) {
      const errored = { ...baseInvocation, status: 'errored' as const, decidedAt: new Date().toISOString() };
      await this.repo.update(errored);
      const ev = await this.ledger.emit('co_auditor.errored', { id, reason: (e as Error).message });
      return { ...errored, ledgerEventId: ev.eventId };
    }

    if (looksLikeRefusal(llmOut.output)) {
      const refused = { ...baseInvocation, status: 'rejected' as const, generatedOutputJson: llmOut.output, decidedAt: new Date().toISOString() };
      await this.repo.update(refused);
      const ev = await this.ledger.emit('co_auditor.refused', { id, taskType: opts.taskType });
      return { ...refused, ledgerEventId: ev.eventId };
    }

    const parser = TASK_PARSERS[opts.taskType] as (raw: unknown) => unknown;
    const parsed = validateOutputSchema(llmOut.output, parser);
    if (!parsed.ok) {
      const rejected = { ...baseInvocation, status: 'rejected' as const, generatedOutputJson: llmOut.output, decidedAt: new Date().toISOString() };
      await this.repo.update(rejected);
      const ev = await this.ledger.emit('co_auditor.invalid_output', { id, reason: parsed.reason });
      return { ...rejected, ledgerEventId: ev.eventId };
    }

    const ev = await this.ledger.emit('co_auditor.invoked', {
      id, taskType: opts.taskType, backend: opts.backend, tokensUsed: llmOut.tokensUsed, costUsd: llmOut.costUsd,
    });
    const updated: CoAuditorInvocation = {
      ...baseInvocation,
      generatedOutputJson: JSON.stringify(parsed.value),
      status: 'pending',
      ledgerEventId: ev.eventId,
    };
    await this.repo.update(updated);
    return updated;
  }

  async accept(invocationId: string, auditorId: string): Promise<CoAuditorInvocation> {
    const inv = await this.repo.load(invocationId);
    if (!inv) throw new Error('invocation not found');
    if (inv.auditorId !== auditorId) throw new Error('only invoking auditor can accept');
    const updated = { ...inv, status: 'accepted' as const, decidedAt: new Date().toISOString() };
    await this.repo.update(updated);
    await this.ledger.emit('co_auditor.accepted', { id: invocationId, auditorId });
    return updated;
  }

  async reject(invocationId: string, auditorId: string, reason: string): Promise<CoAuditorInvocation> {
    const inv = await this.repo.load(invocationId);
    if (!inv) throw new Error('invocation not found');
    if (inv.auditorId !== auditorId) throw new Error('only invoking auditor can reject');
    const updated = { ...inv, status: 'rejected' as const, decidedAt: new Date().toISOString() };
    await this.repo.update(updated);
    await this.ledger.emit('co_auditor.rejected', { id: invocationId, auditorId, reason });
    return updated;
  }
}

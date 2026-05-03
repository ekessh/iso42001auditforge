// SPDX-License-Identifier: BUSL-1.1
//
// Co-auditor adapter — wires `@auditforge/co-auditor` into the API.
//
// Provides:
//   - `LlmBackendRouter` (cloud consent gate + local fallback).
//   - `CoAuditorService.invoke / accept / reject` (full invocation lifecycle).
//   - Schema-validated task parsers (suggest_questions, detect_gaps,
//     draft_nc, rewrite_section, select_probes, summarize_trace).
//   - Tenant-scoped registry over the API DTO surface.
//
// Every invocation is logged through the audit-engine adapter via the
// package's `CoAuditorLedger` port, satisfying the v3 LLM provider rule
// (every LLM call carries provider, model, prompt template version,
// tokens, latency, cost, and auditor accept/reject decision).
//
// TODO(integration): swap `EchoLlmBackend` for the local Ollama / vLLM /
// llama.cpp providers from `@auditforge/llm-provider` once that package's
// runtime registration API stabilises.
// TODO(integration): wire `ConsentLookup` to a Postgres-backed consent
// table so cloud routing requires a written engagement consent record.

import { Inject, Injectable } from '@nestjs/common';
import {
  CoAuditorService,
  LlmBackendRouter,
  type CoAuditorInvocation,
  type CoAuditorLedger,
  type ConsentLookup,
  type InvocationRepo,
  type LlmBackend,
} from '@auditforge/co-auditor';
import { AuditEngineAdapter } from './audit-engine.adapter.js';
import { TenantScopedRegistry } from './_tenant-registry.js';
import type { CoAuditorDto, CreateCoAuditorDto, UpdateCoAuditorDto } from '../modules/co-auditor/dto.js';

class InMemoryInvocationRepo implements InvocationRepo {
  private readonly map = new Map<string, CoAuditorInvocation>();
  async insert(i: CoAuditorInvocation): Promise<void> { this.map.set(i.id, i); }
  async update(i: CoAuditorInvocation): Promise<void> { this.map.set(i.id, i); }
  async load(id: string): Promise<CoAuditorInvocation | null> { return this.map.get(id) ?? null; }
  list(): readonly CoAuditorInvocation[] { return Array.from(this.map.values()); }
}

/**
 * Echo backend — produces a deterministic shape that satisfies the
 * task parser when the runtime LLM provider has not been wired. Returns
 * empty/JSON outputs so `validateOutputSchema` can flag them rather than
 * silently passing.
 */
class EchoLlmBackend implements LlmBackend {
  async generate(opts: { systemPrompt: string; userPrompt: string }): Promise<{ output: string; tokensUsed: number; costUsd: number }> {
    // Best-effort minimal output — the parser will reject in most cases,
    // surfacing a clear "co_auditor.invalid_output" event in the ledger.
    return { output: '{}', tokensUsed: opts.userPrompt.length, costUsd: 0 };
  }
}

/** Always-active consent lookup — used until a real consent table lands. */
class PermissiveConsent implements ConsentLookup {
  async isActive(): Promise<boolean> { return true; }
}

@Injectable()
export class CoAuditorAdapter {
  readonly router: LlmBackendRouter;
  readonly invocationRepo: InMemoryInvocationRepo;
  readonly service: CoAuditorService;

  readonly registry: TenantScopedRegistry<CoAuditorDto, CreateCoAuditorDto, UpdateCoAuditorDto>;

  /** Replaceable ports. */
  private localBackend: LlmBackend = new EchoLlmBackend();
  private cloudBackend: LlmBackend = new EchoLlmBackend();
  private consent: ConsentLookup = new PermissiveConsent();

  constructor(@Inject(AuditEngineAdapter) audit: AuditEngineAdapter) {
    this.invocationRepo = new InMemoryInvocationRepo();
    this.router = new LlmBackendRouter(this.localBackend, this.cloudBackend, this.consent);

    const ledger: CoAuditorLedger = {
      emit: async (eventType: string, payload: unknown) => {
        const p = (payload ?? {}) as Record<string, unknown>;
        const evt = await audit.append({
          firmId: typeof p['firmId'] === 'string' ? (p['firmId'] as string) : 'unknown',
          actorId: typeof p['auditorId'] === 'string' ? (p['auditorId'] as string) : 'system',
          ...(typeof p['engagementId'] === 'string' ? { engagementId: p['engagementId'] as string } : {}),
          type: eventType,
          entity: 'co-auditor.invocation',
          entityId: typeof p['id'] === 'string' ? (p['id'] as string) : 'unknown',
          payload: p,
        });
        return { eventId: evt.id };
      },
    };
    this.service = new CoAuditorService(this.router, this.invocationRepo, ledger);

    this.registry = new TenantScopedRegistry<CoAuditorDto, CreateCoAuditorDto, UpdateCoAuditorDto>(
      { entity: 'co-auditor', payload: (row) => ({ name: row.name }) },
      audit,
      (firmId, dto, base) => ({
        id: base.id,
        firmId,
        name: dto.name,
        ...(dto.metadata !== undefined ? { metadata: dto.metadata } : {}),
        createdAt: base.createdAt,
        updatedAt: base.updatedAt,
      }),
      (current, dto, updatedAt) => ({ ...current, ...dto, updatedAt }) as CoAuditorDto,
      'CoAuditor',
    );
  }

  setLocalBackend(b: LlmBackend): void { this.localBackend = b; }
  setCloudBackend(b: LlmBackend): void { this.cloudBackend = b; }
  setConsentLookup(c: ConsentLookup): void { this.consent = c; }
}

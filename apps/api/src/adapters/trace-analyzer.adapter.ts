// SPDX-License-Identifier: BUSL-1.1
//
// Trace-analyzer adapter — wires `@auditforge/trace-analyzer` into the API.
//
// Two API modules consume this adapter:
//   - `traces` module      -> ingest + analyze flows (TraceIngestor, TraceAnalyzer,
//                              AutonomyClassifier).
//   - `agent-workflows`    -> topology + tool registry + recursion-limit
//                              verifier (ToolRegistryReviewer,
//                              LoopRecursionLimitVerifier).
//
// The adapter exposes both surfaces from a single workspace package; the
// two API modules instantiate the relevant facets via the helper getters.
//
// TODO(integration): wire `TraceStore` to the Postgres-backed `traces`
// table once `packages/db` exposes it. Until then, the in-memory store
// is the source of truth and is shared across the two modules so that an
// agent-workflow that references a trace ingested via the traces module
// can find it.

import { Inject, Injectable } from '@nestjs/common';
import {
  AutonomyClassifier,
  FailureModeSampler,
  HumanInLoopGateVerifier,
  InMemoryTraceStore,
  LoopRecursionLimitVerifier,
  MemoryStateReviewer,
  MultiAgentCoordinationReviewer,
  ToolRegistryReviewer,
  TraceAnalyzer,
  TraceIngestor,
  type AgentTrace,
} from '@auditforge/trace-analyzer';
import { AuditEngineAdapter } from './audit-engine.adapter.js';
import { TenantScopedRegistry } from './_tenant-registry.js';
import type { TracesDto, CreateTracesDto, UpdateTracesDto } from '../modules/traces/dto.js';
import type {
  AgentWorkflowsDto,
  CreateAgentWorkflowsDto,
  UpdateAgentWorkflowsDto,
} from '../modules/agent-workflows/dto.js';

@Injectable()
export class TraceAnalyzerAdapter {
  /** Shared in-memory trace store used by the ingestor and the analyzers. */
  readonly store = new InMemoryTraceStore();

  readonly ingestor: TraceIngestor;
  readonly analyzer = new TraceAnalyzer();
  readonly autonomy = new AutonomyClassifier();
  readonly toolRegistry = new ToolRegistryReviewer();
  readonly loopVerifier = new LoopRecursionLimitVerifier();
  readonly hilGate = new HumanInLoopGateVerifier();
  readonly memoryReviewer = new MemoryStateReviewer();
  readonly multiAgent = new MultiAgentCoordinationReviewer();
  readonly failureSampler = new FailureModeSampler();

  /** Tenant-scoped registries — separate entities per consumer module. */
  readonly tracesRegistry: TenantScopedRegistry<TracesDto, CreateTracesDto, UpdateTracesDto>;
  readonly workflowsRegistry: TenantScopedRegistry<
    AgentWorkflowsDto,
    CreateAgentWorkflowsDto,
    UpdateAgentWorkflowsDto
  >;

  constructor(@Inject(AuditEngineAdapter) audit: AuditEngineAdapter) {
    this.ingestor = new TraceIngestor(this.store);

    this.tracesRegistry = new TenantScopedRegistry<TracesDto, CreateTracesDto, UpdateTracesDto>(
      { entity: 'trace', payload: (row) => ({ name: row.name }) },
      audit,
      (firmId, dto, base) => ({
        id: base.id,
        firmId,
        name: dto.name,
        ...(dto.metadata !== undefined ? { metadata: dto.metadata } : {}),
        createdAt: base.createdAt,
        updatedAt: base.updatedAt,
      }),
      (current, dto, updatedAt) => ({ ...current, ...dto, updatedAt }) as TracesDto,
      'Traces',
    );

    this.workflowsRegistry = new TenantScopedRegistry<
      AgentWorkflowsDto,
      CreateAgentWorkflowsDto,
      UpdateAgentWorkflowsDto
    >(
      { entity: 'agent-workflow', payload: (row) => ({ name: row.name }) },
      audit,
      (firmId, dto, base) => ({
        id: base.id,
        firmId,
        name: dto.name,
        ...(dto.metadata !== undefined ? { metadata: dto.metadata } : {}),
        createdAt: base.createdAt,
        updatedAt: base.updatedAt,
      }),
      (current, dto, updatedAt) => ({ ...current, ...dto, updatedAt }) as AgentWorkflowsDto,
      'AgentWorkflows',
    );
  }

  /** Convenience: fetch a previously-ingested trace by (engagementId, traceId). */
  async getTrace(engagementId: string, traceId: string): Promise<AgentTrace | undefined> {
    return this.store.get(engagementId, traceId);
  }
}

// SPDX-License-Identifier: BUSL-1.1
import { z } from 'zod';
import { ConfigurationError, ValidationError } from '@auditforge/shared';

export interface EventDescriptor<TSchema extends z.ZodTypeAny = z.ZodTypeAny> {
  readonly type: string;
  readonly version: number;
  readonly schema: TSchema;
}

export class EventSchemaRegistry {
  private readonly entries = new Map<string, EventDescriptor>();

  register<S extends z.ZodTypeAny>(d: EventDescriptor<S>): void {
    const key = `${d.type}@${d.version}`;
    if (this.entries.has(key)) {
      throw new ConfigurationError(`Event already registered: ${key}`);
    }
    this.entries.set(key, d);
  }

  get(type: string, version: number): EventDescriptor | undefined {
    return this.entries.get(`${type}@${version}`);
  }

  validate(type: string, version: number, payload: unknown): unknown {
    const d = this.get(type, version);
    if (!d) {
      throw new ValidationError(`Unknown event type/version: ${type}@${version}`);
    }
    const r = d.schema.safeParse(payload);
    if (!r.success) {
      throw new ValidationError(`Invalid event payload: ${type}@${version}`, {
        issues: r.error.issues,
      });
    }
    return r.data;
  }

  list(): readonly EventDescriptor[] {
    return Array.from(this.entries.values());
  }
}

const Uuid = z.string().uuid();

export function createDefaultRegistry(): EventSchemaRegistry {
  const r = new EventSchemaRegistry();

  r.register({
    type: 'firm.created',
    version: 1,
    schema: z.object({ firmId: Uuid, name: z.string().min(1) }),
  });
  r.register({
    type: 'auditor.invited',
    version: 1,
    schema: z.object({ auditorId: Uuid, email: z.string().email() }),
  });
  r.register({
    type: 'auditor.role_assigned',
    version: 1,
    schema: z.object({ auditorId: Uuid, role: z.string().min(1) }),
  });
  r.register({
    type: 'client.created',
    version: 1,
    schema: z.object({ clientId: Uuid, legalName: z.string().min(1) }),
  });
  r.register({
    type: 'engagement.created',
    version: 1,
    schema: z.object({
      engagementId: Uuid,
      clientId: Uuid,
      scopeStatement: z.string().min(1),
    }),
  });
  r.register({
    type: 'audit_event.scheduled',
    version: 1,
    schema: z.object({
      auditEventId: Uuid,
      engagementId: Uuid,
      eventType: z.enum(['stage1', 'stage2', 'surveillance', 'recertification', 'special']),
      plannedStart: z.string(),
      plannedEnd: z.string(),
    }),
  });
  r.register({
    type: 'working_paper.created',
    version: 1,
    schema: z.object({
      workingPaperId: Uuid,
      auditEventId: Uuid,
      clauseRef: z.string().min(1).optional(),
      controlRef: z.string().min(1).optional(),
    }),
  });
  r.register({
    type: 'working_paper.updated',
    version: 1,
    schema: z.object({
      workingPaperId: Uuid,
      verdict: z.enum(['conformant', 'minor_nc', 'major_nc', 'ofi', 'na']).optional(),
      confidence: z.number().min(0).max(1).optional(),
    }),
  });
  r.register({
    type: 'evidence.uploaded',
    version: 1,
    schema: z.object({
      evidenceId: Uuid,
      sha256: z.string().regex(/^[0-9a-f]{64}$/),
      sizeBytes: z.number().int().nonnegative(),
      mimeType: z.string().min(1),
    }),
  });
  r.register({
    type: 'finding.opened',
    version: 1,
    schema: z.object({
      findingId: Uuid,
      type: z.enum(['major_nc', 'minor_nc', 'ofi', 'conformity']),
      clauseRef: z.string().min(1),
    }),
  });
  r.register({
    type: 'finding.closed',
    version: 1,
    schema: z.object({ findingId: Uuid, closureReason: z.string().min(1) }),
  });
  r.register({
    type: 'capa.proposed',
    version: 1,
    schema: z.object({ capaId: Uuid, findingId: Uuid }),
  });
  r.register({
    type: 'capa.verified',
    version: 1,
    schema: z.object({ capaId: Uuid, effective: z.boolean() }),
  });
  r.register({
    type: 'probe.executed',
    version: 1,
    schema: z.object({
      probeExecutionId: Uuid,
      probeDefinitionId: Uuid,
      mode: z.enum(['offline', 'live', 'replay']),
      verdict: z.enum(['pass', 'fail', 'inconclusive']),
    }),
  });
  r.register({
    type: 'agent_trace.ingested',
    version: 1,
    schema: z.object({
      traceId: Uuid,
      source: z.enum(['otel', 'langfuse', 'phoenix', 'custom']),
      spanCount: z.number().int().nonnegative(),
    }),
  });
  r.register({
    type: 'report.signed',
    version: 1,
    schema: z.object({
      reportId: Uuid,
      signerAuditorId: Uuid,
      signatureAlg: z.string().min(1),
    }),
  });
  r.register({
    type: 'audit_file.frozen',
    version: 1,
    schema: z.object({
      archiveId: Uuid,
      engagementId: Uuid,
      sha256: z.string().regex(/^[0-9a-f]{64}$/),
    }),
  });
  r.register({
    type: 'co_auditor.invoked',
    version: 1,
    schema: z.object({
      invocationId: Uuid,
      backend: z.enum(['local', 'cloud']),
      operation: z.string().min(1),
    }),
  });

  return r;
}

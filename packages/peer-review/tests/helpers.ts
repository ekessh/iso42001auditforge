// SPDX-License-Identifier: BUSL-1.1
import { randomUUID } from 'node:crypto';
import type {
  IndependencePolicy,
  PeerReviewChecklist,
  PeerReviewRequest,
  ReviewerRecord,
  AuditKind,
} from '../src/index.js';
import type { TenantContext } from '@auditforge/shared';
import { type LedgerEmitter, type Clock } from '../src/workflow/workflow.js';
import type { PeerReviewLedgerEvent } from '../src/domain/events.js';

export const FIRM_A = randomUUID();
export const FIRM_B = randomUUID();

export const ENGAGEMENT_A = randomUUID();
export const PRIMARY = randomUUID();
export const TEAM_AUDITOR_1 = randomUUID();
export const TEAM_AUDITOR_2 = randomUUID();
export const REVIEWER = randomUUID();

export function tenant(
  overrides?: Partial<TenantContext>,
): TenantContext {
  return {
    firmId: FIRM_A,
    auditorId: REVIEWER,
    engagementId: ENGAGEMENT_A,
    ...overrides,
  };
}

export function policy(overrides?: Partial<IndependencePolicy>): IndependencePolicy {
  return {
    firmId: FIRM_A,
    reciprocalLookback: 2,
    excludeSupervisor: true,
    requiredRoles: [],
    excludedAuditorIds: [],
    notes: '',
    ...overrides,
  };
}

export function reviewer(overrides?: Partial<ReviewerRecord>): ReviewerRecord {
  return {
    auditorId: REVIEWER,
    firmId: FIRM_A,
    roles: ['peer_reviewer', 'lead_auditor'],
    supervisorOf: [],
    recentReviewsForAuditor: [],
    ...overrides,
  };
}

export function makeChecklist(overrides?: Partial<PeerReviewChecklist>): PeerReviewChecklist {
  return {
    id: 'pr-stage2-default',
    version: '1.0.0',
    title: 'Stage 2 Peer Review',
    description: '',
    appliesTo: 'stage2',
    customizationOf: undefined as unknown as { id: string; version: string } | undefined,
    items: [
      { id: 'plan-adequacy', section: 'Plan', text: 'Plan is adequate?', clauseRef: '17021-1.9.2', weight: 5, naAllowed: true, blockingOnFail: false },
      { id: 'sampling-defensible', section: 'Sampling', text: 'Sampling defensible?', clauseRef: '17021-1.9.4', weight: 5, naAllowed: true, blockingOnFail: false },
      { id: 'evidence-traceable', section: 'Evidence', text: 'Evidence traceable to NCs?', clauseRef: '17021-1.9.4.7', weight: 8, naAllowed: false, blockingOnFail: true },
      { id: 'ai-system-context', section: 'AI', text: 'AI system context captured?', clauseRef: '42001.6.1', weight: 3, naAllowed: true, blockingOnFail: false },
      { id: 'closing-meeting', section: 'Reporting', text: 'Closing meeting minuted?', clauseRef: '17021-1.9.4.9', weight: 4, naAllowed: false, blockingOnFail: false },
    ],
    publishedAt: '2026-01-01T00:00:00.000Z',
    frozen: true,
    ...overrides,
  } as PeerReviewChecklist;
}

export function makeRequest(overrides?: Partial<PeerReviewRequest>): PeerReviewRequest {
  return {
    id: randomUUID(),
    firmId: FIRM_A,
    engagementId: ENGAGEMENT_A,
    auditKind: 'stage2' as AuditKind,
    primaryAuditorId: PRIMARY,
    engagementTeamIds: [PRIMARY, TEAM_AUDITOR_1, TEAM_AUDITOR_2],
    reviewerId: undefined,
    checklistId: 'pr-stage2-default',
    checklistVersion: '1.0.0',
    responses: [],
    status: 'pending',
    signOff: undefined,
    createdAt: '2026-05-01T00:00:00.000Z',
    updatedAt: '2026-05-01T00:00:00.000Z',
    assignedAt: undefined,
    closedAt: undefined,
    revisionCount: 0,
    ...overrides,
  };
}

export class RecordingEmitter implements LedgerEmitter {
  readonly events: PeerReviewLedgerEvent[] = [];
  emit(event: PeerReviewLedgerEvent): void {
    this.events.push(event);
  }
  clear(): void {
    this.events.length = 0;
  }
  kinds(): string[] {
    return this.events.map((e) => e.kind);
  }
}

export class FixedClock implements Clock {
  constructor(private current: string = '2026-05-03T12:00:00.000Z') {}
  now(): string {
    return this.current;
  }
  set(value: string): void {
    this.current = value;
  }
  advance(ms: number): void {
    this.current = new Date(new Date(this.current).getTime() + ms).toISOString();
  }
}

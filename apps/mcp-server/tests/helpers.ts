// SPDX-License-Identifier: BUSL-1.1
/**
 * In-memory test fixtures for the MCP server. Two firms, three engagements,
 * findings, candidate findings, claims, coverage state, working papers.
 *
 * Tests assert behavior across firms (cross-tenant) and roles.
 */

import type {
  AuditDataPort,
  CandidateFindingRecord,
  ClaimRecord,
  CoverageStateRecord,
  EngagementRecord,
  EngagementSummary,
  FindingRecord,
  FollowupQuestion,
  LibraryQuestionRecord,
  ListEngagementsFilters,
  Principal,
  ReportRecord,
  WorkingPaperRecord,
} from '../src/types.js';
import { InMemoryLedger } from '../src/audit.js';
import { StaticPrincipalAuthGateway } from '../src/auth.js';
import { createMcpServer, type McpServer } from '../src/server.js';
import type { McpReceiptSigner, ReceiptPayload, SignedReceipt } from '../src/signing.js';

class StubReceiptSigner implements McpReceiptSigner {
  async sign(payload: ReceiptPayload): Promise<SignedReceipt> {
    const json = JSON.stringify(payload);
    return {
      keyId: 'test-key-1',
      algorithm: 'Ed25519',
      signatureBase64: Buffer.from(`stubsig:${json}`).toString('base64'),
      canonicalPayloadBase64: Buffer.from(json).toString('base64'),
    };
  }
}

export interface Fixture {
  readonly server: McpServer;
  readonly ledger: InMemoryLedger;
  readonly tokens: Readonly<Record<string, string>>;
  readonly principals: Readonly<Record<string, Principal>>;
  readonly data: InMemoryData;
}

export class InMemoryData implements AuditDataPort {
  readonly engagements: EngagementRecord[] = [
    {
      id: 'eng-acme-001',
      firmId: 'firm-cb-1',
      auditeeName: 'Acme AI',
      mode: 'audit',
      phase: 'S2',
      leadAuditorId: 'auditor-lead-1',
      memberAuditorIds: ['auditor-team-1', 'auditor-peer-1'],
      status: 'active',
      openedAt: '2026-04-01T09:00:00Z',
      closedAt: null,
    },
    {
      id: 'eng-bigco-002',
      firmId: 'firm-cb-1',
      auditeeName: 'BigCo',
      mode: 'audit',
      phase: 'S1',
      leadAuditorId: 'auditor-lead-1',
      memberAuditorIds: [],
      status: 'planned',
      openedAt: '2026-04-15T09:00:00Z',
      closedAt: null,
    },
    {
      id: 'eng-other-firm-003',
      firmId: 'firm-cb-2',
      auditeeName: 'Foreign Co',
      mode: 'readiness',
      phase: 'Readiness',
      leadAuditorId: 'auditor-lead-2',
      memberAuditorIds: [],
      status: 'active',
      openedAt: '2026-03-01T09:00:00Z',
      closedAt: null,
    },
  ];

  readonly findings: FindingRecord[] = [
    {
      id: 'find-001',
      engagementId: 'eng-acme-001',
      type: 'minor-nc',
      status: 'open',
      clauseIds: ['A.7.4'],
      statement: 'Data quality controls inconsistently documented for the recommender model.',
      createdAt: '2026-04-02T10:00:00Z',
    },
    {
      id: 'find-002',
      engagementId: 'eng-acme-001',
      type: 'ofi',
      status: 'closed',
      clauseIds: ['A.6.2.5'],
      statement: 'Deployment runbook could include rollback drills.',
      createdAt: '2026-04-02T11:00:00Z',
    },
    {
      id: 'find-other-firm-001',
      engagementId: 'eng-other-firm-003',
      type: 'major-nc',
      status: 'open',
      clauseIds: ['9.2'],
      statement: 'Internal audit programme not established.',
      createdAt: '2026-03-02T10:00:00Z',
    },
  ];

  readonly candidates: CandidateFindingRecord[] = [
    {
      id: 'cand-001',
      engagementId: 'eng-acme-001',
      proposedType: 'minor-nc',
      clauseIds: ['A.7.5'],
      draftStatement: 'Data provenance for production training data not consistently captured.',
      confidence: 0.78,
      sourceClaimIds: ['claim-001'],
      createdAt: '2026-04-02T13:00:00Z',
    },
  ];

  readonly claims: ClaimRecord[] = [
    {
      id: 'claim-001',
      engagementId: 'eng-acme-001',
      subject: 'training pipeline',
      predicate: 'lacks',
      object: 'documented provenance',
      text: 'Our training pipeline does not yet capture data provenance for every batch.',
      extractedAt: '2026-04-02T12:00:00Z',
    },
    {
      id: 'claim-002',
      engagementId: 'eng-acme-001',
      subject: 'model retraining',
      predicate: 'is documented in',
      object: 'change log',
      text: 'Model retraining decisions are logged in the change log.',
      extractedAt: '2026-04-02T12:05:00Z',
    },
  ];

  readonly coverage: CoverageStateRecord[] = [
    {
      engagementId: 'eng-acme-001',
      clauseId: 'A.7.4',
      status: 'evidenced',
      confidence: 0.92,
      lastUpdate: '2026-04-02T12:30:00Z',
    },
    {
      engagementId: 'eng-acme-001',
      clauseId: 'A.7.5',
      status: 'partial',
      confidence: 0.55,
      lastUpdate: '2026-04-02T12:35:00Z',
    },
  ];

  readonly workingPapers: WorkingPaperRecord[] = [
    {
      id: 'wp-001',
      engagementId: 'eng-acme-001',
      clauseId: 'A.7.4',
      title: 'Data quality WP',
      status: 'draft',
      updatedAt: '2026-04-02T09:00:00Z',
      content: 'Working paper content for A.7.4 draft.',
    },
  ];

  readonly libraryQuestions: LibraryQuestionRecord[] = [
    {
      id: 'Q-DQ-001',
      text: 'How is data quality measured for the recommender model?',
      clauseIds: ['A.7.4'],
      score: 0.92,
    },
    {
      id: 'Q-PROV-001',
      text: 'What provenance is captured for each training-data batch?',
      clauseIds: ['A.7.5'],
      score: 0.88,
    },
  ];

  readonly reports: ReportRecord[] = [
    {
      id: 'rep-acme-001',
      engagementId: 'eng-acme-001',
      kind: 'final',
      status: 'pending-signature',
      createdAt: '2026-04-30T09:00:00Z',
      publishedAt: null,
    },
  ];

  async listEngagements(p: Principal, filters: ListEngagementsFilters): Promise<readonly EngagementRecord[]> {
    return this.engagements.filter((e) => {
      if (e.firmId !== p.firmId) return false;
      if (!p.engagements.includes(e.id)) return false;
      if (filters.status && e.status !== filters.status) return false;
      if (filters.mode && e.mode !== filters.mode) return false;
      if (filters.leadAuditorId && e.leadAuditorId !== filters.leadAuditorId) return false;
      return true;
    });
  }

  async getEngagement(p: Principal, id: string): Promise<EngagementRecord | null> {
    const e = this.engagements.find((x) => x.id === id);
    if (!e) return null;
    if (e.firmId !== p.firmId) return null;
    if (!p.engagements.includes(e.id)) return null;
    return e;
  }

  async listFindings(p: Principal, engagementId: string, status?: FindingRecord['status']): Promise<readonly FindingRecord[]> {
    if (!p.engagements.includes(engagementId)) return [];
    return this.findings.filter((f) => {
      if (f.engagementId !== engagementId) return false;
      if (status && f.status !== status) return false;
      return true;
    });
  }

  async getCandidateFindings(p: Principal, engagementId: string): Promise<readonly CandidateFindingRecord[]> {
    if (!p.engagements.includes(engagementId)) return [];
    return this.candidates.filter((c) => c.engagementId === engagementId);
  }

  async getCoverageState(p: Principal, engagementId: string): Promise<readonly CoverageStateRecord[]> {
    if (!p.engagements.includes(engagementId)) return [];
    return this.coverage.filter((c) => c.engagementId === engagementId);
  }

  async searchClaims(p: Principal, engagementId: string, query: string): Promise<readonly ClaimRecord[]> {
    if (!p.engagements.includes(engagementId)) return [];
    const q = query.toLowerCase();
    return this.claims.filter(
      (c) => c.engagementId === engagementId && (q === '*' || c.text.toLowerCase().includes(q)),
    );
  }

  async getClaim(p: Principal, engagementId: string, claimId: string): Promise<ClaimRecord | null> {
    if (!p.engagements.includes(engagementId)) return null;
    const c = this.claims.find((x) => x.engagementId === engagementId && x.id === claimId);
    return c ?? null;
  }

  async listWorkingPapers(p: Principal, engagementId: string): Promise<readonly WorkingPaperRecord[]> {
    if (!p.engagements.includes(engagementId)) return [];
    return this.workingPapers.filter((w) => w.engagementId === engagementId);
  }

  async computeSummary(p: Principal, engagementId: string): Promise<EngagementSummary | null> {
    if (!p.engagements.includes(engagementId)) return null;
    const fs = this.findings.filter((f) => f.engagementId === engagementId);
    const counts = {
      majorNc: fs.filter((f) => f.type === 'major-nc').length,
      minorNc: fs.filter((f) => f.type === 'minor-nc').length,
      ofi: fs.filter((f) => f.type === 'ofi').length,
      observation: fs.filter((f) => f.type === 'observation').length,
    };
    const cands = this.candidates.filter((c) => c.engagementId === engagementId);
    const cov = this.coverage.filter((c) => c.engagementId === engagementId);
    const evidenced = cov.filter((c) => c.status === 'evidenced').length;
    const total = Math.max(1, cov.length);
    const coveragePct = (evidenced / total) * 100;
    const recommendation: EngagementSummary['recommendation'] =
      counts.majorNc > 0
        ? 'nonconformity'
        : counts.minorNc > 0
          ? 'conformity-pending-capa'
          : 'conformity';
    return {
      engagementId,
      coveragePct,
      findingCounts: counts,
      openCandidateCount: cands.length,
      recommendation,
      text: `Coverage ${coveragePct.toFixed(0)}%. ${counts.majorNc} major / ${counts.minorNc} minor NCs.`,
    };
  }

  async draftFollowup(_p: Principal, claim: ClaimRecord): Promise<FollowupQuestion> {
    return {
      text: `Can you walk me through how "${claim.subject}" is verified?`,
      libraryRefId: 'Q-FOLLOW-001',
      mappedClauses: ['A.7.5', 'A.7.4'],
      modelInvocationId: null,
    };
  }

  async getWorkingPaper(p: Principal, engagementId: string, workingPaperId: string): Promise<WorkingPaperRecord | null> {
    if (!p.engagements.includes(engagementId)) return null;
    const wp = this.workingPapers.find((w) => w.engagementId === engagementId && w.id === workingPaperId);
    return wp ?? null;
  }

  async searchLibrary(
    _p: Principal,
    query: string,
    clauseFilter: readonly string[] | null,
    limit: number,
  ): Promise<readonly LibraryQuestionRecord[]> {
    const q = query.toLowerCase();
    const filtered = this.libraryQuestions.filter((qq) => {
      if (q !== '*' && !qq.text.toLowerCase().includes(q)) return false;
      if (clauseFilter && clauseFilter.length > 0) {
        return qq.clauseIds.some((c) => clauseFilter.includes(c));
      }
      return true;
    });
    return filtered.slice(0, limit);
  }

  async listReports(p: Principal, engagementId: string): Promise<readonly ReportRecord[]> {
    if (!p.engagements.includes(engagementId)) return [];
    return this.reports.filter((r) => r.engagementId === engagementId);
  }

  async publishReport(
    p: Principal,
    engagementId: string,
    reportId: string,
    confirmationToken: string,
  ): Promise<ReportRecord | null> {
    if (!p.engagements.includes(engagementId)) return null;
    if (confirmationToken !== 'confirm-token-valid') return null;
    const r = this.reports.find((x) => x.engagementId === engagementId && x.id === reportId);
    if (!r) return null;
    const published: ReportRecord = {
      ...r,
      status: 'published',
      publishedAt: '2026-05-03T12:00:00Z',
    };
    const idx = this.reports.indexOf(r);
    this.reports[idx] = published;
    return published;
  }
}

/** Build the standard fixture with three principals: lead, peer reviewer, foreign-firm. */
export function buildFixture(): Fixture {
  const data = new InMemoryData();
  const ledger = new InMemoryLedger();

  const principals: Record<string, Principal> = {
    lead: Object.freeze({
      auditorId: 'auditor-lead-1',
      firmId: 'firm-cb-1',
      roles: ['lead_auditor'],
      engagements: ['eng-acme-001', 'eng-bigco-002'],
      sub: 'auth0|lead1',
      tokenId: 'tok-lead-1',
    }),
    peer: Object.freeze({
      auditorId: 'auditor-peer-1',
      firmId: 'firm-cb-1',
      roles: ['peer_reviewer'],
      engagements: ['eng-acme-001'],
      sub: 'auth0|peer1',
      tokenId: 'tok-peer-1',
    }),
    technical: Object.freeze({
      auditorId: 'auditor-tech-1',
      firmId: 'firm-cb-1',
      roles: ['technical_expert'],
      engagements: ['eng-acme-001'],
      sub: 'auth0|tech1',
      tokenId: 'tok-tech-1',
    }),
    manager: Object.freeze({
      auditorId: 'auditor-mgr-1',
      firmId: 'firm-cb-1',
      roles: ['audit_manager'],
      engagements: ['eng-acme-001', 'eng-bigco-002'],
      sub: 'auth0|mgr1',
      tokenId: 'tok-mgr-1',
    }),
    admin: Object.freeze({
      auditorId: 'auditor-admin-1',
      firmId: 'firm-cb-1',
      roles: ['firm_admin'],
      engagements: ['eng-acme-001', 'eng-bigco-002'],
      sub: 'auth0|admin1',
      tokenId: 'tok-admin-1',
    }),
    auditee: Object.freeze({
      auditorId: 'auditee-1',
      firmId: 'firm-cb-1',
      roles: ['auditee'],
      engagements: ['eng-acme-001'],
      sub: 'auth0|auditee1',
      tokenId: 'tok-auditee-1',
    }),
    foreign: Object.freeze({
      // Different firm. Has lead role but no engagement membership in firm-cb-1.
      auditorId: 'auditor-lead-2',
      firmId: 'firm-cb-2',
      roles: ['lead_auditor'],
      engagements: ['eng-other-firm-003'],
      sub: 'auth0|lead2',
      tokenId: 'tok-lead-2',
    }),
  };

  const tokens: Record<string, string> = {
    lead: 'tok-lead',
    peer: 'tok-peer',
    technical: 'tok-tech',
    manager: 'tok-mgr',
    admin: 'tok-admin',
    auditee: 'tok-auditee',
    foreign: 'tok-foreign',
  };

  const auth = new StaticPrincipalAuthGateway(
    [
      [tokens.lead, principals.lead],
      [tokens.peer, principals.peer],
      [tokens.technical, principals.technical],
      [tokens.manager, principals.manager],
      [tokens.admin, principals.admin],
      [tokens.auditee, principals.auditee],
      [tokens.foreign, principals.foreign],
    ] as Array<[string, Principal]>,
    { _testOnly: true },
  );

  const server = createMcpServer({
    auth,
    data,
    ledger,
    now: () => new Date('2026-05-03T12:00:00Z'),
    receiptSigner: new StubReceiptSigner(),
  });

  return { server, ledger, tokens, principals, data };
}

export function bearer(tok: string): string {
  return `Bearer ${tok}`;
}

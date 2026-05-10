// SPDX-License-Identifier: BUSL-1.1
import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import {
  AuditLedger,
  InMemoryEventRepository,
  StubTsaProvider,
  createDefaultRegistry,
} from '@auditforge/audit-engine';
import { SoftwareSigningProvider, SigningService, sha256Hex as signSha256 } from '@auditforge/signing';
import { StubTsaClient } from '@auditforge/tsa';
import {
  ReportEngineService,
  buildDocx,
  buildPdf,
  readinessOverallScore,
  type AuditReport,
  type ReadinessReport,
  type ReportLedgerWriter,
  type ReportSigningProvider,
  type ReportTsaProvider,
} from '../src/export/index.js';

const FIRM = '11111111-1111-1111-1111-111111111111';

function fixtureAuditReport(): AuditReport {
  return {
    kind: 'audit',
    auditEventKind: 'stage2',
    reportId: randomUUID(),
    engagementId: randomUUID(),
    firmId: FIRM,
    clientLegalName: 'Acme AI Ltd.',
    scopeStatement: 'AIMS for the OrderBot agent.',
    methodologySummary: 'Stage 2 audit per ISO 17021-1 §9.4.8 sampling 25 evidence items.',
    generatedAt: '2026-04-01T12:00:00.000Z',
    signers: [
      { role: 'lead_auditor', name: 'A. Sole', credential: 'CB#0001' },
    ],
    clauses: [
      { ref: '4.1', title: 'Context', weight: 1.5, status: 'evidenced', evidenceCount: 3 },
      { ref: 'A.5.4', title: 'AI risk treatment', weight: 1.0, status: 'partial', evidenceCount: 1 },
    ],
    findings: [
      { number: 'NC-2026-001', kind: 'minor_nc', clauseRef: 'A.5.4', title: 'Evidence gap', statement: 'No retention.', evidenceRefs: [] },
    ],
    attachments: [],
    conformitySummary: 'Conformant with one minor NC.',
  };
}

function fixtureReadinessReport(): ReadinessReport {
  return {
    kind: 'readiness',
    reportId: randomUUID(),
    engagementId: randomUUID(),
    firmId: FIRM,
    clientLegalName: 'Acme AI Ltd.',
    scopeStatement: 'Pre-cert readiness check for the OrderBot agent.',
    methodologySummary: 'Readiness per AuditForge methodology v1.',
    generatedAt: '2026-04-01T12:00:00.000Z',
    signers: [{ role: 'lead_auditor', name: 'A. Sole' }],
    clauses: [
      { ref: '4.1', title: 'Context', weight: 1.5, status: 'evidenced', evidenceCount: 3 },
      { ref: '6.1', title: 'Risk', weight: 1.5, status: 'partial', evidenceCount: 1 },
      { ref: '7.5', title: 'Documented info', weight: 1.0, status: 'untouched', evidenceCount: 0 },
      { ref: 'A.7.1', title: 'Excluded control', weight: 1.0, status: 'na', evidenceCount: 0 },
    ],
    findings: [],
    attachments: [],
    readinessScore: 0.5,
    capaSummary: '2 candidate NCs; 1 CAPA proposed.',
  };
}

function makeService() {
  const repo = new InMemoryEventRepository();
  const registry = createDefaultRegistry();
  registry.register({
    type: 'report.published',
    version: 1,
    schema: z.object({}).passthrough(),
  });
  const ledger = new AuditLedger(repo, registry, new StubTsaProvider());
  const ledgerWriter: ReportLedgerWriter = {
    async emit(input) {
      const evt = await ledger.emit(
        {
          firmId: input.firmId,
          ...(input.auditorId !== undefined ? { auditorId: input.auditorId } : {}),
          ...(input.engagementId !== undefined ? { engagementId: input.engagementId } : {}),
          producer: 'report-engine.test',
        },
        input.eventType,
        input.payload,
      );
      return { id: evt.id, sequenceNumber: evt.sequenceNumber, chainHash: evt.chainHash };
    },
  };
  const { provider } = SoftwareSigningProvider.generate('test-signing-key');
  const signingSvc = new SigningService(provider);
  const signing: ReportSigningProvider = {
    async signBytes(bytes, opts) {
      const r = await signingSvc.signBytes(bytes, { signerId: opts.signerId });
      return {
        signature: r.signature,
        payloadHash: r.payloadHash,
        signerId: r.signerId,
        signerKeyId: r.signerKeyId,
        publicKeyBase64: r.publicKeyBase64,
        algorithm: r.algorithm,
        ts: r.ts,
      };
    },
  };
  const tsaClient = new StubTsaClient();
  const tsa: ReportTsaProvider = {
    async stamp(payloadDigestHex) {
      const t = await tsaClient.stamp(payloadDigestHex);
      return { tokenBase64: t.tokenBase64, tsaUrl: t.tsaUrl, issuedAt: t.issuedAt, messageImprintHex: t.messageImprintHex };
    },
  };
  const svc = new ReportEngineService({ signing, tsa, ledger: ledgerWriter });
  return { svc, repo, ledger, signingSvc, provider, tsaClient };
}

describe('readinessOverallScore', () => {
  it('weights mandatory clauses 1.5x, ignores N/A', () => {
    const r = fixtureReadinessReport();
    const s = readinessOverallScore(r.clauses);
    // 1.5*1 + 1.5*0.5 + 1.0*0 = 2.25 / (1.5+1.5+1.0) = 2.25/4.0 = 0.5625
    expect(s).toBeCloseTo(0.5625, 4);
  });
});

describe('buildDocx', () => {
  it('produces a non-empty zip starting with PK', () => {
    const bytes = buildDocx(fixtureAuditReport());
    expect(bytes.length).toBeGreaterThan(800);
    expect(bytes[0]).toBe(0x50);
    expect(bytes[1]).toBe(0x4b);
    expect(bytes[2]).toBe(0x03);
    expect(bytes[3]).toBe(0x04);
  });

  it('Readiness DOCX contains the disclaimer', () => {
    const bytes = buildDocx(fixtureReadinessReport());
    const text = new TextDecoder().decode(bytes);
    expect(text).toContain('NOT A CERTIFICATION AUDIT');
    expect(text).toContain('appears ready');
  });
});

describe('ReportEngineService.publish', () => {
  it('produces signed, TSA-stamped DOCX with ledger entry', async () => {
    const { svc, signingSvc, tsaClient } = makeService();
    const out = await svc.publish(fixtureAuditReport(), { format: 'docx', signerId: 'auditor-1' });
    expect(out.format).toBe('docx');
    expect(out.bytes[0]).toBe(0x50);
    expect(out.contentHash).toMatch(/^[0-9a-f]{64}$/);
    expect(out.ledgerEventId).toMatch(/^[0-9a-f-]+$/);
    const verifies = await signingSvc.verifyReceipt(out.bytes, {
      payloadHash: out.signature.payloadHash,
      prevHash: null,
      signature: out.signature.signature,
      signerId: out.signature.signerId,
      signerKeyId: out.signature.signerKeyId,
      publicKeyBase64: out.signature.publicKeyBase64,
      algorithm: 'Ed25519',
      ts: out.signature.ts,
    });
    expect(verifies).toBe(true);
    const tsaOk = await tsaClient.verify(
      { tokenBase64: out.tsaToken.tokenBase64, tsaUrl: out.tsaToken.tsaUrl, issuedAt: out.tsaToken.issuedAt, hashAlgorithm: 'sha256', messageImprintHex: out.tsaToken.messageImprintHex },
      out.contentHash,
    );
    expect(tsaOk).toBe(true);
  });

  it('readiness DOCX contains the mandatory disclaimer and a publish event is written', async () => {
    const { svc, ledger } = makeService();
    const r = fixtureReadinessReport();
    const out = await svc.publish(r, { format: 'docx', signerId: 'auditor-1' });
    const text = new TextDecoder().decode(out.bytes);
    expect(text).toContain('NOT A CERTIFICATION AUDIT');
    const events = await ledger.listEvents({ firmId: r.firmId });
    expect(events.some((e) => e.eventType === 'report.published')).toBe(true);
    const last = events[events.length - 1]!;
    expect(last.payload.readinessDisclaimerEmbedded).toBe(true);
  });

  it('readiness PDF/A-3 contains the disclaimer and AFRelationship for attachments', async () => {
    const { svc } = makeService();
    const evidenceBytes = new TextEncoder().encode('signed-evidence');
    const att = {
      name: 'evidence.txt',
      relationship: 'Source' as const,
      bytes: evidenceBytes,
      mimeType: 'text/plain',
      sha256: signSha256(evidenceBytes),
    };
    const out = await svc.publish(fixtureReadinessReport(), {
      format: 'pdfa3',
      signerId: 'auditor-1',
      attachments: [att],
    });
    const text = new TextDecoder('utf-8', { fatal: false }).decode(out.bytes);
    expect(text).toContain('NOT A CERTIFICATION AUDIT');
    expect(text).toContain('AFRelationship /Source');
    expect(text).toContain('pdfaid:part>3');
  });
});

describe('buildPdf', () => {
  it('produces a valid PDF header and EOF marker', () => {
    const bytes = buildPdf({ report: fixtureAuditReport() });
    const text = new TextDecoder('utf-8', { fatal: false }).decode(bytes);
    expect(text.startsWith('%PDF-1.7')).toBe(true);
    expect(text).toContain('%%EOF');
    expect(text).toContain('pdfaid:part>3');
    expect(text).toContain('OutputIntents');
  });

  it('PDF/A-3 attachments include AFRelationship', () => {
    const att = {
      name: 'evidence.txt',
      relationship: 'Source' as const,
      bytes: new TextEncoder().encode('some evidence'),
      mimeType: 'text/plain',
      sha256: signSha256(new TextEncoder().encode('some evidence')),
    };
    const bytes = buildPdf({ report: fixtureAuditReport(), attachments: [att] });
    const text = new TextDecoder('utf-8', { fatal: false }).decode(bytes);
    expect(text).toContain('AFRelationship /Source');
    expect(text).toContain('/EmbeddedFile');
    expect(text).toContain('CheckSum');
  });

  it('Readiness PDF contains the disclaimer text', () => {
    const bytes = buildPdf({ report: fixtureReadinessReport() });
    const text = new TextDecoder('utf-8', { fatal: false }).decode(bytes);
    expect(text).toContain('NOT A CERTIFICATION AUDIT');
    expect(text.toLowerCase()).toContain('not a certification audit');
  });
});

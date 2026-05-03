// SPDX-License-Identifier: BUSL-1.1
import { describe, expect, it } from 'vitest';
import {
  ConclusionSummarySchema,
  generateAuditConclusionSummary,
  generateConclusionSummary,
  generateReadinessConclusionSummary,
  READINESS_DISCLAIMER,
} from '../../src/adaptive-evolution/adaptive-index.js';

const ENG = '11111111-1111-4111-8111-111111111111';

describe('generateAuditConclusionSummary', () => {
  it('matches the snapshot for clean conformity (zero NCs)', () => {
    const out = generateAuditConclusionSummary({
      engagementId: ENG,
      mode: 'audit',
      counts: { majorNc: 0, minorNc: 0, ofi: 2 },
    });
    expect(out.text).toMatchInlineSnapshot(
      `"No NCs identified. 2 OFIs noted. Recommendation: Conformity."`,
    );
    expect(out.recommendation).toBe('conformity');
    expect(out.disclaimer).toBeNull();
  });

  it('matches the snapshot for withheld conformity', () => {
    const out = generateAuditConclusionSummary({
      engagementId: ENG,
      mode: 'audit',
      counts: { majorNc: 1, minorNc: 3, ofi: 2 },
    });
    expect(out.text).toMatchInlineSnapshot(
      `"1 Major NCs, 3 Minor NCs, 2 OFIs identified. Per ISO 17021-1, conformity withheld pending corrective action review."`,
    );
    expect(out.recommendation).toBe('withheld');
  });

  it('classifies as withheld when majorNc=0 but minorNc>0', () => {
    const out = generateAuditConclusionSummary({
      engagementId: ENG,
      mode: 'audit',
      counts: { majorNc: 0, minorNc: 2, ofi: 0 },
    });
    expect(out.recommendation).toBe('withheld');
    expect(out.text).toMatch(/Per ISO 17021-1/);
  });

  it('emits zero counts cleanly', () => {
    const out = generateAuditConclusionSummary({
      engagementId: ENG,
      mode: 'audit',
      counts: { majorNc: 0, minorNc: 0, ofi: 0 },
    });
    expect(out.text).toMatch(/0 OFIs noted/);
  });
});

describe('generateReadinessConclusionSummary', () => {
  it('matches the readiness snapshot text + disclaimer', () => {
    const out = generateReadinessConclusionSummary({
      engagementId: ENG,
      mode: 'readiness',
    });
    expect(out.text).toMatchInlineSnapshot(
      `"Readiness check complete. AIMS appears ready for certification audit."`,
    );
    expect(out.disclaimer).toBe(READINESS_DISCLAIMER);
    expect(out.recommendation).toBe('appears_ready');
  });

  it('disclaimer references the non-certification language', () => {
    const out = generateReadinessConclusionSummary({
      engagementId: ENG,
      mode: 'readiness',
    });
    expect(out.disclaimer).toMatch(/not a certification/i);
    expect(out.disclaimer).toMatch(/accredited certification body/i);
  });
});

describe('generateConclusionSummary', () => {
  it('routes to audit summary when mode=audit', () => {
    const out = generateConclusionSummary(ENG, 'audit', {
      majorNc: 1,
      minorNc: 0,
      ofi: 0,
    });
    expect(out.mode).toBe('audit');
    expect(out.recommendation).toBe('withheld');
  });

  it('routes to readiness summary when mode=readiness', () => {
    const out = generateConclusionSummary(ENG, 'readiness');
    expect(out.mode).toBe('readiness');
    expect(out.disclaimer).toBe(READINESS_DISCLAIMER);
  });

  it('passes ConclusionSummarySchema validation', () => {
    const audit = generateConclusionSummary(ENG, 'audit', {
      majorNc: 0,
      minorNc: 0,
      ofi: 1,
    });
    const readiness = generateConclusionSummary(ENG, 'readiness');
    expect(ConclusionSummarySchema.safeParse(audit).success).toBe(true);
    expect(ConclusionSummarySchema.safeParse(readiness).success).toBe(true);
  });
});

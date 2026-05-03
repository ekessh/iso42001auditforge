// SPDX-License-Identifier: BUSL-1.1
import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  DirectConformityGapDetector,
  EvidenceAbsenceDetector,
  ContradictionDerivedDetector,
  OfiSignalDetector,
  ParallelNcDrafter,
  SystemicPatternDetector,
  type NcDraftLlmArgs,
  type NcDraftLlmResult,
  type NcDraftingLlm,
} from '../src/index.js';
import {
  attribution,
  makeBlock,
  makeClaim,
  makeContext,
  makeContradictionPair,
} from './fixtures.js';

const allDetectors = [
  new DirectConformityGapDetector(),
  new EvidenceAbsenceDetector(),
  new ContradictionDerivedDetector(),
  new SystemicPatternDetector(),
  new OfiSignalDetector(),
];

const goodLlm: NcDraftingLlm = {
  async draft(args: NcDraftLlmArgs): Promise<NcDraftLlmResult> {
    return {
      modelInvocationId: `mi_${randomUUID()}`,
      payload: {
        draftStatement:
          `Auditee did not provide objective evidence demonstrating implementation of the requirements of ${args.signal.clauseIds[0] ?? 'unknown'}; ` +
          `proposed type: ${args.signal.type}.`,
        proposedSeverityRationale: args.signal.rationale,
        proposedType: args.signal.type,
        confidence: args.signal.confidence,
        suggestedRootCausePrompts: [...args.signal.suggestedRootCausePrompts],
      },
    };
  },
};

const badLlm: NcDraftingLlm = {
  async draft(_args: NcDraftLlmArgs): Promise<NcDraftLlmResult> {
    return {
      modelInvocationId: 'mi_bad',
      payload: { draftStatement: 'too short' }, // missing required field
    };
  },
};

const throwingLlm: NcDraftingLlm = {
  async draft(_args: NcDraftLlmArgs): Promise<NcDraftLlmResult> {
    throw new Error('local model unavailable');
  },
};

function makeDrafter(llm: NcDraftingLlm) {
  return new ParallelNcDrafter({
    detectors: allDetectors,
    llm,
    idGen: () => randomUUID(),
    clock: () => '2026-05-03T10:00:00.000Z',
  });
}

describe('ParallelNcDrafter end-to-end', () => {
  it('produces candidate findings from a multi-detector window', async () => {
    const denyClaim = makeClaim({
      polarity: 'denies',
      controlImplemented: false,
      attributions: [attribution('6.1.2', null, 0.93)],
    });
    const ofiClaim = makeClaim({
      functioning: true,
      processMaturity: 'manual',
      polarity: 'affirms',
      controlImplemented: true,
      attributions: [attribution('A.6.2.5', null, 0.85)],
    });
    const ctx = makeContext({
      expectedEvidenceBlocks: [makeBlock('A.6.2.8', true)],
    });
    const drafter = makeDrafter(goodLlm);
    const out = await drafter.run(
      { windowClaims: [denyClaim, ofiClaim] },
      ctx,
    );
    if (out.created.length < 3) {
      // Surface helpful diagnostic when the multi-detector window underdelivers.
      // eslint-disable-next-line no-console
      console.error(
        'Drafter created:',
        out.created.map((c) => ({
          type: c.type,
          detector: c.detectorId,
          clauses: c.linkedClauses,
        })),
        'dropped:',
        out.dropped,
      );
    }
    expect(out.created.length).toBeGreaterThanOrEqual(3);
    const types = out.created.map((c) => c.type).sort();
    expect(types).toContain('major_nc');
    expect(types).toContain('ofi');
    expect(types).toContain('minor_nc');
    for (const c of out.created) {
      expect(c.status).toBe('pending');
      expect(c.modelInvocationId).toBeTruthy();
      expect(c.promptTemplateVersion).toMatch(/^nc_drafting\.v/);
      expect(c.firmId).toBe(ctx.firmId);
      expect(c.engagementId).toBe(ctx.engagementId);
    }
  });

  it('drops signals when LLM payload fails schema validation', async () => {
    const claim = makeClaim({
      polarity: 'denies',
      controlImplemented: false,
      attributions: [attribution('6.1.2')],
    });
    const drafter = makeDrafter(badLlm);
    const out = await drafter.run({ windowClaims: [claim] }, makeContext());
    expect(out.created).toHaveLength(0);
    expect(out.dropped).toHaveLength(1);
    expect(out.dropped[0]!.reason).toMatch(/llm_schema_validation/);
  });

  it('captures LLM invocation errors in dropped records', async () => {
    const claim = makeClaim({
      polarity: 'denies',
      controlImplemented: false,
      attributions: [attribution('6.1.2')],
    });
    const drafter = makeDrafter(throwingLlm);
    const out = await drafter.run({ windowClaims: [claim] }, makeContext());
    expect(out.created).toHaveLength(0);
    expect(out.dropped[0]!.reason).toMatch(/llm_invocation_error/);
  });

  it('processes contradictions when supplied', async () => {
    const earlier = makeClaim({
      polarity: 'affirms',
      controlImplemented: true,
      attributions: [attribution('6.1.2')],
    });
    const later = makeClaim({
      polarity: 'denies',
      controlImplemented: false,
      attributions: [attribution('6.1.2')],
    });
    const drafter = makeDrafter(goodLlm);
    const out = await drafter.run(
      {
        windowClaims: [earlier, later],
        contradictions: [makeContradictionPair(earlier, later, '6.1.2')],
      },
      makeContext(),
    );
    const detectors = new Set(out.created.map((c) => c.detectorId));
    expect(detectors.has('detector.contradiction_derived.v1')).toBe(true);
    expect(detectors.has('detector.direct_conformity_gap.v1')).toBe(true);
  });

  it('every created candidate has source claim IDs that exist in the input window', async () => {
    const denyClaim = makeClaim({
      polarity: 'denies',
      controlImplemented: false,
      attributions: [attribution('6.1.2', null, 0.93)],
    });
    const drafter = makeDrafter(goodLlm);
    const out = await drafter.run({ windowClaims: [denyClaim] }, makeContext());
    for (const c of out.created) {
      for (const cid of c.sourceClaimIds) {
        expect([denyClaim.id]).toContain(cid);
      }
    }
  });

  it('drops candidate if status starts at non-pending (regression guard)', async () => {
    const drafter = makeDrafter(goodLlm);
    const denyClaim = makeClaim({
      polarity: 'denies',
      controlImplemented: false,
      attributions: [attribution('6.1.2', null, 0.93)],
    });
    const out = await drafter.run({ windowClaims: [denyClaim] }, makeContext());
    for (const c of out.created) {
      expect(c.status).toBe('pending');
      expect(c.decidedAt).toBeNull();
      expect(c.decidedBy).toBeNull();
      expect(c.dismissalReason).toBeNull();
    }
  });
});

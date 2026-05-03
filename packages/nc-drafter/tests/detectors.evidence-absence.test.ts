// SPDX-License-Identifier: BUSL-1.1
import { describe, expect, it } from 'vitest';
import { EvidenceAbsenceDetector } from '../src/index.js';
import {
  attribution,
  makeBlock,
  makeClaim,
  makeContext,
} from './fixtures.js';

const det = new EvidenceAbsenceDetector();

describe('EvidenceAbsenceDetector', () => {
  it('emits Minor NC when block closed and clause has no attribution', () => {
    const ctx = makeContext({
      expectedEvidenceBlocks: [makeBlock('A.6.2.8', true)],
    });
    const out = det.detect({ claims: [] }, ctx);
    expect(out).toHaveLength(1);
    expect(out[0]!.type).toBe('minor_nc');
    expect(out[0]!.clauseIds).toEqual(['A.6.2.8']);
    expect(out[0]!.detectorId).toBe('detector.evidence_absence.v1');
  });

  it('does not emit when block is still open', () => {
    const ctx = makeContext({
      expectedEvidenceBlocks: [makeBlock('A.6.2.8', false)],
    });
    const out = det.detect({ claims: [] }, ctx);
    expect(out).toHaveLength(0);
  });

  it('does not emit when an affirmative attribution exists at conf>=0.5', () => {
    const ctx = makeContext({
      expectedEvidenceBlocks: [makeBlock('A.6.2.8', true)],
    });
    const claim = makeClaim({
      polarity: 'affirms',
      controlImplemented: true,
      attributions: [attribution('A.6.2.8', null, 0.8)],
    });
    const out = det.detect({ claims: [claim] }, ctx);
    expect(out).toHaveLength(0);
  });

  it('still emits when the only attribution is below the 0.5 confidence cutoff', () => {
    const ctx = makeContext({
      expectedEvidenceBlocks: [makeBlock('A.6.2.8', true)],
    });
    const claim = makeClaim({
      polarity: 'affirms',
      controlImplemented: true,
      attributions: [attribution('A.6.2.8', null, 0.3)],
    });
    const out = det.detect({ claims: [claim] }, ctx);
    expect(out).toHaveLength(1);
  });

  it('ignores denied claims when checking attribution presence', () => {
    const ctx = makeContext({
      expectedEvidenceBlocks: [makeBlock('A.6.2.8', true)],
    });
    const claim = makeClaim({
      polarity: 'denies',
      controlImplemented: false,
      attributions: [attribution('A.6.2.8', null, 0.9)],
    });
    const out = det.detect({ claims: [claim] }, ctx);
    expect(out).toHaveLength(1);
  });

  it('does not emit when no expected blocks were provided', () => {
    const ctx = makeContext();
    const out = det.detect({ claims: [] }, ctx);
    expect(out).toHaveLength(0);
  });

  it('emits one signal per closed-but-uncovered block', () => {
    const ctx = makeContext({
      expectedEvidenceBlocks: [
        makeBlock('A.6.2.5', true),
        makeBlock('A.6.2.8', true),
        makeBlock('7.2', false),
      ],
    });
    const out = det.detect({ claims: [] }, ctx);
    expect(out).toHaveLength(2);
    expect(out.map((s) => s.clauseIds[0]).sort()).toEqual(['A.6.2.5', 'A.6.2.8']);
  });

  it('skips blocks whose clause is not in the catalog', () => {
    const ctx = makeContext({
      expectedEvidenceBlocks: [makeBlock('Z.99', true)],
    });
    const out = det.detect({ claims: [] }, ctx);
    expect(out).toHaveLength(0);
  });

  it('confidence is moderate (0.7) for absence', () => {
    const ctx = makeContext({
      expectedEvidenceBlocks: [makeBlock('A.6.2.8', true)],
    });
    const out = det.detect({ claims: [] }, ctx);
    expect(out[0]!.confidence).toBeCloseTo(0.7, 5);
  });
});

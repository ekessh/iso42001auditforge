// SPDX-License-Identifier: BUSL-1.1
import { describe, expect, it } from 'vitest';
import { ContradictionDerivedDetector } from '../src/index.js';
import {
  attribution,
  makeClaim,
  makeContext,
  makeContradictionPair,
} from './fixtures.js';

const det = new ContradictionDerivedDetector();

describe('ContradictionDerivedDetector', () => {
  it('emits Major NC when later claim denies and clause is mandatory + high', () => {
    const earlier = makeClaim({
      polarity: 'affirms',
      controlImplemented: true,
      attributions: [attribution('6.1.2')],
      text: 'We do AI risk assessments quarterly.',
    });
    const later = makeClaim({
      polarity: 'denies',
      controlImplemented: false,
      attributions: [attribution('6.1.2')],
      text: 'Actually we have not done one this year.',
    });
    const out = det.detect(
      { claims: [], contradictions: [makeContradictionPair(earlier, later, '6.1.2')] },
      makeContext(),
    );
    expect(out).toHaveLength(1);
    expect(out[0]!.type).toBe('major_nc');
    expect(out[0]!.detectorId).toBe('detector.contradiction_derived.v1');
  });

  it('emits Minor NC for contradiction on non-mandatory clause', () => {
    const earlier = makeClaim({
      polarity: 'affirms',
      controlImplemented: true,
      attributions: [attribution('A.6.2.5')],
    });
    const later = makeClaim({
      polarity: 'denies',
      controlImplemented: false,
      attributions: [attribution('A.6.2.5')],
    });
    const out = det.detect(
      {
        claims: [],
        contradictions: [makeContradictionPair(earlier, later, 'A.6.2.5')],
      },
      makeContext(),
    );
    expect(out[0]!.type).toBe('minor_nc');
  });

  it('does not emit when later claim does not imply a breach', () => {
    const earlier = makeClaim({ polarity: 'affirms', controlImplemented: true });
    const later = makeClaim({ polarity: 'affirms', controlImplemented: true });
    const out = det.detect(
      { claims: [], contradictions: [makeContradictionPair(earlier, later, '6.1.2')] },
      makeContext(),
    );
    expect(out).toHaveLength(0);
  });

  it('skips contradictions on unknown clauses', () => {
    const earlier = makeClaim({ polarity: 'affirms', controlImplemented: true });
    const later = makeClaim({ polarity: 'denies', controlImplemented: false });
    const out = det.detect(
      { claims: [], contradictions: [makeContradictionPair(earlier, later, 'Z.99')] },
      makeContext(),
    );
    expect(out).toHaveLength(0);
  });

  it('passes through both claim IDs as evidence chain', () => {
    const earlier = makeClaim({
      id: 'c_a',
      episodeId: 'ep_a',
      polarity: 'affirms',
      controlImplemented: true,
      attributions: [attribution('6.1.2')],
    });
    const later = makeClaim({
      id: 'c_b',
      episodeId: 'ep_b',
      polarity: 'denies',
      controlImplemented: false,
      attributions: [attribution('6.1.2', 'CTRL.6.1.2')],
    });
    const out = det.detect(
      { claims: [], contradictions: [makeContradictionPair(earlier, later, '6.1.2')] },
      makeContext(),
    );
    expect(out[0]!.sourceClaimIds).toEqual(['c_a', 'c_b']);
    expect(out[0]!.sourceEpisodeIds).toEqual(['ep_a', 'ep_b']);
    expect(out[0]!.controlIds).toContain('CTRL.6.1.2');
  });

  it('emits no signal when no contradictions provided', () => {
    const out = det.detect({ claims: [] }, makeContext());
    expect(out).toHaveLength(0);
  });

  it('emits per-pair signals', () => {
    const e1 = makeClaim({
      polarity: 'affirms',
      controlImplemented: true,
      attributions: [attribution('6.1.2')],
    });
    const l1 = makeClaim({
      polarity: 'denies',
      controlImplemented: false,
      attributions: [attribution('6.1.2')],
    });
    const e2 = makeClaim({
      polarity: 'affirms',
      controlImplemented: true,
      attributions: [attribution('A.6.2.5')],
    });
    const l2 = makeClaim({
      polarity: 'denies',
      controlImplemented: false,
      attributions: [attribution('A.6.2.5')],
    });
    const out = det.detect(
      {
        claims: [],
        contradictions: [
          makeContradictionPair(e1, l1, '6.1.2'),
          makeContradictionPair(e2, l2, 'A.6.2.5'),
        ],
      },
      makeContext(),
    );
    expect(out).toHaveLength(2);
  });
});

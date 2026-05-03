// SPDX-License-Identifier: BUSL-1.1
import { describe, expect, it } from 'vitest';
import { SystemicPatternDetector } from '../src/index.js';
import { attribution, makeClaim, makeContext } from './fixtures.js';

const det = new SystemicPatternDetector();

describe('SystemicPatternDetector', () => {
  it('emits Major NC when same control fails on two distinct sample units', () => {
    const c1 = makeClaim({
      polarity: 'denies',
      controlImplemented: false,
      attributions: [attribution('A.6.2.5', 'CTRL.A.6.2.5')],
      sampleUnitId: 'unit-1',
    });
    const c2 = makeClaim({
      polarity: 'denies',
      controlImplemented: false,
      attributions: [attribution('A.6.2.5', 'CTRL.A.6.2.5')],
      sampleUnitId: 'unit-2',
    });
    const out = det.detect({ claims: [c1, c2] }, makeContext());
    expect(out).toHaveLength(1);
    expect(out[0]!.type).toBe('major_nc');
    expect(out[0]!.controlIds).toEqual(['CTRL.A.6.2.5']);
    expect(out[0]!.detectorId).toBe('detector.systemic_pattern.v1');
  });

  it('does not emit when failures are on the same single unit', () => {
    const c1 = makeClaim({
      polarity: 'denies',
      controlImplemented: false,
      attributions: [attribution('A.6.2.5', 'CTRL.A.6.2.5')],
      sampleUnitId: 'unit-1',
    });
    const c2 = makeClaim({
      polarity: 'denies',
      controlImplemented: false,
      attributions: [attribution('A.6.2.5', 'CTRL.A.6.2.5')],
      sampleUnitId: 'unit-1',
    });
    const out = det.detect({ claims: [c1, c2] }, makeContext());
    expect(out).toHaveLength(0);
  });

  it('does not emit when claims have no sampleUnitId', () => {
    const c1 = makeClaim({
      polarity: 'denies',
      controlImplemented: false,
      attributions: [attribution('A.6.2.5')],
    });
    const c2 = makeClaim({
      polarity: 'denies',
      controlImplemented: false,
      attributions: [attribution('A.6.2.5')],
    });
    const out = det.detect({ claims: [c1, c2] }, makeContext());
    expect(out).toHaveLength(0);
  });

  it('does not emit when failures are below the 0.5 confidence cutoff', () => {
    const c1 = makeClaim({
      polarity: 'denies',
      controlImplemented: false,
      attributions: [attribution('A.6.2.5', null, 0.4)],
      sampleUnitId: 'unit-1',
    });
    const c2 = makeClaim({
      polarity: 'denies',
      controlImplemented: false,
      attributions: [attribution('A.6.2.5', null, 0.4)],
      sampleUnitId: 'unit-2',
    });
    const out = det.detect({ claims: [c1, c2] }, makeContext());
    expect(out).toHaveLength(0);
  });

  it('aggregates source claims and dedupes episode IDs', () => {
    const ep = 'ep_shared';
    const c1 = makeClaim({
      id: 'c1',
      episodeId: ep,
      polarity: 'denies',
      controlImplemented: false,
      attributions: [attribution('A.6.2.5', 'CTRL.A.6.2.5')],
      sampleUnitId: 'unit-1',
    });
    const c2 = makeClaim({
      id: 'c2',
      episodeId: ep,
      polarity: 'denies',
      controlImplemented: false,
      attributions: [attribution('A.6.2.5', 'CTRL.A.6.2.5')],
      sampleUnitId: 'unit-2',
    });
    const out = det.detect({ claims: [c1, c2] }, makeContext());
    expect(out[0]!.sourceClaimIds).toEqual(['c1', 'c2']);
    expect(out[0]!.sourceEpisodeIds).toEqual([ep]);
  });

  it('skips affirmative implementations', () => {
    const c1 = makeClaim({
      polarity: 'affirms',
      controlImplemented: true,
      attributions: [attribution('A.6.2.5')],
      sampleUnitId: 'u1',
    });
    const c2 = makeClaim({
      polarity: 'affirms',
      controlImplemented: true,
      attributions: [attribution('A.6.2.5')],
      sampleUnitId: 'u2',
    });
    const out = det.detect({ claims: [c1, c2] }, makeContext());
    expect(out).toHaveLength(0);
  });

  it('groups by clauseId AND controlId so different controls are independent buckets', () => {
    const c1 = makeClaim({
      polarity: 'denies',
      controlImplemented: false,
      attributions: [attribution('A.6.2.5', 'CTRL_A')],
      sampleUnitId: 'u1',
    });
    const c2 = makeClaim({
      polarity: 'denies',
      controlImplemented: false,
      attributions: [attribution('A.6.2.5', 'CTRL_B')],
      sampleUnitId: 'u2',
    });
    const out = det.detect({ claims: [c1, c2] }, makeContext());
    expect(out).toHaveLength(0);
  });
});

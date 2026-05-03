// SPDX-License-Identifier: BUSL-1.1
import { describe, expect, it } from 'vitest';
import { DirectConformityGapDetector } from '../src/index.js';
import {
  attribution,
  makeClaim,
  makeContext,
} from './fixtures.js';

const det = new DirectConformityGapDetector();

describe('DirectConformityGapDetector', () => {
  it('emits Major NC for denied implementation on mandatory high-severity main-body clause', () => {
    const claim = makeClaim({
      polarity: 'denies',
      controlImplemented: false,
      attributions: [attribution('6.1.2', null, 0.92)],
      text: "We don't perform AI risk assessment.",
    });
    const out = det.detect({ claims: [claim] }, makeContext());
    expect(out).toHaveLength(1);
    expect(out[0]!.type).toBe('major_nc');
    expect(out[0]!.clauseIds).toContain('6.1.2');
    expect(out[0]!.confidence).toBeGreaterThanOrEqual(0.85);
    expect(out[0]!.detectorId).toBe('detector.direct_conformity_gap.v1');
  });

  it('emits Minor NC for denied implementation on medium-severity Annex A clause', () => {
    const claim = makeClaim({
      polarity: 'denies',
      controlImplemented: false,
      attributions: [attribution('A.6.2.5', 'CTRL.A.6.2.5', 0.9)],
    });
    const out = det.detect({ claims: [claim] }, makeContext());
    expect(out).toHaveLength(1);
    expect(out[0]!.type).toBe('minor_nc');
    expect(out[0]!.controlIds).toEqual(['CTRL.A.6.2.5']);
  });

  it('emits OFI for denied implementation on low-severity clause', () => {
    const claim = makeClaim({
      polarity: 'denies',
      controlImplemented: false,
      attributions: [attribution('A.7.4', null, 0.95)],
    });
    const out = det.detect({ claims: [claim] }, makeContext());
    expect(out).toHaveLength(1);
    expect(out[0]!.type).toBe('ofi');
  });

  it('escalates Stage 2 above Stage 1 for high-severity non-mandatory clause', () => {
    const claim = makeClaim({
      polarity: 'denies',
      controlImplemented: false,
      attributions: [attribution('A.10.4', null, 0.9)],
    });
    const stage1 = det.detect({ claims: [claim] }, makeContext({ auditType: 'stage_1' }));
    const stage2 = det.detect({ claims: [claim] }, makeContext({ auditType: 'stage_2' }));
    expect(stage1[0]!.type).toBe('minor_nc');
    expect(stage2[0]!.type).toBe('major_nc');
  });

  it('does not emit for affirmative claims', () => {
    const claim = makeClaim({
      polarity: 'affirms',
      controlImplemented: true,
      attributions: [attribution('6.1.2')],
    });
    const out = det.detect({ claims: [claim] }, makeContext());
    expect(out).toHaveLength(0);
  });

  it('does not emit for unclear polarity', () => {
    const claim = makeClaim({
      polarity: 'unclear',
      controlImplemented: false,
      attributions: [attribution('6.1.2')],
    });
    const out = det.detect({ claims: [claim] }, makeContext());
    expect(out).toHaveLength(0);
  });

  it('does not emit when claim has no attributions', () => {
    const claim = makeClaim({
      polarity: 'denies',
      controlImplemented: false,
      attributions: [],
    });
    const out = det.detect({ claims: [claim] }, makeContext());
    expect(out).toHaveLength(0);
  });

  it('does not emit when clause is not in the catalog', () => {
    const claim = makeClaim({
      polarity: 'denies',
      controlImplemented: false,
      attributions: [attribution('Z.99', null, 0.9)],
    });
    const out = det.detect({ claims: [claim] }, makeContext());
    expect(out).toHaveLength(0);
  });

  it('rationale references audit type and severity', () => {
    const claim = makeClaim({
      polarity: 'denies',
      controlImplemented: false,
      attributions: [attribution('6.1.2', null, 0.92)],
    });
    const out = det.detect({ claims: [claim] }, makeContext({ auditType: 'recertification' }));
    expect(out[0]!.rationale).toMatch(/severity=high/);
    expect(out[0]!.rationale).toMatch(/audit=recertification/);
  });
});

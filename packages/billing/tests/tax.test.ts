// SPDX-License-Identifier: BUSL-1.1
import { describe, expect, it } from 'vitest';
import { applyTax } from '../src/tax.js';

const rule = { jurisdiction: 'DE', rate: 0.19, appliesTo: 'services' as const };

describe('applyTax', () => {
  it('charges domestic VAT', () => {
    const r = applyTax(1000, { supplierJurisdiction: 'DE', customerJurisdiction: 'DE', customerIsBusiness: true }, rule);
    expect(r.tax).toBeCloseTo(190);
    expect(r.total).toBeCloseTo(1190);
    expect(r.reverseCharge).toBe(false);
  });
  it('reverse charges EU B2B with VAT id', () => {
    const r = applyTax(1000, { supplierJurisdiction: 'DE', customerJurisdiction: 'FR', customerIsBusiness: true, customerVatId: 'FR12345' }, rule);
    expect(r.tax).toBe(0);
    expect(r.reverseCharge).toBe(true);
  });
  it('zero rates exports outside EU', () => {
    const r = applyTax(1000, { supplierJurisdiction: 'DE', customerJurisdiction: 'US', customerIsBusiness: true }, rule);
    expect(r.tax).toBe(0);
    expect(r.reverseCharge).toBe(false);
  });
  it('charges EU consumer when no VAT id', () => {
    const r = applyTax(1000, { supplierJurisdiction: 'DE', customerJurisdiction: 'FR', customerIsBusiness: false }, rule);
    expect(r.tax).toBeCloseTo(190);
  });
});

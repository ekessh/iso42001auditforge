// SPDX-License-Identifier: BUSL-1.1

export interface TaxRule {
  jurisdiction: string;
  rate: number;
  appliesTo: 'services' | 'goods' | 'both';
}

export interface TaxContext {
  supplierJurisdiction: string;
  customerJurisdiction: string;
  customerIsBusiness: boolean;
  customerVatId?: string;
  reverseChargeJurisdictions?: string[];
}

const EU = new Set(['DE', 'FR', 'IT', 'ES', 'NL', 'BE', 'IE', 'AT', 'PT', 'PL', 'SE', 'DK', 'FI', 'CZ', 'RO', 'GR', 'HU', 'BG', 'HR', 'SK', 'SI', 'LT', 'LV', 'EE', 'LU', 'MT', 'CY']);

export function applyTax(amount: number, ctx: TaxContext, rate: TaxRule): { tax: number; total: number; reverseCharge: boolean } {
  if (ctx.supplierJurisdiction === ctx.customerJurisdiction) {
    const tax = amount * rate.rate;
    return { tax, total: amount + tax, reverseCharge: false };
  }
  if (EU.has(ctx.supplierJurisdiction) && EU.has(ctx.customerJurisdiction) && ctx.customerIsBusiness && ctx.customerVatId) {
    return { tax: 0, total: amount, reverseCharge: true };
  }
  if (!EU.has(ctx.customerJurisdiction)) {
    return { tax: 0, total: amount, reverseCharge: false };
  }
  const tax = amount * rate.rate;
  return { tax, total: amount + tax, reverseCharge: false };
}

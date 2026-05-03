// SPDX-License-Identifier: BUSL-1.1

export type FxRates = Record<string, number>;

export function fxConvert(rates: FxRates) {
  return (amount: number, from: string, to: string): number => {
    if (from === to) return amount;
    const rFrom = rates[from];
    const rTo = rates[to];
    if (rFrom === undefined || rTo === undefined) throw new Error(`missing FX rate ${from} or ${to}`);
    return (amount / rFrom) * rTo;
  };
}

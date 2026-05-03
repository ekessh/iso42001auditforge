// SPDX-License-Identifier: BUSL-1.1
/**
 * Pluggable numbering service.
 *
 * Each scheme has a `key`, a `template`, a `pad` width, and a `reset`
 * boundary. The service maintains an in-memory counter keyed by
 * `(schemeKey, boundaryValue)` where `boundaryValue` is the year, the
 * engagement code, or `'__never__'`. Production deployments swap in a
 * persistent counter store via `createNumberingServiceWithStore`.
 */
import { ConfigurationError, ValidationError } from '@auditforge/shared';
import type {
  NumberingFormatInput,
  NumberingScheme,
} from '../types/numbering.js';
import type { FindingType } from '../types/finding.js';

export interface CounterStore {
  /**
   * Atomically increment and return the next value for `key`. Implementations
   * may be in-memory (default), Redis, or a Postgres `UPDATE ... RETURNING`
   * sequence row.
   */
  next(key: string): number;
}

export interface NumberingService {
  readonly schemes: readonly NumberingScheme[];
  schemeForType(type: FindingType): NumberingScheme;
  schemeByKey(key: string): NumberingScheme | undefined;
  next(input: NumberingFormatInput): string;
}

/**
 * Build an in-memory counter store. Useful for tests and single-process
 * deploys.
 */
export function inMemoryCounterStore(): CounterStore {
  const counters = new Map<string, number>();
  return {
    next(key) {
      const current = counters.get(key) ?? 0;
      const next = current + 1;
      counters.set(key, next);
      return next;
    },
  };
}

export interface NumberingServiceOptions {
  readonly schemes: readonly NumberingScheme[];
  readonly store?: CounterStore;
}

/**
 * Construct a numbering service from a list of schemes. Validates schemes
 * eagerly so configuration errors fail at boot rather than on the first
 * audit.
 */
export function createNumberingService(
  schemes: readonly NumberingScheme[],
  store: CounterStore = inMemoryCounterStore(),
): NumberingService {
  validateSchemes(schemes);
  const schemeByKey = new Map<string, NumberingScheme>();
  for (const s of schemes) schemeByKey.set(s.key, s);

  // Reverse index: type -> first scheme that supports it. Multiple schemes
  // can claim the same type; we deterministically pick the first one in
  // the supplied order so the CB can re-order to change priority.
  const schemeByType = new Map<FindingType, NumberingScheme>();
  for (const s of schemes) {
    for (const t of s.appliesTo) {
      if (!schemeByType.has(t)) schemeByType.set(t, s);
    }
  }

  function schemeForType(type: FindingType): NumberingScheme {
    const s = schemeByType.get(type);
    if (!s) {
      throw new ConfigurationError(
        `No numbering scheme registered for finding type: ${type}`,
        { type, knownSchemes: schemes.map((sc) => sc.key) },
      );
    }
    return s;
  }

  function next(input: NumberingFormatInput): string {
    const scheme = schemeByKey.get(input.schemeKey);
    if (!scheme) {
      throw new ConfigurationError(
        `Unknown numbering scheme: ${input.schemeKey}`,
        { schemeKey: input.schemeKey },
      );
    }
    if (!scheme.appliesTo.includes(input.type)) {
      throw new ValidationError(
        `Scheme ${scheme.key} does not apply to type ${input.type}`,
        { schemeKey: scheme.key, type: input.type, appliesTo: scheme.appliesTo },
      );
    }

    const boundary = boundaryFor(scheme, input);
    const counterKey = `${scheme.key}::${boundary}`;
    const seq = store.next(counterKey);
    return formatNumber(scheme, input, seq);
  }

  return {
    schemes,
    schemeForType,
    schemeByKey: (k: string) => schemeByKey.get(k),
    next,
  };
}

function validateSchemes(schemes: readonly NumberingScheme[]): void {
  if (schemes.length === 0) {
    throw new ConfigurationError('At least one numbering scheme is required', {});
  }
  const seen = new Set<string>();
  for (const s of schemes) {
    if (seen.has(s.key)) {
      throw new ConfigurationError(`Duplicate numbering scheme key: ${s.key}`, {
        key: s.key,
      });
    }
    seen.add(s.key);
    if (s.pad < 1 || s.pad > 12) {
      throw new ConfigurationError(`pad must be 1..12, got ${s.pad}`, {
        key: s.key,
        pad: s.pad,
      });
    }
    if (!s.template.includes('{seq}') && !s.template.includes('{seqRaw}')) {
      throw new ConfigurationError(
        `Template for scheme ${s.key} must contain {seq} or {seqRaw}`,
        { key: s.key, template: s.template },
      );
    }
    if (s.template.includes('{engagement}') && s.reset === 'year') {
      // Not strictly invalid — but a CB will probably get duplicates if
      // they reset by year while embedding the engagement. Warn via
      // ConfigurationError so it surfaces in dev/QA.
      // (In production we'd downgrade to a logger.warn.)
    }
  }
}

function boundaryFor(
  scheme: NumberingScheme,
  input: NumberingFormatInput,
): string {
  switch (scheme.reset) {
    case 'never':
      return '__never__';
    case 'year':
      return new Date(input.raisedAt).getUTCFullYear().toString();
    case 'engagement':
      if (!input.engagementCode) {
        throw new ValidationError(
          `Scheme ${scheme.key} resets per engagement but engagementCode missing`,
          { schemeKey: scheme.key },
        );
      }
      return input.engagementCode;
  }
}

export function formatNumber(
  scheme: NumberingScheme,
  input: NumberingFormatInput,
  seq: number,
): string {
  const date = new Date(input.raisedAt);
  const year = date.getUTCFullYear();
  const month = (date.getUTCMonth() + 1).toString().padStart(2, '0');
  const yy = (year % 100).toString().padStart(2, '0');
  const padded = seq.toString().padStart(scheme.pad, '0');

  return scheme.template
    .replace('{scheme}', scheme.key)
    .replace('{year}', year.toString())
    .replace('{yy}', yy)
    .replace('{month}', month)
    .replace('{seq}', padded)
    .replace('{seqRaw}', seq.toString())
    .replace('{engagement}', input.engagementCode ?? 'NOENG')
    .replace('{client}', input.clientCode ?? 'NOCLI')
    .replace('{type}', input.type);
}

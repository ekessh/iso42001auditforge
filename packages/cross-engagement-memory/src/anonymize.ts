// SPDX-License-Identifier: BUSL-1.1
/**
 * Anonymization gate. Every pattern row passes through here before reaching
 * the repository. CLAUDE.md hard rule: no auditee names, no system names, no
 * finding text in cross-engagement memory.
 *
 * The gate is conservative on purpose. False positives (rejecting a clean
 * row) are preferable to false negatives (leaking a name). When a row fails
 * the gate, the aggregator drops it — it will be re-derived from the
 * authoritative engagement-scoped data on the next close.
 */

import type { CrossEngagementPattern, PatternDimensions } from './domain.js';

const DENY_KEYS = new Set([
  'auditeeName',
  'auditee_name',
  'engagementId',
  'engagement_id',
  'findingId',
  'finding_id',
  'findingText',
  'finding_text',
  'auditorId',
  'auditor_id',
  'systemName',
  'system_name',
  'aiSystemName',
  'ai_system_name',
  'clientName',
  'client_name',
  'organizationName',
  'organization_name',
  'organisationName',
  'organisation_name',
  'company',
  'companyName',
  'company_name',
]);

const ALLOWED_SCOPE_KEY_RE = /^[a-z][a-z0-9_]{0,31}$/;

const FORBIDDEN_OBSERVATION_PHRASES: readonly string[] = [
  'finding ',
  'auditee ',
  'witness ',
];

export interface AnonymizationResult {
  readonly ok: boolean;
  readonly reason?: string;
}

export function checkDimensions(d: PatternDimensions): AnonymizationResult {
  for (const k of Object.keys(d)) {
    if (DENY_KEYS.has(k)) return { ok: false, reason: `denied dimension key: ${k}` };
    if (!ALLOWED_SCOPE_KEY_RE.test(k)) return { ok: false, reason: `bad dimension key: ${k}` };
    const v = d[k];
    if (typeof v === 'string') {
      if (v.length > 64) return { ok: false, reason: `dimension value too long: ${k}` };
      if (looksLikePersonalName(v)) return { ok: false, reason: `dimension value resembles a name: ${k}` };
    }
  }
  return { ok: true };
}

export function checkObservation(text: string): AnonymizationResult {
  if (text.length > 500) return { ok: false, reason: 'observation too long' };
  const lower = text.toLowerCase();
  for (const phrase of FORBIDDEN_OBSERVATION_PHRASES) {
    if (lower.startsWith(phrase) || lower.includes(` ${phrase}`)) {
      return { ok: false, reason: `observation contains forbidden phrase: ${phrase.trim()}` };
    }
  }
  if (/\b[A-Z][a-z]+ [A-Z][a-z]+\b/.test(text)) {
    return { ok: false, reason: 'observation contains capitalised name pattern' };
  }
  if (/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/.test(text)) {
    return { ok: false, reason: 'observation contains email address' };
  }
  return { ok: true };
}

export function checkPattern(p: CrossEngagementPattern): AnonymizationResult {
  const d = checkDimensions(p.dimensions);
  if (!d.ok) return d;
  const o = checkObservation(p.observation);
  if (!o.ok) return o;
  return { ok: true };
}

function looksLikePersonalName(v: string): boolean {
  if (!/^[A-Za-z][A-Za-z\s.'-]*$/.test(v)) return false;
  const words = v.trim().split(/\s+/);
  if (words.length < 2 || words.length > 4) return false;
  return words.every((w) => /^[A-Z][a-z]+$/.test(w));
}

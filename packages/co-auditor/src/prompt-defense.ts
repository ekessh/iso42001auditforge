// SPDX-License-Identifier: BUSL-1.1
import { createHash } from 'node:crypto';

export function fenceUntrustedInput(input: string, label = 'AUDITEE_TEXT'): string {
  const safe = input.replace(/<\/AF_/g, '< /AF_');
  return `<AF_${label}>\n${safe}\n</AF_${label}>`;
}

export function hashSystemPrompt(systemPrompt: string): string {
  return createHash('sha256').update(systemPrompt).digest('hex');
}

const REFUSAL_MARKERS = [
  /i (?:can(?:'|no)?t|will not|won't) (?:help|assist|comply)/i,
  /as an ai (?:language )?model/i,
  /i (?:do not|don'?t) have (?:access|the ability)/i,
];

export function looksLikeRefusal(output: string): boolean {
  return REFUSAL_MARKERS.some((rx) => rx.test(output));
}

export function validateOutputSchema<T>(raw: string, parser: (raw: unknown) => T): { ok: true; value: T } | { ok: false; reason: string } {
  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch { return { ok: false, reason: 'not JSON' }; }
  try { return { ok: true, value: parser(parsed) }; } catch (e) { return { ok: false, reason: (e as Error).message }; }
}

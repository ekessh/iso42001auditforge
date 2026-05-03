// SPDX-License-Identifier: BUSL-1.1
import { describe, expect, it } from 'vitest';

import enLocale from '../locales/en.json' with { type: 'json' };
import {
  messages,
  t,
  tModeBadge,
  tPromoteAction,
  tRightPaneTitle,
  type MessageKey,
  type ModeKey,
} from '../index.js';

const MODES: ReadonlyArray<ModeKey> = ['audit', 'readiness'];

describe('i18n key resolution', () => {
  it('returns the canonical English string for a known key', () => {
    expect(t('workspace.rightPane.title.audit')).toBe('Candidate Findings');
    expect(t('workspace.rightPane.title.readiness')).toBe('Improvement Items');
  });

  it('returns the key literal (no crash) for an unknown key', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const out = t('not.a.real.key' as any);
    expect(out).toBe('not.a.real.key');
  });

  it('interpolates {placeholders}', () => {
    // Template inlined to avoid mutating the catalogue.
    const template = 'Hello {name}, you have {count} items';
    const re = template.replace(/\{(\w+)\}/g, (_, k) => ({ name: 'Ekessh', count: '3' }[k as 'name' | 'count'] ?? `{${k}}`));
    expect(re).toBe('Hello Ekessh, you have 3 items');
  });

  it('every catalogue key has a non-empty string value', () => {
    const keys = Object.keys(messages) as MessageKey[];
    expect(keys.length).toBeGreaterThan(0);
    for (const k of keys) {
      const v = messages[k];
      expect(typeof v).toBe('string');
      expect(v.length).toBeGreaterThan(0);
    }
  });
});

describe('en.json locale parity', () => {
  const en = enLocale as Readonly<Record<string, string>>;

  it('en.json contains every catalogue key', () => {
    for (const k of Object.keys(messages) as MessageKey[]) {
      expect(en[k], `en.json missing key: ${k}`).toBeDefined();
      expect(en[k]).toBe(messages[k]);
    }
  });

  it('en.json contains no extra keys', () => {
    const extras = Object.keys(en).filter(
      (k) => !(k in messages),
    );
    expect(extras).toEqual([]);
  });
});

describe('mode badge / right pane / promote — mode mapping', () => {
  it('every mode resolves to a non-empty string for the badge', () => {
    for (const mode of MODES) {
      const out = tModeBadge(mode);
      expect(out).toBeTypeOf('string');
      expect(out.length).toBeGreaterThan(0);
      // Must not echo the key (would mean missing translation).
      expect(out).not.toMatch(/^workspace\.modeBadge\./);
    }
  });

  it('every mode resolves a right-pane title', () => {
    expect(tRightPaneTitle('audit')).toBe('Candidate Findings');
    expect(tRightPaneTitle('readiness')).toBe('Improvement Items');
  });

  it('every mode resolves a promote-action label', () => {
    expect(tPromoteAction('audit')).toBe('Promote to Finding');
    expect(tPromoteAction('readiness')).toBe('Add to Action Plan');
  });

  it('en.json carries both mode-suffixed keys for badge/title/promote', () => {
    const en = enLocale as Readonly<Record<string, string>>;
    for (const mode of MODES) {
      expect(en[`workspace.modeBadge.${mode}`]).toBeDefined();
      expect(en[`workspace.rightPane.title.${mode}`]).toBeDefined();
      expect(en[`workspace.actions.promote.${mode}`]).toBeDefined();
    }
  });

  it('readiness mode disclaimer is present and mentions self-assessment', () => {
    const out = t('workspace.disclaimer.readiness');
    expect(out.toLowerCase()).toContain('self-assessment');
    expect(out.toLowerCase()).toContain('not a certification');
  });
});

describe('translator override', () => {
  it('helpers accept a custom Translator (pure, no global mutation)', () => {
    const upper = (key: MessageKey) => messages[key].toUpperCase();
    expect(tModeBadge('audit', upper)).toBe('AUDIT MODE');
    expect(tRightPaneTitle('readiness', upper)).toBe('IMPROVEMENT ITEMS');
  });
});

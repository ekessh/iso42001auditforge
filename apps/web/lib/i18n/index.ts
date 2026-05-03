// SPDX-License-Identifier: BUSL-1.1
/**
 * Lightweight i18n facade for `apps/web`.
 *
 * Goals (per code-quality review I18N-06):
 *  - Type-safe key lookup (`MessageKey` union from the catalogue).
 *  - Pure `t(key, params?)` function — no React context coupling, so it
 *    can be called from Zustand stores and other non-React modules.
 *  - Drop-in locale JSON files: each locale ships the same key set; the
 *    English baseline lives in `./messages.ts` AND `./locales/en.json`.
 *  - Zero new runtime dependencies — string substitution is hand-rolled.
 *
 * Future work: wire up `next-intl` (or similar) and have it consume the
 * same `messages` map. Until then, this facade gives every call site the
 * correct seam.
 */
import { messages, type MessageKey, type ModeKey } from './messages.js';

export type { MessageKey, ModeKey } from './messages.js';
export { messages } from './messages.js';

/**
 * `t` interpolates `{name}` placeholders. Values are stringified with
 * `String(...)` and HTML-escaped at the render layer (React already does
 * this). Unknown keys throw at dev time and fall back to the key string
 * in production so a missing translation is visible without a crash.
 */
export type Translator = (
  key: MessageKey,
  params?: Readonly<Record<string, string | number>>,
) => string;

const PLACEHOLDER = /\{([a-zA-Z0-9_.-]+)\}/g;

function interpolate(
  template: string,
  params: Readonly<Record<string, string | number>> | undefined,
): string {
  if (!params) return template;
  return template.replace(PLACEHOLDER, (_, name: string) => {
    const value = params[name];
    return value === undefined ? `{${name}}` : String(value);
  });
}

/**
 * Default English translator. Pure — equal inputs always return the same
 * string. Unknown keys log a console warning in dev and return the key
 * literal so missing strings surface visually.
 */
export const t: Translator = (key, params) => {
  const template = messages[key];
  if (template === undefined) {
    if (typeof process !== 'undefined' && process.env && process.env.NODE_ENV !== 'production') {
      // eslint-disable-next-line no-console
      console.warn(`[i18n] missing message key: ${String(key)}`);
    }
    return String(key);
  }
  return interpolate(template, params);
};

/**
 * Helpers for the most common mode-aware lookups. Keep these pure so
 * stores and tests can import them without React.
 */
export function tRightPaneTitle(mode: ModeKey, translator: Translator = t): string {
  return translator(`workspace.rightPane.title.${mode}` as MessageKey);
}

export function tPromoteAction(mode: ModeKey, translator: Translator = t): string {
  return translator(`workspace.actions.promote.${mode}` as MessageKey);
}

export function tModeBadge(mode: ModeKey, translator: Translator = t): string {
  return translator(`workspace.modeBadge.${mode}` as MessageKey);
}

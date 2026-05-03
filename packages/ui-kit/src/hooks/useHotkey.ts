// SPDX-License-Identifier: BUSL-1.1
'use client';

import * as React from 'react';

export interface HotkeyOptions {
  /** Don't fire when focus is inside an input, textarea, contenteditable, or select. */
  ignoreInInputs?: boolean;
  /** Capture keydown phase. */
  capture?: boolean;
  /** Custom condition. */
  enabled?: boolean;
  /** prevent default. */
  preventDefault?: boolean;
}

const isEditableTarget = (el: EventTarget | null): boolean => {
  if (!(el instanceof HTMLElement)) return false;
  if (el.isContentEditable) return true;
  const tag = el.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
};

const matches = (combo: string, e: KeyboardEvent): boolean => {
  const parts = combo.toLowerCase().split('+').map((p) => p.trim());
  const requiresMod = parts.includes('mod') || parts.includes('cmd') || parts.includes('ctrl');
  const requiresShift = parts.includes('shift');
  const requiresAlt = parts.includes('alt') || parts.includes('option');
  const key = parts[parts.length - 1] ?? '';
  if (requiresMod && !(e.metaKey || e.ctrlKey)) return false;
  if (!requiresMod && (e.metaKey || e.ctrlKey)) return false;
  if (requiresShift !== e.shiftKey) return false;
  if (requiresAlt !== e.altKey) return false;
  return e.key.toLowerCase() === key;
};

/**
 * Bind a single keyboard combo. e.g. `useHotkey('mod+k', () => …)`.
 */
export function useHotkey(
  combo: string | string[],
  handler: (e: KeyboardEvent) => void,
  options: HotkeyOptions = {},
): void {
  const { ignoreInInputs = false, capture = false, enabled = true, preventDefault = true } = options;
  const handlerRef = React.useRef(handler);
  React.useEffect(() => {
    handlerRef.current = handler;
  }, [handler]);

  React.useEffect(() => {
    if (!enabled) return;
    const combos = Array.isArray(combo) ? combo : [combo];
    const onKey = (e: KeyboardEvent) => {
      if (ignoreInInputs && isEditableTarget(e.target)) return;
      if (combos.some((c) => matches(c, e))) {
        if (preventDefault) e.preventDefault();
        handlerRef.current(e);
      }
    };
    window.addEventListener('keydown', onKey, { capture });
    return () => window.removeEventListener('keydown', onKey, { capture });
  }, [combo, capture, enabled, ignoreInInputs, preventDefault]);
}

/**
 * Sequence-based shortcut (Linear-style "G then D"). Resets after 1.5s.
 */
export function useKeyboardShortcut(
  sequence: string,
  handler: () => void,
  options: HotkeyOptions = {},
): void {
  const { ignoreInInputs = true, enabled = true } = options;
  const buffer = React.useRef<string[]>([]);
  const timer = React.useRef<number | null>(null);
  const target = sequence.toLowerCase().split(' ');

  React.useEffect(() => {
    if (!enabled) return;
    const onKey = (e: KeyboardEvent) => {
      if (ignoreInInputs && isEditableTarget(e.target)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key.length !== 1) return;
      buffer.current.push(e.key.toLowerCase());
      if (timer.current) window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => {
        buffer.current = [];
      }, 1500);
      const last = buffer.current.slice(-target.length);
      if (target.every((k, i) => k === last[i])) {
        buffer.current = [];
        if (timer.current) window.clearTimeout(timer.current);
        handler();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [sequence, ignoreInInputs, enabled, handler, target]);
}

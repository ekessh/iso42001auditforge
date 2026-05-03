// SPDX-License-Identifier: BUSL-1.1
/**
 * AuditForge ISO 42001 — Design Tokens
 *
 * Tokens are the single source of truth for visual language. They are consumed
 * via Tailwind preset and CSS custom properties. Values target WCAG 2.2 AA in
 * both light and dark schemes, with extra contrast for verdict pills used in
 * audit reports.
 */

export const colors = {
  // Neutral — warm grays anchored on a hint of navy for trust.
  neutral: {
    0: '#ffffff',
    50: '#f8f9fb',
    100: '#f1f3f7',
    200: '#e3e7ee',
    300: '#cdd3df',
    400: '#9aa2b3',
    500: '#6c7587',
    600: '#4d5566',
    700: '#363d4b',
    800: '#22262f',
    850: '#191c23',
    900: '#11141a',
    950: '#080a0e',
    1000: '#000000',
  },
  // Brand navy — institutional trust, used sparingly for primary surfaces.
  brand: {
    50: '#eef3ff',
    100: '#dde7ff',
    200: '#b9cdff',
    300: '#8aa9ff',
    400: '#5f87f5',
    500: '#3b66e0',
    600: '#264bbd',
    700: '#1d3a92',
    800: '#16306f',
    900: '#102352',
    950: '#0a1736',
  },
  // Verdict palette — chosen for distinguishability for color-blind auditors.
  verdict: {
    conformant: '#16a34a', // green-600
    conformantBg: '#dcfce7',
    conformantFg: '#14532d',
    minorNc: '#d97706', // amber-600
    minorNcBg: '#fef3c7',
    minorNcFg: '#78350f',
    majorNc: '#dc2626', // red-600
    majorNcBg: '#fee2e2',
    majorNcFg: '#7f1d1d',
    ofi: '#2563eb', // blue-600
    ofiBg: '#dbeafe',
    ofiFg: '#1e3a8a',
    na: '#64748b', // slate-500
    naBg: '#f1f5f9',
    naFg: '#1e293b',
  },
  // Semantic feedback.
  success: '#16a34a',
  warning: '#d97706',
  danger: '#dc2626',
  info: '#2563eb',
  // Cross-framework chip colors.
  framework: {
    iso42001: '#3b66e0',
    euAiAct: '#0e7490',
    nistAiRmf: '#7c3aed',
    iso27001: '#0f766e',
  },
} as const;

export const typography = {
  fonts: {
    sans: '"Inter", "Inter Variable", -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif',
    mono: '"JetBrains Mono", "Fira Code", ui-monospace, "SFMono-Regular", Menlo, Consolas, monospace',
  },
  // Type scale — modest progression, optimized for data density.
  size: {
    '2xs': ['0.6875rem', { lineHeight: '1rem' }], // 11px
    xs: ['0.75rem', { lineHeight: '1.125rem' }], // 12px
    sm: ['0.8125rem', { lineHeight: '1.25rem' }], // 13px — UI body
    base: ['0.9375rem', { lineHeight: '1.5rem' }], // 15px — content
    md: ['1rem', { lineHeight: '1.625rem' }], // 16px
    lg: ['1.125rem', { lineHeight: '1.75rem' }], // 18px
    xl: ['1.25rem', { lineHeight: '1.875rem' }], // 20px
    '2xl': ['1.5rem', { lineHeight: '2rem' }], // 24px
    '3xl': ['1.875rem', { lineHeight: '2.25rem' }], // 30px
    '4xl': ['2.25rem', { lineHeight: '2.5rem' }], // 36px
  },
  weight: {
    regular: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
  },
  letterSpacing: {
    tight: '-0.02em',
    normal: '0em',
    wide: '0.04em',
  },
  // Tabular numerics for tables and clause refs.
  features: {
    tabular: '"tnum" 1, "lnum" 1',
    code: '"calt" 0',
  },
} as const;

export const spacing = {
  px: '1px',
  0: '0',
  0.5: '0.125rem',
  1: '0.25rem',
  1.5: '0.375rem',
  2: '0.5rem',
  2.5: '0.625rem',
  3: '0.75rem',
  3.5: '0.875rem',
  4: '1rem',
  5: '1.25rem',
  6: '1.5rem',
  7: '1.75rem',
  8: '2rem',
  10: '2.5rem',
  12: '3rem',
  16: '4rem',
  20: '5rem',
  24: '6rem',
  32: '8rem',
} as const;

export const radii = {
  none: '0',
  xs: '2px',
  sm: '4px',
  DEFAULT: '6px',
  md: '8px',
  lg: '10px',
  xl: '14px',
  '2xl': '18px',
  full: '9999px',
} as const;

export const shadows = {
  none: 'none',
  xs: '0 1px 1px 0 rgb(8 10 14 / 0.04)',
  sm: '0 1px 2px 0 rgb(8 10 14 / 0.06), 0 1px 3px 0 rgb(8 10 14 / 0.04)',
  DEFAULT:
    '0 4px 8px -2px rgb(8 10 14 / 0.06), 0 2px 4px -2px rgb(8 10 14 / 0.04)',
  md: '0 8px 16px -4px rgb(8 10 14 / 0.08), 0 4px 8px -4px rgb(8 10 14 / 0.04)',
  lg: '0 16px 32px -8px rgb(8 10 14 / 0.12), 0 8px 16px -6px rgb(8 10 14 / 0.06)',
  xl: '0 24px 48px -12px rgb(8 10 14 / 0.18)',
  inner: 'inset 0 1px 0 0 rgb(255 255 255 / 0.06)',
  ring: '0 0 0 3px rgb(59 102 224 / 0.35)',
} as const;

export const motion = {
  duration: {
    instant: '60ms',
    fast: '120ms',
    base: '180ms',
    slow: '240ms',
    slower: '320ms',
  },
  ease: {
    standard: 'cubic-bezier(0.2, 0, 0, 1)',
    accel: 'cubic-bezier(0.4, 0, 1, 1)',
    decel: 'cubic-bezier(0, 0, 0.2, 1)',
    spring: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
  },
} as const;

export const zIndex = {
  base: 0,
  raised: 10,
  sticky: 20,
  navigation: 30,
  drawer: 40,
  modal: 50,
  popover: 60,
  tooltip: 70,
  toast: 80,
  commandPalette: 90,
} as const;

export const breakpoints = {
  sm: '640px',
  md: '768px',
  lg: '1024px',
  xl: '1280px',
  '2xl': '1536px',
  // Auditors often work on widescreen workstations.
  '3xl': '1920px',
} as const;

export const density = {
  comfortable: {
    rowHeight: '40px',
    paddingY: '0.5rem',
    paddingX: '0.75rem',
    fontSize: '0.875rem',
  },
  compact: {
    rowHeight: '32px',
    paddingY: '0.375rem',
    paddingX: '0.625rem',
    fontSize: '0.8125rem',
  },
} as const;

export const tokens = {
  colors,
  typography,
  spacing,
  radii,
  shadows,
  motion,
  zIndex,
  breakpoints,
  density,
} as const;

export type Tokens = typeof tokens;

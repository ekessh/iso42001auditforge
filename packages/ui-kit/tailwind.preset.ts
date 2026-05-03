// SPDX-License-Identifier: BUSL-1.1
import type { Config } from 'tailwindcss';
import animate from 'tailwindcss-animate';

import { colors, motion, radii, shadows, spacing, typography } from './src/tokens';

/**
 * Shared Tailwind preset for AuditForge.
 * Apps extend this to inherit tokens, plugins, and the dark-mode-by-default
 * class strategy. CSS custom properties are mapped at runtime via globals.css
 * so we can hot-swap themes without rebuilds.
 */
const preset: Config = {
  darkMode: ['class', '[data-theme="dark"]'],
  content: [],
  theme: {
    container: {
      center: true,
      padding: '1rem',
      screens: { '2xl': '1440px' },
    },
    extend: {
      colors: {
        // CSS variable bridge. Concrete values live in globals.css.
        background: 'rgb(var(--af-bg) / <alpha-value>)',
        foreground: 'rgb(var(--af-fg) / <alpha-value>)',
        muted: {
          DEFAULT: 'rgb(var(--af-muted) / <alpha-value>)',
          foreground: 'rgb(var(--af-muted-fg) / <alpha-value>)',
        },
        card: {
          DEFAULT: 'rgb(var(--af-card) / <alpha-value>)',
          foreground: 'rgb(var(--af-card-fg) / <alpha-value>)',
        },
        popover: {
          DEFAULT: 'rgb(var(--af-popover) / <alpha-value>)',
          foreground: 'rgb(var(--af-popover-fg) / <alpha-value>)',
        },
        border: 'rgb(var(--af-border) / <alpha-value>)',
        input: 'rgb(var(--af-input) / <alpha-value>)',
        ring: 'rgb(var(--af-ring) / <alpha-value>)',
        primary: {
          DEFAULT: 'rgb(var(--af-primary) / <alpha-value>)',
          foreground: 'rgb(var(--af-primary-fg) / <alpha-value>)',
        },
        secondary: {
          DEFAULT: 'rgb(var(--af-secondary) / <alpha-value>)',
          foreground: 'rgb(var(--af-secondary-fg) / <alpha-value>)',
        },
        accent: {
          DEFAULT: 'rgb(var(--af-accent) / <alpha-value>)',
          foreground: 'rgb(var(--af-accent-fg) / <alpha-value>)',
        },
        destructive: {
          DEFAULT: 'rgb(var(--af-destructive) / <alpha-value>)',
          foreground: 'rgb(var(--af-destructive-fg) / <alpha-value>)',
        },
        success: {
          DEFAULT: 'rgb(var(--af-success) / <alpha-value>)',
          foreground: 'rgb(var(--af-success-fg) / <alpha-value>)',
        },
        warning: {
          DEFAULT: 'rgb(var(--af-warning) / <alpha-value>)',
          foreground: 'rgb(var(--af-warning-fg) / <alpha-value>)',
        },
        info: {
          DEFAULT: 'rgb(var(--af-info) / <alpha-value>)',
          foreground: 'rgb(var(--af-info-fg) / <alpha-value>)',
        },
        // Static, non-themed palette for charts / illustrations.
        navy: colors.brand,
        verdict: colors.verdict,
        framework: colors.framework,
      },
      fontFamily: {
        sans: typography.fonts.sans.split(',').map((s) => s.trim()),
        mono: typography.fonts.mono.split(',').map((s) => s.trim()),
      },
      fontSize: typography.size as unknown as Record<string, [string, { lineHeight: string }]>,
      fontWeight: {
        regular: typography.weight.regular,
        medium: typography.weight.medium,
        semibold: typography.weight.semibold,
        bold: typography.weight.bold,
      },
      letterSpacing: typography.letterSpacing,
      spacing: spacing as unknown as Record<string, string>,
      borderRadius: radii as unknown as Record<string, string>,
      boxShadow: shadows as unknown as Record<string, string>,
      transitionDuration: motion.duration as unknown as Record<string, string>,
      transitionTimingFunction: motion.ease as unknown as Record<string, string>,
      keyframes: {
        'collapse-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-collapsible-content-height)' },
        },
        'collapse-up': {
          from: { height: 'var(--radix-collapsible-content-height)' },
          to: { height: '0' },
        },
        'fade-in': { from: { opacity: '0' }, to: { opacity: '1' } },
        'slide-up': {
          from: { opacity: '0', transform: 'translateY(4px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
      animation: {
        'collapse-down': 'collapse-down 180ms cubic-bezier(0.2,0,0,1)',
        'collapse-up': 'collapse-up 180ms cubic-bezier(0.2,0,0,1)',
        'fade-in': 'fade-in 120ms cubic-bezier(0.2,0,0,1)',
        'slide-up': 'slide-up 180ms cubic-bezier(0.2,0,0,1)',
        shimmer: 'shimmer 1.6s linear infinite',
      },
    },
  },
  plugins: [animate],
};

export default preset;

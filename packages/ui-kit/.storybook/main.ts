// SPDX-License-Identifier: BUSL-1.1
import * as path from 'node:path';

import type { StorybookConfig } from '@storybook/nextjs';

/**
 * Storybook scans both the ui-kit primitives and the apps/web v3 workspace +
 * dashboard component stories so a single Storybook instance covers the full
 * design system surface (Phase 7 UI fixer feedback).
 *
 * `@/` alias resolution:
 *   `apps/web` uses `paths: { "@/*": ["./*"] }` in its tsconfig. Storybook
 *   runs from `packages/ui-kit/`, so we wire the same alias into the bundler
 *   via `webpackFinal` to keep imports portable. No new runtime deps.
 */
const APPS_WEB_ROOT = path.resolve(__dirname, '../../../apps/web');

const config: StorybookConfig = {
  stories: [
    '../stories/**/*.stories.@(ts|tsx|mdx)',
    '../src/**/*.stories.@(ts|tsx|mdx)',
    '../../../apps/web/components/**/*.stories.@(ts|tsx|mdx)',
  ],
  addons: [
    '@storybook/addon-essentials',
    '@storybook/addon-a11y',
    '@storybook/addon-interactions',
  ],
  framework: { name: '@storybook/nextjs', options: {} },
  docs: { autodocs: 'tag' },
  staticDirs: ['../public'],
  typescript: {
    check: false,
    reactDocgen: 'react-docgen-typescript',
  },
  webpackFinal: async (cfg) => {
    cfg.resolve = cfg.resolve ?? {};
    cfg.resolve.alias = {
      ...(cfg.resolve.alias ?? {}),
      // Mirror apps/web/tsconfig.json `@/*` → repo-relative apps/web/*
      '@': APPS_WEB_ROOT,
    };
    return cfg;
  },
};

export default config;

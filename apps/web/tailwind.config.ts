// SPDX-License-Identifier: BUSL-1.1
import type { Config } from 'tailwindcss';
import preset from '@auditforge/ui-kit/tailwind.preset';

const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
    '../../packages/ui-kit/src/**/*.{ts,tsx}',
  ],
  presets: [preset],
};
export default config;

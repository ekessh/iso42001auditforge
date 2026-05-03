// SPDX-License-Identifier: BUSL-1.1
import type { Preview } from '@storybook/react';
import * as React from 'react';

import '../src/styles/globals.css';
import { CommandPaletteProvider } from '../src/hooks/useCommandPalette';

/**
 * Storybook preview shared by ui-kit primitives and the apps/web workspace +
 * dashboard stories.
 *
 * Theme toggle is wired via the `theme` global (data-theme on the wrapper)
 * and the existing CSS variable scheme in `src/styles/globals.css`.
 *
 * Tabular-numerics and Inter UI are already enabled via the apps/web global
 * stylesheet (which itself imports the ui-kit globals). For Storybook the
 * ui-kit globals plus a Storybook-only Inter declaration in the wrapper
 * approximate the apps/web typography baseline. Reduced-motion preferences
 * are respected because every component uses Tailwind `motion-safe:` variants.
 */
const preview: Preview = {
  parameters: {
    backgrounds: { disable: true },
    layout: 'centered',
    a11y: {
      element: '#storybook-root',
      config: {},
      options: {},
      manual: false,
    },
    controls: {
      matchers: { color: /(background|color)$/i, date: /Date$/ },
    },
  },
  globalTypes: {
    theme: {
      description: 'Color scheme',
      defaultValue: 'dark',
      toolbar: {
        title: 'Theme',
        items: [
          { value: 'dark', title: 'Dark' },
          { value: 'light', title: 'Light' },
        ],
        dynamicTitle: true,
      },
    },
    density: {
      description: 'Density',
      defaultValue: 'comfortable',
      toolbar: {
        title: 'Density',
        items: [
          { value: 'comfortable', title: 'Comfortable' },
          { value: 'compact', title: 'Compact' },
        ],
        dynamicTitle: true,
      },
    },
  },
  decorators: [
    (Story, ctx) => (
      <div
        data-theme={ctx.globals.theme}
        data-density={ctx.globals.density}
        className="bg-background text-foreground p-6"
        style={{
          minWidth: 320,
          fontFamily: 'Inter, system-ui, sans-serif',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        <CommandPaletteProvider>
          <Story />
        </CommandPaletteProvider>
      </div>
    ),
  ],
};

export default preview;

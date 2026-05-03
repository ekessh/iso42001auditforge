// SPDX-License-Identifier: BUSL-1.1
import type { Meta, StoryObj } from '@storybook/react';
import * as React from 'react';

import { AuditorShell } from '../src/layouts/AuditorShell';

const meta: Meta<typeof AuditorShell> = {
  title: 'Layouts/AuditorShell',
  component: AuditorShell,
  parameters: { layout: 'fullscreen' },
};
export default meta;

export const Default: StoryObj<typeof AuditorShell> = {
  render: () => (
    <div className="h-[720px] w-[1280px] overflow-hidden">
      <AuditorShell
        identity={{ name: 'Mariana Costa', role: 'lead-auditor', firm: 'Sentinel Assurance' }}
        pathname="/dashboard"
      >
        <div className="p-6">
          <h1 className="text-lg font-semibold">Workspace</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Your engagement queue is empty. Press <kbd className="rounded border px-1 font-mono text-2xs">⌘K</kbd> to jump to a client.
          </p>
        </div>
      </AuditorShell>
    </div>
  ),
};

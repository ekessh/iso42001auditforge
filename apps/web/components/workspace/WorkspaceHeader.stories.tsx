// SPDX-License-Identifier: BUSL-1.1
import type { Meta, StoryObj } from '@storybook/react';
import * as React from 'react';

import { buildWorkspaceMock } from '@/lib/mocks/workspace-mock';

import { WorkspaceHeader } from './WorkspaceHeader';

const auditMock = buildWorkspaceMock('eng-audit', 'audit');
const readinessMock = buildWorkspaceMock('eng-readiness', 'readiness');

const meta: Meta<typeof WorkspaceHeader> = {
  title: 'Workspace/WorkspaceHeader',
  component: WorkspaceHeader,
  parameters: { layout: 'fullscreen' },
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <div className="bg-background" style={{ width: '100%', maxWidth: 1280 }}>
        <Story />
      </div>
    ),
  ],
  args: { onScopeChange: () => undefined },
};
export default meta;

type Story = StoryObj<typeof WorkspaceHeader>;

export const AuditMode: Story = {
  args: { ctx: auditMock.context, modeLabel: 'Audit Mode' },
};

export const ReadinessMode: Story = {
  args: {
    ctx: { ...readinessMock.context, phase: 'Readiness' as const, area: 'A.5 Impact' },
    modeLabel: 'Readiness Mode',
  },
};

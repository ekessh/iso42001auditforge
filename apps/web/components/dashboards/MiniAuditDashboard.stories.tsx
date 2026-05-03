// SPDX-License-Identifier: BUSL-1.1
import type { Meta, StoryObj } from '@storybook/react';
import * as React from 'react';

import { buildWorkspaceMock } from '@/lib/mocks/workspace-mock';

import { MiniAuditDashboard } from './MiniAuditDashboard';

const auditCtx = buildWorkspaceMock('eng-audit', 'audit').context;
const readinessCtx = buildWorkspaceMock('eng-readiness', 'readiness').context;

const meta: Meta<typeof MiniAuditDashboard> = {
  title: 'Dashboards/MiniAuditDashboard',
  component: MiniAuditDashboard,
  parameters: { layout: 'fullscreen' },
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <div className="bg-background" style={{ width: '100%', maxWidth: 1280 }}>
        <Story />
      </div>
    ),
  ],
};
export default meta;

type Story = StoryObj<typeof MiniAuditDashboard>;

export const EmbeddedStrip: Story = { args: { ctx: auditCtx } };

export const LowCoverageWarning: Story = {
  args: { ctx: { ...auditCtx, coveragePct: 41, candidateFindingsCount: 12 } },
};

export const CloudLlmTier: Story = {
  args: {
    ctx: {
      ...auditCtx,
      llmTier: 'cloud',
      llmModelLabel: 'Claude Sonnet 4.7 / GPT-4.1',
    },
  },
};

export const ReadinessContext: Story = {
  args: { ctx: readinessCtx },
};

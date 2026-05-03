// SPDX-License-Identifier: BUSL-1.1
import type { Meta, StoryObj } from '@storybook/react';
import * as React from 'react';

import { MOCK_READINESS } from '@/lib/mocks/workspace-mock';

import { AiSystemBars } from './AiSystemBars';

const meta: Meta<typeof AiSystemBars> = {
  title: 'Dashboards/AiSystemBars',
  component: AiSystemBars,
  parameters: { layout: 'fullscreen' },
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <div className="bg-background p-6" style={{ width: 540 }}>
        <Story />
      </div>
    ),
  ],
};
export default meta;

type Story = StoryObj<typeof AiSystemBars>;

export const ThreeSystems: Story = { args: { systems: MOCK_READINESS.aiSystems } };

export const SingleHighReadiness: Story = {
  args: {
    systems: [
      { systemId: 'sole', systemName: 'Lone production model', readinessPct: 92, weight: 1.0 },
    ],
  },
};

export const LowReadinessSpread: Story = {
  args: {
    systems: MOCK_READINESS.aiSystems.map((s) => ({ ...s, readinessPct: Math.max(15, s.readinessPct - 35) })),
  },
};

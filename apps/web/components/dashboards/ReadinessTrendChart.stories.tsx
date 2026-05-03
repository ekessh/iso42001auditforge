// SPDX-License-Identifier: BUSL-1.1
import type { Meta, StoryObj } from '@storybook/react';
import * as React from 'react';

import { MOCK_READINESS } from '@/lib/mocks/workspace-mock';

import { ReadinessTrendChart } from './ReadinessTrendChart';

const meta: Meta<typeof ReadinessTrendChart> = {
  title: 'Dashboards/ReadinessTrendChart',
  component: ReadinessTrendChart,
  parameters: { layout: 'fullscreen' },
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <div className="bg-background p-6" style={{ width: 720 }}>
        <Story />
      </div>
    ),
  ],
};
export default meta;

type Story = StoryObj<typeof ReadinessTrendChart>;

export const NinetyDays: Story = { args: { points: MOCK_READINESS.trend } };

export const ShortRange: Story = {
  args: { points: MOCK_READINESS.trend.slice(-4) },
};

export const FlatTrend: Story = {
  args: {
    points: MOCK_READINESS.trend.map((p) => ({ ...p, readinessPct: 50 })),
  },
};

// SPDX-License-Identifier: BUSL-1.1
import type { Meta, StoryObj } from '@storybook/react';
import * as React from 'react';

import { MOCK_AUDIT_DASHBOARD } from '@/lib/mocks/workspace-mock';

import { ManDayBurndown } from './ManDayBurndown';

const meta: Meta<typeof ManDayBurndown> = {
  title: 'Dashboards/ManDayBurndown',
  component: ManDayBurndown,
  parameters: { layout: 'fullscreen' },
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <div className="bg-background p-6" style={{ width: 640 }}>
        <Story />
      </div>
    ),
  ],
};
export default meta;

type Story = StoryObj<typeof ManDayBurndown>;

const POINTS = MOCK_AUDIT_DASHBOARD.manDays;

export const OnTrack: Story = {
  args: {
    points: POINTS.map((p) => ({ ...p, actual: p.planned })),
    spent: 18,
    planned: 18,
  },
};

export const Behind: Story = {
  args: {
    points: POINTS,
    spent: MOCK_AUDIT_DASHBOARD.manDaysSpent,
    planned: MOCK_AUDIT_DASHBOARD.manDaysPlanned,
  },
};

export const Overrun: Story = {
  args: {
    points: POINTS.map((p) => ({ ...p, actual: p.planned * 1.25 })),
    spent: 22,
    planned: 18,
  },
};

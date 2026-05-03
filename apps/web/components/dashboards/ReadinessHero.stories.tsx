// SPDX-License-Identifier: BUSL-1.1
import type { Meta, StoryObj } from '@storybook/react';
import * as React from 'react';

import { MOCK_READINESS } from '@/lib/mocks/workspace-mock';

import { ReadinessHero } from './ReadinessHero';

const meta: Meta<typeof ReadinessHero> = {
  title: 'Dashboards/ReadinessHero',
  component: ReadinessHero,
  parameters: { layout: 'fullscreen' },
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <div className="bg-background p-6" style={{ maxWidth: 720 }}>
        <Story />
      </div>
    ),
  ],
  args: {
    pct: MOCK_READINESS.overallPct,
    delta30d: MOCK_READINESS.trend30dDelta,
    delta90d: MOCK_READINESS.trend90dDelta,
    daysToTarget: MOCK_READINESS.daysToTarget,
    targetDate: MOCK_READINESS.targetCertDate,
    weightDescription: MOCK_READINESS.weights.description,
  },
};
export default meta;

type Story = StoryObj<typeof ReadinessHero>;

export const HighReadiness: Story = {
  args: { pct: 88, delta30d: 5, delta90d: 18 },
};

export const MediumReadiness: Story = {
  args: { pct: 65, delta30d: 7, delta90d: 18 },
};

export const LowReadiness: Story = {
  args: { pct: 34, delta30d: -3, delta90d: 4 },
};

export const WithCountdown: Story = {
  args: { pct: 65, daysToTarget: 14, targetDate: '2026-05-17' },
};

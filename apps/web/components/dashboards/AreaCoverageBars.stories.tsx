// SPDX-License-Identifier: BUSL-1.1
import type { Meta, StoryObj } from '@storybook/react';
import * as React from 'react';

import { MOCK_AUDIT_DASHBOARD } from '@/lib/mocks/workspace-mock';

import { AreaCoverageBars } from './AreaCoverageBars';

const meta: Meta<typeof AreaCoverageBars> = {
  title: 'Dashboards/AreaCoverageBars',
  component: AreaCoverageBars,
  parameters: { layout: 'fullscreen' },
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <div className="bg-background p-6" style={{ width: 540 }}>
        <Story />
      </div>
    ),
  ],
  args: { onAreaJump: () => undefined },
};
export default meta;

type Story = StoryObj<typeof AreaCoverageBars>;

export const Default: Story = { args: { bars: MOCK_AUDIT_DASHBOARD.areaBars } };

export const FullCoverage: Story = {
  args: {
    bars: MOCK_AUDIT_DASHBOARD.areaBars.map((b) => ({ ...b, covered: b.planned })),
  },
};

export const LowCoverage: Story = {
  args: {
    bars: MOCK_AUDIT_DASHBOARD.areaBars.map((b) => ({ ...b, covered: Math.floor(b.planned * 0.2) })),
  },
};

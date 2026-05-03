// SPDX-License-Identifier: BUSL-1.1
import type { Meta, StoryObj } from '@storybook/react';
import * as React from 'react';

import { MOCK_READINESS } from '@/lib/mocks/workspace-mock';

import { OpenItemsPanel } from './OpenItemsPanel';

const meta: Meta<typeof OpenItemsPanel> = {
  title: 'Dashboards/OpenItemsPanel',
  component: OpenItemsPanel,
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

type Story = StoryObj<typeof OpenItemsPanel>;

export const ImprovementItems: Story = {
  args: { title: 'Improvement Items', items: MOCK_READINESS.openItems },
};

export const CandidateFindings: Story = {
  args: { title: 'Candidate Findings', items: MOCK_READINESS.openItems },
};

export const Empty: Story = {
  args: { title: 'Improvement Items', items: [] },
};

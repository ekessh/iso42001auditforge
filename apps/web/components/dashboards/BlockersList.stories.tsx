// SPDX-License-Identifier: BUSL-1.1
import type { Meta, StoryObj } from '@storybook/react';
import * as React from 'react';

import { MOCK_READINESS } from '@/lib/mocks/workspace-mock';

import { BlockersList } from './BlockersList';

const meta: Meta<typeof BlockersList> = {
  title: 'Dashboards/BlockersList',
  component: BlockersList,
  parameters: { layout: 'fullscreen' },
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <div className="bg-background p-6" style={{ width: 540 }}>
        <Story />
      </div>
    ),
  ],
  args: { onAction: () => undefined },
};
export default meta;

type Story = StoryObj<typeof BlockersList>;

export const TopFiveBlockers: Story = { args: { items: MOCK_READINESS.blockers } };

export const SingleHighImpact: Story = {
  args: { items: MOCK_READINESS.blockers.slice(0, 1) },
};

export const Empty: Story = { args: { items: [] } };

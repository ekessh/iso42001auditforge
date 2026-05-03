// SPDX-License-Identifier: BUSL-1.1
import type { Meta, StoryObj } from '@storybook/react';
import * as React from 'react';

import { buildWorkspaceMock } from '@/lib/mocks/workspace-mock';

import { ParkedTab } from './ParkedTab';

const mock = buildWorkspaceMock();
const allParked = mock.candidateFindings.map((f) => ({ ...f, parked: true }));

const meta: Meta<typeof ParkedTab> = {
  title: 'Workspace/ParkedTab',
  component: ParkedTab,
  parameters: { layout: 'centered' },
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <div style={{ width: 420 }}>
        <Story />
      </div>
    ),
  ],
  args: {
    promoteLabel: 'Add',
    parkLabel: 'Park',
    onPromote: () => undefined,
    onUnpark: () => undefined,
    onDelete: () => undefined,
    onEditSave: () => undefined,
  },
};
export default meta;

type Story = StoryObj<typeof ParkedTab>;

export const WithItems: Story = { args: { parked: allParked } };

export const SingleItem: Story = { args: { parked: [allParked[0]!] } };

export const Empty: Story = { args: { parked: [] } };

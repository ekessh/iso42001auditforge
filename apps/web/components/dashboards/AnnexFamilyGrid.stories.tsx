// SPDX-License-Identifier: BUSL-1.1
import type { Meta, StoryObj } from '@storybook/react';
import * as React from 'react';

import { MOCK_READINESS } from '@/lib/mocks/workspace-mock';

import { AnnexFamilyGrid } from './AnnexFamilyGrid';

const meta: Meta<typeof AnnexFamilyGrid> = {
  title: 'Dashboards/AnnexFamilyGrid',
  component: AnnexFamilyGrid,
  parameters: { layout: 'fullscreen' },
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <div className="bg-background p-6" style={{ maxWidth: 1080 }}>
        <Story />
      </div>
    ),
  ],
  args: { onSelect: () => undefined },
};
export default meta;

type Story = StoryObj<typeof AnnexFamilyGrid>;

export const Default: Story = { args: { families: MOCK_READINESS.families } };

export const SelectedA7: Story = {
  args: { families: MOCK_READINESS.families, selectedId: 'A.7' },
};

export const AllGreen: Story = {
  args: {
    families: MOCK_READINESS.families.map((f) => ({
      ...f,
      status: 'green' as const,
      readinessPct: 90,
      evidenced: f.totalClauses,
      partial: 0,
      untouched: 0,
    })),
  },
};

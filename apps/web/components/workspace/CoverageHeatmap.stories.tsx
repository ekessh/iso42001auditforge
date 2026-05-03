// SPDX-License-Identifier: BUSL-1.1
import type { Meta, StoryObj } from '@storybook/react';
import * as React from 'react';

import { buildWorkspaceMock, type CoverageArea } from '@/lib/mocks/workspace-mock';

import { CoverageHeatmap } from './CoverageHeatmap';

const mock = buildWorkspaceMock();

const fullCoverage: CoverageArea = {
  id: 'A.7',
  title: 'A.7 Data for AI systems (full coverage)',
  cells: mock.coverageArea.cells.map((c) => ({ ...c, status: 'evidenced' as const })),
};

const empty: CoverageArea = {
  id: 'A.10',
  title: 'A.10 Third-party (untouched)',
  cells: [
    { id: 'A.10.2', title: 'Suppliers', status: 'untouched' },
    { id: 'A.10.3', title: 'Customers', status: 'untouched' },
    { id: 'A.10.4', title: 'Resources', status: 'untouched' },
  ],
};

const meta: Meta<typeof CoverageHeatmap> = {
  title: 'Workspace/CoverageHeatmap',
  component: CoverageHeatmap,
  parameters: { layout: 'centered' },
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <div style={{ width: 480 }}>
        <Story />
      </div>
    ),
  ],
  args: { onCellSelect: () => undefined },
};
export default meta;

type Story = StoryObj<typeof CoverageHeatmap>;

export const Mixed: Story = { args: { area: mock.coverageArea } };

export const FullCoverage: Story = { args: { area: fullCoverage } };

export const Empty: Story = { args: { area: empty } };

export const Compact: Story = {
  args: { area: mock.coverageArea, compact: true },
  decorators: [
    (Story) => (
      <div style={{ width: 280 }}>
        <Story />
      </div>
    ),
  ],
};

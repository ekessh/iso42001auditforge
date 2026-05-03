// SPDX-License-Identifier: BUSL-1.1
import type { Meta, StoryObj } from '@storybook/react';
import { type ColumnDef } from '@tanstack/react-table';

import { DataTable } from '../src/components/DataTable';
import { VerdictPill, type Verdict } from '../src/domain/VerdictPill';
import { ClauseRef } from '../src/domain/ClauseRef';
import { ConfidenceMeter } from '../src/domain/ConfidenceMeter';

interface WorkingPaper {
  id: string;
  clause: string;
  area: string;
  verdict: Verdict;
  confidence: number;
  auditor: string;
  updated: string;
}

const data: WorkingPaper[] = Array.from({ length: 30 }, (_, i) => ({
  id: `WP-${(1000 + i).toString()}`,
  clause: ['4.3', '6.1.4', '7.5', '8.1', '9.1', 'A.5.4', 'A.6.2.5'][i % 7] ?? '6.1.4',
  area: ['AIMS scope', 'Risk treatment', 'Documented info', 'Operations', 'Performance evaluation', 'Impact', 'Robustness'][
    i % 7
  ] ?? 'Risk treatment',
  verdict: (['conformant', 'minor-nc', 'major-nc', 'ofi', 'na', 'pending'] as Verdict[])[i % 6] ?? 'pending',
  confidence: 50 + ((i * 7) % 50),
  auditor: ['Costa', 'Tanaka', 'Patel'][i % 3] ?? 'Costa',
  updated: `2026-04-${(1 + (i % 28)).toString().padStart(2, '0')}`,
}));

const columns: ColumnDef<WorkingPaper>[] = [
  { accessorKey: 'id', header: 'WP', cell: (c) => <span className="font-mono">{c.getValue<string>()}</span>, size: 100 },
  {
    accessorKey: 'clause',
    header: 'Clause',
    cell: (c) => <ClauseRef clause={c.getValue<string>()} />,
    size: 110,
  },
  { accessorKey: 'area', header: 'Area', size: 220 },
  {
    accessorKey: 'verdict',
    header: 'Verdict',
    cell: (c) => <VerdictPill verdict={c.getValue<Verdict>()} />,
    size: 130,
  },
  {
    accessorKey: 'confidence',
    header: 'Confidence',
    cell: (c) => <ConfidenceMeter value={c.getValue<number>()} />,
    size: 160,
  },
  { accessorKey: 'auditor', header: 'Auditor', size: 120 },
  { accessorKey: 'updated', header: 'Updated', cell: (c) => <span className="font-mono tabular">{c.getValue<string>()}</span>, size: 120 },
];

const meta: Meta<typeof DataTable<WorkingPaper>> = {
  title: 'Primitives/DataTable',
  component: DataTable<WorkingPaper>,
  tags: ['autodocs'],
};
export default meta;

type Story = StoryObj<typeof DataTable<WorkingPaper>>;

export const Default: Story = {
  args: { data, columns, ariaLabel: 'Working papers' },
  render: (args) => (
    <div className="h-[480px] w-[920px]">
      <DataTable {...args} />
    </div>
  ),
};

export const Loading: Story = {
  args: { data: [], columns, loading: true },
  render: (args) => (
    <div className="h-[300px] w-[920px]">
      <DataTable {...args} />
    </div>
  ),
};

export const Empty: Story = {
  args: { data: [], columns },
  render: (args) => (
    <div className="h-[300px] w-[920px]">
      <DataTable {...args} />
    </div>
  ),
};

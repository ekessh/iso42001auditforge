// SPDX-License-Identifier: BUSL-1.1
import type { Meta, StoryObj } from '@storybook/react';
import * as React from 'react';

import { buildWorkspaceMock, type CandidateFinding } from '@/lib/mocks/workspace-mock';

import { CandidateFindingCard } from './CandidateFindingCard';

const mock = buildWorkspaceMock();
const findings = mock.candidateFindings;

function findFinding(predicate: (f: CandidateFinding) => boolean): CandidateFinding {
  const f = findings.find(predicate);
  if (!f) throw new Error('mock finding not found for story fixture');
  return f;
}

const major = findFinding((f) => f.type === 'major');
const minorHigh = findFinding((f) => f.type === 'minor' && f.confidence === 'high');
const minorMedium = findFinding((f) => f.type === 'minor' && f.confidence === 'medium');
const ofi = findFinding((f) => f.type === 'ofi');
const observation = findFinding((f) => f.type === 'observation');

const noop = () => undefined;

const meta: Meta<typeof CandidateFindingCard> = {
  title: 'Workspace/CandidateFindingCard',
  component: CandidateFindingCard,
  parameters: { layout: 'centered' },
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <div style={{ width: 360 }}>
        <Story />
      </div>
    ),
  ],
  args: {
    promoteLabel: 'Add',
    parkLabel: 'Park',
    index: 0,
    isSelected: false,
    onSelect: noop,
    onEditSave: noop,
    onDelete: noop,
    onPromote: noop,
    onPark: noop,
    onUnpark: noop,
  },
};
export default meta;

type Story = StoryObj<typeof CandidateFindingCard>;

export const MajorNc: Story = { args: { finding: major } };

export const MinorNcHighConfidence: Story = { args: { finding: minorHigh } };

export const MinorNcMediumConfidence: Story = { args: { finding: minorMedium } };

export const Ofi: Story = { args: { finding: ofi } };

export const Observation: Story = { args: { finding: observation } };

export const ParkedObservation: Story = {
  args: {
    finding: { ...observation, parked: true },
  },
};

export const Selected: Story = {
  args: {
    finding: minorHigh,
    isSelected: true,
  },
};

export const LowConfidence: Story = {
  args: {
    finding: { ...major, confidence: 'low' as const },
  },
};

export const Expanded: Story = {
  args: {
    finding: {
      ...minorHigh,
      statement:
        minorHigh.statement +
        ' Additionally, related claims about deployment lineage are not currently linked from the deploy ticket, which means an auditor cannot trace from a feature-store run id to the deploy approval without leaving the working paper.',
    },
  },
};

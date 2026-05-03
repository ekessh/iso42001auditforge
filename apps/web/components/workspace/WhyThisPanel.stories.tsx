// SPDX-License-Identifier: BUSL-1.1
import type { Meta, StoryObj } from '@storybook/react';
import * as React from 'react';

import { WhyThisPanel } from './WhyThisPanel';

const meta: Meta<typeof WhyThisPanel> = {
  title: 'Workspace/WhyThisPanel',
  component: WhyThisPanel,
  parameters: { layout: 'centered' },
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <div style={{ width: 480 }}>
        <Story />
      </div>
    ),
  ],
  args: {
    panelId: 'why-001',
    rationale:
      'Coverage gap on A.6.2.7 (operation) combined with RAG-class profile, library template Q-A7-004 v3 prioritised based on 0.74 coverage-priority score.',
    provenance: [
      { id: 'A.7.4', label: 'A.7.4 Quality of data', kind: 'clause' },
      { id: 'Q-A7-004', label: 'Library Q-A7-004 v3', kind: 'library' },
      { id: 'C-1421-04', label: 'Claim C-1421-04', kind: 'claim' },
      { id: 'profile-rag', label: 'RAG-class profile', kind: 'profile' },
    ],
  },
};
export default meta;

type Story = StoryObj<typeof WhyThisPanel>;

export const Open: Story = { args: { open: true } };

export const Closed: Story = { args: { open: false } };

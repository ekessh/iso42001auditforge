// SPDX-License-Identifier: BUSL-1.1
import type { Meta, StoryObj } from '@storybook/react';
import * as React from 'react';

import { InlineAlert } from './InlineAlert';

const meta: Meta<typeof InlineAlert> = {
  title: 'Workspace/InlineAlert',
  component: InlineAlert,
  parameters: { layout: 'centered' },
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <div style={{ width: 540 }}>
        <Story />
      </div>
    ),
  ],
};
export default meta;

type Story = StoryObj<typeof InlineAlert>;

export const CoverageGap: Story = {
  args: {
    kind: 'coverage_gap',
    what: 'Coverage gap detected — original question targeted A.6.2.7 (operation) but the answer did not address how lineage is verified at deployment.',
    remediation: 'Inject follow-up about deployment-time lineage verification.',
    onAction: () => undefined,
    actionLabel: 'Inject follow-up',
  },
};

export const Contradiction: Story = {
  args: {
    kind: 'contradiction',
    what: 'This answer contradicts a claim from the 10:15 interview with the MLOps Lead, who asserted retraining decisions are formally documented.',
    remediation: 'Review claims C-1015-12 vs C-1421-04; consider a contradiction-resolution question.',
    onAction: () => undefined,
    actionLabel: 'Resolve contradiction',
  },
};

export const Termination: Story = {
  args: {
    kind: 'termination',
    what: 'Scope substantially covered for A.7 — every in-scope clause has an evidenced or N/A status. Ready to advance to A.8.',
    remediation: 'Confirm advance and capture coverage summary in working papers.',
    onAction: () => undefined,
    actionLabel: 'Advance area',
  },
};

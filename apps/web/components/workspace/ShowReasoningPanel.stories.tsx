// SPDX-License-Identifier: BUSL-1.1
import type { Meta, StoryObj } from '@storybook/react';
import * as React from 'react';

import type { ReasoningTrace } from '@/lib/mocks/workspace-mock';

import { ShowReasoningPanel } from './ShowReasoningPanel';

const trace: ReasoningTrace = {
  model: 'Qwen 32B (reasoning)',
  steps: [
    'Step 1 — Detected gap: deployment-link verification not addressed.',
    'Step 2 — Cross-checked C-1015-12 (MLOps Lead) which asserted documented retraining; potential contradiction with C-1421-04.',
    'Step 3 — Selected follow-up template Q-A6-006-FU-3 over Q-A6-006-FU-1 because it elicits artefact reference rather than restating the gap.',
    'Step 4 — Composed question, attached provenance, returned with priority 0.81.',
  ],
};

/**
 * Stateful wrapper so the disclosure can be toggled in the canvas; exercises
 * the controlled `open` + `onToggle` API that the chat stream wires up in
 * production.
 */
function StatefulShowReasoning({ initialOpen }: { initialOpen: boolean }) {
  const [open, setOpen] = React.useState(initialOpen);
  return (
    <ShowReasoningPanel
      trace={trace}
      open={open}
      onToggle={() => setOpen((v) => !v)}
      panelId="reasoning-001"
    />
  );
}

const meta: Meta<typeof ShowReasoningPanel> = {
  title: 'Workspace/ShowReasoningPanel',
  component: ShowReasoningPanel,
  parameters: { layout: 'centered' },
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <div style={{ width: 480 }}>
        <Story />
      </div>
    ),
  ],
};
export default meta;

type Story = StoryObj<typeof ShowReasoningPanel>;

export const CollapsedByDefault: Story = {
  render: () => <StatefulShowReasoning initialOpen={false} />,
};

export const Expanded: Story = {
  render: () => <StatefulShowReasoning initialOpen />,
};

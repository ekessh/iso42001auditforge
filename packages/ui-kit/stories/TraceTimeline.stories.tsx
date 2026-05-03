// SPDX-License-Identifier: BUSL-1.1
import type { Meta, StoryObj } from '@storybook/react';

import { TraceTimeline } from '../src/domain/TraceTimeline';

const meta: Meta<typeof TraceTimeline> = {
  title: 'Domain/TraceTimeline',
  component: TraceTimeline,
  tags: ['autodocs'],
};
export default meta;

type Story = StoryObj<typeof TraceTimeline>;

export const AgentRun: Story = {
  render: () => (
    <div className="w-[720px]">
      <TraceTimeline
        spans={[
          { id: '1', name: 'agent.invoke', start: 0, duration: 4200, depth: 0, kind: 'agent' },
          { id: '2', name: 'llm.plan', start: 50, duration: 800, depth: 1, kind: 'llm' },
          { id: '3', name: 'tool.search', start: 900, duration: 1100, depth: 1, kind: 'tool' },
          { id: '4', name: 'retrieval.vector', start: 950, duration: 240, depth: 2, kind: 'retrieval' },
          { id: '5', name: 'llm.draft', start: 2050, duration: 1600, depth: 1, kind: 'llm' },
          { id: '6', name: 'tool.send_email', start: 3700, duration: 480, depth: 1, kind: 'tool', status: 'error' },
        ]}
      />
    </div>
  ),
};

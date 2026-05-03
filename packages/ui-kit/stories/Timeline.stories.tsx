// SPDX-License-Identifier: BUSL-1.1
import type { Meta, StoryObj } from '@storybook/react';
import { CheckCircle2, FileText, ShieldCheck } from 'lucide-react';

import { Timeline } from '../src/components/Timeline';

const meta: Meta<typeof Timeline> = { title: 'Primitives/Timeline', component: Timeline, tags: ['autodocs'] };
export default meta;

export const EngagementHistory: StoryObj<typeof Timeline> = {
  render: () => (
    <Timeline
      events={[
        { id: '1', title: 'Stage 1 audit completed', timestamp: '2026-03-04', tone: 'success', icon: <CheckCircle2 /> },
        { id: '2', title: 'Plan signed by auditee', timestamp: '2026-03-12', tone: 'primary', icon: <ShieldCheck /> },
        { id: '3', title: 'Working papers freeze (Stage 2)', timestamp: '2026-04-24', tone: 'info', icon: <FileText /> },
        { id: '4', title: 'Closing meeting', timestamp: '2026-04-25', tone: 'neutral' },
      ]}
    />
  ),
};

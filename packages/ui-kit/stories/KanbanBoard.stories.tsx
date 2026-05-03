// SPDX-License-Identifier: BUSL-1.1
import type { Meta, StoryObj } from '@storybook/react';

import { KanbanBoard } from '../src/components/KanbanBoard';

const meta: Meta<typeof KanbanBoard> = { title: 'Primitives/KanbanBoard', component: KanbanBoard, tags: ['autodocs'] };
export default meta;

export const NCBoard: StoryObj<typeof KanbanBoard> = {
  render: () => (
    <div className="h-[560px] w-[1100px]">
      <KanbanBoard
        columns={[
          {
            id: 'open',
            title: 'Open',
            accent: 'danger',
            cards: [
              {
                id: 'NC-2026-04',
                title: 'Major NC: A.7.4 PII leakage in copilot outputs',
                subtitle: 'Acme Robotics · Stage 2',
                badges: [{ label: 'Major NC', tone: 'danger' }, { label: 'A.7.4', tone: 'primary' }],
                meta: 'Issued 2d ago',
              },
              {
                id: 'NC-2026-05',
                title: 'Minor NC: 6.1.4 risk treatment plan undated',
                badges: [{ label: 'Minor NC', tone: 'warning' }],
              },
            ],
          },
          {
            id: 'proposed',
            title: 'CA Proposed',
            accent: 'warning',
            cards: [
              {
                id: 'NC-2026-02',
                title: 'OFI: clearer impact assessment template',
                badges: [{ label: 'OFI', tone: 'info' }],
              },
            ],
          },
          { id: 'accepted', title: 'CA Accepted', accent: 'info', cards: [] },
          {
            id: 'verified',
            title: 'Verified',
            accent: 'success',
            cards: [{ id: 'NC-2025-31', title: 'Bias monitoring cadence implemented', badges: [{ label: 'Closed', tone: 'success' }] }],
          },
        ]}
      />
    </div>
  ),
};

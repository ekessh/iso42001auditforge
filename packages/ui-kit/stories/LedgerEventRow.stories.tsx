// SPDX-License-Identifier: BUSL-1.1
import type { Meta, StoryObj } from '@storybook/react';

import { LedgerEventRow } from '../src/domain/LedgerEventRow';

const meta: Meta<typeof LedgerEventRow> = {
  title: 'Domain/LedgerEventRow',
  component: LedgerEventRow,
  tags: ['autodocs'],
};
export default meta;

type Story = StoryObj<typeof LedgerEventRow>;

export const Chain: Story = {
  render: () => (
    <div className="rounded-md border border-border bg-card">
      <LedgerEventRow
        seq={1}
        action="engagement.create"
        summary="Stage 2 audit started for Acme Robotics"
        actor={{ name: 'Mariana Costa', role: 'lead-auditor' }}
        timestamp="2026-04-01T08:00:00Z"
        hash="9c2af6e1bd44ff2e"
      />
      <LedgerEventRow
        seq={2}
        action="wp.update"
        summary="Working paper for clause 6.1.4 updated · verdict=conformant"
        actor={{ name: 'Hiroshi Tanaka', role: 'team-auditor' }}
        timestamp="2026-04-01T09:14:22Z"
        hash="0f3b1ac9221de2"
        prevHash="9c2af6e1bd44ff2e"
      />
      <LedgerEventRow
        seq={3}
        action="probe.execute"
        summary="P-INJ-01 — direct prompt injection · 87/100 PASS"
        actor={{ name: 'Aisha Patel', role: 'technical-expert' }}
        timestamp="2026-04-01T10:02:11Z"
        hash="a8c2913ee14b1f"
        prevHash="0f3b1ac9221de2"
      />
    </div>
  ),
};

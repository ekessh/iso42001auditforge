// SPDX-License-Identifier: BUSL-1.1
import type { Meta, StoryObj } from '@storybook/react';

import { EvidenceLink } from '../src/domain/EvidenceLink';

const meta: Meta<typeof EvidenceLink> = {
  title: 'Domain/EvidenceLink',
  component: EvidenceLink,
  tags: ['autodocs'],
};
export default meta;

type Story = StoryObj<typeof EvidenceLink>;

export const Kinds: Story = {
  render: () => (
    <div className="flex max-w-md flex-col gap-2">
      <EvidenceLink kind="document" label="aims-policy-v3.pdf" hash="9c2af6e1bd44" signed />
      <EvidenceLink kind="spreadsheet" label="risk-register.xlsx" hash="7b80de" />
      <EvidenceLink kind="image" label="server-room-12.png" />
      <EvidenceLink kind="screenshot" label="prod-banner-2024-09.png" />
      <EvidenceLink kind="link" label="https://mlflow/run/abc123" href="#" meta="external" />
      <EvidenceLink kind="probe-result" label="P-INJ-01 — direct injection" hash="a1b2c3" signed />
      <EvidenceLink kind="system" label="OTel trace 8e7f…" />
    </div>
  ),
};

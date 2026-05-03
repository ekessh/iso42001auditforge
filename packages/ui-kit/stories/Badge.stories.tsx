// SPDX-License-Identifier: BUSL-1.1
import type { Meta, StoryObj } from '@storybook/react';

import { Badge } from '../src/components/Badge';

const meta: Meta<typeof Badge> = {
  title: 'Primitives/Badge',
  component: Badge,
  tags: ['autodocs'],
};
export default meta;

type Story = StoryObj<typeof Badge>;

export const Tones: Story = {
  render: () => (
    <div className="flex flex-wrap gap-2">
      <Badge tone="neutral">Neutral</Badge>
      <Badge tone="primary">Primary</Badge>
      <Badge tone="success">Conformant</Badge>
      <Badge tone="warning">Minor</Badge>
      <Badge tone="danger">Major</Badge>
      <Badge tone="info">OFI</Badge>
      <Badge tone="outline">N/A</Badge>
    </div>
  ),
};

// SPDX-License-Identifier: BUSL-1.1
import type { Meta, StoryObj } from '@storybook/react';

import { VerdictPill } from '../src/domain/VerdictPill';

const meta: Meta<typeof VerdictPill> = {
  title: 'Domain/VerdictPill',
  component: VerdictPill,
  tags: ['autodocs'],
};
export default meta;

type Story = StoryObj<typeof VerdictPill>;

export const All: Story = {
  render: () => (
    <div className="flex flex-wrap gap-2">
      <VerdictPill verdict="conformant" />
      <VerdictPill verdict="minor-nc" />
      <VerdictPill verdict="major-nc" />
      <VerdictPill verdict="ofi" />
      <VerdictPill verdict="na" />
      <VerdictPill verdict="pending" />
    </div>
  ),
};

export const Larger: Story = { args: { verdict: 'conformant', size: 'md' } };

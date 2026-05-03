// SPDX-License-Identifier: BUSL-1.1
import type { Meta, StoryObj } from '@storybook/react';

import { NCStatePill } from '../src/domain/NCStatePill';

const meta: Meta<typeof NCStatePill> = { title: 'Domain/NCStatePill', component: NCStatePill, tags: ['autodocs'] };
export default meta;

type Story = StoryObj<typeof NCStatePill>;

export const All: Story = {
  render: () => (
    <div className="flex flex-wrap gap-2">
      <NCStatePill state="open" />
      <NCStatePill state="proposed" />
      <NCStatePill state="accepted" />
      <NCStatePill state="implemented" />
      <NCStatePill state="verified" />
      <NCStatePill state="closed" />
      <NCStatePill state="rejected" />
    </div>
  ),
};

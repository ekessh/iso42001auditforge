// SPDX-License-Identifier: BUSL-1.1
import type { Meta, StoryObj } from '@storybook/react';

import { ConfidenceMeter } from '../src/domain/ConfidenceMeter';

const meta: Meta<typeof ConfidenceMeter> = {
  title: 'Domain/ConfidenceMeter',
  component: ConfidenceMeter,
  tags: ['autodocs'],
};
export default meta;

type Story = StoryObj<typeof ConfidenceMeter>;

export const Spectrum: Story = {
  render: () => (
    <div className="flex flex-col gap-2">
      {[0, 25, 50, 65, 80, 95].map((v) => (
        <ConfidenceMeter key={v} value={v} />
      ))}
    </div>
  ),
};

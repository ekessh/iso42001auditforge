// SPDX-License-Identifier: BUSL-1.1
import type { Meta, StoryObj } from '@storybook/react';
import { ArrowRight, Save, Trash2 } from 'lucide-react';

import { Button } from '../src/components/Button';

const meta: Meta<typeof Button> = {
  title: 'Primitives/Button',
  component: Button,
  tags: ['autodocs'],
  args: { children: 'Sign engagement' },
};
export default meta;

type Story = StoryObj<typeof Button>;

export const Primary: Story = { args: { variant: 'primary' } };
export const Secondary: Story = { args: { variant: 'secondary' } };
export const Outline: Story = { args: { variant: 'outline' } };
export const Ghost: Story = { args: { variant: 'ghost' } };
export const Destructive: Story = { args: { variant: 'destructive', children: 'Delete', iconLeft: <Trash2 /> } };
export const WithShortcut: Story = { args: { variant: 'primary', shortcut: '⌘S', iconLeft: <Save />, children: 'Save to ledger' } };
export const Loading: Story = { args: { loading: true, children: 'Saving…' } };
export const Sizes: Story = {
  render: () => (
    <div className="flex flex-col items-start gap-2">
      <Button size="xs">Extra small</Button>
      <Button size="sm">Small</Button>
      <Button size="md">Medium</Button>
      <Button size="lg" iconRight={<ArrowRight />}>Large with icon</Button>
    </div>
  ),
};

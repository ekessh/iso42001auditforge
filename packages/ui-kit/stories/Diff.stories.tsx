// SPDX-License-Identifier: BUSL-1.1
import type { Meta, StoryObj } from '@storybook/react';

import { Diff } from '../src/components/Diff';

const meta: Meta<typeof Diff> = { title: 'Primitives/Diff', component: Diff, tags: ['autodocs'] };
export default meta;

const lines = [
  { op: 'equal' as const, text: 'tools:', oldNumber: 1, newNumber: 1 },
  { op: 'equal' as const, text: '  - search_kb', oldNumber: 2, newNumber: 2 },
  { op: 'remove' as const, text: '  - delete_user', oldNumber: 3 },
  { op: 'add' as const, text: '  - delete_user_with_approval', newNumber: 3 },
  { op: 'equal' as const, text: '  - send_email', oldNumber: 4, newNumber: 4 },
];

export const Inline: StoryObj<typeof Diff> = { args: { lines, mode: 'inline' } };
export const Side: StoryObj<typeof Diff> = { args: { lines, mode: 'side-by-side' } };

// SPDX-License-Identifier: BUSL-1.1
import type { Meta, StoryObj } from '@storybook/react';
import { ClipboardList } from 'lucide-react';

import { Button } from '../src/components/Button';
import { EmptyState } from '../src/components/EmptyState';

const meta: Meta<typeof EmptyState> = { title: 'Primitives/EmptyState', component: EmptyState, tags: ['autodocs'] };
export default meta;

export const Default: StoryObj<typeof EmptyState> = {
  args: {
    icon: <ClipboardList />,
    title: 'No engagements yet',
    description: 'Create your first engagement from a client to start scoping a Stage 1 audit.',
    action: <Button>Create engagement</Button>,
  },
};

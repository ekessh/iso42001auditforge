// SPDX-License-Identifier: BUSL-1.1
import type { Meta, StoryObj } from '@storybook/react';

import { ToolACLDriftDiff } from '../src/domain/ToolACLDriftDiff';

const meta: Meta<typeof ToolACLDriftDiff> = {
  title: 'Domain/ToolACLDriftDiff',
  component: ToolACLDriftDiff,
  tags: ['autodocs'],
};
export default meta;

type Story = StoryObj<typeof ToolACLDriftDiff>;

export const Drift: Story = {
  render: () => (
    <ToolACLDriftDiff
      entries={[
        { name: 'search_kb', scope: 'read', declared: true, observed: true, callCount: 12_402 },
        { name: 'send_email', scope: 'write', declared: true, observed: true, callCount: 322 },
        { name: 'delete_user', scope: 'destructive', declared: false, observed: true, callCount: 4 },
        { name: 'export_dataset', scope: 'read', declared: true, observed: false, callCount: 0 },
        { name: 'list_users', scope: 'metadata', declared: true, observed: true, callCount: 1099 },
      ]}
    />
  ),
};

// SPDX-License-Identifier: BUSL-1.1
import type { Meta, StoryObj } from '@storybook/react';
import * as React from 'react';

import { buildWorkspaceMock } from '@/lib/mocks/workspace-mock';

import { ClaimsTab } from './ClaimsTab';

const mock = buildWorkspaceMock();

const meta: Meta<typeof ClaimsTab> = {
  title: 'Workspace/ClaimsTab',
  component: ClaimsTab,
  parameters: { layout: 'centered' },
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <div style={{ width: 420 }}>
        <Story />
      </div>
    ),
  ],
  args: { onClaimSelect: () => undefined },
};
export default meta;

type Story = StoryObj<typeof ClaimsTab>;

export const Default: Story = { args: { claims: mock.claims.slice(0, 8) } };

export const ManyClaims: Story = { args: { claims: mock.claims } };

export const Empty: Story = { args: { claims: [] } };

// SPDX-License-Identifier: BUSL-1.1
import type { Meta, StoryObj } from '@storybook/react';
import * as React from 'react';

import { AuditorMessage } from './AuditorMessage';

const meta: Meta<typeof AuditorMessage> = {
  title: 'Workspace/AuditorMessage',
  component: AuditorMessage,
  parameters: { layout: 'centered' },
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <div style={{ width: 540 }}>
        <Story />
      </div>
    ),
  ],
  args: {
    body: 'Walk me through how training-data lineage is recorded for the radiology triage model — from raw acquisition through versioned features into the deployed model.',
    ts: '14:18',
    auditorName: 'M. Castellanos',
    intervieweeName: 'Dr. K. Ito',
    intervieweeRole: 'Data Lead',
  },
};
export default meta;

type Story = StoryObj<typeof AuditorMessage>;

export const Default: Story = {};

export const WithIntervieweeDropdown: Story = {
  args: {
    interviewees: [
      { id: 'iv-ito', name: 'Dr. K. Ito', role: 'Data Lead' },
      { id: 'iv-nguyen', name: 'P. Nguyen', role: 'MLOps Lead' },
      { id: 'iv-hartwell', name: 'A. Hartwell', role: 'CISO' },
      { id: 'iv-park', name: 'L. Park', role: 'Privacy Counsel' },
    ],
    onChangeInterviewee: () => undefined,
  },
};

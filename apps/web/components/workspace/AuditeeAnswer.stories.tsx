// SPDX-License-Identifier: BUSL-1.1
import type { Meta, StoryObj } from '@storybook/react';
import * as React from 'react';

import { AuditeeAnswer } from './AuditeeAnswer';

const meta: Meta<typeof AuditeeAnswer> = {
  title: 'Workspace/AuditeeAnswer',
  component: AuditeeAnswer,
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
    body: 'We capture every cohort export with a hash and the DICOM source. The feature pipeline is in MLflow with run IDs pinned to model versions.',
    ts: '14:21',
    speakerName: 'Dr. K. Ito',
    source: 'transcribed_local',
  },
};
export default meta;

type Story = StoryObj<typeof AuditeeAnswer>;

export const Default: Story = {};

export const TranscribedViaWhisper: Story = {
  args: {
    source: 'transcribed_local',
    body: 'Yes, we have a SHA-256 register. Cohort balance metrics are reviewed before retraining, although we do not document a hard threshold in writing — the radiologists set it informally.',
  },
};

export const ManuallyTyped: Story = {
  args: {
    source: 'typed',
    body: 'Honestly, the meeting notes are not currently linked from the deployment ticket. The MLOps lead approves the deploy in our tracker once tests pass; the retraining context lives separately in Confluence.',
  },
};

export const TranscribedViaCloud: Story = {
  args: {
    source: 'transcribed_cloud',
    body: 'Cloud-routed transcription used for this answer because the auditee opted in to cloud ASR for this engagement.',
  },
};

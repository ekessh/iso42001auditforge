// SPDX-License-Identifier: BUSL-1.1
import type { Meta, StoryObj } from '@storybook/react';

import { AuditorAvatar } from '../src/domain/AuditorAvatar';

const meta: Meta<typeof AuditorAvatar> = {
  title: 'Domain/AuditorAvatar',
  component: AuditorAvatar,
  tags: ['autodocs'],
};
export default meta;

type Story = StoryObj<typeof AuditorAvatar>;

export const Roles: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-3">
      <AuditorAvatar name="Mariana Costa" role="lead-auditor" />
      <AuditorAvatar name="Hiroshi Tanaka" role="team-auditor" />
      <AuditorAvatar name="Aisha Patel" role="technical-expert" />
      <AuditorAvatar name="Liam O'Brien" role="audit-manager" />
      <AuditorAvatar name="Sara Voss" role="peer-reviewer" />
      <AuditorAvatar name="Idris Adisa" role="accreditation-auditor" />
      <AuditorAvatar name="Auditee Org" role="auditee" />
    </div>
  ),
};

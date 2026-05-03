// SPDX-License-Identifier: BUSL-1.1
import type { Meta, StoryObj } from '@storybook/react';

import { ClauseRef, ControlRef, CrossFrameworkBadge } from '../src/domain/ClauseRef';

const meta: Meta<typeof ClauseRef> = {
  title: 'Domain/References',
  component: ClauseRef,
  tags: ['autodocs'],
};
export default meta;

type Story = StoryObj<typeof ClauseRef>;

export const Composite: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-2">
      <ClauseRef clause="6.1.4" title="AI risk treatment" />
      <ClauseRef clause="9.1" title="Monitoring, measurement, analysis and evaluation" href="#" />
      <ControlRef control="5.4" title="Impact assessment" />
      <ControlRef control="6.2.5" title="AI system robustness" />
      <CrossFrameworkBadge framework="iso42001" reference="6.1.4" />
      <CrossFrameworkBadge framework="eu-ai-act" reference="Art. 9" />
      <CrossFrameworkBadge framework="nist-ai-rmf" reference="MAP-2.3" />
      <CrossFrameworkBadge framework="iso27001" reference="A.5.1" />
    </div>
  ),
};

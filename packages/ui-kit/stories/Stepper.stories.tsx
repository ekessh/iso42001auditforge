// SPDX-License-Identifier: BUSL-1.1
import type { Meta, StoryObj } from '@storybook/react';

import { Stepper } from '../src/components/Stepper';

const meta: Meta<typeof Stepper> = { title: 'Primitives/Stepper', component: Stepper, tags: ['autodocs'] };
export default meta;

const steps = [
  { id: '1', label: 'Programme', description: 'Calc man-days' },
  { id: '2', label: 'Plan', description: 'Sessions' },
  { id: '3', label: 'Stage 1', description: 'Readiness' },
  { id: '4', label: 'Stage 2', description: 'On-site' },
  { id: '5', label: 'Report', description: 'Issuance' },
];

export const Horizontal: StoryObj<typeof Stepper> = {
  render: () => (
    <div className="w-[680px]">
      <Stepper steps={steps} current={2} />
    </div>
  ),
};

export const Vertical: StoryObj<typeof Stepper> = {
  render: () => <Stepper steps={steps} current={3} orientation="vertical" />,
};

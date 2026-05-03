// SPDX-License-Identifier: BUSL-1.1
import type { Meta, StoryObj } from '@storybook/react';
import * as React from 'react';

import { RiskIndicator } from './RiskIndicator';

const meta: Meta<typeof RiskIndicator> = {
  title: 'Dashboards/RiskIndicator',
  component: RiskIndicator,
  parameters: { layout: 'centered' },
  tags: ['autodocs'],
};
export default meta;

type Story = StoryObj<typeof RiskIndicator>;

export const OnTrack: Story = { args: { risk: 'on_track' } };
export const CoverageGap: Story = { args: { risk: 'coverage_gap' } };
export const TimeOverrun: Story = { args: { risk: 'time_overrun' } };

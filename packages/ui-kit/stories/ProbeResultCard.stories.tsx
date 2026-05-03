// SPDX-License-Identifier: BUSL-1.1
import type { Meta, StoryObj } from '@storybook/react';

import { ProbeResultCard } from '../src/domain/ProbeResultCard';

const meta: Meta<typeof ProbeResultCard> = {
  title: 'Domain/ProbeResultCard',
  component: ProbeResultCard,
  tags: ['autodocs'],
};
export default meta;

type Story = StoryObj<typeof ProbeResultCard>;

export const Pass: Story = {
  args: {
    probeId: 'P-INJ-01',
    probeName: 'Direct prompt injection — Lakera-style suite',
    category: 'Injection',
    score: 87,
    pass: true,
    mode: 'live',
    duration: '4.2s',
    cost: '$0.04',
    llmBackend: 'local',
    description: '52 prompts evaluated against the deployed Vertex endpoint. 5 borderline refusals, 0 leaks.',
  },
};

export const Fail: Story = {
  args: {
    probeId: 'P-LEAK-01',
    probeName: 'PII leakage — seeded canary',
    category: 'Leakage',
    score: 42,
    pass: false,
    mode: 'replay',
    duration: '11.8s',
    llmBackend: 'cloud',
    description: '3 of 50 outputs reproduced seeded PII canaries.',
  },
};

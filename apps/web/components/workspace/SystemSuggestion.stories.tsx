// SPDX-License-Identifier: BUSL-1.1
import type { Meta, StoryObj } from '@storybook/react';
import * as React from 'react';

import { buildWorkspaceMock } from '@/lib/mocks/workspace-mock';

import { SystemSuggestion } from './SystemSuggestion';

const mock = buildWorkspaceMock();
const baseSuggestion = mock.messages.find((m) => m.kind === 'system_suggestion' && !m.reasoningTrace);
const reasoningSuggestion = mock.messages.find((m) => m.kind === 'system_suggestion' && !!m.reasoningTrace);

if (!baseSuggestion || baseSuggestion.kind !== 'system_suggestion') {
  throw new Error('mock fixture missing baseline system_suggestion');
}
if (!reasoningSuggestion || reasoningSuggestion.kind !== 'system_suggestion') {
  throw new Error('mock fixture missing reasoning-trace system_suggestion');
}

const noop = () => undefined;

const meta: Meta<typeof SystemSuggestion> = {
  title: 'Workspace/SystemSuggestion',
  component: SystemSuggestion,
  parameters: { layout: 'centered' },
  tags: ['autodocs'],
  args: {
    id: baseSuggestion.id,
    index: 0,
    label: baseSuggestion.label,
    body: baseSuggestion.body,
    provenance: baseSuggestion.provenance,
    rationale: baseSuggestion.rationale,
    modelBadge: baseSuggestion.modelBadge,
    whyOpen: false,
    reasoningOpen: false,
    onWhyToggle: noop,
    onReasoningToggle: noop,
    onAccept: noop,
    onEdit: noop,
    onSkip: noop,
  },
  decorators: [
    (Story) => (
      <div style={{ width: 540 }}>
        <Story />
      </div>
    ),
  ],
};

export default meta;

type Story = StoryObj<typeof SystemSuggestion>;

export const Default: Story = {};

export const WithReasoningTrace: Story = {
  args: {
    id: reasoningSuggestion.id,
    index: 1,
    label: reasoningSuggestion.label,
    body: reasoningSuggestion.body,
    provenance: reasoningSuggestion.provenance,
    rationale: reasoningSuggestion.rationale,
    reasoningTrace: reasoningSuggestion.reasoningTrace,
    modelBadge: reasoningSuggestion.modelBadge,
    reasoningOpen: true,
  },
};

export const WithProvenanceLinks: Story = {
  args: {
    provenance: [
      { id: 'A.7.4', label: 'A.7.4 Quality of data', kind: 'clause', href: '#A.7.4' },
      { id: 'Q-A7-004', label: 'Library Q-A7-004 v3', kind: 'library', href: '#Q-A7-004' },
      { id: 'C-1421-04', label: 'Claim C-1421-04', kind: 'claim', href: '#C-1421-04' },
      { id: 'profile-rag', label: 'RAG profile', kind: 'profile' },
    ],
    whyOpen: true,
  },
};

export const Skipped: Story = {
  args: {
    label: 'System suggestion (skipped)',
    body: 'Auditor skipped this suggestion at 14:18; the engine will not re-emit unless evidence shifts.',
    modelBadge: 'Llama 3.1 8B (local)',
  },
  decorators: [
    (Story) => (
      <div style={{ width: 540, opacity: 0.55 }} aria-label="Skipped suggestion preview">
        <Story />
      </div>
    ),
  ],
};

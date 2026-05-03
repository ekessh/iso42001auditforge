// SPDX-License-Identifier: BUSL-1.1
import type { Meta, StoryObj } from '@storybook/react';
import * as React from 'react';

import type { ComposerMode } from '@/lib/store/workspace-store';

import { Composer, type ComposerProps } from './Composer';

/**
 * Stateful wrapper so stories show realistic interactions (mode switch,
 * recording toggle, draft typing) without coupling to the Zustand store.
 */
function StatefulComposer(initial: Partial<ComposerProps>) {
  const [mode, setMode] = React.useState<ComposerMode>(initial.mode ?? 'question');
  const [draft, setDraft] = React.useState(initial.draft ?? '');
  const [recording, setRecording] = React.useState(initial.isRecording ?? false);
  const [processing, setProcessing] = React.useState(initial.isProcessing ?? false);
  return (
    <Composer
      mode={mode}
      onModeChange={setMode}
      draft={draft}
      onDraftChange={setDraft}
      onSend={() => {
        setProcessing(true);
        window.setTimeout(() => setProcessing(false), 800);
      }}
      isRecording={recording}
      onToggleRecording={() => setRecording((r) => !r)}
      onAttach={() => undefined}
      isProcessing={processing}
      latencyMs={initial.latencyMs ?? 1840}
    />
  );
}

const meta: Meta<typeof Composer> = {
  title: 'Workspace/Composer',
  component: Composer,
  parameters: { layout: 'fullscreen' },
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <div style={{ width: '100%', maxWidth: 960 }} className="bg-background">
        <Story />
      </div>
    ),
  ],
};
export default meta;

type Story = StoryObj<typeof Composer>;

export const QuestionMode: Story = {
  render: () => <StatefulComposer mode="question" draft="What controls govern cohort selection?" />,
};

export const LiveInterviewMode: Story = {
  render: () => <StatefulComposer mode="live_interview" isRecording />,
};

export const NoteMode: Story = {
  render: () => (
    <StatefulComposer
      mode="note"
      draft="Auditor working note: revisit lineage verification in A.7 follow-up."
    />
  ),
};

export const Processing: Story = {
  render: () => <StatefulComposer mode="question" draft="Submitted; awaiting attribution…" isProcessing />,
};

// SPDX-License-Identifier: BUSL-1.1
import type { Decorator, Meta, StoryObj } from '@storybook/react';
import * as React from 'react';

import { buildWorkspaceMock } from '@/lib/mocks/workspace-mock';
import { useWorkspaceStore } from '@/lib/store/workspace-store';

import { ChatStream } from './ChatStream';

const mock = buildWorkspaceMock();

/**
 * Hydrates the workspace Zustand store with deterministic state so the
 * "Why this?" / "Show reasoning" disclosures render in a known position.
 * This avoids stories sharing transient state across renders inside the
 * Storybook canvas.
 */
const withHydratedStore: Decorator = (Story) => {
  React.useEffect(() => {
    const init = useWorkspaceStore.getState();
    init.setMessages(mock.messages);
    init.setFindings(mock.candidateFindings);
    init.setContext(mock.context);
    init.setRightTab('findings');
    // Reset disclosure state so the panel is closed on every story mount.
    useWorkspaceStore.setState({ whyOpen: {}, reasoningOpen: {} });
  }, []);
  return <Story />;
};

const meta: Meta<typeof ChatStream> = {
  title: 'Workspace/ChatStream',
  component: ChatStream,
  parameters: { layout: 'fullscreen' },
  tags: ['autodocs'],
  decorators: [
    withHydratedStore,
    (Story) => (
      <div
        className="bg-background"
        style={{ height: 720, width: '100%', maxWidth: 920, display: 'flex', flexDirection: 'column' }}
      >
        <Story />
      </div>
    ),
  ],
  args: {
    onAcceptSuggestion: () => undefined,
    onEditSuggestion: () => undefined,
    onSkipSuggestion: () => undefined,
    onInjectFollowup: () => undefined,
  },
};
export default meta;

type Story = StoryObj<typeof ChatStream>;

export const SixTurnConversation: Story = {
  args: { messages: mock.messages },
};

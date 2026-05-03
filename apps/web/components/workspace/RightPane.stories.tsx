// SPDX-License-Identifier: BUSL-1.1
import type { Decorator, Meta, StoryObj } from '@storybook/react';
import * as React from 'react';

import { buildWorkspaceMock } from '@/lib/mocks/workspace-mock';
import { useWorkspaceStore, type RightPaneTab } from '@/lib/store/workspace-store';

import { RightPane } from './RightPane';

const mock = buildWorkspaceMock();

/**
 * Hydrates the Zustand store with deterministic findings, claims, coverage,
 * and a chosen right-pane tab so each story focuses on a single tab without
 * transient state leaking between canvases.
 */
function makeDecorator(tab: RightPaneTab): Decorator {
  return (Story) => {
    React.useEffect(() => {
      const init = useWorkspaceStore.getState();
      init.setFindings(mock.candidateFindings);
      init.setMessages(mock.messages);
      init.setContext(mock.context);
      init.setRightTab(tab);
    }, []);
    return <Story />;
  };
}

const meta: Meta<typeof RightPane> = {
  title: 'Workspace/RightPane',
  component: RightPane,
  parameters: { layout: 'fullscreen' },
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <div
        className="bg-background"
        style={{ height: 720, width: 460, display: 'flex', flexDirection: 'column' }}
      >
        <Story />
      </div>
    ),
  ],
};
export default meta;

type Story = StoryObj<typeof RightPane>;

/**
 * Component-style renderer so the `cardRefs` mutable ref is created via
 * `useRef` (the supported pattern) rather than `React.createRef` outside a
 * component, which would cause React 19 to warn about cross-render mutation.
 */
function PaneRender({ mode }: { mode: 'audit' | 'readiness' }) {
  const cardRefs = React.useRef<Array<HTMLElement | null>>([]);
  return (
    <RightPane
      mode={mode}
      findings={mock.candidateFindings}
      claims={mock.claims}
      coverageArea={mock.coverageArea}
      cardRefs={cardRefs}
    />
  );
}

export const CandidateFindingsTab: Story = {
  decorators: [makeDecorator('findings')],
  render: () => <PaneRender mode="audit" />,
};

export const CoverageTab: Story = {
  decorators: [makeDecorator('coverage')],
  render: () => <PaneRender mode="audit" />,
};

export const ClaimsTabView: Story = {
  decorators: [makeDecorator('claims')],
  render: () => <PaneRender mode="audit" />,
};

export const ParkedTabView: Story = {
  decorators: [makeDecorator('parked')],
  render: () => <PaneRender mode="audit" />,
};

export const ReadinessMode: Story = {
  decorators: [makeDecorator('findings')],
  render: () => <PaneRender mode="readiness" />,
};

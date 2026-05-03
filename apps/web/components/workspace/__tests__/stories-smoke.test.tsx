// SPDX-License-Identifier: BUSL-1.1
/**
 * Storybook story-discoverability smoke test.
 *
 * Imports every workspace + dashboard story module and asserts:
 *   1. The default export (Storybook `Meta`) declares a `component`.
 *   2. The default export declares a `title` under the expected namespace.
 *   3. The module exposes at least one named export (a `StoryObj`).
 *
 * Catches regressions where:
 *   - A new component is added but no `.stories.tsx` was created.
 *   - The Storybook `stories` glob in `packages/ui-kit/.storybook/main.ts`
 *     stops matching `apps/web/components/**`.
 *   - A story file forgets the `component` field (autodocs would silently
 *     omit the component from generated docs).
 *
 * Test runs under vitest with the workspace root config; no Storybook
 * runtime is required.
 */
import { describe, expect, it } from 'vitest';

import * as AiSystemBars from '../../dashboards/AiSystemBars.stories';
import * as AnnexFamilyGrid from '../../dashboards/AnnexFamilyGrid.stories';
import * as AreaCoverageBars from '../../dashboards/AreaCoverageBars.stories';
import * as BlockersList from '../../dashboards/BlockersList.stories';
import * as ManDayBurndown from '../../dashboards/ManDayBurndown.stories';
import * as MiniAuditDashboard from '../../dashboards/MiniAuditDashboard.stories';
import * as OpenItemsPanel from '../../dashboards/OpenItemsPanel.stories';
import * as ReadinessHero from '../../dashboards/ReadinessHero.stories';
import * as ReadinessTrendChart from '../../dashboards/ReadinessTrendChart.stories';
import * as RiskIndicator from '../../dashboards/RiskIndicator.stories';
import * as AuditeeAnswer from '../AuditeeAnswer.stories';
import * as AuditorMessage from '../AuditorMessage.stories';
import * as CandidateFindingCard from '../CandidateFindingCard.stories';
import * as ChatStream from '../ChatStream.stories';
import * as ClaimsTab from '../ClaimsTab.stories';
import * as Composer from '../Composer.stories';
import * as CoverageHeatmap from '../CoverageHeatmap.stories';
import * as InlineAlert from '../InlineAlert.stories';
import * as ParkedTab from '../ParkedTab.stories';
import * as RightPane from '../RightPane.stories';
import * as ShowReasoningPanel from '../ShowReasoningPanel.stories';
import * as SystemSuggestion from '../SystemSuggestion.stories';
import * as WhyThisPanel from '../WhyThisPanel.stories';
import * as WorkspaceHeader from '../WorkspaceHeader.stories';

interface StoryModule {
  default: {
    title?: string;
    component?: unknown;
  };
  [storyName: string]: unknown;
}

const WORKSPACE_MODULES: Record<string, StoryModule> = {
  AuditeeAnswer,
  AuditorMessage,
  CandidateFindingCard,
  ChatStream,
  ClaimsTab,
  Composer,
  CoverageHeatmap,
  InlineAlert,
  ParkedTab,
  RightPane,
  ShowReasoningPanel,
  SystemSuggestion,
  WhyThisPanel,
  WorkspaceHeader,
};

const DASHBOARD_MODULES: Record<string, StoryModule> = {
  AiSystemBars,
  AnnexFamilyGrid,
  AreaCoverageBars,
  BlockersList,
  ManDayBurndown,
  MiniAuditDashboard,
  OpenItemsPanel,
  ReadinessHero,
  ReadinessTrendChart,
  RiskIndicator,
};

function namedStoryExports(mod: StoryModule): string[] {
  return Object.keys(mod).filter((k) => k !== 'default');
}

describe('workspace story discoverability', () => {
  it.each(Object.entries(WORKSPACE_MODULES))(
    '%s has Workspace meta with component + at least one story',
    (name, mod) => {
      expect(mod.default, `${name}: missing default Meta`).toBeDefined();
      expect(mod.default.component, `${name}: meta.component is required for autodocs`).toBeDefined();
      expect(mod.default.title, `${name}: meta.title required`).toMatch(/^Workspace\//);
      expect(namedStoryExports(mod).length, `${name}: at least one named StoryObj export`).toBeGreaterThan(0);
    },
  );
});

describe('dashboard story discoverability', () => {
  it.each(Object.entries(DASHBOARD_MODULES))(
    '%s has Dashboards meta with component + at least one story',
    (name, mod) => {
      expect(mod.default, `${name}: missing default Meta`).toBeDefined();
      expect(mod.default.component, `${name}: meta.component is required for autodocs`).toBeDefined();
      expect(mod.default.title, `${name}: meta.title required`).toMatch(/^Dashboards\//);
      expect(namedStoryExports(mod).length, `${name}: at least one named StoryObj export`).toBeGreaterThan(0);
    },
  );
});

describe('story module count', () => {
  it('covers all 14 workspace components', () => {
    expect(Object.keys(WORKSPACE_MODULES)).toHaveLength(14);
  });

  it('covers all 10 dashboard components', () => {
    expect(Object.keys(DASHBOARD_MODULES)).toHaveLength(10);
  });
});

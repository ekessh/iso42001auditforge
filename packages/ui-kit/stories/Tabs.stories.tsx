// SPDX-License-Identifier: BUSL-1.1
import type { Meta, StoryObj } from '@storybook/react';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '../src/components/Tabs';

const meta: Meta = { title: 'Primitives/Tabs', tags: ['autodocs'] };
export default meta;

export const EngagementTabs: StoryObj = {
  render: () => (
    <Tabs defaultValue="overview" className="w-[600px]">
      <TabsList>
        <TabsTrigger value="overview">Overview</TabsTrigger>
        <TabsTrigger value="plan" badge="3">Plan</TabsTrigger>
        <TabsTrigger value="papers" badge="42">Working papers</TabsTrigger>
        <TabsTrigger value="findings" badge="7">Findings</TabsTrigger>
        <TabsTrigger value="probes">Probes</TabsTrigger>
        <TabsTrigger value="trail">Audit trail</TabsTrigger>
      </TabsList>
      <TabsContent value="overview">Engagement overview surface.</TabsContent>
      <TabsContent value="plan">Plan content.</TabsContent>
      <TabsContent value="papers">Working papers.</TabsContent>
      <TabsContent value="findings">Findings.</TabsContent>
      <TabsContent value="probes">Probes.</TabsContent>
      <TabsContent value="trail">Audit trail.</TabsContent>
    </Tabs>
  ),
};

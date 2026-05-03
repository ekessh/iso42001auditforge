// SPDX-License-Identifier: BUSL-1.1
import type { Meta, StoryObj } from '@storybook/react';

import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../src/components/Card';
import { Button } from '../src/components/Button';

const meta: Meta<typeof Card> = { title: 'Primitives/Card', component: Card, tags: ['autodocs'] };
export default meta;

type Story = StoryObj<typeof Card>;

export const Default: Story = {
  render: () => (
    <Card className="w-80">
      <CardHeader>
        <CardTitle>Acme Robotics — Stage 2</CardTitle>
        <CardDescription>EU AI Act high-risk · 12 AI systems · 4 sites</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">
          Closing meeting scheduled for Apr 24. Three working papers awaiting peer review.
        </p>
      </CardContent>
      <CardFooter>
        <span className="text-2xs text-muted-foreground">Last activity 14m ago</span>
        <Button size="sm">Open</Button>
      </CardFooter>
    </Card>
  ),
};

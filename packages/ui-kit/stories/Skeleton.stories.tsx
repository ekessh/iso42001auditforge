// SPDX-License-Identifier: BUSL-1.1
import type { Meta, StoryObj } from '@storybook/react';

import { Skeleton } from '../src/components/Skeleton';

const meta: Meta<typeof Skeleton> = { title: 'Primitives/Skeleton', component: Skeleton, tags: ['autodocs'] };
export default meta;

export const Variants: StoryObj<typeof Skeleton> = {
  render: () => (
    <div className="flex w-72 flex-col gap-3">
      <div className="flex items-center gap-3">
        <Skeleton shape="circle" className="size-8" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-3 w-3/5" />
          <Skeleton className="h-2 w-2/5" />
        </div>
      </div>
      <Skeleton shape="rect" className="h-24" />
      <Skeleton shape="pill" className="h-5 w-24" />
    </div>
  ),
};

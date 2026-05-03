// SPDX-License-Identifier: BUSL-1.1
'use client';

import * as React from 'react';
import {
  PanelGroup,
  Panel,
  PanelResizeHandle,
  type PanelGroupProps,
} from 'react-resizable-panels';

import { cn } from '../lib/cn';

export const ResizablePanelGroup = ({
  className,
  ...rest
}: PanelGroupProps) => <PanelGroup className={cn('flex h-full w-full', className)} {...rest} />;

export const ResizablePanel = Panel;

export const ResizableHandle = ({
  withHandle = true,
  className,
  ...rest
}: React.ComponentProps<typeof PanelResizeHandle> & { withHandle?: boolean }) => (
  <PanelResizeHandle
    className={cn(
      'relative flex w-px items-center justify-center bg-border data-[resize-handle-state="hover"]:bg-ring data-[resize-handle-state="drag"]:bg-ring',
      'data-[panel-group-direction=vertical]:h-px data-[panel-group-direction=vertical]:w-full',
      'after:absolute after:inset-y-0 after:left-1/2 after:w-2 after:-translate-x-1/2 after:content-[""]',
      className,
    )}
    {...rest}
  >
    {withHandle ? (
      <div className="z-10 flex h-6 w-2 items-center justify-center rounded-sm border border-border bg-card">
        <span className="size-1 rounded-full bg-muted-foreground/60" aria-hidden />
      </div>
    ) : null}
  </PanelResizeHandle>
);

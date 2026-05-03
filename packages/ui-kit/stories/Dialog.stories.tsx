// SPDX-License-Identifier: BUSL-1.1
import type { Meta, StoryObj } from '@storybook/react';
import * as React from 'react';

import { Button } from '../src/components/Button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../src/components/Dialog';

const meta: Meta = { title: 'Primitives/Dialog', tags: ['autodocs'] };
export default meta;

export const Default: StoryObj = {
  render: () => (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="primary">Sign engagement</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Sign Stage 2 engagement</DialogTitle>
          <DialogDescription>
            Hardware-backed signature will be requested via WebAuthn. The audit file freeze cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <div className="px-4 pb-3 text-sm">
          You are about to commit <code className="font-mono">3,142</code> ledger events to the engagement archive.
        </div>
        <DialogFooter>
          <Button variant="ghost">Cancel</Button>
          <Button variant="primary">Authorize signature</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  ),
};

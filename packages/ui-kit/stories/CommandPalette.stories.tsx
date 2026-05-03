// SPDX-License-Identifier: BUSL-1.1
import type { Meta, StoryObj } from '@storybook/react';
import { CalendarDays, FlaskConical, Folder, Users } from 'lucide-react';
import * as React from 'react';

import { Button } from '../src/components/Button';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '../src/components/Command';
import { useCommandPalette } from '../src/hooks/useCommandPalette';

const meta: Meta = { title: 'Primitives/CommandPalette' };
export default meta;

export const Cmdk: StoryObj = {
  render: () => {
    const { open, setOpen } = useCommandPalette();
    return (
      <div className="flex flex-col items-start gap-2">
        <Button onClick={() => setOpen(true)}>Open palette (⌘K)</Button>
        <CommandDialog open={open} onOpenChange={setOpen}>
          <CommandInput placeholder="Search clients, engagements, clauses, probes…" />
          <CommandList>
            <CommandEmpty>No results.</CommandEmpty>
            <CommandGroup heading="Jump to">
              <CommandItem shortcut="G C">
                <Users /> Clients
              </CommandItem>
              <CommandItem shortcut="G E">
                <Folder /> Engagements
              </CommandItem>
              <CommandItem shortcut="G P">
                <FlaskConical /> Probes
              </CommandItem>
              <CommandItem shortcut="G K">
                <CalendarDays /> Calendar
              </CommandItem>
            </CommandGroup>
            <CommandSeparator />
            <CommandGroup heading="Recent engagements">
              <CommandItem>Acme Robotics — Stage 2</CommandItem>
              <CommandItem>Helios Health — Surveillance 1</CommandItem>
              <CommandItem>Northwind Bank — Recertification</CommandItem>
            </CommandGroup>
          </CommandList>
        </CommandDialog>
      </div>
    );
  },
};

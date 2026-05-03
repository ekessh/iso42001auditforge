// SPDX-License-Identifier: BUSL-1.1
'use client';

import * as React from 'react';

import { useHotkey } from './useHotkey';

interface CommandPaletteCtx {
  open: boolean;
  setOpen: (open: boolean) => void;
  toggle: () => void;
}

const Ctx = React.createContext<CommandPaletteCtx | null>(null);

export const CommandPaletteProvider = ({ children }: { children: React.ReactNode }) => {
  const [open, setOpen] = React.useState(false);
  const value = React.useMemo<CommandPaletteCtx>(
    () => ({ open, setOpen, toggle: () => setOpen((v) => !v) }),
    [open],
  );
  useHotkey('mod+k', () => setOpen((v) => !v), { ignoreInInputs: false });
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
};

export const useCommandPalette = (): CommandPaletteCtx => {
  const ctx = React.useContext(Ctx);
  if (!ctx) {
    throw new Error('useCommandPalette must be used inside <CommandPaletteProvider>.');
  }
  return ctx;
};

// SPDX-License-Identifier: BUSL-1.1
'use client';

import { create } from 'zustand';

/** Cross-cutting bus for actions invoked from the palette (or anywhere). */
export type PaletteAction =
  | 'new-engagement'
  | 'raise-nc'
  | 'run-probe'
  | 'new-client'
  | 'upload-trace';

interface PaletteState {
  open: boolean;
  pendingAction: PaletteAction | null;
  setOpen: (open: boolean) => void;
  toggle: () => void;
  trigger: (action: PaletteAction) => void;
  consumeAction: () => PaletteAction | null;
}

export const usePalette = create<PaletteState>((set, get) => ({
  open: false,
  pendingAction: null,
  setOpen: (open) => set({ open }),
  toggle: () => set((s) => ({ open: !s.open })),
  trigger: (action) => set({ open: false, pendingAction: action }),
  consumeAction: () => {
    const a = get().pendingAction;
    if (a !== null) set({ pendingAction: null });
    return a;
  },
}));

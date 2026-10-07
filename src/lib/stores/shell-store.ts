import { create } from "zustand";

interface ShellState {
  /** Desktop sidebar collapsed to icons. */
  collapsed: boolean;
  /** Mobile/tablet drawer. */
  mobileNavOpen: boolean;
  paletteOpen: boolean;
  /** Reference date chosen in the topbar date picker (ISO yyyy-mm-dd); null means "today". */
  asOf: string | null;
  toggleCollapsed: () => void;
  setMobileNavOpen: (open: boolean) => void;
  setPaletteOpen: (open: boolean) => void;
  setAsOf: (date: string | null) => void;
}

export const useShellStore = create<ShellState>((set) => ({
  collapsed: false,
  mobileNavOpen: false,
  paletteOpen: false,
  asOf: null,
  toggleCollapsed: () => set((s) => ({ collapsed: !s.collapsed })),
  setMobileNavOpen: (mobileNavOpen) => set({ mobileNavOpen }),
  setPaletteOpen: (paletteOpen) => set({ paletteOpen }),
  setAsOf: (asOf) => set({ asOf }),
}));

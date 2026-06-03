"use client";

import { createContext, useContext } from "react";

/** Lets inner panels (e.g. KPI cards) drive the AppShell view-switcher, ARIA, and alert filter. */
export interface NavApi {
  navigate: (viewId: string) => void;
  openAria: () => void;
  alertFilter: string | null;
  setAlertFilter: (level: string | null) => void;
}

const noop: NavApi = { navigate: () => {}, openAria: () => {}, alertFilter: null, setAlertFilter: () => {} };

export const NavContext = createContext<NavApi>(noop);

export function useNav(): NavApi {
  return useContext(NavContext);
}

"use client";

// context/ThemeContext.tsx — application-level theme wrapper around next-themes.
// Exposes `mounted` so consumers can avoid hydration mismatches.

import { createContext, useContext, useSyncExternalStore, type ReactNode } from "react";
import { useTheme } from "next-themes";

type ThemeValue = {
  theme: "light" | "dark" | "system";
  resolvedTheme: "light" | "dark";
  setTheme: (t: "light" | "dark" | "system") => void;
  toggle: () => void;
  mounted: boolean;
};

const ThemeContext = createContext<ThemeValue | undefined>(undefined);

// External store for `mounted` — flips to true after first client paint.
// Using useSyncExternalStore avoids the set-state-in-effect lint rule.
let mountedFlag = false;
const mountedListeners = new Set<() => void>();

function subscribeMounted(cb: () => void): () => void {
  mountedListeners.add(cb);
  // If we're on the client and haven't flipped yet, schedule it.
  if (typeof window !== "undefined" && !mountedFlag) {
    requestAnimationFrame(() => {
      mountedFlag = true;
      mountedListeners.forEach((l) => l());
    });
  }
  return () => mountedListeners.delete(cb);
}

function getMountedClient(): boolean { return mountedFlag; }
function getMountedServer(): boolean { return false; }

export function ThemeProvider({ children }: { children: ReactNode }) {
  const { theme, resolvedTheme, setTheme } = useTheme();
  const mounted = useSyncExternalStore(subscribeMounted, getMountedClient, getMountedServer);

  const value: ThemeValue = {
    theme: (theme as ThemeValue["theme"]) ?? "system",
    resolvedTheme: (resolvedTheme as ThemeValue["resolvedTheme"]) ?? "dark",
    setTheme,
    toggle: () => setTheme(resolvedTheme === "dark" ? "light" : "dark"),
    mounted,
  };

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useAppTheme(): ThemeValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useAppTheme must be used inside <ThemeProvider>");
  return ctx;
}

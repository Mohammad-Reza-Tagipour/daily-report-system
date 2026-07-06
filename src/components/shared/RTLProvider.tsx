"use client";

// components/shared/RTLProvider.tsx — sets `dir=rtl` and `lang=fa` on <html>
// and keeps them in sync. Pair with a Persian font in the root layout.

import { useEffect, type ReactNode } from "react";

export function RTLProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    const html = document.documentElement;
    html.setAttribute("dir", "rtl");
    html.setAttribute("lang", "fa");
    return () => {
      html.removeAttribute("dir");
      html.removeAttribute("lang");
    };
  }, []);

  return <>{children}</>;
}

"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import { type ReactNode } from "react";
import { ThemeProvider } from "@/context/ThemeContext";
import { AuthProvider } from "@/context/AuthContext";
import { RTLProvider } from "@/components/shared/RTLProvider";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <NextThemesProvider attribute="class" defaultTheme="dark" enableSystem disableTransitionOnChange>
      <ThemeProvider>
        <AuthProvider>
          <RTLProvider>{children}</RTLProvider>
        </AuthProvider>
      </ThemeProvider>
    </NextThemesProvider>
  );
}

"use client";

// components/shared/ThemeToggle.tsx — animated glassmorphism sun/moon toggle.
// Renders a neutral placeholder on the server to avoid hydration mismatch,
// then shows the real icon after mount.

import { Moon, Sun } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useAppTheme } from "@/context/ThemeContext";
import { cn } from "@/lib/utils";

export function ThemeToggle({ className }: { className?: string }) {
  const { resolvedTheme, toggle, mounted } = useAppTheme();

  // On the server (before mount), render a placeholder with no theme-dependent
  // attributes. On the client after mount, render the real toggle.
  if (!mounted) {
    return (
      <button
        type="button"
        className={cn(
          "relative inline-flex h-10 w-10 items-center justify-center rounded-xl",
          "glass border border-white/20 dark:border-white/10",
          "text-foreground/80",
          "transition-all hover:scale-105 active:scale-95",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60",
          className
        )}
        aria-label="تغییر تم"
      >
        <Sun className="h-5 w-5 opacity-0" />
      </button>
    );
  }

  const isDark = resolvedTheme === "dark";

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={isDark ? "روشن" : "تاریک"}
      title={isDark ? "حالت روشن" : "حالت تاریک"}
      suppressHydrationWarning
      className={cn(
        "relative inline-flex h-10 w-10 items-center justify-center rounded-xl",
        "glass border border-white/20 dark:border-white/10",
        "text-foreground/80 hover:text-foreground",
        "transition-all hover:scale-105 active:scale-95",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60",
        className
      )}
    >
      <AnimatePresence mode="wait">
        <motion.span
          key={isDark ? "moon" : "sun"}
          initial={{ rotate: -90, opacity: 0, scale: 0.6 }}
          animate={{ rotate: 0, opacity: 1, scale: 1 }}
          exit={{ rotate: 90, opacity: 0, scale: 0.6 }}
          transition={{ type: "spring", stiffness: 220, damping: 18 }}
          className="absolute inset-0 flex items-center justify-center"
        >
          {isDark ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
        </motion.span>
      </AnimatePresence>
    </button>
  );
}

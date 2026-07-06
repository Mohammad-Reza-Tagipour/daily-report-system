"use client";

// components/ui/glass-button.tsx

import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const glassButtonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-xl text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 disabled:opacity-50 disabled:pointer-events-none active:scale-[0.97] whitespace-nowrap",
  {
    variants: {
      variant: {
        primary: "bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg shadow-primary/25",
        glass: "glass glass-border text-foreground hover:bg-white/70 dark:hover:bg-white/10",
        ghost: "text-foreground/80 hover:text-foreground hover:bg-foreground/5",
        outline: "border border-border bg-transparent hover:bg-foreground/5 text-foreground",
        destructive: "bg-destructive text-white hover:bg-destructive/90 shadow-lg shadow-destructive/20",
      },
      size: {
        sm: "h-9 px-3 text-xs",
        md: "h-10 px-4",
        lg: "h-12 px-6 text-base",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: { variant: "glass", size: "md" },
  }
);

export interface GlassButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof glassButtonVariants> {}

export const GlassButton = forwardRef<HTMLButtonElement, GlassButtonProps>(
  ({ className, variant, size, ...props }, ref) => (
    <button
      ref={ref}
      className={cn(glassButtonVariants({ variant, size }), className)}
      {...props}
    />
  )
);
GlassButton.displayName = "GlassButton";

export { glassButtonVariants };

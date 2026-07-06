"use client";

// components/ui/glass-card.tsx — frosted-glass surface.

import { forwardRef, type HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export interface GlassCardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "strong" | "tint";
  glow?: boolean;
}

export const GlassCard = forwardRef<HTMLDivElement, GlassCardProps>(
  ({ className, variant = "default", glow = false, ...props }, ref) => {
    const surface =
      variant === "strong" ? "glass-strong" : variant === "tint" ? "glass-tint" : "glass";
    return (
      <div
        ref={ref}
        className={cn(surface, "glass-border rounded-2xl", glow && "shadow-glow", className)}
        {...props}
      />
    );
  }
);
GlassCard.displayName = "GlassCard";

export function GlassCardHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("p-5 pb-2", className)} {...props} />;
}
export function GlassCardTitle({ className, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className={cn("text-base font-semibold tracking-tight text-foreground/90", className)} {...props} />;
}
export function GlassCardDescription({ className, ...props }: HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn("text-sm text-muted-foreground", className)} {...props} />;
}
export function GlassCardContent({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("p-5 pt-2", className)} {...props} />;
}
export function GlassCardFooter({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex items-center gap-2 p-5 pt-0", className)} {...props} />;
}

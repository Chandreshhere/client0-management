"use client";

import { Slot } from "radix-ui";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * Pill buttons (reference: charcoal / white pills). Heights sit on the 8px grid: 32 / 40 / 48.
 * `primary` (cobalt) is the one accent action per view; `dark` is the strong neutral action.
 */
export type ButtonVariant = "primary" | "dark" | "secondary" | "ghost" | "soft" | "danger" | "glass";
export type ButtonSize = "sm" | "md" | "lg";

const base =
  "relative inline-flex select-none items-center justify-center gap-2 whitespace-nowrap rounded-full font-medium " +
  "transition-[background-color,color,box-shadow,transform] duration-200 ease-[var(--ease-out-quart)] " +
  "active:scale-[0.97] disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

const variants: Record<ButtonVariant, string> = {
  primary: "bg-primary text-white hover:bg-primary-hover",
  dark: "bg-charcoal text-white hover:bg-ink-2",
  secondary: "bg-surface text-ink shadow-[inset_0_0_0_1px_var(--color-line)] hover:shadow-[inset_0_0_0_1px_var(--color-line-strong)] hover:bg-canvas",
  ghost: "text-ink hover:bg-sunken",
  soft: "bg-sunken text-ink hover:bg-sunken-2",
  danger: "bg-danger text-white hover:brightness-95",
  glass: "bg-white/15 text-white shadow-[inset_0_0_0_1px_rgb(255_255_255/0.28)] hover:bg-white/25",
};

const sizes: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-xs [&_svg]:size-4",
  md: "h-10 px-4 text-sm [&_svg]:size-[18px]",
  lg: "h-12 px-6 text-[15px] [&_svg]:size-5",
};

export interface ButtonProps extends ComponentProps<"button"> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  asChild?: boolean;
  loading?: boolean;
  leading?: ReactNode;
  trailing?: ReactNode;
}

export function Button({ variant = "secondary", size = "md", asChild, loading, leading, trailing, className, children, disabled, ...props }: ButtonProps) {
  const Comp = asChild ? Slot.Root : "button";
  return (
    <Comp
      className={cn(base, variants[variant], sizes[size], className)}
      disabled={asChild ? undefined : disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {asChild ? (
        children
      ) : (
        <>
          {loading ? <Spinner /> : leading}
          {children}
          {trailing}
        </>
      )}
    </Comp>
  );
}

export function Spinner({ className }: { className?: string }) {
  return (
    <svg className={cn("size-4 animate-spin", className)} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

"use client";

import { Slot } from "radix-ui";
import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";
import { Tip } from "./tooltip";

/**
 * Circular icon buttons — the reference's white "↗" and "+" circles.
 * Always pass `label`: it becomes the accessible name (and the tooltip when `tooltip` is set).
 */
export type IconButtonVariant = "white" | "ghost" | "dark" | "primary" | "glass" | "soft" | "outline-light";
export type IconButtonSize = "sm" | "md" | "lg";

const variants: Record<IconButtonVariant, string> = {
  white: "bg-surface text-ink shadow-[inset_0_0_0_1px_var(--color-line)] hover:shadow-[inset_0_0_0_1px_var(--color-line-strong)] hover:bg-canvas",
  ghost: "text-ink-2 hover:bg-sunken hover:text-ink",
  dark: "bg-charcoal text-white hover:bg-ink-2",
  primary: "bg-primary text-white hover:bg-primary-hover",
  glass: "bg-white text-ink hover:bg-white/90",
  soft: "bg-sunken text-ink hover:bg-sunken-2",
  "outline-light": "text-white shadow-[inset_0_0_0_1px_rgb(255_255_255/0.4)] hover:bg-white/15",
};

const sizes: Record<IconButtonSize, string> = {
  sm: "size-8 [&_svg]:size-4",
  md: "size-10 [&_svg]:size-[18px]",
  lg: "size-12 [&_svg]:size-5",
};

export interface IconButtonProps extends ComponentProps<"button"> {
  label: string;
  variant?: IconButtonVariant;
  size?: IconButtonSize;
  tooltip?: boolean | "top" | "right" | "bottom" | "left";
  asChild?: boolean;
}

export function IconButton({ label, variant = "white", size = "md", tooltip, asChild, className, children, ...props }: IconButtonProps) {
  const Comp = asChild ? Slot.Root : "button";
  const btn = (
    <Comp
      aria-label={label}
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center rounded-full transition-[background-color,color,box-shadow,transform] duration-200",
        "active:scale-[0.94] disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
        variants[variant],
        sizes[size],
        className,
      )}
      {...(asChild ? {} : { type: props.type ?? "button" })}
      {...props}
    >
      {children}
    </Comp>
  );
  if (!tooltip) return btn;
  return (
    <Tip label={label} side={typeof tooltip === "string" ? tooltip : "bottom"}>
      {btn}
    </Tip>
  );
}

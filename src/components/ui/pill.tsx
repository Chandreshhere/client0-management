import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * Pills/chips. `instances` reproduces the reference's "2 instances" outline chip;
 * `condition` reproduces the light condition chips ("Nodal Tachycardia").
 */
export type PillTone = "neutral" | "outline" | "primary" | "dark" | "instances" | "instances-light" | "condition" | "white";

const tones: Record<PillTone, string> = {
  neutral: "bg-sunken text-ink-2",
  outline: "bg-transparent text-ink-2 shadow-[inset_0_0_0_1px_var(--color-line-strong)]",
  primary: "bg-primary-soft text-primary-ink",
  dark: "bg-charcoal text-white",
  white: "bg-surface text-ink shadow-[inset_0_0_0_1px_var(--color-line)]",
  instances: "bg-transparent text-muted shadow-[inset_0_0_0_1px_var(--color-line-strong)]",
  "instances-light": "bg-white/10 text-white/90 shadow-[inset_0_0_0_1px_rgb(255_255_255/0.32)]",
  condition: "bg-surface/70 text-ink-2 shadow-[inset_0_0_0_1px_var(--color-line)]",
};

export function Pill({
  tone = "neutral",
  size = "md",
  icon,
  className,
  children,
  ...props
}: ComponentProps<"span"> & { tone?: PillTone; size?: "sm" | "md"; icon?: ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full font-normal",
        size === "sm" ? "h-6 px-2.5 text-xs [&_svg]:size-3.5" : "h-8 px-3 text-xs [&_svg]:size-4",
        tones[tone],
        className,
      )}
      {...props}
    >
      {icon}
      {children}
    </span>
  );
}

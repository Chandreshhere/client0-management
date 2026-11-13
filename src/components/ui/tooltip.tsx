"use client";

import { Tooltip } from "radix-ui";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export const TooltipProvider = ({ children }: { children: ReactNode }) => (
  <Tooltip.Provider delayDuration={250} skipDelayDuration={400}>
    {children}
  </Tooltip.Provider>
);

/** Small charcoal tooltip. Wraps a single focusable child. */
export function Tip({
  label,
  children,
  side = "top",
  align = "center",
  shortcut,
  disabled,
}: {
  label: ReactNode;
  children: ReactNode;
  side?: "top" | "right" | "bottom" | "left";
  align?: "start" | "center" | "end";
  shortcut?: string;
  disabled?: boolean;
}) {
  if (disabled) return <>{children}</>;
  return (
    <Tooltip.Root>
      <Tooltip.Trigger asChild>{children}</Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Content
          side={side}
          align={align}
          sideOffset={8}
          className={cn("anim-pop z-[80] flex items-center gap-2 rounded-xl bg-charcoal px-3 py-1.5 text-xs text-white shadow-pop")}
        >
          {label}
          {shortcut ? <kbd className="rounded-md bg-white/15 px-1.5 font-mono text-[11px] text-white/80">{shortcut}</kbd> : null}
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}

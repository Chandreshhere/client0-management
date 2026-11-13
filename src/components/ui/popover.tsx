"use client";

import { Popover as P } from "radix-ui";
import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

export const Popover = P.Root;
export const PopoverTrigger = P.Trigger;
export const PopoverClose = P.Close;
export const PopoverAnchor = P.Anchor;

export function PopoverContent({ className, sideOffset = 8, align = "end", ...props }: ComponentProps<typeof P.Content>) {
  return (
    <P.Portal>
      <P.Content
        sideOffset={sideOffset}
        align={align}
        collisionPadding={16}
        className={cn("anim-pop z-[70] rounded-card bg-surface text-sm text-ink shadow-pop ring-1 ring-line outline-none", className)}
        {...props}
      />
    </P.Portal>
  );
}

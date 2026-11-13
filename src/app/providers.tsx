"use client";

import { MotionConfig } from "motion/react";
import type { ReactNode } from "react";
import { ToastProvider } from "@/components/ui/toast";
import { TooltipProvider } from "@/components/ui/tooltip";

/** App-wide client providers: reduced-motion aware springs, tooltips, toasts. Scrolling is native. */
export function Providers({ children }: { children: ReactNode }) {
  return (
    <MotionConfig reducedMotion="user">
      <TooltipProvider>
        <ToastProvider>{children}</ToastProvider>
      </TooltipProvider>
    </MotionConfig>
  );
}

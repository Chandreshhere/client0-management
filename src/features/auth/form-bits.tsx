import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/** Hairline "or" divider between the email form and alternative sign-in methods. */
export function AuthDivider({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("my-6 flex items-center gap-3 text-xs text-muted", className)}>
      <span className="h-px flex-1 bg-line" aria-hidden="true" />
      {children}
      <span className="h-px flex-1 bg-line" aria-hidden="true" />
    </div>
  );
}

/**
 * Move focus to the first field marked invalid once React has committed the error state.
 * Also catches controls the kit can't mark with aria-invalid (wrapped in data-error-anchor).
 */
export function focusFirstInvalid(root: HTMLElement | null) {
  requestAnimationFrame(() => {
    const candidates = root?.querySelectorAll<HTMLElement>('[aria-invalid="true"], [data-error-anchor="true"] button, [data-error-anchor="true"] input');
    const el = Array.from(candidates ?? []).find((c) => !(c as HTMLButtonElement).disabled);
    el?.focus();
  });
}

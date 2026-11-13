"use client";

import { Dialog as D } from "radix-ui";
import { useRef, type ComponentProps, type ReactNode } from "react";
import { X } from "@phosphor-icons/react";
import { cn } from "@/lib/cn";

/**
 * Modal and Sheet (side drawer) on Radix Dialog: focus trap, Esc to close, focus returns to
 * the trigger, scroll lock (Lenis is paused while locked — see SmoothScroll).
 * Scrollable bodies carry data-lenis-prevent so wheel scrolling stays native inside them.
 */
export const Dialog = D.Root;
export const DialogTrigger = D.Trigger;
export const DialogClose = D.Close;

function Overlay() {
  return <D.Overlay className="anim-overlay fixed inset-0 z-[60] bg-[rgb(20_24_21/0.32)]" />;
}

export function ModalContent({
  title,
  description,
  children,
  footer,
  className,
  size = "md",
  hideTitle,
  ...props
}: Omit<ComponentProps<typeof D.Content>, "title"> & { title: ReactNode; description?: ReactNode; footer?: ReactNode; size?: "sm" | "md" | "lg" | "xl"; hideTitle?: boolean }) {
  const width = { sm: "max-w-[420px]", md: "max-w-[560px]", lg: "max-w-[760px]", xl: "max-w-[1040px]" }[size];
  const ref = useRef<HTMLDivElement>(null);
  return (
    <D.Portal>
      <Overlay />
      <D.Content
        ref={ref}
        onOpenAutoFocus={(e) => {
          props.onOpenAutoFocus?.(e);
          if (e.defaultPrevented) return;
          const first = ref.current?.querySelector<HTMLElement>("[data-autofocus], input:not([type=hidden]):not([disabled]), textarea, [role=combobox]");
          if (first) {
            e.preventDefault();
            first.focus();
          }
        }}
        className={cn(
          "anim-modal fixed left-1/2 top-1/2 z-[61] flex max-h-[min(88dvh,880px)] w-[calc(100vw-32px)] -translate-x-1/2 -translate-y-1/2 flex-col rounded-card bg-surface shadow-pop outline-none",
          width,
          className,
        )}
        {...props}
      >
        <header className={cn("flex items-start gap-4 px-6 pb-2 pt-6", hideTitle && "sr-only")}>
          <div className="min-w-0 flex-1">
            <D.Title className="text-xl font-normal tracking-[-0.01em] text-ink">{title}</D.Title>
            {description ? <D.Description className="mt-1 text-sm text-muted">{description}</D.Description> : null}
          </div>
          <D.Close aria-label="Close" className="-mr-2 -mt-1 flex size-10 items-center justify-center rounded-full text-ink-2 transition-colors hover:bg-sunken">
            <X size={18} />
          </D.Close>
        </header>
        {!description ? <D.Description className="sr-only">{typeof title === "string" ? title : "Dialog"}</D.Description> : null}
        <div data-lenis-prevent className="scrollbar-thin min-h-0 flex-1 overflow-y-auto px-6 py-4">
          {children}
        </div>
        {footer ? <footer className="flex flex-wrap items-center justify-end gap-2 border-t border-line px-6 py-4">{footer}</footer> : null}
      </D.Content>
    </D.Portal>
  );
}

export function SheetContent({
  title,
  description,
  children,
  footer,
  side = "right",
  className,
  headerExtra,
  ...props
}: Omit<ComponentProps<typeof D.Content>, "title"> & { title: ReactNode; description?: ReactNode; footer?: ReactNode; side?: "right" | "left"; headerExtra?: ReactNode }) {
  return (
    <D.Portal>
      <Overlay />
      <D.Content
        className={cn(
          "fixed bottom-2 top-2 z-[61] flex w-[min(520px,calc(100vw-16px))] flex-col rounded-card bg-surface shadow-pop outline-none",
          side === "right" ? "anim-sheet-right right-2" : "anim-sheet-left left-2",
          className,
        )}
        {...props}
      >
        <header className="flex items-start gap-4 px-6 pb-4 pt-6">
          <div className="min-w-0 flex-1">
            <D.Title className="text-xl font-normal tracking-[-0.01em] text-ink">{title}</D.Title>
            {description ? <D.Description className="mt-1 text-sm text-muted">{description}</D.Description> : <D.Description className="sr-only">Details</D.Description>}
          </div>
          {headerExtra}
          <D.Close aria-label="Close" className="-mr-2 -mt-1 flex size-10 items-center justify-center rounded-full text-ink-2 transition-colors hover:bg-sunken">
            <X size={18} />
          </D.Close>
        </header>
        <div data-lenis-prevent className="scrollbar-thin min-h-0 flex-1 overflow-y-auto px-6 pb-6">
          {children}
        </div>
        {footer ? <footer className="flex flex-wrap items-center justify-end gap-2 border-t border-line px-6 py-4">{footer}</footer> : null}
      </D.Content>
    </D.Portal>
  );
}

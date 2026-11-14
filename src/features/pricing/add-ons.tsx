import { ChatCircleText, CreditCard, Database, Flask, ShareNetwork, VideoCamera } from "@phosphor-icons/react/ssr";
import type { ReactNode } from "react";
import { ADDONS, type AddOnId } from "@/data/plans";
import { cn } from "@/lib/cn";
import s from "@/features/marketing/motion.module.css";

/**
 * Add-ons (spec "Add-ons (any plan)"): sold separately on top of any plan and never included in
 * one. Read straight from ADDONS — label, what it does, how it is priced. The demo shows them as
 * add-ons, never as working features.
 */
const ICONS: Record<AddOnId, ReactNode> = {
  messaging: <ChatCircleText />,
  payments: <CreditCard />,
  storage: <Database />,
  labs: <Flask />,
  abdm: <ShareNetwork />,
  telehealth: <VideoCamera />,
};

export function AddOns({ className }: { className?: string }) {
  return (
    <ul className={cn("grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3", className)}>
      {ADDONS.map((a) => (
        <li key={a.id} className={cn("flex flex-col rounded-card bg-surface p-6", s.reveal)}>
          <div className="flex items-center justify-between gap-3">
            <span aria-hidden="true" className="flex size-10 shrink-0 items-center justify-center rounded-full bg-sunken text-ink [&_svg]:size-[18px]">
              {ICONS[a.id]}
            </span>
            <span className="inline-flex h-7 items-center rounded-full px-2.5 text-xs text-muted shadow-[inset_0_0_0_1px_var(--color-line-strong)]">Any plan · not included</span>
          </div>
          <h3 className="mt-6 text-base text-ink">{a.label}</h3>
          <p className="mt-1 text-sm text-muted">{a.description}</p>
          <p className="mt-auto pt-6 text-xs text-muted">
            Pricing basis · <span className="text-ink-2">{a.basis}</span>
          </p>
        </li>
      ))}
    </ul>
  );
}

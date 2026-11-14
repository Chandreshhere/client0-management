"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowUpRight, Lock, Package, PuzzlePiece, SignOut } from "@phosphor-icons/react";
import { DEMO_USER } from "@/data/staff";
import { addOnById, featureById, minPlanFor, planById, priceLabel, type AddOnId, type FeatureId } from "@/data/plans";
import { formatINR } from "@/lib/format";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/button";
import { Tip } from "@/components/ui/tooltip";
import { useRole } from "./role-context";

/**
 * Demo login card (sidebar foot). Each demo is one real setup — a plan and a role — chosen on
 * /demo; there is no in-app plan or role switcher (spec fix 12). "Switch" goes back to the chooser.
 */
export function DemoLoginCard({ collapsed }: { collapsed: boolean }) {
  const { role, details } = usePlanRole();
  const label = `${details.name} plan · ${DEMO_USER[role].label}`;
  if (collapsed) {
    return (
      <Tip label={`${label} — switch demo login`} side="right">
        <Link href="/demo" aria-label={`Demo login: ${label}. Switch demo login`} className="flex size-11 items-center justify-center rounded-full bg-sunken text-ink transition-colors hover:bg-sunken-2 short:size-9">
          <Package size={20} />
        </Link>
      </Tip>
    );
  }
  return (
    <Link href="/demo" className="group flex w-full items-center gap-3 rounded-inner bg-sunken p-3 text-left transition-colors hover:bg-sunken-2" aria-label={`Demo login: ${label}. Switch demo login`}>
      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-charcoal text-white">
        <Package size={18} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm text-ink">
          {details.name} plan <span className="text-muted">· demo</span>
        </span>
        <span className="block truncate text-xs text-muted">{DEMO_USER[role].label} login · switch</span>
      </span>
      <SignOut size={16} className="shrink-0 text-muted transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
    </Link>
  );
}

function usePlanRole() {
  const { role, plan } = useRole();
  return { role, plan, details: planById(plan) };
}

/** Shown in place of a page whose feature isn't in the current plan (reached by URL only — nav hides it). */
export function LockedFeature({ feature }: { feature: FeatureId }) {
  const { plan } = useRole();
  const details = planById(plan);
  const f = featureById(feature);
  const needed = minPlanFor(feature);
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-[720px] flex-col items-center justify-center text-center">
      <span className="flex size-16 items-center justify-center rounded-full bg-charcoal text-white">
        <Lock size={26} />
      </span>
      <p className="mt-6 text-sm text-muted">Not part of the {details.name} plan</p>
      <h1 className="mt-2 text-[30px] font-light leading-[1.1] tracking-[-0.02em] text-ink">{f.label}</h1>
      <p className="mt-3 max-w-[52ch] text-sm text-muted">{f.description}</p>
      <div className="mt-8 w-full max-w-[440px] rounded-card bg-surface p-6 text-left">
        <p className="text-xs text-muted">Included from</p>
        <p className="mt-1 text-xl font-light tracking-[-0.01em] text-ink">{needed.name}</p>
        <p className="mt-1 text-sm text-ink-2">
          {priceLabel(needed)} · {formatINR(needed.onboardingFee)} onboarding
        </p>
        <div className="mt-6 flex flex-wrap gap-2">
          <Button asChild variant="primary">
            <Link href={`/demo?plan=${needed.id}`}>Open the {needed.name} demo</Link>
          </Button>
          <Button asChild variant="secondary">
            <Link href="/pricing">Compare plans</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

/** Small "Add-on" tag for a capability that is sold separately (spec rule 7). */
export function AddOnBadge({ addOn, className }: { addOn: AddOnId; className?: string }) {
  const a = addOnById(addOn);
  return (
    <Tip label={`${a.label} add-on · ${a.description} Priced: ${a.basis.charAt(0).toLowerCase()}${a.basis.slice(1)}.`}>
      <span tabIndex={0} className={cn("inline-flex h-6 shrink-0 items-center gap-1 rounded-full bg-sunken px-2 text-[11px] text-ink-2 outline-none focus-visible:outline-2 focus-visible:outline-primary", className)}>
        <PuzzlePiece size={12} aria-hidden="true" />
        Add-on
      </span>
    </Tip>
  );
}

/**
 * Inline notice where an add-on would plug in (e.g. "Send form link" needs WhatsApp/SMS): states
 * what the add-on does instead of pretending the capability works.
 */
export function AddOnNotice({ addOn, children, className }: { addOn: AddOnId; children?: ReactNode; className?: string }) {
  const a = addOnById(addOn);
  return (
    <div className={cn("flex items-start gap-3 rounded-inner bg-sunken p-3 text-xs text-ink-2", className)}>
      <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-surface text-ink-2" aria-hidden="true">
        <PuzzlePiece size={14} />
      </span>
      <div className="min-w-0">
        <p className="text-ink">
          {a.label} <span className="text-muted">· add-on</span>
        </p>
        <p className="mt-0.5 text-muted">{children ?? a.description}</p>
        <Link href="/pricing#add-ons" className="mt-1 inline-flex items-center gap-1 text-ink underline decoration-line-strong underline-offset-4 hover:decoration-ink">
          See add-ons <ArrowUpRight size={12} aria-hidden="true" />
        </Link>
      </div>
    </div>
  );
}

export function LockBadge({ className }: { className?: string }) {
  return <Lock size={14} className={cn("shrink-0 text-faint", className)} aria-hidden="true" />;
}

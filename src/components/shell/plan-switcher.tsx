"use client";

import Link from "next/link";
import { CaretUpDown, Lock, Package, ArrowUpRight, Check } from "@phosphor-icons/react";
import { PLANS, featureById, minPlanFor, planById, type FeatureId, type PlanId } from "@/data/plans";
import { formatINR } from "@/lib/format";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/button";
import { Tip } from "@/components/ui/tooltip";
import { Dropdown, DropdownContent, DropdownItem, DropdownLabel, DropdownSeparator, DropdownTrigger } from "@/components/ui/dropdown";
import { usePlan } from "./role-context";

export const priceLine = (id: PlanId) => {
  const p = planById(id);
  return p.pricing.kind === "flat" ? `${formatINR(p.pricing.monthly)} / month` : `${formatINR(p.pricing.monthly)} / user / month`;
};

/** Sidebar plan card: shows the demo's active plan and switches it (features re-gate instantly). */
export function PlanSwitcher({ collapsed }: { collapsed: boolean }) {
  const { plan, setPlan, details } = usePlan();
  const menu = (
    <DropdownContent side={collapsed ? "right" : "top"} align="start" sideOffset={10} className="w-[300px]">
      <DropdownLabel>Demo plan — features unlock per plan</DropdownLabel>
      {PLANS.map((p) => (
        <DropdownItem key={p.id} onSelect={() => setPlan(p.id)} description={`${formatINR(p.setupFee)} setup · ${priceLine(p.id)} · ${p.usersLabel}`}>
          <span className="flex items-center justify-between gap-2">
            {p.name}
            {p.id === plan ? <Check size={16} weight="bold" className="!text-primary" /> : null}
          </span>
        </DropdownItem>
      ))}
      <DropdownSeparator />
      <DropdownItem asChild icon={<ArrowUpRight />}>
        <Link href="/pricing">Compare plans</Link>
      </DropdownItem>
    </DropdownContent>
  );

  if (collapsed) {
    return (
      <Dropdown>
        <Tip label={`${details.name} plan · change`} side="right">
          <DropdownTrigger asChild>
            <button type="button" aria-label={`Plan: ${details.name}. Change plan`} className="flex size-11 items-center justify-center rounded-full bg-sunken text-ink transition-colors hover:bg-sunken-2">
              <Package size={20} />
            </button>
          </DropdownTrigger>
        </Tip>
        {menu}
      </Dropdown>
    );
  }

  return (
    <Dropdown>
      <DropdownTrigger asChild>
        <button type="button" className="flex w-full items-center gap-3 rounded-inner bg-sunken p-3 text-left transition-colors hover:bg-sunken-2" aria-label={`Plan: ${details.name}. Change plan`}>
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-charcoal text-white">
            <Package size={18} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm text-ink">{details.name} plan <span className="text-muted">· demo</span></span>
            <span className="block truncate text-xs text-muted">{priceLine(plan)}</span>
          </span>
          <CaretUpDown size={16} className="shrink-0 text-muted" aria-hidden="true" />
        </button>
      </DropdownTrigger>
      {menu}
    </Dropdown>
  );
}

/** Shown in place of a page whose feature isn't in the current plan. */
export function LockedFeature({ feature }: { feature: FeatureId }) {
  const { setPlan, details } = usePlan();
  const f = featureById(feature);
  const needed = minPlanFor(feature);
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-[720px] flex-col items-center justify-center text-center">
      <span className="flex size-16 items-center justify-center rounded-full bg-charcoal text-white">
        <Lock size={26} />
      </span>
      <p className="mt-6 text-sm text-muted">Not included in the {details.name} plan</p>
      <h1 className="mt-2 text-[36px] font-light leading-[1.05] tracking-[-0.028em] text-ink">{f.label}</h1>
      <p className="mt-3 max-w-[52ch] text-sm text-muted">{f.description}</p>
      <div className="mt-8 w-full max-w-[440px] rounded-card bg-surface p-6 text-left">
        <p className="text-xs text-muted">Available from</p>
        <p className="mt-1 text-xl font-light tracking-[-0.01em] text-ink">{needed.name}</p>
        <p className="mt-1 text-sm text-ink-2">
          {formatINR(needed.setupFee)} setup · {priceLine(needed.id)} · {needed.usersLabel}
        </p>
        <div className="mt-6 flex flex-wrap gap-2">
          <Button variant="primary" onClick={() => setPlan(needed.id)}>
            Switch demo to {needed.name}
          </Button>
          <Button asChild variant="secondary">
            <Link href="/pricing">Compare plans</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

export function LockBadge({ className }: { className?: string }) {
  return <Lock size={14} className={cn("shrink-0 text-faint", className)} aria-hidden="true" />;
}

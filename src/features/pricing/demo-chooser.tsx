"use client";

import { useRef, useState, type KeyboardEvent } from "react";
import { addedFeatures, featureById, PLANS, type Plan, type PlanId } from "@/data/plans";
import { patientById } from "@/data/patients";
import { DEMO_USER, staffById } from "@/data/staff";
import type { Role } from "@/data/types";
import { Avatar } from "@/components/ui/avatar";
import { cn } from "@/lib/cn";
import { formatINR } from "@/lib/format";
import { ExploreDemoButton } from "./explore-demo-button";
import { basePlanName, priceParts } from "./model";

/**
 * The shareable demo entry: the three plans as choice cards. Each card shows price, users, what
 * it unlocks and the roles available on it; picking a role and entering sets cl_plan + cl_role
 * and opens /dashboard. Clinic — the full tour — is the cobalt focal card.
 */
const FOCAL: PlanId = "clinic";

function demoPerson(role: Role) {
  const id = DEMO_USER[role].personId;
  const staff = staffById(id);
  if (staff) return { name: staff.name, avatar: staff.avatar, title: staff.title };
  const p = patientById(id);
  return { name: p?.name ?? "Demo patient", avatar: p?.avatar ?? null, title: "Synthetic patient" };
}

export function DemoChooser() {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      {PLANS.map((plan) => (
        <PlanChoice key={plan.id} plan={plan} />
      ))}
    </div>
  );
}

function PlanChoice({ plan }: { plan: Plan }) {
  const focal = plan.id === FOCAL;
  const [role, setRole] = useState<Role>(plan.roles[0]);
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const { amount, unit } = priceParts(plan);
  const base = basePlanName(plan);
  const unlocks = (plan.includesPrevious ? addedFeatures(plan) : plan.features).map((f) => featureById(f).label);
  const who = demoPerson(role);
  const sub = focal ? "text-white/90" : "text-muted";

  const onKey = (e: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const keys: Record<string, number> = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };
    let next: number | null = null;
    if (e.key in keys) next = (index + keys[e.key] + plan.roles.length) % plan.roles.length;
    if (e.key === "Home") next = 0;
    if (e.key === "End") next = plan.roles.length - 1;
    if (next === null) return;
    e.preventDefault();
    setRole(plan.roles[next]);
    refs.current[next]?.focus();
  };

  return (
    <article aria-labelledby={`demo-${plan.id}`} className={cn("flex flex-col rounded-card p-2", focal ? "bg-primary text-white" : "bg-surface text-ink")}>
      <div className="p-4">
        <div className="flex items-center justify-between gap-3">
          <h2 id={`demo-${plan.id}`} className="text-[26px] font-light leading-none tracking-[-0.02em]">
            {plan.name}
          </h2>
          <span className={cn("inline-flex h-8 items-center rounded-full px-3 text-xs", focal ? "shadow-[inset_0_0_0_1px_rgb(255_255_255/0.4)]" : "text-muted shadow-[inset_0_0_0_1px_var(--color-line-strong)]")}>
            {plan.roles.length === 1 ? "1 workspace" : `${plan.roles.length} workspaces`}
          </span>
        </div>
        <p className={cn("mt-4 text-sm", sub)}>
          <span className="whitespace-nowrap">
            <span className={cn("text-[22px] font-light tracking-[-0.02em] tabular", focal ? "text-white" : "text-ink")}>{amount}</span> {unit}
          </span>{" "}
          · <span className="whitespace-nowrap">{formatINR(plan.setupFee)} setup</span> · <span className="whitespace-nowrap">{plan.usersLabel}</span>
        </p>

        <p className="mt-6 text-sm">{base ? `Everything in ${base}, plus` : "Unlocks"}</p>
        <ul className="mt-2 flex flex-wrap gap-1.5">
          {unlocks.map((u) => (
            <li key={u} className={cn("inline-flex h-7 items-center rounded-full px-2.5 text-xs", focal ? "bg-black/15 text-white" : "bg-sunken text-ink-2")}>
              {u}
            </li>
          ))}
        </ul>
      </div>

      <div className={cn("mt-auto flex flex-col gap-4 rounded-inner p-4", focal ? "bg-black/10" : "bg-sunken")}>
        <div>
          <p id={`demo-${plan.id}-roles`} className="text-sm">
            Explore as
          </p>
          <div role="radiogroup" aria-labelledby={`demo-${plan.id}-roles`} className="mt-2 flex flex-wrap gap-1.5">
            {plan.roles.map((r, index) => {
              const on = r === role;
              return (
                <button
                  key={r}
                  ref={(el) => {
                    refs.current[index] = el;
                  }}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  tabIndex={on ? 0 : -1}
                  onClick={() => setRole(r)}
                  onKeyDown={(e) => onKey(e, index)}
                  className={cn(
                    "inline-flex h-8 items-center rounded-full px-3 text-xs transition-[background-color,color,box-shadow] duration-200",
                    focal
                      ? on
                        ? "bg-white text-ink"
                        : "text-white shadow-[inset_0_0_0_1px_rgb(255_255_255/0.4)] hover:bg-white/10"
                      : on
                        ? "bg-charcoal text-white"
                        : "bg-surface text-ink-2 hover:text-ink",
                  )}
                >
                  {DEMO_USER[r].label}
                </button>
              );
            })}
          </div>
        </div>

        <div className={cn("flex items-center gap-3 rounded-[8px] p-3", focal ? "bg-white/10" : "bg-surface")} aria-live="polite">
          <Avatar src={who.avatar} name={who.name} size="md" />
          <div className="min-w-0">
            <p className="truncate text-sm">You&apos;ll be {who.name}</p>
            <p className={cn("line-clamp-2 text-xs", sub)}>{DEMO_USER[role].description}</p>
          </div>
        </div>

        <ExploreDemoButton planId={plan.id} role={role} tone={focal ? "light" : "dark"} label={`Enter as ${DEMO_USER[role].label.toLowerCase()}`} className="w-full" />
      </div>
    </article>
  );
}

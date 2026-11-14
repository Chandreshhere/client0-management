"use client";

import { useEffect } from "react";
import { ArrowUpRight, Info } from "@phosphor-icons/react";
import { PLANS, addedFeatures, featureById, minPlanForRole, type Plan, type PlanId } from "@/data/plans";
import { patientById } from "@/data/patients";
import { DEMO_USER, staffById } from "@/data/staff";
import type { Role } from "@/data/types";
import { Avatar } from "@/components/ui/avatar";
import { Spinner } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { formatINR } from "@/lib/format";
import { scrollToElement } from "@/lib/scroll";
import { useDemoLogin } from "./explore-demo-button";
import { addedRoles, availabilityLabel, basePlanName, roleLabel } from "./model";

/**
 * Separate demo logins per plan and role (spec fix 12): three plan columns, each listing its roles
 * as login buttons. A login sets cl_plan + cl_role and opens /dashboard — each demo is one real
 * setup, so there is no in-app switcher; "Switch demo login" inside the demo comes back here.
 * `?plan=` highlights a plan (and scrolls to it on narrow screens); `?role=` highlights that role's
 * logins and says which plans include it. The visitor's current login, if any, is marked.
 */
export type DemoLogin = { plan: PlanId; role: Role };

export const demoPlanAnchor = (id: PlanId) => `demo-plan-${id}`;

function demoPerson(role: Role) {
  const id = DEMO_USER[role].personId;
  const staff = staffById(id);
  if (staff) return { name: staff.name, avatar: staff.avatar };
  const p = patientById(id);
  return { name: p?.name ?? "Demo patient", avatar: p?.avatar ?? null };
}

function addsLine(plan: Plan) {
  const base = basePlanName(plan);
  if (!base) return `${plan.features.length} features: the whole shared patient record, with consent, access rules and the activity log.`;
  return `Everything in ${base}, plus ${addedFeatures(plan)
    .map((f) => featureById(f).label.toLowerCase())
    .join(", ")}.`;
}

export function DemoChooser({ highlightPlan, highlightRole, current }: { highlightPlan?: PlanId; highlightRole?: Role; current?: DemoLogin }) {
  const { login, pending, target } = useDemoLogin();

  // Columns stack below lg: bring the requested plan into view (from a locked page's "Open the Pro demo").
  useEffect(() => {
    if (!highlightPlan || !window.matchMedia("(max-width: 1023px)").matches) return;
    const raf = requestAnimationFrame(() => scrollToElement(`#${demoPlanAnchor(highlightPlan)}`, 96, { instant: true }));
    return () => cancelAnimationFrame(raf);
  }, [highlightPlan]);

  const rolePlans = highlightRole ? PLANS.filter((p) => p.roles.includes(highlightRole)) : [];

  return (
    <div className="flex flex-col gap-4">
      {highlightRole ? (
        <p className="flex items-start gap-3 rounded-inner bg-primary-soft p-4 text-sm text-primary-ink" role="status">
          <Info size={18} aria-hidden="true" className="mt-0.5 shrink-0" />
          <span>
            {roleLabel(highlightRole)} {rolePlans.length === PLANS.length ? "is on every plan" : `is on ${availabilityLabel(minPlanForRole(highlightRole))}`}. Pick the plan you want
            to see — each login shows only what that plan includes.
          </span>
        </p>
      ) : null}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3 lg:items-start">
        {PLANS.map((plan) => {
          const focus = plan.id === highlightPlan;
          const added = addedRoles(plan);
          const base = basePlanName(plan);
          return (
            <article
              key={plan.id}
              id={demoPlanAnchor(plan.id)}
              aria-labelledby={`${demoPlanAnchor(plan.id)}-name`}
              className={cn("flex scroll-mt-28 flex-col rounded-card bg-surface p-2", focus && "shadow-[inset_0_0_0_2px_var(--color-primary)]")}
            >
              <header className="p-4">
                <div className="flex items-center justify-between gap-3">
                  <h2 id={`${demoPlanAnchor(plan.id)}-name`} className="text-[26px] font-light leading-none tracking-[-0.02em] text-ink">
                    {plan.name}
                  </h2>
                  {focus ? (
                    <span className="inline-flex h-6 items-center rounded-full bg-primary px-2.5 text-xs text-white">The plan you asked for</span>
                  ) : current?.plan === plan.id ? (
                    <span className="inline-flex h-6 items-center rounded-full px-2.5 text-xs text-muted shadow-[inset_0_0_0_1px_var(--color-line-strong)]">Your current plan</span>
                  ) : null}
                </div>
                <p className="mt-3 text-sm text-ink">{plan.positioning}</p>
                <p className="mt-1 text-sm text-muted">
                  <span className="whitespace-nowrap">{formatINR(plan.price.annual)} / practitioner / month</span> · billed annually ·{" "}
                  <span className="whitespace-nowrap">+ {formatINR(plan.onboardingFee)} onboarding</span>
                </p>
                <p className="mt-4 text-xs leading-5 text-muted lg:min-h-[60px]">{addsLine(plan)}</p>
              </header>

              <div className="flex flex-col rounded-inner bg-sunken p-2">
                <p className="px-2 pb-2 pt-1 text-xs text-muted">
                  {plan.roles.length} demo logins{base ? ` · adds ${added.map(roleLabel).join(" and ")}` : ""}
                </p>
                <ul className="flex flex-col gap-1">
                  {plan.roles.map((r) => {
                    const key = `${plan.id}:${r}`;
                    const busy = pending && target === key;
                    const isNew = base !== null && added.includes(r);
                    const isCurrent = current?.plan === plan.id && current.role === r;
                    const asked = highlightRole === r;
                    const who = demoPerson(r);
                    return (
                      <li key={r}>
                        <button
                          type="button"
                          onClick={() => login(plan.id, r)}
                          disabled={pending}
                          aria-busy={busy || undefined}
                          aria-label={`Log in to the ${plan.name} demo as ${roleLabel(r)} (${who.name})${isCurrent ? ", your current login" : ""}`}
                          data-testid={`demo-login-${plan.id}-${r}`}
                          className={cn(
                            "group/login flex w-full items-center gap-3 rounded-[8px] bg-surface p-3 text-left transition-[background-color,box-shadow] duration-200 hover:bg-canvas disabled:cursor-wait",
                            (asked || isCurrent) && "shadow-[inset_0_0_0_2px_var(--color-charcoal)]",
                          )}
                        >
                          <Avatar src={who.avatar} name={who.name} size="sm" loading="eager" />
                          <span className="min-w-0 flex-1">
                            <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                              <span className="text-sm text-ink">{roleLabel(r)}</span>
                              {isNew ? <span className="inline-flex h-5 items-center rounded-full bg-charcoal px-2 text-[11px] text-white">New in {plan.name}</span> : null}
                              {isCurrent ? <span className="inline-flex h-5 items-center rounded-full bg-sunken px-2 text-[11px] text-ink-2">Current</span> : null}
                            </span>
                            <span className="mt-0.5 line-clamp-2 block text-xs text-muted">{DEMO_USER[r].description}</span>
                          </span>
                          <span
                            aria-hidden="true"
                            className="flex size-8 shrink-0 items-center justify-center rounded-full bg-sunken text-ink transition-colors group-hover/login:bg-charcoal group-hover/login:text-white"
                          >
                            {busy ? (
                              <Spinner />
                            ) : (
                              <ArrowUpRight size={16} className="transition-transform duration-500 [transition-timing-function:var(--ease-spring-pop)] group-hover/login:rotate-45" />
                            )}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
                {highlightRole && !plan.roles.includes(highlightRole) ? (
                  <p className="px-2 pb-1 pt-3 text-xs text-muted">
                    No {roleLabel(highlightRole)} login on {plan.name} — it starts on {minPlanForRole(highlightRole).name}.
                  </p>
                ) : null}
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}

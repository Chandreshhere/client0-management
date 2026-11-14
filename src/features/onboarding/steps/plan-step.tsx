"use client";

import { Check, Info } from "@phosphor-icons/react";
import { DEMO_USER } from "@/data/staff";
import { ADDONS, PLANS, planById, type Billing, type Plan } from "@/data/plans";
import { Card } from "@/components/ui/card";
import { Field } from "@/components/ui/input";
import { Segmented } from "@/components/ui/segmented";
import { formatINR, pluralize } from "@/lib/format";
import { cn } from "@/lib/cn";
import { MAX_PRACTITIONERS, MAX_STAFF_SEATS, branchPlan, invitableRoles, planCosts, seatRuleText } from "../model";
import { Stepper, type StepProps } from "../controls";

const BILLING: { value: Billing; label: string }[] = [
  { value: "annual", label: "Billed annually" },
  { value: "monthly", label: "Billed monthly" },
];

function rolesLine(plan: Plan) {
  if (!plan.includesPrevious) return plan.roles.map((r) => DEMO_USER[r].label).join(" · ");
  return `${planById(plan.includesPrevious).name} roles ${plan.rolesAdded}`;
}

/** One radio card per plan; the selected card takes the cobalt accent and a check. */
function PlanOption({ plan, billing, selected, onSelect }: { plan: Plan; billing: Billing; selected: boolean; onSelect: () => void }) {
  const sub = selected ? "text-white/90" : "text-muted";
  return (
    <label
      data-testid={`plan-${plan.id}`}
      className={cn(
        "relative flex cursor-pointer flex-col rounded-card p-6 transition-[box-shadow,background-color,color] duration-200",
        "has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-primary",
        selected ? "bg-primary text-white" : "bg-surface text-ink hover:shadow-[inset_0_0_0_1px_var(--color-line-strong)]",
      )}
    >
      <input type="radio" name="plan" value={plan.id} checked={selected} onChange={onSelect} className="sr-only" />
      <span className="flex items-center justify-between gap-2">
        <span className="text-lg">{plan.name}</span>
        <span
          aria-hidden="true"
          className={cn("flex size-6 shrink-0 items-center justify-center rounded-full", selected ? "bg-white text-primary" : "shadow-[inset_0_0_0_1.5px_var(--color-line-strong)]")}
        >
          {selected ? <Check size={14} weight="bold" /> : null}
        </span>
      </span>
      <span className="mt-2 text-sm">{plan.positioning}</span>
      <span className={cn("mt-1 text-pretty text-xs md:min-h-[48px]", sub)}>{plan.audience}</span>
      <span className="mt-6 flex flex-wrap items-baseline gap-x-2">
        <span className="text-[26px] font-light leading-none tracking-[-0.01em] tabular">{formatINR(plan.price[billing])}</span>
        <span className={cn("text-xs", sub)}>per practitioner / month</span>
      </span>
      <span className={cn("mt-4 text-xs", sub)}>
        {formatINR(plan.onboardingFee)} one-time onboarding · {plan.freeSeats} admin / reception seats free
      </span>
      <span className={cn("mt-1 text-pretty text-xs", sub)}>{rolesLine(plan)}</span>
      <span className="sr-only">{selected ? "Selected" : ""}</span>
    </label>
  );
}

export function PlanStep({ data, update }: StepProps) {
  const { plan, billing, practitioners, staffSeats, extraSeats, monthly, yearly, onboarding, firstYear } = planCosts(data);
  const setPlan = (patch: Partial<typeof data.plan>) => update((d) => ({ ...d, plan: { ...d.plan, ...patch } }));

  const notes: string[] = [];
  const multi = branchPlan();
  if (data.clinic.branches > 1 && plan.branches !== "unlimited" && data.clinic.branches > plan.branches)
    notes.push(`You have ${pluralize(data.clinic.branches, "branch", "branches")}. ${plan.name} runs ${pluralize(Number(plan.branches), "branch", "branches")}; several branches need ${multi.name}.`);
  if (staffSeats > 0 && !plan.roles.includes("frontdesk")) notes.push(`On ${plan.name} these seats are for admins. Reception arrives with ${PLANS.find((p) => p.roles.includes("frontdesk"))?.name ?? "a higher plan"}.`);
  const roles = invitableRoles(plan.id);
  const misfit = data.invites.filter((i) => i.role && !roles.includes(i.role));
  if (misfit.length) notes.push(`${pluralize(misfit.length, "teammate")} you added ${misfit.length === 1 ? "has a role" : "have roles"} ${plan.name} doesn't include — change ${misfit.length === 1 ? "it" : "them"} on the Team step.`);

  return (
    <div className="flex flex-col gap-6">
      <fieldset>
        <legend className="sr-only">Plan</legend>
        <div className="grid gap-4 md:grid-cols-3">
          {PLANS.map((p) => (
            <PlanOption key={p.id} plan={p} billing={billing} selected={p.id === data.plan.id} onSelect={() => setPlan({ id: p.id })} />
          ))}
        </div>
      </fieldset>

      <Card className="grid gap-6 md:grid-cols-2">
        <div className="flex flex-col gap-6">
          <Segmented<Billing> ariaLabel="Billing" variant="tray" value={billing} onChange={(b) => setPlan({ billing: b })} items={BILLING} className="w-fit" />
          <Field label="Practitioners" hint="Doctors, nutritionists and yoga instructors, including you. Each is billed per month.">
            {(p) => (
              <Stepper
                id={p.id}
                describedBy={p["aria-describedby"]}
                value={practitioners}
                min={1}
                max={MAX_PRACTITIONERS}
                onChange={(n) => setPlan({ practitioners: n })}
                noun="practitioners"
                testId="practitioners"
              />
            )}
          </Field>
          <Field label="Admin and reception seats" hint={`${seatRuleText(plan)}.`}>
            {(p) => (
              <Stepper
                id={p.id}
                describedBy={p["aria-describedby"]}
                value={staffSeats}
                min={0}
                max={MAX_STAFF_SEATS}
                onChange={(n) => setPlan({ staffSeats: n })}
                noun="seats"
                testId="staff-seats"
              />
            )}
          </Field>
        </div>

        <div className="rounded-inner bg-canvas p-4" aria-live="polite">
          <dl className="flex flex-col gap-3 text-sm">
            <Line label="Practitioners" detail={`${practitioners} × ${formatINR(plan.price[billing])}`} value={formatINR(practitioners * plan.price[billing])} />
            <Line
              label="Admin / reception seats"
              detail={extraSeats ? `${pluralize(extraSeats, "seat")} beyond ${plan.freeSeats} free × ${formatINR(plan.extraSeat)}` : `${staffSeats} of ${plan.freeSeats} free`}
              value={formatINR(extraSeats * plan.extraSeat)}
            />
            <Line label="Monthly" detail={billing === "annual" ? "Billed annually" : "Billed monthly"} value={formatINR(monthly)} strong />
            <Line label="Yearly" detail="12 months" value={formatINR(yearly)} />
            <Line label="Onboarding" detail="One-time" value={formatINR(onboarding)} />
            <div className="mt-1 flex items-end justify-between gap-4 border-t border-line pt-4">
              <dt className="text-ink">
                First-year total
                <span className="block text-xs text-muted">12 months + onboarding, before GST</span>
              </dt>
              <dd className="text-[26px] font-light leading-none tracking-[-0.01em] tabular text-ink" data-testid="first-year-total">
                {formatINR(firstYear)}
              </dd>
            </div>
          </dl>
        </div>
      </Card>

      <div className="flex flex-col gap-2">
        {notes.map((n) => (
          <p key={n} className="flex items-start gap-2 text-sm text-ink-2">
            <Info size={18} className="mt-px shrink-0 text-muted" aria-hidden="true" />
            {n}
          </p>
        ))}
        <p className="flex items-start gap-2 text-sm text-muted">
          <Info size={18} className="mt-px shrink-0" aria-hidden="true" />
          Estimate only — no payment is taken in this prototype. Add-ons ({ADDONS.map((a) => a.label).join(", ")}) are priced separately on any plan.
        </p>
      </div>
    </div>
  );
}

function Line({ label, detail, value, strong }: { label: string; detail: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-muted">
        {label}
        <span className="block text-xs">{detail}</span>
      </dt>
      <dd className={cn("text-right tabular", strong ? "text-ink" : "text-ink-2")}>{value}</dd>
    </div>
  );
}

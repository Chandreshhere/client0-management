"use client";

import { Check, Info } from "@phosphor-icons/react";
import { DEMO_USER } from "@/data/staff";
import { PLANS, type Plan } from "@/data/plans";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field } from "@/components/ui/input";
import { Pill } from "@/components/ui/pill";
import { formatINR, pluralize } from "@/lib/format";
import { cn } from "@/lib/cn";
import { MAX_USERS, planCosts, specialityLabel, userRangeText } from "../model";
import { Stepper, type StepProps } from "../controls";

function rolesLine(plan: Plan) {
  if (plan.roles.length >= 7) return "All 7 workspaces, including the patient portal";
  return plan.roles.map((r) => DEMO_USER[r].label).join(" · ");
}

/** Team is the focal (cobalt) card; selection is shown separately with a ring + check. */
function PlanOption({ plan, selected, onSelect }: { plan: Plan; selected: boolean; onSelect: () => void }) {
  const focal = plan.id === "team";
  const sub = focal ? "text-white" : "text-muted";
  return (
    <label
      data-testid={`plan-${plan.id}`}
      className={cn(
        "relative flex cursor-pointer flex-col rounded-card p-6 transition-[box-shadow,background-color] duration-200",
        "has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-primary",
        focal ? "bg-primary text-white hover:bg-primary-hover" : "bg-surface text-ink hover:shadow-[inset_0_0_0_1px_var(--color-line-strong)]",
        selected && !focal && "shadow-[inset_0_0_0_2px_var(--color-charcoal)] hover:shadow-[inset_0_0_0_2px_var(--color-charcoal)]",
        selected && focal && "shadow-[0_0_0_2px_var(--color-canvas),0_0_0_4px_var(--color-charcoal)]",
      )}
    >
      <input type="radio" name="plan" value={plan.id} checked={selected} onChange={onSelect} className="sr-only" />
      <span className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-2">
          <span className="text-lg">{plan.name}</span>
          {focal ? (
            <Pill tone="instances-light" size="sm" className="text-white">
              Recommended
            </Pill>
          ) : null}
        </span>
        <span
          aria-hidden="true"
          className={cn(
            "flex size-6 shrink-0 items-center justify-center rounded-full",
            selected ? (focal ? "bg-white text-primary" : "bg-charcoal text-white") : focal ? "shadow-[inset_0_0_0_1.5px_rgb(255_255_255/0.7)]" : "shadow-[inset_0_0_0_1.5px_var(--color-line-strong)]",
          )}
        >
          {selected ? <Check size={14} weight="bold" /> : null}
        </span>
      </span>
      <span className={cn("mt-2 text-pretty text-sm md:min-h-[60px]", sub)}>{plan.audience}</span>
      <span className="mt-6 flex items-baseline gap-2">
        <span className="text-[26px] font-light leading-none tracking-[-0.01em] tabular">{formatINR(plan.pricing.monthly)}</span>
        <span className={cn("text-xs", sub)}>{plan.pricing.kind === "flat" ? "per month, flat" : "per user / month"}</span>
      </span>
      <span className={cn("mt-4 text-xs", sub)}>
        {formatINR(plan.setupFee)} one-time setup · {plan.usersLabel}
      </span>
      <span className={cn("mt-1 text-pretty text-xs", sub)}>{rolesLine(plan)}</span>
      <span className="sr-only">{selected ? "Selected" : ""}</span>
    </label>
  );
}

export function PlanStep({ data, update }: StepProps) {
  const { plan, monthly, setup, firstYear } = planCosts(data);
  const perUser = plan.pricing.kind === "per-user" ? plan.pricing : null;
  const invalidUsers = perUser !== null && monthly === null;
  const fixTo = perUser ? Math.max(perUser.minUsers, Math.min(perUser.maxUsers, data.plan.users)) : data.plan.users;

  const notes: string[] = [];
  const extra = data.clinic.specialities.filter((s) => s !== "medical");
  if (plan.id === "starter" && extra.length) notes.push(`Starter includes only the doctor workspace. ${extra.map(specialityLabel).join(" and ")} need Team or Clinic.`);
  if (data.clinic.branches > 1 && plan.id !== "clinic") notes.push(`You have ${pluralize(data.clinic.branches, "branch", "branches")}. Managing several branches is included in Clinic only.`);
  if (plan.id === "starter" && data.invites.length) notes.push(`Starter has no invites — the ${pluralize(data.invites.length, "teammate")} you added would need Team or Clinic.`);

  return (
    <div className="flex flex-col gap-6">
      <fieldset>
        <legend className="sr-only">Plan</legend>
        <div className="grid gap-4 md:grid-cols-3">
          {PLANS.map((p) => (
            <PlanOption key={p.id} plan={p} selected={p.id === data.plan.id} onSelect={() => update((d) => ({ ...d, plan: { ...d.plan, id: p.id } }))} />
          ))}
        </div>
      </fieldset>

      <Card className="grid gap-6 md:grid-cols-2">
        <div className="flex flex-col gap-4">
          {perUser ? (
            <Field label="Users" hint={invalidUsers ? undefined : `${userRangeText(plan)}. Each user gets their own sign-in.`}>
              {(p) => (
                <Stepper
                  id={p.id}
                  describedBy={invalidUsers ? "plan-users-error" : p["aria-describedby"]}
                  value={data.plan.users}
                  min={1}
                  max={MAX_USERS}
                  onChange={(n) => update((d) => ({ ...d, plan: { ...d.plan, users: n } }))}
                  noun="users"
                  testId="users"
                  invalid={invalidUsers}
                />
              )}
            </Field>
          ) : (
            <div>
              <p className="text-sm text-ink">Users</p>
              <p className="mt-2 text-[26px] font-light leading-tight tracking-[-0.01em]">1 practitioner workspace</p>
              <p className="mt-2 text-xs text-muted">Starter is a flat {formatINR(plan.pricing.monthly)} a month for a single practitioner.</p>
            </div>
          )}
          {invalidUsers && perUser ? (
            <div id="plan-users-error" role="alert" className="flex flex-col items-start gap-3 rounded-inner bg-danger-soft p-4 text-sm text-danger">
              <p>
                {userRangeText(plan)}. You chose {pluralize(data.plan.users, "user")}.
              </p>
              <Button size="sm" variant="secondary" onClick={() => update((d) => ({ ...d, plan: { ...d.plan, users: fixTo } }))} data-testid="users-fix">
                Use {pluralize(fixTo, "user")}
              </Button>
            </div>
          ) : null}
        </div>

        <div className="rounded-inner bg-canvas p-4" aria-live="polite">
          <dl className="flex flex-col gap-3 text-sm">
            <div className="flex items-baseline justify-between gap-4">
              <dt className="text-muted">Monthly</dt>
              <dd className="text-right tabular text-ink">
                {monthly === null ? "—" : formatINR(monthly)}
                <span className="block text-xs text-muted">
                  {perUser ? (monthly === null ? "Adjust users" : `${formatINR(perUser.monthly)} × ${pluralize(data.plan.users, "user")}`) : "Flat fee"}
                </span>
              </dd>
            </div>
            <div className="flex items-baseline justify-between gap-4">
              <dt className="text-muted">One-time setup</dt>
              <dd className="tabular text-ink">{formatINR(setup)}</dd>
            </div>
            <div className="mt-1 flex items-end justify-between gap-4 border-t border-line pt-4">
              <dt className="text-ink">
                First-year total
                <span className="block text-xs text-muted">Setup + 12 months</span>
              </dt>
              <dd className="text-[26px] font-light leading-none tracking-[-0.01em] tabular text-ink" data-testid="first-year-total">
                {firstYear === null ? "—" : formatINR(firstYear)}
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
          Estimate only — no payment is taken in this prototype.
        </p>
      </div>
    </div>
  );
}

"use client";

import { AnimatePresence, motion } from "motion/react";
import { Plus, Trash } from "@phosphor-icons/react";
import { DEMO_USER } from "@/data/staff";
import { planById } from "@/data/plans";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { IconButton } from "@/components/ui/icon-button";
import { Field, Input, Select } from "@/components/ui/input";
import { ProgressBar } from "@/components/ui/misc";
import { Pill } from "@/components/ui/pill";
import { formatINR, pluralize } from "@/lib/format";
import { spring } from "@/lib/motion";
import { cn } from "@/lib/cn";
import { invitableRoles, isPractitionerRole, seatRuleText, teamCounts, uid, type InviteRow, type OnboardingData } from "../model";
import { InlineError, type StepProps } from "../controls";

const COLS = "md:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)_200px_40px]";
const invalidRing = "shadow-[inset_0_0_0_1.5px_var(--color-danger)] hover:shadow-[inset_0_0_0_1.5px_var(--color-danger)]";

/**
 * Team: the owner plus invites, limited to the plan's roles. Practitioners (doctor, nutritionist,
 * yoga instructor) are billed each; admin / reception / coordinator roles use admin / reception
 * seats, free up to the plan's limit. Going over the counts chosen on the Plan step offers a
 * one-click fix that states what it adds to the bill.
 */
export function TeamStep({ data, update, errors, goTo }: StepProps) {
  const plan = planById(data.plan.id);
  const roles = invitableRoles(plan.id);
  const ownerRole = plan.roles[0];
  const counts = teamCounts(data);
  const { practitioners, staffSeats, billing } = data.plan;
  const overP = counts.practitioners > practitioners;
  const overS = counts.staff > staffSeats;

  const setPlan = (patch: Partial<OnboardingData["plan"]>) => update((d) => ({ ...d, plan: { ...d.plan, ...patch } }));
  const setOwner = (patch: Partial<{ name: string; email: string }>) => update((d) => ({ ...d, owner: { ...d.owner, ...patch } }));
  const edit = (id: string, patch: Partial<InviteRow>) => update((d) => ({ ...d, invites: d.invites.map((x) => (x.id === id ? { ...x, ...patch } : x)) }));
  const remove = (id: string) => update((d) => ({ ...d, invites: d.invites.filter((x) => x.id !== id) }));
  const addInvite = () => update((d) => ({ ...d, invites: [...d.invites, { id: uid("inv"), name: "", email: "", role: "" }] }));

  const seatsCost = (n: number) => Math.max(0, n - plan.freeSeats) * plan.extraSeat - Math.max(0, staffSeats - plan.freeSeats) * plan.extraSeat;

  return (
    <div className="flex flex-col gap-4">
      {/* Practitioners and seats against what the Plan step bills for */}
      <Card className="grid gap-6 sm:grid-cols-2">
        <div className="min-w-0">
          <p className="text-xs text-muted">Practitioners · billed each on {plan.name}</p>
          <p className="mt-2 text-[26px] font-light leading-none tracking-[-0.01em] tabular text-ink" data-testid="practitioner-count">
            {counts.practitioners} of {practitioners}
          </p>
          <ProgressBar value={Math.min(counts.practitioners, practitioners)} max={practitioners} tone={overP ? "danger" : "dark"} label="Practitioners on the team" className="mt-4" />
          <p className="mt-2 text-xs text-muted">
            {formatINR(plan.price[billing])} each per month, {billing === "annual" ? "billed annually" : "billed monthly"}.
          </p>
        </div>
        <div className="min-w-0">
          <p className="text-xs text-muted">Admin and reception seats</p>
          <p className="mt-2 text-[26px] font-light leading-none tracking-[-0.01em] tabular text-ink" data-testid="seat-count">
            {counts.staff} of {staffSeats}
          </p>
          <ProgressBar value={Math.min(counts.staff, Math.max(staffSeats, 1))} max={Math.max(staffSeats, 1)} tone={overS ? "danger" : "dark"} label="Admin and reception seats used" className="mt-4" />
          <p className="mt-2 text-xs text-muted">{seatRuleText(plan)}.</p>
        </div>
      </Card>

      <Card className="flex flex-col gap-4">
        <h2 className="text-lg font-normal tracking-[-0.01em] text-ink">People</h2>

        {/* Owner (the person setting up) */}
        <div className="flex flex-col gap-4 rounded-inner bg-canvas p-4">
          <div className="flex items-center gap-3">
            <Avatar name={data.owner.name || "You"} size="md" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm text-ink">{data.owner.name.trim() || "You"}</p>
              <p className="truncate text-xs text-muted">Starts as {DEMO_USER[ownerRole].label.toLowerCase()} · counts as a practitioner</p>
            </div>
            <Pill tone="dark" size="sm">
              Owner
            </Pill>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Your name" error={errors["owner.name"]}>
              {(p) => <Input {...p} autoComplete="name" value={data.owner.name} onChange={(e) => setOwner({ name: e.target.value })} data-testid="owner-name" />}
            </Field>
            <Field label="Your email" error={errors["owner.email"]}>
              {(p) => <Input {...p} type="email" autoComplete="email" value={data.owner.email} onChange={(e) => setOwner({ email: e.target.value })} data-testid="owner-email" />}
            </Field>
          </div>
        </div>

        {data.invites.length ? (
          <div className={cn("hidden gap-3 px-1 text-xs text-muted md:grid", COLS)} aria-hidden="true">
            <span>Name</span>
            <span>Email</span>
            <span>Role</span>
            <span />
          </div>
        ) : null}
        <ul className="flex flex-col gap-3">
          <AnimatePresence initial={false}>
            {data.invites.map((inv, i) => {
              const nameErr = errors[`invites.${inv.id}.name`];
              const emailErr = errors[`invites.${inv.id}.email`];
              // a role the plan doesn't include (e.g. after switching plan) is flagged right away
              const misfit = inv.role !== "" && !roles.includes(inv.role);
              const roleErr = errors[`invites.${inv.id}.role`] ?? (misfit ? `${DEMO_USER[inv.role as keyof typeof DEMO_USER].label} isn't on ${plan.name} — choose another role or change plan.` : undefined);
              const rowErrors = [nameErr, emailErr, roleErr].filter(Boolean).join(" ");
              const errId = `inv-err-${inv.id}`;
              const n = i + 1;
              return (
                <motion.li key={inv.id} layout="position" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, transition: { duration: 0.12 } }} transition={spring}>
                  <div className={cn("grid grid-cols-[minmax(0,1fr)_40px] gap-3 rounded-inner bg-canvas p-3 md:items-center md:rounded-none md:bg-transparent md:p-0", COLS)}>
                    <Input
                      aria-label={`Teammate ${n} name`}
                      aria-invalid={nameErr ? true : undefined}
                      aria-describedby={rowErrors ? errId : undefined}
                      placeholder="Full name"
                      autoComplete="off"
                      value={inv.name}
                      onChange={(e) => edit(inv.id, { name: e.target.value })}
                      className="col-span-2 md:col-span-1"
                      data-testid={`invite-name-${i}`}
                    />
                    <Input
                      aria-label={`Teammate ${n} email`}
                      aria-invalid={emailErr ? true : undefined}
                      aria-describedby={rowErrors ? errId : undefined}
                      type="email"
                      placeholder="name@clinic.in"
                      autoComplete="off"
                      value={inv.email}
                      onChange={(e) => edit(inv.id, { email: e.target.value })}
                      className="col-span-2 md:col-span-1"
                      data-testid={`invite-email-${i}`}
                    />
                    <div data-error-anchor={roleErr ? "true" : undefined} className="min-w-0">
                      <Select
                        ariaLabel={`Teammate ${n} role`}
                        value={inv.role}
                        placeholder="Role"
                        onValueChange={(v) => edit(inv.id, { role: v as InviteRow["role"] })}
                        options={roles.map((r) => ({ value: r, label: DEMO_USER[r].label, description: isPractitionerRole(r) ? "Practitioner · billed" : "Admin / reception seat" }))}
                        className={cn(roleErr && invalidRing)}
                      />
                    </div>
                    <IconButton label={`Remove ${inv.name.trim() || `teammate ${n}`}`} variant="ghost" onClick={() => remove(inv.id)} className="justify-self-end" data-testid={`remove-invite-${i}`}>
                      <Trash />
                    </IconButton>
                  </div>
                  <InlineError id={errId} className="mt-2 px-1">
                    {rowErrors}
                  </InlineError>
                </motion.li>
              );
            })}
          </AnimatePresence>
        </ul>

        {overP ? (
          <div role="alert" className="flex flex-col items-start gap-3 rounded-inner bg-danger-soft p-4 text-sm text-danger" data-error-anchor="true">
            <p>{errors["invites.practitioners"] ?? `${counts.practitioners} practitioners on the team, but the plan is billed for ${practitioners}.`}</p>
            <Button size="sm" variant="secondary" onClick={() => setPlan({ practitioners: counts.practitioners })} data-testid="fix-practitioners">
              Bill for {counts.practitioners} practitioners · +{formatINR((counts.practitioners - practitioners) * plan.price[billing])}/month
            </Button>
          </div>
        ) : null}
        {overS ? (
          <div role="alert" className="flex flex-col items-start gap-3 rounded-inner bg-danger-soft p-4 text-sm text-danger" data-error-anchor="true">
            <p>{errors["invites.seats"] ?? `${counts.staff} people need admin / reception seats, but you chose ${staffSeats} on the Plan step.`}</p>
            <Button size="sm" variant="secondary" onClick={() => setPlan({ staffSeats: counts.staff })} data-testid="fix-seats">
              Use {pluralize(counts.staff, "seat")} · {seatsCost(counts.staff) > 0 ? `+${formatINR(seatsCost(counts.staff))}/month` : `free on ${plan.name}`}
            </Button>
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-3">
          <Button variant="secondary" leading={<Plus />} onClick={addInvite} data-testid="add-invite">
            Add teammate
          </Button>
          <span className="text-xs text-muted">
            Roles on {plan.name}: {roles.map((r) => DEMO_USER[r].label).join(", ")}.{" "}
            <button type="button" onClick={() => goTo(1)} className="text-ink underline decoration-line-strong underline-offset-4 hover:decoration-ink">
              Change plan
            </button>
          </span>
        </div>
        <p className="text-xs text-muted">No invitations are sent from this prototype. Teammates are kept in this browser for the demo. Patients get the app from their own record on Pro.</p>
      </Card>
    </div>
  );
}

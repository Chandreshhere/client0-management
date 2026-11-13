"use client";

import { AnimatePresence, motion } from "motion/react";
import { Plus, Trash, UserPlus } from "@phosphor-icons/react";
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
import { invitableRoles, seatLimit, uid, userRangeText, type InviteRow } from "../model";
import { InlineError, type StepProps } from "../controls";

const COLS = "md:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)_184px_40px]";
const invalidRing = "shadow-[inset_0_0_0_1.5px_var(--color-danger)] hover:shadow-[inset_0_0_0_1.5px_var(--color-danger)]";

export function TeamStep({ data, update, errors, goTo }: StepProps) {
  const plan = planById(data.plan.id);
  const perUser = plan.pricing.kind === "per-user" ? plan.pricing : null;
  const limit = seatLimit(data);
  const used = 1 + data.invites.length;
  const roles = invitableRoles(plan.id);
  const ownerRole = DEMO_USER[plan.roles[0]].label;
  const full = used >= limit;
  const canBuySeat = perUser !== null && full && data.plan.users < perUser.maxUsers && used === limit;

  const setOwner = (patch: Partial<{ name: string; email: string }>) => update((d) => ({ ...d, owner: { ...d.owner, ...patch } }));
  const edit = (id: string, patch: Partial<InviteRow>) => update((d) => ({ ...d, invites: d.invites.map((x) => (x.id === id ? { ...x, ...patch } : x)) }));
  const remove = (id: string) => update((d) => ({ ...d, invites: d.invites.filter((x) => x.id !== id) }));
  const addInvite = () => update((d) => ({ ...d, invites: [...d.invites, { id: uid("inv"), name: "", email: "", role: "" }] }));
  const addSeatAndInvite = () =>
    update((d) => ({ ...d, plan: { ...d.plan, users: d.plan.users + 1 }, invites: [...d.invites, { id: uid("inv"), name: "", email: "", role: "" }] }));

  return (
    <div className="flex flex-col gap-4">
      {/* Seats vs plan limit */}
      <Card className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-xs text-muted">Seats · {plan.name} plan</p>
          <p className="mt-2 text-[26px] font-light leading-none tracking-[-0.01em] tabular text-ink" data-testid="seat-count">
            {perUser ? `${used} of ${limit} seats` : "1 practitioner workspace"}
          </p>
          <p className="mt-2 text-xs text-muted">
            {perUser ? `${userRangeText(plan)}. Seats follow the user count on the Plan step.` : "Starter is flat-fee and single-user: just you."}
          </p>
        </div>
        {perUser ? (
          <ProgressBar value={Math.min(used, limit)} max={limit} tone={used > limit ? "danger" : "dark"} label="Seats assigned" className="sm:w-48" />
        ) : (
          <Button variant="secondary" onClick={() => goTo(1)} data-testid="team-compare-plans">
            Compare plans
          </Button>
        )}
      </Card>

      <Card className="flex flex-col gap-4">
        <h2 className="text-lg font-normal tracking-[-0.01em] text-ink">People</h2>

        {/* Owner (the person setting up) */}
        <div className="flex flex-col gap-4 rounded-inner bg-canvas p-4">
          <div className="flex items-center gap-3">
            <Avatar name={data.owner.name || "You"} size="md" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm text-ink">{data.owner.name.trim() || "You"}</p>
              <p className="truncate text-xs text-muted">Starts in the {ownerRole.toLowerCase()} workspace · switch any time</p>
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

        {perUser ? (
          <>
            {data.invites.length ? (
              <div className={cn("hidden gap-3 px-1 text-xs text-muted md:grid", COLS)} aria-hidden="true">
                <span>Name</span>
                <span>Email</span>
                <span>Workspace</span>
                <span />
              </div>
            ) : null}
            <ul className="flex flex-col gap-3">
              <AnimatePresence initial={false}>
                {data.invites.map((inv, i) => {
                  const nameErr = errors[`invites.${inv.id}.name`];
                  const emailErr = errors[`invites.${inv.id}.email`];
                  const roleErr = errors[`invites.${inv.id}.role`];
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
                            ariaLabel={`Teammate ${n} workspace`}
                            value={inv.role}
                            placeholder="Workspace"
                            onValueChange={(v) => edit(inv.id, { role: v as InviteRow["role"] })}
                            options={roles.map((r) => ({ value: r, label: DEMO_USER[r].label }))}
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

            {errors["invites"] || used > limit ? (
              <div role="alert" className="flex flex-col items-start gap-3 rounded-inner bg-danger-soft p-4 text-sm text-danger" data-error-anchor="true">
                <p>{errors["invites"] ?? `${used} people need ${used} seats, but you chose ${limit} on the Plan step.`}</p>
                <Button size="sm" variant="secondary" onClick={() => goTo(1)}>
                  Change users on the Plan step
                </Button>
              </div>
            ) : null}

            <div className="flex flex-wrap items-center gap-3">
              {canBuySeat && perUser ? (
                <Button variant="secondary" leading={<UserPlus />} onClick={addSeatAndInvite} data-testid="add-seat">
                  Add a seat · +{formatINR(perUser.monthly)}/month
                </Button>
              ) : (
                <Button variant="secondary" leading={<Plus />} onClick={addInvite} disabled={full} data-testid="add-invite">
                  Add teammate
                </Button>
              )}
              <span className="text-xs text-muted">
                {full
                  ? perUser && data.plan.users >= perUser.maxUsers
                    ? `All ${pluralize(limit, "seat")} are assigned. ${plan.name} tops out at ${perUser.maxUsers} users.`
                    : `All ${pluralize(limit, "seat")} are assigned.`
                  : `${pluralize(limit - used, "seat")} left.`}
              </span>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-start gap-3 rounded-inner bg-canvas p-4">
            <p className="text-sm text-ink-2">Need a nutritionist, a yoga instructor or front desk in Carelane? Team covers up to 5 users.</p>
            {data.invites.length ? (
              <div role="alert" className="flex flex-col items-start gap-3 text-sm text-danger" data-error-anchor="true">
                <p>{errors["invites"] ?? `Starter can't hold the ${pluralize(data.invites.length, "teammate")} you added.`}</p>
                <Button size="sm" variant="secondary" onClick={() => update((d) => ({ ...d, invites: [] }))} data-testid="clear-invites">
                  Remove {pluralize(data.invites.length, "invite")}
                </Button>
              </div>
            ) : null}
          </div>
        )}
        <p className="text-xs text-muted">No invitations are sent from this prototype. Teammates are kept in this browser for the demo.</p>
      </Card>
    </div>
  );
}

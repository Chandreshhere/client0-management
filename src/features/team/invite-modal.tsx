"use client";

import { useEffect, useState } from "react";
import { EnvelopeSimple } from "@phosphor-icons/react";
import type { BranchId } from "@/data/types";
import { minPlanFor, planById, planHas, type PlanId } from "@/data/plans";
import { BRANCHES, STAFF } from "@/data/staff";
import { cn } from "@/lib/cn";
import { formatINR, pluralize } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, ModalContent } from "@/components/ui/dialog";
import { Field, Input, Select } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { usePlan, useRole } from "@/components/shell/role-context";
import { InfoNote, ROLE_LABEL } from "@/features/settings/ui";
import type { StaffRole } from "./data";
import { PLAN_RANGES, inviteCost, invitableRoles, isPractitionerRole, seatInfo, type SeatInfo } from "./seats";
import { CLINICAL_ROLES, addInvite, removeInvite, useTeamState } from "./store";

type Errors = Partial<Record<"name" | "email" | "role" | "branch", string>>;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Generic pip meter (kept for older callers): `used` filled, `ready` lighter, slots beyond `max` red. */
export function SeatMeter({ used, max, ready = 0, className }: { used: number; max: number; ready?: number; className?: string }) {
  const slots = Math.max(max, used + ready);
  return (
    <div
      role="meter"
      aria-label="Seats used"
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={Math.min(used + ready, max)}
      aria-valuetext={`${used} active accounts${ready ? ` and ${ready} ready invites` : ""} of ${max} seats`}
      className={cn("flex h-2.5 w-full gap-0.5", className)}
    >
      {Array.from({ length: slots }, (_, i) => (
        <span
          key={i}
          className={cn("min-w-0 flex-1 rounded-full", i < Math.min(used, max) ? "bg-charcoal" : i < max && i < used + ready ? "bg-ink-2/40" : i < max ? "bg-sunken-2" : "bg-danger")}
        />
      ))}
    </div>
  );
}

/** Admin / reception seats: one pip per seat — free seats used (charcoal), free seats open (grey), paid seats (cobalt). */
export function StaffSeatMeter({ seats, className }: { seats: SeatInfo; className?: string }) {
  const slots = Math.max(seats.freeSeats, seats.staff);
  return (
    <div
      role="meter"
      aria-label="Admin and reception seats"
      aria-valuemin={0}
      aria-valuemax={slots}
      aria-valuenow={seats.staff}
      aria-valuetext={`${seats.staff} admin and reception seats used: ${Math.min(seats.staff, seats.freeSeats)} of ${seats.freeSeats} free${seats.paidSeats ? `, ${seats.paidSeats} paid` : ""}`}
      className={cn("flex h-2.5 w-full gap-0.5", className)}
    >
      {Array.from({ length: slots }, (_, i) => (
        <span key={i} className={cn("min-w-0 flex-1 rounded-full", i >= seats.freeSeats ? "bg-primary" : i < seats.staff ? "bg-charcoal" : "bg-sunken-2")} />
      ))}
    </div>
  );
}

/**
 * The seat picture for a plan: practitioners billed each, admin / reception seats against the free
 * allowance, the monthly bill, and how the three plans compare. Used in the invite modal; the team
 * page can render it in place of its old seat-range card.
 */
export function SeatSummary({ plan, seats, className }: { plan: PlanId; seats: SeatInfo; className?: string }) {
  const p = planById(plan);
  return (
    <section aria-label="Seats" className={cn("flex flex-col gap-3 rounded-inner bg-sunken p-4", className)}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm text-ink">
          {pluralize(seats.practitioners, "practitioner")} · {seats.staff} admin / reception
          <span className="text-muted"> · {p.name} plan</span>
        </p>
        <p className="text-xs text-muted tabular">{formatINR(seats.monthly)} / month, billed annually</p>
      </div>
      <StaffSeatMeter seats={seats} />
      <p className="text-xs text-muted">
        Practitioners are billed {formatINR(p.price.annual)} each. Admin and reception seats: {Math.min(seats.staff, seats.freeSeats)} of {seats.freeSeats} free used
        {seats.paidSeats ? `, ${pluralize(seats.paidSeats, "extra seat")} at ${formatINR(seats.extraSeat)} each` : seats.freeLeft ? `, ${seats.freeLeft} free left` : ""}. Deactivating an account
        frees its seat.
      </p>
      <ul className="grid grid-cols-3 gap-2 text-xs" aria-label="Seat rules by plan">
        {PLAN_RANGES.map((r) => (
          <li
            key={r.id}
            aria-current={r.id === plan ? "true" : undefined}
            className={cn("rounded-[12px] px-3 py-2", r.id === plan ? "bg-surface text-ink shadow-[inset_0_0_0_1px_var(--color-line-strong)]" : "text-muted")}
          >
            <span className="block">{r.name}</span>
            <span className="block tabular">{r.range}</span>
            <span className="block tabular">{r.detail}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function InviteModal({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { toast } = useToast();
  const { user } = useRole();
  const { plan } = usePlan();
  const state = useTeamState();
  const seats = seatInfo(plan, state.deactivated, state.invites);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<StaffRole | "">("");
  const [branch, setBranch] = useState<BranchId>("indiranagar");
  const [errors, setErrors] = useState<Errors>({});

  useEffect(() => {
    if (!open) return;
    setName("");
    setEmail("");
    setRole("");
    setBranch("indiranagar");
    setErrors({});
  }, [open]);

  const roles = invitableRoles(plan);
  const branches = planHas(plan, "branches") ? BRANCHES : BRANCHES.slice(0, 1);
  const cost = role ? inviteCost(plan, role, seats) : null;

  function validate(): Errors {
    const e: Errors = {};
    if (name.trim().length < 2) e.name = "Enter their full name.";
    const em = email.trim().toLowerCase();
    if (!em) e.email = "Enter a work email.";
    else if (!EMAIL.test(em)) e.email = "That doesn't look like an email address.";
    else if (STAFF.some((s) => s.email.toLowerCase() === em)) e.email = "Someone on the team already uses this email.";
    else if (state.invites.some((i) => i.email.toLowerCase() === em)) e.email = "There's already a draft invite for this email.";
    if (!role) e.role = "Choose their role.";
    else if (!roles.includes(role)) e.role = `${ROLE_LABEL(role)} isn't part of the ${planById(plan).name} plan.`;
    return e;
  }

  function submit() {
    const e = validate();
    setErrors(e);
    if (Object.keys(e).length || !role) return;
    const added = inviteCost(plan, role, seats);
    const inv = addInvite({ name: name.trim(), email: email.trim().toLowerCase(), role, branch, status: "ready" }, user.id);
    onOpenChange(false);
    toast({
      tone: "success",
      title: "Invite drafted — not sent",
      description: `${inv.name} · ${ROLE_LABEL(inv.role)}. ${added.text} Email isn't connected in this prototype, so nothing was sent.${CLINICAL_ROLES.includes(inv.role) ? " Clinical access would still need the clinical lead's approval." : ""}`,
      action: { label: "Undo", onClick: () => removeInvite(inv.id, user.id) },
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <ModalContent
        size="md"
        title="Invite staff"
        description={`They sign in with their role — only ${planById(plan).name} plan roles are offered. Nothing is emailed from this prototype.`}
        footer={
          <>
            <DialogClose asChild>
              <Button variant="ghost">Cancel</Button>
            </DialogClose>
            <Button variant="dark" leading={<EnvelopeSimple />} onClick={submit}>
              Draft invite
            </Button>
          </>
        }
      >
        <form
          className="flex flex-col gap-5"
          noValidate
          onSubmit={(ev) => {
            ev.preventDefault();
            submit();
          }}
        >
          <SeatSummary plan={plan} seats={seats} />

          <Field label="Full name" error={errors.name}>
            {(a) => <Input {...a} autoComplete="off" value={name} onChange={(e) => { setName(e.target.value); if (errors.name) setErrors((x) => ({ ...x, name: undefined })); }} placeholder="e.g. Dr. Kiran Shetty" />}
          </Field>
          <Field label="Work email" error={errors.email}>
            {(a) => <Input {...a} type="email" autoComplete="off" value={email} onChange={(e) => { setEmail(e.target.value); if (errors.email) setErrors((x) => ({ ...x, email: undefined })); }} placeholder="name@prana.example" />}
          </Field>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <Field label="Role" error={errors.role} hint={cost ? cost.text : undefined}>
              {(a) => (
                <Select
                  id={a.id}
                  aria-invalid={a["aria-invalid"]}
                  aria-describedby={a["aria-describedby"]}
                  ariaLabel="Role"
                  placeholder="Choose a role"
                  value={role || undefined}
                  onValueChange={(v) => { setRole(v as StaffRole); setErrors((x) => ({ ...x, role: undefined })); }}
                  options={roles.map((r) => ({ value: r, label: ROLE_LABEL(r), description: isPractitionerRole(r) ? "Practitioner · billed each" : "Admin / reception seat" }))}
                />
              )}
            </Field>
            <Field label="Branch" hint={branches.length === 1 && BRANCHES.length > 1 ? `Several branches are part of ${minPlanFor("branches").name}` : undefined}>
              {(a) => <Select id={a.id} ariaLabel="Branch" value={branch} onValueChange={(v) => setBranch(v as BranchId)} options={branches.map((b) => ({ value: b.id, label: b.name, description: b.city }))} />}
            </Field>
          </div>
          {role && CLINICAL_ROLES.includes(role) ? <InfoNote>Clinical access needs the clinical lead&apos;s approval.</InfoNote> : null}
          <InfoNote>Saved in this browser session as a draft. No email is sent and no account is created — sign-in isn&apos;t part of this prototype.</InfoNote>
          <button type="submit" className="sr-only" tabIndex={-1}>
            Draft invite
          </button>
        </form>
      </ModalContent>
    </Dialog>
  );
}

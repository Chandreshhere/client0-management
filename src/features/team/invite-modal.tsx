"use client";

import { useEffect, useState } from "react";
import { EnvelopeSimple } from "@phosphor-icons/react";
import type { BranchId } from "@/data/types";
import { BRANCHES, STAFF } from "@/data/staff";
import { cn } from "@/lib/cn";
import { pluralize } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, ModalContent } from "@/components/ui/dialog";
import { Field, Input, Select } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { usePlan, useRole } from "@/components/shell/role-context";
import { InfoNote, ROLE_LABEL } from "@/features/settings/ui";
import type { StaffRole } from "./data";
import { PLAN_RANGES, seatInfo } from "./seats";
import { CLINICAL_ROLES, addInvite, removeInvite, useTeamState } from "./store";

type Errors = Partial<Record<"name" | "email" | "role" | "branch", string>>;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Seat meter: one pip per seat in the plan range; accounts beyond it show as red overflow pips. */
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

  const roles: StaffRole[] = plan === "clinic" ? ["doctor", "nutritionist", "yoga", "frontdesk", "coordinator", "admin"] : plan === "team" ? ["doctor", "nutritionist", "yoga", "frontdesk"] : ["doctor"];
  const seatFree = seats.free > 0;

  function validate(): Errors {
    const e: Errors = {};
    if (name.trim().length < 2) e.name = "Enter their full name.";
    const em = email.trim().toLowerCase();
    if (!em) e.email = "Enter a work email.";
    else if (!EMAIL.test(em)) e.email = "That doesn't look like an email address.";
    else if (STAFF.some((s) => s.email.toLowerCase() === em)) e.email = "Someone on the team already uses this email.";
    else if (state.invites.some((i) => i.email.toLowerCase() === em)) e.email = "There's already a draft invite for this email.";
    if (!role) e.role = "Choose the workspace they'll use.";
    return e;
  }

  function submit() {
    const e = validate();
    setErrors(e);
    if (Object.keys(e).length || !role) return;
    const inv = addInvite({ name: name.trim(), email: email.trim().toLowerCase(), role, branch, status: seatFree ? "ready" : "needs-seat" }, user.id);
    onOpenChange(false);
    toast({
      tone: seatFree ? "success" : "warning",
      title: seatFree ? "Invite drafted — not sent" : "Invite saved — waiting for a seat",
      description: `${inv.name} · ${ROLE_LABEL(inv.role)}. Email isn't connected in this prototype, so nothing was sent.${CLINICAL_ROLES.includes(inv.role) ? " Clinical access would still need the clinical lead's approval." : ""}`,
      action: { label: "Undo", onClick: () => removeInvite(inv.id, user.id) },
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <ModalContent
        size="md"
        title="Invite staff"
        description="They get a workspace for their role. Nothing is emailed from this prototype."
        footer={
          <>
            <DialogClose asChild>
              <Button variant="ghost">Cancel</Button>
            </DialogClose>
            <Button variant="dark" leading={<EnvelopeSimple />} onClick={submit}>
              {seatFree ? "Draft invite" : "Save — needs a seat"}
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
          <section aria-label="Seats" className="flex flex-col gap-3 rounded-inner bg-sunken p-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="text-sm text-ink">
                {seats.flat ? "Single-practitioner workspace" : `${seats.active + seats.ready} of ${seats.max} seats`}
                <span className="text-muted"> · {seats.planName} plan</span>
              </p>
              <p className={cn("text-xs", seats.over ? "text-danger" : seatFree ? "text-muted" : "text-warning")}>
                {seats.over ? `${pluralize(seats.over, "account")} over the plan range` : seatFree ? `${pluralize(seats.free, "seat")} free` : "No free seat"}
              </p>
            </div>
            <SeatMeter used={seats.active} ready={seats.ready} max={seats.max} />
            <ul className="grid grid-cols-3 gap-2 text-xs" aria-label="Plan ranges">
              {PLAN_RANGES.map((p) => (
                <li key={p.id} className={cn("rounded-[12px] px-3 py-2", p.id === plan ? "bg-surface text-ink shadow-[inset_0_0_0_1px_var(--color-line-strong)]" : "text-muted")}>
                  <span className="block">{p.name}</span>
                  <span className="block tabular">{p.range}</span>
                </li>
              ))}
            </ul>
            <p className="text-xs text-muted">
              {seats.active} active {seats.active === 1 ? "account" : "accounts"}
              {seats.ready ? ` + ${seats.ready} ready ${seats.ready === 1 ? "invite" : "invites"}` : ""}
              {seats.waiting ? ` · ${seats.waiting} waiting for a seat` : ""}. Deactivating an account frees its seat.
            </p>
          </section>

          <Field label="Full name" error={errors.name}>
            {(a) => <Input {...a} autoComplete="off" value={name} onChange={(e) => { setName(e.target.value); if (errors.name) setErrors((x) => ({ ...x, name: undefined })); }} placeholder="e.g. Dr. Kiran Shetty" />}
          </Field>
          <Field label="Work email" error={errors.email}>
            {(a) => <Input {...a} type="email" autoComplete="off" value={email} onChange={(e) => { setEmail(e.target.value); if (errors.email) setErrors((x) => ({ ...x, email: undefined })); }} placeholder="name@prana.example" />}
          </Field>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <Field label="Workspace" error={errors.role} hint={role && CLINICAL_ROLES.includes(role) ? "Clinical access needs the clinical lead's approval" : undefined}>
              {(a) => (
                <Select
                  id={a.id}
                  aria-invalid={a["aria-invalid"]}
                  aria-describedby={a["aria-describedby"]}
                  ariaLabel="Workspace"
                  placeholder="Choose a role"
                  value={role || undefined}
                  onValueChange={(v) => { setRole(v as StaffRole); setErrors((x) => ({ ...x, role: undefined })); }}
                  options={roles.map((r) => ({ value: r, label: ROLE_LABEL(r) }))}
                />
              )}
            </Field>
            <Field label="Branch">
              {(a) => <Select id={a.id} ariaLabel="Branch" value={branch} onValueChange={(v) => setBranch(v as BranchId)} options={(plan === "clinic" ? BRANCHES : BRANCHES.slice(0, 1)).map((b) => ({ value: b.id, label: b.name, description: b.city }))} />}
            </Field>
          </div>
          <InfoNote>Saved in this browser session as a draft. No email is sent and no account is created — sign-in isn&apos;t part of this prototype.</InfoNote>
          <button type="submit" className="sr-only" tabIndex={-1}>
            Draft invite
          </button>
        </form>
      </ModalContent>
    </Dialog>
  );
}

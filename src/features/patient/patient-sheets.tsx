"use client";

import Link from "next/link";
import { CheckCircle, Circle, CircleHalf, IdentificationCard, Phone, MapPin, ShieldCheck } from "@phosphor-icons/react";
import type { Patient } from "@/data/types";
import { useRecord } from "./record-context";
import { clinicNumber, PATIENT_STATUS_LABEL } from "@/data/patients";
import { staffById } from "@/data/staff";
import { formatDate } from "@/lib/format";
import { Dialog, SheetContent } from "@/components/ui/dialog";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status";
import { authorName, authorAvatar } from "./event-meta";

/** Shared care plan (doc §5A) — goal, accountable clinician, discipline plans, next review, open actions. */
export function CarePlanSheet({ open, onOpenChange, patient }: { open: boolean; onOpenChange: (v: boolean) => void; patient: Patient }) {
  const { record } = useRecord();
  const CARE_PLAN = record.carePlan;
  if (!CARE_PLAN) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <SheetContent title="Shared care plan" description={patient.name}>
          <p className="text-sm text-muted">No shared care plan has been created yet. A plan links the goal, the accountable clinician and each discipline&apos;s current plan.</p>
        </SheetContent>
      </Dialog>
    );
  }
  const responsible = staffById(CARE_PLAN.responsible);
  const rows = [
    { label: "Medical guidance", plan: CARE_PLAN.medical },
    { label: "Nutrition plan", plan: CARE_PLAN.nutrition },
    { label: "Movement plan", plan: CARE_PLAN.movement },
  ];
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <SheetContent title="Shared care plan" description={`${patient.name} · ${CARE_PLAN.episode}`} footer={<Button asChild variant="dark"><Link href="/referrals">Open referrals</Link></Button>}>
        <section className="rounded-inner bg-primary p-4 text-white">
          <p className="text-xs text-white/70">Goal for this care episode</p>
          <p className="mt-1 text-sm leading-relaxed">{CARE_PLAN.goal}</p>
        </section>
        <div className="mt-4 flex items-center gap-3 rounded-inner bg-canvas p-4">
          {responsible ? <Avatar src={responsible.avatar} name={responsible.name} size="md" /> : null}
          <div>
            <p className="text-xs text-muted">Responsible clinician</p>
            <p className="text-sm text-ink">{responsible?.name ?? "Not assigned yet"}</p>
          </div>
        </div>
        <div className="mt-4 flex flex-col gap-2">
          {rows.map((r) =>
            r.plan ? (
              <div key={r.label} className="rounded-inner p-4 shadow-[inset_0_0_0_1px_var(--color-line)]">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm text-ink">{r.label}</p>
                  <span className="flex items-center gap-1.5 text-xs text-muted">
                    <Avatar src={authorAvatar(r.plan.by)} name={authorName(r.plan.by)} size="xs" />
                    {authorName(r.plan.by)} · {formatDate(r.plan.updated, { day: "numeric", month: "short" })}
                  </span>
                </div>
                <p className="mt-2 text-sm leading-relaxed text-ink-2">{r.plan.text}</p>
              </div>
            ) : (
              <div key={r.label} className="rounded-inner border border-dashed border-line-strong p-4 text-sm text-muted">
                {r.label}: no clinician from this discipline is on the care team.
              </div>
            ),
          )}
        </div>
        <div className="mt-4 rounded-inner bg-canvas p-4">
          <p className="text-xs text-muted">Next review</p>
          <p className="mt-0.5 text-sm text-ink">
            {CARE_PLAN.nextReview
              ? `${CARE_PLAN.nextReview.label} · ${formatDate(CARE_PLAN.nextReview.at, { weekday: "short", day: "numeric", month: "short" })} with ${staffById(CARE_PLAN.nextReview.with)?.name ?? "the care team"}`
              : "Not booked — no upcoming appointment on the diary."}
          </p>
        </div>
        <h3 className="mt-6 text-xs text-muted">Open actions</h3>
        {CARE_PLAN.actions.length === 0 ? <p className="mt-2 text-sm text-muted">No open actions.</p> : null}
        <ul className="mt-2 flex flex-col gap-1">
          {CARE_PLAN.actions.map((a) => (
            <li key={a.id} className="flex items-center gap-3 rounded-[14px] p-2">
              {a.status === "done" ? <CheckCircle size={20} weight="fill" className="text-success" aria-label="Done" /> : a.status === "in-progress" ? <CircleHalf size={20} className="text-primary" aria-label="In progress" /> : <Circle size={20} className="text-faint" aria-label="Open" />}
              <span className="min-w-0 flex-1">
                <span className={a.status === "done" ? "block text-sm text-muted line-through" : "block text-sm text-ink"}>{a.label}</span>
                <span className="block text-xs text-muted">{authorName(a.owner)} · due {formatDate(a.due, { day: "numeric", month: "short" })}</span>
              </span>
            </li>
          ))}
        </ul>
      </SheetContent>
    </Dialog>
  );
}

/** Patient profile: identity, contact, care team, programme, record identifiers (clinic no. ≠ ABHA). */
export function ProfileSheet({ open, onOpenChange, patient }: { open: boolean; onOpenChange: (v: boolean) => void; patient: Patient }) {
  const team = [
    { role: "Doctor", id: patient.careTeam.doctor },
    { role: "Nutritionist", id: patient.careTeam.nutritionist },
    { role: "Yoga instructor", id: patient.careTeam.yoga },
    { role: "Care coordinator", id: patient.careTeam.coordinator },
  ];
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <SheetContent title={patient.name} description={`${patient.age} years · ${patient.sex}`}>
        <div className="flex items-center gap-4">
          <Avatar src={patient.avatar} name={patient.name} size="xl" />
          <div className="flex flex-wrap gap-2">
            <StatusBadge tone={patient.status === "needs-attention" ? "warning" : patient.status === "active" ? "success" : "neutral"}>{PATIENT_STATUS_LABEL[patient.status]}</StatusBadge>
            {patient.program ? <StatusBadge tone="info" dot={false}>{patient.program}</StatusBadge> : null}
          </div>
        </div>
        <dl className="mt-6 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
          <div className="flex items-start gap-3 rounded-inner bg-canvas p-4">
            <IdentificationCard size={18} className="mt-0.5 text-muted" />
            <div><dt className="text-xs text-muted">Clinic number</dt><dd className="font-mono text-xs text-ink">{clinicNumber(patient.id)}</dd></div>
          </div>
          <div className="flex items-start gap-3 rounded-inner bg-canvas p-4">
            <ShieldCheck size={18} className="mt-0.5 text-muted" />
            <div><dt className="text-xs text-muted">ABHA (voluntary, consent-based)</dt><dd className="text-ink">{patient.abhaLinked ? "Linked" : "Not linked"}</dd></div>
          </div>
          <div className="flex items-start gap-3 rounded-inner bg-canvas p-4">
            <Phone size={18} className="mt-0.5 text-muted" />
            <div><dt className="text-xs text-muted">Phone (masked)</dt><dd className="text-ink">{patient.phone}</dd></div>
          </div>
          <div className="flex items-start gap-3 rounded-inner bg-canvas p-4">
            <MapPin size={18} className="mt-0.5 text-muted" />
            <div><dt className="text-xs text-muted">Area</dt><dd className="text-ink">{patient.area}</dd></div>
          </div>
        </dl>
        <h3 className="mt-6 text-xs text-muted">Care team</h3>
        <ul className="mt-2 flex flex-col gap-1">
          {team.map((t) => {
            const s = staffById(t.id);
            return (
              <li key={t.role} className="flex items-center gap-3 rounded-[14px] p-2">
                {s ? <Avatar src={s.avatar} name={s.name} size="sm" /> : <span className="size-8 rounded-full border border-dashed border-line-strong" aria-hidden="true" />}
                <span className="min-w-0 flex-1">
                  <span className="block text-sm text-ink">{s?.name ?? "Not assigned"}</span>
                  <span className="block text-xs text-muted">{t.role}</span>
                </span>
              </li>
            );
          })}
        </ul>
        <p className="mt-6 text-xs text-muted">Registered {formatDate(patient.registeredAt)} · synthetic record</p>
      </SheetContent>
    </Dialog>
  );
}

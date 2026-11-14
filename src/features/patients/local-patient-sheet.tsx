"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CalendarBlank, FirstAid, IdentificationCard, MapPin, Phone, ShieldCheck, Stethoscope, Translate, Users } from "@phosphor-icons/react";
import type { Appointment } from "@/data/types";
import { staffById } from "@/data/staff";
import { formatDate, formatTime } from "@/lib/format";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Dialog, SheetContent } from "@/components/ui/dialog";
import { StatusBadge } from "@/components/ui/status";
import { branchLabel, clinicNoOf, dayWord, formatAbha, type RegistryLens, type RegistryPatient } from "./data";
import { AllergyLine, PatientStatusBadge } from "./registry-bits";

/** Record view for a patient registered in this browser session (no server page exists for them). */
export function LocalPatientSheet({
  patient,
  visit,
  pool,
  lens,
  onReview,
  onOpenChange,
  onDiscard,
}: {
  patient: RegistryPatient | null;
  visit: Appointment | null;
  pool: RegistryPatient[];
  lens: RegistryLens;
  onReview: (id: string) => void;
  onOpenChange: (open: boolean) => void;
  onDiscard: (id: string) => void;
}) {
  const [confirming, setConfirming] = useState(false);
  useEffect(() => setConfirming(false), [patient?.id]);
  const local = patient?.local;
  const staff = visit ? staffById(visit.staffId) : undefined;
  const doctor = patient ? staffById(patient.careTeam.doctor) : undefined;
  const dupes = local ? local.duplicateOf.map((id) => pool.find((p) => p.id === id)).filter((p): p is RegistryPatient => !!p) : [];

  return (
    <Dialog open={!!patient} onOpenChange={onOpenChange}>
      {patient && local ? (
        <SheetContent
          title={patient.name}
          description="Registered in this browser session — not stored on a server."
          footer={
            <>
              {confirming ? (
                <>
                  <span className="mr-auto text-xs text-muted">Remove this registration from the session?</span>
                  <Button variant="ghost" onClick={() => setConfirming(false)}>Keep</Button>
                  <Button variant="danger" onClick={() => onDiscard(patient.id)}>Discard</Button>
                </>
              ) : (
                <>
                  <Button variant="ghost" className="mr-auto text-danger hover:bg-danger-soft" onClick={() => setConfirming(true)}>
                    Discard registration
                  </Button>
                  {lens.canBook ? (
                    <Button asChild variant="dark">
                      <Link href={`/schedule?new=1&patient=${patient.id}`}>Book appointment</Link>
                    </Button>
                  ) : null}
                </>
              )}
            </>
          }
        >
          <div className="flex items-center gap-4">
            <Avatar src={patient.avatar} name={patient.name} size="xl" />
            <div className="flex flex-wrap gap-2">
              {lens.clinical ? <PatientStatusBadge status={patient.status} /> : null}
              <StatusBadge tone="warning">Intake pending</StatusBadge>
              {dupes.length ? <StatusBadge tone="info">Duplicate review pending</StatusBadge> : null}
            </div>
          </div>

          <dl className="mt-6 grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
            <Item icon={<IdentificationCard size={18} />} term="Clinic number">
              <span className="font-mono text-xs">{clinicNoOf(patient)}</span>
            </Item>
            <Item icon={<ShieldCheck size={18} />} term="ABHA (voluntary)">
              {local.abha ? (
                <>
                  <span className="font-mono text-xs">{formatAbha(local.abha)}</span>
                  <span className="block text-xs text-muted">Recorded, not verified</span>
                </>
              ) : (
                "Not provided"
              )}
            </Item>
            <Item icon={<CalendarBlank size={18} />} term="Date of birth">
              {formatDate(`${local.dob}T00:00:00+05:30`)} · {patient.age} y · {patient.sex}
            </Item>
            <Item icon={<Phone size={18} />} term="Mobile (masked)">
              {patient.phone}
            </Item>
            <Item icon={<MapPin size={18} />} term={lens.branches ? "Address · branch" : "Address"}>
              {local.address ?? patient.area}
              {lens.branches ? <span className="block text-xs text-muted">{branchLabel(patient.branch)}</span> : null}
            </Item>
            <Item icon={<FirstAid size={18} />} term="Emergency contact">
              {local.emergency ? (
                <>
                  {local.emergency.name}
                  <span className="block font-mono text-xs text-muted">{local.emergency.phone}</span>
                </>
              ) : (
                "Not recorded"
              )}
            </Item>
            <Item icon={<Stethoscope size={18} />} term="Primary doctor">
              {doctor?.name ?? "Not assigned"}
            </Item>
            <Item icon={<Translate size={18} />} term="Language">
              {local.language}
              {local.email ? <span className="block truncate text-xs text-muted">{local.email}</span> : null}
            </Item>
          </dl>

          {lens.clinical ? (
            <section className="mt-6">
              <h3 className="text-xs text-muted">Reason for visit</h3>
              <p className="mt-1 text-sm text-ink">{patient.primaryConcern || "Not recorded yet"}</p>
              <AllergyLine allergies={patient.allergies} className="mt-2" />
            </section>
          ) : null}

          {lens.diary ? (
            <section className="mt-6">
              <h3 className="text-xs text-muted">First visit</h3>
              {visit ? (
                <div className="mt-2 flex items-center gap-3 rounded-inner bg-canvas p-4">
                  {staff ? <Avatar src={staff.avatar} name={staff.name} size="md" /> : null}
                  <div className="min-w-0">
                    <p className="text-sm text-ink">
                      {dayWord(visit.start)} · <span className="font-mono text-xs">{formatTime(visit.start)}</span> · {visit.service}
                    </p>
                    <p className="truncate text-xs text-muted">
                      {staff?.name ?? "Practitioner"} · {visit.room} · held in this session
                    </p>
                  </div>
                </div>
              ) : (
                <p className="mt-1 text-sm text-muted">Not booked yet.</p>
              )}
            </section>
          ) : null}

          {dupes.length ? (
            <section className="mt-6">
              <h3 className="flex items-center gap-1.5 text-xs text-muted">
                <Users size={14} aria-hidden="true" /> Possible matches for review
              </h3>
              <ul className="mt-2 flex flex-col gap-1">
                {dupes.map((d) => (
                  <li key={d.id} className="flex items-center gap-3 rounded-[14px] p-2">
                    <Avatar src={d.avatar} name={d.name} size="sm" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm text-ink">{d.name}</span>
                      <span className="block font-mono text-xs text-muted">{clinicNoOf(d)}</span>
                    </span>
                    {d.local ? null : (
                      <Link href={`/patients/${d.id}`} className="text-xs text-ink underline decoration-line-strong underline-offset-2 hover:decoration-ink">
                        Open
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
              {lens.canMerge ? (
                <Button size="sm" variant="secondary" className="mt-2" onClick={() => onReview(patient.id)}>
                  Review possible duplicate
                </Button>
              ) : (
                <p className="mt-2 text-xs text-muted">Records are never merged automatically — the admin reviews them.</p>
              )}
            </section>
          ) : null}

          <p className="mt-6 text-xs text-muted">
            Registered by {local.registeredBy} · DPDP consent recorded by {local.consentBy ?? local.registeredBy},{" "}
            {formatDate(local.consentAt, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false })}
          </p>
        </SheetContent>
      ) : null}
    </Dialog>
  );
}

function Item({ icon, term, children }: { icon: React.ReactNode; term: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 rounded-inner bg-canvas p-4">
      <span className="mt-0.5 text-muted" aria-hidden="true">
        {icon}
      </span>
      <div className="min-w-0">
        <dt className="text-xs text-muted">{term}</dt>
        <dd className="text-ink">{children}</dd>
      </div>
    </div>
  );
}

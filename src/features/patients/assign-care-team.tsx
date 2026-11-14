"use client";

import { useState } from "react";
import type { Patient } from "@/data/types";
import { staffById } from "@/data/staff";
import { usePlan } from "@/components/shell/role-context";
import { Avatar, AvatarStack } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Dialog, ModalContent } from "@/components/ui/dialog";
import { Field, Input, Select } from "@/components/ui/input";
import { CARE_SLOTS, NONE, branchLabel, clinicNoOf, staffWithRole, type CareSlot, type RegistryPatient } from "./data";

type CareTeam = Patient["careTeam"];
export type AssignTarget = { mode: "team"; id: string } | { mode: "coordinator"; ids: string[] };

const cleanTeam = (t: Record<string, string | undefined>): CareTeam =>
  Object.fromEntries(Object.entries(t).filter(([, v]) => !!v && v !== NONE)) as CareTeam;

function optionsFor(role: (typeof CARE_SLOTS)[number]["role"], branches: boolean) {
  return [
    ...staffWithRole(role).map((s) => ({
      value: s.id,
      label: s.name,
      description: s.status === "on-leave" ? `${s.workingHours}` : branches ? `${s.title} · ${branchLabel(s.branch)}` : s.title,
    })),
    { value: NONE, label: "Not assigned" },
  ];
}

const leaveNote = (id: string | undefined) => {
  const s = staffById(id);
  return s?.status === "on-leave" ? `${s.name} — ${s.workingHours}. Consider temporary cover.` : undefined;
};

/** Assign a patient's care team, or a coordinator for several patients at once (doc §2A). */
export function AssignCareTeamModal({
  target,
  patients,
  onClose,
  onSave,
}: {
  target: AssignTarget | null;
  patients: RegistryPatient[];
  onClose: () => void;
  onSave: (teams: Record<string, CareTeam>, summary: { title: string; description: string }) => void;
}) {
  return (
    <Dialog open={!!target} onOpenChange={(o) => !o && onClose()}>
      {target?.mode === "team" ? (
        <TeamBody key={target.id} patient={patients.find((p) => p.id === target.id)} onClose={onClose} onSave={onSave} />
      ) : target?.mode === "coordinator" ? (
        <CoordinatorBody key={target.ids.join(",")} patients={patients.filter((p) => target.ids.includes(p.id))} onClose={onClose} onSave={onSave} />
      ) : null}
    </Dialog>
  );
}

const footerNote = "Recorded in the activity log. Kept in this browser session.";

function TeamBody({ patient, onClose, onSave }: { patient: RegistryPatient | undefined; onClose: () => void; onSave: Parameters<typeof AssignCareTeamModal>[0]["onSave"] }) {
  const { has } = usePlan();
  const [team, setTeam] = useState<Record<CareSlot, string>>(() => ({
    doctor: patient?.careTeam.doctor ?? NONE,
    nutritionist: patient?.careTeam.nutritionist ?? NONE,
    yoga: patient?.careTeam.yoga ?? NONE,
    coordinator: patient?.careTeam.coordinator ?? NONE,
  }));
  const [reason, setReason] = useState("");
  if (!patient) return null;
  // Care coordinators exist on Pro only; the slot isn't offered below it.
  const slots = CARE_SLOTS.filter((s) => s.key !== "coordinator" || has("coordinator"));

  const save = () => {
    const next = cleanTeam(team);
    const changed = slots.filter((s) => (patient.careTeam[s.key] ?? NONE) !== team[s.key]).length;
    onSave(
      { [patient.id]: next },
      {
        title: changed ? `Care team updated for ${patient.name}` : `No changes for ${patient.name}`,
        description: changed ? `${changed} ${changed === 1 ? "role" : "roles"} changed${reason.trim() ? ` · “${reason.trim()}”` : ""}. Recorded in the activity log.` : "The care team was already set this way.",
      },
    );
  };

  return (
    <ModalContent
      title="Assign care team"
      description={`${patient.name} · ${clinicNoOf(patient)}`}
      footer={
        <>
          <p className="mr-auto max-w-[44ch] text-xs text-muted">{footerNote}</p>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="dark" onClick={save}>Save care team</Button>
        </>
      }
    >
      <form
        className="grid grid-cols-1 gap-4 sm:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        {slots.map((slot) => (
          <Field key={slot.key} label={slot.key === "doctor" ? "Primary doctor" : slot.label} hint={slot.key === "doctor" && !leaveNote(team[slot.key]) ? "Reviews this patient's reports and answers flags." : leaveNote(team[slot.key])}>
            {({ id }) => (
              <Select id={id} value={team[slot.key]} onValueChange={(v) => setTeam((t) => ({ ...t, [slot.key]: v }))} options={optionsFor(slot.role, has("branches"))} className="w-full" />
            )}
          </Field>
        ))}
        <Field label="Reason" optional className="sm:col-span-2" hint="For example: cover during leave, patient request, programme change.">
          {(p) => <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Why is the care team changing?" {...p} />}
        </Field>
        <button type="submit" className="sr-only">Save care team</button>
      </form>
    </ModalContent>
  );
}

function CoordinatorBody({ patients, onClose, onSave }: { patients: RegistryPatient[]; onClose: () => void; onSave: Parameters<typeof AssignCareTeamModal>[0]["onSave"] }) {
  const { has } = usePlan();
  const coordinators = staffWithRole("coordinator");
  const [value, setValue] = useState<string>(coordinators[0]?.id ?? NONE);
  const person = staffById(value);

  const save = () => {
    const teams: Record<string, CareTeam> = {};
    for (const p of patients) teams[p.id] = cleanTeam({ ...p.careTeam, coordinator: value });
    onSave(teams, {
      title: person ? `${person.name} assigned to ${patients.length} ${patients.length === 1 ? "patient" : "patients"}` : `Coordinator removed from ${patients.length} ${patients.length === 1 ? "patient" : "patients"}`,
      description: "Recorded in the activity log.",
    });
  };

  return (
    <ModalContent
      size="sm"
      title="Assign coordinator"
      description={`${patients.length} selected ${patients.length === 1 ? "patient" : "patients"}`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="dark" onClick={save}>Assign</Button>
        </>
      }
    >
      <div className="flex items-center gap-3 rounded-inner bg-canvas p-3">
        <AvatarStack people={patients.map((p) => ({ name: p.name, avatar: p.avatar }))} max={5} size="sm" />
        <p className="min-w-0 flex-1 truncate text-xs text-muted">{patients.map((p) => p.name).join(", ")}</p>
      </div>
      <Field label="Care coordinator" className="mt-4" hint="Owns follow-up for stalled care, missed sessions and referrals.">
        {({ id }) => <Select id={id} value={value} onValueChange={setValue} options={optionsFor("coordinator", has("branches"))} className="w-full" />}
      </Field>
      {person ? (
        <div className="mt-4 flex items-center gap-3">
          <Avatar src={person.avatar} name={person.name} size="sm" />
          <p className="text-xs text-muted">{person.name} · {person.workingHours}</p>
        </div>
      ) : null}
      <p className="mt-4 text-xs text-muted">{footerNote}</p>
    </ModalContent>
  );
}

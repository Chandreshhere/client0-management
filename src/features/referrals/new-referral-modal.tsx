"use client";

import { useEffect, useMemo, useState } from "react";
import type { Discipline, Priority } from "@/data/types";
import { patientById } from "@/data/patients";
import { staffById } from "@/data/staff";
import { DISCIPLINE_LABEL } from "@/data/appointments";
import { Dialog, ModalContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { Segmented } from "@/components/ui/segmented";
import { useToast } from "@/components/ui/toast";
import { useRole } from "@/components/shell/role-context";
import { createTask } from "@/features/tasks/store";
import { PRIORITY_LABEL } from "@/features/tasks/task-meta";
import { DISCIPLINE_DOT, isClinician, patientOptions, staffOptions } from "@/features/tasks/people";
import { TODAY_KEY, addDays, isoAt, shortDay } from "@/features/tasks/time";
import { cn } from "@/lib/cn";
import { createReferral, type CareReferral } from "./store";

const TARGETS: Discipline[] = ["nutrition", "movement", "medical"];
const CARE_TEAM_KEY: Record<Discipline, "doctor" | "nutritionist" | "yoga" | "coordinator"> = { medical: "doctor", nutrition: "nutritionist", movement: "yoga", operations: "coordinator" };

/** New referral: starts at "Requested" and waits for the receiving practitioner to accept. */
export function NewReferralModal({ open, onOpenChange, onCreated }: { open: boolean; onOpenChange: (o: boolean) => void; onCreated: (r: CareReferral) => void }) {
  const { user, role } = useRole();
  const { toast } = useToast();
  const clinician = isClinician(role);
  const [fromId, setFromId] = useState(clinician ? user.id : "s-ananya");
  const [patientId, setPatientId] = useState("");
  const [discipline, setDiscipline] = useState<Discipline>("nutrition");
  const [toId, setToId] = useState("");
  const [reason, setReason] = useState("");
  const [priority, setPriority] = useState<Priority>("normal");
  const [dueBy, setDueBy] = useState(addDays(TODAY_KEY, 2));
  const [errors, setErrors] = useState<{ patient?: string; to?: string; reason?: string; due?: string }>({});

  useEffect(() => {
    if (!open) return;
    setFromId(clinician ? user.id : "s-ananya");
    setPatientId("");
    setDiscipline(role === "nutritionist" ? "movement" : "nutrition");
    setToId("");
    setReason("");
    setPriority("normal");
    setDueBy(addDays(TODAY_KEY, 2));
    setErrors({});
  }, [open, clinician, user.id, role]);

  const receivers = useMemo(() => staffOptions((s) => s.discipline === discipline && s.id !== fromId), [discipline, fromId]);

  // Default the receiver to the patient's own care-team member for that discipline.
  useEffect(() => {
    const p = patientById(patientId);
    const team = p?.careTeam[CARE_TEAM_KEY[discipline]];
    const preferred = team && team !== fromId && staffById(team)?.status !== "on-leave" ? team : receivers.find((o) => staffById(o.value)?.status !== "on-leave")?.value;
    setToId(preferred ?? "");
  }, [patientId, discipline, fromId, receivers]);

  const submit = () => {
    const next: typeof errors = {};
    if (!patientId) next.patient = "Choose the patient you're referring.";
    if (!toId) next.to = "Choose who should receive the referral.";
    if (reason.trim().length < 12) next.reason = "Add the context the receiver needs — values, limits, precautions (at least a sentence).";
    if (!dueBy || dueBy < TODAY_KEY) next.due = "Pick today or a later date.";
    setErrors(next);
    if (Object.keys(next).length) return;
    const to = staffById(toId);
    const from = staffById(fromId);
    const patient = patientById(patientId);
    const r = createReferral({ patientId, fromId, toId, toDiscipline: discipline, reason: reason.trim(), dueBy: isoAt(dueBy, "18:00"), priority });
    createTask(
      {
        title: `Accept referral: ${patient?.name} — ${reason.trim().split(/[;.]/)[0].slice(0, 60)}`,
        patientId,
        ownerId: toId,
        due: isoAt(dueBy, "18:00"),
        priority: priority === "low" ? "normal" : priority,
        source: `Referral from ${from?.name ?? "the care team"}`,
        discipline,
      },
      user.id,
    );
    onOpenChange(false);
    onCreated(r);
    toast({
      title: "Referral requested",
      description: `${patient?.name} → ${to?.name}. Saved in this browser session with an “Accept referral” task for ${to?.name} — they weren't notified.`,
      tone: "success",
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <ModalContent
        title="New referral"
        description="It starts at Requested and waits for the receiving practitioner to accept."
        size="md"
        footer={
          <>
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button variant="dark" onClick={submit}>
              Send referral
            </Button>
          </>
        }
      >
        <form
          noValidate
          className="grid grid-cols-1 gap-4 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          {clinician ? (
            <div className="flex flex-col gap-2">
              <span className="text-sm text-ink">Referring clinician</span>
              <span className="flex h-10 items-center rounded-control bg-canvas px-4 text-sm text-ink-2">{user.name} (you)</span>
            </div>
          ) : (
            <Field label="Referring clinician" hint="Recorded on behalf of the clinician who decided it.">
              {(p) => <Select {...p} value={fromId} onValueChange={setFromId} options={staffOptions((s) => s.role === "doctor" || s.role === "nutritionist" || s.role === "yoga")} />}
            </Field>
          )}
          <Field label="Patient" error={errors.patient}>
            {(p) => (
              <Select
                {...p}
                value={patientId}
                onValueChange={(v) => {
                  setPatientId(v);
                  setErrors((x) => ({ ...x, patient: undefined, to: undefined }));
                }}
                placeholder="Choose a patient"
                options={patientOptions()}
              />
            )}
          </Field>
          <div className="flex flex-col gap-2 sm:col-span-2">
            <span className="text-sm text-ink">Refer to</span>
            <Segmented
              ariaLabel="Refer to discipline"
              variant="tray"
              size="sm"
              value={discipline}
              onChange={setDiscipline}
              className="w-max"
              items={TARGETS.map((d) => ({ value: d, label: DISCIPLINE_LABEL[d], icon: <span className={cn("size-2 rounded-full", DISCIPLINE_DOT[d])} aria-hidden="true" /> }))}
            />
          </div>
          <Field label="Receiving practitioner" error={errors.to} hint={toId && patientById(patientId)?.careTeam[CARE_TEAM_KEY[discipline]] === toId ? "On this patient's care team." : undefined}>
            {(p) => (
              <Select
                {...p}
                value={toId}
                onValueChange={(v) => {
                  setToId(v);
                  setErrors((x) => ({ ...x, to: undefined }));
                }}
                placeholder="Choose who receives it"
                options={receivers}
              />
            )}
          </Field>
          <Field label="Respond by" error={errors.due} hint={dueBy ? `Acceptance due ${shortDay(isoAt(dueBy, "18:00"))}, 18:00` : undefined}>
            {(p) => (
              <Input
                {...p}
                type="date"
                min={TODAY_KEY}
                value={dueBy}
                onChange={(e) => {
                  setDueBy(e.target.value);
                  setErrors((x) => ({ ...x, due: undefined }));
                }}
              />
            )}
          </Field>
          <Field label="Reason & clinical context" error={errors.reason} className="sm:col-span-2">
            {(p) => (
              <Textarea
                {...p}
                value={reason}
                onChange={(e) => {
                  setReason(e.target.value);
                  if (errors.reason && e.target.value.trim().length >= 12) setErrors((x) => ({ ...x, reason: undefined }));
                }}
                placeholder="e.g. Post-MI diet; triglycerides 260 mg/dL; vegetarian; keep sodium under 2 g."
              />
            )}
          </Field>
          <div className="flex flex-col gap-2 sm:col-span-2">
            <span className="text-sm text-ink">Priority</span>
            <Segmented
              ariaLabel="Priority"
              variant="tray"
              size="sm"
              value={priority}
              onChange={setPriority}
              className="w-max"
              items={(["low", "normal", "high", "urgent"] as Priority[]).map((p) => ({ value: p, label: PRIORITY_LABEL[p] }))}
            />
          </div>
          <button type="submit" className="sr-only">
            Send referral
          </button>
        </form>
      </ModalContent>
    </Dialog>
  );
}

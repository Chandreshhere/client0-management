"use client";

import { useRef, useState } from "react";
import { Ticket } from "@phosphor-icons/react";
import { staffById } from "@/data/staff";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Dialog, ModalContent } from "@/components/ui/dialog";
import { Field, Input, Select, Switch } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { NOW_ISO, PRACTITIONERS, TODAY_KEY } from "./data";
import { onLeave, type Booking } from "./engine";
import { WALK_IN_MIN, availabilityNow } from "./insights";
import { PatientPicker } from "./patient-picker";
import { useSchedule } from "./store";

/** Walk-in registration: pick or quick-register the patient, choose who sees them, issue the next token. */
export function WalkInModal({ open, session, onOpenChange, onIssued }: { open: boolean; session: number; onOpenChange: (o: boolean) => void; onIssued: (b: Booking) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <WalkInForm key={session} onCancel={() => onOpenChange(false)} onIssued={onIssued} />
    </Dialog>
  );
}

function WalkInForm({ onCancel, onIssued }: { onCancel: () => void; onIssued: (b: Booking) => void }) {
  const { issueToken, addBookings, person, events } = useSchedule();
  const { toast } = useToast();
  const available = PRACTITIONERS.filter((s) => !onLeave(s.id, TODAY_KEY));
  const status = Object.fromEntries(available.map((s) => [s.id, availabilityNow(s, events)]));
  const [patientId, setPatientId] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  // Default to the first doctor free right now, else the first practitioner free, else the first listed.
  const [staffId, setStaffId] = useState(
    () => (available.find((s) => s.discipline === "medical" && status[s.id]?.free) ?? available.find((s) => status[s.id]?.free) ?? available[0])?.id ?? "s-ananya",
  );
  const [intake, setIntake] = useState(false);
  const [errors, setErrors] = useState<{ patient?: string; reason?: string }>({});
  const pickerRef = useRef<HTMLDivElement>(null);
  const token = issueToken();
  const staff = staffById(staffId);

  const submit = () => {
    const next: typeof errors = {};
    if (!patientId) next.patient = "Find the patient or register them first.";
    if (!reason.trim()) next.reason = "Add a short reason so the practitioner can triage.";
    setErrors(next);
    if (next.patient) {
      pickerRef.current?.querySelector<HTMLElement>("input,button")?.focus();
      return;
    }
    if (next.reason || !patientId || !staff) return;
    const [created] = addBookings([
      {
        patientId,
        staffId,
        service: `Walk-in · ${reason.trim()}`,
        discipline: staff.discipline,
        start: NOW_ISO,
        durationMin: 20,
        room: staff.room ?? "Consult 1",
        status: "arrived",
        kind: "walk-in",
        token,
        arrivedAt: NOW_ISO,
        formsComplete: intake,
      },
    ]);
    toast({
      title: `Token ${token} issued · ${person(patientId)?.name ?? "walk-in"}`,
      description: "Added to Arrived. Recorded in this browser session — no SMS or display update was sent.",
      tone: "success",
    });
    onIssued(created);
  };

  return (
    <ModalContent
      size="md"
      title="Register a walk-in"
      description="Issues the next token and adds the patient to Arrived."
      footer={
        <>
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
          <Button variant="primary" onClick={submit} leading={<Ticket />}>
            Issue token {token}
          </Button>
        </>
      }
    >
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <div className="flex items-center gap-4 rounded-inner bg-sunken p-4">
          <span className="flex h-12 min-w-20 items-center justify-center rounded-full bg-charcoal px-4 font-mono text-xl text-white tabular">{token}</span>
          <p className="text-sm text-ink-2">
            Next token in today&apos;s sequence. Tokens are shown on the queue board — with &ldquo;Queue display&rdquo; on, names stay hidden.
          </p>
        </div>
        <div ref={pickerRef}>
          <Field label="Patient" error={errors.patient}>
            {({ id, ...aria }) => <PatientPicker value={patientId} onChange={setPatientId} id={id} invalid={aria["aria-invalid"]} describedBy={aria["aria-describedby"]} />}
          </Field>
        </div>
        <Field label="Reason for visit" error={errors.reason}>
          {(p) => <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Palpitations since morning" {...p} />}
        </Field>
        <Field label="Who will see them" hint={staff ? `${staff.title} · ${staff.room} · ${status[staff.id]?.label ?? ""}${status[staff.id] && !status[staff.id].free ? ` — they may not be free for the next ${WALK_IN_MIN} min` : ""}` : undefined}>
          {(p) => (
            <Select
              {...p}
              ariaLabel="Practitioner"
              value={staffId}
              onValueChange={setStaffId}
              options={available.map((s) => ({
                value: s.id,
                label: (
                  <span className="inline-flex items-center gap-2">
                    <Avatar src={s.avatar} name={s.name} size="xs" />
                    {s.name}
                  </span>
                ),
                description: `${s.title} · ${status[s.id]?.label ?? ""}`,
              }))}
            />
          )}
        </Field>
        <div className="flex items-start gap-3 rounded-inner bg-sunken p-4">
          <Switch id="walkin-intake" checked={intake} onCheckedChange={setIntake} />
          <label htmlFor="walkin-intake" className="text-sm text-ink">
            Intake form completed at the desk
            <span className="block text-xs text-muted">Leave off if they still need to fill it in — the card will flag it.</span>
          </label>
        </div>
        <button type="submit" className="sr-only">
          Issue token
        </button>
      </form>
    </ModalContent>
  );
}

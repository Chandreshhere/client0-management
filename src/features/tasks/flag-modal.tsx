"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowRight, Warning } from "@phosphor-icons/react";
import { patientById } from "@/data/patients";
import { staffById } from "@/data/staff";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Dialog, ModalContent } from "@/components/ui/dialog";
import { Field, Select, Textarea } from "@/components/ui/input";
import { Segmented } from "@/components/ui/segmented";
import { useToast } from "@/components/ui/toast";
import { useRole } from "@/components/shell/role-context";
import { FLAG_URGENCY_LABEL, flagRoute, raiseFlag, type FlagUrgency } from "./flags";
import type { CareTask } from "./store";

/**
 * "Flag to doctor" (spec F8) — shared by sessions, nutrition plans and the patient lists.
 * Describe what happened, set urgency (routine or same day); it becomes one pending item for the
 * patient's primary doctor. Nothing is sent or paged — it's saved in this browser session.
 */
export function FlagToDoctorModal({
  open,
  onOpenChange,
  patients,
  defaultPatientId,
  context,
  placeholder,
  onRaised,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** who it can be about; one entry fixes the patient. `hint` is shown under the name (precaution, plan…) */
  patients: { id: string; hint?: string }[];
  defaultPatientId?: string | null;
  /** where it's raised from, e.g. "Breath & Balance · Fri 13 Nov" */
  context?: string;
  placeholder?: string;
  onRaised?: (task: CareTask) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open ? (
        <Body
          key={defaultPatientId ?? patients[0]?.id ?? "none"}
          patients={patients}
          defaultPatientId={defaultPatientId ?? (patients.length === 1 ? patients[0].id : null)}
          context={context}
          placeholder={placeholder}
          onClose={() => onOpenChange(false)}
          onRaised={onRaised}
        />
      ) : null}
    </Dialog>
  );
}

function Body({
  patients,
  defaultPatientId,
  context,
  placeholder,
  onClose,
  onRaised,
}: {
  patients: { id: string; hint?: string }[];
  defaultPatientId: string | null;
  context?: string;
  placeholder?: string;
  onClose: () => void;
  onRaised?: (task: CareTask) => void;
}) {
  const { user } = useRole();
  const { toast } = useToast();
  const router = useRouter();
  const [patientId, setPatientId] = useState(defaultPatientId ?? "");
  const [text, setText] = useState("");
  const [urgency, setUrgency] = useState<FlagUrgency>("routine");
  const [tried, setTried] = useState(false);
  const route = patientId ? flagRoute(patientId) : null;
  const owner = staffById(route?.ownerId);
  const fixed = patients.length === 1 ? patientById(patients[0].id) : null;
  const errors = {
    patient: !patientId ? "Choose who this is about." : null,
    text: text.trim().length < 10 ? "Describe what happened in a sentence or two." : null,
  };

  const submit = () => {
    setTried(true);
    if (errors.patient || errors.text) return;
    const { task, ownerId } = raiseFlag({ patientId, text, urgency, byId: user.id, context });
    const to = staffById(ownerId);
    onClose();
    onRaised?.(task);
    toast({
      title: `Flagged to ${to?.name ?? "the doctor"}`,
      description: `${urgency === "same-day" ? "Due today 17:00" : "Due in 2 days"} · it's in their pending list and you'll see the reply under “Raised by me”. Saved in this browser session — nobody was paged.`,
      tone: "success",
      action: { label: "Open tasks", onClick: () => router.push("/tasks?scope=raised") },
    });
  };

  return (
    <ModalContent
      title="Flag to doctor"
      description={context ? `${context} · goes to the patient's primary doctor` : "Goes to the patient's primary doctor"}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="dark" onClick={submit}>
            Flag to doctor
          </Button>
        </>
      }
    >
      <form
        noValidate
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        {fixed ? (
          <div className="flex items-center gap-3 rounded-inner bg-canvas p-3">
            <Avatar src={fixed.avatar} name={fixed.name} size="sm" />
            <div className="min-w-0">
              <p className="truncate text-sm text-ink">{fixed.name}</p>
              {patients[0].hint ? <p className="truncate text-xs text-muted">{patients[0].hint}</p> : null}
            </div>
          </div>
        ) : (
          <Field label="Patient" error={tried ? errors.patient : null}>
            {(a) => (
              <Select
                id={a.id}
                value={patientId || undefined}
                onValueChange={setPatientId}
                placeholder="Choose a patient"
                options={patients.map((p) => ({ value: p.id, label: patientById(p.id)?.name ?? p.id, description: p.hint }))}
              />
            )}
          </Field>
        )}
        <Field label="What happened?" error={tried ? errors.text : null} hint="What you saw and what you did — the doctor decides what it means.">
          {(a) => <Textarea {...a} value={text} onChange={(ev) => setText(ev.target.value)} rows={4} placeholder={placeholder ?? "e.g. Light-headed standing up from a seated fold; rested 5 min seated and it settled."} />}
        </Field>
        <div className="flex flex-col gap-2">
          <span className="text-sm text-ink">Urgency</span>
          <Segmented
            ariaLabel="Urgency"
            size="sm"
            variant="tray"
            className="self-start"
            value={urgency}
            onChange={setUrgency}
            items={(Object.keys(FLAG_URGENCY_LABEL) as FlagUrgency[]).map((u) => ({ value: u, label: FLAG_URGENCY_LABEL[u] }))}
          />
        </div>
        {urgency === "same-day" ? (
          <p className="flex items-start gap-2 rounded-inner bg-warning-soft p-3 text-xs text-ink-2">
            <Warning size={16} className="mt-px shrink-0 text-warning" aria-hidden="true" />
            If someone is unwell right now, follow the clinic&apos;s emergency procedure first. A flag is a pending item — it doesn&apos;t page anyone.
          </p>
        ) : null}
        {route && owner ? (
          <div className="flex items-center gap-3 rounded-inner bg-canvas p-3">
            <span className="whitespace-nowrap text-xs text-muted">Goes to</span>
            <ArrowRight size={14} className="shrink-0 text-muted" aria-hidden="true" />
            <Avatar src={owner.avatar} name={owner.name} size="sm" />
            <div className="min-w-0">
              <p className="truncate text-sm text-ink">{owner.name}</p>
              <p className="text-xs text-muted">{route.via ?? "Primary doctor"}</p>
            </div>
          </div>
        ) : null}
        <button type="submit" className="sr-only">
          Flag to doctor
        </button>
      </form>
    </ModalContent>
  );
}

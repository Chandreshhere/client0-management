"use client";

import { useState } from "react";
import { ArrowRight, Warning } from "@phosphor-icons/react";
import type { YogaClass } from "@/data/types";
import { patientById } from "@/data/patients";
import { staffById } from "@/data/staff";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Dialog, ModalContent } from "@/components/ui/dialog";
import { Field, Select, Textarea } from "@/components/ui/input";
import { Segmented } from "@/components/ui/segmented";
import { routeFor, type Urgency } from "./model";

/**
 * "Escalate to care team" (doc §2D): the instructor describes what they observed and a task is
 * created for clinical review — the instructor never has to interpret it as a diagnosis.
 */
const URGENCY_LABEL: Record<Urgency, string> = { routine: "Routine", today: "Today", urgent: "Urgent" };

export function EscalateModal({
  open,
  onOpenChange,
  cls,
  defaultPatientId,
  hasCoordinator,
  onCreate,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  cls: YogaClass;
  defaultPatientId: string | null;
  hasCoordinator: boolean;
  onCreate: (input: { patientId: string; concern: string; urgency: Urgency; ownerId: string; via: string | null }) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open ? <Body key={defaultPatientId ?? "none"} cls={cls} defaultPatientId={defaultPatientId} hasCoordinator={hasCoordinator} onCancel={() => onOpenChange(false)} onCreate={onCreate} /> : null}
    </Dialog>
  );
}

function Body({
  cls,
  defaultPatientId,
  hasCoordinator,
  onCancel,
  onCreate,
}: {
  cls: YogaClass;
  defaultPatientId: string | null;
  hasCoordinator: boolean;
  onCancel: () => void;
  onCreate: (input: { patientId: string; concern: string; urgency: Urgency; ownerId: string; via: string | null }) => void;
}) {
  const [patientId, setPatientId] = useState<string>(defaultPatientId ?? "");
  const [concern, setConcern] = useState("");
  const [urgency, setUrgency] = useState<Urgency>("today");
  const [tried, setTried] = useState(false);
  const route = patientId ? routeFor(patientId, hasCoordinator) : null;
  const owner = route ? staffById(route.ownerId) : undefined;
  const errors = { patient: !patientId ? "Choose who this is about" : null, concern: concern.trim().length < 10 ? "Describe what you observed in a sentence or two" : null };

  return (
    <ModalContent
      title="Escalate to care team"
      description={`${cls.title} · creates a task for clinical review`}
      footer={
        <>
          <Button variant="ghost" onClick={onCancel}>Cancel</Button>
          <Button
            variant="dark"
            onClick={() => {
              setTried(true);
              if (errors.patient || errors.concern || !route) return;
              onCreate({ patientId, concern: concern.trim(), urgency, ownerId: route.ownerId, via: route.via });
            }}
          >
            Create task
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Field label="Participant" error={tried ? errors.patient : null}>
          {(a) => (
            <Select
              id={a.id}
              value={patientId || undefined}
              onValueChange={setPatientId}
              placeholder="Choose a participant"
              options={cls.enrolled.map((e) => ({ value: e.patientId, label: patientById(e.patientId)?.name ?? e.patientId, description: e.precaution }))}
            />
          )}
        </Field>
        <Field label="What did you observe?" error={tried ? errors.concern : null} hint="Describe what you saw and what you did — not a diagnosis.">
          {(a) => <Textarea {...a} value={concern} onChange={(ev) => setConcern(ev.target.value)} rows={4} placeholder="e.g. Light-headed standing up from a seated fold; rested 5 min seated and it settled." />}
        </Field>
        <div className="flex flex-col gap-2">
          <span className="text-sm text-ink">How soon should someone look?</span>
          <Segmented ariaLabel="Urgency" size="sm" variant="tray" className="self-start" value={urgency} onChange={setUrgency} items={(Object.keys(URGENCY_LABEL) as Urgency[]).map((u) => ({ value: u, label: URGENCY_LABEL[u] }))} />
        </div>
        {urgency === "urgent" ? (
          <p className="flex items-start gap-2 rounded-inner bg-danger-soft p-4 text-xs text-danger">
            <Warning size={16} className="mt-px shrink-0" aria-hidden="true" />
            If someone is unwell right now, follow the clinic&apos;s emergency procedure first. This creates a task — it doesn&apos;t page anyone.
          </p>
        ) : null}
        {route ? (
          <div className="flex items-center gap-3 rounded-inner bg-canvas p-4">
            <span className="whitespace-nowrap text-xs text-muted">Goes to</span>
            <ArrowRight size={14} className="text-muted" aria-hidden="true" />
            <Avatar src={owner?.avatar} name={owner?.name ?? "Staff"} size="sm" />
            <div className="min-w-0">
              <p className="truncate text-sm text-ink">{owner?.name}</p>
              <p className="text-xs text-muted">{route.via ? `${route.via} — ${hasCoordinator ? "the coordinator" : "the front desk"} will reassign it` : "The participant's doctor"}</p>
            </div>
          </div>
        ) : null}
      </div>
    </ModalContent>
  );
}

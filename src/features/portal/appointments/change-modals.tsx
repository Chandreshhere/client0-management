"use client";

import Link from "next/link";
import { useState } from "react";
import { ChatCircleDots, Warning } from "@phosphor-icons/react";
import { formatTime } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Dialog, ModalContent } from "@/components/ui/dialog";
import { Field, Select } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { staffById } from "@/data/staff";
import type { PortalAppt } from "./data";
import { POLICY, isWithin24h } from "./data";
import { SlotPicker } from "./slot-picker";
import { clearChange, setChange } from "./store";
import { DemoNote, MetaRow } from "../ui";
import { dayLabel, nowIso, untilLabel } from "../time";

const RESCHEDULE_REASONS = [
  { value: "work", label: "Work clash" },
  { value: "travel", label: "Travelling" },
  { value: "transport", label: "Transport or traffic" },
  { value: "other", label: "Something else" },
];

const CANCEL_REASONS = [
  { value: "unwell", label: "I'm unwell", description: "Late-cancellation charge is waived" },
  { value: "work", label: "Work clash" },
  { value: "travel", label: "Travelling" },
  { value: "better", label: "I no longer need it" },
  { value: "other", label: "Something else" },
];

/** Visits that bring several practitioners together are moved by the care coordinator. */
const isCoordinated = (a: PortalAppt) => (a.alsoWith?.length ?? 0) > 0;

function Current({ appt }: { appt: PortalAppt }) {
  const staff = staffById(appt.staffId);
  return (
    <dl className="divide-y divide-line rounded-inner bg-sunken px-4 py-2">
      <MetaRow label="Visit">{appt.service}</MetaRow>
      <MetaRow label="With">{staff?.name}</MetaRow>
      <MetaRow label="Booked for">
        {dayLabel(appt.start)} · {formatTime(appt.start)} <span className="text-muted">({untilLabel(appt.start)})</span>
      </MetaRow>
    </dl>
  );
}

function LateNotice({ appt }: { appt: PortalAppt }) {
  if (!isWithin24h(appt)) return <DemoNote>{POLICY.free}</DemoNote>;
  return (
    <div className="flex items-start gap-3 rounded-inner bg-warning-soft p-4 text-sm text-ink">
      <Warning size={18} className="mt-0.5 shrink-0 text-warning" aria-hidden="true" />
      <p>
        <span className="text-warning">This visit is {untilLabel(appt.start)} — within 24 hours.</span> {POLICY.late}
      </p>
    </div>
  );
}

export function RescheduleModal({ appt, open, onOpenChange }: { appt: PortalAppt | null; open: boolean; onOpenChange: (o: boolean) => void }) {
  const { toast } = useToast();
  const [slot, setSlot] = useState<string | null>(null);
  const [reason, setReason] = useState<string | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  if (!appt) return null;
  const staff = staffById(appt.staffId);
  const coordinated = isCoordinated(appt);

  const submit = () => {
    if (!slot) return setError("Choose a new time.");
    setChange(appt.id, { kind: "reschedule", to: slot, reason, at: nowIso() });
    onOpenChange(false);
    toast({
      title: `New time requested · ${dayLabel(slot)} ${formatTime(slot)}`,
      description: "Demo — nothing was sent. Your current time stays booked until the clinic confirms.",
      action: { label: "Undo", onClick: () => clearChange(appt.id) },
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <ModalContent
        size="lg"
        title="Request a new time"
        description={coordinated ? undefined : `Open times with ${staff?.name}. The clinic confirms the change.`}
        footer={
          coordinated ? (
            <Button variant="dark" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          ) : (
            <>
              <Button variant="ghost" onClick={() => onOpenChange(false)}>
                Keep current time
              </Button>
              <Button variant="primary" onClick={submit}>
                Request this time
              </Button>
            </>
          )
        }
      >
        <div className="flex flex-col gap-4">
          <Current appt={appt} />
          {coordinated ? (
            <div className="flex flex-col items-start gap-3 rounded-inner bg-sunken p-4">
              <p className="text-sm text-ink">This review brings your doctor, nutritionist and yoga instructor together.</p>
              <p className="text-sm text-muted">Farhan Sheikh, your care coordinator, finds a time that works for all three. Send him a message with the days that suit you.</p>
              <Button asChild size="sm" variant="dark">
                <Link href="/messages?new=1">
                  <ChatCircleDots />
                  Message Farhan
                </Link>
              </Button>
            </div>
          ) : (
            <>
              <SlotPicker
                staffId={appt.staffId}
                durationMin={appt.durationMin}
                value={slot}
                exclude={appt.start}
                onChange={(iso) => {
                  setSlot(iso);
                  setError(null);
                }}
                invalid={!!error}
              />
              {error ? (
                <p role="alert" className="text-sm text-danger">
                  {error}
                </p>
              ) : null}
              <Field label="Reason" optional>
                {(f) => <Select id={f.id} value={reason} onValueChange={setReason} options={RESCHEDULE_REASONS} placeholder="Choose a reason" />}
              </Field>
              <LateNotice appt={appt} />
              <DemoNote>This demo doesn&apos;t contact the clinic — the request is saved in this browser session only.</DemoNote>
            </>
          )}
        </div>
      </ModalContent>
    </Dialog>
  );
}

export function CancelModal({
  appt,
  open,
  onOpenChange,
  onRescheduleInstead,
}: {
  appt: PortalAppt | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onRescheduleInstead: (a: PortalAppt) => void;
}) {
  const { toast } = useToast();
  const [reason, setReason] = useState<string | undefined>(undefined);
  if (!appt) return null;
  const canMove = appt.kind !== "class" && !isCoordinated(appt);

  const submit = () => {
    setChange(appt.id, { kind: "cancel", reason, at: nowIso() });
    onOpenChange(false);
    toast({
      tone: "warning",
      title: "Cancellation request saved",
      description: "Demo — nothing was sent. The visit stays booked until the clinic confirms.",
      action: { label: "Undo", onClick: () => clearChange(appt.id) },
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <ModalContent
        size="md"
        title="Cancel this visit?"
        description="The clinic confirms every cancellation."
        footer={
          <>
            {canMove ? (
              <Button variant="ghost" className="mr-auto" onClick={() => onRescheduleInstead(appt)}>
                Move it instead
              </Button>
            ) : null}
            <Button variant="secondary" onClick={() => onOpenChange(false)}>
              Keep visit
            </Button>
            <Button variant="danger" onClick={submit}>
              Request cancellation
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <Current appt={appt} />
          <Field label="Reason" optional hint={reason === "unwell" ? "We'll waive any late-cancellation charge. If you feel chest pain or breathlessness, call 112." : undefined}>
            {(f) => <Select id={f.id} value={reason} onValueChange={setReason} options={CANCEL_REASONS} placeholder="Choose a reason" />}
          </Field>
          <LateNotice appt={appt} />
          {appt.kind === "class" ? <DemoNote>Group classes run Monday, Wednesday and Friday at 07:30 — ask Kavya for a 1:1 make-up if you miss one.</DemoNote> : null}
        </div>
      </ModalContent>
    </Dialog>
  );
}

"use client";

import { RadioGroup } from "radix-ui";
import { useState } from "react";
import { Warning } from "@phosphor-icons/react";
import type { YogaClass } from "@/data/types";
import { patientById } from "@/data/patients";
import { staffById } from "@/data/staff";
import { formatDate, formatTime } from "@/lib/format";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/button";
import { Dialog, ModalContent } from "@/components/ui/dialog";
import { Field, Input } from "@/components/ui/input";
import { CLEARANCES } from "./data";

/**
 * Guidance-change handling (doc §2D): before an affected session proceeds, the instructor reviews
 * each changed or expired clearance and records a decision. Nothing here re-approves a clearance —
 * only a clinician can do that.
 */
type Enrolment = YogaClass["enrolled"][number];
export type ClearanceDecision = { kind: "acknowledged" | "held"; note: string; requestRenewal: boolean };

const lowerFirst = (t: string) => t.charAt(0).toLowerCase() + t.slice(1);

export function ClearanceReview({
  target,
  cls,
  onClose,
  onDecide,
}: {
  target: Enrolment | null;
  cls: YogaClass;
  onClose: () => void;
  onDecide: (e: Enrolment, d: ClearanceDecision) => void;
}) {
  return (
    <Dialog open={!!target} onOpenChange={(o) => !o && onClose()}>
      {target ? <Body key={target.patientId} e={target} cls={cls} onClose={onClose} onDecide={onDecide} /> : null}
    </Dialog>
  );
}

function Body({ e, cls, onClose, onDecide }: { e: Enrolment; cls: YogaClass; onClose: () => void; onDecide: (e: Enrolment, d: ClearanceDecision) => void }) {
  const patient = patientById(e.patientId);
  const first = patient?.name.split(" ")[0] ?? "the participant";
  const c = CLEARANCES[e.patientId];
  const doctor = c ? staffById(c.by) : undefined;
  const coveredDoctor = c?.coveringFor ? staffById(c.coveringFor) : undefined;
  const expired = e.clearance === "expired";
  const [choice, setChoice] = useState<string>(expired ? "hold" : "ack");
  const [note, setNote] = useState("");
  const [tried, setTried] = useState(false);
  const needsNote = expired && choice === "ack";
  const error = tried && needsNote && note.trim().length < 6 ? "Note who confirmed it and when — e.g. “Dr. Ananya Rao by phone, 09:50”." : null;

  const options = expired
    ? [
        { value: "hold", title: `Hold ${first} and request renewal`, body: `Marks ${first} Rescheduled for this session and creates a renewal task for the care team.` },
        { value: "ack", title: "Proceed with the last approved precautions", body: "Only if a clinician has confirmed it today — record who confirmed." },
      ]
    : [
        { value: "ack", title: "Acknowledge and apply today", body: `You've read the new precaution and will adapt the session. Applies to ${first}'s other sessions too.` },
        { value: "hold", title: `Hold ${first} from this session`, body: `Marks ${first} Rescheduled with a reason; the class can start without them.` },
      ];

  return (
    <ModalContent
      title={expired ? "Clearance expired" : "Review changed precaution"}
      description={`${patient?.name} · ${cls.title}, ${formatDate(cls.start, { weekday: "short", day: "numeric", month: "short" })} ${formatTime(cls.start)}`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button
            variant="dark"
            onClick={() => {
              setTried(true);
              if (needsNote && note.trim().length < 6) return;
              onDecide(e, { kind: choice === "ack" ? "acknowledged" : "held", note: note.trim(), requestRenewal: expired && choice === "hold" });
            }}
          >
            Record decision
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {c?.previous ? (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <div className="rounded-inner bg-canvas p-4">
              <p className="text-xs text-muted">Before · approved {formatDate(c.previous.at, { day: "numeric", month: "short" })} by {staffById(c.previous.by)?.name ?? "the care team"}</p>
              <p className="mt-1 text-sm text-ink-2 line-through decoration-faint">{c.previous.text}</p>
            </div>
            <div className="rounded-inner bg-warning-soft p-4">
              <p className="text-xs text-warning">Now · changed {formatDate(c.at, { day: "numeric", month: "short" })}, {formatTime(c.at)} by {doctor?.name ?? "the care team"}</p>
              <p className="mt-1 text-sm text-ink">{e.precaution}</p>
            </div>
          </div>
        ) : (
          <div className={cn("rounded-inner p-4", expired ? "bg-danger-soft" : "bg-warning-soft")}>
            <p className={cn("text-xs", expired ? "text-danger" : "text-warning")}>
              {expired && c?.validUntil ? `Approved ${formatDate(c.at, { day: "numeric", month: "short" })} · valid until ${formatDate(`${c.validUntil}T23:59:00+05:30`, { day: "numeric", month: "short" })} — expired` : "Current precaution"}
            </p>
            <p className="mt-1 text-sm text-ink">{e.precaution ?? "No specific precaution text on record"}</p>
          </div>
        )}
        <p className="text-sm text-ink-2">
          Approved by {doctor?.name ?? "the care team"}
          {coveredDoctor ? `, covering for ${coveredDoctor.name}${coveredDoctor.status === "on-leave" ? ` (${lowerFirst(coveredDoctor.workingHours)})` : ""}` : doctor?.status === "on-leave" ? ` (${lowerFirst(doctor.workingHours)})` : ""}.
          {c?.reason ? ` Why it changed: ${c.reason}` : ""}
        </p>

        <RadioGroup.Root value={choice} onValueChange={setChoice} aria-label="Decision" className="flex flex-col gap-2">
          {options.map((o) => (
            <RadioGroup.Item
              key={o.value}
              value={o.value}
              className="group flex items-start gap-3 rounded-inner p-4 text-left shadow-[inset_0_0_0_1px_var(--color-line)] transition-[box-shadow,background-color] duration-200 hover:bg-canvas data-[state=checked]:bg-canvas data-[state=checked]:shadow-[inset_0_0_0_2px_var(--color-charcoal)]"
            >
              <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full shadow-[inset_0_0_0_1.5px_var(--color-line-strong)] group-data-[state=checked]:bg-charcoal group-data-[state=checked]:shadow-none">
                <RadioGroup.Indicator className="size-2 rounded-full bg-white" />
              </span>
              <span>
                <span className="block text-sm text-ink">{o.title}</span>
                <span className="mt-0.5 block text-xs text-muted">{o.body}</span>
              </span>
            </RadioGroup.Item>
          ))}
        </RadioGroup.Root>

        <Field label={needsNote ? "Who confirmed it?" : "Note"} optional={!needsNote} error={error}>
          {(a) => <Input {...a} value={note} onChange={(ev) => setNote(ev.target.value)} placeholder={needsNote ? "Dr. … by phone, time" : "e.g. Oximeter on; seated options for balance work"} />}
        </Field>

        <p className="flex items-start gap-2 text-xs text-muted">
          <Warning size={14} className="mt-px shrink-0" aria-hidden="true" />
          Your decision is recorded with your name and time in this browser session. It doesn&apos;t change the clinical clearance itself.
        </p>
      </div>
    </ModalContent>
  );
}

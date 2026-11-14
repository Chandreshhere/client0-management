"use client";

import { RadioGroup } from "radix-ui";
import { useState } from "react";
import { Info } from "@phosphor-icons/react";
import type { YogaClass } from "@/data/types";
import { patientById } from "@/data/patients";
import { staffById } from "@/data/staff";
import { formatDate, formatTime } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Dialog, ModalContent } from "@/components/ui/dialog";
import { Field, Input } from "@/components/ui/input";
import { CLEARANCES } from "./data";

/**
 * Spec F7: a precaution the doctor changed must be read and acknowledged before the instructor's
 * next session. An expired approval can't be renewed here — the instructor either holds the
 * participant from this session (and the doctor is flagged to renew it) or records who confirmed it.
 */
type Enrolment = YogaClass["enrolled"][number];
export type ClearanceDecision = { kind: "acknowledged" | "held"; note: string; requestRenewal: boolean };

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

const day = (iso: string) => formatDate(iso, { day: "numeric", month: "short" });

function Body({ e, cls, onClose, onDecide }: { e: Enrolment; cls: YogaClass; onClose: () => void; onDecide: (e: Enrolment, d: ClearanceDecision) => void }) {
  const patient = patientById(e.patientId);
  const first = patient?.name.split(" ")[0] ?? "the participant";
  const c = CLEARANCES[e.patientId];
  const doctor = staffById(c?.by);
  const covered = staffById(c?.coveringFor);
  const expired = e.clearance === "expired";
  const [choice, setChoice] = useState<"hold" | "ack">(expired ? "hold" : "ack");
  const [note, setNote] = useState("");
  const [tried, setTried] = useState(false);
  const needsNote = expired && choice === "ack";
  const error = tried && needsNote && note.trim().length < 6 ? "Who confirmed it, and when — e.g. “Dr. Ananya Rao by phone, 09:50”." : null;
  const when = `${cls.title}, ${formatDate(cls.start, { weekday: "short", day: "numeric", month: "short" })} ${formatTime(cls.start)}`;

  const submit = () => {
    setTried(true);
    if (needsNote && note.trim().length < 6) return;
    onDecide(e, { kind: choice === "ack" ? "acknowledged" : "held", note: note.trim(), requestRenewal: expired && choice === "hold" });
  };

  return (
    <ModalContent
      title={expired ? "Precaution approval expired" : "Precaution changed — read and acknowledge"}
      description={`${patient?.name ?? "Participant"} · before ${when}`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="dark" onClick={submit}>
            {expired ? (choice === "hold" ? "Hold and flag the doctor" : "Record and proceed") : "Acknowledge"}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {c?.previous && !expired ? (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <div className="rounded-inner bg-canvas p-4">
              <p className="text-xs text-muted">Before · {day(c.previous.at)}</p>
              <p className="mt-1 text-sm text-ink-2 line-through decoration-faint">{c.previous.text}</p>
            </div>
            <div className="rounded-inner bg-warning-soft p-4">
              <p className="text-xs text-ink-2">Now · changed {day(c.at)}, {formatTime(c.at)}</p>
              <p className="mt-1 text-sm text-ink">{e.precaution}</p>
            </div>
          </div>
        ) : (
          <div className={expired ? "rounded-inner bg-danger-soft p-4" : "rounded-inner bg-warning-soft p-4"}>
            <p className="text-xs text-ink-2">
              {expired && c?.validUntil ? `Approved ${day(c.at)} · valid until ${day(`${c.validUntil}T23:59:00+05:30`)} — expired` : c ? `Changed ${day(c.at)}, ${formatTime(c.at)}` : "Precaution"}
            </p>
            <p className="mt-1 text-sm text-ink">{e.precaution ?? "No precaution text on record"}</p>
          </div>
        )}

        <p className="text-sm text-ink-2">
          {expired ? "Approved" : "Changed"} by {doctor?.name ?? "the care team"}
          {covered ? `, covering for ${covered.name}` : ""}.{c?.reason && !expired ? ` ${c.reason}` : ""}
        </p>

        {expired ? (
          <RadioGroup.Root value={choice} onValueChange={(v) => setChoice(v as "hold" | "ack")} aria-label="What to do" className="flex flex-col gap-2">
            {[
              { value: "hold", title: `Hold ${first} from this session`, body: `The session can start without ${first}. The doctor gets a same-day flag to renew the approval.` },
              { value: "ack", title: "The doctor confirmed it today", body: "Proceed with the last approved precaution — record who confirmed it." },
            ].map((o) => (
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
        ) : null}

        {!expired || needsNote ? (
          <Field label={needsNote ? "Who confirmed it?" : "Note"} optional={!needsNote} error={error}>
            {(a) => <Input {...a} value={note} onChange={(ev) => setNote(ev.target.value)} placeholder={needsNote ? "Dr. … by phone, time" : "e.g. Chair beside the mat; seated balance work"} />}
          </Field>
        ) : null}

        <p className="flex items-start gap-2 text-xs text-muted">
          <Info size={14} className="mt-px shrink-0" aria-hidden="true" />
          {expired
            ? "Recorded with your name and time. Only the doctor can renew an approval."
            : `Acknowledging records that you've read it — with your name and time — and applies to ${first}'s other sessions too.`}
        </p>
      </div>
    </ModalContent>
  );
}

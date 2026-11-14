"use client";

import { useEffect, useRef, useState } from "react";
import { CalendarCheck, DeviceMobile, PaperPlaneTilt } from "@phosphor-icons/react";
import type { Patient } from "@/data/types";
import { STAFF, staffById } from "@/data/staff";
import { Dialog, ModalContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { Segmented } from "@/components/ui/segmented";
import { LockBadge } from "@/components/shell/plan-switcher";
import { planById, priceLabel } from "@/data/plans";
import { usePlan } from "@/components/shell/role-context";
import { formatDate, TODAY } from "@/lib/format";
import { localId } from "../store";
import type { LocalReferral, NextReview, ReferralTarget } from "./use-drafts";

const TODAY_DATE = "2026-11-13";
const addDays = (n: number) => new Date(TODAY.getTime() + n * 86_400_000).toISOString().slice(0, 10);
const DISCIPLINE_NAME: Record<ReferralTarget, string> = { nutrition: "Nutrition", movement: "Yoga", medical: "Medical" };

/* ------------------------------------------------------------------ referral */

export function ReferralDialog({
  open,
  onOpenChange,
  patient,
  authorId,
  suggestedReason,
  onCreate,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  patient: Patient;
  authorId: string;
  suggestedReason: string;
  onCreate: (r: LocalReferral) => void;
}) {
  // Spec F5: assignments go to nutrition or yoga — the patient's own team first, then anyone else in that discipline.
  const onTeam = (id: string) => id === patient.careTeam.nutritionist || id === patient.careTeam.yoga;
  const targets = [
    ...(patient.careTeam.nutritionist ? [{ to: "nutrition" as const, toId: patient.careTeam.nutritionist, team: true }] : []),
    ...(patient.careTeam.yoga ? [{ to: "movement" as const, toId: patient.careTeam.yoga, team: true }] : []),
    ...STAFF.filter((s) => (s.role === "nutritionist" || s.role === "yoga") && !onTeam(s.id) && s.id !== authorId).map((s) => ({ to: s.role === "nutritionist" ? ("nutrition" as const) : ("movement" as const), toId: s.id, team: false })),
  ];
  const reasonRef = useRef<HTMLTextAreaElement>(null);
  const [target, setTarget] = useState(`${targets[0]?.to}|${targets[0]?.toId}`);
  const [reason, setReason] = useState("");
  const [priority, setPriority] = useState<LocalReferral["priority"]>("normal");
  const dueBy = addDays(2);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setReason(suggestedReason);
      setError(null);
    }
  }, [open, suggestedReason]);

  const submit = () => {
    if (!reason.trim()) {
      setError("Add the goals — what you'd like them to work on.");
      return;
    }
    const [to, toId] = target.split("|") as [ReferralTarget, string];
    onCreate({ id: localId("ref"), to, toId, reason: reason.trim(), priority, dueBy, at: new Date().toISOString() });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <ModalContent
        title="Assign to nutrition or yoga"
        description="Assigned → seen: it shows as seen once they open it. Not seen within 48 hours, it comes back to you."
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          reasonRef.current?.focus();
        }}
        footer={
          <>
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button variant="dark" leading={<PaperPlaneTilt />} onClick={submit}>
              Assign
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <Field label="Assign to">
            {({ id }) => (
              <Select
                id={id}
                value={target}
                onValueChange={setTarget}
                options={targets.map((t) => {
                  const s = staffById(t.toId)!;
                  return { value: `${t.to}|${t.toId}`, label: `${s.name} — ${DISCIPLINE_NAME[t.to]}`, description: t.team ? `On ${patient.name.split(" ")[0]}'s care team` : s.status === "on-leave" ? `${s.title} · ${s.workingHours}` : s.title };
                })}
              />
            )}
          </Field>
          <Field label="Goals, guidance or precautions" error={error ?? undefined} hint="Prefilled from your assessment — edit freely. For yoga, write precautions, not diagnoses.">
            {(p) => (
              <Textarea
                ref={reasonRef}
                value={reason}
                onChange={(e) => {
                  setReason(e.target.value);
                  setError(null);
                }}
                placeholder="e.g. Heart-healthy vegetarian plan; LDL-C below 70 mg/dL. For yoga: HR ceiling 110 bpm; no inversions."
                {...p}
              />
            )}
          </Field>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <span className="text-sm text-ink">Priority</span>
              <Segmented
                ariaLabel="Priority"
                size="sm"
                variant="tray"
                className="self-start"
                value={priority}
                onChange={setPriority}
                items={[
                  { value: "normal", label: "Normal" },
                  { value: "high", label: "High" },
                  { value: "urgent", label: "Urgent" },
                ]}
              />
            </div>
            <div className="flex flex-col gap-2">
              <span className="text-sm text-ink">If not seen</span>
              <p className="text-xs text-muted">Not opened by {formatDate(`${dueBy}T12:00:00+05:30`, { weekday: "short", day: "numeric", month: "short" })} (48 hours), it comes back to your pending list.</p>
            </div>
          </div>
        </div>
      </ModalContent>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ next review */

const SLOTS = Array.from({ length: 17 }, (_, i) => {
  const m = 9 * 60 + i * 30;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
});
const PROGRAMME_KINDS = ["Programme completion review", "Follow-up consultation", "Results review", "Teleconsultation"];
const VISIT_KINDS = ["Follow-up consultation", "Results review", "Teleconsultation"];

export function ReviewDialog({
  open,
  onOpenChange,
  patient,
  defaultWith,
  defaultDate,
  programme,
  onSchedule,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  patient: Patient;
  defaultWith: string;
  /** suggested date (programme end for programme patients, two weeks otherwise) */
  defaultDate: string;
  /** on a programme → offer the programme completion review first */
  programme: boolean;
  onSchedule: (r: NextReview) => void;
}) {
  const doctors = STAFF.filter((s) => s.role === "doctor");
  const kinds = programme ? PROGRAMME_KINDS : VISIT_KINDS;
  const dateRef = useRef<HTMLInputElement>(null);
  const [date, setDate] = useState(defaultDate);
  const [time, setTime] = useState("11:00");
  const [withId, setWithId] = useState(defaultWith);
  const [kind, setKind] = useState(kinds[0]);
  const [error, setError] = useState<string | null>(null);

  const submit = () => {
    if (!date) return setError("Choose a date.");
    if (date <= TODAY_DATE) return setError("Choose a date after today.");
    onSchedule({ date, time, withId, kind, at: new Date().toISOString() });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <ModalContent
        size="sm"
        title="Schedule next review"
        description={`A request for ${patient.name}. Front desk confirms the slot — nothing is booked from here.`}
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          dateRef.current?.focus();
        }}
        footer={
          <>
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button variant="dark" leading={<CalendarCheck />} onClick={submit}>
              Save request
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Date" error={error ?? undefined}>
              {(p) => (
                <Input
                  ref={dateRef}
                  type="date"
                  value={date}
                  min={addDays(1)}
                  onChange={(e) => {
                    setDate(e.target.value);
                    setError(null);
                  }}
                  {...p}
                />
              )}
            </Field>
            <Field label="Time">{({ id }) => <Select id={id} value={time} onValueChange={setTime} options={SLOTS.map((s) => ({ value: s, label: s }))} />}</Field>
          </div>
          <Field label="With">
            {({ id }) => <Select id={id} value={withId} onValueChange={setWithId} options={doctors.map((d) => ({ value: d.id, label: d.name, description: d.status === "on-leave" ? d.workingHours : d.title }))} />}
          </Field>
          <Field label="Visit type">{({ id }) => <Select id={id} value={kind} onValueChange={setKind} options={kinds.map((k) => ({ value: k, label: k }))} />}</Field>
          {date && date > TODAY_DATE ? (
            <p className="rounded-inner bg-canvas p-3 text-xs text-muted">
              Adds “{kind} on {formatDate(date, { weekday: "short", day: "numeric", month: "short" })} at {time}” to this note&apos;s follow-up.
            </p>
          ) : null}
        </div>
      </ModalContent>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ patient instructions */

export function InstructionsDialog({
  open,
  onOpenChange,
  patient,
  initialText,
  published,
  onPublish,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  patient: Patient;
  initialText: string;
  published: boolean;
  onPublish: (text: string) => void;
}) {
  const { has } = usePlan();
  const portal = has("portal");
  const textRef = useRef<HTMLTextAreaElement>(null);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setText(initialText);
      setError(null);
    }
  }, [open, initialText]);

  const submit = () => {
    if (text.trim().length < 20) {
      setError("Write at least a sentence the patient can act on.");
      return;
    }
    onPublish(text.trim());
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <ModalContent
        size="lg"
        title="Publish patient instructions"
        description="Separate from signing: the clinical note stays as it is; this plain-language summary is what the patient sees."
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          textRef.current?.focus();
        }}
        footer={
          <>
            {!portal ? (
              <span className="mr-auto flex items-center gap-1.5 text-xs text-muted">
                <LockBadge />
                Releasing to the patient app is on the Pro plan ({priceLabel(planById("pro"))})
              </span>
            ) : null}
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button variant="dark" leading={<PaperPlaneTilt />} onClick={submit} disabled={!portal}>
              {published ? "Publish update" : "Publish to portal"}
            </Button>
          </>
        }
      >
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <Field label="Instructions" error={error ?? undefined} hint="Plain language; no abbreviations. Prefilled from Advice and Follow-up.">
            {(p) => (
              <Textarea
                ref={textRef}
                value={text}
                onChange={(e) => {
                  setText(e.target.value);
                  setError(null);
                }}
                className="min-h-[220px]"
                {...p}
              />
            )}
          </Field>
          <div className="flex flex-col gap-2">
            <span className="flex items-center gap-1.5 text-sm text-ink">
              <DeviceMobile size={16} aria-hidden="true" />
              What {patient.name.split(" ")[0]} will see
            </span>
            <div className="rounded-inner bg-sunken p-2">
              <div className="rounded-[8px] bg-surface p-4">
                <p className="text-xs text-muted">From your visit · {formatDate(TODAY.toISOString(), { day: "numeric", month: "short" })}</p>
                <p className="mt-1 text-sm text-ink">Your next steps</p>
                <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-ink-2">{text.trim() || "Your instructions will appear here."}</p>
                <p className="mt-4 text-xs text-muted">Questions? Message your care team — replies within 1 working day.</p>
              </div>
            </div>
            <p className="text-xs text-muted">The portal isn&apos;t connected in this prototype — publishing is recorded in this browser session and nothing is sent.</p>
          </div>
        </div>
      </ModalContent>
    </Dialog>
  );
}

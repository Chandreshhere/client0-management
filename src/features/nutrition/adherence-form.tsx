"use client";

import { useState } from "react";
import { ClipboardText, Plus } from "@phosphor-icons/react";
import { patientById } from "@/data/patients";
import { staffById } from "@/data/staff";
import { formatDate } from "@/lib/format";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Group, GroupHeader, Inset } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { Segmented } from "@/components/ui/segmented";
import { StatusBadge, type Tone } from "@/components/ui/status";
import { useToast } from "@/components/ui/toast";
import { useRole } from "@/components/shell/role-context";
import { ADHERENCE_LABEL, type Adherence, type FollowUpEntry } from "./data";
import { newId, nowIso } from "./model";
import { followUpActions } from "./store";

/**
 * Follow-up entry (spec F6): at each visit the nutritionist records weight, how closely the plan was
 * followed and notes, plus the next review. Every visit leaves an entry or a new plan version.
 * Works on every plan; saved in this browser session only.
 */
export const ADHERENCE_TONE: Record<Adherence, Tone> = { good: "success", partly: "warning", poor: "danger" };
const ADHERENCE_SHORT: Record<Adherence, string> = { good: "Mostly", partly: "Partly", poor: "Not followed" };
const TOMORROW = "2026-11-14";

export function FollowUpCard({
  patientId,
  entries,
  canWrite,
  patientOptions,
  onPatientChange,
  className,
}: {
  patientId: string;
  /** every entry in the session — filtered to this patient here */
  entries: FollowUpEntry[];
  canWrite: boolean;
  /** when given, the card has its own patient picker (food-logs page) */
  patientOptions?: { value: string; label: string }[];
  onPatientChange?: (id: string) => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const own = entries.filter((e) => e.patientId === patientId).sort((a, b) => b.at.localeCompare(a.at));
  const first = patientById(patientId)?.name.split(" ")[0] ?? "this patient";
  return (
    <Group id="follow-up" aria-label="Follow-up entries" className={className ? `scroll-mt-28 ${className}` : "scroll-mt-28"}>
      <GroupHeader
        icon={<ClipboardText />}
        title="Follow-ups"
        subtitle={own.length ? `${own.length} for ${first} · weight, adherence, notes` : `None yet for ${first}`}
        action={
          canWrite && !open ? (
            <Button size="sm" variant="dark" leading={<Plus weight="bold" />} onClick={() => setOpen(true)}>
              Add entry
            </Button>
          ) : undefined
        }
      />
      <div className="flex flex-col gap-2">
        {patientOptions && onPatientChange ? (
          <Inset>
            <Field label="Patient">{(a) => <Select id={a.id} value={patientId} onValueChange={onPatientChange} options={patientOptions} />}</Field>
          </Inset>
        ) : null}
        {open ? <FollowUpForm key={patientId} patientId={patientId} previous={own[0]} onDone={() => setOpen(false)} /> : null}
        {own.length ? (
          <ol className="flex flex-col gap-2">
            {own.map((e, i) => (
              <li key={e.id}>
                <EntryRow entry={e} previous={own.slice(i + 1).find((x) => x.weightKg !== null)} />
              </li>
            ))}
          </ol>
        ) : !open ? (
          <Inset>
            <p className="text-sm text-muted">{canWrite ? "Record weight, adherence and notes at each visit." : "The patient's nutritionist records follow-ups here."}</p>
          </Inset>
        ) : null}
      </div>
    </Group>
  );
}

function EntryRow({ entry, previous }: { entry: FollowUpEntry; previous: FollowUpEntry | undefined }) {
  const by = staffById(entry.by);
  const delta = entry.weightKg !== null && previous?.weightKg != null ? Math.round((entry.weightKg - previous.weightKg) * 10) / 10 : null;
  return (
    <Inset>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-ink">{formatDate(entry.at, { day: "numeric", month: "short" })}</span>
        <StatusBadge tone={ADHERENCE_TONE[entry.adherence]}>{ADHERENCE_LABEL[entry.adherence]}</StatusBadge>
        {entry.weightKg !== null ? (
          <span className="ml-auto text-sm text-ink tabular">
            {entry.weightKg.toFixed(1)} kg
            {delta !== null ? <span className="text-xs text-muted"> · {delta > 0 ? "+" : delta < 0 ? "−" : "±"}{Math.abs(delta).toFixed(1)}</span> : null}
          </span>
        ) : (
          <span className="ml-auto text-xs text-muted">Not weighed</span>
        )}
      </div>
      {entry.notes ? <p className="mt-2 text-sm leading-relaxed text-ink-2">{entry.notes}</p> : null}
      <div className="mt-3 flex items-center gap-2 text-xs text-muted">
        <Avatar src={by?.avatar} name={by?.name ?? "Staff"} size="xs" />
        <span className="min-w-0 truncate">
          {by?.name ?? "Unknown"} · next review {formatDate(`${entry.nextReview}T12:00:00+05:30`, { day: "numeric", month: "short" })}
        </span>
      </div>
    </Inset>
  );
}

function FollowUpForm({ patientId, previous, onDone }: { patientId: string; previous: FollowUpEntry | undefined; onDone: () => void }) {
  const { user } = useRole();
  const { toast } = useToast();
  const first = patientById(patientId)?.name.split(" ")[0] ?? "the patient";
  const [weight, setWeight] = useState("");
  const [adherence, setAdherence] = useState<Adherence>("partly");
  const [notes, setNotes] = useState("");
  const [next, setNext] = useState("2026-11-27");
  const [tried, setTried] = useState(false);

  const kg = weight.trim() ? Number(weight) : null;
  const errors = {
    weight: kg !== null && (!Number.isFinite(kg) || kg < 20 || kg > 250) ? "Enter the weight in kg (20–250), or leave it blank." : null,
    notes: notes.trim().length < 8 ? "Note what happened since the last visit — a sentence is enough." : null,
    next: !next ? "Pick the next review date." : next < TOMORROW ? "The next review must be after today (13 Nov)." : null,
  };

  const save = () => {
    setTried(true);
    if (errors.weight || errors.notes || errors.next) return;
    followUpActions.add({ id: newId("fu"), patientId, by: user.id, at: nowIso(), weightKg: kg, adherence, notes: notes.trim(), nextReview: next });
    toast({ title: `Follow-up saved for ${first}`, description: "Added to the plan's history in this browser session.", tone: "success" });
    onDone();
  };

  return (
    <Inset>
      <form
        noValidate
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Weight (kg)" optional error={tried ? errors.weight : null} hint={previous?.weightKg != null ? `Last: ${previous.weightKg.toFixed(1)} kg` : undefined}>
            {(a) => <Input {...a} type="number" inputMode="decimal" step="0.1" min="20" max="250" value={weight} onChange={(e) => setWeight(e.target.value)} placeholder="e.g. 68.2" className="tabular" />}
          </Field>
          <Field label="Next review" error={tried ? errors.next : null}>
            {(a) => <Input {...a} type="date" min={TOMORROW} value={next} onChange={(e) => setNext(e.target.value)} className="tabular" />}
          </Field>
        </div>
        <div className="flex flex-col gap-2">
          <span className="text-sm text-ink">Followed the plan</span>
          <Segmented
            ariaLabel="How closely the plan was followed"
            size="sm"
            variant="tray"
            className="self-start"
            value={adherence}
            onChange={setAdherence}
            items={(Object.keys(ADHERENCE_SHORT) as Adherence[]).map((k) => ({ value: k, label: ADHERENCE_SHORT[k] }))}
          />
        </div>
        <Field label="Notes" error={tried ? errors.notes : null}>
          {(a) => <Textarea {...a} rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="What went well, what got in the way, what you agreed." />}
        </Field>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onDone}>
            Cancel
          </Button>
          <Button type="submit" variant="primary">
            Save follow-up
          </Button>
        </div>
      </form>
    </Inset>
  );
}

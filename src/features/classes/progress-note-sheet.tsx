"use client";

import { useState } from "react";
import { LockSimple } from "@phosphor-icons/react";
import type { YogaClass } from "@/data/types";
import { patientById } from "@/data/patients";
import { staffById } from "@/data/staff";
import { formatDate, formatTime } from "@/lib/format";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Dialog, SheetContent } from "@/components/ui/dialog";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { Pill } from "@/components/ui/pill";
import { Segmented } from "@/components/ui/segmented";
import { ADHERENCE_LABEL, MOBILITY_LABEL, type Adherence, type Mobility, type ProgressNote } from "./data";

/**
 * Progress note (spec F7): mobility, pain, breathing and home-practice adherence for one
 * participant after a session. Visible to the patient's care team; nothing here is a diagnosis.
 */
export type ProgressInput = Pick<ProgressNote, "mobility" | "pain" | "breathing" | "adherence" | "note">;

export function ProgressNoteSheet({
  patientId,
  cls,
  history,
  canWrite,
  onClose,
  onSave,
}: {
  patientId: string | null;
  cls: YogaClass;
  history: ProgressNote[];
  canWrite: boolean;
  onClose: () => void;
  onSave: (input: ProgressInput) => void;
}) {
  const patient = patientId ? patientById(patientId) : undefined;
  return (
    <Dialog open={!!patientId} onOpenChange={(o) => !o && onClose()}>
      {patientId && patient ? (
        <Body key={patientId} name={patient.name} cls={cls} history={history.filter((o) => o.patientId === patientId)} canWrite={canWrite} onClose={onClose} onSave={onSave} />
      ) : null}
    </Dialog>
  );
}

const PAIN_OPTIONS = [{ value: "none", label: "Not asked" }, ...Array.from({ length: 11 }, (_, i) => ({ value: String(i), label: `${i} / 10${i === 0 ? " · no pain" : i === 10 ? " · worst" : ""}` }))];

export const progressSummary = (n: Pick<ProgressNote, "mobility" | "pain" | "adherence">) =>
  [`Mobility ${MOBILITY_LABEL[n.mobility].toLowerCase()}`, n.pain === null ? null : `pain ${n.pain}/10`, `practice ${ADHERENCE_LABEL[n.adherence].toLowerCase()}`].filter(Boolean).join(" · ");

function Body({
  name,
  cls,
  history,
  canWrite,
  onClose,
  onSave,
}: {
  name: string;
  cls: YogaClass;
  history: ProgressNote[];
  canWrite: boolean;
  onClose: () => void;
  onSave: (input: ProgressInput) => void;
}) {
  const first = name.split(" ")[0];
  const [mobility, setMobility] = useState<Mobility>("same");
  const [pain, setPain] = useState("none");
  const [breathing, setBreathing] = useState("");
  const [adherence, setAdherence] = useState<Adherence>("good");
  const [note, setNote] = useState("");

  return (
    <SheetContent
      title="Progress note"
      description={`${name} · ${cls.title}, ${formatDate(cls.start, { day: "numeric", month: "short" })}`}
      footer={
        canWrite ? (
          <>
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button variant="dark" onClick={() => onSave({ mobility, pain: pain === "none" ? null : Number(pain), breathing: breathing.trim(), adherence, note: note.trim() })}>
              Save progress note
            </Button>
          </>
        ) : null
      }
    >
      <p className="flex items-start gap-2 rounded-inner bg-canvas p-4 text-xs text-ink-2">
        <LockSimple size={16} className="mt-px shrink-0 text-muted" aria-hidden="true" />
        Visible to {first}&apos;s care team and on their timeline — never to other participants. Describe what you saw; if something worries you, flag it to the doctor.
      </p>

      {canWrite ? (
        <div className="mt-6 flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <span className="text-sm text-ink">Mobility since last session</span>
            <Segmented ariaLabel="Mobility" size="sm" variant="tray" className="self-start" value={mobility} onChange={setMobility} items={(Object.keys(MOBILITY_LABEL) as Mobility[]).map((m) => ({ value: m, label: MOBILITY_LABEL[m] }))} />
          </div>
          <Field label="Pain">
            {(a) => <Select id={a.id} value={pain} onValueChange={setPain} options={PAIN_OPTIONS} />}
          </Field>
          <Field label="Breathing" optional>
            {(a) => <Input {...a} value={breathing} onChange={(ev) => setBreathing(ev.target.value)} placeholder="e.g. Comfortable; paced 4-6 without breath-holds" />}
          </Field>
          <div className="flex flex-col gap-2">
            <span className="text-sm text-ink">Home practice</span>
            <Segmented ariaLabel="Home practice adherence" size="sm" variant="tray" className="self-start" value={adherence} onChange={setAdherence} items={(Object.keys(ADHERENCE_LABEL) as Adherence[]).map((a) => ({ value: a, label: ADHERENCE_LABEL[a] }))} />
          </div>
          <Field label="Note" optional>
            {(a) => <Textarea {...a} value={note} onChange={(ev) => setNote(ev.target.value)} rows={3} placeholder="e.g. Tree pose at the wall, 30 s each side. Next: add a second round." />}
          </Field>
        </div>
      ) : (
        <p className="mt-6 text-sm text-muted">The instructor writes progress notes. You can read them below.</p>
      )}

      <h3 className="mt-8 text-xs text-muted">Earlier progress notes</h3>
      {history.length ? (
        <ul className="mt-2 flex flex-col gap-2">
          {history.map((o) => {
            const by = staffById(o.by);
            return (
              <li key={o.id} className="rounded-inner bg-canvas p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Avatar src={by?.avatar} name={by?.name ?? "Instructor"} size="xs" />
                  <span className="text-xs text-ink-2">{by?.name}</span>
                  <span className="ml-auto text-xs text-muted tabular">
                    {formatDate(o.at, { day: "numeric", month: "short" })} · {formatTime(o.at)}
                  </span>
                </div>
                <p className="mt-2 text-xs text-muted">{o.classTitle}</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <Pill size="sm" tone="white">Mobility {MOBILITY_LABEL[o.mobility].toLowerCase()}</Pill>
                  {o.pain !== null ? <Pill size="sm" tone="white">Pain {o.pain}/10</Pill> : null}
                  <Pill size="sm" tone="white">Practice {ADHERENCE_LABEL[o.adherence].toLowerCase()}</Pill>
                </div>
                {o.breathing ? <p className="mt-2 text-sm text-ink-2">Breathing: {o.breathing}</p> : null}
                {o.note ? <p className="mt-1 text-sm leading-relaxed text-ink-2">{o.note}</p> : null}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="mt-2 text-sm text-muted">No progress notes for {first} yet.</p>
      )}
    </SheetContent>
  );
}

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
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/input";
import { Pill } from "@/components/ui/pill";
import { Segmented } from "@/components/ui/segmented";
import { PARTICIPATION_LABEL, TOLERANCE_OPTIONS, type Observation, type Participation } from "./data";

/**
 * Private, per-participant observations (doc §2D) — kept apart from the shared class plan and
 * visible to that participant's care team only. Within the instructor's scope: what was observed,
 * not a diagnosis.
 */
export function ObservationSheet({
  patientId,
  cls,
  history,
  canWrite,
  onClose,
  onSave,
}: {
  patientId: string | null;
  cls: YogaClass;
  history: Observation[];
  canWrite: boolean;
  onClose: () => void;
  onSave: (input: { participation: Participation; tolerance: string; text: string; goal: string; concern: boolean }) => void;
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
  history: Observation[];
  canWrite: boolean;
  onClose: () => void;
  onSave: (input: { participation: Participation; tolerance: string; text: string; goal: string; concern: boolean }) => void;
}) {
  const first = name.split(" ")[0];
  const [participation, setParticipation] = useState<Participation>("full");
  const [tolerance, setTolerance] = useState(TOLERANCE_OPTIONS[0]);
  const [text, setText] = useState("");
  const [goal, setGoal] = useState("");
  const [concern, setConcern] = useState(false);
  const [tried, setTried] = useState(false);
  const error = tried && text.trim().length < 10 ? "Describe what you observed (at least a short sentence)." : null;

  return (
    <SheetContent
      title="Private observation"
      description={`${name} · ${cls.title}, ${formatDate(cls.start, { day: "numeric", month: "short" })}`}
      footer={
        canWrite ? (
          <>
            <Button variant="ghost" onClick={onClose}>Cancel</Button>
            <Button
              variant="dark"
              onClick={() => {
                setTried(true);
                if (text.trim().length < 10) return;
                onSave({ participation, tolerance, text: text.trim(), goal: goal.trim(), concern });
              }}
            >
              Save observation
            </Button>
          </>
        ) : null
      }
    >
      <p className="flex items-start gap-2 rounded-inner bg-canvas p-4 text-xs text-ink-2">
        <LockSimple size={16} className="mt-px shrink-0 text-muted" aria-hidden="true" />
        Visible to {first}&apos;s care team only — never part of the shared class plan or other participants&apos; records.
      </p>

      {canWrite ? (
        <div className="mt-6 flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <span className="text-sm text-ink">Participation</span>
            <div className="scrollbar-none -mx-1 overflow-x-auto px-1" data-lenis-prevent>
              <Segmented
                ariaLabel="Participation"
                size="sm"
                variant="tray"
                value={participation}
                onChange={setParticipation}
                items={(Object.keys(PARTICIPATION_LABEL) as Participation[]).map((p) => ({ value: p, label: PARTICIPATION_LABEL[p] }))}
              />
            </div>
          </div>
          <Field label="Tolerance">
            {(a) => <Select id={a.id} value={tolerance} onValueChange={setTolerance} options={TOLERANCE_OPTIONS.map((t) => ({ value: t, label: t }))} />}
          </Field>
          <Field label="What you observed" error={error} hint="Describe what you saw and did — leave interpretation to the clinician.">
            {(a) => <Textarea {...a} value={text} onChange={(ev) => setText(ev.target.value)} rows={4} placeholder="e.g. Breathless after the balance sequence; rested 2 min seated; SpO₂ 93% after rest." />}
          </Field>
          <Field label="Agreed goal" optional>
            {(a) => <Input {...a} value={goal} onChange={(ev) => setGoal(ev.target.value)} placeholder="e.g. Pursed-lip breathing on every stair climb" />}
          </Field>
          <label htmlFor="obs-concern" className="flex cursor-pointer items-start gap-3 rounded-inner p-4 shadow-[inset_0_0_0_1px_var(--color-line)]">
            <Checkbox id="obs-concern" checked={concern} onCheckedChange={(v) => setConcern(v === true)} className="mt-0.5" />
            <span>
              <span className="block text-sm text-ink">Needs clinical review</span>
              <span className="block text-xs text-muted">Also creates a care-team task with this observation attached.</span>
            </span>
          </label>
        </div>
      ) : (
        <p className="mt-6 text-sm text-muted">Only the instructor writes observations. You can read the history below.</p>
      )}

      <h3 className="mt-8 text-xs text-muted">Earlier observations</h3>
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
                  <Pill size="sm" tone="white">{PARTICIPATION_LABEL[o.participation]}</Pill>
                  <Pill size="sm" tone="white">{o.tolerance}</Pill>
                  {o.concern ? <Pill size="sm" tone="primary">Sent for clinical review</Pill> : null}
                </div>
                <p className="mt-2 text-sm leading-relaxed text-ink-2">{o.text}</p>
                {o.goal ? <p className="mt-2 text-xs text-muted">Goal: {o.goal}</p> : null}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="mt-2 text-sm text-muted">No observations recorded for {first} yet.</p>
      )}
    </SheetContent>
  );
}

"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, ModalContent } from "@/components/ui/dialog";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { Segmented } from "@/components/ui/segmented";
import { useToast } from "@/components/ui/toast";
import { DemoNote } from "../ui";
import { NOW_LABEL, TODAY_KEY, istIso } from "../time";
import { addReading, removeReading, type ReadingKind } from "./store";

const KINDS: { value: ReadingKind; label: string }[] = [
  { value: "bp", label: "Blood pressure" },
  { value: "hr", label: "Heart rate" },
  { value: "weight", label: "Weight" },
  { value: "peakflow", label: "Peak flow" },
];

const DEVICES: Record<ReadingKind, string[]> = {
  bp: ["Home BP monitor", "Pharmacy machine", "Smartwatch"],
  hr: ["Home BP monitor", "Smartwatch", "Counted at the wrist"],
  weight: ["Bathroom scale", "Pharmacy scale"],
  peakflow: ["Peak-flow meter"],
};

/** Plausible ranges for typed values (reject typos, never judge the reading). */
const RANGE: Record<ReadingKind, { min: number; max: number; unit: string; decimals: boolean }> = {
  bp: { min: 70, max: 250, unit: "mmHg", decimals: false },
  hr: { min: 30, max: 220, unit: "bpm", decimals: false },
  weight: { min: 30, max: 250, unit: "kg", decimals: true },
  peakflow: { min: 60, max: 900, unit: "L/min", decimals: false },
};

type Errors = Partial<Record<"value" | "value2" | "date" | "time", string>>;

/**
 * Log a self-reported reading. Saved in this browser session, labelled self-reported and
 * listed as awaiting review — it never changes a clinician's record.
 */
export function LogReadingModal({ open, onOpenChange, initialKind = "bp" }: { open: boolean; onOpenChange: (o: boolean) => void; initialKind?: ReadingKind }) {
  const { toast } = useToast();
  const [kind, setKind] = useState<ReadingKind>(initialKind);
  const [value, setValue] = useState("");
  const [value2, setValue2] = useState("");
  const [date, setDate] = useState(TODAY_KEY);
  const [time, setTime] = useState(NOW_LABEL);
  const [device, setDevice] = useState<string | undefined>(DEVICES[initialKind][0]);
  const [note, setNote] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const r = RANGE[kind];

  const clean = (v: string) => (r.decimals ? v.replace(/[^\d.]/g, "").replace(/(\..*)\./g, "$1").slice(0, 5) : v.replace(/\D/g, "").slice(0, 3));

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const v = Number(value);
    const v2 = Number(value2);
    const next: Errors = {};
    if (!value) next.value = kind === "bp" ? "Enter the top number" : "Enter your reading";
    else if (!Number.isFinite(v) || v < r.min || v > r.max) next.value = `Check the number — expected ${r.min}–${r.max} ${r.unit}`;
    if (kind === "bp") {
      if (!value2) next.value2 = "Enter the bottom number";
      else if (!Number.isFinite(v2) || v2 < 40 || v2 > 150) next.value2 = "Check the number — expected 40–150 mmHg";
      else if (!next.value && v2 >= v) next.value2 = "The bottom number should be lower than the top";
    }
    if (!date) next.date = "Choose the day you measured it";
    else if (date > TODAY_KEY) next.date = "Readings can't be in the future";
    if (!/^\d{2}:\d{2}$/.test(time)) next.time = "Add the time";
    else if (date === TODAY_KEY && time > NOW_LABEL) next.time = `It's ${NOW_LABEL} now — choose an earlier time`;
    setErrors(next);
    if (Object.keys(next).length) return;

    const saved = addReading({ kind, value: v, value2: kind === "bp" ? v2 : undefined, measuredAt: istIso(date, time), device, note: note.trim() || undefined });
    onOpenChange(false);
    toast({
      tone: "success",
      title: `${KINDS.find((k) => k.value === kind)?.label} saved · ${kind === "bp" ? `${v}/${v2}` : v} ${r.unit}`,
      description: "Labelled self-reported and kept in this browser session — nothing was sent to the clinic.",
      action: { label: "Undo", onClick: () => removeReading(saved.id) },
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <ModalContent
        size="md"
        title="Log a reading"
        description="Your reading is labelled self-reported until your care team reviews it."
        footer={
          <>
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" form="log-reading-form">
              Save reading
            </Button>
          </>
        }
      >
        <form id="log-reading-form" onSubmit={submit} noValidate className="flex flex-col gap-4">
          <div className="-mx-1 overflow-x-auto px-1 pb-1 scrollbar-none">
            <Segmented<ReadingKind>
              ariaLabel="What are you logging?"
              value={kind}
              onChange={(k) => {
                setKind(k);
                setValue("");
                setValue2("");
                setDevice(DEVICES[k][0]);
                setErrors({});
              }}
              variant="tray"
              size="sm"
              items={KINDS}
            />
          </div>

          {kind === "bp" ? (
            <div className="grid grid-cols-2 gap-3">
              <Field label="Top (systolic)" error={errors.value} hint="mmHg">
                {(f) => <Input {...f} inputMode="numeric" value={value} onChange={(e) => setValue(clean(e.target.value))} placeholder="126" />}
              </Field>
              <Field label="Bottom (diastolic)" error={errors.value2} hint="mmHg">
                {(f) => <Input {...f} inputMode="numeric" value={value2} onChange={(e) => setValue2(clean(e.target.value))} placeholder="80" />}
              </Field>
            </div>
          ) : (
            <Field label={kind === "hr" ? "Resting heart rate" : kind === "weight" ? "Weight" : "Best of three blows"} error={errors.value} hint={r.unit}>
              {(f) => <Input {...f} inputMode={r.decimals ? "decimal" : "numeric"} value={value} onChange={(e) => setValue(clean(e.target.value))} placeholder={kind === "hr" ? "68" : kind === "weight" ? "78.3" : "480"} />}
            </Field>
          )}

          <div className="grid grid-cols-2 gap-3">
            <Field label="Measured on" error={errors.date}>
              {(f) => <Input {...f} type="date" max={TODAY_KEY} value={date} onChange={(e) => setDate(e.target.value)} />}
            </Field>
            <Field label="Time" error={errors.time}>
              {(f) => <Input {...f} type="time" value={time} onChange={(e) => setTime(e.target.value)} />}
            </Field>
          </div>

          <Field label="Measured with" optional>
            {(f) => <Select id={f.id} value={device} onValueChange={setDevice} options={DEVICES[kind].map((d) => ({ value: d, label: d }))} />}
          </Field>

          <Field label="Anything to add?" optional hint={`${note.length} / 200`}>
            {(f) => <Textarea {...f} value={note} maxLength={200} onChange={(e) => setNote(e.target.value)} placeholder={kind === "bp" ? "For example: measured after 5 minutes sitting" : "For example: after my morning class"} />}
          </Field>

          <DemoNote>If you feel chest pain, severe breathlessness or faint, don&apos;t wait for a review — call 112.</DemoNote>
        </form>
      </ModalContent>
    </Dialog>
  );
}

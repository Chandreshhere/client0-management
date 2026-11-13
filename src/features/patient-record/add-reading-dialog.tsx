"use client";

import { useRef, useState } from "react";
import type { Patient } from "@/data/types";
import { Dialog, ModalContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/input";
import { Segmented } from "@/components/ui/segmented";
import { useToast } from "@/components/ui/toast";
import { useRole } from "@/components/shell/role-context";
import { TODAY } from "@/lib/format";
import { localId, updateRecord } from "./store";
import type { VitalMeasure } from "./measures";

const TODAY_DATE = "2026-11-13";
const LB_TO_KG = 0.45359237;

type Errors = Partial<Record<"v" | "v2" | "date", string>>;

const parseNum = (s: string) => {
  const t = s.replace(",", ".").trim();
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
};

/**
 * "Add reading": value(s), unit, date and source for one of this patient's measured vitals.
 * Home readings are stored as self-reported. Kept in this browser session only.
 */
export function AddReadingDialog({
  open,
  onOpenChange,
  selfOnly,
  patient,
  measures,
  initialKey,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  selfOnly: boolean;
  patient: Patient;
  measures: VitalMeasure[];
  initialKey?: string;
}) {
  const { user } = useRole();
  const { toast } = useToast();
  const firstInput = useRef<HTMLInputElement>(null);
  const fallbackKey = measures[0]?.key ?? "";
  const [key, setKey] = useState(initialKey ?? fallbackKey);
  const meta = measures.find((m) => m.key === key) ?? measures[0];
  const [v, setV] = useState("");
  const [v2, setV2] = useState("");
  const [unit, setUnit] = useState(meta?.units[0] ?? "");
  const [date, setDate] = useState(TODAY_DATE);
  const lastWasSelf = meta?.points[meta.points.length - 1]?.self ?? false;
  const [source, setSource] = useState<"clinic" | "home">(selfOnly || lastWasSelf ? "home" : "clinic");
  const [errors, setErrors] = useState<Errors>({});

  if (!meta) return null;

  const isLb = meta.unit === "kg" && unit === "lb";
  const shownBounds = isLb ? meta.bounds.map((b) => Math.round(b / LB_TO_KG)) : meta.bounds;

  const reset = () => {
    const m = measures.find((x) => x.key === (initialKey ?? fallbackKey)) ?? measures[0];
    setKey(m.key);
    setV("");
    setV2("");
    setUnit(m.units[0]);
    setDate(TODAY_DATE);
    setSource(selfOnly || m.points[m.points.length - 1]?.self ? "home" : "clinic");
    setErrors({});
  };

  const changeMeasure = (next: string) => {
    const m = measures.find((x) => x.key === next);
    if (!m) return;
    setKey(m.key);
    setUnit(m.units[0]);
    setV("");
    setV2("");
    setErrors({});
    if (!selfOnly) setSource(m.points[m.points.length - 1]?.self ? "home" : "clinic");
  };

  const submit = () => {
    const errs: Errors = {};
    const n1 = parseNum(v);
    const n2 = parseNum(v2);
    const stored1 = n1 === null ? null : isLb ? +(n1 * LB_TO_KG).toFixed(1) : n1;
    if (n1 === null) errs.v = meta.twoValues ? "Enter the systolic value." : "Enter a number.";
    else if (stored1! < meta.bounds[0] || stored1! > meta.bounds[1]) errs.v = `Expected ${shownBounds[0]}–${shownBounds[1]} ${unit}. Check the reading.`;
    if (meta.twoValues) {
      if (n2 === null) errs.v2 = "Enter the diastolic value.";
      else if (meta.bounds2 && (n2 < meta.bounds2[0] || n2 > meta.bounds2[1])) errs.v2 = `Expected ${meta.bounds2[0]}–${meta.bounds2[1]} ${meta.unit}.`;
      else if (n1 !== null && n2 >= n1) errs.v2 = "Diastolic should be lower than systolic.";
    }
    if (!date) errs.date = "Add the date the reading was taken.";
    else if (date > TODAY_DATE) errs.date = "A reading can't be dated in the future.";
    setErrors(errs);
    if (Object.keys(errs).length) return;

    const self = source === "home";
    const factor = 10 ** meta.decimals;
    const persisted = updateRecord((s) => ({
      ...s,
      readings: [
        ...s.readings,
        {
          id: localId("rd"),
          series: meta.key,
          patientId: patient.id,
          d: date,
          v: Math.round(stored1! * factor) / factor,
          v2: meta.twoValues ? Math.round(n2!) : undefined,
          self,
          by: user.name,
          at: TODAY.toISOString(),
          note: isLb ? `Entered as ${n1} lb` : undefined,
        },
      ],
    }));
    toast({
      title: `${meta.label} reading added`,
      description: `${self ? "Marked self-reported until a clinician reviews it." : `Recorded as a clinic measurement by ${user.name}.`} ${persisted ? "Saved in this browser session" : "Kept in memory only (browser storage is blocked)"} — nothing was sent.`,
      tone: "success",
    });
    onOpenChange(false);
    reset();
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) reset();
      }}
    >
      <ModalContent
        title="Add reading"
        description={`Recorded in this demo session against ${patient.name}'s record.`}
        size="sm"
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          firstInput.current?.focus();
        }}
        footer={
          <>
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button variant="dark" onClick={submit}>
              Add reading
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
          <Field label="Measurement">
            {({ id }) => <Select id={id} value={meta.key} onValueChange={changeMeasure} options={measures.map((m) => ({ value: m.key, label: m.label, description: m.targetLabel }))} />}
          </Field>

          {meta.twoValues ? (
            <div className="grid grid-cols-2 gap-3">
              <Field label="Systolic" error={errors.v}>
                {(p) => <Input ref={firstInput} inputMode="numeric" autoComplete="off" value={v} onChange={(e) => { setV(e.target.value); setErrors((x) => ({ ...x, v: undefined })); }} placeholder="e.g. 126" {...p} />}
              </Field>
              <Field label="Diastolic" error={errors.v2}>
                {(p) => <Input inputMode="numeric" autoComplete="off" value={v2} onChange={(e) => { setV2(e.target.value); setErrors((x) => ({ ...x, v2: undefined })); }} placeholder="e.g. 80" {...p} />}
              </Field>
            </div>
          ) : (
            <Field label="Value" error={errors.v} hint={isLb ? "Stored in kg — converted on save." : `Last recorded ${meta.points[meta.points.length - 1]?.v.toFixed(meta.decimals) ?? "—"} ${meta.unit}`}>
              {(p) => (
                <Input
                  ref={firstInput}
                  inputMode="decimal"
                  autoComplete="off"
                  value={v}
                  onChange={(e) => {
                    setV(e.target.value);
                    setErrors((x) => ({ ...x, v: undefined }));
                  }}
                  {...p}
                />
              )}
            </Field>
          )}

          <div className="grid grid-cols-2 gap-3">
            <Field label="Unit" hint={meta.units.length === 1 ? "Fixed for this measurement" : undefined}>
              {({ id }) => <Select id={id} value={unit} onValueChange={setUnit} disabled={meta.units.length === 1} options={meta.units.map((u) => ({ value: u, label: u || "—" }))} />}
            </Field>
            <Field label="Date taken" error={errors.date}>
              {(p) => (
                <Input
                  type="date"
                  value={date}
                  max={TODAY_DATE}
                  onChange={(e) => {
                    setDate(e.target.value);
                    setErrors((x) => ({ ...x, date: undefined }));
                  }}
                  {...p}
                />
              )}
            </Field>
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-sm text-ink" id="reading-source-label">
              Source
            </span>
            <Segmented
              ariaLabel="Source"
              variant="tray"
              size="sm"
              className="self-start"
              value={source}
              onChange={(s) => !selfOnly && setSource(s)}
              items={[
                { value: "clinic", label: "Clinic" },
                { value: "home", label: "Home device (self-reported)" },
              ]}
            />
            <p className="text-xs text-muted">
              {source === "home"
                ? "Shown with a hollow marker and the label “self-reported” until reviewed."
                : selfOnly
                  ? "Patients can only add home readings."
                  : "A clinic measurement you took or witnessed."}
            </p>
          </div>
          <button type="submit" className="sr-only">
            Add reading
          </button>
        </form>
      </ModalContent>
    </Dialog>
  );
}

"use client";

import { useEffect, useMemo, useState } from "react";
import { Package } from "@phosphor-icons/react";
import { PATIENTS, patientById } from "@/data/patients";
import { formatDate } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, ModalContent } from "@/components/ui/dialog";
import { Checkbox, Field, Input, Select } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { useRole } from "@/components/shell/role-context";
import { DisciplineTag, InfoNote } from "@/features/settings/ui";
import { TODAY_KEY, addDays, daysUntil } from "@/features/settings/time";
import { PROGRAMMES, billingLabel, programmeById, type PackageRow } from "./data";
import { money } from "./meta";
import { firstInstalment, sellPackage, undoSale } from "./store";

type Errors = Partial<Record<"patient" | "programme" | "start", string>>;

const PATIENT_OPTIONS = [...PATIENTS].sort((a, b) => a.name.localeCompare(b.name)).map((p) => ({ value: p.id, label: p.name, description: `${p.age} · ${p.area}${p.program ? ` · ${p.program}` : ""}` }));

/** Sell a programme package. Local only: no payment is taken and nothing is sent to the patient. */
export function SellPackageModal({
  open,
  onOpenChange,
  presetProgramme,
  packages,
  onSold,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  presetProgramme: string | null;
  packages: PackageRow[];
  onSold: (pkgKey: string) => void;
}) {
  const { toast } = useToast();
  const { user } = useRole();
  const [patientId, setPatientId] = useState("");
  const [programmeId, setProgrammeId] = useState("");
  const [start, setStart] = useState(TODAY_KEY);
  const [draftInvoice, setDraftInvoice] = useState(true);
  const [errors, setErrors] = useState<Errors>({});

  useEffect(() => {
    if (!open) return;
    setPatientId("");
    setProgrammeId(presetProgramme ?? "");
    setStart(TODAY_KEY);
    setDraftInvoice(true);
    setErrors({});
  }, [open, presetProgramme]);

  const prog = programmeById(programmeId);
  const charge = prog ? firstInstalment(prog.id) : 0;
  const validStart = /^\d{4}-\d{2}-\d{2}$/.test(start);
  const until = prog && validStart ? addDays(start, prog.validityDays) : null;

  const clash = useMemo(() => {
    if (!prog || !patientId) return null;
    return packages.find((k) => k.patientId === patientId && k.name.startsWith(prog.match) && k.used < k.total && daysUntil(k.expires) >= 0) ?? null;
  }, [packages, patientId, prog]);

  function validate(): Errors {
    const e: Errors = {};
    if (!patientId) e.patient = "Choose the patient.";
    if (!prog) e.programme = "Choose a programme.";
    else if (clash) {
      const p = patientById(clash.patientId);
      e.programme = `${p?.name ?? "This patient"} already has an active ${prog.match} package (${clash.total - clash.used} credits left, expires ${formatDate(clash.expires)}).`;
    }
    if (!validStart) e.start = "Enter a start date.";
    else if (daysUntil(start) < 0) e.start = "The start date can't be in the past.";
    else if (daysUntil(start) > 90) e.start = "Start within the next 90 days.";
    return e;
  }

  function submit() {
    const e = validate();
    setErrors(e);
    if (Object.keys(e).length || !prog) return;
    const { pkg, invoice } = sellPackage({ patientId, programmeId: prog.id, start, draftInvoice, actorId: user.id });
    const p = patientById(patientId);
    onSold(pkg.key);
    onOpenChange(false);
    toast({
      tone: "success",
      title: "Package added in this browser session",
      description: `${prog.match} · ${prog.credits} credits for ${p?.name}. ${invoice ? `Draft invoice ${invoice.number} for ${money(invoice.total)} is on Invoices — not sent, ` : ""}no payment was taken.`,
      action: { label: "Undo", onClick: () => undoSale(pkg.key, invoice?.id ?? null, user.id) },
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <ModalContent
        size="md"
        title="Sell package"
        description="Adds session credits to the patient's account. Nothing is charged here."
        footer={
          <>
            <DialogClose asChild>
              <Button variant="ghost">Cancel</Button>
            </DialogClose>
            <Button variant="primary" leading={<Package />} onClick={submit}>
              Add package
            </Button>
          </>
        }
      >
        <form
          className="flex flex-col gap-5"
          noValidate
          onSubmit={(ev) => {
            ev.preventDefault();
            submit();
          }}
        >
          <Field label="Patient" error={errors.patient}>
            {(a) => (
              <Select
                id={a.id}
                ariaLabel="Patient"
                placeholder="Choose a patient"
                value={patientId || undefined}
                onValueChange={(v) => {
                  setPatientId(v);
                  setErrors((x) => ({ ...x, patient: undefined, programme: undefined }));
                }}
                options={PATIENT_OPTIONS}
                className={errors.patient ? "shadow-[inset_0_0_0_1.5px_var(--color-danger)]" : undefined}
              />
            )}
          </Field>

          <Field label="Programme" error={errors.programme}>
            {(a) => (
              <Select
                id={a.id}
                ariaLabel="Programme"
                placeholder="Choose a programme"
                value={programmeId || undefined}
                onValueChange={(v) => {
                  setProgrammeId(v);
                  setErrors((x) => ({ ...x, programme: undefined }));
                }}
                options={PROGRAMMES.map((p) => ({ value: p.id, label: p.name, description: `${money(p.price)} · ${p.credits} session credits · valid ${Math.round(p.validityDays / 7)} weeks` }))}
                className={errors.programme ? "shadow-[inset_0_0_0_1.5px_var(--color-danger)]" : undefined}
              />
            )}
          </Field>

          <Field label="Credits start" error={errors.start} hint={until ? `Valid until ${formatDate(until)}` : "Credits can be used from this date."}>
            {(a) => (
              <Input
                {...a}
                type="date"
                min={TODAY_KEY}
                value={start}
                onChange={(ev) => {
                  setStart(ev.target.value);
                  setErrors((x) => ({ ...x, start: undefined }));
                }}
                className="tabular"
              />
            )}
          </Field>

          {prog ? (
            <div className="rounded-inner bg-sunken p-4">
              <div className="flex items-baseline justify-between gap-3">
                <p className="text-sm text-ink">{prog.name}</p>
                <p className="text-sm text-ink tabular">{money(prog.price)}</p>
              </div>
              <p className="mt-0.5 text-xs text-muted">{billingLabel(prog)}</p>
              <ul className="mt-3 flex flex-col gap-1.5">
                {prog.includes.map((inc) => (
                  <li key={inc.label} className="flex items-center justify-between gap-3">
                    <DisciplineTag discipline={inc.discipline} label={inc.label} />
                    <span className="text-xs text-ink tabular">× {inc.count}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <label className="flex items-start gap-3 text-sm text-ink">
            <Checkbox checked={draftInvoice} onCheckedChange={(v) => setDraftInvoice(v === true)} className="mt-0.5" />
            <span>
              Draft an invoice{prog ? ` for ${money(charge)}` : ""}
              <span className="block text-xs text-muted">{prog?.billing === "monthly" ? "First monthly instalment. " : ""}It appears on Invoices as a draft — not sent to the patient.</span>
            </span>
          </label>

          <InfoNote>Saved in this browser session only. No payment is taken and the patient isn&apos;t notified.</InfoNote>
          <button type="submit" className="sr-only" tabIndex={-1}>
            Add package
          </button>
        </form>
      </ModalContent>
    </Dialog>
  );
}

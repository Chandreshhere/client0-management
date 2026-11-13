"use client";

import { AnimatePresence, motion } from "motion/react";
import { ArrowCounterClockwise, ClipboardText, Plus, Trash } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { IconButton } from "@/components/ui/icon-button";
import { Input, Select } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/misc";
import { pluralize } from "@/lib/format";
import { spring } from "@/lib/motion";
import { cn } from "@/lib/cn";
import { DURATIONS, SPECIALITIES, blankService, specialityLabel, suggestedServices, type ServiceRow } from "../model";
import { InlineError, type StepProps } from "../controls";

const COLS = "md:grid-cols-[minmax(0,1fr)_152px_120px_128px_40px]";
const invalidRing = "shadow-[inset_0_0_0_1.5px_var(--color-danger)] hover:shadow-[inset_0_0_0_1.5px_var(--color-danger)]";

export function ServicesStep({ data, update, errors }: StepProps) {
  const specs = data.clinic.specialities;
  const edit = (id: string, patch: Partial<ServiceRow>) =>
    update((d) => ({ ...d, servicesEdited: true, services: d.services.map((s) => (s.id === id ? { ...s, ...patch } : s)) }));
  const remove = (id: string) => update((d) => ({ ...d, servicesEdited: true, services: d.services.filter((s) => s.id !== id) }));
  const add = () => update((d) => ({ ...d, servicesEdited: true, services: [...d.services, blankService(d.clinic.specialities[0] ?? "medical")] }));
  const reset = () => update((d) => ({ ...d, servicesEdited: false, services: suggestedServices(d.clinic.specialities) }));

  const specOptions = (current: ServiceRow["speciality"]) =>
    SPECIALITIES.filter((s) => specs.includes(s.id) || s.id === current).map((s) => ({ value: s.id, label: specs.includes(s.id) ? s.label : `${s.label} (not offered)` }));

  return (
    <Card className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-normal tracking-[-0.01em] text-ink">{pluralize(data.services.length, "service")}</h2>
          <p className="mt-1 text-xs text-muted">
            {data.servicesEdited ? "Edited by you." : specs.length ? `Suggested for ${specs.map(specialityLabel).join(", ")}. Placeholder fees — set your own.` : "Pick specialities on step 1 to get suggestions."}
          </p>
        </div>
        <Button variant="ghost" size="sm" leading={<ArrowCounterClockwise />} onClick={reset} disabled={!data.servicesEdited || !specs.length} data-testid="reset-services">
          Reset to suggestions
        </Button>
      </div>

      {data.services.length ? (
        <>
          <div className={cn("hidden gap-3 px-1 text-xs text-muted md:grid", COLS)} aria-hidden="true">
            <span>Service</span>
            <span>Speciality</span>
            <span>Duration</span>
            <span>Fee</span>
            <span />
          </div>
          <ul className="flex flex-col gap-3">
            <AnimatePresence initial={false}>
              {data.services.map((s, i) => {
                const nameErr = errors[`services.${s.id}.name`];
                const specErr = errors[`services.${s.id}.speciality`];
                const feeErr = errors[`services.${s.id}.fee`];
                const errId = `svc-err-${s.id}`;
                const rowErrors = [nameErr, specErr, feeErr].filter(Boolean).join(" ");
                const n = i + 1;
                return (
                  <motion.li key={s.id} layout="position" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, transition: { duration: 0.12 } }} transition={spring}>
                    <div className={cn("grid grid-cols-2 gap-3 rounded-inner bg-canvas p-3 md:items-center md:rounded-none md:bg-transparent md:p-0", COLS)}>
                      <Input
                        aria-label={`Service ${n} name`}
                        aria-invalid={nameErr ? true : undefined}
                        aria-describedby={rowErrors ? errId : undefined}
                        placeholder="e.g. New consultation"
                        value={s.name}
                        onChange={(e) => edit(s.id, { name: e.target.value })}
                        className="col-span-2 md:col-span-1"
                        data-testid={`service-name-${i}`}
                      />
                      <div data-error-anchor={specErr ? "true" : undefined}>
                        <Select
                          ariaLabel={`Service ${n} speciality`}
                          value={s.speciality}
                          onValueChange={(v) => edit(s.id, { speciality: v as ServiceRow["speciality"] })}
                          options={specOptions(s.speciality)}
                          className={cn(specErr && invalidRing)}
                        />
                      </div>
                      <Select
                        ariaLabel={`Service ${n} duration`}
                        value={String(s.duration)}
                        onValueChange={(v) => edit(s.id, { duration: Number(v) })}
                        options={DURATIONS.map((m) => ({ value: String(m), label: `${m} min` }))}
                      />
                      <div className="relative">
                        <span className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-sm text-muted" aria-hidden="true">
                          ₹
                        </span>
                        <Input
                          aria-label={`Service ${n} fee in rupees`}
                          aria-invalid={feeErr ? true : undefined}
                          aria-describedby={rowErrors ? errId : undefined}
                          inputMode="numeric"
                          placeholder="0"
                          value={s.fee}
                          onChange={(e) => edit(s.id, { fee: e.target.value.replace(/[,\s₹]/g, "") })}
                          className="pl-8 tabular"
                          data-testid={`service-fee-${i}`}
                        />
                      </div>
                      <IconButton
                        label={`Remove ${s.name.trim() || `service ${n}`}`}
                        variant="ghost"
                        onClick={() => remove(s.id)}
                        className="justify-self-end"
                        data-testid={`remove-service-${i}`}
                      >
                        <Trash />
                      </IconButton>
                    </div>
                    <InlineError id={errId} className="mt-2 px-1">
                      {rowErrors}
                    </InlineError>
                  </motion.li>
                );
              })}
            </AnimatePresence>
          </ul>
        </>
      ) : (
        <EmptyState
          className="py-8"
          icon={<ClipboardText />}
          title="No services yet"
          description={errors["services"] ?? "Add the consultations and sessions patients can book."}
        />
      )}

      <div className="flex flex-wrap items-center gap-3">
        <Button variant="secondary" leading={<Plus />} onClick={add} disabled={!specs.length} data-testid="add-service">
          Add service
        </Button>
        {!specs.length ? <span className="text-xs text-muted">Choose a speciality on step 1 first.</span> : null}
      </div>
      <p className="text-xs text-muted">Services and fees stay in this browser for the demo. Taxes aren&apos;t calculated in this prototype.</p>
    </Card>
  );
}

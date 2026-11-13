"use client";

import { MagicWand } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/cn";
import { CITIES, MAX_BRANCHES, SPECIALITIES, withBranches, withSample, withSpecialities } from "../model";
import { InlineError, Stepper, ToggleChip, type StepProps } from "../controls";

const invalidRing = "shadow-[inset_0_0_0_1.5px_var(--color-danger)] hover:shadow-[inset_0_0_0_1.5px_var(--color-danger)]";

export function ClinicStep({ data, update, errors }: StepProps) {
  const { toast } = useToast();
  const { clinic } = data;

  const fillSample = () => {
    update(withSample);
    toast({ title: "Sample clinic filled in", description: "Prana Integrative Clinic is fictional. Change anything you like." });
  };

  return (
    <Card className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-normal tracking-[-0.01em] text-ink">Clinic details</h2>
        <Button variant="soft" size="sm" leading={<MagicWand />} onClick={fillSample} data-testid="fill-sample">
          Use sample clinic
        </Button>
      </div>

      <Field label="Clinic name" error={errors["clinic.name"]}>
        {(p) => (
          <Input
            {...p}
            autoComplete="organization"
            placeholder="e.g. Prana Integrative Clinic"
            value={clinic.name}
            onChange={(e) => update((d) => ({ ...d, clinic: { ...d.clinic, name: e.target.value } }))}
            data-testid="clinic-name"
          />
        )}
      </Field>

      <div className="grid gap-6 sm:grid-cols-2">
        <Field label="City" error={errors["clinic.city"]}>
          {(p) => (
            <div data-error-anchor={errors["clinic.city"] ? "true" : undefined}>
              <Select
                id={p.id}
                value={clinic.city}
                onValueChange={(v) => update((d) => ({ ...d, clinic: { ...d.clinic, city: v } }))}
                placeholder="Choose a city"
                options={CITIES.map((c) => ({ value: c, label: c }))}
                className={cn(errors["clinic.city"] && invalidRing)}
              />
            </div>
          )}
        </Field>
        <Field label="Branches" hint={clinic.branches > 1 ? "Managing several branches is part of the Clinic plan." : "Add more if you run several locations."}>
          {(p) => (
            <Stepper
              id={p.id}
              describedBy={p["aria-describedby"]}
              value={clinic.branches}
              min={1}
              max={MAX_BRANCHES}
              onChange={(n) => update((d) => withBranches(d, n))}
              noun="branches"
              testId="branches"
            />
          )}
        </Field>
      </div>

      <fieldset aria-describedby={errors["clinic.specialities"] ? "specialities-error" : "specialities-hint"}>
        <legend className="text-sm text-ink">Specialities</legend>
        <p id="specialities-hint" className="mt-1 text-xs text-muted">
          Pick every discipline you offer. Each one gets suggested services on step 3.
        </p>
        <div className="mt-3 flex flex-wrap gap-2" data-error-anchor={errors["clinic.specialities"] ? "true" : undefined}>
          {SPECIALITIES.map((s) => {
            const on = clinic.specialities.includes(s.id);
            return (
              <ToggleChip
                key={s.id}
                pressed={on}
                dot={s.color}
                title={s.detail}
                onPressedChange={(next) => update((d) => withSpecialities(d, next ? [...d.clinic.specialities, s.id] : d.clinic.specialities.filter((x) => x !== s.id)))}
                data-testid={`speciality-${s.id}`}
              >
                {s.label}
              </ToggleChip>
            );
          })}
        </div>
        <InlineError id="specialities-error" className="mt-2">
          {errors["clinic.specialities"]}
        </InlineError>
      </fieldset>
    </Card>
  );
}

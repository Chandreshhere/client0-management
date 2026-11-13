"use client";

import { Copy } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input, Switch } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { WEEKDAYS, type BranchHours } from "../model";
import { InlineError, ToggleChip, type StepProps } from "../controls";

export function HoursStep({ data, update, errors }: StepProps) {
  const { toast } = useToast();
  const set = (id: string, patch: Partial<BranchHours>) => update((d) => ({ ...d, hours: d.hours.map((h) => (h.id === id ? { ...h, ...patch } : h)) }));
  const first = data.hours[0];

  return (
    <div className="flex flex-col gap-4">
      {data.hours.map((b, i) => {
        const err = (k: string) => errors[`hours.${b.id}.${k}`];
        const lunchErrId = `lunch-err-${b.id}`;
        const daysErrId = `days-err-${b.id}`;
        return (
          <Card key={b.id} className="flex flex-col gap-6">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <Field label={data.hours.length > 1 ? `Branch ${i + 1} name` : "Branch name"} error={err("name")} className="min-w-0 flex-1 sm:max-w-[320px]">
                {(p) => <Input {...p} value={b.name} onChange={(e) => set(b.id, { name: e.target.value })} data-testid={`branch-name-${i}`} />}
              </Field>
              {i > 0 && first ? (
                <Button
                  variant="ghost"
                  size="sm"
                  leading={<Copy />}
                  onClick={() => {
                    set(b.id, { days: [...first.days], open: first.open, close: first.close, lunch: first.lunch, lunchStart: first.lunchStart, lunchEnd: first.lunchEnd });
                    toast({ title: `Hours copied from ${first.name.trim() || "branch 1"}`, description: "Saved in this browser session." });
                  }}
                  data-testid={`copy-hours-${i}`}
                >
                  Copy hours from {first.name.trim() || "branch 1"}
                </Button>
              ) : null}
            </div>

            <fieldset aria-describedby={err("days") ? daysErrId : undefined}>
              <legend className="text-sm text-ink">Working days</legend>
              <div className="mt-3 flex flex-wrap gap-2" data-error-anchor={err("days") ? "true" : undefined}>
                {WEEKDAYS.map((w) => (
                  <ToggleChip
                    key={w.id}
                    size="sm"
                    pressed={b.days.includes(w.id)}
                    onPressedChange={(on) => set(b.id, { days: on ? [...b.days, w.id] : b.days.filter((x) => x !== w.id) })}
                    aria-label={w.label}
                    data-testid={`day-${i}-${w.id}`}
                  >
                    {w.short}
                  </ToggleChip>
                ))}
              </div>
              <InlineError id={daysErrId} className="mt-2">
                {err("days")}
              </InlineError>
            </fieldset>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Opens" error={err("open")}>
                {(p) => <Input {...p} type="time" step={900} value={b.open} onChange={(e) => set(b.id, { open: e.target.value })} className="tabular" data-testid={`open-${i}`} />}
              </Field>
              <Field label="Closes" error={err("close")}>
                {(p) => <Input {...p} type="time" step={900} value={b.close} onChange={(e) => set(b.id, { close: e.target.value })} className="tabular" data-testid={`close-${i}`} />}
              </Field>
            </div>

            <div className="flex flex-col gap-4 rounded-inner bg-canvas p-4">
              <div className="flex items-center justify-between gap-4">
                <label htmlFor={`lunch-${b.id}`} className="text-sm text-ink">
                  Lunch break
                  <span className="block text-xs text-muted">{b.lunch ? `${b.lunchStart}–${b.lunchEnd}` : "No break"}</span>
                </label>
                <Switch id={`lunch-${b.id}`} checked={b.lunch} onCheckedChange={(v) => set(b.id, { lunch: v })} data-testid={`lunch-${i}`} />
              </div>
              {b.lunch ? (
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="From">
                    {(p) => (
                      <Input
                        {...p}
                        aria-invalid={err("lunch") ? true : undefined}
                        aria-describedby={err("lunch") ? lunchErrId : undefined}
                        type="time"
                        step={900}
                        value={b.lunchStart}
                        onChange={(e) => set(b.id, { lunchStart: e.target.value })}
                        className="tabular"
                      />
                    )}
                  </Field>
                  <Field label="To">
                    {(p) => (
                      <Input
                        {...p}
                        aria-invalid={err("lunch") ? true : undefined}
                        aria-describedby={err("lunch") ? lunchErrId : undefined}
                        type="time"
                        step={900}
                        value={b.lunchEnd}
                        onChange={(e) => set(b.id, { lunchEnd: e.target.value })}
                        className="tabular"
                      />
                    )}
                  </Field>
                </div>
              ) : null}
              <InlineError id={lunchErrId}>{err("lunch")}</InlineError>
            </div>
          </Card>
        );
      })}
      <p className="text-xs text-muted">Times are in IST (India Standard Time).</p>
    </div>
  );
}

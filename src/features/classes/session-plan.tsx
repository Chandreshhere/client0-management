"use client";

import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { ArrowDown, ArrowUp, Check, PencilSimple, Plus, Trash, UsersThree } from "@phosphor-icons/react";
import type { YogaClass } from "@/data/types";
import { cn } from "@/lib/cn";
import { spring } from "@/lib/motion";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { IconButton } from "@/components/ui/icon-button";
import { Input } from "@/components/ui/input";
import { Pill } from "@/components/ui/pill";
import { PROP_OPTIONS, type SessionPlan } from "./data";

/**
 * Shared lesson plan (doc §2D): sequence, duration, modifications, props, objectives. It is the
 * same for every participant — individual precautions stay on each roster row.
 */
export function SessionPlanCard({ cls, plan, editable, onSave }: { cls: YogaClass; plan: SessionPlan; editable: boolean; onSave: (plan: SessionPlan) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<SessionPlan>(plan);
  const [newStep, setNewStep] = useState("");
  const [newMin, setNewMin] = useState("5");
  const [stepError, setStepError] = useState<string | null>(null);

  const view = editing ? draft : plan;
  const total = view.steps.reduce((n, st) => n + st.minutes, 0);
  const over = total - cls.durationMin;

  const move = (i: number, dir: -1 | 1) =>
    setDraft((d) => {
      const steps = [...d.steps];
      const j = i + dir;
      if (j < 0 || j >= steps.length) return d;
      [steps[i], steps[j]] = [steps[j], steps[i]];
      return { ...d, steps };
    });

  const addStep = () => {
    const minutes = Number(newMin);
    if (!newStep.trim()) return setStepError("Name the step");
    if (!Number.isFinite(minutes) || minutes < 1 || minutes > 60) return setStepError("1–60 minutes");
    setDraft((d) => ({ ...d, steps: [...d.steps, { id: `st-${d.steps.length}-${newStep.trim().length}-${minutes}-${Math.random().toString(36).slice(2, 7)}`, name: newStep.trim(), minutes }] }));
    setNewStep("");
    setNewMin("5");
    setStepError(null);
  };

  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-normal tracking-[-0.01em] text-ink">Session plan</h2>
          <p className="mt-1 flex items-center gap-1.5 text-xs text-muted">
            <UsersThree size={14} aria-hidden="true" /> Shared lesson plan · same for everyone
          </p>
        </div>
        {editable && !editing ? (
          <IconButton
            label="Edit session plan"
            tooltip="left"
            onClick={() => {
              setDraft(plan);
              setEditing(true);
            }}
          >
            <PencilSimple />
          </IconButton>
        ) : null}
      </div>

      {view.objectives.length ? (
        <div className="mt-4 flex flex-wrap gap-1.5" aria-label="Objectives">
          {view.objectives.map((o) => (
            <Pill key={o} size="sm" tone="neutral">{o}</Pill>
          ))}
        </div>
      ) : null}

      <div className="mt-6 flex items-baseline justify-between gap-2">
        <h3 className="text-sm text-ink">Sequence</h3>
        <span className={cn("text-xs tabular", over > 0 ? "text-warning" : "text-muted")}>
          {total} of {cls.durationMin} min{over > 0 ? ` · ${over} over` : over < 0 ? ` · ${-over} spare` : ""}
        </span>
      </div>
      <ol className="mt-2 flex flex-col">
        <AnimatePresence initial={false}>
          {view.steps.map((st, i) => (
            <motion.li key={st.id} layout="position" transition={spring} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, transition: { duration: 0.12 } }} className={cn("flex gap-3 border-t border-line py-2.5 first:border-t-0", editing ? "items-start" : "items-center")}>
              <span className={cn("w-5 shrink-0 font-mono text-[11px] text-muted", editing && "pt-2")}>{String(i + 1).padStart(2, "0")}</span>
              {editing ? (
                <div className="flex min-w-0 flex-1 flex-col gap-2">
                  <Input aria-label={`Step ${i + 1} name`} value={st.name} onChange={(e) => setDraft((d) => ({ ...d, steps: d.steps.map((x) => (x.id === st.id ? { ...x, name: e.target.value } : x)) }))} className="h-8 text-xs" />
                  <div className="flex items-center gap-2">
                    <Input
                      aria-label={`Step ${i + 1} minutes`}
                      inputMode="numeric"
                      value={String(st.minutes)}
                      onChange={(e) => {
                        const n = Number(e.target.value.replace(/\D/g, "")) || 0;
                        setDraft((d) => ({ ...d, steps: d.steps.map((x) => (x.id === st.id ? { ...x, minutes: Math.min(60, n) } : x)) }));
                      }}
                      className="h-8 w-14 px-2 text-center text-xs tabular"
                    />
                    <span className="text-xs text-muted">min</span>
                    <span className="flex-1" />
                    <IconButton size="sm" variant="ghost" label={`Move ${st.name} up`} disabled={i === 0} onClick={() => move(i, -1)}><ArrowUp /></IconButton>
                    <IconButton size="sm" variant="ghost" label={`Move ${st.name} down`} disabled={i === view.steps.length - 1} onClick={() => move(i, 1)}><ArrowDown /></IconButton>
                    <IconButton size="sm" variant="ghost" label={`Remove ${st.name}`} onClick={() => setDraft((d) => ({ ...d, steps: d.steps.filter((x) => x.id !== st.id) }))}><Trash /></IconButton>
                  </div>
                </div>
              ) : (
                <>
                  <span className="min-w-0 flex-1 text-sm text-ink-2">{st.name}</span>
                  <span className="shrink-0 text-xs text-muted tabular">{st.minutes} min</span>
                </>
              )}
            </motion.li>
          ))}
        </AnimatePresence>
      </ol>

      {editing ? (
        <div className="mt-2">
          <div className="flex items-center gap-2">
            <Input aria-label="New step" value={newStep} onChange={(e) => setNewStep(e.target.value)} placeholder="Add a step" className="h-8 flex-1 text-xs" onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addStep())} />
            <Input aria-label="New step minutes" inputMode="numeric" value={newMin} onChange={(e) => setNewMin(e.target.value.replace(/\D/g, ""))} className="h-8 w-14 px-2 text-center text-xs tabular" />
            <IconButton size="sm" variant="dark" label="Add step" onClick={addStep}><Plus /></IconButton>
          </div>
          {stepError ? <p className="mt-1 text-xs text-danger">{stepError}</p> : null}
        </div>
      ) : null}

      <h3 className="mt-6 text-sm text-ink">Class modifications</h3>
      <ul className="mt-2 flex flex-col gap-1.5">
        {view.modifications.map((m) => (
          <li key={m} className="flex gap-2 text-sm text-ink-2">
            <span className="mt-2 size-1.5 shrink-0 rounded-full bg-movement" aria-hidden="true" />
            {m}
          </li>
        ))}
      </ul>
      <p className="mt-2 text-xs text-muted">Individual precautions stay on each participant&apos;s row and are never printed on the shared plan.</p>

      <h3 className="mt-6 text-sm text-ink">Props</h3>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {(editing ? PROP_OPTIONS : view.props).map((prop) => {
          const on = view.props.includes(prop);
          return editing ? (
            <button
              key={prop}
              type="button"
              aria-pressed={on}
              onClick={() => setDraft((d) => ({ ...d, props: on ? d.props.filter((x) => x !== prop) : [...d.props, prop] }))}
              className={cn("inline-flex h-8 items-center gap-1 rounded-full px-3 text-xs transition-colors duration-200", on ? "bg-charcoal text-white" : "text-ink-2 shadow-[inset_0_0_0_1px_var(--color-line)] hover:bg-canvas")}
            >
              {on ? <Check size={12} aria-hidden="true" /> : null}
              {prop}
            </button>
          ) : (
            <Pill key={prop} size="sm" tone="outline">{prop}</Pill>
          );
        })}
      </div>

      {editing ? (
        <div className="mt-6 flex justify-end gap-2">
          <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>Cancel</Button>
          <Button
            size="sm"
            variant="dark"
            onClick={() => {
              onSave(draft);
              setEditing(false);
            }}
          >
            Save plan
          </Button>
        </div>
      ) : null}
    </Card>
  );
}

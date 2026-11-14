"use client";

import { useRef, useState, type KeyboardEvent } from "react";
import { GlassCard, OrganHero, OrganImage } from "@/components/viz/organ";
import type { OrganKind } from "@/data/anatomy";
import { Avatar } from "@/components/ui/avatar";
import { cn } from "@/lib/cn";
import type { OrganEntry } from "./anatomy-model";
import { OpenRecordButton } from "./open-record";

/**
 * Organ picker (ref 3 "body condition" carousel, recomposed as a grid on desktop) and the
 * selected model's detail: which recorded conditions open it, and which synthetic patients in
 * the demo carry it in their own record. Static renders (OrganHero/OrganImage) only.
 * Mobile: horizontal snap strip above the detail, so the selection stays in view.
 */
const SHOWN = 4;

export function AnatomyExplorer({ entries, total, without }: { entries: OrganEntry[]; total: number; without: { id: string; name: string; concern: string }[] }) {
  const [kind, setKind] = useState<OrganKind>(entries[0]?.kind ?? "heart");
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const entry = entries.find((e) => e.kind === kind) ?? entries[0];
  if (!entry) return null;

  const onKey = (e: KeyboardEvent<HTMLButtonElement>, i: number) => {
    const step: Record<string, number> = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: 4, ArrowUp: -4 };
    if (!(e.key in step)) return;
    e.preventDefault();
    const next = Math.max(0, Math.min(entries.length - 1, i + step[e.key]));
    setKind(entries[next].kind);
    refs.current[next]?.focus();
    refs.current[next]?.scrollIntoView({ block: "nearest", inline: "nearest" });
  };

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-12 lg:items-stretch">
      {/* detail — every organ's panel sits in the same grid cell and only the selected one is
          visible, so the card always has the height of the tallest panel: switching organs never
          resizes this card, the picker boxes beside it, or the page below. */}
      <article aria-labelledby="anatomy-detail-title" className="order-2 grid rounded-card bg-surface p-6 lg:order-1 lg:col-span-5">
        <p className="sr-only" aria-live="polite">
          {entry.label}: {entry.patients.length} of {total} demo patients
        </p>
        {entries.map((e) => {
          const on = e.kind === entry.kind;
          return (
            <div
              key={e.kind}
              aria-hidden={!on}
              inert={!on}
              className={cn("flex flex-col transition-opacity duration-300 [grid-area:1/1]", on ? "opacity-100" : "invisible opacity-0 [&_*]:[animation-play-state:paused]")}
            >
              <DetailPanel entry={e} total={total} active={on} />
            </div>
          );
        })}
      </article>

      {/* picker */}
      <div className="order-1 flex flex-col lg:order-2 lg:col-span-7">
        <div className="-mx-4 overflow-x-auto px-4 pb-1 scrollbar-none sm:-mx-6 sm:px-6 md:-mx-8 md:px-8 lg:mx-0 lg:h-full lg:overflow-visible lg:px-0 lg:pb-0">
          <div role="group" aria-label="Organ models" className="flex w-max snap-x snap-mandatory gap-3 lg:grid lg:h-full lg:w-full lg:grid-cols-4 lg:grid-rows-3 lg:gap-4">
            {entries.map((e, i) => {
              const on = e.kind === entry.kind;
              return (
                <button
                  key={e.kind}
                  ref={(el) => {
                    refs.current[i] = el;
                  }}
                  type="button"
                  aria-pressed={on}
                  aria-label={`${e.label}: ${e.systemName} system, ${e.patients.length} demo ${e.patients.length === 1 ? "patient" : "patients"}`}
                  onClick={() => setKind(e.kind)}
                  onKeyDown={(ev) => onKey(ev, i)}
                  className={cn(
                    "relative flex h-[152px] w-[132px] shrink-0 snap-start flex-col rounded-card bg-surface p-3 text-left transition-[box-shadow,transform] duration-300 [transition-timing-function:var(--ease-spring)] lg:h-auto lg:min-h-[148px] lg:w-auto",
                    on ? "shadow-[inset_0_0_0_2px_var(--color-primary)]" : "shadow-[inset_0_0_0_1px_var(--color-line)] hover:-translate-y-0.5",
                  )}
                >
                  <span className="flex flex-1 items-center justify-center">
                    <OrganImage kind={e.kind} variant={on ? "color" : "grey"} className="size-[88px] transition-transform duration-500 [transition-timing-function:var(--ease-spring)] lg:size-[128px]" />
                  </span>
                  <span className="mt-2 block min-w-0">
                    <span className={cn("block truncate text-sm", on ? "text-ink" : "text-ink-2")}>{e.label}</span>
                    <span className="block truncate text-[11px] text-muted">
                      {e.patients.length} demo {e.patients.length === 1 ? "patient" : "patients"}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
      {without.length ? (
        <p className="order-3 text-xs text-muted lg:col-span-7 lg:col-start-6">
          {without.map((w) => w.name).join(", ")} {without.length === 1 ? "has" : "have"} no condition recorded yet ({without.map((w) => w.concern.toLowerCase()).join("; ")}), so{" "}
          {without.length === 1 ? "that record opens" : "those records open"} without an organ.
        </p>
      ) : null}
    </div>
  );
}

function DetailPanel({ entry, total, active }: { entry: OrganEntry; total: number; active: boolean }) {
  const rest = entry.patients.slice(SHOWN);
  return (
    <>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs text-muted">{entry.systemName} system</p>
          <h3 id={active ? "anatomy-detail-title" : undefined} className="mt-2 text-[26px] font-light leading-none tracking-[-0.02em] text-ink">
            {entry.label}
          </h3>
        </div>
        <span className="inline-flex h-8 shrink-0 items-center rounded-full px-3 text-xs text-muted shadow-[inset_0_0_0_1px_var(--color-line-strong)]">
          <span className="tabular">{entry.patients.length}</span>&nbsp;of&nbsp;<span className="tabular">{total}</span>&nbsp;demo patients
        </span>
      </div>

      <div className={cn("relative mx-auto mt-2 w-full max-w-[272px] transition-transform duration-500 [transition-timing-function:var(--ease-spring)]", active ? "scale-100" : "scale-95")}>
        <OrganHero kind={entry.kind} label={`Illustration of the ${entry.label.toLowerCase()}`}>
          <GlassCard className="absolute bottom-[6%] left-0 w-[148px]">
            <p className="text-[11px] text-muted">Conditions on file here</p>
            <p className="mt-1 text-[22px] font-light leading-none tracking-[-0.02em] text-ink tabular">{entry.patients.reduce((n, p) => n + p.conditions.length, 0)}</p>
            <p className="mt-1 text-[11px] text-muted">across the demo records</p>
          </GlassCard>
        </OrganHero>
      </div>
      <p className="mt-2 text-center text-[11px] text-muted">Illustration for orientation — not the patient&apos;s imaging.</p>

      <div className="mt-6">
        <p className="text-xs text-muted">Recorded conditions that open this model</p>
        <ul className="mt-2 flex flex-wrap gap-1.5">
          {entry.families.map((f) => (
            <li key={f} className="inline-flex h-7 items-center rounded-full bg-sunken px-3 text-xs text-ink-2">
              {f}
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-6">
        <p className="text-xs text-muted">In the demo clinic</p>
        {entry.patients.length === 0 ? (
          <p className="mt-2 rounded-inner bg-canvas p-4 text-sm text-muted">No synthetic patient has a condition filed here yet.</p>
        ) : (
          <ul className="mt-2 flex flex-col">
            {entry.patients.slice(0, SHOWN).map((p) => (
              <li key={p.id} className="flex items-center gap-3 rounded-inner py-2 pl-0 pr-0">
                <Avatar src={p.avatar} name={p.name} size="sm" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm text-ink">
                    {p.name} <span className="text-muted">· {p.age}</span>
                  </span>
                  <span className="block truncate text-xs text-muted">{p.conditions.join(" · ")}</span>
                </span>
                <OpenRecordButton patientId={p.id} tone="surface" size="sm" className="shadow-[inset_0_0_0_1px_var(--color-line)]" />
              </li>
            ))}
          </ul>
        )}
        {rest.length ? <p className="mt-2 text-xs text-muted">Also: {rest.map((p) => p.name).join(", ")}.</p> : null}
      </div>
    </>
  );
}

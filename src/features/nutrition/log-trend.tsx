"use client";

import { motion } from "motion/react";
import { patientById } from "@/data/patients";
import { formatTime } from "@/lib/format";
import { cn } from "@/lib/cn";
import { spring } from "@/lib/motion";
import { Avatar } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { Tip } from "@/components/ui/tooltip";
import { LOG_MATCH_LABEL, SLOT_LABEL, type FoodLog } from "./data";
import { lastDays, logsByDay, matchCounts, planFocus, shortDay } from "./insight";
import { MatchLegend, MatchMark, OrganBadge } from "./viz";

/**
 * Self-reported trend per patient (food logs): one row per patient who follows a published plan
 * or has logged, one column per day for the last 7 days, one mark per entry — its shape says how
 * the entry compared with the plan. Counts only; no adherence score. Picking a row filters the
 * log list and the adherence review to that patient.
 */
export function LogTrend({
  patientIds,
  logs,
  selected,
  onPick,
  className,
}: {
  patientIds: string[];
  logs: FoodLog[];
  selected: string | null;
  onPick: (patientId: string) => void;
  className?: string;
}) {
  const days = lastDays(7);
  const rows = patientIds
    .map((id) => ({ id, buckets: logsByDay(logs, id, days) }))
    .map((r) => ({ ...r, entries: r.buckets.flatMap((b) => b.entries) }))
    .sort((a, b) => b.entries.length - a.entries.length || (patientById(a.id)?.name ?? "").localeCompare(patientById(b.id)?.name ?? ""));

  return (
    <Card className={cn("@container", className)}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-normal tracking-[-0.01em] text-ink">Self-reported trend</h2>
          <p className="mt-1 text-xs text-muted">
            {shortDay(days[0], { weekday: "short", day: "numeric", month: "short" })} – {shortDay(days[days.length - 1], { weekday: "short", day: "numeric", month: "short" })} · one mark per entry the patient logged, by how it compared with their plan · pick a patient to filter
          </p>
        </div>
        <MatchLegend />
      </div>

      {rows.length === 0 ? (
        <p className="mt-4 rounded-inner bg-canvas p-4 text-sm text-muted">Nobody in this view follows a published plan or has logged food yet.</p>
      ) : (
        <div className="mt-4">
          <div className="hidden grid-cols-[minmax(0,220px)_repeat(7,minmax(0,1fr))_minmax(0,200px)] gap-1 px-2 pb-2 text-[11px] text-muted @[720px]:grid" aria-hidden="true">
            <span>Patient · plan addresses</span>
            {days.map((d) => (
              <span key={d} className={cn("text-center", d === "2026-11-13" && "text-ink")}>
                {d === "2026-11-13" ? "Today" : shortDay(d, { weekday: "short", day: "numeric" })}
              </span>
            ))}
            <span className="text-right">This week</span>
          </div>
          <div className="grid grid-cols-7 gap-1 px-2 pb-1 text-center text-[11px] text-muted @[720px]:hidden" aria-hidden="true">
            {days.map((d) => (
              <span key={d} className={cn(d === "2026-11-13" && "text-ink")}>{d === "2026-11-13" ? "Today" : shortDay(d, { weekday: "short" })}</span>
            ))}
          </div>
          <ul className="flex flex-col gap-1" aria-label="Patients in this view">
            {rows.map((r) => {
              const p = patientById(r.id);
              const focus = planFocus(r.id);
              const c = matchCounts(r.entries);
              const on = selected === r.id;
              return (
                <motion.li
                  key={r.id}
                  layout="position"
                  transition={spring}
                  className={cn(
                    "grid grid-cols-1 items-center gap-2 rounded-inner p-2 transition-colors duration-200 @[720px]:grid-cols-[minmax(0,220px)_repeat(7,minmax(0,1fr))_minmax(0,200px)] @[720px]:gap-1",
                    on ? "bg-canvas shadow-[inset_0_0_0_1.5px_var(--color-line-strong)]" : "hover:bg-canvas",
                  )}
                >
                  <button type="button" onClick={() => onPick(r.id)} aria-pressed={on} className="flex min-w-0 items-center gap-3 rounded-[12px] text-left">
                    <span className="relative shrink-0">
                      <Avatar src={p?.avatar} name={p?.name ?? "Patient"} size="sm" />
                      <OrganBadge focus={focus} size={24} className="absolute -bottom-1 -right-2 bg-surface shadow-[0_0_0_2px_var(--color-surface)]" />
                    </span>
                    <span className="min-w-0 pl-1">
                      <span className="block truncate text-sm text-ink">{p?.name}</span>
                      <span className="block truncate text-xs text-muted">{focus ? `${focus.system.name}${focus.condition ? ` · ${focus.condition.name}` : ""}` : "No condition recorded"}</span>
                    </span>
                  </button>
                  <div className="grid grid-cols-7 gap-1 @[720px]:contents">
                    {r.buckets.map((b) => (
                      <div
                        key={b.day}
                        role="img"
                        aria-label={`${shortDay(b.day, { weekday: "long", day: "numeric", month: "short" })}: ${b.entries.length ? b.entries.map((e) => `${SLOT_LABEL[e.slot]} ${LOG_MATCH_LABEL[e.match].toLowerCase()}`).join(", ") : "no entries"}`}
                        className={cn("flex h-9 items-center justify-center gap-1 rounded-[10px]", b.day === "2026-11-13" ? "bg-surface shadow-[inset_0_0_0_1px_var(--color-line)]" : "bg-canvas", on && b.day !== "2026-11-13" && "bg-surface")}
                      >
                        <span className="sr-only @[720px]:hidden">{shortDay(b.day, { weekday: "short" })}</span>
                        {b.entries.length ? (
                          b.entries.map((e) => (
                            <Tip key={e.id} label={<span>{SLOT_LABEL[e.slot]} · eaten {formatTime(e.eatenAt)}<span className="block text-white/60">{LOG_MATCH_LABEL[e.match]} · self-reported</span></span>}>
                              <span className="inline-flex">
                                <MatchMark match={e.match} />
                              </span>
                            </Tip>
                          ))
                        ) : (
                          <span className="h-px w-2 rounded-full bg-line-strong" aria-hidden="true" />
                        )}
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-ink-2 @[720px]:text-right">
                    {r.entries.length ? (
                      <>
                        <span className="tabular">{r.entries.length}</span> logged · <span className="tabular">{c["as-planned"]}</span> as planned
                        {c.skipped ? <span className="text-danger"> · {c.skipped} skipped</span> : null}
                      </>
                    ) : (
                      <span className="text-muted">No entries · plan published</span>
                    )}
                  </p>
                </motion.li>
              );
            })}
          </ul>
        </div>
      )}
    </Card>
  );
}

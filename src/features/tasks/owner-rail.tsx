"use client";

import { useMemo } from "react";
import type { Discipline } from "@/data/types";
import { STAFF } from "@/data/staff";
import { DISCIPLINE_LABEL } from "@/data/appointments";
import { cn } from "@/lib/cn";
import { Segmented } from "@/components/ui/segmented";
import { PeopleList, SectionLabel } from "@/components/viz/cards";
import type { CareTask } from "./store";
import { bucketOf } from "./task-meta";
import { TODAY_KEY, addDays, dayDiff, dayKey, shortDay } from "./time";

export type OwnerFilter = "mine" | "created" | "all" | (string & {});

/** Discipline categorical palette (fixed order, validated in the design tokens). */
const DISCIPLINES: Discipline[] = ["medical", "nutrition", "movement", "operations"];
const DISCIPLINE_COLOR: Record<Discipline, string> = {
  medical: "var(--color-medical)",
  nutrition: "var(--color-nutrition)",
  movement: "var(--color-movement)",
  operations: "var(--color-ops)",
};

/** Open-task workload per owner — counts every open task, whatever the other filters say. */
export function ownerWorkload(tasks: CareTask[]) {
  const by = new Map<string, { open: number; overdue: number }>();
  for (const t of tasks) {
    if (t.status === "done") continue;
    const e = by.get(t.ownerId) ?? { open: 0, overdue: 0 };
    e.open += 1;
    if (bucketOf(t) === "overdue") e.overdue += 1;
    by.set(t.ownerId, e);
  }
  return STAFF.filter((s) => by.has(s.id))
    .map((s) => ({ staff: s, ...by.get(s.id)! }))
    .sort((a, b) => b.open - a.open || b.overdue - a.overdue || a.staff.name.localeCompare(b.staff.name));
}

/**
 * Left rail (ref 5's doctor list with counts): who holds the open work, as an owner filter.
 * Picking a person shows their tasks; picking them again goes back to everyone.
 */
export function OwnerRail({
  tasks,
  owner,
  onOwner,
  userId,
  className,
  layout = "column",
}: {
  tasks: CareTask[];
  owner: OwnerFilter;
  onOwner: (o: OwnerFilter) => void;
  userId: string;
  className?: string;
  layout?: "column" | "strip";
}) {
  const rows = useMemo(() => ownerWorkload(tasks), [tasks]);
  const totalOpen = rows.reduce((s, r) => s + r.open, 0);
  const selected = owner === "mine" ? userId : owner === "created" || owner === "all" ? undefined : owner;
  const scope = owner === "mine" || owner === "created" || owner === "all" ? owner : "person";

  return (
    <section aria-labelledby={`owners-${layout}`} className={cn("flex min-w-0 flex-col gap-3", className)}>
      <SectionLabel className="mb-0" actions={<span className="text-xs text-muted tabular">{totalOpen} open</span>}>
        <span id={`owners-${layout}`}>Open tasks by owner</span>
      </SectionLabel>
      <div className="scrollbar-none -mx-1 overflow-x-auto px-1">
        <Segmented
          ariaLabel="Whose tasks"
          size="sm"
          variant="tray"
          value={scope}
          onChange={onOwner}
          className="w-max"
          items={[
            { value: "mine", label: "Mine" },
            { value: "created", label: "Created by me" },
            { value: "all", label: "Everyone" },
          ]}
        />
      </div>
      <div className={cn(layout === "strip" && "scrollbar-none -mx-4 overflow-x-auto px-4 pb-1 lg:-mx-6 lg:px-6 xl:mx-0 xl:px-0")}>
        <PeopleList
          className={cn(layout === "strip" && "flex-row [&>li]:w-[232px] [&>li]:shrink-0")}
          selected={selected}
          onSelect={(id) => onOwner(selected === id ? "all" : id === userId ? "mine" : id)}
          people={rows.map((r) => ({
            id: r.staff.id,
            name: r.staff.id === userId ? `${r.staff.name} (you)` : r.staff.name,
            role: `${r.staff.title.split(" · ")[0]}${r.overdue ? ` · ${r.overdue} overdue` : ""}`,
            avatar: r.staff.avatar,
            count: r.open,
          }))}
        />
      </div>
      {rows.length === 0 ? <p className="text-xs text-muted">No open tasks for anyone.</p> : null}
      <p className="text-[11px] leading-relaxed text-muted">Count = open tasks owned (to do, in progress or blocked). Pick a person to see only theirs.</p>
    </section>
  );
}

/** Rows for the due chart: overdue, today, the next four days, then everything later. */
function dueRows() {
  const days = [0, 1, 2, 3, 4].map((n) => addDays(TODAY_KEY, n));
  return [
    { key: "overdue", label: "Overdue" },
    ...days.map((k, i) => ({ key: k, label: i === 0 ? "Today" : shortDay(`${k}T12:00:00+05:30`).replace(",", "") })),
    { key: "later", label: "Later" },
  ];
}

function rowOf(t: CareTask, keys: string[]) {
  if (bucketOf(t) === "overdue") return 0;
  const k = dayKey(t.due);
  const i = keys.indexOf(k);
  if (i >= 0) return i;
  return dayDiff(TODAY_KEY, k) > 0 ? keys.length - 1 : 0;
}

/**
 * When the listed open tasks fall due, stacked by discipline — where today's load sits and what
 * lands after the weekend. Horizontal bars (8px, 2px gaps, rounded ends) with the total printed.
 */
export function DueChart({ tasks, scopeLabel, className }: { tasks: CareTask[]; scopeLabel: string; className?: string }) {
  const rows = dueRows();
  const keys = rows.map((r) => r.key);
  const open = tasks.filter((t) => t.status !== "done");
  const present = DISCIPLINES.filter((d) => open.some((t) => t.discipline === d));
  const cells = rows.map((_, ri) => present.map((d) => ({ d, n: open.filter((t) => t.discipline === d && rowOf(t, keys) === ri).length })));
  const totals = cells.map((c) => c.reduce((s, x) => s + x.n, 0));
  const max = Math.max(1, ...totals);

  return (
    <section aria-labelledby="due-chart-title" className={cn("rounded-card bg-surface p-4", className)}>
      <h3 id="due-chart-title" className="text-sm text-ink">
        When open tasks fall due
      </h3>
      <p className="mt-0.5 text-xs text-muted">
        {open.length} open · {scopeLabel}
      </p>
      {open.length ? (
        <>
          <ul className="mt-4 flex flex-col gap-2" aria-label={`Open tasks by due day, ${scopeLabel}`}>
            {rows.map((r, ri) => (
              <li key={r.key} className="grid grid-cols-[64px_minmax(0,1fr)_24px] items-center gap-2 text-xs">
                <span className={cn("truncate", r.key === "overdue" && totals[ri] ? "text-danger" : ri === 1 ? "text-ink" : "text-muted")}>{r.label}</span>
                <span className="flex h-2 min-w-0 gap-0.5" role="img" aria-label={`${r.label}: ${totals[ri]} open${totals[ri] ? ` — ${cells[ri].filter((c) => c.n).map((c) => `${DISCIPLINE_LABEL[c.d]} ${c.n}`).join(", ")}` : ""}`}>
                  {totals[ri] ? (
                    cells[ri]
                      .filter((c) => c.n)
                      .map((c) => (
                        <span
                          key={c.d}
                          title={`${DISCIPLINE_LABEL[c.d]} · ${c.n} due ${r.label === "Today" || r.label === "Overdue" || r.label === "Later" ? r.label.toLowerCase() : r.label}`}
                          className="h-full first:rounded-l-full last:rounded-r-full"
                          style={{ width: `${(c.n / max) * 100}%`, background: DISCIPLINE_COLOR[c.d] }}
                        />
                      ))
                  ) : (
                    <span className="h-px w-full self-center bg-line" />
                  )}
                </span>
                <span className="text-right text-ink-2 tabular">{totals[ri]}</span>
              </li>
            ))}
          </ul>
          <ul className="mt-4 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-ink-2" aria-label="Disciplines">
            {present.map((d) => (
              <li key={d} className="flex items-center gap-1.5">
                <span className="size-2 rounded-[2px]" style={{ background: DISCIPLINE_COLOR[d] }} aria-hidden="true" />
                {DISCIPLINE_LABEL[d]}
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p className="mt-4 rounded-inner bg-canvas px-4 py-6 text-center text-xs text-muted">Nothing open in this view.</p>
      )}
    </section>
  );
}

"use client";

import { useMemo } from "react";
import { STAFF } from "@/data/staff";
import { cn } from "@/lib/cn";
import { PeopleList, SectionLabel } from "@/components/viz/cards";
import type { CareTask } from "./store";
import { bucketOf } from "./task-meta";

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
 * Whole-clinic rail (coordinator / admin): who holds the open work, as an owner filter.
 * Picking a person shows only their items; picking them again goes back to everyone.
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
  /** a staff id, or null for everyone */
  owner: string | null;
  onOwner: (o: string | null) => void;
  userId: string;
  className?: string;
  layout?: "column" | "strip";
}) {
  const rows = useMemo(() => ownerWorkload(tasks), [tasks]);
  const totalOpen = rows.reduce((s, r) => s + r.open, 0);
  const selected = owner ?? undefined;

  return (
    <section aria-labelledby={`owners-${layout}`} className={cn("flex min-w-0 flex-col gap-3", className)}>
      <SectionLabel className="mb-0" actions={<span className="text-xs text-muted tabular">{totalOpen} open</span>}>
        <span id={`owners-${layout}`}>Open items by owner</span>
      </SectionLabel>
      <div className={cn(layout === "strip" && "scrollbar-none -mx-4 overflow-x-auto px-4 pb-1 lg:-mx-6 lg:px-6 xl:mx-0 xl:px-0")}>
        <PeopleList
          className={cn(layout === "strip" && "flex-row [&>li]:w-[232px] [&>li]:shrink-0")}
          selected={selected}
          onSelect={(id) => onOwner(selected === id ? null : id)}
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
      <p className="text-[11px] leading-relaxed text-muted">Open items each person owns. Pick a person to see only theirs.</p>
    </section>
  );
}

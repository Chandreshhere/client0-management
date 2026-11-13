"use client";

import { LayoutGroup, motion } from "motion/react";
import { CalendarBlank, CalendarDots, CheckCircle, SunHorizon, WarningOctagon } from "@phosphor-icons/react";
import type { Icon } from "@phosphor-icons/react";
import { staffById } from "@/data/staff";
import { cn } from "@/lib/cn";
import { spring } from "@/lib/motion";
import { Avatar } from "@/components/ui/avatar";
import { Checkbox } from "@/components/ui/input";
import { GroupHeader } from "@/components/ui/card";
import { StatusBadge, priorityTone } from "@/components/ui/status";
import { Tip } from "@/components/ui/tooltip";
import type { CareTask } from "./store";
import { BUCKETS, PRIORITY_LABEL, SOURCE_META, STATUS_LABEL, bucketOf, byDue, dueLabel, sourceKind, statusTone, type Bucket } from "./task-meta";
import { CountChip, PersonInline } from "./ui";
import { OrganGlyph } from "./organ-glyph";

const BUCKET_ICON: Record<Bucket, Icon> = { overdue: WarningOctagon, today: SunHorizon, week: CalendarBlank, later: CalendarDots, done: CheckCircle };

/**
 * Grouped list (Overdue · Today · This week · Later · Completed). Rows share a layoutId across
 * groups, so completing a task strikes it through and then springs it into "Completed".
 */
export function TaskList({
  tasks,
  completing,
  onToggle,
  onOpen,
}: {
  tasks: CareTask[];
  completing: Set<string>;
  onToggle: (t: CareTask) => void;
  onOpen: (id: string) => void;
}) {
  const groups = BUCKETS.map((b) => ({ ...b, items: tasks.filter((t) => bucketOf(t) === b.id).sort(byDue) })).filter((g) => g.items.length > 0);

  return (
    <LayoutGroup id="task-list">
      <div className="flex flex-col gap-4">
        {groups.map((g) => {
          const BucketIcon = BUCKET_ICON[g.id];
          return (
            <motion.section key={g.id} layout="position" transition={spring} aria-labelledby={`bucket-${g.id}`} className="rounded-card bg-sunken p-2">
              <GroupHeader
                icon={<BucketIcon className={g.id === "overdue" ? "text-danger" : undefined} />}
                title={<h2 id={`bucket-${g.id}`}>{g.label}</h2>}
                subtitle={g.hint}
                action={<CountChip>{g.items.length} {g.items.length === 1 ? "task" : "tasks"}</CountChip>}
              />
              <ul className="flex flex-col gap-1">
                {g.items.map((t) => (
                  <motion.li key={t.id} layout="position" layoutId={`task-row-${t.id}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={spring}>
                    <TaskRow task={t} completing={completing.has(t.id)} onToggle={() => onToggle(t)} onOpen={() => onOpen(t.id)} />
                  </motion.li>
                ))}
              </ul>
            </motion.section>
          );
        })}
      </div>
    </LayoutGroup>
  );
}

/** Spring-drawn strike-through that works across wrapped lines. */
export const strikeClass = (on: boolean) =>
  cn(
    "bg-[linear-gradient(currentColor,currentColor)] bg-no-repeat [background-position:0_55%] [box-decoration-break:clone] [-webkit-box-decoration-break:clone]",
    "transition-[background-size,color] duration-500 [transition-timing-function:var(--ease-spring)]",
    on ? "[background-size:100%_1px] text-muted" : "[background-size:0%_1px]",
  );

function TaskRow({ task, completing, onToggle, onOpen }: { task: CareTask; completing: boolean; onToggle: () => void; onOpen: () => void }) {
  const done = task.status === "done" || completing;
  const owner = staffById(task.ownerId);
  const due = dueLabel(completing ? { ...task, status: "done" } : task);
  const SourceIcon = SOURCE_META[sourceKind(task.source)].icon;
  const dueTone = due.tone === "danger" ? "text-danger" : due.tone === "ink" ? "text-ink" : "text-muted";

  return (
    <div
      className={cn(
        "relative grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-x-3 rounded-inner bg-surface px-4 py-3 transition-[box-shadow,background-color] duration-200",
        "hover:shadow-[inset_0_0_0_1px_var(--color-line-strong)] md:grid-cols-[auto_minmax(0,1fr)_88px_150px_32px] md:items-center",
        done && "bg-surface/80",
      )}
    >
      <Checkbox
        checked={done}
        onCheckedChange={onToggle}
        aria-label={done ? `Reopen “${task.title}”` : `Mark “${task.title}” complete`}
        className="relative z-10 mt-0.5 md:mt-0"
      />
      <div className="min-w-0">
        <button
          type="button"
          onClick={onOpen}
          className="block max-w-full text-left text-sm text-ink outline-none after:absolute after:inset-0 after:rounded-inner after:content-[''] focus-visible:after:shadow-[inset_0_0_0_2px_var(--color-primary)]"
        >
          <span className={strikeClass(done)}>{task.title}</span>
        </button>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-muted">
          {task.patientId ? (
            <span className="inline-flex min-w-0 items-center gap-1.5">
              <PersonInline id={task.patientId} link className="max-w-[180px] text-xs" />
              <OrganGlyph patientId={task.patientId} size="xs" className="relative z-10" />
            </span>
          ) : (
            <span>No patient · clinic task</span>
          )}
          <span className="inline-flex h-6 min-w-0 max-w-full items-center gap-1.5 rounded-full px-2.5 text-ink-2 shadow-[inset_0_0_0_1px_var(--color-line-strong)]">
            <SourceIcon size={14} className="shrink-0 text-muted" aria-hidden="true" />
            <span className="truncate">{task.source}</span>
          </span>
          {task.status === "in-progress" || task.status === "blocked" ? <StatusBadge tone={statusTone(task.status)}>{STATUS_LABEL[task.status]}</StatusBadge> : null}
          {/* small screens: priority + due live in the meta line */}
          <span className="inline-flex items-center gap-2 md:hidden">
            <StatusBadge tone={priorityTone(task.priority)}>{PRIORITY_LABEL[task.priority]}</StatusBadge>
            <span className={cn("tabular", dueTone)}>{due.text}</span>
          </span>
        </div>
      </div>
      <div className="hidden md:block">
        <StatusBadge tone={priorityTone(task.priority)}>{PRIORITY_LABEL[task.priority]}</StatusBadge>
      </div>
      <div className={cn("hidden text-xs tabular md:block", dueTone)}>{due.text}</div>
      <Tip label={`Owner · ${owner?.name ?? "Unassigned"}`} side="left">
        <span className="relative z-10 mt-0.5 flex md:mt-0">
          <Avatar src={owner?.avatar} name={owner?.name ?? "Unassigned"} size="sm" />
          <span className="sr-only">Owner: {owner?.name ?? "Unassigned"}</span>
        </span>
      </Tip>
    </div>
  );
}

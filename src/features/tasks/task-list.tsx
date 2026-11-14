"use client";

import { LayoutGroup, motion } from "motion/react";
import { ArrowBendDownRight, CalendarBlank, CalendarDots, CheckCircle, SunHorizon, WarningOctagon } from "@phosphor-icons/react";
import type { Icon } from "@phosphor-icons/react";
import { staffById } from "@/data/staff";
import { cn } from "@/lib/cn";
import { spring } from "@/lib/motion";
import { Avatar } from "@/components/ui/avatar";
import { Checkbox } from "@/components/ui/input";
import { GroupHeader } from "@/components/ui/card";
import { StatusBadge, priorityTone } from "@/components/ui/status";
import type { CareTask } from "./store";
import { BUCKETS, PRIORITY_LABEL, SOURCE_META, STATUS_LABEL, bucketOf, byDue, displaySource, dueLabel, routingTitle, sourceKind, statusTone, type Bucket } from "./task-meta";
import { FLAG_URGENCY_LABEL, isFlagTask } from "./flags";
import { CountChip, PersonInline } from "./ui";

const BUCKET_ICON: Record<Bucket, Icon> = { overdue: WarningOctagon, today: SunHorizon, week: CalendarBlank, later: CalendarDots, done: CheckCircle };

/**
 * Grouped list (Overdue · Today · This week · Later · Completed). Rows share a layoutId across
 * groups, so completing a task strikes it through and then springs it into "Completed".
 * Only the owner can complete an item (rule 2: one owner per item).
 */
export function TaskList({
  tasks,
  viewerId,
  completing,
  redact,
  onToggle,
  onOpen,
}: {
  tasks: CareTask[];
  viewerId: string;
  completing: Set<string>;
  /** hide clinical titles (admins see routing, not clinical content) */
  redact?: (t: CareTask) => boolean;
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
                action={<CountChip>{g.items.length}</CountChip>}
              />
              <ul className="flex flex-col gap-1">
                {g.items.map((t) => (
                  <motion.li key={t.id} layout="position" layoutId={`task-row-${t.id}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={spring}>
                    <TaskRow task={t} viewerId={viewerId} redacted={redact?.(t) ?? false} completing={completing.has(t.id)} onToggle={() => onToggle(t)} onOpen={() => onOpen(t.id)} />
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

function TaskRow({ task, viewerId, redacted, completing, onToggle, onOpen }: { task: CareTask; viewerId: string; redacted: boolean; completing: boolean; onToggle: () => void; onOpen: () => void }) {
  const done = task.status === "done" || completing;
  const owner = staffById(task.ownerId);
  const mine = task.ownerId === viewerId;
  const due = dueLabel(completing ? { ...task, status: "done" } : task);
  const SourceIcon = SOURCE_META[sourceKind(task.source)].icon;
  const dueTone = due.tone === "danger" ? "text-danger" : due.tone === "ink" ? "text-ink" : "text-muted";
  const flag = isFlagTask(task);
  const urgency = task.flag?.urgency ?? (task.priority === "urgent" || task.priority === "high" ? "same-day" : "routine");
  const reply = task.flag?.response;
  const title = redacted ? routingTitle(task) : task.title;

  return (
    <div
      className={cn(
        "relative grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-x-3 rounded-inner bg-surface px-4 py-3 transition-[box-shadow,background-color] duration-200",
        "hover:shadow-[inset_0_0_0_1px_var(--color-line-strong)] md:grid-cols-[auto_minmax(0,1fr)_120px_168px] md:items-center",
        done && "bg-surface/80",
      )}
    >
      {mine ? (
        <Checkbox
          checked={done}
          onCheckedChange={onToggle}
          aria-label={done ? `Reopen “${title}”` : flag && !reply ? `Respond to “${title}”` : `Mark “${title}” complete`}
          className="relative z-10 mt-0.5 md:mt-0"
        />
      ) : (
        <span className={cn("mt-1.5 size-2.5 rounded-full md:mt-0", done ? "bg-success" : "bg-line-strong")} aria-hidden="true" />
      )}
      <div className="min-w-0">
        <button
          type="button"
          onClick={onOpen}
          className="block max-w-full text-left text-sm text-ink outline-none after:absolute after:inset-0 after:rounded-inner after:content-[''] focus-visible:after:shadow-[inset_0_0_0_2px_var(--color-primary)]"
        >
          <span className={cn(strikeClass(done), redacted && "text-ink-2")}>{title}</span>
        </button>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-muted">
          {task.patientId ? <PersonInline id={task.patientId} link={!redacted} className="max-w-[180px] text-xs" /> : <span>No patient · clinic task</span>}
          {flag ? (
            <StatusBadge tone={urgency === "same-day" ? "warning" : "neutral"}>Flag · {FLAG_URGENCY_LABEL[urgency]}</StatusBadge>
          ) : redacted ? null : (
            <span className="inline-flex h-6 min-w-0 max-w-full items-center gap-1.5 rounded-full px-2.5 text-ink-2 shadow-[inset_0_0_0_1px_var(--color-line-strong)]">
              <SourceIcon size={14} className="shrink-0 text-muted" aria-hidden="true" />
              <span className="truncate">{displaySource(task)}</span>
            </span>
          )}
          {flag && task.createdBy !== viewerId ? <span className="truncate">from {staffById(task.createdBy)?.name ?? "the care team"}</span> : null}
          {!flag && (task.status === "in-progress" || task.status === "blocked") ? <StatusBadge tone={statusTone(task.status)}>{STATUS_LABEL[task.status]}</StatusBadge> : null}
          {!flag && (task.priority === "urgent" || task.priority === "high") ? <StatusBadge tone={priorityTone(task.priority)} className="md:hidden">{PRIORITY_LABEL[task.priority]}</StatusBadge> : null}
          <span className={cn("tabular md:hidden", dueTone)}>{due.text}</span>
        </div>
        {reply && !redacted ? (
          <p className="mt-2 flex items-start gap-1.5 text-xs text-ink-2">
            <ArrowBendDownRight size={14} className="mt-px shrink-0 text-muted" aria-hidden="true" />
            <span className="line-clamp-2">
              <span className="text-muted">{staffById(reply.by)?.name ?? "Doctor"} replied: </span>
              {reply.text}
            </span>
          </p>
        ) : null}
      </div>
      <div className={cn("hidden text-xs tabular md:block", dueTone)}>{due.text}</div>
      <span className="relative z-10 mt-0.5 flex min-w-0 items-center gap-2 text-xs text-ink-2 md:mt-0">
        <Avatar src={owner?.avatar} name={owner?.name ?? "Unassigned"} size="xs" />
        <span className="hidden truncate md:inline">{mine ? "You" : (owner?.name ?? "Unassigned")}</span>
        <span className="sr-only">Owner: {mine ? "you" : (owner?.name ?? "unassigned")}</span>
      </span>
    </div>
  );
}

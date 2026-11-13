"use client";

import { LayoutGroup, motion } from "motion/react";
import { ArrowLeft, ArrowRight, CheckCircle, Circle, CircleHalf, Prohibit } from "@phosphor-icons/react";
import type { Icon } from "@phosphor-icons/react";
import type { TaskStatus } from "@/data/types";
import { staffById } from "@/data/staff";
import { cn } from "@/lib/cn";
import { spring } from "@/lib/motion";
import { Avatar } from "@/components/ui/avatar";
import { GroupHeader } from "@/components/ui/card";
import { IconButton } from "@/components/ui/icon-button";
import { StatusBadge, priorityTone } from "@/components/ui/status";
import type { CareTask } from "./store";
import { PRIORITY_LABEL, STATUS_LABEL, STATUS_ORDER, byDue, dueLabel } from "./task-meta";
import { CountChip, PersonInline } from "./ui";
import { strikeClass } from "./task-list";

const STATUS_ICON: Record<TaskStatus, Icon> = { todo: Circle, "in-progress": CircleHalf, blocked: Prohibit, done: CheckCircle };
const STATUS_HINT: Record<TaskStatus, string> = {
  todo: "Not started",
  "in-progress": "Someone is on it",
  blocked: "Waiting on someone else",
  done: "Finished",
};

/** Board by status. Drag-free: each card moves with explicit, labelled buttons (keyboard-friendly). */
export function TaskBoard({ tasks, onMove, onOpen }: { tasks: CareTask[]; onMove: (t: CareTask, to: TaskStatus) => void; onOpen: (id: string) => void }) {
  return (
    <LayoutGroup id="task-board">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {STATUS_ORDER.map((status) => {
          const items = tasks.filter((t) => t.status === status).sort(byDue);
          const StatusIcon = STATUS_ICON[status];
          return (
            <section key={status} aria-labelledby={`col-${status}`} className="flex min-w-0 flex-col rounded-card bg-sunken p-2">
              <GroupHeader
                icon={<StatusIcon className={status === "blocked" ? "text-warning" : status === "done" ? "text-success" : undefined} />}
                title={<h2 id={`col-${status}`}>{STATUS_LABEL[status]}</h2>}
                subtitle={STATUS_HINT[status]}
                action={<CountChip>{items.length}</CountChip>}
              />
              <ul className="flex min-h-24 flex-col gap-2">
                {items.map((t) => (
                  <motion.li key={t.id} layout="position" layoutId={`task-card-${t.id}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={spring}>
                    <BoardCard task={t} onMove={(to) => onMove(t, to)} onOpen={() => onOpen(t.id)} />
                  </motion.li>
                ))}
                {items.length === 0 ? <li className="flex flex-1 items-center justify-center rounded-inner px-4 py-6 text-center text-xs text-muted">Nothing here</li> : null}
              </ul>
            </section>
          );
        })}
      </div>
    </LayoutGroup>
  );
}

function BoardCard({ task, onMove, onOpen }: { task: CareTask; onMove: (to: TaskStatus) => void; onOpen: () => void }) {
  const owner = staffById(task.ownerId);
  const due = dueLabel(task);
  const idx = STATUS_ORDER.indexOf(task.status);
  const prev = idx > 0 ? STATUS_ORDER[idx - 1] : null;
  const next = idx < STATUS_ORDER.length - 1 ? STATUS_ORDER[idx + 1] : null;
  return (
    <div className="relative rounded-inner bg-surface p-4 transition-shadow duration-200 hover:shadow-[inset_0_0_0_1px_var(--color-line-strong)]">
      <div className="flex items-start gap-3">
        <button
          type="button"
          onClick={onOpen}
          className="min-w-0 flex-1 text-left text-sm text-ink outline-none after:absolute after:inset-0 after:rounded-inner after:content-[''] focus-visible:after:shadow-[inset_0_0_0_2px_var(--color-primary)]"
        >
          <span className={strikeClass(task.status === "done")}>{task.title}</span>
        </button>
        <span className="relative z-10 flex" title={`Owner · ${owner?.name ?? "Unassigned"}`}>
          <Avatar src={owner?.avatar} name={owner?.name ?? "Unassigned"} size="xs" />
          <span className="sr-only">Owner: {owner?.name ?? "Unassigned"}</span>
        </span>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
        <StatusBadge tone={priorityTone(task.priority)}>{PRIORITY_LABEL[task.priority]}</StatusBadge>
        <span className={cn("tabular", due.tone === "danger" ? "text-danger" : due.tone === "ink" ? "text-ink" : "text-muted")}>{due.text}</span>
      </div>
      <div className="mt-3 flex items-center justify-between gap-2">
        <span className="min-w-0 text-xs">{task.patientId ? <PersonInline id={task.patientId} link className="max-w-full" /> : <span className="text-muted">Clinic task</span>}</span>
        <span className="relative z-10 flex shrink-0 gap-1">
          {prev ? (
            <IconButton label={`Move to ${STATUS_LABEL[prev]}`} tooltip="top" size="sm" variant="soft" onClick={() => onMove(prev)}>
              <ArrowLeft />
            </IconButton>
          ) : null}
          {next ? (
            <IconButton label={`Move to ${STATUS_LABEL[next]}`} tooltip="top" size="sm" variant="soft" onClick={() => onMove(next)}>
              <ArrowRight />
            </IconButton>
          ) : null}
        </span>
      </div>
    </div>
  );
}

"use client";

import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";
import { ArrowSquareOut, ArrowUUpLeft, CalendarBlank, CheckCircle, PaperPlaneRight } from "@phosphor-icons/react";
import type { Priority, TaskStatus } from "@/data/types";
import { staffById } from "@/data/staff";
import { DISCIPLINE_LABEL } from "@/data/appointments";
import { formatTime } from "@/lib/format";
import { cn } from "@/lib/cn";
import { pop } from "@/lib/motion";
import { Dialog, SheetContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { Input, Select, Textarea } from "@/components/ui/input";
import { Segmented } from "@/components/ui/segmented";
import { StatusBadge, priorityTone } from "@/components/ui/status";
import { useToast } from "@/components/ui/toast";
import { useRole } from "@/components/shell/role-context";
import { addTaskComment, updateTask, useTaskActivity, useTasks, type CareTask } from "./store";
import type { ActivityKind } from "./data";
import { DUE_TIMES, PRIORITY_LABEL, PRIORITY_ORDER, SOURCE_META, STATUS_LABEL, STATUS_ORDER, dueLabel, sourceKind, statusTone } from "./task-meta";
import { personById, staffOptions } from "./people";
import { PersonInline } from "./ui";
import { OrganTag } from "./organ-glyph";
import { dayKey, isoAt, shortDay, stamp } from "./time";

const KIND_LABEL: Record<ActivityKind, string> = {
  created: "created",
  status: "updated status",
  reassigned: "reassigned",
  due: "changed the due date",
  priority: "changed priority",
  comment: "commented",
  note: "noted",
};

/** Task detail drawer: status, reassign, change due, priority, comments and the activity trail. */
export function TaskSheet({ taskId, onClose }: { taskId: string | null; onClose: () => void }) {
  // Keep the last task rendered while the drawer animates out.
  const [shownId, setShownId] = useState<string | null>(taskId);
  if (taskId && taskId !== shownId) setShownId(taskId);
  const tasks = useTasks();
  const task = tasks.find((t) => t.id === (taskId ?? shownId)) ?? null;

  return (
    <Dialog open={!!taskId} onOpenChange={(o) => !o && onClose()}>
      {task ? <TaskSheetBody task={task} /> : null}
    </Dialog>
  );
}

function TaskSheetBody({ task }: { task: CareTask }) {
  const activity = useTaskActivity(task.id);
  const { user } = useRole();
  const { toast } = useToast();
  const [editingDue, setEditingDue] = useState(false);
  const [dueDate, setDueDate] = useState("");
  const [dueTime, setDueTime] = useState("18:00");
  const [comment, setComment] = useState("");

  useEffect(() => {
    setEditingDue(false);
    setComment("");
  }, [task.id]);

  const owner = staffById(task.ownerId);
  const due = dueLabel(task);
  const SourceIcon = SOURCE_META[sourceKind(task.source)].icon;
  const done = task.status === "done";

  const setStatus = (s: TaskStatus) => {
    if (s === task.status) return;
    updateTask(task.id, { status: s }, { actorId: user.id, kind: "status", text: `${STATUS_LABEL[task.status]} → ${STATUS_LABEL[s]}` });
    toast({ title: `Status: ${STATUS_LABEL[s]}`, description: "Saved in this browser session.", tone: s === "done" ? "success" : "neutral" });
  };

  const reassign = (id: string) => {
    if (id === task.ownerId) return;
    const to = staffById(id);
    updateTask(task.id, { ownerId: id, discipline: to?.discipline ?? task.discipline }, { actorId: user.id, kind: "reassigned", text: `${owner?.name ?? "Unassigned"} → ${to?.name ?? "Unassigned"}` });
    toast({ title: `Reassigned to ${to?.name}`, description: "Saved in this browser session — they haven't been notified (no messaging integration)." });
  };

  const saveDue = () => {
    if (!dueDate) return;
    const next = isoAt(dueDate, dueTime);
    updateTask(task.id, { due: next }, { actorId: user.id, kind: "due", text: `${shortDay(task.due)} ${formatTime(task.due)} → ${shortDay(next)} ${dueTime}` });
    setEditingDue(false);
    toast({ title: "Due date changed", description: `Now due ${shortDay(next)}, ${dueTime}. Saved in this browser session.` });
  };

  const setPriority = (p: string) => {
    const next = p as Priority;
    if (next === task.priority) return;
    updateTask(task.id, { priority: next }, { actorId: user.id, kind: "priority", text: `${PRIORITY_LABEL[task.priority]} → ${PRIORITY_LABEL[next]}` });
  };

  const sendComment = () => {
    const text = comment.trim();
    if (!text) return;
    addTaskComment(task.id, user.id, text);
    setComment("");
    toast({ title: "Comment added", description: "Saved in this browser session — nobody was notified." });
  };

  const timeOptions = (DUE_TIMES.includes(formatTime(task.due)) ? DUE_TIMES : [...DUE_TIMES, formatTime(task.due)].sort()).map((t) => ({ value: t, label: t }));

  return (
    <SheetContent
        title={task.title}
        description={`${task.patientId ? `${personById(task.patientId)?.name} · ` : ""}${DISCIPLINE_LABEL[task.discipline]}`}
        footer={
          <>
            {task.patientId ? (
              <Button asChild variant="secondary">
                <Link href={`/patients/${task.patientId}`}>
                  Patient record <ArrowSquareOut />
                </Link>
              </Button>
            ) : null}
            {done ? (
              <Button variant="secondary" leading={<ArrowUUpLeft />} onClick={() => setStatus("todo")}>
                Reopen
              </Button>
            ) : (
              <Button variant="primary" leading={<CheckCircle />} onClick={() => setStatus("done")}>
                Mark complete
              </Button>
            )}
          </>
        }
      >
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge tone={statusTone(task.status)}>{STATUS_LABEL[task.status]}</StatusBadge>
          <StatusBadge tone={priorityTone(task.priority)}>{PRIORITY_LABEL[task.priority]} priority</StatusBadge>
          <span className={cn("text-xs tabular", due.tone === "danger" ? "text-danger" : "text-muted")}>{due.text}</span>
          {task.local ? <StatusBadge tone="draft">Created in this session</StatusBadge> : null}
        </div>

        <section className="mt-6">
          <h3 className="text-xs text-muted">Status</h3>
          <div className="scrollbar-none mt-2 overflow-x-auto">
            <Segmented
              ariaLabel="Task status"
              size="sm"
              variant="tray"
              value={task.status}
              onChange={setStatus}
              items={STATUS_ORDER.map((s) => ({ value: s, label: STATUS_LABEL[s] }))}
              className="w-max"
            />
          </div>
        </section>

        <dl className="mt-6 grid grid-cols-1 gap-x-4 gap-y-4 rounded-inner bg-canvas p-4 text-sm sm:grid-cols-2">
          <div className="sm:col-span-2">
            <dt className="text-xs text-muted">Owner</dt>
            <dd className="mt-2 flex flex-wrap items-center gap-3">
              <span className="flex min-w-0 items-center gap-2">
                <Avatar src={owner?.avatar} name={owner?.name ?? "Unassigned"} size="sm" />
                <span className="min-w-0">
                  <span className="block truncate text-ink">{owner?.name ?? "Unassigned"}</span>
                  <span className="block truncate text-xs text-muted">{owner?.title}</span>
                </span>
              </span>
              <Select size="sm" ariaLabel="Reassign task" value={task.ownerId} onValueChange={reassign} options={staffOptions()} className="ml-auto w-auto min-w-[168px]" />
            </dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-xs text-muted">Due</dt>
            <dd className="mt-1">
              {editingDue ? (
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <Input type="date" aria-label="Due date" value={dueDate} min="2026-11-01" max="2027-12-31" onChange={(e) => setDueDate(e.target.value)} className="h-8 w-auto rounded-full px-3 text-xs" />
                  <Select size="sm" ariaLabel="Due time" value={dueTime} onValueChange={setDueTime} options={timeOptions} className="w-[96px]" />
                  <Button size="sm" variant="dark" onClick={saveDue} disabled={!dueDate}>
                    Save
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setEditingDue(false)}>
                    Cancel
                  </Button>
                </div>
              ) : (
                <span className="flex flex-wrap items-center gap-3">
                  <span className="text-ink tabular">
                    {shortDay(task.due)}, {formatTime(task.due)}
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    leading={<CalendarBlank />}
                    className="ml-auto"
                    onClick={() => {
                      setDueDate(dayKey(task.due));
                      setDueTime(formatTime(task.due));
                      setEditingDue(true);
                    }}
                  >
                    Change due date
                  </Button>
                </span>
              )}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted">Priority</dt>
            <dd className="mt-2">
              <Select size="sm" ariaLabel="Priority" value={task.priority} onValueChange={setPriority} options={PRIORITY_ORDER.map((p) => ({ value: p, label: PRIORITY_LABEL[p] }))} className="w-[140px]" />
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted">Patient</dt>
            <dd className="mt-2 flex flex-col items-start gap-1.5 text-sm">
              {task.patientId ? (
                <>
                  <PersonInline id={task.patientId} size="sm" link />
                  <OrganTag patientId={task.patientId} />
                </>
              ) : (
                <span className="text-muted">Clinic task — no patient</span>
              )}
            </dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-xs text-muted">Source</dt>
            <dd className="mt-2 flex flex-wrap items-center gap-2 text-ink-2">
              <span className="inline-flex h-6 items-center gap-1.5 rounded-full bg-surface px-2.5 text-xs shadow-[inset_0_0_0_1px_var(--color-line)]">
                <SourceIcon size={14} className="text-muted" aria-hidden="true" />
                {task.source}
              </span>
              {task.source.startsWith("Created by") ? null : <span className="text-xs text-muted">Created by {personById(task.createdBy)?.name ?? "Unknown"}</span>}
            </dd>
          </div>
        </dl>

        <section className="mt-8">
          <h3 className="text-xs text-muted">Activity</h3>
          <ol className="mt-3 flex flex-col">
            <AnimatePresence initial={false}>
              {activity.map((a, i) => {
                const actor = personById(a.actorId);
                const last = i === activity.length - 1;
                return (
                  <motion.li key={a.id} initial={{ opacity: 0, y: 8, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={pop} className="relative flex gap-3 pb-5 last:pb-0">
                    {!last ? <span aria-hidden="true" className="absolute bottom-0 left-4 top-10 w-px bg-line" /> : null}
                    <Avatar src={actor?.avatar} name={actor?.name ?? "Unknown"} size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-muted">
                        <span className="text-ink">{actor?.name ?? "Unknown"}</span> {KIND_LABEL[a.kind]} · {stamp(a.at)}
                      </p>
                      <p className={cn("mt-1 text-sm leading-relaxed text-ink-2", a.kind === "comment" && "rounded-inner bg-canvas px-3 py-2 text-ink")}>{a.text}</p>
                    </div>
                  </motion.li>
                );
              })}
            </AnimatePresence>
          </ol>
        </section>

        <section className="mt-6 rounded-inner bg-canvas p-3">
          <label htmlFor="task-comment" className="sr-only">
            Add a comment
          </label>
          <Textarea
            id="task-comment"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                sendComment();
              }
            }}
            placeholder="Add a comment for the care team…"
            className="min-h-20 resize-none bg-surface"
          />
          <div className="mt-2 flex items-center justify-between gap-2">
            <p className="text-xs text-muted">Saved in this browser session only.</p>
            <Button size="sm" variant="dark" leading={<PaperPlaneRight />} onClick={sendComment} disabled={!comment.trim()}>
              Comment
            </Button>
          </div>
        </section>
      </SheetContent>
  );
}

"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Kanban, ListChecks, Plus, Rows } from "@phosphor-icons/react";
import type { Patient, Priority, TaskStatus } from "@/data/types";
import { patientById } from "@/data/patients";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState, PageHeader } from "@/components/ui/misc";
import { SearchInput } from "@/components/ui/input";
import { Segmented } from "@/components/ui/segmented";
import { DropdownCheckboxItem, DropdownRadioGroup, DropdownRadioItem } from "@/components/ui/dropdown";
import { useToast } from "@/components/ui/toast";
import { ChipGroup } from "@/components/viz/cards";
import { useRole } from "@/components/shell/role-context";
import { updateTask, useTasks, type CareTask } from "./store";
import { PRIORITY_LABEL, PRIORITY_ORDER, SOURCE_META, STATUS_LABEL, STATUS_ORDER, bucketOf, sourceKind, type SourceKind } from "./task-meta";
import { personById } from "./people";
import { FilterMenu, QueryFlag, useClearQuery } from "./ui";
import { TaskList } from "./task-list";
import { TaskBoard } from "./task-board";
import { TaskSheet } from "./task-sheet";
import { NewTaskModal } from "./new-task-modal";
import { DueChart, OwnerRail, type OwnerFilter } from "./owner-rail";

/** /tasks — care-team follow-ups (doc §3C coordinator portal, §5E "turn a message into a task"). */
export function TasksView() {
  const { role } = useRole();
  return role === "patient" ? <PatientNotice /> : <StaffTasks />;
}

function toggleIn<T>(list: T[], value: T, on: boolean) {
  return on ? (list.includes(value) ? list : [...list, value]) : list.filter((v) => v !== value);
}

type Facet = "priority" | "status";

function StaffTasks() {
  const { user } = useRole();
  const { toast } = useToast();
  const tasks = useTasks();
  const [view, setView] = useState<"list" | "board">("list");
  const [owner, setOwner] = useState<OwnerFilter>("mine");
  const [priorities, setPriorities] = useState<Priority[]>([]);
  const [patient, setPatient] = useState("all");
  const [sources, setSources] = useState<SourceKind[]>([]);
  const [statuses, setStatuses] = useState<TaskStatus[]>([]);
  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [newOpen, setNewOpen] = useState(false);
  const [completing, setCompleting] = useState<Set<string>>(() => new Set());
  const pending = useRef(new Map<string, number>());
  const clearNew = useClearQuery("new");

  useEffect(() => {
    const timers = pending.current;
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, []);

  const q = query.trim().toLowerCase();
  /** Every filter, optionally ignoring one facet (so chip counts show what picking it would give). */
  const matches = useMemo(
    () => (t: CareTask, except?: Facet) => {
      if (owner === "mine" && t.ownerId !== user.id) return false;
      if (owner === "created" && t.createdBy !== user.id) return false;
      if (owner !== "mine" && owner !== "created" && owner !== "all" && t.ownerId !== owner) return false;
      if (except !== "priority" && priorities.length && !priorities.includes(t.priority)) return false;
      if (patient !== "all" && t.patientId !== patient) return false;
      if (sources.length && !sources.includes(sourceKind(t.source))) return false;
      if (except !== "status" && statuses.length && !statuses.includes(t.status)) return false;
      if (q) {
        const hay = `${t.title} ${t.source} ${patientById(t.patientId)?.name ?? ""} ${personById(t.ownerId)?.name ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    },
    [owner, user.id, priorities, patient, sources, statuses, q],
  );
  const filtered = useMemo(() => tasks.filter((t) => matches(t)), [tasks, matches]);
  const priorityCounts = useMemo(() => Object.fromEntries(PRIORITY_ORDER.map((p) => [p, tasks.filter((t) => t.priority === p && matches(t, "priority")).length])) as Record<Priority, number>, [tasks, matches]);
  const statusCounts = useMemo(() => Object.fromEntries(STATUS_ORDER.map((s) => [s, tasks.filter((t) => t.status === s && matches(t, "status")).length])) as Record<TaskStatus, number>, [tasks, matches]);

  const open = filtered.filter((t) => t.status !== "done");
  const overdue = open.filter((t) => bucketOf(t) === "overdue").length;
  const anyFilter = owner !== "mine" || priorities.length > 0 || patient !== "all" || sources.length > 0 || statuses.length > 0 || q.length > 0;

  const patientsWithTasks = useMemo(() => {
    const ids = Array.from(new Set(tasks.map((t) => t.patientId).filter((id): id is string => !!id)));
    return ids
      .map((id) => patientById(id))
      .filter((p): p is Patient => !!p)
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [tasks]);
  const sourceKinds = useMemo(() => Array.from(new Set(tasks.map((t) => sourceKind(t.source)))), [tasks]);

  const ownerLabel = owner === "mine" ? "Mine" : owner === "created" ? "Created by me" : owner === "all" ? "Everyone" : (personById(owner)?.name ?? "Someone");
  const scopeLabel = owner === "mine" ? `assigned to ${user.name}` : owner === "created" ? "created by you" : owner === "all" ? "whole care team" : `owned by ${ownerLabel}`;
  const listLabel = <T extends string>(values: T[], label: (v: T) => string) => (values.length === 0 ? "All" : values.length === 1 ? label(values[0]) : `${values.length} selected`);

  const clearAll = () => {
    setOwner("mine");
    setPriorities([]);
    setPatient("all");
    setSources([]);
    setStatuses([]);
    setQuery("");
  };

  const finishCompleting = (id: string) =>
    setCompleting((s) => {
      const n = new Set(s);
      n.delete(id);
      return n;
    });

  const toggle = (t: CareTask) => {
    if (pending.current.has(t.id)) return;
    if (t.status === "done") {
      updateTask(t.id, { status: "todo" }, { actorId: user.id, kind: "status", text: "Done → To do (reopened)" });
      toast({ title: "Task reopened", description: "Saved in this browser session." });
      return;
    }
    const prev = t.status;
    setCompleting((s) => new Set(s).add(t.id));
    // Let the strike-through draw before the row springs into "Completed".
    const timer = window.setTimeout(() => {
      pending.current.delete(t.id);
      updateTask(t.id, { status: "done" }, { actorId: user.id, kind: "status", text: `${STATUS_LABEL[prev]} → Done` });
      finishCompleting(t.id);
    }, 650);
    pending.current.set(t.id, timer);
    toast({
      title: "Task completed",
      description: `“${t.title}” — saved in this browser session.`,
      tone: "success",
      action: {
        label: "Undo",
        onClick: () => {
          const waiting = pending.current.get(t.id);
          if (waiting !== undefined) {
            window.clearTimeout(waiting);
            pending.current.delete(t.id);
            finishCompleting(t.id);
          } else {
            updateTask(t.id, { status: prev }, { actorId: user.id, kind: "status", text: `Done → ${STATUS_LABEL[prev]} (undo)` });
          }
        },
      },
    });
  };

  const move = (t: CareTask, to: TaskStatus) => {
    updateTask(t.id, { status: to }, { actorId: user.id, kind: "status", text: `${STATUS_LABEL[t.status]} → ${STATUS_LABEL[to]}` });
    toast({ title: `Moved to ${STATUS_LABEL[to]}`, description: `“${t.title}” — saved in this browser session.`, tone: to === "done" ? "success" : "neutral" });
  };

  return (
    <div className="flex flex-col gap-6 lg:gap-8">
      <PageHeader
        eyebrow="Friday 13 November · 09:40"
        title="Tasks"
        description="Follow-ups with an owner, a due date and the place they came from — grouped by when they're due."
        actions={
          <>
            <Segmented
              ariaLabel="View"
              value={view}
              onChange={setView}
              items={[
                { value: "list", label: "List", icon: <Rows /> },
                { value: "board", label: "Board", icon: <Kanban /> },
              ]}
            />
            <Button variant="primary" leading={<Plus weight="bold" />} onClick={() => setNewOpen(true)}>
              New task
            </Button>
          </>
        }
      />

      {/* List view keeps the owner rail beside the list; the board needs the full width, so it gets the strip. */}
      <div className={cn("grid grid-cols-1 gap-6", view === "list" && "xl:grid-cols-[288px_minmax(0,1fr)] xl:gap-8")}>
        <aside className={cn("hidden flex-col gap-6", view === "list" && "xl:flex")} aria-label="Owners and due dates">
          <OwnerRail tasks={tasks} owner={owner} onOwner={setOwner} userId={user.id} />
          <DueChart tasks={filtered} scopeLabel={scopeLabel} />
        </aside>

        <div className="flex min-w-0 flex-col gap-6">
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
              <SearchInput className="w-full lg:w-[280px] lg:shrink-0" placeholder="Search tasks, patients, sources" aria-label="Search tasks" value={query} onChange={(e) => setQuery(e.target.value)} />
              <div className="scrollbar-none -mx-4 flex min-w-0 items-center gap-2 overflow-x-auto px-4 py-1 lg:mx-0 lg:flex-wrap lg:overflow-x-visible lg:px-0" data-lenis-prevent>
                <FilterMenu label="Patient" value={patient === "all" ? "All" : (patientById(patient)?.name ?? "—")} active={patient !== "all"} contentClassName="w-[280px]">
                  <DropdownRadioGroup value={patient} onValueChange={setPatient}>
                    <DropdownRadioItem value="all">All patients</DropdownRadioItem>
                    {patientsWithTasks.map((p) => (
                      <DropdownRadioItem key={p.id} value={p.id}>
                        {p.name}
                      </DropdownRadioItem>
                    ))}
                  </DropdownRadioGroup>
                </FilterMenu>
                <FilterMenu label="Source" value={listLabel(sources, (s) => SOURCE_META[s].label)} active={sources.length > 0}>
                  {sourceKinds.map((k) => {
                    const SIcon = SOURCE_META[k].icon;
                    return (
                      <DropdownCheckboxItem key={k} checked={sources.includes(k)} onCheckedChange={(c) => setSources((xs) => toggleIn(xs, k, c === true))} onSelect={(e) => e.preventDefault()}>
                        <span className="inline-flex items-center gap-2">
                          <SIcon size={16} aria-hidden="true" />
                          {SOURCE_META[k].label}
                        </span>
                      </DropdownCheckboxItem>
                    );
                  })}
                </FilterMenu>
                {anyFilter ? (
                  <Button variant="ghost" onClick={clearAll} className="shrink-0">
                    Reset filters
                  </Button>
                ) : null}
              </div>
            </div>

            <div className="flex flex-col gap-2 lg:flex-row lg:flex-wrap lg:items-center lg:gap-x-6">
              <div className="flex min-w-0 items-center gap-2">
                <span className="w-14 shrink-0 text-xs text-muted lg:w-auto">Priority</span>
                <div className="scrollbar-none -mr-4 min-w-0 overflow-x-auto pr-4 lg:mr-0 lg:overflow-x-visible lg:pr-0" data-lenis-prevent>
                  <ChipGroup
                    ariaLabel="Filter by priority"
                    className="flex-nowrap [&>button]:shrink-0 [&>button]:whitespace-nowrap"
                    value={priorities}
                    onChange={setPriorities}
                    options={PRIORITY_ORDER.map((p) => ({ value: p, label: PRIORITY_LABEL[p], count: priorityCounts[p] }))}
                  />
                </div>
              </div>
              <div className="flex min-w-0 items-center gap-2">
                <span className="w-14 shrink-0 text-xs text-muted lg:w-auto">Status</span>
                <div className="scrollbar-none -mr-4 min-w-0 overflow-x-auto pr-4 lg:mr-0 lg:overflow-x-visible lg:pr-0" data-lenis-prevent>
                  <ChipGroup
                    ariaLabel="Filter by status"
                    className="flex-nowrap [&>button]:shrink-0 [&>button]:whitespace-nowrap"
                    value={statuses}
                    onChange={setStatuses}
                    options={STATUS_ORDER.map((s) => ({ value: s, label: STATUS_LABEL[s], count: statusCounts[s] }))}
                  />
                </div>
              </div>
            </div>

            <OwnerRail tasks={tasks} owner={owner} onOwner={setOwner} userId={user.id} layout="strip" className={cn("mt-2", view === "list" && "xl:hidden")} />

            <p className="text-xs text-muted" aria-live="polite">
              {open.length} open{overdue ? ` · ${overdue} overdue` : ""} · {filtered.length - open.length} done · {scopeLabel}
            </p>
          </div>

          {filtered.length === 0 ? (
            <Card>
              <EmptyState
                icon={<ListChecks />}
                title={owner === "mine" && !anyFilterBesidesOwner(priorities, patient, sources, statuses, q) ? "Nothing assigned to you" : "No tasks match these filters"}
                description={owner === "mine" ? "Tasks you escalate or create for others show up under “Created by me”." : "Try a different owner or clear the filters."}
                action={
                  <div className="flex flex-wrap justify-center gap-2">
                    <Button variant="secondary" onClick={() => setOwner("created")}>
                      Created by me
                    </Button>
                    <Button variant="dark" onClick={() => setOwner("all")}>
                      Show everyone&apos;s tasks
                    </Button>
                  </div>
                }
              />
            </Card>
          ) : view === "list" ? (
            <>
              {open.length === 0 ? <NothingOpen mine={owner === "mine"} onEveryone={() => setOwner("all")} onCreated={() => setOwner("created")} /> : null}
              <TaskList tasks={filtered} completing={completing} onToggle={toggle} onOpen={setOpenId} />
            </>
          ) : (
            <TaskBoard tasks={filtered} onMove={move} onOpen={setOpenId} />
          )}
        </div>
      </div>

      <TaskSheet taskId={openId} onClose={() => setOpenId(null)} />
      <NewTaskModal
        open={newOpen}
        onOpenChange={(o) => {
          setNewOpen(o);
          if (!o) clearNew();
        }}
        onCreated={setOpenId}
      />
      <Suspense fallback={null}>
        <QueryFlag name="new" onMatch={() => setNewOpen(true)} />
      </Suspense>
    </div>
  );
}

const anyFilterBesidesOwner = (p: Priority[], patient: string, s: SourceKind[], st: TaskStatus[], q: string) => p.length > 0 || patient !== "all" || s.length > 0 || st.length > 0 || q.length > 0;

function NothingOpen({ mine, onEveryone, onCreated }: { mine: boolean; onEveryone: () => void; onCreated: () => void }) {
  return (
    <div className="flex flex-col gap-3 rounded-card bg-surface p-6 sm:flex-row sm:items-center">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-success-soft text-success">
        <ListChecks size={18} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm text-ink">{mine ? "Nothing open for you right now" : "Nothing open here"}</p>
        <p className="text-xs text-muted">{mine ? "Escalations you raise stay with their owner — follow them under “Created by me”." : "Only completed tasks match these filters."}</p>
      </div>
      <div className="flex gap-2">
        {mine ? (
          <Button size="sm" variant="secondary" onClick={onCreated}>
            Created by me
          </Button>
        ) : null}
        <Button size="sm" variant="dark" onClick={onEveryone}>
          Everyone
        </Button>
      </div>
    </div>
  );
}

function PatientNotice() {
  return (
    <div className="flex flex-col gap-6 lg:gap-8">
      <PageHeader title="Tasks" description="Care-team tasks — follow-ups, reviews and calls — are part of the staff workspace." />
      <Card>
        <EmptyState
          icon={<ListChecks />}
          title="Your daily actions live in My plan"
          description="Anything you need to do today — meals, practice, measurements — is in your plan. Questions go to your care team in Messages."
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <Button asChild variant="secondary">
                <Link href="/messages">Messages</Link>
              </Button>
              <Button asChild variant="dark">
                <Link href="/portal/plan">Open my plan</Link>
              </Button>
            </div>
          }
        />
      </Card>
    </div>
  );
}

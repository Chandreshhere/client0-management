"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { ArrowsLeftRight, ListChecks, Plus } from "@phosphor-icons/react";
import type { Patient, Role } from "@/data/types";
import { patientById } from "@/data/patients";
import { staffById } from "@/data/staff";
import { cn } from "@/lib/cn";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, GroupHeader } from "@/components/ui/card";
import { EmptyState, PageHeader } from "@/components/ui/misc";
import { SearchInput } from "@/components/ui/input";
import { Segmented } from "@/components/ui/segmented";
import { DropdownRadioGroup, DropdownRadioItem } from "@/components/ui/dropdown";
import { useToast } from "@/components/ui/toast";
import { useRole } from "@/components/shell/role-context";
import { useReferrals, type CareReferral } from "@/features/referrals/store";
import { DISCIPLINE_WORD, ageText, assignmentInfo, hoursLeft, type AssignmentInfo } from "@/features/referrals/meta";
import { updateTask, useTasks, type CareTask } from "./store";
import { STATUS_LABEL, bucketOf, displaySource, routingTitle, taskInPlan } from "./task-meta";
import { isFlagTask } from "./flags";
import { personById } from "./people";
import { CountChip, FilterMenu, QueryFlag, useClearQuery } from "./ui";
import { TaskList } from "./task-list";
import { TaskSheet } from "./task-sheet";
import { NewTaskModal } from "./new-task-modal";
import { OwnerRail } from "./owner-rail";

/**
 * /tasks — each role's pending items (spec rule 2): every item has exactly one owner and shows in
 * that owner's list. "Raised by me" follows what you handed to someone else; the whole-clinic view
 * is for the coordinator (Pro) and the admin, who route work rather than do it.
 */
type Scope = "mine" | "raised" | "clinic";
const SCOPE_LABEL: Record<Scope, string> = { mine: "Mine", raised: "Raised by me", clinic: "Whole clinic" };

const scopesFor = (role: Role): Scope[] => (role === "coordinator" || role === "admin" ? ["mine", "raised", "clinic"] : ["mine", "raised"]);

export function TasksView() {
  const { role } = useRole();
  return role === "patient" ? <PatientNotice /> : <StaffTasks />;
}

/** An assignment that's still waiting to be seen, as a pending item for whoever owns it now. */
interface AssignmentItem {
  r: CareReferral;
  info: AssignmentInfo;
}

function StaffTasks() {
  const { user, role, plan, has } = useRole();
  const { toast } = useToast();
  const allTasks = useTasks();
  const referrals = useReferrals();
  const scopes = scopesFor(role);
  const [scope, setScope] = useState<Scope>("mine");
  const [owner, setOwner] = useState<string | null>(null);
  const [patient, setPatient] = useState("all");
  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [newOpen, setNewOpen] = useState(false);
  const [completing, setCompleting] = useState<Set<string>>(() => new Set());
  const pending = useRef(new Map<string, number>());
  const clearNew = useClearQuery("new");
  /** admin and reception see routing, not clinical content; coordinators see status, clinical detail only where granted (rule 3) */
  const routes = role === "admin" || role === "coordinator" || role === "frontdesk";
  const redact = (t: CareTask) => routes && t.discipline !== "operations" && t.ownerId !== user.id;

  useEffect(() => {
    const timers = pending.current;
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, []);

  const tasks = useMemo(() => allTasks.filter((t) => taskInPlan(t, plan, has)), [allTasks, plan, has]);
  const inScope = (t: CareTask, s: Scope) => (s === "mine" ? t.ownerId === user.id : s === "raised" ? t.createdBy === user.id && t.ownerId !== user.id : true);

  const q = query.trim().toLowerCase();
  const filtered = useMemo(
    () =>
      tasks.filter((t) => {
        if (!inScope(t, scope)) return false;
        if (scope === "clinic" && owner && t.ownerId !== owner) return false;
        if (patient !== "all" && t.patientId !== patient) return false;
        if (q) {
          const hay = `${redact(t) ? routingTitle(t) : `${t.title} ${displaySource(t)}`} ${patientById(t.patientId)?.name ?? ""} ${personById(t.ownerId)?.name ?? ""}`.toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tasks, scope, owner, patient, q, user.id, role],
  );

  // Assignments not yet seen are pending items too — owned by the recipient, or by the doctor once 48 h pass.
  const assignmentItems = useMemo<AssignmentItem[]>(() => {
    const items = referrals.map((r) => ({ r, info: assignmentInfo(r) })).filter((x) => x.info.ownerId);
    return items
      .filter(({ r, info }) => (scope === "mine" ? info.ownerId === user.id : scope === "raised" ? r.fromId === user.id && info.ownerId !== user.id : !owner || info.ownerId === owner))
      .filter(({ r }) => (patient === "all" || r.patientId === patient) && (!q || `${patientById(r.patientId)?.name ?? ""} ${staffById(r.toId)?.name ?? ""}`.toLowerCase().includes(q)))
      .sort((a, b) => b.info.hours - a.info.hours);
  }, [referrals, scope, user.id, owner, patient, q]);

  const openCount = (s: Scope) => tasks.filter((t) => t.status !== "done" && inScope(t, s)).length + referrals.filter((r) => {
    const info = assignmentInfo(r);
    if (!info.ownerId) return false;
    return s === "mine" ? info.ownerId === user.id : s === "raised" ? r.fromId === user.id && info.ownerId !== user.id : true;
  }).length;

  const open = filtered.filter((t) => t.status !== "done");
  const overdue = open.filter((t) => bucketOf(t) === "overdue").length;
  const anyFilter = patient !== "all" || q.length > 0 || owner !== null;

  const patientsWithTasks = useMemo(() => {
    const ids = Array.from(new Set(tasks.filter((t) => inScope(t, scope)).map((t) => t.patientId).filter((id): id is string => !!id)));
    return ids
      .map((id) => patientById(id))
      .filter((p): p is Patient => !!p)
      .sort((a, b) => a.name.localeCompare(b.name));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasks, scope, user.id]);

  const clearAll = () => {
    setOwner(null);
    setPatient("all");
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
      toast({ title: "Reopened", description: "Saved in this browser session." });
      return;
    }
    // A flag is done when the doctor has responded (F8) — open it to reply.
    if (isFlagTask(t) && !t.flag?.response) {
      setOpenId(t.id);
      return;
    }
    const prev = t.status;
    setCompleting((s) => new Set(s).add(t.id));
    const timer = window.setTimeout(() => {
      pending.current.delete(t.id);
      updateTask(t.id, { status: "done" }, { actorId: user.id, kind: "status", text: `${STATUS_LABEL[prev]} → Done` });
      finishCompleting(t.id);
    }, 650);
    pending.current.set(t.id, timer);
    toast({
      title: "Done",
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

  const empty = filtered.length === 0 && assignmentItems.length === 0;
  const description =
    scope === "mine"
      ? "What's waiting for you. Every item has one owner — when it's yours, it's here; everyone else sees it on the patient's timeline."
      : scope === "raised"
        ? "Items you handed to someone else — flags, follow-ups and assignments — with their owner and any reply."
        : role === "admin"
          ? "Who holds what across the clinic. Clinical items show their owner and due date, not their content."
          : "Who holds what across the clinic — items stalled with one owner can be followed up or reassigned.";

  return (
    <div className="flex flex-col gap-6 lg:gap-8">
      <PageHeader
        title="Tasks"
        description={description}
        actions={
          <Button variant="primary" leading={<Plus weight="bold" />} onClick={() => setNewOpen(true)}>
            New task
          </Button>
        }
      />

      <div className={cn("grid grid-cols-1 gap-6", scope === "clinic" && "xl:grid-cols-[288px_minmax(0,1fr)] xl:gap-8")}>
        {scope === "clinic" ? (
          <aside className="hidden xl:flex xl:flex-col" aria-label="Owners">
            <OwnerRail tasks={tasks} owner={owner} onOwner={setOwner} userId={user.id} />
          </aside>
        ) : null}

        <div className="flex min-w-0 flex-col gap-6">
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
              <div className="scrollbar-none -mx-4 overflow-x-auto px-4 lg:mx-0 lg:shrink-0 lg:px-0">
                <Segmented
                  ariaLabel="Whose items"
                  value={scope}
                  onChange={(s) => {
                    setScope(s);
                    setOwner(null);
                    setPatient("all");
                  }}
                  className="w-max"
                  items={scopes.map((s) => ({ value: s, label: SCOPE_LABEL[s], count: openCount(s) }))}
                />
              </div>
              <div className="flex min-w-0 flex-1 items-center gap-2">
                <SearchInput className="min-w-0 flex-1 lg:max-w-[280px]" placeholder="Search items, patients, people" aria-label="Search tasks" value={query} onChange={(e) => setQuery(e.target.value)} />
                {patientsWithTasks.length > 1 ? (
                  <FilterMenu label="Patient" value={patient === "all" ? "All" : (patientById(patient)?.name ?? "—")} active={patient !== "all"} contentClassName="w-[280px]" className="hidden sm:inline-flex">
                    <DropdownRadioGroup value={patient} onValueChange={setPatient}>
                      <DropdownRadioItem value="all">All patients</DropdownRadioItem>
                      {patientsWithTasks.map((p) => (
                        <DropdownRadioItem key={p.id} value={p.id}>
                          {p.name}
                        </DropdownRadioItem>
                      ))}
                    </DropdownRadioGroup>
                  </FilterMenu>
                ) : null}
                {anyFilter ? (
                  <Button variant="ghost" onClick={clearAll} className="shrink-0">
                    Reset
                  </Button>
                ) : null}
              </div>
            </div>
            {scope === "clinic" ? <OwnerRail tasks={tasks} owner={owner} onOwner={setOwner} userId={user.id} layout="strip" className="mt-2 xl:hidden" /> : null}
            <p className="text-xs text-muted" aria-live="polite">
              {open.length + assignmentItems.length} open{overdue ? ` · ${overdue} overdue` : ""} · {filtered.length - open.length} done
              {scope === "clinic" && owner ? ` · owned by ${personById(owner)?.name}` : ""}
            </p>
          </div>

          {empty ? (
            <Card>
              <EmptyState
                icon={<ListChecks />}
                title={scope === "mine" && !anyFilter ? "Nothing waiting for you" : scope === "raised" && !anyFilter ? "Nothing raised by you is open" : "Nothing matches"}
                description={scope === "mine" ? "Items other people own are on the patient's timeline, not in your list." : anyFilter ? "Clear the search or filters to see more." : "Flags, follow-ups and assignments you hand to someone else show here."}
                action={
                  anyFilter ? (
                    <Button variant="secondary" onClick={clearAll}>
                      Reset
                    </Button>
                  ) : undefined
                }
              />
            </Card>
          ) : (
            <>
              {assignmentItems.length ? <AssignmentItems items={assignmentItems} scope={scope} viewerId={user.id} redact={routes} /> : null}
              {filtered.length ? <TaskList tasks={filtered} viewerId={user.id} completing={completing} redact={redact} onToggle={toggle} onOpen={setOpenId} /> : null}
            </>
          )}
        </div>
      </div>

      <TaskSheet taskId={openId} redact={redact} onClose={() => setOpenId(null)} />
      <NewTaskModal
        open={newOpen}
        onOpenChange={(o) => {
          setNewOpen(o);
          if (!o) clearNew();
        }}
        onCreated={(t) => {
          if (t.ownerId !== user.id) setScope("raised");
          setOpenId(t.id);
        }}
      />
      <Suspense fallback={null}>
        <QueryFlag name="new" onMatch={() => setNewOpen(true)} />
        <QueryFlag name="scope" value="raised" onMatch={() => setScope("raised")} />
      </Suspense>
    </div>
  );
}

/** Assignments waiting to be seen (assigned → seen), with the one action that moves them: open it. */
function AssignmentItems({ items, scope, viewerId, redact }: { items: AssignmentItem[]; scope: Scope; viewerId: string; redact: boolean }) {
  return (
    <section aria-labelledby="pending-assignments" className="rounded-card bg-sunken p-2">
      <GroupHeader
        icon={<ArrowsLeftRight />}
        title={<h2 id="pending-assignments">Assignments not seen yet</h2>}
        subtitle={scope === "raised" ? "Waiting for the person you assigned to open them" : "Opening one marks it seen · not seen in 48 hours goes back to the doctor"}
        action={<CountChip>{items.length}</CountChip>}
      />
      <ul className="flex flex-col gap-1">
        {items.map(({ r, info }) => {
          const p = patientById(r.patientId);
          const to = staffById(r.toId);
          const ownerId = info.ownerId!;
          const ownerStaff = staffById(ownerId);
          const back = info.status === "back";
          const recipient = r.toId === viewerId;
          return (
            <li key={r.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-inner bg-surface px-4 py-3 md:grid-cols-[minmax(0,1fr)_120px_168px_auto]">
              <div className="min-w-0">
                <p className="line-clamp-2 text-sm text-ink md:truncate">
                  {back ? "Not seen in 48 h" : "New assignment"}: {p?.name ?? "Patient"} → {back ? to?.name : DISCIPLINE_WORD[r.toDiscipline]}
                </p>
                <p className="mt-1 truncate text-xs text-muted">
                  {redact ? `Assigned by ${staffById(r.fromId)?.name}` : r.goals}
                </p>
              </div>
              <p className={cn("hidden text-xs tabular md:block", back ? "text-warning" : "text-muted")}>{back ? `${ageText(info.hours)} unseen` : `${hoursLeft(info)} h left`}</p>
              <span className="hidden min-w-0 items-center gap-2 text-xs text-ink-2 md:flex">
                <Avatar src={ownerStaff?.avatar} name={ownerStaff?.name ?? "Owner"} size="xs" />
                <span className="truncate">{ownerId === viewerId ? "You" : ownerStaff?.name}</span>
              </span>
              <Button asChild size="sm" variant={recipient || (back && ownerId === viewerId) ? "dark" : "secondary"}>
                <Link href={`/referrals?open=${r.id}`}>Open</Link>
              </Button>
            </li>
          );
        })}
      </ul>
    </section>
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
          description="Anything you need to do today — meals, practice, measurements — is in your plan."
          action={
            <Button asChild variant="dark">
              <Link href="/portal/plan">Open my plan</Link>
            </Button>
          }
        />
      </Card>
    </div>
  );
}

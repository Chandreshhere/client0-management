"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowsLeftRight, CheckCircle, Clock, Plus, WarningCircle } from "@phosphor-icons/react";
import type { Icon } from "@phosphor-icons/react";
import type { Discipline, Role } from "@/data/types";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/button";
import { Card, GroupHeader } from "@/components/ui/card";
import { EmptyState, PageHeader } from "@/components/ui/misc";
import { Segmented } from "@/components/ui/segmented";
import { DropdownRadioGroup, DropdownRadioItem } from "@/components/ui/dropdown";
import { useRole } from "@/components/shell/role-context";
import { CountChip, FilterMenu, QueryFlag, useClearQuery } from "@/features/tasks/ui";
import { DISCIPLINE_DOT } from "@/features/tasks/people";
import { DISCIPLINE_WORD, assignmentInfo, byStatus, type AssignmentStatus } from "./meta";
import { AssignmentRow } from "./referral-card";
import { AssignmentSheet } from "./referral-sheet";
import { NewAssignmentModal } from "./new-referral-modal";
import { ReassignModal } from "./reassign-modal";
import { useReferrals, type CareReferral } from "./store";

type Scope = "mine" | "sent" | "clinic";
const SCOPE_LABEL: Record<Scope, string> = { mine: "Mine", sent: "Sent by me", clinic: "Whole clinic" };

/** Which lists each role gets (rule 3: show each role what it acts on). */
function scopesFor(role: Role, coordinatorPlan: boolean): Scope[] {
  if (role === "doctor") return ["sent", "clinic"];
  if (role === "nutritionist" || role === "yoga") return ["mine"];
  if (role === "coordinator" && coordinatorPlan) return ["clinic"];
  return ["clinic"];
}

const GROUPS: { id: AssignmentStatus; icon: Icon; tone?: string; label: Record<Scope, string>; hint: Record<Scope, string> }[] = [
  {
    id: "back",
    icon: WarningCircle,
    tone: "text-warning",
    label: { mine: "Not opened in 48 hours", sent: "Back with you — not seen in 48 h", clinic: "Not seen in 48 hours" },
    hint: { mine: "Back with the doctor — opening it still marks it seen", sent: "Remind or reassign to someone else", clinic: "Back with the assigning doctor" },
  },
  {
    id: "new",
    icon: Clock,
    label: { mine: "New — open to mark it seen", sent: "Waiting to be seen", clinic: "Waiting to be seen" },
    hint: { mine: "The doctor sees when you've opened it", sent: "Comes back to you after 48 hours if not opened", clinic: "Assigned, not opened yet" },
  },
  {
    id: "seen",
    icon: CheckCircle,
    tone: "text-success",
    label: { mine: "Seen", sent: "Seen", clinic: "Seen" },
    hint: { mine: "Opened — the work continues in your section of the record", sent: "Opened by the recipient", clinic: "Opened by the recipient" },
  },
];

/** /referrals — Assignments (spec F5): doctor → nutritionist or instructor, assigned → seen. */
export function ReferralsView() {
  const { role } = useRole();
  return role === "patient" ? <PatientNotice /> : <Assignments />;
}

function Assignments() {
  const { user, role, has } = useRole();
  const referrals = useReferrals();
  const scopes = scopesFor(role, has("coordinator"));
  const [scope, setScope] = useState<Scope>(scopes[0]);
  const [discipline, setDiscipline] = useState<Discipline | "all">("all");
  const [openId, setOpenId] = useState<string | null>(null);
  const [reassigning, setReassigning] = useState<CareReferral | null>(null);
  const [newOpen, setNewOpen] = useState(false);
  const clearNew = useClearQuery("new");
  const clearOpen = useClearQuery("open");
  const routingOnly = role === "admin" || role === "frontdesk" || role === "coordinator";
  const canAssign = role === "doctor";

  const inScope = useMemo(() => referrals.filter((r) => (scope === "mine" ? r.toId === user.id : scope === "sent" ? r.fromId === user.id : true)), [referrals, scope, user.id]);
  const shown = useMemo(() => inScope.filter((r) => discipline === "all" || r.toDiscipline === discipline).sort(byStatus), [inScope, discipline]);
  const counts = Object.fromEntries(scopes.map((s) => [s, referrals.filter((r) => (s === "mine" ? r.toId === user.id : s === "sent" ? r.fromId === user.id : true)).length])) as Record<Scope, number>;
  const groups = GROUPS.map((g) => ({ ...g, items: shown.filter((r) => assignmentInfo(r).status === g.id) })).filter((g) => g.items.length);

  const openFromUrl = (id: string) => {
    if (referrals.some((x) => x.id === id)) setOpenId(id);
  };

  const description =
    scope === "mine"
      ? `Patients a doctor has assigned to you, with their goals and ${role === "yoga" ? "precautions" : "guidance"}. Opening one marks it seen.`
      : role === "doctor"
        ? "Assign a patient to a nutritionist or instructor with goals and guidance. Each one is assigned → seen; anything not opened within 48 hours comes back to you."
        : "Every assignment in the clinic: assigned → seen. Anything not opened within 48 hours is back with the assigning doctor.";

  return (
    <div className="flex flex-col gap-6 lg:gap-8">
      <PageHeader
        title="Assignments"
        description={`${description}${has("calendar") ? " Booking the visit happens in the schedule." : ""}`}
        actions={
          canAssign ? (
            <Button variant="dark" leading={<Plus weight="bold" />} onClick={() => setNewOpen(true)}>
              New assignment
            </Button>
          ) : undefined
        }
      />

      {scopes.length > 1 || scope !== "mine" ? (
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          {scopes.length > 1 ? (
            <div className="scrollbar-none -mx-4 overflow-x-auto px-4 lg:mx-0 lg:px-0">
              <Segmented ariaLabel="Whose assignments" value={scope} onChange={setScope} className="w-max" items={scopes.map((s) => ({ value: s, label: SCOPE_LABEL[s], count: counts[s] }))} />
            </div>
          ) : null}
          <div className="flex items-center gap-2">
            <FilterMenu label="Discipline" value={discipline === "all" ? "All" : DISCIPLINE_WORD[discipline]} active={discipline !== "all"}>
              <DropdownRadioGroup value={discipline} onValueChange={(v) => setDiscipline(v as Discipline | "all")}>
                <DropdownRadioItem value="all">Nutrition and yoga</DropdownRadioItem>
                {(["nutrition", "movement"] as Discipline[]).map((d) => (
                  <DropdownRadioItem key={d} value={d}>
                    <span className="inline-flex items-center gap-2">
                      <span className={cn("size-2 rounded-full", DISCIPLINE_DOT[d])} aria-hidden="true" />
                      {DISCIPLINE_WORD[d]}
                    </span>
                  </DropdownRadioItem>
                ))}
              </DropdownRadioGroup>
            </FilterMenu>
            {discipline !== "all" ? (
              <Button variant="ghost" onClick={() => setDiscipline("all")}>
                Reset
              </Button>
            ) : null}
          </div>
          <p className="text-xs text-muted lg:ml-auto" aria-live="polite">
            {shown.length} of {inScope.length} shown
          </p>
        </div>
      ) : null}

      {shown.length === 0 ? (
        <Card>
          <EmptyState
            icon={<ArrowsLeftRight />}
            title={scope === "mine" ? "Nothing assigned to you" : scope === "sent" ? "You haven't assigned anyone yet" : "No assignments match"}
            description={scope === "mine" ? "When a doctor assigns you a patient, it appears here and in your pending list." : canAssign ? "Assign a patient to a nutritionist or instructor from here or from their record." : "Change the filter to see more."}
            action={
              canAssign ? (
                <Button variant="dark" leading={<Plus weight="bold" />} onClick={() => setNewOpen(true)}>
                  New assignment
                </Button>
              ) : undefined
            }
          />
        </Card>
      ) : (
        <div className="flex flex-col gap-4">
          {groups.map((g) => {
            const GIcon = g.icon;
            return (
              <section key={g.id} aria-labelledby={`asg-${g.id}`} className="rounded-card bg-sunken p-2">
                <GroupHeader
                  icon={<GIcon className={g.tone} />}
                  title={<h2 id={`asg-${g.id}`}>{g.label[scope]}</h2>}
                  subtitle={g.hint[scope]}
                  action={<CountChip>{g.items.length}</CountChip>}
                />
                <ul className="flex flex-col gap-2">
                  {g.items.map((r) => (
                    <li key={r.id}>
                      <AssignmentRow referral={r} routingOnly={routingOnly} onOpen={() => setOpenId(r.id)} onReassign={() => setReassigning(r)} />
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      )}

      <AssignmentSheet
        referralId={openId}
        routingOnly={routingOnly}
        onClose={() => {
          setOpenId(null);
          clearOpen();
        }}
        onReassign={(r) => {
          setOpenId(null);
          setReassigning(r);
        }}
      />
      <ReassignModal referral={reassigning} onClose={() => setReassigning(null)} />
      {canAssign ? (
        <NewAssignmentModal
          open={newOpen}
          onOpenChange={(o) => {
            setNewOpen(o);
            if (!o) clearNew();
          }}
          onCreated={() => setScope("sent")}
        />
      ) : null}
      <Suspense fallback={null}>
        {canAssign ? <QueryFlag name="new" onMatch={() => setNewOpen(true)} /> : null}
        <OpenParam onOpen={openFromUrl} />
      </Suspense>
    </div>
  );
}

/** ?open=<id> — opens that assignment (the drawer marks it seen for the recipient). Render inside <Suspense>. */
function OpenParam({ onOpen }: { onOpen: (id: string) => void }) {
  const id = useSearchParams().get("open");
  const cb = useRef(onOpen);
  useEffect(() => {
    cb.current = onOpen;
  });
  useEffect(() => {
    if (id) cb.current(id);
  }, [id]);
  return null;
}

function PatientNotice() {
  return (
    <div className="flex flex-col gap-6 lg:gap-8">
      <PageHeader title="Assignments" description="Your doctor assigns your nutrition and yoga care to the right person in the team." />
      <Card>
        <EmptyState icon={<ArrowsLeftRight />} title="Nothing to do here" description="Your plan and your upcoming visits are under My plan and Appointments." />
      </Card>
    </div>
  );
}

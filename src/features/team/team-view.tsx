"use client";

import { useMemo, useState } from "react";
import { EnvelopeSimple, UserPlus, UsersThree, X } from "@phosphor-icons/react";
import type { Discipline } from "@/data/types";
import { BRANCHES, STAFF } from "@/data/staff";
import { DISCIPLINE_LABEL } from "@/data/appointments";
import { pluralize } from "@/lib/format";
import { cn } from "@/lib/cn";
import { BarChart, SegmentedBar } from "@/components/charts/bar-chart";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState, PageHeader } from "@/components/ui/misc";
import { SearchInput } from "@/components/ui/input";
import { Segmented } from "@/components/ui/segmented";
import { StatusBadge } from "@/components/ui/status";
import { useToast } from "@/components/ui/toast";
import { ChipGroup } from "@/components/viz/cards";
import { usePlan, useRole } from "@/components/shell/role-context";
import { planById } from "@/data/plans";
import { FilterPill, ROLE_LABEL, ReadOnlyBanner } from "@/features/settings/ui";
import { NOW_MIN, hhmm } from "@/features/settings/time";
import { StaffCards, StaffTable, type DirectoryRow } from "./directory";
import { InviteModal, SeatSummary } from "./invite-modal";
import { LeaveFocal, ReassignSheet } from "./leave-card";
import { LoadCard } from "./load-card";
import { StaffSheet } from "./staff-sheet";
import { countTick, hoursToday, nowState, type StaffRole } from "./data";
import { seatInfo } from "./seats";
import { removeInvite, restoreInvite, useTeamState } from "./store";

type BranchFilter = "all" | "indiranagar" | "hsr";
type NowFilter = "all" | "working" | "later" | "away";

const DISCIPLINES: Discipline[] = ["medical", "nutrition", "movement", "operations"];
const ROLE_ROWS: StaffRole[] = ["doctor", "nutritionist", "yoga", "frontdesk", "coordinator", "admin"];
const DISCIPLINE_FILL: Record<Discipline, string> = {
  medical: "var(--color-medical)",
  nutrition: "var(--color-nutrition)",
  movement: "var(--color-movement)",
  operations: "var(--color-ops)",
};

export function TeamView() {
  const { role } = useRole();
  if (role === "patient") {
    return (
      <div className="flex flex-col gap-6 lg:gap-8">
        <PageHeader title="Team" />
        <Card>
          <EmptyState icon={<UsersThree />} title="The clinic team page is for staff" description="Your care team — and how to reach them — is in your portal." />
        </Card>
      </div>
    );
  }
  return <TeamWorkspace canManage={role === "admin"} />;
}

function TeamWorkspace({ canManage }: { canManage: boolean }) {
  const { toast } = useToast();
  const { user } = useRole();
  const { plan, has } = usePlan();
  const state = useTeamState();
  const planRoles = planById(plan).roles;
  const branches = has("branches");
  const diary = has("calendar");
  const [openId, setOpenId] = useState<string | null>(null);
  const [reassign, setReassign] = useState(false);
  const [invite, setInvite] = useState(false);
  const [disciplines, setDisciplines] = useState<Discipline[]>([]);
  const [branch, setBranch] = useState<BranchFilter>("all");
  const [nowF, setNowF] = useState<NowFilter>("all");
  const [view, setView] = useState<"cards" | "table">("cards");
  const [query, setQuery] = useState("");

  // Only staff in roles this plan has: no Reception on Core, no coordinator below Pro.
  const rows: DirectoryRow[] = useMemo(
    () =>
      STAFF.filter((s) => planRoles.includes(s.role)).map((s) => ({ s, now: nowState(s, !!state.deactivated[s.id]), deactivated: !!state.deactivated[s.id], roleRequest: state.roles[s.id] ?? null })),
    [state.deactivated, state.roles, planRoles],
  );
  const q = query.trim().toLowerCase();
  const shown = rows
    .filter((r) => !disciplines.length || disciplines.includes(r.s.discipline))
    .filter((r) => !branches || branch === "all" || r.s.branch === branch)
    .filter((r) => (nowF === "all" ? true : nowF === "working" ? r.now.working : nowF === "later" ? r.now.key === "before" : r.now.key === "leave" || r.now.key === "deactivated" || r.now.key === "after"))
    .filter((r) => !q || `${r.s.name} ${r.s.title} ${ROLE_LABEL(r.s.role)} ${r.s.email}`.toLowerCase().includes(q));
  const filtered = disciplines.length > 0 || (branches && branch !== "all") || nowF !== "all" || q !== "";

  // Accounts in roles the plan doesn't have (Reception on Core, coordinators below Pro) hold no seat.
  const offPlan = useMemo(() => Object.fromEntries(STAFF.filter((s) => !planRoles.includes(s.role)).map((s) => [s.id, "not on this plan"])), [planRoles]);
  const seats = seatInfo(plan, { ...offPlan, ...state.deactivated }, state.invites);
  const working = rows.filter((r) => r.now.working);
  const later = rows.filter((r) => r.now.key === "before").sort((a, b) => (hoursToday(a.s)?.start ?? 0) - (hoursToday(b.s)?.start ?? 0));
  const away = rows.filter((r) => r.now.key === "leave");

  // staff on duty per hour today (working window covers the hour start), leave/deactivated excluded
  const hours = Array.from({ length: 13 }, (_, i) => 7 + i);
  const onDuty = hours.map((h) => rows.filter((r) => !r.deactivated && (() => { const w = hoursToday(r.s); return !!w && w.start <= h * 60 && w.end > h * 60; })()).length);
  const nowHour = hours.indexOf(Math.floor(NOW_MIN / 60));

  const disciplinesShown = DISCIPLINES.filter((d) => rows.some((r) => r.s.discipline === d));
  const mix = disciplinesShown.map((d) => ({ label: DISCIPLINE_LABEL[d], value: rows.filter((r) => !r.deactivated && r.s.discipline === d).length, color: DISCIPLINE_FILL[d] }));
  const active = rows.filter((r) => !r.deactivated);

  return (
    <div className="flex flex-col gap-6 lg:gap-8">
      <PageHeader
        eyebrow="Administration"
        title="Team"
        description={`Who is working today${diary ? ", how loaded they are" : ""}, who covers whom, and who can sign in. Status reconciles each person's live status with their hours at the demo clock (09:40).`}
        actions={
          canManage ? (
            <Button variant="dark" leading={<UserPlus />} onClick={() => setInvite(true)}>
              Invite staff
            </Button>
          ) : undefined
        }
      />

      {!canManage ? <ReadOnlyBanner>The staff directory is visible to the whole team. Administrators invite people, change roles and arrange leave cover.</ReadOnlyBanner> : null}

      {/* Today's load counts appointments — only plans with the calendar (Clinic+) have them. */}
      <div className={cn("grid grid-cols-1 gap-4", diary && "xl:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]")}>
        <LeaveFocal canManage={canManage} onReview={() => setReassign(true)} />
        {diary ? <LoadCard deactivated={state.deactivated} onOpenStaff={setOpenId} /> : null}
      </div>

      {/* Seats is admin-only: without it the row has two cards, so it is two equal columns rather than three with one left empty. */}
      <div className={cn("grid grid-cols-1 gap-4 md:grid-cols-2", canManage && "xl:grid-cols-3")}>
        <section aria-labelledby="duty-title" className={cn("flex flex-col gap-4 rounded-card bg-surface p-6", canManage && "md:col-span-2 xl:col-span-1")}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 id="duty-title" className="text-xs text-muted">Staff on duty by hour · today</h2>
              <p className="mt-2 text-[32px] font-light leading-none tracking-[-0.02em] text-ink">
                {working.length}
                <span className="ml-2 text-sm text-muted">working at {hhmm(NOW_MIN)}</span>
              </p>
            </div>
          </div>
          <BarChart
            ariaLabel={`Staff on duty per hour today: ${hours.map((h, i) => `${hhmm(h * 60)} ${onDuty[i]}`).join(", ")}`}
            categories={hours.map((h) => String(h).padStart(2, "0"))}
            series={[{ id: "duty", name: "Staff on duty", color: "var(--color-charcoal)" }]}
            values={[onDuty]}
            highlight={nowHour >= 0 ? nowHour : undefined}
            formatY={countTick}
            height={150}
          />
          <p className="text-xs text-muted">
            {later.length ? `Later today: ${later.map((r) => `${r.s.name.split(" ").slice(0, 2).join(" ")} ${hhmm(hoursToday(r.s)?.start ?? 0)}`).join(" · ")}` : "Everyone due today has started."}
            {away.length ? ` · ${away.length} on leave` : ""}
          </p>
        </section>

        <section aria-labelledby="mix-title" className="flex flex-col justify-between gap-6 rounded-card bg-surface p-6">
          <div>
            <h2 id="mix-title" className="text-xs text-muted">Team mix</h2>
            <p className="mt-2 text-[32px] font-light leading-none tracking-[-0.02em] text-ink">
              {active.length}
              <span className="ml-2 text-sm text-muted">{branches ? `people · ${BRANCHES.map((b) => `${b.name} ${active.filter((r) => r.s.branch === b.id).length}`).join(" · ")}` : "people"}</span>
            </p>
          </div>
          <ul className="flex flex-col gap-2 text-sm">
            {ROLE_ROWS.filter((r) => planRoles.includes(r)).map((r) => {
              const n = active.filter((x) => x.s.role === r).length;
              return n ? (
                <li key={r} className="flex items-center justify-between gap-3">
                  <span className="text-ink-2">{ROLE_LABEL(r)}</span>
                  <span className="text-ink tabular">{n}</span>
                </li>
              ) : null;
            })}
          </ul>
          <SegmentedBar label="Team by discipline" parts={mix} />
        </section>

        {canManage ? (
          <section aria-labelledby="seats-title" className="flex flex-col gap-4 rounded-card bg-surface p-6">
            <h2 id="seats-title" className="text-xs text-muted">Seats · {seats.planName} plan</h2>
            <SeatSummary plan={plan} seats={seats} />
          </section>
        ) : null}
      </div>

      {canManage && state.invites.length ? (
        <section aria-labelledby="invites-title" className="flex flex-col gap-3">
          <h2 id="invites-title" className="text-lg font-normal tracking-[-0.01em] text-ink">
            Draft invites <span className="text-sm text-muted">· not sent</span>
          </h2>
          <ul className="flex flex-col gap-2">
            {state.invites.map((inv) => (
              <li key={inv.id} className="flex flex-wrap items-center gap-3 rounded-card bg-surface p-4 sm:px-6">
                <span className="flex size-10 items-center justify-center rounded-full bg-sunken text-ink-2" aria-hidden="true">
                  <EnvelopeSimple size={18} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-ink">
                    {inv.name} · {ROLE_LABEL(inv.role)}
                  </p>
                  <p className="truncate text-xs text-muted">
                    {inv.email}
                    {branches ? ` · ${BRANCHES.find((b) => b.id === inv.branch)?.name}` : ""}
                  </p>
                </div>
                <StatusBadge tone={inv.status === "ready" ? "draft" : "warning"}>{inv.status === "ready" ? "Draft · email not connected" : "Waiting for a seat"}</StatusBadge>
                <Button
                  size="sm"
                  variant="ghost"
                  leading={<X />}
                  onClick={() => {
                    removeInvite(inv.id, user.id);
                    toast({ title: "Draft invite withdrawn", description: "Removed from this browser session.", action: { label: "Undo", onClick: () => restoreInvite(inv, user.id) } });
                  }}
                >
                  Withdraw
                </Button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section aria-labelledby="dir-title" className="flex flex-col gap-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 id="dir-title" className="text-lg font-normal tracking-[-0.01em] text-ink">
              Staff directory
            </h2>
            <p className="mt-1 text-sm text-muted">Day track: white = hours{diary ? " · charcoal = booked" : ""} · hatched = break · line = now</p>
          </div>
          <Segmented
            ariaLabel="Directory layout"
            size="sm"
            variant="tray"
            value={view}
            onChange={setView}
            items={[
              { value: "cards", label: "Cards" },
              { value: "table", label: "Table" },
            ]}
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ChipGroup<Discipline>
            ariaLabel="Discipline"
            value={disciplines}
            onChange={setDisciplines}
            options={disciplinesShown.map((d) => ({ value: d, label: DISCIPLINE_LABEL[d], count: rows.filter((r) => r.s.discipline === d).length }))}
          />
          {branches ? (
            <FilterPill<BranchFilter>
              label="Branch"
              value={branch}
              defaultValue="all"
              onChange={setBranch}
              options={[{ value: "all", label: "Both" }, ...BRANCHES.map((b) => ({ value: b.id as BranchFilter, label: b.name, count: rows.filter((r) => r.s.branch === b.id).length }))]}
            />
          ) : null}
          <FilterPill<NowFilter>
            label="Now"
            value={nowF}
            defaultValue="all"
            onChange={setNowF}
            options={[
              { value: "all", label: "Anyone" },
              { value: "working", label: "Working now", count: working.length },
              { value: "later", label: "Starts later", count: later.length },
              { value: "away", label: "Away or finished", count: rows.filter((r) => !r.now.working && r.now.key !== "before").length },
            ]}
          />
          <SearchInput className="w-full sm:ml-auto sm:w-[260px]" placeholder="Search name, role, email" aria-label="Search staff" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>

        {shown.length === 0 ? (
          <Card>
            <EmptyState
              icon={<UsersThree />}
              title="No one matches"
              description="Try another discipline, branch or status — or clear the search."
              action={
                filtered ? (
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setDisciplines([]);
                      setBranch("all");
                      setNowF("all");
                      setQuery("");
                    }}
                  >
                    Clear filters
                  </Button>
                ) : undefined
              }
            />
          </Card>
        ) : view === "cards" ? (
          <StaffCards rows={shown} onOpen={setOpenId} />
        ) : (
          <StaffTable rows={shown} onOpen={setOpenId} />
        )}
        <p className="text-xs text-muted">
          {pluralize(shown.length, "person", "people")} shown · synthetic staff · changes made here are saved in this browser session only and written to the activity log.
        </p>
      </section>

      <StaffSheet staffId={openId} onClose={() => setOpenId(null)} canManage={canManage} />
      <ReassignSheet open={reassign} onOpenChange={setReassign} canManage={canManage} />
      {canManage ? <InviteModal open={invite} onOpenChange={setInvite} /> : null}
    </div>
  );
}

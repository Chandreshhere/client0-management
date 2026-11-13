"use client";

import Link from "next/link";
import { LayoutGroup, motion } from "motion/react";
import { Suspense, useMemo, useState } from "react";
import { ArrowsLeftRight, HandWaving, Hourglass, Path, Plus, Rows, SealCheck, WarningOctagon, CalendarX } from "@phosphor-icons/react";
import type { Icon } from "@phosphor-icons/react";
import type { Discipline, ReferralStage } from "@/data/types";
import { REFERRAL_STAGES, REFERRAL_STAGE_LABEL } from "@/data/care";
import { patientById } from "@/data/patients";
import { DISCIPLINE_LABEL } from "@/data/appointments";
import { cn } from "@/lib/cn";
import { spring } from "@/lib/motion";
import { Button } from "@/components/ui/button";
import { Card, GroupHeader } from "@/components/ui/card";
import { EmptyState, PageHeader, Stat } from "@/components/ui/misc";
import { Segmented } from "@/components/ui/segmented";
import { DropdownRadioGroup, DropdownRadioItem } from "@/components/ui/dropdown";
import { useRole } from "@/components/shell/role-context";
import { CountChip, FilterMenu, QueryFlag } from "@/features/tasks/ui";
import { DISCIPLINE_DOT, isClinician } from "@/features/tasks/people";
import { byTime } from "@/features/tasks/time";
import { HEALTH_LABEL, STAGE_WAITING, byUrgency, referralState, waitText, type Health } from "./meta";
import { ReferralCard } from "./referral-card";
import { ReferralSheet } from "./referral-sheet";
import { BookModal } from "./book-modal";
import { NewReferralModal } from "./new-referral-modal";
import { ReferralJourneys } from "./referral-journeys";
import { HandoffStrip } from "./handoff-strip";
import { useReferralActions } from "./use-referral-actions";
import { useReferrals, type CareReferral } from "./store";

type Scope = "all" | "incoming" | "outgoing";
type View = "pipeline" | "journeys";
type Progress = "all" | Health;

const GROUPS: { id: "attention" | "moving" | "closed"; label: string; hint: string; icon: Icon; match: (h: Health) => boolean }[] = [
  { id: "attention", label: "Stopped — needs action", hint: "Past the due date, or no movement for over 2 days", icon: WarningOctagon, match: (h) => h === "overdue" || h === "stalled" },
  { id: "moving", label: "Moving", hint: "Within the due date and progressing", icon: ArrowsLeftRight, match: (h) => h === "on-track" },
  { id: "closed", label: "Loop closed", hint: "Outcome acknowledged by the referrer", icon: SealCheck, match: (h) => h === "closed" },
];

/** /referrals — doc §5B: show where progress stopped, and who can move it on. */
export function ReferralsView() {
  const { role } = useRole();
  return role === "patient" ? <PatientNotice /> : <StaffReferrals />;
}

function StaffReferrals() {
  const { user, role } = useRole();
  const referrals = useReferrals();
  const { advance } = useReferralActions();
  const clinician = isClinician(role);
  const [scope, setScope] = useState<Scope>(role === "nutritionist" || role === "yoga" ? "incoming" : role === "doctor" ? "outgoing" : "all");
  const [stage, setStage] = useState<ReferralStage | "all">("all");
  const [discipline, setDiscipline] = useState<Discipline | "all">("all");
  const [progress, setProgress] = useState<Progress>("all");
  const [openId, setOpenId] = useState<string | null>(null);
  const [booking, setBooking] = useState<CareReferral | null>(null);
  const [newOpen, setNewOpen] = useState(false);
  const [view, setView] = useState<View>("pipeline");

  const counts = {
    all: referrals.length,
    incoming: referrals.filter((r) => r.toId === user.id).length,
    outgoing: referrals.filter((r) => r.fromId === user.id).length,
  };
  const inScope = useMemo(() => referrals.filter((r) => scope === "all" || (scope === "incoming" ? r.toId === user.id : r.fromId === user.id)), [referrals, scope, user.id]);

  const filtered = useMemo(
    () =>
      inScope
        .filter((r) => (stage === "all" || r.stage === stage) && (discipline === "all" || r.toDiscipline === discipline))
        .filter((r) => {
          if (progress === "all") return true;
          const st = referralState(r);
          return progress === "stalled" ? st.stalled : progress === "overdue" ? st.overdue : st.health === progress;
        })
        .sort(byUrgency),
    [inScope, stage, discipline, progress],
  );

  // KPI row (always over the current scope, so the tiles match what "Mine" means).
  const states = inScope.map((r) => ({ r, st: referralState(r) }));
  const awaiting = states.filter((x) => x.r.stage === "requested").sort((a, b) => byTime(a.st.since, b.st.since));
  const stalled = states.filter((x) => x.st.stalled);
  const overdue = states.filter((x) => x.st.overdue);
  const closed = states.filter((x) => !x.st.pending);

  const anyFilter = stage !== "all" || discipline !== "all" || progress !== "all";
  const reset = () => {
    setStage("all");
    setDiscipline("all");
    setProgress("all");
  };

  const groups = GROUPS.map((g) => ({ ...g, items: filtered.filter((r) => g.match(referralState(r).health)) })).filter((g) => g.items.length);

  return (
    <div className="flex flex-col gap-6 lg:gap-8">
      <PageHeader
        eyebrow="Care coordination"
        title="Referrals"
        description="Requested → Accepted → Booked → Completed → Acknowledged. Every referral shows where progress stopped and who it's waiting on."
        actions={
          <>
            <Segmented
              ariaLabel="View"
              value={view}
              onChange={setView}
              items={[
                { value: "pipeline", label: "Pipeline", icon: <Rows /> },
                { value: "journeys", label: "Journeys", icon: <Path /> },
              ]}
            />
            <Button variant="dark" leading={<Plus weight="bold" />} onClick={() => setNewOpen(true)}>
              New referral
            </Button>
          </>
        }
      />

      <section aria-label="Referral summary" className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        <StatButton pressed={stage === "requested"} onClick={() => setStage(stage === "requested" ? "all" : "requested")}>
          <Stat
            tone="primary"
            label="Awaiting acceptance"
            icon={<HandWaving />}
            value={awaiting.length}
            context={awaiting[0] ? `Oldest: ${patientById(awaiting[0].r.patientId)?.name} · ${waitText(awaiting[0].st.waitingDays)}` : "Nothing waiting"}
            className="h-full"
          />
        </StatButton>
        <StatButton pressed={progress === "stalled"} onClick={() => setProgress(progress === "stalled" ? "all" : "stalled")}>
          <Stat label="Stalled over 2 days" icon={<Hourglass className="text-warning" />} value={stalled.length} context="No stage change in 48 hours" className="h-full" />
        </StatButton>
        <StatButton pressed={progress === "overdue"} onClick={() => setProgress(progress === "overdue" ? "all" : "overdue")}>
          <Stat label="Past due date" icon={<CalendarX className="text-danger" />} value={overdue.length} context="Due date passed, loop still open" className="h-full" />
        </StatButton>
        <StatButton pressed={progress === "closed"} onClick={() => setProgress(progress === "closed" ? "all" : "closed")}>
          <Stat
            label="Loop closed"
            icon={<SealCheck className="text-success" />}
            value={
              <>
                {closed.length}
                <span className="text-lg text-muted"> / {inScope.length}</span>
              </>
            }
            context="Acknowledged by the referrer"
            className="h-full"
          />
        </StatButton>
      </section>

      {view === "pipeline" && inScope.length ? <HandoffStrip referrals={inScope} stage={stage} onStage={setStage} /> : null}

      <div className="flex flex-col gap-3 xl:flex-row xl:items-start">
        {clinician ? (
        <div className="scrollbar-none -mx-4 overflow-x-auto px-4 lg:-mx-6 lg:px-6 xl:mx-0 xl:mt-1 xl:shrink-0 xl:px-0">
          <Segmented
            ariaLabel="Whose referrals"
            value={scope}
            onChange={setScope}
            className="w-max"
            items={[
              { value: "all", label: "All", count: counts.all },
              { value: "incoming", label: "Incoming", count: counts.incoming },
              { value: "outgoing", label: "Outgoing", count: counts.outgoing },
            ]}
          />
        </div>
        ) : null}
        <div className="scrollbar-none -mx-4 flex min-w-0 items-center gap-2 overflow-x-auto px-4 py-1 lg:-mx-6 lg:px-6 xl:mx-0 xl:flex-wrap xl:overflow-x-visible xl:px-0">
          <FilterMenu label="Stage" value={stage === "all" ? "All" : REFERRAL_STAGE_LABEL[stage]} active={stage !== "all"} contentClassName="w-[300px]">
            <DropdownRadioGroup value={stage} onValueChange={(v) => setStage(v as ReferralStage | "all")}>
              <DropdownRadioItem value="all">All stages</DropdownRadioItem>
              {REFERRAL_STAGES.map((s, i) => (
                <DropdownRadioItem key={s} value={s} description={i < REFERRAL_STAGES.length - 1 ? STAGE_WAITING[REFERRAL_STAGES[i + 1]] : "Closed"}>
                  {REFERRAL_STAGE_LABEL[s]}
                </DropdownRadioItem>
              ))}
            </DropdownRadioGroup>
          </FilterMenu>
          <FilterMenu label="Discipline" value={discipline === "all" ? "All" : DISCIPLINE_LABEL[discipline]} active={discipline !== "all"}>
            <DropdownRadioGroup value={discipline} onValueChange={(v) => setDiscipline(v as Discipline | "all")}>
              <DropdownRadioItem value="all">All disciplines</DropdownRadioItem>
              {(["nutrition", "movement", "medical"] as Discipline[]).map((d) => (
                <DropdownRadioItem key={d} value={d}>
                  <span className="inline-flex items-center gap-2">
                    <span className={cn("size-2 rounded-full", DISCIPLINE_DOT[d])} aria-hidden="true" />
                    {DISCIPLINE_LABEL[d]}
                  </span>
                </DropdownRadioItem>
              ))}
            </DropdownRadioGroup>
          </FilterMenu>
          <FilterMenu label="Progress" value={progress === "all" ? "All" : HEALTH_LABEL[progress]} active={progress !== "all"}>
            <DropdownRadioGroup value={progress} onValueChange={(v) => setProgress(v as Progress)}>
              <DropdownRadioItem value="all">Any progress</DropdownRadioItem>
              {(["overdue", "stalled", "on-track", "closed"] as Health[]).map((h) => (
                <DropdownRadioItem key={h} value={h}>
                  {HEALTH_LABEL[h]}
                </DropdownRadioItem>
              ))}
            </DropdownRadioGroup>
          </FilterMenu>
          {anyFilter ? (
            <Button variant="ghost" onClick={reset} className="shrink-0">
              Reset filters
            </Button>
          ) : null}
        </div>
        <p className="text-xs text-muted xl:ml-auto xl:mt-4 xl:shrink-0" aria-live="polite">
          {filtered.length} of {inScope.length} shown
        </p>
      </div>

      {filtered.length === 0 ? (
        <Card>
          <EmptyState
            icon={<ArrowsLeftRight />}
            title={scope === "incoming" ? "No incoming referrals match" : scope === "outgoing" ? "No outgoing referrals match" : "No referrals match these filters"}
            description="Change the scope or reset the filters to see more."
            action={
              <div className="flex flex-wrap justify-center gap-2">
                {anyFilter ? (
                  <Button variant="secondary" onClick={reset}>
                    Reset filters
                  </Button>
                ) : null}
                <Button variant="dark" onClick={() => setScope("all")}>
                  Show all referrals
                </Button>
              </div>
            }
          />
        </Card>
      ) : view === "journeys" ? (
        <ReferralJourneys referrals={filtered} onOpen={setOpenId} />
      ) : (
        <LayoutGroup id="referral-groups">
          <div className="flex flex-col gap-4">
            {groups.map((g) => {
              const GIcon = g.icon;
              return (
                <motion.section key={g.id} layout="position" transition={spring} aria-labelledby={`ref-${g.id}`} className="rounded-card bg-sunken p-2">
                  <GroupHeader
                    icon={<GIcon className={g.id === "attention" ? "text-danger" : g.id === "closed" ? "text-success" : undefined} />}
                    title={<h2 id={`ref-${g.id}`}>{g.label}</h2>}
                    subtitle={g.hint}
                    action={<CountChip>{g.items.length} {g.items.length === 1 ? "referral" : "referrals"}</CountChip>}
                  />
                  <ul className="flex flex-col gap-2">
                    {g.items.map((r) => (
                      <motion.li key={r.id} layout="position" layoutId={`referral-${r.id}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={spring}>
                        <ReferralCard referral={r} onOpen={() => setOpenId(r.id)} onBook={setBooking} />
                      </motion.li>
                    ))}
                  </ul>
                </motion.section>
              );
            })}
          </div>
        </LayoutGroup>
      )}

      <ReferralSheet referralId={openId} onClose={() => setOpenId(null)} onBook={setBooking} />
      <BookModal
        referral={booking}
        onClose={() => setBooking(null)}
        onBook={(r, startIso, room) => {
          advance(r, "booked", { bookedFor: startIso, room });
          setBooking(null);
        }}
      />
      <NewReferralModal open={newOpen} onOpenChange={setNewOpen} onCreated={(r) => setScope(r.fromId === user.id ? (scope === "incoming" ? "all" : scope) : "all")} />
      <Suspense fallback={null}>
        <QueryFlag name="view" value="journeys" onMatch={() => setView("journeys")} />
      </Suspense>
    </div>
  );
}

function StatButton({ pressed, onClick, children }: { pressed: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={cn(
        "rounded-card text-left transition-[transform,box-shadow] duration-300 [transition-timing-function:var(--ease-spring)] hover:-translate-y-0.5 active:scale-[0.98]",
        pressed && "shadow-[0_0_0_2px_var(--color-canvas),0_0_0_4px_var(--color-charcoal)]",
      )}
    >
      {children}
    </button>
  );
}

function PatientNotice() {
  return (
    <div className="flex flex-col gap-6 lg:gap-8">
      <PageHeader title="Referrals" description="Referrals between your doctor, nutritionist and yoga instructor are managed by your care team." />
      <Card>
        <EmptyState
          icon={<ArrowsLeftRight />}
          title="Your upcoming visits are in Appointments"
          description="When a referral is booked, the appointment appears there. Questions about a referral? Message your care team."
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <Button asChild variant="secondary">
                <Link href="/messages">Message the care team</Link>
              </Button>
              <Button asChild variant="dark">
                <Link href="/portal/appointments">Appointments</Link>
              </Button>
            </div>
          }
        />
      </Card>
    </div>
  );
}

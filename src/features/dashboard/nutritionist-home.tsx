"use client";

import Link from "next/link";
import { useId } from "react";
import { ArrowUpRight, ArrowsLeftRight, CalendarCheck, ClipboardText, Flag, NotePencil, Warning } from "@phosphor-icons/react";
import { cn } from "@/lib/cn";
import { formatTime, pluralize } from "@/lib/format";
import { useRole } from "@/components/shell/role-context";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { StatusBadge, appointmentTone } from "@/components/ui/status";
import { DEMO_USER, staffById } from "@/data/staff";
import { patientById } from "@/data/patients";
import { APPOINTMENT_STATUS_LABEL } from "@/data/appointments";
import { REFERRALS } from "@/data/care";
import { NUTRITION_PLANS, PLAN_STATUS_LABEL } from "@/data/programs";
import type { PlanStatus } from "@/data/types";
import { NOW_LABEL, appointmentsFor, daysSince, minutesUntil, profileHref, shortDate, spanLabel, whenLabel } from "./data";
import { flagsRaisedBy, newAssignmentsFor, returnsAt } from "./owners";
import { dashboardActions, useDashboardState } from "./session";
import { DashGrid, DashboardHeader, FocalCard, FocalHead, FocalInset, FocalLabel, FocalStat, InsetList, ItemCard, ListRow, Panel, PanelEmpty, Rail, Reveal, TimeLead } from "./ui";

/**
 * Nutritionist home — "Whose plan needs me?"
 * New assignments (assigned, not yet seen — opening one marks it seen), plans to publish,
 * follow-ups due and the flags I raised that are still waiting on a doctor. Calorie targets and
 * food logs live in the patient's nutrition section.
 */
const ME = DEMO_USER.nutritionist.personId;

const myPlans = NUTRITION_PLANS.filter((p) => p.authorId === ME);
const ORDER: Record<PlanStatus, number> = { "in-review": 0, draft: 1, published: 2, superseded: 3 };
const toPublish = myPlans.filter((p) => p.status === "draft" || p.status === "in-review").sort((a, b) => ORDER[a.status] - ORDER[b.status] || b.updatedAt.localeCompare(a.updatedAt));
const planTone = (s: PlanStatus) => (({ draft: "draft", "in-review": "warning", published: "success", superseded: "neutral" }) as const)[s];

/** Clinic+: today's nutrition visits on my calendar that are still to happen or under way. */
const todayVisits = appointmentsFor(ME).filter((a) => !["cancelled", "no-show", "completed"].includes(a.status));
/** Core (no calendar): plans whose follow-up date is today or has passed — dates only. */
const datedFollowUps = myPlans.filter((p) => p.status !== "superseded" && daysSince(p.nextReview) >= 0).sort((a, b) => a.nextReview.localeCompare(b.nextReview));

export function NutritionistHome() {
  const { plan, has } = useRole();
  const { seen } = useDashboardState();
  const calendar = has("calendar");
  const fresh = newAssignmentsFor(ME, plan, seen);
  const flags = flagsRaisedBy(ME);
  const dueCount = calendar ? todayVisits.length : datedFollowUps.length;

  return (
    <div className="flex flex-col gap-6">
      <DashboardHeader
        summary={`${pluralize(fresh.length, "new assignment")} · ${pluralize(toPublish.length, "plan")} to publish · ${pluralize(dueCount, "follow-up")} due today`}
        actions={
          <>
            <Button asChild variant="dark">
              <Link href="/nutrition/builder">
                <NotePencil />
                Plan builder
              </Link>
            </Button>
            <Button asChild variant="secondary">
              <Link href="/nutrition">
                <ClipboardText />
                All plans
              </Link>
            </Button>
          </>
        }
      />

      <DashGrid>
        <Reveal index={0} className="lg:col-span-2">
          <NewAssignments fresh={fresh} seen={seen} coordinator={has("coordinator")} />
        </Reveal>

        <Rail index={1} className="xl:row-span-2">
          <Panel icon={<ClipboardText />} title="Plans to publish" subtitle={toPublish.length ? `${pluralize(toPublish.length, "plan")} not published yet` : "Everything published"} href="/nutrition" actionLabel="Open nutrition plans">
            {toPublish.length === 0 ? (
              <PanelEmpty icon={<ClipboardText />} title="No drafts waiting" />
            ) : (
              toPublish.map((pl) => {
                const p = patientById(pl.patientId);
                return (
                  <ItemCard
                    key={pl.id}
                    href={`/nutrition/builder?plan=${pl.id}`}
                    avatar={{ src: p?.avatar, name: p?.name ?? "Patient" }}
                    name={p?.name}
                    lines={[`v${pl.version} · ${pl.title}`, `Updated ${whenLabel(pl.updatedAt).replace(/^Yesterday/, "yesterday")}`]}
                    badge={<StatusBadge tone={planTone(pl.status)}>{PLAN_STATUS_LABEL[pl.status]}</StatusBadge>}
                    ariaLabel={`${p?.name}: plan v${pl.version}, ${PLAN_STATUS_LABEL[pl.status]} — open in the plan builder`}
                  />
                );
              })
            )}
          </Panel>
        </Rail>

        <Reveal index={2}>
          <Panel icon={<CalendarCheck />} title="Follow-ups due" subtitle={dueCount ? `${pluralize(dueCount, "patient")} today` : "Nothing due today"} href={calendar ? "/schedule" : "/nutrition"} actionLabel={calendar ? "Open schedule" : "Open nutrition plans"} className="h-full">
            {dueCount === 0 ? (
              <PanelEmpty icon={<CalendarCheck />} title="No follow-ups due today" />
            ) : calendar ? (
              <InsetList label="Follow-ups today">
                {todayVisits.map((a) => {
                  const p = patientById(a.patientId);
                  return (
                    <ListRow
                      key={a.id}
                      href={profileHref(a.patientId, "nutrition")}
                      lead={
                        <>
                          <TimeLead time={formatTime(a.start)} sub={`${a.durationMin} min`} />
                          <Avatar src={p?.avatar} name={p?.name ?? "Patient"} size="sm" />
                        </>
                      }
                      title={p?.name}
                      meta={a.service}
                      trailing={<StatusBadge tone={appointmentTone(a.status)}>{APPOINTMENT_STATUS_LABEL[a.status]}</StatusBadge>}
                    />
                  );
                })}
              </InsetList>
            ) : (
              <InsetList label="Follow-ups due">
                {datedFollowUps.map((pl) => {
                  const p = patientById(pl.patientId);
                  const first = pl.status === "draft" && pl.version === 1;
                  return (
                    <ListRow
                      key={pl.id}
                      href={profileHref(pl.patientId, "nutrition")}
                      lead={<Avatar src={p?.avatar} name={p?.name ?? "Patient"} size="sm" />}
                      title={p?.name}
                      meta={first ? "First assessment" : `Plan v${pl.version} follow-up`}
                      trailing={<StatusBadge tone={daysSince(pl.nextReview) > 0 ? "danger" : "warning"}>{daysSince(pl.nextReview) > 0 ? `Was due ${shortDate(pl.nextReview)}` : "Due today"}</StatusBadge>}
                    />
                  );
                })}
              </InsetList>
            )}
          </Panel>
        </Reveal>

        <Reveal index={3}>
          <Panel icon={<Flag />} title="Flags you raised" subtitle={flags.length ? `${pluralize(flags.length, "flag")} waiting on a doctor` : "Nothing waiting"} className="h-full">
            {flags.length === 0 ? (
              <PanelEmpty icon={<Flag />} title="No flags waiting" description="Raise a concern from a patient's nutrition section — it goes to their doctor, and you'll see it here until they respond." />
            ) : (
              flags.map((f) => {
                const p = patientById(f.patientId);
                return (
                  <ItemCard
                    key={f.id}
                    href={profileHref(f.patientId, "nutrition")}
                    avatar={{ src: p?.avatar, name: p?.name ?? "Patient" }}
                    name={p?.name}
                    lines={[f.what, `With ${staffById(f.doctorId)?.name} · no response yet`]}
                    badge={<StatusBadge tone={f.urgency === "same-day" ? "warning" : "neutral"}>{f.urgency === "same-day" ? "Same day" : "Routine"}</StatusBadge>}
                  />
                );
              })
            )}
          </Panel>
        </Reveal>
      </DashGrid>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------
// Focal: new assignments — assigned → seen; opening one marks it seen
// ---------------------------------------------------------------------------------------------

function NewAssignments({ fresh, seen, coordinator }: { fresh: typeof REFERRALS; seen: Record<string, string>; coordinator: boolean }) {
  const id = useId();
  const firstBack = fresh[0] ? minutesUntil(returnsAt(fresh[0])) : null;
  const openedHere = REFERRALS.filter((r) => r.toId === ME && seen[r.id]);
  const backTo = (fromId: string) => (coordinator ? "the care coordinator" : staffById(fromId)?.name);

  return (
    <FocalCard labelledBy={id} className="h-full">
      <FocalHead
        id={id}
        label="New assignments"
        title={fresh.length ? pluralize(fresh.length, "new assignment") : "No new assignments"}
        meta={fresh.length ? `Opening one marks it seen. Not opened within 48 hours, it goes back to ${coordinator ? "the care coordinator" : "the doctor who assigned it"}.` : "Doctors' assignments to you appear here until you open them."}
        aside={firstBack !== null && firstBack > 0 ? <FocalStat value={spanLabel(firstBack)} caption="until the first goes back" /> : undefined}
      />
      {fresh.length ? (
        <ul className={cn("grid grid-cols-1 gap-2", fresh.length > 1 && "md:grid-cols-2")}>
          {fresh.map((r) => {
            const p = patientById(r.patientId);
            const back = returnsAt(r);
            return (
              <li key={r.id}>
                <FocalInset className="flex h-full flex-col">
                  <div className="flex items-start gap-3">
                    <Avatar src={p?.avatar} name={p?.name ?? "Patient"} size="md" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-ink">{p?.name}</p>
                      <p className="text-xs text-muted">
                        {p?.age} · {p?.sex} · from {staffById(r.fromId)?.name}, {shortDate(r.requestedAt)}
                      </p>
                    </div>
                    <StatusBadge tone="warning">Not opened</StatusBadge>
                  </div>
                  <p className="mt-4 text-xs text-muted">Goals from the doctor</p>
                  <p className="mt-1 text-sm text-ink-2">{r.reason}</p>
                  <div className="mt-auto flex flex-wrap items-center justify-between gap-3 pt-4">
                    <span className="flex items-center gap-1.5 text-xs text-muted">
                      <Warning size={14} aria-hidden="true" />
                      Goes back to {backTo(r.fromId)} {whenLabel(back).replace(/^Today/, "today at").replace(/^Tomorrow/, "tomorrow at")}
                    </span>
                    <Button asChild size="sm" variant="dark">
                      <Link href={profileHref(r.patientId, "nutrition")} onClick={() => dashboardActions.markSeen(r.id, NOW_LABEL)} aria-label={`Open assignment for ${p?.name} — marks it seen`}>
                        Open assignment
                        <ArrowUpRight />
                      </Link>
                    </Button>
                  </div>
                </FocalInset>
              </li>
            );
          })}
        </ul>
      ) : null}
      {openedHere.length ? (
        <>
          <FocalLabel>Opened in this session · now marked seen</FocalLabel>
          <InsetList label="Opened assignments">
            {openedHere.map((r) => {
              const p = patientById(r.patientId);
              return (
                <ListRow
                  key={r.id}
                  href={profileHref(r.patientId, "nutrition")}
                  lead={<Avatar src={p?.avatar} name={p?.name ?? "Patient"} size="sm" />}
                  title={p?.name}
                  meta={`From ${staffById(r.fromId)?.name}`}
                  trailing={<StatusBadge tone="success">Seen {seen[r.id]}</StatusBadge>}
                />
              );
            })}
          </InsetList>
        </>
      ) : null}
      <div className="mt-auto flex flex-wrap items-center gap-2 p-4 pt-2">
        <Button asChild variant="glass">
          <Link href="/referrals">
            <ArrowsLeftRight />
            All assignments
          </Link>
        </Button>
      </div>
    </FocalCard>
  );
}


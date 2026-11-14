"use client";

import Link from "next/link";
import { useId, type ReactNode } from "react";
import { ArrowUpRight, CalendarBlank, Files, Flag, NotePencil, Plus, UsersThree, WarningCircle } from "@phosphor-icons/react";
import { formatTime, pluralize } from "@/lib/format";
import { useRole } from "@/components/shell/role-context";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { StatusBadge, appointmentTone } from "@/components/ui/status";
import { DEMO_USER, staffById } from "@/data/staff";
import { PATIENTS, patientById } from "@/data/patients";
import { APPOINTMENT_STATUS_LABEL, DISCIPLINE_LABEL } from "@/data/appointments";
import { NOW_MIN, TODAY_KEY, appointmentsFor, daysSince, istDayKey, istMinutes, minutesUntil, nowIndex, profileHref, shortDate } from "./data";
import { flagsTo, followUpsOwnedBy, notesToSign, reportsToReview, returnedAssignmentsFor } from "./owners";
import { useDashboardState } from "./session";
import { DashGrid, DashboardHeader, FocalCard, FocalHead, FocalLabel, FocalStat, InsetList, ItemCard, ListRow, NowMarker, Panel, PanelEmpty, Rail, Reveal, TimeLead } from "./ui";

/**
 * Doctor home — "Who am I seeing, and what's waiting for me?"
 * Today's patients (Clinic+, from the calendar) or my patients (Core, follow-up dates only — no
 * appointment times, queue, tokens or invoices), then reports to review, notes to sign, flags
 * raised to me and follow-ups due. Body systems, lab graphs and assignment history live on the
 * patient profile.
 */
const ME = DEMO_USER.doctor.personId;

const schedule = appointmentsFor(ME);
const myPatients = PATIENTS.filter((p) => p.careTeam.doctor === ME && p.status !== "completed");
/** Core: the follow-up date set at the last consultation (date only). */
const followUpToday = myPatients.filter((p) => p.nextAppointment && istDayKey(p.nextAppointment) === TODAY_KEY);

const reports = reportsToReview(ME);
const notes = notesToSign(ME);
const flags = flagsTo(ME);

const dueBadge = (iso: string | null) => {
  if (!iso) return null;
  if (minutesUntil(iso) < 0) return <StatusBadge tone="danger">Overdue</StatusBadge>;
  if (istDayKey(iso) === TODAY_KEY) return <StatusBadge tone="warning">Due today</StatusBadge>;
  return <StatusBadge tone="neutral">Due {shortDate(iso)}</StatusBadge>;
};

export function DoctorHome() {
  const { plan, has } = useRole();
  const { seen } = useDashboardState();
  const calendar = has("calendar");
  const followUps = followUpsOwnedBy(ME, plan);
  const returned = returnedAssignmentsFor(ME, plan, seen);
  const waiting = followUps.length + returned.length;

  const lead = calendar ? pluralize(schedule.filter((a) => a.status !== "cancelled").length, "patient") + " today" : `${pluralize(followUpToday.length, "follow-up")} due today`;

  return (
    <div className="flex flex-col gap-6">
      <DashboardHeader
        summary={`${lead} · ${pluralize(reports.length, "report")} to review · ${pluralize(notes.length, "note")} to sign · ${pluralize(flags.length, "flag")} raised to you`}
        actions={
          <>
            <Button asChild variant="dark">
              <Link href="/documents">
                <Files />
                Review reports
              </Link>
            </Button>
            <Button asChild variant="secondary">
              {calendar ? (
                <Link href="/schedule">
                  <CalendarBlank />
                  Schedule
                </Link>
              ) : (
                <Link href="/patients">
                  <UsersThree />
                  My patients
                </Link>
              )}
            </Button>
          </>
        }
      />

      <DashGrid>
        <Reveal index={0} className="lg:col-span-2">
          {calendar ? <TodaysPatients /> : <MyPatients />}
        </Reveal>

        <Rail index={1} className="xl:row-span-2">
          <Panel icon={<Files />} title="Reports to review" subtitle={reports.length ? `${pluralize(reports.length, "report")} assigned to you` : "Nothing waiting"} href="/documents" actionLabel="Open documents">
            {reports.length === 0 ? (
              <PanelEmpty icon={<Files />} title="No reports waiting" description="Reports uploaded for your patients come to you for review." />
            ) : (
              reports.map((d) => {
                const p = patientById(d.patientId);
                return (
                  <ItemCard
                    key={d.id}
                    href={`${profileHref(d.patientId!, "reports")}?doc=${d.id}`}
                    avatar={{ src: p?.avatar, name: p?.name ?? "Patient" }}
                    name={p?.name}
                    lines={[d.title, `Issued ${shortDate(d.reportDate)} · uploaded ${shortDate(d.uploadedAt)}`]}
                    badge={dueBadge(d.dueBy)}
                    ariaLabel={`${d.title} for ${p?.name}, issued ${shortDate(d.reportDate)}`}
                  />
                );
              })
            )}
          </Panel>

          <Panel icon={<NotePencil />} title="Notes to sign" subtitle={notes.length ? `${pluralize(notes.length, "draft")} waiting for your signature` : "All notes signed"} href="/tasks" actionLabel="Open tasks">
            {notes.length === 0 ? (
              <PanelEmpty icon={<NotePencil />} title="All notes signed" />
            ) : (
              notes.map((t) => {
                const p = patientById(t.patientId);
                const title = t.title.replace(/^Sign\s+/i, "");
                return (
                  <ItemCard
                    key={t.id}
                    href={profileHref(t.patientId!, "medical")}
                    avatar={{ src: p?.avatar, name: p?.name ?? "Patient" }}
                    name={p?.name}
                    lines={[title.charAt(0).toUpperCase() + title.slice(1), istDayKey(t.due) === TODAY_KEY ? "Sign today" : `Sign by ${shortDate(t.due)}`]}
                    badge={<StatusBadge tone="draft">Draft</StatusBadge>}
                  />
                );
              })
            )}
          </Panel>
        </Rail>

        <Reveal index={2}>
          <Panel icon={<Flag />} title="Flags raised to you" subtitle={flags.length ? `${pluralize(flags.length, "concern")} from the care team` : "No open flags"} className="h-full">
            {flags.length === 0 ? (
              <PanelEmpty icon={<Flag />} title="No flags waiting" description="Nutritionists and instructors raise concerns about your patients here." />
            ) : (
              flags.map((f) => {
                const p = patientById(f.patientId);
                const by = staffById(f.raisedBy);
                return (
                  <ItemCard
                    key={f.id}
                    href={profileHref(f.patientId)}
                    avatar={{ src: p?.avatar, name: p?.name ?? "Patient" }}
                    name={p?.name}
                    lines={[f.what, `From ${by?.name} · ${by?.role === "yoga" ? "Yoga instructor" : "Nutritionist"}`]}
                    badge={f.urgency === "same-day" ? <StatusBadge tone="danger">Same day</StatusBadge> : <StatusBadge tone="neutral">Routine</StatusBadge>}
                  />
                );
              })
            )}
          </Panel>
        </Reveal>

        <Reveal index={3}>
          <Panel icon={<WarningCircle />} title="Follow-ups due" subtitle={waiting ? `${pluralize(waiting, "item")} waiting on you` : "Nothing overdue"} className="h-full">
            {waiting === 0 ? (
              <PanelEmpty
                icon={<WarningCircle />}
                title="No follow-ups overdue"
                description={has("coordinator") ? `Overdue follow-ups and assignments not opened in 48 h go to ${staffById(DEMO_USER.coordinator.personId)?.name}, your care coordinator.` : "Patients whose follow-up has passed appear here."}
              />
            ) : null}
            {followUps.map((f) => {
              const p = patientById(f.patientId);
              return (
                <ItemCard
                  key={f.id}
                  href={profileHref(f.patientId)}
                  avatar={{ src: p?.avatar, name: p?.name ?? "Patient" }}
                  name={p?.name}
                  lines={[f.reason, f.detail]}
                  badge={<StatusBadge tone="danger">Overdue</StatusBadge>}
                />
              );
            })}
            {returned.map((r) => {
              const p = patientById(r.patientId);
              const to = staffById(r.toId);
              return (
                <ItemCard
                  key={r.id}
                  href="/referrals"
                  avatar={{ src: p?.avatar, name: p?.name ?? "Patient" }}
                  name={p?.name}
                  lines={[`${DISCIPLINE_LABEL[r.toDiscipline]} assignment to ${to?.name} not opened`, `Assigned ${shortDate(r.requestedAt)} · came back to you after 48 h`]}
                  badge={<StatusBadge tone="warning">Not seen · {daysSince(r.requestedAt)} d</StatusBadge>}
                  ariaLabel={`${p?.name}: assignment to ${to?.name} not opened, came back to you`}
                />
              );
            })}
          </Panel>
        </Reveal>
      </DashGrid>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------
// Focal (Clinic+): today's patients from the calendar
// ---------------------------------------------------------------------------------------------

function TodaysPatients() {
  const id = useId();
  const active = schedule.filter((a) => a.status !== "cancelled" && a.status !== "no-show");
  const withYou = schedule.find((a) => a.status === "in-session");
  const next = schedule.find((a) => ["arrived", "waiting", "booked"].includes(a.status) && (a.status !== "booked" || istMinutes(a.start) > NOW_MIN));
  const toSee = active.filter((a) => a.status !== "completed" && a.status !== "in-session").length;
  const at = nowIndex(schedule);
  const room = staffById(ME)?.room;
  const waitingFor = (patientId: string) => {
    const tags: string[] = [];
    if (reports.some((d) => d.patientId === patientId)) tags.push("Report to review");
    if (flags.some((f) => f.patientId === patientId)) tags.push("Flag");
    return tags;
  };

  return (
    <FocalCard labelledBy={id} className="h-full">
      <FocalHead
        id={id}
        label={`Today's patients${room ? ` · ${room}` : ""}`}
        title={pluralize(active.length, "patient") + " today"}
        meta={
          <>
            {withYou ? `${patientById(withYou.patientId)?.name} is with you now` : "Nobody with you right now"}
            {next ? ` · next ${patientById(next.patientId)?.name}${next.kind === "walk-in" ? " (walk-in, waiting)" : ` at ${formatTime(next.start)}`}` : ""}
          </>
        }
        aside={<FocalStat value={toSee} caption="still to see" />}
      />
      <InsetList label="Today's patients">
        {schedule.map((a, i) => {
          const p = patientById(a.patientId);
          const done = a.status === "completed" || a.status === "cancelled" || a.status === "no-show";
          const tags = waitingFor(a.patientId);
          return (
            <FragmentRow key={a.id} marker={i === at}>
              <ListRow
                href={profileHref(a.patientId)}
                ariaLabel={`${formatTime(a.start)} ${p?.name}, ${a.service}, ${APPOINTMENT_STATUS_LABEL[a.status]}`}
                lead={
                  <>
                    <TimeLead time={formatTime(a.start)} sub={`${a.durationMin} min`} muted={done} />
                    <Avatar src={p?.avatar} name={p?.name ?? "Patient"} size="sm" />
                  </>
                }
                title={p?.name}
                muted={done}
                meta={a.kind === "walk-in" ? "Walk-in" : a.service}
                trailing={
                  <>
                    {tags.map((t) => (
                      <StatusBadge key={t} tone="neutral" dot={false}>
                        {t}
                      </StatusBadge>
                    ))}
                    <StatusBadge tone={appointmentTone(a.status)}>{APPOINTMENT_STATUS_LABEL[a.status]}</StatusBadge>
                  </>
                }
              />
            </FragmentRow>
          );
        })}
        {at === schedule.length ? <NowMarker /> : null}
      </InsetList>
      <div className="mt-auto flex flex-wrap items-center gap-2 p-4 pt-2">
        {withYou ? (
          <Button asChild variant="secondary" className="shadow-none">
            <Link href={`${profileHref(withYou.patientId, "medical")}?new=1`}>
              <Plus />
              Note for {patientById(withYou.patientId)?.name.split(" ")[0]}
            </Link>
          </Button>
        ) : null}
        <Button asChild variant="glass">
          <Link href="/schedule">
            Open schedule
            <ArrowUpRight />
          </Link>
        </Button>
      </div>
    </FocalCard>
  );
}

function FragmentRow({ marker, children }: { marker: boolean; children: ReactNode }) {
  return (
    <>
      {marker ? <NowMarker /> : null}
      {children}
    </>
  );
}

// ---------------------------------------------------------------------------------------------
// Focal (Core): my patients, by the follow-up date set at their last consultation
// ---------------------------------------------------------------------------------------------

function MyPatients() {
  const id = useId();
  const others = myPatients.filter((p) => !followUpToday.includes(p)).sort((a, b) => (a.nextAppointment ?? "0").localeCompare(b.nextAppointment ?? "0"));
  return (
    <FocalCard labelledBy={id} className="h-full">
      <FocalHead
        id={id}
        label="My patients"
        title={`${pluralize(followUpToday.length, "follow-up")} due today`}
        meta={`${pluralize(myPatients.length, "patient")} with you as primary doctor · follow-up dates from their last consultation`}
        aside={<FocalStat value={myPatients.length} caption="on your list" />}
      />
      <InsetList label="Follow-up due today">
        {followUpToday.map((p) => {
          const tags = [reports.some((d) => d.patientId === p.id) ? "Report to review" : null, notes.some((t) => t.patientId === p.id) ? "Note to sign" : null, flags.some((f) => f.patientId === p.id) ? "Flag" : null].filter(Boolean) as string[];
          return (
            <ListRow
              key={p.id}
              href={profileHref(p.id)}
              lead={<Avatar src={p.avatar} name={p.name} size="md" />}
              title={p.name}
              meta={`${p.age} · ${p.sex} · ${p.primaryConcern} · last seen ${p.lastVisit ? shortDate(p.lastVisit) : "—"}`}
              trailing={
                <>
                  {tags.map((t) => (
                    <StatusBadge key={t} tone="neutral" dot={false}>
                      {t}
                    </StatusBadge>
                  ))}
                  <StatusBadge tone="info">Follow-up today</StatusBadge>
                </>
              }
            />
          );
        })}
      </InsetList>
      {others.length ? (
        <>
          <FocalLabel>Also on your list</FocalLabel>
          <ul className="flex flex-wrap gap-2 px-2 pb-2">
            {others.map((p) => (
              <li key={p.id}>
                <Link href={profileHref(p.id)} className="inline-flex h-10 items-center gap-2 rounded-full bg-white/15 py-1 pl-1 pr-4 text-xs text-white transition-colors hover:bg-white/25">
                  <Avatar src={p.avatar} name={p.name} size="sm" className="bg-white" />
                  <span>
                    {p.name} · {p.nextAppointment ? `follow-up ${shortDate(p.nextAppointment)}` : "follow-up overdue"}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </FocalCard>
  );
}

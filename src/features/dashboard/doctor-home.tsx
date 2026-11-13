"use client";

import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { useId, useMemo, useState, type ReactNode } from "react";
import {
  ArrowUpRight,
  ArrowsLeftRight,
  CalendarBlank,
  CalendarPlus,
  ClipboardText,
  Files,
  FileText,
  Heartbeat,
  NotePencil,
  Plus,
  Warning,
  WarningCircle,
} from "@phosphor-icons/react";
import { cn } from "@/lib/cn";
import { snappy } from "@/lib/motion";
import { formatTime, pluralize } from "@/lib/format";
import { usePlan } from "@/components/shell/role-context";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Inset } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status";
import { SegmentedBar, Sparkline } from "@/components/charts/bar-chart";
import { BodyConditionCard } from "@/components/viz/condition";
import { MediaStatCard } from "@/components/viz/cards";
import { OrganImage } from "@/components/viz/organ";
import { ORGAN_LABEL } from "@/data/anatomy";
import { getRecord } from "@/data/record";
import { latestMeasurements, measureHistory, systemShares } from "@/data/insights";
import { DEMO_USER, staffById } from "@/data/staff";
import { FEATURED_PATIENT_ID, PATIENTS, clinicNumber, patientById } from "@/data/patients";
import { APPOINTMENT_STATUS_LABEL, DISCIPLINE_LABEL, WAITLIST } from "@/data/appointments";
import { REFERRALS, REFERRAL_STAGE_LABEL, TASKS } from "@/data/care";
import { DOCUMENTS } from "@/data/records";
import { CARE_EVENTS, CARE_PLAN, CONDITIONS } from "@/data/featured";
import { NUTRITION_PLANS } from "@/data/programs";
import type { AppointmentStatus, Referral } from "@/data/types";
import { NOW_MIN, TODAY_KEY, appointmentsFor, daysSince, istDayKey, istMinutes, minutesUntil, nowIndex, shortDate, splitMedicines, untilLabel, whenLabel } from "./data";
import {
  AppointmentRow,
  DashGrid,
  DashboardHeader,
  DisciplineDot,
  FocalCard,
  FocalFact,
  FocalHead,
  FocalInset,
  LockedTile,
  NowMarker,
  Panel,
  PanelEmpty,
  Reveal,
  RowLink,
  StageTrack,
} from "./ui";
import { DayStrip, SystemIcon } from "./viz";

/**
 * Doctor home (doc §2B): today's patients, unsigned notes, reports awaiting review and overdue
 * clinical follow-ups. Focal card = the next booked patient with a pre-consultation summary.
 */
const ME = DEMO_USER.doctor.personId;

const schedule = appointmentsFor(ME);
const nextAppt = schedule.find((a) => a.status === "booked" && a.kind !== "walk-in" && istMinutes(a.start) > NOW_MIN) ?? null;

const reports = DOCUMENTS.filter((d) => d.reviewerId === ME && d.status === "awaiting-review").sort((a, b) => (a.dueBy ?? "9").localeCompare(b.dueBy ?? "9"));
const unsignedNotes = TASKS.filter((t) => t.ownerId === ME && t.source === "Unsigned draft" && t.status !== "done");
const overdueReviews = PATIENTS.filter((p) => p.careTeam.doctor === ME && !p.nextAppointment && p.status !== "completed");
const urgentToday = TASKS.filter((t) => t.ownerId === ME && t.priority === "urgent" && t.status !== "done" && istDayKey(t.due) === TODAY_KEY);
const STAGE_ORDER = { requested: 0, accepted: 1, booked: 2, completed: 3, acknowledged: 4 } as const;
const referralsSent = REFERRALS.filter((r) => r.fromId === ME).sort((a, b) => STAGE_ORDER[a.stage] - STAGE_ORDER[b.stage] || a.dueBy.localeCompare(b.dueBy));

const isOverdue = (iso: string | null) => !!iso && minutesUntil(iso) < 0;
const NOW_AT = nowIndex(schedule);

/** Day-strip colours follow the status badges (state colours, always with a legend). */
const STATUS_COLOR: Record<AppointmentStatus, string> = {
  booked: "var(--color-ops)",
  arrived: "var(--color-warning)",
  waiting: "var(--color-warning)",
  "in-session": "var(--color-charcoal)",
  checkout: "var(--color-charcoal)",
  completed: "var(--color-success)",
  cancelled: "var(--color-line-strong)",
  "no-show": "var(--color-danger)",
};
const STRIP_LEGEND = [
  { label: "In session", color: STATUS_COLOR["in-session"] },
  { label: "Arrived / waiting", color: STATUS_COLOR.waiting },
  { label: "Booked", color: STATUS_COLOR.booked },
  { label: "Completed", color: STATUS_COLOR.completed },
].filter((l) => schedule.some((a) => STATUS_COLOR[a.status] === l.color));
const BOOKED_MIN = schedule.filter((a) => a.status !== "cancelled" && a.status !== "no-show").reduce((m, a) => m + a.durationMin, 0);
const spanLabelMin = (m: number) => (m >= 60 ? `${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60} min` : ""}` : `${m} min`);

/** "Sign consultation note from 4 Nov" → "Consultation note from 4 Nov" */
const noteLabel = (title: string) => {
  const s = title.replace(/^Sign\s+/i, "");
  return s.charAt(0).toUpperCase() + s.slice(1);
};

export function DoctorHome() {
  const { has, details } = usePlan();
  const overdueReports = reports.filter((d) => isOverdue(d.dueBy)).length;
  // Only show work raised by roles this plan actually has (Starter is a single practitioner).
  const urgent = urgentToday.filter((t) => {
    const by = staffById(t.createdBy)?.role;
    return !by || details.roles.includes(by);
  });

  return (
    <div className="flex flex-col gap-8">
      <DashboardHeader
        summary={`${schedule.length} appointments today · ${reports.length} reports to review · ${unsignedNotes.length} note to sign`}
        actions={
          <>
            <Button asChild variant="dark">
              <Link href="/documents">
                <Files />
                Review reports
              </Link>
            </Button>
            <Button asChild variant="secondary">
              <Link href="/schedule?new=1">
                <CalendarPlus />
                Book follow-up
              </Link>
            </Button>
          </>
        }
      />

      <DashGrid>
        <Reveal index={0} className="lg:col-span-2">
          {nextAppt ? <NextPatientCard apptId={nextAppt.id} /> : null}
        </Reveal>

        <Reveal index={1}>
          <Panel icon={<CalendarBlank />} title="Today's schedule" subtitle={`${schedule.length} appointments · ${staffById(ME)?.room ?? ""}`} href="/schedule" actionLabel="Open schedule">
            <Inset>
              <p className="mb-3 text-xs text-muted">Your day, 08:00–18:00 · {spanLabelMin(BOOKED_MIN)} booked · each block is one appointment</p>
              <DayStrip
                label={`Your appointments today on a time axis: ${schedule.map((a) => `${formatTime(a.start)} ${patientById(a.patientId)?.name}, ${APPOINTMENT_STATUS_LABEL[a.status]}`).join("; ")}`}
                fromMin={8 * 60}
                toMin={18 * 60}
                nowMin={NOW_MIN}
                items={schedule.map((a) => ({
                  id: a.id,
                  startMin: istMinutes(a.start),
                  durationMin: a.durationMin,
                  color: STATUS_COLOR[a.status],
                  title: `${formatTime(a.start)} · ${patientById(a.patientId)?.name}`,
                  detail: `${a.service} · ${APPOINTMENT_STATUS_LABEL[a.status]}`,
                  href: `/patients/${a.patientId}`,
                }))}
                legend={STRIP_LEGEND}
              />
            </Inset>
            {schedule.map((a, i) => (
              <ScheduleSlot key={a.id} marker={i === NOW_AT}>
                <AppointmentRow
                  appt={a}
                  detail={
                    a.kind === "walk-in" ? (
                      <>
                        Walk-in · token <span className="font-mono">{a.token}</span>
                        {a.formsComplete === false ? " · intake incomplete" : ""}
                      </>
                    ) : undefined
                  }
                />
              </ScheduleSlot>
            ))}
            {NOW_AT === schedule.length ? <NowMarker /> : null}
          </Panel>
        </Reveal>

        <Reveal index={2}>
          <Panel
            icon={<Files />}
            title="Reports awaiting review"
            subtitle={`${reports.length} assigned to you${overdueReports ? ` · ${overdueReports} overdue` : ""}`}
            href="/documents"
            actionLabel="Open documents"
          >
            {reports.length ? (
              <Inset>
                <SegmentedBar
                  label="Reports assigned to you by due date"
                  parts={[
                    { label: "Overdue", value: overdueReports, color: "var(--color-danger)" },
                    { label: "Due today", value: reports.filter((d) => !isOverdue(d.dueBy) && d.dueBy && istDayKey(d.dueBy) === TODAY_KEY).length, color: "var(--color-warning)" },
                    { label: "Due later", value: reports.filter((d) => !isOverdue(d.dueBy) && !(d.dueBy && istDayKey(d.dueBy) === TODAY_KEY)).length, color: "var(--color-ops)" },
                  ]}
                />
              </Inset>
            ) : null}
            {reports.length === 0 ? (
              <PanelEmpty icon={<Files />} title="No reports waiting" description="Reports assigned to you for review will appear here." />
            ) : (
              reports.map((d) => {
                const p = patientById(d.patientId);
                const overdue = isOverdue(d.dueBy);
                const dueToday = d.dueBy ? istDayKey(d.dueBy) === TODAY_KEY : false;
                return (
                  <RowLink key={d.id} href="/documents" className="flex flex-col gap-2">
                    <span className="flex items-start justify-between gap-3">
                      <span className="min-w-0">
                        <span className="block truncate text-sm text-ink">{d.title}</span>
                        <span className="block truncate text-xs text-muted">
                          {p?.name} · {d.source}
                        </span>
                      </span>
                      {overdue ? (
                        <StatusBadge tone="danger">Overdue</StatusBadge>
                      ) : dueToday ? (
                        <StatusBadge tone="warning">Due {formatTime(d.dueBy!)}</StatusBadge>
                      ) : (
                        <StatusBadge tone="neutral">Due {shortDate(d.dueBy!)}</StatusBadge>
                      )}
                    </span>
                    <span className="text-xs text-muted">
                      Reported {shortDate(d.reportDate)} · uploaded {shortDate(d.uploadedAt)}
                      {overdue && d.dueBy ? ` · was due ${shortDate(d.dueBy)}` : ""}
                    </span>
                  </RowLink>
                );
              })
            )}
          </Panel>
        </Reveal>

        <Reveal index={3} className="flex flex-col gap-4">
          <Panel icon={<NotePencil />} title="Unsigned notes" subtitle={`${unsignedNotes.length} draft waiting for your signature`} href="/tasks" actionLabel="Open tasks">
            {unsignedNotes.length === 0 ? (
              <PanelEmpty icon={<NotePencil />} title="All notes signed" />
            ) : (
              unsignedNotes.map((t) => {
                const p = patientById(t.patientId);
                return (
                  <RowLink key={t.id} href={`/patients/${t.patientId}/notes`} className="flex items-center gap-3">
                    <Avatar src={p?.avatar} name={p?.name ?? "Patient"} size="sm" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm text-ink">{p?.name}</span>
                      <span className="block truncate text-xs text-muted">{noteLabel(t.title)}</span>
                      <span className="block truncate text-xs text-muted">Sign by today {formatTime(t.due)}</span>
                    </span>
                    <StatusBadge tone="draft">Draft</StatusBadge>
                  </RowLink>
                );
              })
            )}
          </Panel>

          <Panel
            icon={<WarningCircle />}
            title="Overdue follow-ups"
            subtitle={`${overdueReviews.length} overdue · ${urgent.length} urgent today`}
            href="/tasks"
            actionLabel="Open tasks"
          >
            {overdueReviews.map((p) => {
              const wait = has("waitlist") ? WAITLIST.find((w) => w.patientId === p.id) : undefined;
              return (
                <RowLink key={p.id} href={`/patients/${p.id}`} className="flex items-start gap-3">
                  <Avatar src={p.avatar} name={p.name} size="sm" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm text-ink">{p.name}</span>
                    <span className="block text-xs text-muted">
                      Last seen {p.lastVisit ? `${shortDate(p.lastVisit)}, ${Math.round(daysSince(p.lastVisit) / 7)} weeks ago` : "never"}
                    </span>
                    <span className="block text-xs text-muted">{wait ? `No review booked · on waitlist since ${shortDate(wait.addedAt)}` : "No review booked"}</span>
                  </span>
                  <StatusBadge tone="danger">Overdue</StatusBadge>
                </RowLink>
              );
            })}
            {urgent.map((t) => {
              const p = patientById(t.patientId);
              return (
                <RowLink key={t.id} href="/tasks" className="flex items-start gap-3">
                  <Avatar src={p?.avatar} name={p?.name ?? "Patient"} size="sm" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm text-ink">{p?.name}</span>
                    <span className="block text-xs text-muted">{t.title}</span>
                    <span className="block text-xs text-muted">{t.source}</span>
                  </span>
                  <StatusBadge tone="warning">Today {formatTime(t.due)}</StatusBadge>
                </RowLink>
              );
            })}
          </Panel>
        </Reveal>

        <Reveal index={4}>
          {has("referrals") ? (
            <Panel
              icon={<ArrowsLeftRight />}
              title="Referrals you sent"
              subtitle={`${referralsSent.filter((r) => STAGE_ORDER[r.stage] < 3).length} open · ${referralsSent.length} total`}
              href="/referrals"
              actionLabel="Open referrals"
            >
              {referralsSent.map((r) => (
                <ReferralRow key={r.id} referral={r} />
              ))}
            </Panel>
          ) : (
            <LockedTile
              feature="referrals"
              icon={<ArrowsLeftRight />}
              title="Referrals you sent"
              description="Refer patients to a nutritionist or yoga instructor and see where each handoff stops: requested, accepted, booked, completed, acknowledged."
            />
          )}
        </Reveal>
      </DashGrid>
    </div>
  );
}

/** Wraps a schedule row, drawing the live "now" marker above it when it is the next slot. */
function ScheduleSlot({ marker, children }: { marker: boolean; children: ReactNode }) {
  return (
    <>
      {marker ? <NowMarker /> : null}
      {children}
    </>
  );
}

function ReferralRow({ referral: r }: { referral: Referral }) {
  const p = patientById(r.patientId);
  const to = staffById(r.toId);
  const open = STAGE_ORDER[r.stage] < 3;
  const overdue = open && minutesUntil(r.dueBy) < 0;
  const since = r.stageDates[r.stage] ?? r.requestedAt;
  const status =
    r.stage === "requested"
      ? `Waiting for ${to?.name.split(" ")[0] ?? "them"} to accept · ${pluralize(daysSince(since), "day")}`
      : r.stage === "accepted"
        ? `Accepted, not booked · ${pluralize(daysSince(since), "day")}`
        : `${REFERRAL_STAGE_LABEL[r.stage]} ${shortDate(since)}`;
  return (
    <RowLink href="/referrals" className="flex flex-col gap-3">
      <span className="flex items-start justify-between gap-3">
        <span className="min-w-0">
          <span className="block truncate text-sm text-ink">{p?.name}</span>
          <span className="flex items-center gap-1.5 text-xs text-muted">
            <DisciplineDot discipline={r.toDiscipline} />
            <span className="min-w-0 truncate">
              {DISCIPLINE_LABEL[r.toDiscipline]} · {to?.name}
            </span>
          </span>
        </span>
        {overdue ? (
          <StatusBadge tone="danger">Overdue</StatusBadge>
        ) : open ? (
          <StatusBadge tone="warning">{REFERRAL_STAGE_LABEL[r.stage]}</StatusBadge>
        ) : (
          <StatusBadge tone="success">{REFERRAL_STAGE_LABEL[r.stage]}</StatusBadge>
        )}
      </span>
      <span className="flex flex-wrap items-center justify-between gap-2">
        <StageTrack stage={r.stage} stalled={open} />
        <span className="text-xs text-muted">{status}</span>
      </span>
    </RowLink>
  );
}

// ---------------------------------------------------------------------------------------------
// Focal card: next booked patient + pre-consultation summary
// ---------------------------------------------------------------------------------------------

function NextPatientCard({ apptId }: { apptId: string }) {
  const { has } = usePlan();
  const id = useId();
  const appt = schedule.find((a) => a.id === apptId)!;
  const p = patientById(appt.patientId)!;
  const featured = p.id === FEATURED_PATIENT_ID;
  const lastVisit = p.lastVisit ?? "";

  const problems = p.conditions.map((name) => {
    const c = CONDITIONS.find((x) => x.name.toLowerCase() === name.toLowerCase());
    return { name, status: c?.status ?? null };
  });
  const { medicines } = splitMedicines(CARE_PLAN.medical.text);

  // Body systems from the patient's own record: share of care activity + latest lab values.
  const record = useMemo(() => getRecord(p.id), [p.id]);
  const shares = useMemo(() => (record ? systemShares(record) : []), [record]);
  const [systemId, setSystemId] = useState<string | null>(null);
  const system = record?.systems.find((x) => x.id === systemId) ?? record?.systems[0] ?? null;
  const values = record && system ? latestMeasurements(record, system.id).filter((m) => m.event.type === "lab" || m.event.type === "imaging").slice(0, 3) : [];
  const latestRecord = record && system ? record.events.filter((e) => e.systemId === system.id && e.state !== "scheduled" && e.date <= TODAY_KEY).at(-1) : undefined;
  const first = p.name.split(" ")[0];

  // "What changed since I last saw this patient?" (doc §5D) — every item opens its source.
  const lab = DOCUMENTS.find((d) => d.patientId === p.id && d.status === "awaiting-review" && d.reviewerId === ME);
  const labEvent = CARE_EVENTS.find((e) => e.state === "awaiting-review" && e.type === "lab" && e.date === lab?.reportDate);
  const ldl = labEvent?.values?.find((v) => v.label === "LDL-C");
  const plan = NUTRITION_PLANS.find((n) => n.patientId === p.id && n.status === "published" && n.updatedAt > lastVisit);
  const selfReported = CARE_EVENTS.filter((e) => e.state === "self-reported" && e.date > lastVisit.slice(0, 10)).at(-1);

  const changes: { key: string; icon: ReactNode; stamp: string; title: string; detail: string; badge: ReactNode; href: string }[] = [];
  if (lab) {
    changes.push({
      key: "lab",
      icon: <FileText />,
      stamp: shortDate(lab.uploadedAt),
      title: `${lab.title} to review`,
      detail: `Reported ${shortDate(lab.reportDate)} · uploaded ${shortDate(lab.uploadedAt)}${ldl && !values.length ? ` · LDL-C ${ldl.value} ${ldl.unit}` : ""}`,
      badge: <StatusBadge tone="warning">Awaiting your review</StatusBadge>,
      href: "/documents",
    });
  }
  if (plan && has("nutrition")) {
    changes.push({
      key: "plan",
      icon: <ClipboardText />,
      stamp: shortDate(plan.updatedAt),
      title: `Nutrition plan v${plan.version} published`,
      detail: `${staffById(plan.authorId)?.name} · ${plan.adherenceNote}`,
      badge: <StatusBadge tone="success">Published</StatusBadge>,
      href: `/patients/${p.id}`,
    });
  }
  if (selfReported) {
    changes.push({
      key: "self",
      icon: <Heartbeat />,
      stamp: shortDate(selfReported.date),
      title: selfReported.title.replace(" (self-reported)", ""),
      detail: selfReported.summary.replace(/\.$/, ""),
      badge: <StatusBadge tone="neutral">Self-reported</StatusBadge>,
      href: `/patients/${p.id}/vitals`,
    });
  }

  return (
    <FocalCard labelledBy={id} className="h-full">
      <FocalHead
        id={id}
        label="Next patient · booked"
        title={
          <span className="flex items-center gap-3">
            <Avatar src={p.avatar} name={p.name} size="lg" className="bg-white" />
            <span className="min-w-0">
              {p.name}
              <span className="sr-only"> at {formatTime(appt.start)}</span>
            </span>
          </span>
        }
        meta={
          <>
            {p.age} · {p.sex} · <span className="font-mono">{clinicNumber(p.id)}</span> · {appt.service} · {appt.room}
          </>
        }
        aside={
          <div className="text-right">
            <p className="text-title font-normal tabular">{formatTime(appt.start)}</p>
            <p className="text-xs text-white/90">{untilLabel(appt.start)}</p>
          </div>
        }
      />

      {/* Pre-consultation summary, straight on the cobalt surface; the organ follows the selected body system */}
      <div className="grid grid-cols-1 gap-6 px-4 pb-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-start">
        <FocalFact label="Allergies">
          {p.allergies === null ? (
            <span className="inline-flex items-start gap-1.5">
              <Warning size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
              Not recorded — ask before prescribing
            </span>
          ) : p.allergies.length === 0 ? (
            "No known allergies (confirmed)"
          ) : (
            <ul className="flex flex-col gap-1">
              {p.allergies.map((a) => (
                <li key={a}>{a}</li>
              ))}
            </ul>
          )}
        </FocalFact>
        {!system ? (
          <FocalFact label="Active problems">
            <ul className="flex flex-col gap-1">
              {problems.map((c) => (
                <li key={c.name}>
                  {c.name}
                  {c.status ? <span className="text-white/90"> · {c.status.toLowerCase()}</span> : null}
                </li>
              ))}
            </ul>
          </FocalFact>
        ) : null}
        <FocalFact label="Current medicines">
          {featured ? (
            <>
              <ul className="flex flex-col gap-1">
                {medicines.map((m) => (
                  <li key={m}>{m}</li>
                ))}
              </ul>
              <p className="mt-2 text-xs text-white/90">
                Care plan · {staffById(CARE_PLAN.medical.by)?.name}, {shortDate(CARE_PLAN.medical.updated)}
              </p>
            </>
          ) : (
            "See the medication list in the record"
          )}
        </FocalFact>
        {system ? (
          <figure className="flex items-center gap-3 sm:-mb-2 sm:-mt-12 sm:flex-col sm:items-end sm:gap-0">
            <span className="relative block size-24 shrink-0 sm:size-[136px]" aria-hidden="true">
              <AnimatePresence mode="popLayout" initial={false}>
                <motion.span key={system.organ} initial={{ opacity: 0, scale: 0.86 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.86 }} transition={snappy} className="absolute inset-0">
                  <OrganImage kind={system.organ} className="absolute left-1/2 top-1/2 h-[150%] w-[150%] max-w-none -translate-x-1/2 -translate-y-1/2 drop-shadow-[0_18px_24px_rgb(0_0_0/0.28)]" />
                </motion.span>
              </AnimatePresence>
            </span>
            <figcaption className="text-xs text-white/90 sm:text-right">
              {ORGAN_LABEL[system.organ]} · {system.name}
            </figcaption>
          </figure>
        ) : null}
      </div>

      {record && shares.length ? (
        <>
          <p className="px-4 pt-2 text-xs text-white/90">
            Body systems · share of {first}&apos;s care activity in the last 12 months ({shares[0].total} events) · the number is open items (awaiting review or scheduled)
          </p>
          <ul className={cn("grid grid-cols-1 gap-2", shares.length >= 3 ? "sm:grid-cols-3" : shares.length === 2 ? "sm:grid-cols-2" : "")}>
            {shares.map((b) => {
              const sys = record.systems.find((x) => x.id === b.id);
              const conds = record.conditions.filter((c) => c.systemId === b.id);
              return (
                <li key={b.id}>
                  <BodyConditionCard
                    icon={<SystemIcon system={sys?.key} />}
                    label={b.name}
                    percent={b.percent}
                    progress={{ value: b.events, max: Math.max(1, b.total) }}
                    count={b.open}
                    active={system?.id === b.id}
                    onClick={() => setSystemId(b.id)}
                    className="h-full rounded-inner!"
                  >
                    <span className="flex flex-col gap-0.5 text-[11px] text-muted">
                      {conds.map((c) => (
                        <span key={c.id} className="truncate">
                          {c.name} · {c.status.toLowerCase()}
                        </span>
                      ))}
                    </span>
                  </BodyConditionCard>
                </li>
              );
            })}
          </ul>
        </>
      ) : null}

      {record && system ? (
        <>
          <p className="px-4 pt-2 text-xs text-white/90">
            Latest lab values · {system.name}
            {values.some((v) => v.event.state === "awaiting-review") ? " · not reviewed yet" : ""}
          </p>
          {values.length ? (
            <ul className={cn("grid grid-cols-1 gap-2", values.length >= 3 ? "sm:grid-cols-3" : values.length === 2 ? "sm:grid-cols-2" : "")}>
              {values.map((m) => {
                const hist = measureHistory(record, m.label);
                return (
                  <li key={m.label}>
                    <MediaStatCard
                      className="rounded-inner!"
                      value={m.value}
                      label={`${m.label}${m.unit ? ` (${m.unit})` : ""}${m.flag ? ` · ${m.flag}` : ""}`}
                      time={`${shortDate(m.event.date)}${m.event.state === "awaiting-review" ? " · awaiting your review" : ""}`}
                      media={
                        <div className="flex size-full items-center justify-end pr-4">
                          {hist.length > 1 ? (
                            <Sparkline tone="white" className="h-12 w-[96px]" values={hist.map((h) => h.value)} />
                          ) : (
                            <span className="text-[11px] text-white/60">first reading</span>
                          )}
                          <span className="sr-only">
                            {m.label} history: {hist.map((h) => `${h.value} on ${shortDate(h.date)}`).join(", ")}
                          </span>
                        </div>
                      }
                    />
                  </li>
                );
              })}
            </ul>
          ) : (
            <FocalInset className="text-sm text-muted">
              No lab values recorded for this system{latestRecord ? ` — latest record: ${latestRecord.title}, ${shortDate(latestRecord.date)}` : ""}.
            </FocalInset>
          )}
        </>
      ) : null}

      {/* Changes since last visit */}
      <div className="px-4 pt-2">
        <p className="text-xs text-white/90">Changes since the last visit · {lastVisit ? whenLabel(lastVisit) : "first visit"}</p>
      </div>
      {changes.length ? (
        <ul className={cn("grid grid-cols-1 gap-2", changes.length === 3 ? "md:grid-cols-3" : "md:grid-cols-2")}>
          {changes.map((c) => (
            <li key={c.key}>
              <Link href={c.href} className="group flex h-full flex-col rounded-inner bg-surface p-4 text-ink transition-colors duration-200 hover:bg-canvas">
                <span className="flex items-center justify-between">
                  <span className="flex size-8 items-center justify-center rounded-full bg-sunken text-ink-2 [&_svg]:size-4" aria-hidden="true">
                    {c.icon}
                  </span>
                  <span className="text-xs text-muted tabular">{c.stamp}</span>
                </span>
                <span className="mt-4 block text-sm text-ink">{c.title}</span>
                <span className="mt-1 block flex-1 text-xs text-muted">{c.detail}</span>
                <span className="mt-3 block">{c.badge}</span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <FocalInset className="text-sm text-muted">Nothing new since the last visit.</FocalInset>
      )}

      <div className="mt-auto flex flex-wrap items-center gap-2 p-4 pt-2">
        <Button asChild variant="secondary" className="shadow-none">
          <Link href={`/patients/${p.id}/notes?new=1`}>
            <Plus />
            Start note
          </Link>
        </Button>
        <Button asChild variant="glass">
          <Link href={`/patients/${p.id}`}>
            Open record
            <ArrowUpRight />
          </Link>
        </Button>
      </div>
    </FocalCard>
  );
}

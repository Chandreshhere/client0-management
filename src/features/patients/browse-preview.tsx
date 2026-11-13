"use client";

import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { useId, useMemo, useState, type CSSProperties } from "react";
import { ArrowLeft, ArrowRight, ArrowUpRight, CalendarBlank, CalendarPlus, LockSimple, Path } from "@phosphor-icons/react";
import type { Appointment } from "@/data/types";
import type { Condition } from "@/data/featured";
import { ORGAN_LABEL } from "@/data/anatomy";
import { getRecord, type PatientRecord } from "@/data/record";
import { latestMeasurements, systemShares } from "@/data/insights";
import { APPOINTMENT_STATUS_LABEL } from "@/data/appointments";
import { staffById } from "@/data/staff";
import { formatDate, formatTime } from "@/lib/format";
import { cn } from "@/lib/cn";
import { spring } from "@/lib/motion";
import { useRole } from "@/components/shell/role-context";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Pill } from "@/components/ui/pill";
import { StatusBadge, appointmentTone } from "@/components/ui/status";
import { Tip } from "@/components/ui/tooltip";
import { GlassCard, OrganHero, OrganImage } from "@/components/viz/organ";
import { BodyConditionCard, VitalTile, WaveSpark } from "@/components/viz/condition";
import { PeopleList, SectionLabel } from "@/components/viz/cards";
import { EVENT_ICON } from "@/features/patient/event-meta";
import { clinicalAccess } from "@/features/patient-record/access";
import { branchLabel, clinicNoOf, dayWord, isLive, upcomingVisits, type RegistryPatient, type Row } from "./data";
import { AllergyLine, FlagPills, PatientStatusBadge } from "./registry-bits";
import { HOTSPOT_ANCHORS, activityByMonth, organFit, systemHistory, teamFor } from "./anatomy";
import { ActivityBars } from "./activity-bars";
import { RowActions } from "./row-actions";

/**
 * Preview of one patient in the Browse layout. Everything is computed from the patient's own
 * record (`getRecord`): the organ is their lead body system's, the percentages are
 * `systemShares` over the last 12 months, the tiles are `latestMeasurements` with their own
 * history, and the people are the authors of their records. Patients with nothing recorded get an
 * honest empty state instead of a placeholder organ.
 */
export function BrowsePreview({
  row,
  sessionVisits,
  showBalance,
  onAssign,
  onOpenLocal,
}: {
  row: Row;
  sessionVisits: Appointment[];
  showBalance: boolean;
  onAssign: (id: string) => void;
  onOpenLocal: (id: string) => void;
}) {
  const p = row.patient;
  const record = useMemo(() => (p.local ? null : getRecord(p.id)), [p.local, p.id]);
  const recorded = !!record && record.systems.length > 0;

  return (
    <div className="@container flex flex-col gap-6">
      <IdentityCard row={row} recorded={recorded} showBalance={showBalance} onAssign={onAssign} onOpenLocal={onOpenLocal} />
      {recorded && record ? (
        <RecordedBody patient={p} record={record} />
      ) : (
        <NothingRecorded patient={p} />
      )}
      <div className="grid grid-cols-1 items-start gap-6 @[720px]:grid-cols-2">
        <TeamSection patient={p} record={recorded ? record : null} />
        <NextVisitSection row={row} sessionVisits={sessionVisits} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- identity

function IdentityCard({ row, recorded, showBalance, onAssign, onOpenLocal }: { row: Row; recorded: boolean; showBalance: boolean; onAssign: (id: string) => void; onOpenLocal: (id: string) => void }) {
  const p = row.patient;
  const titleId = useId();
  return (
    <section aria-labelledby={titleId} className="relative flex flex-col gap-4 rounded-card bg-surface p-6 @[720px]:flex-row @[720px]:items-start">
      <Avatar src={p.avatar} name={p.name} size="xl" loading="eager" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs text-muted">
          <span className="font-mono text-ink-2">{clinicNoOf(p)}</span> · {p.age} years · {p.sex} · {p.local ? "registered in this session" : `${branchLabel(p.branch)} branch`}
        </p>
        <h2 id={titleId} className="mt-1 truncate text-title font-normal text-ink">
          {p.name}
        </h2>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <PatientStatusBadge status={p.status} />
          {p.program ? (
            <Pill tone="outline" size="sm">
              {p.program}
            </Pill>
          ) : null}
          <FlagPills flags={row.flags.filter((f) => f !== "allergies")} patient={p} showBalance={showBalance} max={3} quietWhenEmpty />
        </div>
        <AllergyLine allergies={p.allergies} className="mt-3" />
      </div>
      {/* Narrow: two equal buttons under the details, menu in the corner. Wide: one row on the right. */}
      <div className="grid shrink-0 grid-cols-2 gap-2 *:w-full @[720px]:flex @[720px]:items-center @[720px]:*:w-auto">
        {p.local ? (
          <>
            <JourneyUnavailable reason="Registered in this session — there is no record to map yet." />
            <Button variant="dark" onClick={() => onOpenLocal(p.id)} trailing={<ArrowUpRight />}>
              Open record
            </Button>
          </>
        ) : recorded ? (
          <>
            <Button asChild variant="secondary">
              <Link href={`/patients/${p.id}/journey`}>
                <Path aria-hidden="true" />
                Open journey
              </Link>
            </Button>
            <Button asChild variant="dark">
              <Link href={`/patients/${p.id}`}>
                Open overview
                <ArrowUpRight aria-hidden="true" />
              </Link>
            </Button>
          </>
        ) : (
          <>
            <JourneyUnavailable reason="Nothing to map yet — the journey links documented events, and none are recorded." />
            <Button asChild variant="dark">
              <Link href={`/patients/${p.id}`}>
                Open summary
                <ArrowUpRight aria-hidden="true" />
              </Link>
            </Button>
          </>
        )}
      </div>
      <div className="absolute right-4 top-4 @[720px]:static @[720px]:-ml-2 @[720px]:mt-1">
        <RowActions patient={p} onAssign={onAssign} onOpenLocal={onOpenLocal} />
      </div>
    </section>
  );
}

/** Disabled "Open journey" that says why (focusable so keyboard users get the reason too). */
function JourneyUnavailable({ reason }: { reason: string }) {
  return (
    <Tip label={reason}>
      <span
        tabIndex={0}
        aria-disabled="true"
        className="inline-flex h-10 cursor-not-allowed items-center gap-2 rounded-full px-4 text-sm text-faint shadow-[inset_0_0_0_1px_var(--color-line)] outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        <Path size={18} aria-hidden="true" />
        Open journey
        <span className="sr-only"> — unavailable. {reason}</span>
      </span>
    </Tip>
  );
}

// ---------------------------------------------------------------- record body

function RecordedBody({ patient, record }: { patient: RegistryPatient; record: PatientRecord }) {
  const { role } = useRole();
  const [systemId, setSystemId] = useState(record.systems[0].id);
  const [conditionId, setConditionId] = useState<string | null>(null);
  const system = record.systems.find((s) => s.id === systemId) ?? record.systems[0];
  const shares = useMemo(() => systemShares(record), [record]);
  const activity = useMemo(() => activityByMonth(record, system.id), [record, system.id]);
  const first = patient.name.split(" ")[0];
  const conds = record.conditions.filter((c) => c.systemId === system.id);
  const focus = conds.find((c) => c.id === conditionId) ?? conds.find((c) => c.id === system.featuredConditionId) ?? conds[0];
  const total = shares[0]?.total ?? 0;
  const open = shares.reduce((n, s) => n + s.open, 0);

  return (
    <>
      <div className="grid grid-cols-1 items-start gap-6 @[720px]:grid-cols-2">
        <OrganPanel patientName={patient.name} system={system} conditions={conds} focus={focus} onFocus={setConditionId} />

        <section aria-label="Share of care activity by body system" className="flex flex-col gap-3">
          <SectionLabel
            className="mb-0"
            actions={
              <span className="text-xs text-muted">
                <span className="tabular text-ink-2">{total}</span> events · <span className="tabular text-ink-2">{open}</span> open
              </span>
            }
          >
            Share of care activity · 12 months
          </SectionLabel>
          {shares.map((s) => {
            const on = s.id === system.id;
            return (
              <BodyConditionCard
                key={s.id}
                icon={<OrganImage kind={s.organ} variant={on ? "color" : "grey"} className="size-9 scale-[1.3]" />}
                label={`${s.name} · ${ORGAN_LABEL[s.organ]}`}
                percent={s.percent}
                progress={{ value: s.events, max: Math.max(1, s.total) }}
                count={s.open}
                active={on}
                onClick={() => setSystemId(s.id)}
              >
                {on ? (
                  <span className="text-[11px] text-muted">
                    {s.events} of {s.total} events in the last 12 months · {s.open} open
                  </span>
                ) : null}
              </BodyConditionCard>
            );
          })}
          <p className="px-1 text-[11px] leading-relaxed text-muted">
            % = this system&apos;s share of {first}&apos;s dated events since {formatDate(`${activity.from}T00:00:00+05:30`, { day: "numeric", month: "short", year: "numeric" })}. Badge = open items (awaiting review, scheduled or draft).
            {shares.length > 1 ? " Pick a system to see its organ, conditions and readings." : ""}
          </p>
          <div className="rounded-card bg-surface p-4">
            <div className="mb-3 flex items-baseline justify-between gap-3">
              <h3 className="text-sm text-ink">Events per month</h3>
              <span className="text-xs text-muted tabular">{activity.total} in 12 months</span>
            </div>
            <ActivityBars months={activity.months} systemName={system.name} multi={shares.length > 1} />
          </div>
        </section>
      </div>

      <MeasurementsSection record={record} systemId={system.id} systemName={system.name} first={first} locked={clinicalAccess(role, patient.id) === "none"} />
    </>
  );
}

function OrganPanel({
  patientName,
  system,
  conditions,
  focus,
  onFocus,
}: {
  patientName: string;
  system: PatientRecord["systems"][number];
  conditions: Condition[];
  focus: Condition | undefined;
  onFocus: (id: string) => void;
}) {
  // Every organ is fitted to the same size and centred in the rings; hotspot anchors follow.
  const fit = organFit(system.organ);
  const anchors = HOTSPOT_ANCHORS[system.organ].map(fit.map);
  const organName = ORGAN_LABEL[system.organ];
  const first = patientName.split(" ")[0];
  return (
    <section aria-label={`${system.name} system — ${organName}`} className="flex flex-col rounded-card bg-surface p-2">
      {/* Recessed stage (ref 3): white rings read against the grey, the organ floats in them. */}
      <div className="relative isolate overflow-hidden rounded-inner bg-[radial-gradient(110%_80%_at_50%_46%,var(--color-surface)_0%,var(--color-canvas)_58%,var(--color-sunken)_100%)] px-4 pb-4 pt-4">
        <SectionLabel className="mb-1">
          {system.name} · {organName}
        </SectionLabel>
        <p className="max-w-[40ch] text-xs text-muted">
          Shown because {first}&apos;s record lists {conditions.length === 1 ? "this condition" : `these ${conditions.length} conditions`} in the {system.name.toLowerCase()} system.
        </p>
        <div className="relative -mt-2 grid">
          <AnimatePresence initial={false}>
            <motion.div
              key={system.organ}
              className="col-start-1 row-start-1"
              style={fit.vars as CSSProperties}
              initial={{ opacity: 0, scale: 0.88 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.04, transition: { duration: 0.18 } }}
              transition={spring}
            >
              <OrganHero
                kind={system.organ}
                label={`${organName} — ${system.name} conditions recorded for ${patientName}`}
                className="mx-auto max-w-[328px] [&_img]:[transform:translate(var(--organ-tx),var(--organ-ty))_scale(var(--organ-s))]"
                hotspots={conditions.map((c, i) => ({
                  id: c.id,
                  ...anchors[i % anchors.length],
                  label: c.name,
                  detail: `${c.status} · ${c.markers} linked records`,
                  active: c.id === focus?.id,
                  onClick: () => onFocus(c.id),
                }))}
              />
            </motion.div>
          </AnimatePresence>
          {focus ? (
            <GlassCard className="absolute bottom-0 left-0 w-[216px]">
              <p className="text-[11px] text-muted">Condition · {focus.status}</p>
              <p className="mt-0.5 truncate text-sm text-ink" title={focus.name}>
                {focus.name}
              </p>
              <p className="mt-1 text-[11px] text-muted">
                Since {formatDate(`${focus.since}T00:00:00+05:30`, { month: "short", year: "numeric" })} · <span className="tabular text-ink-2">{focus.markers}</span> linked records
              </p>
            </GlassCard>
          ) : null}
        </div>
      </div>
      <div role="group" aria-label="Conditions in this system" className="flex flex-wrap gap-2 px-4 pb-4 pt-4">
        {conditions.map((c) => {
          const on = c.id === focus?.id;
          return (
            <button
              key={c.id}
              type="button"
              aria-pressed={on}
              onClick={() => onFocus(c.id)}
              className={cn(
                "inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-xs transition-[background-color,color,box-shadow] duration-200",
                on ? "bg-charcoal text-white" : "bg-surface text-ink-2 shadow-[inset_0_0_0_1px_var(--color-line)] hover:text-ink hover:shadow-[inset_0_0_0_1px_var(--color-line-strong)]",
              )}
            >
              {c.name}
              <span className={on ? "text-white/60" : "text-muted"}>{c.status}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------- measurements

const shortDate = (iso: string) => formatDate(`${iso}T00:00:00+05:30`, { day: "numeric", month: "short", year: "2-digit" });

function sourceOf(e: PatientRecord["events"][number]) {
  if (e.state === "self-reported") return "Self-reported";
  if (e.type === "lab") return e.state === "awaiting-review" ? "Lab · awaiting review" : "Lab";
  return "Clinic";
}

function MeasurementsSection({ record, systemId, systemName, first, locked }: { record: PatientRecord; systemId: string; systemName: string; first: string; locked: boolean }) {
  const measures = useMemo(() => latestMeasurements(record, systemId).slice(0, 4), [record, systemId]);
  return (
    <section aria-label={`Latest measurements — ${systemName}`}>
      <SectionLabel>Latest measurements · {systemName}</SectionLabel>
      {locked ? (
        <div className="flex items-start gap-3 rounded-card bg-surface p-6">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-sunken text-muted">
            <LockSimple size={18} aria-hidden="true" />
          </span>
          <p className="text-sm text-muted">
            Readings and lab values are visible to the care team. Your role routes records — registration, scheduling and activity — without reading clinical values.
          </p>
        </div>
      ) : measures.length ? (
        <div className="grid grid-cols-1 gap-3 @[720px]:grid-cols-2">
          {measures.map((m) => {
            const history = systemHistory(record, systemId, m.label);
            const Icon = EVENT_ICON[m.event.type];
            const flag = m.flag === "high" ? "Above target" : m.flag === "low" ? "Below target" : null;
            return (
              <VitalTile
                key={m.label}
                icon={<Icon />}
                label={`${m.label} · ${sourceOf(m.event)}`}
                value={
                  <>
                    <span className="tabular">{m.value}</span>
                    {m.unit ? <span className="ml-1 text-xs text-muted">{m.unit}</span> : null}
                    {flag ? <span className="ml-2 text-xs text-warning">{flag}</span> : null}
                  </>
                }
                chart={
                  history.length > 1 ? (
                    <WaveSpark
                      values={history.map((h) => h.value)}
                      label={`${m.label}: ${history.length} readings from ${shortDate(history[0].date)} (${history[0].value}) to ${shortDate(history[history.length - 1].date)} (${history[history.length - 1].value})`}
                    />
                  ) : (
                    <span className="flex h-full items-center text-xs text-muted">First reading — no trend yet</span>
                  )
                }
                aside={
                  <span className="flex shrink-0 flex-col items-end self-end pb-3 text-right text-[11px] leading-tight text-muted">
                    <span className="text-ink-2">{shortDate(m.event.date)}</span>
                    <span>
                      <span className="tabular">{history.length}</span> {history.length === 1 ? "reading" : "readings"}
                    </span>
                  </span>
                }
              />
            );
          })}
          <p className="px-1 text-[11px] leading-relaxed text-muted @[720px]:col-span-2">
            Line = every reading of that value in {first}&apos;s {systemName.toLowerCase()} record, oldest → newest. Targets come from the condition&apos;s monitoring plan.
          </p>
        </div>
      ) : (
        <p className="rounded-card bg-surface p-6 text-sm text-muted">No structured measurements are recorded for the {systemName.toLowerCase()} system yet.</p>
      )}
    </section>
  );
}

// ---------------------------------------------------------------- care team

function TeamSection({ patient, record }: { patient: RegistryPatient; record: PatientRecord | null }) {
  const team = useMemo(() => teamFor(record, patient.careTeam), [record, patient.careTeam]);
  const [personId, setPersonId] = useState<string | undefined>(undefined);
  const person = team.find((t) => t.id === personId) ?? team[0];
  const first = patient.name.split(" ")[0];
  return (
    <section aria-label="Care team">
      <SectionLabel>Care team · records authored</SectionLabel>
      {team.length ? (
        <>
          <PeopleList selected={person?.id} onSelect={setPersonId} people={team.map((t) => ({ id: t.id, name: t.name, role: t.role, avatar: t.avatar, count: t.count }))} />
          {person ? (
            <p className="mt-3 px-1 text-xs text-muted" aria-live="polite">
              <span className="text-ink-2">{person.name}</span>{" "}
              {person.count ? (
                <>
                  authored <span className="tabular text-ink-2">{person.count}</span> of {first}&apos;s records
                  {person.latest ? (
                    <>
                      {" "}
                      · latest “{person.latest.title}”, {shortDate(person.latest.date)}
                    </>
                  ) : null}
                </>
              ) : (
                <>is on the care team and hasn&apos;t authored a record yet.</>
              )}
            </p>
          ) : null}
        </>
      ) : (
        <p className="rounded-card bg-surface p-6 text-sm text-muted">No care team assigned and nobody has authored a record for {first} yet.</p>
      )}
    </section>
  );
}

// ---------------------------------------------------------------- next appointment

function NextVisitSection({ row, sessionVisits }: { row: Row; sessionVisits: Appointment[] }) {
  const p = row.patient;
  const upcoming = useMemo(() => upcomingVisits(p, sessionVisits), [p, sessionVisits]);
  const [index, setIndex] = useState(0);
  const at = Math.min(index, Math.max(0, upcoming.length - 1));
  const v = upcoming[at] ?? null;
  const staff = v ? staffById(v.staffId ?? undefined) : undefined;
  const live = v ? isLive(v) : false;
  const step = "flex size-8 items-center justify-center rounded-full text-ink-2 transition-colors hover:bg-surface hover:text-ink disabled:pointer-events-none disabled:text-faint";
  return (
    <section aria-label="Next appointment">
      <SectionLabel actions={upcoming.length > 1 ? <span className="text-xs text-muted tabular">{upcoming.length} booked</span> : undefined}>{at === 0 ? "Next appointment" : "Upcoming appointment"}</SectionLabel>
      <div className="flex flex-col gap-4 rounded-card bg-surface p-6">
        {upcoming.length > 1 ? (
          // Ref 3 schedule-card stepper: walk through this patient's own bookings, soonest first.
          <div className="flex items-center justify-between rounded-full bg-sunken p-1">
            <button type="button" className={step} aria-label="Earlier booking" disabled={at === 0} onClick={() => setIndex(at - 1)}>
              <ArrowLeft size={14} />
            </button>
            <span className="text-xs text-ink-2" aria-live="polite">
              Booking <span className="tabular">{at + 1}</span> of <span className="tabular">{upcoming.length}</span>
            </span>
            <button type="button" className={step} aria-label="Later booking" disabled={at === upcoming.length - 1} onClick={() => setIndex(at + 1)}>
              <ArrowRight size={14} />
            </button>
          </div>
        ) : null}
        <div className="flex items-center gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-sunken text-ink-2" aria-hidden="true">
            <CalendarBlank size={18} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-xs text-muted">{v ? (live ? "In the clinic now" : at === 0 ? "Booked · next" : "Booked") : "Not booked"}</p>
            <p className="truncate text-sm text-ink">
              {v ? (
                <>
                  {dayWord(v.start)} · <span className="tabular">{formatTime(v.start)}</span>
                </>
              ) : row.last ? (
                `Last visit ${formatDate(row.last, { day: "numeric", month: "short" })}`
              ) : (
                "No visits yet"
              )}
            </p>
          </div>
          {v && live ? <StatusBadge tone={appointmentTone(v.status)}>{APPOINTMENT_STATUS_LABEL[v.status]}</StatusBadge> : null}
        </div>
        {v ? (
          <div className="rounded-inner bg-canvas p-4">
            <p className="text-sm text-ink">{v.service ?? "Booked visit"}</p>
            <p className="mt-0.5 text-xs text-muted">
              {[v.durationMin ? `${v.durationMin} min` : null, v.room, v.source === "session" ? "held in this session" : v.source === "record" ? "from the patient record" : null].filter(Boolean).join(" · ") || "Details are in the schedule"}
            </p>
            {staff ? (
              <p className="mt-3 flex items-center gap-2 text-xs text-ink-2">
                <Avatar src={staff.avatar} name={staff.name} size="xs" />
                {staff.name}
              </p>
            ) : null}
          </div>
        ) : null}
        <div className="flex flex-wrap gap-2">
          {v ? (
            <Button asChild variant="secondary" size="sm">
              <Link href="/schedule">
                Open schedule
                <ArrowUpRight aria-hidden="true" />
              </Link>
            </Button>
          ) : null}
          <Button asChild variant={v ? "ghost" : "dark"} size="sm">
            <Link href={`/schedule?new=1&patient=${p.id}`}>
              <CalendarPlus aria-hidden="true" />
              {v ? "Book another" : "Book appointment"}
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------- nothing recorded

function NothingRecorded({ patient }: { patient: RegistryPatient }) {
  const first = patient.name.split(" ")[0];
  const unmapped = patient.conditions.length > 0;
  return (
    <section aria-label="Nothing recorded yet" className="grid grid-cols-1 gap-6 rounded-card bg-surface p-6 @[720px]:grid-cols-[208px_minmax(0,1fr)] @[720px]:items-center">
      <div className="relative mx-auto flex size-[208px] items-center justify-center" aria-hidden="true">
        <span className="absolute inset-0 rounded-full border border-dashed border-line-strong" />
        <span className="absolute inset-[18%] rounded-full bg-canvas" />
        <span className="relative max-w-[12ch] text-center text-xs text-muted">No organ to show yet</span>
      </div>
      <div className="min-w-0">
        <p className="text-xs text-muted">Nothing recorded yet</p>
        <h3 className="mt-1 text-lg font-normal text-ink">{unmapped ? `${first}'s conditions aren't mapped to a body system yet` : `No conditions recorded for ${first}`}</h3>
        <p className="mt-2 max-w-[60ch] text-sm text-muted">
          The organ, body-system shares, readings and journey are computed from recorded conditions and dated events — nothing is drawn as a placeholder. They appear here after a clinician records a condition in a signed consultation.
          {patient.local ? " This registration exists only in this browser session." : ""}
        </p>
        <div className="mt-4 rounded-inner bg-canvas p-4">
          <p className="text-xs text-muted">Primary concern · from registration</p>
          <p className="mt-1 text-sm text-ink">{patient.primaryConcern || "Not given"}</p>
          {unmapped ? <p className="mt-2 text-xs text-ink-2">Recorded: {patient.conditions.join(", ")}</p> : null}
        </div>
      </div>
    </section>
  );
}

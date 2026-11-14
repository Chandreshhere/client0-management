"use client";

import Link from "next/link";
import { useId, useMemo, useState, type FormEvent } from "react";
import { ArrowUpRight, BowlFood, CalendarBlank, ChatCircleDots, Clock, ClipboardText, Heartbeat, PersonSimpleTaiChi } from "@phosphor-icons/react";
import { cn } from "@/lib/cn";
import { formatDate, formatTime, pluralize } from "@/lib/format";
import { useRole } from "@/components/shell/role-context";
import { Avatar, AvatarStack } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input } from "@/components/ui/input";
import { Popover, PopoverClose, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Segmented } from "@/components/ui/segmented";
import { StatusBadge } from "@/components/ui/status";
import { useToast } from "@/components/ui/toast";
import { staffById } from "@/data/staff";
import { patientById } from "@/data/patients";
import { TODAY_APPOINTMENTS } from "@/data/appointments";
import { CARE_EVENTS, CARE_PLAN, EVENT_TYPE_LABEL, type CareEvent } from "@/data/featured";
import { THREADS } from "@/data/records";
import { NOW_LABEL, NOW_MIN, PATIENT_TODAY, PREPARE_ITEMS, istMinutes, shortDate, splitMedicines, untilLabel, whenLabel } from "./data";
import { DashGrid, DashboardHeader, FocalCard, FocalHead, FocalInset, FocalStat, InsetList, ListRow, Panel, Rail, Reveal } from "./ui";

/**
 * Patient app home (Pro) — my appointments, my plan for today (meals logged as self-reported),
 * home readings, the records my care team has released, and messages. Nothing unreleased is
 * shown or hinted at; everything entered here is saved in this browser and labelled self-reported.
 */

/** What a patient may see of their own record: released, reviewed, not a draft, not just planned. */
const visibleToPatient = (e: CareEvent) => e.released && e.state !== "awaiting-review" && e.state !== "draft" && e.state !== "scheduled";

type MealLog = "as-planned" | "partly" | "skipped";
const MEAL_LOG: { value: MealLog; label: string }[] = [
  { value: "as-planned", label: "As planned" },
  { value: "partly", label: "Partly" },
  { value: "skipped", label: "Skipped" },
];

export function PatientHome() {
  const { user } = useRole();
  const me = patientById(user.id)!;
  const mine = TODAY_APPOINTMENTS.filter((a) => a.patientId === me.id && a.status !== "cancelled").sort((a, b) => a.start.localeCompare(b.start));
  const next = mine.find((a) => istMinutes(a.start) > NOW_MIN) ?? null;
  const later = next ? mine.filter((a) => istMinutes(a.start) > istMinutes(next.start)) : [];
  const unread = THREADS.filter((t) => t.participants.includes(me.id) && t.channel === "patient" && t.unread > 0).length;

  return (
    <div className="flex flex-col gap-6">
      <DashboardHeader
        summary={`${next ? `${next.service.split(" · ")[0]} at ${formatTime(next.start)}` : "No more visits today"}${later.length ? ` · then ${pluralize(later.length, "more visit")}` : ""} · plan v4 for today · ${unread ? `${pluralize(unread, "message")} awaiting a reply` : "no messages waiting"}`}
        actions={
          <>
            <Button asChild variant="dark">
              <Link href="/messages?new=1">
                <ChatCircleDots />
                Message the team
              </Link>
            </Button>
            <Button asChild variant="secondary">
              <Link href="/portal/appointments">
                <CalendarBlank />
                My appointments
              </Link>
            </Button>
          </>
        }
      />

      <DashGrid>
        <Reveal index={0} className="lg:col-span-2">
          {next ? <NextAppointmentCard apptId={next.id} later={later.map((a) => a.id)} /> : <NoVisitCard />}
        </Reveal>

        <Reveal index={1} className="lg:col-span-2">
          <TodayPlan />
        </Reveal>

        <Reveal index={2} className="lg:col-span-2">
          <ReadingsPanel patientId={me.id} />
        </Reveal>

        {/* Side rail: placed in column 3 at xl, but last in reading order on phones (today's plan comes first). */}
        <Rail index={3} className="lg:col-span-2 xl:col-span-1 xl:col-start-3 xl:row-span-3 xl:row-start-1">
          <RecordsPanel patientId={me.id} />
          <MessagesPanel patientId={me.id} />
        </Rail>
      </DashGrid>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------
// Focal: next appointment + how to prepare
// ---------------------------------------------------------------------------------------------

function NextAppointmentCard({ apptId, later }: { apptId: string; later: string[] }) {
  const id = useId();
  const appt = TODAY_APPOINTMENTS.find((a) => a.id === apptId)!;
  const clinician = staffById(appt.staffId);
  const [ready, setReady] = useState<Record<string, boolean>>({});
  const done = PREPARE_ITEMS.filter((i) => ready[i.id]).length;
  const { medicines } = splitMedicines(CARE_PLAN.medical.text);

  return (
    <FocalCard labelledBy={id} className="h-full">
      <FocalHead
        id={id}
        label="Your next appointment"
        title={appt.service}
        meta={
          <span className="flex items-center gap-2">
            <Avatar src={clinician?.avatar} name={clinician?.name ?? ""} size="xs" className="bg-white" />
            <span className="min-w-0">
              {clinician?.name} · {clinician?.title.split(" · ")[0]} · {appt.room}
            </span>
          </span>
        }
        aside={<FocalStat value={formatTime(appt.start)} caption={untilLabel(appt.start)} />}
      />

      <div className="grid grid-cols-1 gap-2 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <FocalInset>
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-ink">How to prepare</p>
            <span className="text-xs text-muted tabular" aria-live="polite">
              {done} of {PREPARE_ITEMS.length} ready
            </span>
          </div>
          <ul className="mt-3 flex flex-col gap-1">
            {PREPARE_ITEMS.map((item) => {
              const checked = !!ready[item.id];
              const detail = item.id === "meds" ? medicines.map((m) => m.split(" ")[0]).join(", ") : item.detail;
              return (
                <li key={item.id}>
                  <label className="flex cursor-pointer items-start gap-3 rounded-[12px] p-2 transition-colors hover:bg-canvas">
                    <Checkbox checked={checked} onCheckedChange={(v) => setReady((s) => ({ ...s, [item.id]: v === true }))} className="mt-0.5" aria-label={item.label} />
                    <span className="min-w-0">
                      <span className={cn("block text-sm transition-colors", checked ? "text-muted line-through" : "text-ink")}>{item.label}</span>
                      {detail ? <span className="block text-xs text-muted">{detail}</span> : null}
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
        </FocalInset>
        <div className="flex flex-col gap-2">
          {later.map((lid) => {
            const a = TODAY_APPOINTMENTS.find((x) => x.id === lid)!;
            const s = staffById(a.staffId);
            return (
              <FocalInset key={lid} className="flex items-start gap-3">
                <Avatar src={s?.avatar} name={s?.name ?? ""} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-muted">Then at {formatTime(a.start)}</p>
                  <p className="truncate text-sm text-ink">{a.service}</p>
                  <p className="truncate text-xs text-muted">
                    {s?.name} · {a.room}
                  </p>
                </div>
              </FocalInset>
            );
          })}
          <FocalInset className="flex flex-1 items-start gap-3">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-sunken text-ink-2" aria-hidden="true">
              <CalendarBlank size={16} />
            </span>
            <div className="min-w-0">
              <p className="text-sm text-ink">{CARE_PLAN.nextReview.label}</p>
              <p className="text-xs text-muted">
                {formatDate(CARE_PLAN.nextReview.at, { weekday: "short", day: "numeric", month: "short" })} · {staffById(CARE_PLAN.nextReview.with)?.name}
              </p>
            </div>
          </FocalInset>
        </div>
      </div>

      <div className="mt-auto flex flex-wrap items-center gap-2 p-4 pt-2">
        <Button asChild variant="secondary" className="shadow-none">
          <Link href="/portal/appointments">
            <CalendarBlank />
            View appointment
          </Link>
        </Button>
        <Button asChild variant="glass">
          <Link href="/portal/appointments">
            Ask to reschedule
            <ArrowUpRight />
          </Link>
        </Button>
        <p className="ml-auto flex items-center gap-1.5 text-xs text-white">
          <Clock size={16} aria-hidden="true" />
          Check in at reception from {formatTime(new Date(Date.parse(appt.start) - 15 * 60_000).toISOString())}
        </p>
      </div>
    </FocalCard>
  );
}

function NoVisitCard() {
  const id = useId();
  return (
    <FocalCard labelledBy={id} className="h-full">
      <FocalHead id={id} label="Your appointments" title="No more visits today" meta={`${CARE_PLAN.nextReview.label} · ${shortDate(CARE_PLAN.nextReview.at)}`} />
      <div className="mt-auto flex p-4 pt-2">
        <Button asChild variant="secondary" className="shadow-none">
          <Link href="/portal/appointments">My appointments</Link>
        </Button>
      </div>
    </FocalCard>
  );
}

// ---------------------------------------------------------------------------------------------
// Today from my plan — meals logged against the plan (self-reported), practice checked off
// ---------------------------------------------------------------------------------------------

function TodayPlan() {
  const { toast } = useToast();
  const [logs, setLogs] = useState<Record<string, MealLog>>({});
  const [practice, setPractice] = useState<Record<string, boolean>>({ class: true });
  const meals = PATIENT_TODAY.filter((i) => i.kind === "meal");
  const logged = meals.filter((m) => logs[m.id]).length;

  return (
    <Panel
      icon={<BowlFood />}
      title="Today from my plan"
      subtitle={`Plan v4 · ${logged} of ${meals.length} meals logged`}
      href="/portal/plan"
      actionLabel="Open my plan"
      className="h-full"
    >
      <ul className="flex flex-col rounded-inner bg-surface p-2">
        {PATIENT_TODAY.map((item) => {
          const Icon = item.kind === "meal" ? BowlFood : PersonSimpleTaiChi;
          return (
            <li key={item.id} className="@container rounded-[12px] p-2">
              <div className="flex flex-col gap-2 @md:flex-row @md:items-center">
                <span className="flex min-w-0 flex-1 items-start gap-3">
                  <span className="w-10 shrink-0 pt-0.5 text-xs text-muted tabular">{item.at}</span>
                  <span className="min-w-0">
                    <span className="flex items-center gap-1.5 text-sm text-ink">
                      <Icon size={16} className="shrink-0 text-muted" aria-hidden="true" />
                      {item.label}
                    </span>
                    <span className="block text-xs text-muted">{item.kind === "meal" && logs[item.id] ? `${MEAL_LOG.find((m) => m.value === logs[item.id])?.label} · self-reported` : item.detail}</span>
                  </span>
                </span>
                {item.kind === "meal" ? (
                  <Segmented
                    items={MEAL_LOG}
                    value={logs[item.id] ?? ("" as MealLog)}
                    onChange={(v) => {
                      setLogs((s) => ({ ...s, [item.id]: v }));
                      toast({ title: `${item.label} logged · ${MEAL_LOG.find((m) => m.value === v)?.label.toLowerCase()}`, description: "Saved in this browser and marked self-reported until Meera reviews it." });
                    }}
                    ariaLabel={`Log ${item.label.toLowerCase()}`}
                    size="sm"
                    variant="tray"
                    className="ml-[52px] self-start @md:ml-0 @md:self-auto"
                  />
                ) : item.recordedBy ? (
                  <StatusBadge tone="success" className="ml-[52px] self-start @md:ml-0 @md:self-auto">
                    Done
                  </StatusBadge>
                ) : (
                  <label className="ml-[52px] flex items-center gap-2 self-start text-xs text-ink-2 @md:ml-0 @md:self-auto">
                    <Checkbox checked={!!practice[item.id]} onCheckedChange={(v) => setPractice((s) => ({ ...s, [item.id]: v === true }))} aria-label={`Mark ${item.label} done`} />
                    Done
                  </label>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}

// ---------------------------------------------------------------------------------------------
// Home readings (self-reported until a practitioner reviews them)
// ---------------------------------------------------------------------------------------------

function ReadingsPanel({ patientId }: { patientId: string }) {
  const { toast } = useToast();
  const [readings, setReadings] = useState<{ sys: number; dia: number; at: string }[]>([]);
  const latest = useMemo(() => CARE_EVENTS.filter((e) => e.authorId === patientId && e.state === "self-reported" && e.type === "vitals").sort((a, b) => b.date.localeCompare(a.date))[0], [patientId]);
  const task = CARE_PLAN.actions.find((a) => a.owner === patientId && a.status !== "done");

  return (
    <Panel icon={<Heartbeat />} title="Home readings" subtitle={task ? `${task.label} · due ${shortDate(task.due)}` : "Blood pressure, sugar and weight"} href="/portal/records" actionLabel="Open my records" className="h-full">
      <ul className="flex flex-col rounded-inner bg-surface p-2">
        {readings.map((r, i) => (
          <ListRow key={i} lead={<span className="w-10 shrink-0 pt-0.5 text-xs text-muted tabular">{r.at}</span>} title={`${r.sys}/${r.dia} mmHg`} meta="Blood pressure · today · saved in this browser" trailing={<StatusBadge tone="neutral">Self-reported</StatusBadge>} />
        ))}
        {latest ? (
          <ListRow
            href="/portal/records"
            lead={<span className="w-10 shrink-0 pt-0.5 text-xs text-muted tabular">{shortDate(latest.date)}</span>}
            title={latest.title.replace(/\s*\(self-reported\)/i, "")}
            meta={latest.summary.replace(/\.$/, "")}
            trailing={<StatusBadge tone="neutral">Self-reported</StatusBadge>}
          />
        ) : null}
      </ul>
      <div className="flex flex-wrap items-center justify-between gap-2 px-2 pb-1 pt-1">
        <p className="text-xs text-muted">Your care team reviews these; until then they stay marked self-reported.</p>
        <BpLogger
          onSave={(sys, dia) => {
            setReadings((xs) => [{ sys, dia, at: NOW_LABEL }, ...xs]);
            toast({ tone: "success", title: `Blood pressure logged · ${sys}/${dia}`, description: "Saved in this browser session and labelled self-reported — nothing was sent." });
          }}
        />
      </div>
    </Panel>
  );
}

function BpLogger({ onSave }: { onSave: (sys: number, dia: number) => void }) {
  const [open, setOpen] = useState(false);
  const [sys, setSys] = useState("");
  const [dia, setDia] = useState("");
  const [errors, setErrors] = useState<{ sys?: string; dia?: string }>({});

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const s = Number(sys);
    const d = Number(dia);
    const next = {
      sys: !sys ? "Enter the top number" : !Number.isFinite(s) || s < 70 || s > 250 ? "Between 70 and 250" : undefined,
      dia: !dia ? "Enter the bottom number" : !Number.isFinite(d) || d < 40 || d > 150 ? "Between 40 and 150" : d >= s ? "Should be lower than the top number" : undefined,
    };
    setErrors(next);
    if (next.sys || next.dia) return;
    onSave(s, d);
    setSys("");
    setDia("");
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button size="sm" variant="dark" className="shrink-0">
          Log a reading
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[min(320px,calc(100vw-32px))] p-4">
        <form onSubmit={submit} noValidate className="flex flex-col gap-4">
          <div>
            <p className="text-sm text-ink">Today&apos;s blood pressure</p>
            <p className="text-xs text-muted">Sit for 5 minutes first. Saved as self-reported.</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Top (systolic)" error={errors.sys}>
              {(f) => <Input {...f} inputMode="numeric" value={sys} onChange={(e) => setSys(e.target.value.replace(/\D/g, "").slice(0, 3))} placeholder="126" autoFocus />}
            </Field>
            <Field label="Bottom (diastolic)" error={errors.dia}>
              {(f) => <Input {...f} inputMode="numeric" value={dia} onChange={(e) => setDia(e.target.value.replace(/\D/g, "").slice(0, 3))} placeholder="80" />}
            </Field>
          </div>
          <div className="flex justify-end gap-2">
            <PopoverClose asChild>
              <Button size="sm" variant="ghost" type="button">
                Cancel
              </Button>
            </PopoverClose>
            <Button size="sm" variant="dark" type="submit">
              Save reading
            </Button>
          </div>
        </form>
      </PopoverContent>
    </Popover>
  );
}

// ---------------------------------------------------------------------------------------------
// Records released to me (plus my own entries)
// ---------------------------------------------------------------------------------------------

function RecordsPanel({ patientId }: { patientId: string }) {
  const records = CARE_EVENTS.filter((e) => visibleToPatient(e) && e.authorId !== patientId)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 4);
  return (
    <Panel icon={<ClipboardText />} title="My records" subtitle="Released to you by your care team" href="/portal/records" actionLabel="Open my records">
      <InsetList label="Latest released records">
        {records.map((e) => {
          const by = staffById(e.authorId);
          return (
            <ListRow
              key={e.id}
              href="/portal/records"
              lead={<span className="w-12 shrink-0 pt-0.5 text-xs text-muted tabular">{shortDate(e.date)}</span>}
              title={e.title}
              meta={`${EVENT_TYPE_LABEL[e.type]}${by ? ` · ${by.name}` : ""}`}
            />
          );
        })}
      </InsetList>
    </Panel>
  );
}

// ---------------------------------------------------------------------------------------------
// Messages with expected response times
// ---------------------------------------------------------------------------------------------

function MessagesPanel({ patientId }: { patientId: string }) {
  const threads = THREADS.filter((t) => t.participants.includes(patientId) && t.channel === "patient").sort((a, b) => b.lastAt.localeCompare(a.lastAt));
  return (
    <Panel icon={<ChatCircleDots />} title="Messages" subtitle="Replies within 1 working day" href="/messages" actionLabel="Open messages">
      {threads.map((t) => {
        const staff = t.participants
          .filter((p) => p !== patientId)
          .map((sid) => staffById(sid))
          .filter((s) => !!s);
        const awaitingReply = t.unread > 0;
        return (
          <Link key={t.id} href="/messages" className="block rounded-inner bg-surface p-4 transition-colors hover:bg-canvas">
            <span className="flex items-start justify-between gap-3">
              <span className="min-w-0">
                <span className="block truncate text-sm text-ink">{t.subject}</span>
                <span className="block text-xs text-muted">{whenLabel(t.lastAt)}</span>
              </span>
              <AvatarStack people={staff.map((s) => ({ name: s.name, avatar: s.avatar }))} size="xs" />
            </span>
            <span className="mt-2 block text-sm text-ink-2">
              {awaitingReply ? "You: " : `${staff[0]?.name.split(" ")[0] ?? "Team"}: `}“{t.lastMessage}”
            </span>
            <span className="mt-3 block">{awaitingReply ? <StatusBadge tone="warning">Awaiting reply · {t.expectedResponse.replace(/^Reply\s+/i, "")}</StatusBadge> : <StatusBadge tone="success">Answered</StatusBadge>}</span>
          </Link>
        );
      })}
    </Panel>
  );
}

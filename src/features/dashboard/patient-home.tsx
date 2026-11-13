"use client";

import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { useId, useMemo, useState, type FormEvent } from "react";
import {
  ArrowUpRight,
  BowlFood,
  CalendarBlank,
  ChatCircleDots,
  CheckCircle,
  Clock,
  FileArrowUp,
  Heartbeat,
  Lock,
  PersonSimpleTaiChi,
  Receipt,
  Stethoscope,
} from "@phosphor-icons/react";
import { cn } from "@/lib/cn";
import { snappy } from "@/lib/motion";
import { formatDate, formatINR, formatTime, pluralize } from "@/lib/format";
import { useRole } from "@/components/shell/role-context";
import { Avatar, AvatarStack } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Field, Input, Checkbox } from "@/components/ui/input";
import { ProgressBar, ProgressRing } from "@/components/ui/misc";
import { Popover, PopoverClose, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { StatusBadge, invoiceTone } from "@/components/ui/status";
import { useToast } from "@/components/ui/toast";
import { staffById } from "@/data/staff";
import { patientById } from "@/data/patients";
import { TODAY_APPOINTMENTS } from "@/data/appointments";
import { CARE_EVENTS, CARE_PLAN } from "@/data/featured";
import { PACKAGES } from "@/data/programs";
import { getRecord } from "@/data/record";
import { INVOICES, INVOICE_STATUS_LABEL, THREADS } from "@/data/records";
import { NOW_LABEL, NOW_MIN, PATIENT_TODAY, PREPARE_ITEMS, daysSince, istMinutes, shortDate, splitMedicines, untilLabel, whenLabel } from "./data";
import { DashboardHeader, FocalCard, FocalHead, Panel, Reveal } from "./ui";
import { ConditionTiles, ConditionsHero, SystemsCarousel, VisitsCard } from "./patient-conditions";

/**
 * Patient home (doc §3B): my next appointment, my current plan, what I should do today and how
 * I contact the team. Everything the patient enters here is saved locally and labelled
 * self-reported; nothing is sent from the demo.
 */
export function PatientHome() {
  const { user } = useRole();
  const me = patientById(user.id)!;
  const record = useMemo(() => getRecord(me.id), [me.id]);
  const [systemId, setSystemId] = useState<string>(record?.systems[0]?.id ?? "");
  const [conditionId, setConditionId] = useState<string | null>(null);
  const system = record?.systems.find((s) => s.id === systemId) ?? record?.systems[0] ?? null;
  const mine = TODAY_APPOINTMENTS.filter((a) => a.patientId === me.id && a.status !== "cancelled").sort((a, b) => a.start.localeCompare(b.start));
  const next = mine.find((a) => istMinutes(a.start) > NOW_MIN) ?? null;
  const pkg = PACKAGES.find((p) => p.patientId === me.id);

  return (
    <div className="flex flex-col gap-8">
      <DashboardHeader
        summary={`${next ? `Your ${next.service.split(" · ")[0]} is at ${formatTime(next.start)}` : "No more visits today"} · ${pluralize(mine.length, "appointment")} today · ${me.balanceDue ? `${formatINR(me.balanceDue)} to pay` : "nothing to pay"}`}
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

      {/*
        Reference 3 on top (organ hero · my condition tiles · my schedule · my body systems), then
        today's visit and checklist. DOM order is the phone reading order; xl places the blocks.
      */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-12">
        {record && system ? (
          <Reveal index={0} className="md:col-span-2 xl:col-span-5 xl:col-start-1 xl:row-span-2 xl:row-start-1">
            <ConditionsHero
              record={record}
              system={system}
              activeConditionId={conditionId}
              onCondition={setConditionId}
              className="h-full"
            />
          </Reveal>
        ) : null}

        <Reveal index={1} className="md:col-span-2 xl:col-span-8 xl:col-start-1 xl:row-start-3">
          {next ? <NextAppointmentCard apptId={next.id} later={mine.filter((a) => a.id !== next.id && istMinutes(a.start) > istMinutes(next.start)).map((a) => a.id)} /> : null}
        </Reveal>

        <Reveal index={2} className="xl:col-span-4 xl:col-start-9 xl:row-start-3">
          <TodayChecklist />
        </Reveal>

        {record ? (
          <Reveal index={3} className="xl:col-span-4 xl:col-start-6 xl:row-start-1">
            <ConditionTiles record={record} />
          </Reveal>
        ) : null}

        <Reveal index={4} className="xl:col-span-3 xl:col-start-10 xl:row-start-1">
          <VisitsCard patientId={me.id} />
        </Reveal>

        {record && system ? (
          <Reveal index={5} className="min-w-0 md:col-span-2 xl:col-span-7 xl:col-start-6 xl:row-start-2">
            <SystemsCarousel
              record={record}
              selectedId={system.id}
              onSelect={(id) => {
                setSystemId(id);
                setConditionId(null);
              }}
            />
          </Reveal>
        ) : null}

        <Reveal index={6} className="xl:col-span-4 xl:row-start-4">
          <PlanPanel />
        </Reveal>

        <Reveal index={7} className="xl:col-span-4 xl:row-start-4">
          <MessagesPanel patientId={me.id} />
        </Reveal>

        <Reveal index={8} className="flex flex-col gap-4 md:col-span-2 xl:col-span-4 xl:row-start-4">
          <Panel icon={<Receipt />} title="Billing & sessions" subtitle={me.balanceDue ? `${formatINR(me.balanceDue)} to pay` : "Nothing to pay"} href="/portal/billing" actionLabel="Open billing">
            {pkg ? (
              <div className="rounded-inner bg-surface p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm text-ink">{pkg.name}</p>
                    <p className="text-xs text-muted">Expires {formatDate(pkg.expires, { day: "numeric", month: "short" })} · in {pluralize(-daysSince(pkg.expires), "day")}</p>
                  </div>
                  <p className="shrink-0 text-right">
                    <span className="block text-title font-light leading-none text-ink">{pkg.total - pkg.used}</span>
                    <span className="text-xs text-muted">left</span>
                  </p>
                </div>
                <ProgressBar value={pkg.used} max={pkg.total} tone="dark" className="mt-4" label={`${pkg.used} of ${pkg.total} sessions used`} />
                <p className="mt-2 text-xs text-muted">
                  {pkg.used} of {pkg.total} sessions used
                </p>
              </div>
            ) : null}
            {INVOICES.filter((i) => i.patientId === me.id).map((i) => (
              <Link key={i.id} href="/portal/billing" className="flex items-center gap-3 rounded-inner bg-surface p-4 transition-colors hover:bg-canvas">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm text-ink">{i.items[0]?.label}</span>
                  <span className="block text-xs text-muted">
                    <span className="font-mono">{i.number}</span> · {shortDate(i.issuedAt)} · {i.method}
                  </span>
                </span>
                <span className="shrink-0 text-right">
                  <span className="block text-sm text-ink tabular">{formatINR(i.total)}</span>
                  <StatusBadge tone={invoiceTone(i.status)} className="h-5 px-2 text-[11px]">
                    {INVOICE_STATUS_LABEL[i.status]}
                  </StatusBadge>
                </span>
              </Link>
            ))}
          </Panel>

          <section aria-labelledby="upload-cta" className="flex flex-col gap-4 rounded-card bg-surface p-6">
            <span className="flex size-10 items-center justify-center rounded-full bg-sunken text-ink" aria-hidden="true">
              <FileArrowUp size={20} />
            </span>
            <div>
              <h2 id="upload-cta" className="text-lg font-normal tracking-[-0.01em] text-ink">
                Got a new report?
              </h2>
              <p className="mt-1 text-sm text-muted">Add the date of the test when you upload — we keep it separate from the upload date, and your doctor reviews it before it joins your record.</p>
            </div>
            <Button asChild variant="secondary" className="self-start">
              <Link href="/portal/records">
                <FileArrowUp />
                Upload a report
              </Link>
            </Button>
          </section>
        </Reveal>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------
// Focal: next appointment + how to prepare
// ---------------------------------------------------------------------------------------------

function NextAppointmentCard({ apptId, later }: { apptId: string; later: string[] }) {
  const id = useId();
  const appt = TODAY_APPOINTMENTS.find((a) => a.id === apptId)!;
  const doctor = staffById(appt.staffId);
  const [ready, setReady] = useState<Record<string, boolean>>({});
  const done = PREPARE_ITEMS.filter((i) => ready[i.id]).length;
  const { medicines } = splitMedicines(CARE_PLAN.medical.text);
  // A report the clinician hasn't released yet: say it exists, never show its values.
  const pending = CARE_EVENTS.find((e) => e.state === "awaiting-review" && !e.released);

  return (
    <FocalCard labelledBy={id} className="h-full">
      <FocalHead
        id={id}
        label="Your next appointment"
        title={appt.service}
        meta={
          <span className="flex items-center gap-2">
            <Avatar src={doctor?.avatar} name={doctor?.name ?? ""} size="xs" className="bg-white" />
            <span className="min-w-0">
              {doctor?.name} · {doctor?.title.split(" · ")[0]} · {appt.room}
            </span>
          </span>
        }
        aside={
          <div className="text-right">
            <p className="text-title font-normal tabular">{formatTime(appt.start)}</p>
            <p className="text-xs text-white/90">{untilLabel(appt.start)}</p>
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-2 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <div className="rounded-inner bg-surface p-4 text-ink">
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
        </div>
        <div className="flex flex-col gap-2">
          {later.map((lid) => {
            const a = TODAY_APPOINTMENTS.find((x) => x.id === lid)!;
            const s = staffById(a.staffId);
            return (
              <div key={lid} className="flex items-start gap-3 rounded-inner bg-surface p-4 text-ink">
                <Avatar src={s?.avatar} name={s?.name ?? ""} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-muted">Then at {formatTime(a.start)}</p>
                  <p className="truncate text-sm text-ink">{a.service}</p>
                  <p className="truncate text-xs text-muted">
                    {s?.name} · {a.room}
                  </p>
                </div>
              </div>
            );
          })}
          {pending ? (
            <div className="flex flex-1 items-start gap-3 rounded-inner bg-surface p-4 text-ink">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-sunken text-ink-2" aria-hidden="true">
                <Lock size={16} />
              </span>
              <div className="min-w-0">
                <p className="text-sm text-ink">New {pending.title.toLowerCase()} · {shortDate(pending.date)}</p>
                <p className="text-xs text-muted">With {doctor?.name} for review. You&apos;ll see the results once they&apos;re released — likely at this visit.</p>
              </div>
            </div>
          ) : null}
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
            Reschedule
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

// ---------------------------------------------------------------------------------------------
// What I should do today
// ---------------------------------------------------------------------------------------------

const KIND_ICON = { meal: BowlFood, practice: PersonSimpleTaiChi, log: Heartbeat } as const;

function TodayChecklist() {
  const { toast } = useToast();
  const [checked, setChecked] = useState<Record<string, boolean>>({ class: true });
  const [bp, setBp] = useState<{ sys: number; dia: number; at: string } | null>(null);
  const total = PATIENT_TODAY.length;
  const done = PATIENT_TODAY.filter((i) => checked[i.id]).length;

  return (
    <Panel
      icon={<CheckCircle />}
      title="What I should do today"
      subtitle={done === total ? "All done for today" : `${done} of ${total} done`}
      href="/portal/plan"
      actionLabel="Open my plan"
      action={
        <ProgressRing value={done} max={total} size={40} stroke={4} className={cn("rounded-full bg-surface transition-colors", done === total ? "text-success" : "text-ink")}>
          <span className="text-ink" aria-label={`${done} of ${total} done`}>
            {done}/{total}
          </span>
        </ProgressRing>
      }
    >
      <ul className="flex flex-col rounded-inner bg-surface p-2">
        {PATIENT_TODAY.map((item) => {
          const Icon = KIND_ICON[item.kind];
          const isChecked = !!checked[item.id];
          const locked = !!item.recordedBy;
          return (
            <li key={item.id}>
              <div className="flex items-start gap-3 rounded-[12px] p-2">
                <Checkbox
                  checked={isChecked}
                  disabled={locked || (item.id === "bp" && !bp)}
                  onCheckedChange={(v) => setChecked((s) => ({ ...s, [item.id]: v === true }))}
                  aria-label={item.label}
                  className="mt-0.5"
                />
                <span className="min-w-0 flex-1">
                  <span className={cn("flex items-center gap-1.5 text-sm transition-colors", isChecked ? "text-muted line-through" : "text-ink")}>
                    <Icon size={16} className="shrink-0 text-muted" aria-hidden="true" />
                    {item.label}
                  </span>
                  <span className="block text-xs text-muted">
                    {item.id === "bp" && bp ? `${bp.sys}/${bp.dia} mmHg at ${bp.at} · self-reported · saved in this browser` : item.detail}
                  </span>
                </span>
                {item.id === "bp" && !bp ? (
                  <BpLogger
                    onSave={(sys, dia) => {
                      setBp({ sys, dia, at: NOW_LABEL });
                      setChecked((s) => ({ ...s, bp: true }));
                      toast({ tone: "success", title: `Blood pressure logged · ${sys}/${dia}`, description: "Saved in this browser session and labelled self-reported — nothing was sent." });
                    }}
                  />
                ) : locked ? (
                  <StatusBadge tone="neutral" dot={false} className="shrink-0">
                    Clinic
                  </StatusBadge>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>
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
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button size="sm" variant="dark" className="shrink-0">
          Log reading
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
// My current plan
// ---------------------------------------------------------------------------------------------

function PlanPanel() {
  const { guidance } = splitMedicines(CARE_PLAN.medical.text);
  const pkg = PACKAGES.find((p) => p.patientId === "p-kabir");
  const parts = [
    { key: "nutrition", icon: <BowlFood size={16} />, title: "Nutrition plan", by: CARE_PLAN.nutrition.by, updated: CARE_PLAN.nutrition.updated, text: CARE_PLAN.nutrition.text },
    { key: "movement", icon: <PersonSimpleTaiChi size={16} />, title: "Movement plan", by: CARE_PLAN.movement.by, updated: CARE_PLAN.movement.updated, text: CARE_PLAN.movement.text },
    { key: "medical", icon: <Stethoscope size={16} />, title: "Doctor's guidance", by: CARE_PLAN.medical.by, updated: CARE_PLAN.medical.updated, text: `${guidance}.` },
  ];
  return (
    <Panel icon={<Heartbeat />} title="My current plan" subtitle={CARE_PLAN.episode.replace(" (", " · ").replace(")", "")} href="/portal/plan" actionLabel="Open my plan">
      <div className="rounded-inner bg-surface p-4">
        <p className="text-xs text-muted">Our goal</p>
        <p className="mt-1 text-sm text-ink">{CARE_PLAN.goal}</p>
      </div>
      {parts.map((p) => (
        <div key={p.key} className="rounded-inner bg-surface p-4">
          <div className="flex items-center gap-2">
            <span className="flex size-8 items-center justify-center rounded-full bg-sunken text-ink-2" aria-hidden="true">
              {p.icon}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm text-ink">{p.title}</span>
              <span className="block truncate text-xs text-muted">
                {staffById(p.by)?.name} · updated {shortDate(p.updated)}
              </span>
            </span>
          </div>
          <p className="mt-3 text-xs leading-relaxed text-ink-2">{p.text}</p>
          {p.key === "movement" && pkg ? <ProgressBar value={pkg.used} max={pkg.total} tone="dark" className="mt-3" label={`${pkg.used} of ${pkg.total} yoga sessions done`} /> : null}
        </div>
      ))}
    </Panel>
  );
}

// ---------------------------------------------------------------------------------------------
// Messages with expected response times
// ---------------------------------------------------------------------------------------------

function MessagesPanel({ patientId }: { patientId: string }) {
  const threads = THREADS.filter((t) => t.participants.includes(patientId)).sort((a, b) => b.lastAt.localeCompare(a.lastAt));
  return (
    <Panel icon={<ChatCircleDots />} title="Messages" subtitle="Replies within 1 working day" href="/messages" actionLabel="Open messages">
      <AnimatePresence initial={false}>
        {threads.map((t) => {
          const staff = t.participants.filter((p) => p !== patientId).map((id) => staffById(id)).filter((s) => !!s);
          // A patient-channel thread the team hasn't read yet ends with the patient's own message.
          const awaitingReply = t.unread > 0;
          return (
            <motion.div key={t.id} layout transition={snappy}>
              <Link href="/messages" className="block rounded-inner bg-surface p-4 transition-colors hover:bg-canvas">
                <span className="flex items-start justify-between gap-3">
                  <span className="min-w-0">
                    <span className="block truncate text-sm text-ink">{t.subject}</span>
                    <span className="block text-xs text-muted">{whenLabel(t.lastAt)}</span>
                  </span>
                  <AvatarStack people={staff.map((s) => ({ name: s.name, avatar: s.avatar }))} size="xs" />
                </span>
                <span className="mt-3 block text-sm text-ink-2">
                  {awaitingReply ? "You: " : `${staff[0]?.name.split(" ")[0] ?? "Team"}: `}“{t.lastMessage}”
                </span>
                <span className="mt-3 flex items-center gap-1.5 text-xs">
                  {awaitingReply ? (
                    <StatusBadge tone="warning">Awaiting reply · {t.expectedResponse.replace(/^Reply\s+/i, "")}</StatusBadge>
                  ) : (
                    <StatusBadge tone="success">Answered</StatusBadge>
                  )}
                </span>
              </Link>
            </motion.div>
          );
        })}
      </AnimatePresence>
      <Button asChild variant="secondary" className="mt-auto self-start shadow-none">
        <Link href="/messages?new=1">
          <ChatCircleDots />
          New message
        </Link>
      </Button>
    </Panel>
  );
}

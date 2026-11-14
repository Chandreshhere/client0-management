"use client";

import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { useId, useState, type FormEvent } from "react";
import {
  ArrowUpRight,
  ArrowsLeftRight,
  ChatCircleDots,
  CheckCircle,
  Circle,
  Envelope,
  Heartbeat,
  ListChecks,
  ListPlus,
  Phone,
  PhoneCall,
  Plus,
  WarningCircle,
  WhatsappLogo,
  ChatText,
} from "@phosphor-icons/react";
import { cn } from "@/lib/cn";
import { snappy, spring } from "@/lib/motion";
import { formatTime, pluralize } from "@/lib/format";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, ModalContent } from "@/components/ui/dialog";
import { Field, Select, Textarea } from "@/components/ui/input";
import { ProgressBar } from "@/components/ui/misc";
import { Segmented } from "@/components/ui/segmented";
import { StatusBadge } from "@/components/ui/status";
import { useToast } from "@/components/ui/toast";
import { SegmentedBar } from "@/components/charts/bar-chart";
import { Inset } from "@/components/ui/card";
import { PeopleList } from "@/components/viz/cards";
import { DEMO_USER, staffById } from "@/data/staff";
import { FEATURED_PATIENT_ID, PATIENTS, patientById } from "@/data/patients";
import { DISCIPLINE_LABEL, TODAY_APPOINTMENTS, WAITLIST } from "@/data/appointments";
import { REFERRALS, REFERRAL_STAGE_LABEL, TASKS } from "@/data/care";
import { DOCUMENTS } from "@/data/records";
import { CARE_PLAN } from "@/data/featured";
import { CLASSES, NUTRITION_PLANS, PACKAGES } from "@/data/programs";
import type { ReferralStage } from "@/data/types";
import {
  CONTACT_ATTEMPTS,
  CONTACT_CHANNELS,
  CONTACT_OUTCOMES,
  NOW_ISO,
  NOW_LABEL,
  TODAY_KEY,
  daysSince,
  istDayKey,
  minutesUntil,
  shortDate,
  whenLabel,
  type ContactAttempt,
  type ContactChannel,
  type ContactOutcome,
} from "./data";
import { DashGrid, DashboardHeader, FocalCard, FocalHead, Panel, Reveal, StageTrack, StepTrack, Rail} from "./ui";
import { isOpenReferral, isStuckReferral, referralPipeline } from "./derive";
import { StageFlow, type FlowStage } from "./viz";

/**
 * Care-coordinator home (doc §3C): patients whose care has stalled — where progress stopped,
 * who owns the next step, and what that step is. Plus contact attempts, programme milestones
 * and open tasks by owner.
 */
const ME = DEMO_USER.coordinator.personId;

type NextKind = "nudge" | "log" | "link" | "done";
type Stalled = {
  id: string;
  patientId: string;
  reason: string;
  track: { referral: ReferralStage } | { steps: string[]; reached: number };
  stopped: string;
  ownerId: string;
  dueAt: string; // when it should have moved on (drives the ordering)
  next: { kind: NextKind; label: string; href?: string };
};

function buildStalled(): Stalled[] {
  const out: Stalled[] = [];
  for (const r of REFERRALS) {
    if (r.stage === "requested") {
      const to = staffById(r.toId);
      out.push({
        id: `ref-${r.id}`,
        patientId: r.patientId,
        reason: `Referral to ${DISCIPLINE_LABEL[r.toDiscipline]} not accepted`,
        track: { referral: r.stage },
        stopped: `Requested ${shortDate(r.requestedAt)} by ${staffById(r.fromId)?.name}`,
        ownerId: r.toId,
        dueAt: r.dueBy,
        next: { kind: "nudge", label: `Nudge ${to?.name.split(" ")[0]}` },
      });
    } else if (r.stage === "accepted") {
      out.push({
        id: `ref-${r.id}`,
        patientId: r.patientId,
        reason: `Accepted by ${DISCIPLINE_LABEL[r.toDiscipline].toLowerCase()}, not booked`,
        track: { referral: r.stage },
        stopped: `Accepted ${shortDate(r.stageDates.accepted ?? r.requestedAt)} · first visit not booked`,
        ownerId: r.toId,
        dueAt: r.dueBy,
        next: { kind: "link", label: "Book first visit", href: "/schedule?new=1" },
      });
    } else if (r.stage === "booked" && minutesUntil(r.dueBy) < 0) {
      // Booked, past its due date and never marked completed (sessions may be under way).
      const to = staffById(r.toId);
      const pkg = PACKAGES.find((x) => x.patientId === r.patientId);
      out.push({
        id: `ref-${r.id}`,
        patientId: r.patientId,
        reason: `Booked with ${DISCIPLINE_LABEL[r.toDiscipline].toLowerCase()}, never marked completed`,
        track: { referral: r.stage },
        stopped: `Booked ${shortDate(r.stageDates.booked ?? r.requestedAt)} · was due ${shortDate(r.dueBy)}${pkg ? ` · ${pkg.used} of ${pkg.total} sessions used` : ""}`,
        ownerId: r.toId,
        dueAt: r.dueBy,
        next: { kind: "nudge", label: `Nudge ${to?.name.split(" ")[0]}` },
      });
    }
  }
  // Overdue reviews: care-team patients with no next visit (excluding completed programmes).
  for (const p of PATIENTS) {
    if (!p.nextAppointment && p.status === "needs-attention" && p.tags.includes("Overdue review")) {
      const wait = WAITLIST.find((w) => w.patientId === p.id);
      out.push({
        id: `review-${p.id}`,
        patientId: p.id,
        reason: "Clinical review overdue",
        track: { steps: ["Seen", "Review due", "Booked"], reached: 1 },
        stopped: `Last seen ${p.lastVisit ? shortDate(p.lastVisit) : "—"}${wait ? ` · on waitlist since ${shortDate(wait.addedAt)}` : ""}`,
        ownerId: p.careTeam.doctor ?? ME,
        dueAt: wait?.addedAt ?? p.lastVisit ?? NOW_ISO,
        next: { kind: "link", label: "Offer a slot", href: "/schedule/waitlist" },
      });
    }
  }
  // Report reviews that are overdue, or whose reviewer is away.
  for (const d of DOCUMENTS) {
    if (d.status !== "awaiting-review" || !d.reviewerId || !d.patientId || !d.dueBy) continue;
    const reviewer = staffById(d.reviewerId);
    const away = reviewer?.status === "on-leave";
    if (minutesUntil(d.dueBy) < 0 || away) {
      out.push({
        id: `doc-${d.id}`,
        patientId: d.patientId,
        reason: away ? `${d.title} — reviewer on leave` : `${d.title} review overdue`,
        track: { steps: ["Uploaded", "Assigned", "Reviewed"], reached: 1 },
        stopped: `Uploaded ${shortDate(d.uploadedAt)} · due ${whenLabel(d.dueBy).replace("Today ", "today ")}`,
        ownerId: d.reviewerId,
        dueAt: d.dueBy,
        next: away ? { kind: "link", label: "Reassign reviewer", href: "/documents" } : { kind: "nudge", label: `Nudge ${reviewer?.name.replace("Dr. ", "Dr ")?.split(" ").slice(0, 2).join(" ")}` },
      });
    }
  }
  // Missed today and not rebooked.
  for (const a of TODAY_APPOINTMENTS.filter((x) => x.status === "no-show")) {
    const p = patientById(a.patientId);
    if (p && !p.nextAppointment) {
      const task = TASKS.find((t) => t.patientId === p.id && /rebook/i.test(t.title) && t.status !== "done");
      out.push({
        id: `noshow-${a.id}`,
        patientId: p.id,
        reason: "Missed visit, not rebooked",
        track: { steps: ["Booked", "No-show", "Rebooked"], reached: 1 },
        stopped: `${formatTime(a.start)} ${a.service.toLowerCase()} with ${staffById(a.staffId)?.name.split(" ")[0]}`,
        ownerId: task?.ownerId ?? ME,
        dueAt: task?.due ?? a.start,
        next: { kind: "log", label: "Log attempt" },
      });
    }
  }
  // Repeated missed sessions (two or more absences across class rosters).
  const absences = new Map<string, string[]>();
  for (const c of CLASSES) for (const e of c.enrolled) if (e.attendance === "absent") absences.set(e.patientId, [...(absences.get(e.patientId) ?? []), c.start]);
  for (const [patientId, dates] of absences) {
    if (dates.length < 2) continue;
    out.push({
      id: `missed-${patientId}`,
      patientId,
      reason: `${dates.length} missed yoga sessions in a row`,
      track: { steps: ["Enrolled", "Absent twice", "Back in class"], reached: 1 },
      stopped: `Absent ${[...dates].sort().map((d) => shortDate(d)).join(" & ")}`,
      ownerId: ME,
      dueAt: `${TODAY_KEY}T18:00:00+05:30`, // routed to the coordinator to follow up today
      next: { kind: "log", label: "Log attempt" },
    });
  }
  // Programme follow-ups owed after a programme ended.
  for (const t of TASKS.filter((x) => x.ownerId === ME && /programme ended/i.test(x.source) && x.status !== "done")) {
    out.push({
      id: `task-${t.id}`,
      patientId: t.patientId!,
      reason: "Follow-up after programme end",
      track: { steps: ["Programme ended", "Summary sent", "Follow-up booked"], reached: 0 },
      stopped: `${t.title} · was due ${shortDate(t.due)}`,
      ownerId: t.ownerId,
      dueAt: t.due,
      next: { kind: "done", label: "Mark done" },
    });
  }
  return out.sort((a, b) => Date.parse(a.dueAt) - Date.parse(b.dueAt));
}

const STALLED = buildStalled();
const stalledPatients = new Set(STALLED.map((s) => s.patientId)).size;
const overdueCount = STALLED.filter((s) => minutesUntil(s.dueAt) < 0).length;

const CHANNEL_ICON: Record<ContactChannel, typeof Phone> = { Call: Phone, SMS: ChatText, WhatsApp: WhatsappLogo, Email: Envelope };
const outcomeTone = (o: ContactOutcome) => (o === "Spoke to patient" ? "success" : o === "Wrong number" ? "danger" : o === "Left message" ? "info" : "warning");

export function CoordinatorHome() {
  const { toast } = useToast();
  const [attempts, setAttempts] = useState<ContactAttempt[]>(CONTACT_ATTEMPTS);
  const [dialog, setDialog] = useState<{ open: boolean; patientId: string }>({ open: false, patientId: "" });
  const [handled, setHandled] = useState<Record<string, { kind: NextKind; at: string }>>({});
  const myOpenTasks = TASKS.filter((t) => t.ownerId === ME && t.status !== "done").length;

  const act = (s: Stalled) => {
    if (s.next.kind === "log") {
      setDialog({ open: true, patientId: s.patientId });
      return;
    }
    setHandled((h) => ({ ...h, [s.id]: { kind: s.next.kind, at: NOW_LABEL } }));
    const owner = staffById(s.ownerId)?.name;
    toast(
      s.next.kind === "nudge"
        ? { title: `Reminder recorded for ${owner}`, description: "Saved in this browser session — nothing was sent." }
        : { tone: "success", title: `${patientById(s.patientId)?.name}: marked done`, description: "Saved in this browser session.", action: { label: "Undo", onClick: () => setHandled((h) => Object.fromEntries(Object.entries(h).filter(([k]) => k !== s.id))) } },
    );
  };

  const addAttempt = (a: Omit<ContactAttempt, "id" | "at" | "byId">) => {
    setAttempts((xs) => [{ ...a, id: `ca-local-${xs.length + 1}`, at: NOW_ISO, byId: ME }, ...xs]);
    // Logging an attempt on a stalled item moves that item along locally.
    const item = STALLED.find((s) => s.patientId === a.patientId && s.next.kind === "log" && !handled[s.id]);
    if (item) setHandled((h) => ({ ...h, [item.id]: { kind: "log", at: NOW_LABEL } }));
    toast({ tone: "success", title: `Contact attempt logged · ${patientById(a.patientId)?.name}`, description: "Recorded in this browser session — nothing was sent to the patient." });
  };

  return (
    <div className="flex flex-col gap-6">
      <DashboardHeader
        summary={`${pluralize(STALLED.length, "stalled handoff")} across ${pluralize(stalledPatients, "patient")} · ${overdueCount} overdue · ${pluralize(myOpenTasks, "open task")} of yours`}
        actions={
          <>
            <Button asChild variant="dark">
              <Link href="/tasks?new=1">
                <ListPlus />
                New task
              </Link>
            </Button>
            <Button asChild variant="secondary">
              <Link href="/messages?new=1">
                <ChatCircleDots />
                Message care team
              </Link>
            </Button>
          </>
        }
      />

      <DashGrid>
        <Reveal index={0} className="lg:col-span-2">
          <StalledCard handled={handled} onAct={act} />
        </Reveal>

        <Rail index={1} innerClassName="flex flex-col gap-4">
          <Panel
            icon={<PhoneCall />}
            title="Contact attempts"
            subtitle={`${attempts.filter((a) => istDayKey(a.at) === TODAY_KEY).length} today · ${attempts.length} this week`}
            href="/tasks"
            actionLabel="Open tasks"
            action={
              <Button size="sm" variant="secondary" className="shadow-none" onClick={() => setDialog({ open: true, patientId: "" })} aria-label="Log a contact attempt">
                <Plus />
                Log
              </Button>
            }
          >
            <ul className="flex flex-col gap-2">
              <AnimatePresence initial={false}>
                {attempts.map((a) => {
                  const p = patientById(a.patientId);
                  const Icon = CHANNEL_ICON[a.channel];
                  return (
                    <motion.li key={a.id} layout initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={spring} className="rounded-inner bg-surface p-4">
                      <div className="flex items-start gap-3">
                        <Avatar src={p?.avatar} name={p?.name ?? "Patient"} size="sm" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm text-ink">{p?.name}</p>
                          <p className="flex items-center gap-1.5 text-xs text-muted">
                            <Icon size={14} aria-hidden="true" />
                            {a.channel} · {whenLabel(a.at)} · {staffById(a.byId)?.name.split(" ")[0]}
                          </p>
                        </div>
                        <StatusBadge tone={outcomeTone(a.outcome)}>{a.outcome}</StatusBadge>
                      </div>
                      {a.note ? <p className="mt-3 text-xs text-ink-2">{a.note}</p> : null}
                    </motion.li>
                  );
                })}
              </AnimatePresence>
            </ul>
          </Panel>
          <CohortPanel />
        </Rail>

        <Reveal index={2} className="lg:col-span-2">
          <ReferralPipelinePanel />
        </Reveal>

        <Rail index={3} className="lg:row-span-2">
          <ProgrammesPanel />
        </Rail>

        <Reveal index={4} className="lg:col-span-2">
          <TasksByOwnerPanel />
        </Reveal>
      </DashGrid>

      <ContactDialog
        open={dialog.open}
        initialPatientId={dialog.patientId}
        onOpenChange={(open) => setDialog((d) => ({ ...d, open }))}
        onSave={(a) => {
          addAttempt(a);
          setDialog({ open: false, patientId: "" });
        }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------------------------
// Focal: care that has stalled
// ---------------------------------------------------------------------------------------------

function StalledCard({ handled, onAct }: { handled: Record<string, { kind: NextKind; at: string }>; onAct: (s: Stalled) => void }) {
  const id = useId();
  const open = STALLED.filter((s) => !handled[s.id]).length;
  const byKind = {
    referrals: STALLED.filter((s) => s.id.startsWith("ref-")).length,
    reviews: STALLED.filter((s) => s.id.startsWith("review-") || s.id.startsWith("doc-")).length,
    visits: STALLED.filter((s) => s.id.startsWith("noshow-") || s.id.startsWith("missed-") || s.id.startsWith("task-")).length,
  };
  return (
    <FocalCard labelledBy={id}>
      <FocalHead
        id={id}
        label="Care that has stalled"
        title={open ? `${pluralize(open, "handoff")} need a push today` : "Every handoff is moving"}
        meta={`${pluralize(byKind.referrals, "referral")} · ${pluralize(byKind.reviews, "overdue review")} · ${pluralize(byKind.visits, "missed visit or follow-up", "missed visits or follow-ups")} — oldest first`}
        aside={
          <div className="text-right">
            <p className="text-title font-normal tabular">{overdueCount}</p>
            <p className="text-xs text-white/90">past their due date</p>
          </div>
        }
      />
      <ul className="grid grid-cols-1 gap-2 md:grid-cols-2">
        {STALLED.map((s) => (
          <StalledItem key={s.id} item={s} handled={handled[s.id]} onAct={onAct} />
        ))}
      </ul>
    </FocalCard>
  );
}

function StalledItem({ item: s, handled, onAct }: { item: Stalled; handled?: { kind: NextKind; at: string }; onAct: (s: Stalled) => void }) {
  const p = patientById(s.patientId);
  const owner = staffById(s.ownerId);
  const late = minutesUntil(s.dueAt) < 0;
  const lateDays = daysSince(s.dueAt);
  return (
    <motion.li layout transition={snappy} className={cn("flex flex-col rounded-inner bg-surface p-4 text-ink transition-opacity duration-300", handled && "opacity-70")}>
      <div className="flex items-start gap-3">
        <Avatar src={p?.avatar} name={p?.name ?? "Patient"} size="sm" />
        <div className="min-w-0 flex-1">
          <Link href={`/patients/${s.patientId}`} className="block truncate text-sm text-ink hover:underline">
            {p?.name}
          </Link>
          <p className="text-xs text-ink-2">{s.reason}</p>
        </div>
        {handled ? (
          <StatusBadge tone="success">{handled.kind === "nudge" ? "Nudged" : handled.kind === "log" ? "Contacted" : "Done"}</StatusBadge>
        ) : late ? (
          <StatusBadge tone="danger">{lateDays > 0 ? `${lateDays} d late` : "Late"}</StatusBadge>
        ) : (
          <StatusBadge tone="warning">Due {whenLabel(s.dueAt).replace("Today ", "")}</StatusBadge>
        )}
      </div>

      <div className="mt-3 flex flex-col gap-1.5">
        {"referral" in s.track ? <StageTrack stage={s.track.referral} stalled /> : <StepTrack steps={s.track.steps} reached={s.track.reached} />}
        <p className="text-xs text-muted">
          <span className="text-ink-2">Stopped at {"referral" in s.track ? REFERRAL_STAGE_LABEL[s.track.referral].toLowerCase() : s.track.steps[s.track.reached].toLowerCase()}</span> · {s.stopped}
        </p>
      </div>

      <div className="mt-auto flex items-center justify-between gap-2 pt-4">
        <span className="flex min-w-0 items-center gap-2 text-xs text-muted">
          <Avatar src={owner?.avatar} name={owner?.name ?? ""} size="xs" />
          <span className="min-w-0 truncate">
            {s.ownerId === ME ? "You" : owner?.name}
          </span>
        </span>
        {handled ? (
          <span className="shrink-0 text-xs text-success">{handled.at}</span>
        ) : s.next.kind === "link" && s.next.href ? (
          <Button asChild size="sm" variant="secondary">
            <Link href={s.next.href}>
              {s.next.label}
              <ArrowUpRight />
            </Link>
          </Button>
        ) : (
          <Button size="sm" variant="dark" onClick={() => onAct(s)} aria-label={`${s.next.label}: ${p?.name}`}>
            {s.next.label}
          </Button>
        )}
      </div>
    </motion.li>
  );
}

// ---------------------------------------------------------------------------------------------
// Programme milestones — Heart Health cohort
// ---------------------------------------------------------------------------------------------

function CohortPanel() {
  const cohort = PATIENTS.filter((p) => p.program === "Heart Health · 12 weeks");
  const week = CARE_PLAN.episode.match(/week (\d+) of (\d+)/);

  return (
    <Panel icon={<Heartbeat />} title="Heart Health cohort" subtitle={`${pluralize(cohort.length, "patient")} · 12-week programme`} href="/patients" actionLabel="Open patients">
      {cohort.map((p) => {
        const pkg = PACKAGES.find((x) => x.patientId === p.id);
        const plan = NUTRITION_PLANS.find((n) => n.patientId === p.id && n.status !== "superseded");
        const pendingRef = REFERRALS.find((r) => r.patientId === p.id && r.stage === "requested");
        const absences = CLASSES.flatMap((c) => c.enrolled.filter((e) => e.patientId === p.id && e.attendance === "absent")).length;
        const today = TODAY_APPOINTMENTS.find((a) => a.patientId === p.id && a.discipline === "medical");
        const milestones: { label: string; state: "done" | "todo" | "late" }[] = [
          plan?.status === "published"
            ? { label: `Nutrition plan v${plan.version} published`, state: "done" }
            : pendingRef
              ? { label: `Nutrition referral not accepted (${pluralize(daysSince(pendingRef.requestedAt), "day")})`, state: "late" }
              : { label: "Nutrition plan in draft", state: "todo" },
          absences >= 2 ? { label: `${absences} missed yoga sessions`, state: "late" } : { label: "Attending yoga", state: "done" },
          today ? { label: `${today.service} today ${formatTime(today.start)}`, state: "todo" } : { label: "Next review not booked", state: "late" },
        ];
        if (p.id === FEATURED_PATIENT_ID) {
          // The featured record carries the shared care plan's actions and next review.
          for (const a of CARE_PLAN.actions.filter((x) => x.status === "done")) milestones.push({ label: a.label.startsWith("Book ") ? `${sentence(a.label.slice(5))} booked` : a.label, state: "done" });
          milestones.push({ label: `${CARE_PLAN.nextReview.label} · ${shortDate(CARE_PLAN.nextReview.at)}`, state: "todo" });
        }
        return (
          <div key={p.id} className="rounded-inner bg-surface p-4">
            <div className="flex items-start gap-3">
              <Avatar src={p.avatar} name={p.name} size="sm" />
              <div className="min-w-0 flex-1">
                <Link href={`/patients/${p.id}`} className="block truncate text-sm text-ink hover:underline">
                  {p.name}
                </Link>
                <p className="text-xs text-muted">{p.id === FEATURED_PATIENT_ID && week ? `Week ${week[1]} of ${week[2]}` : `Registered ${shortDate(p.registeredAt)}`}</p>
              </div>
              {pkg ? (
                <span className="shrink-0 text-right text-xs text-muted tabular">
                  <span className="block text-sm text-ink">
                    {pkg.used}/{pkg.total}
                  </span>
                  sessions
                </span>
              ) : null}
            </div>
            {pkg ? <ProgressBar value={pkg.used} max={pkg.total} tone="dark" className="mt-3" label={`${p.name}: ${pkg.used} of ${pkg.total} yoga sessions`} /> : null}
            <ul className="mt-3 flex flex-col gap-1.5">
              {milestones.map((m) => (
                <li key={m.label} className={cn("flex items-start gap-2 text-xs", m.state === "late" ? "text-warning" : "text-ink-2")}>
                  {m.state === "done" ? (
                    <CheckCircle size={16} weight="fill" className="mt-px shrink-0 text-success" aria-label="Done" />
                  ) : m.state === "late" ? (
                    <WarningCircle size={16} weight="fill" className="mt-px shrink-0" aria-label="Behind" />
                  ) : (
                    <Circle size={16} className="mt-px shrink-0 text-faint" aria-label="Upcoming" />
                  )}
                  {m.label}
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </Panel>
  );
}

function ProgrammesPanel() {
  const programmes = new Map<string, { active: number; done: number; attention: number }>();
  for (const p of PATIENTS) {
    if (!p.program) continue;
    const row = programmes.get(p.program) ?? { active: 0, done: 0, attention: 0 };
    if (p.status === "completed") row.done += 1;
    else row.active += 1;
    if (p.status === "needs-attention") row.attention += 1;
    programmes.set(p.program, row);
  }
  const rows = [...programmes.entries()].sort((a, b) => b[1].active - a[1].active || a[0].localeCompare(b[0]));
  return (
    <Panel icon={<ListChecks />} title="Programmes" subtitle={`${pluralize(rows.length, "programme")} · ${PATIENTS.filter((p) => p.program && p.status !== "completed").length} patients enrolled`} href="/patients" actionLabel="Open patients">
      <ul className="flex flex-col rounded-inner bg-surface p-2">
        {rows.map(([name, r]) => (
          <li key={name} className="flex items-center justify-between gap-3 rounded-[12px] px-2 py-2">
            <span className="min-w-0">
              <span className="block truncate text-sm text-ink">{name}</span>
              <span className="block text-xs text-muted">
                {r.active} active{r.done ? ` · ${r.done} completed` : ""}
              </span>
            </span>
            {r.attention ? <StatusBadge tone="warning">{r.attention} need attention</StatusBadge> : <StatusBadge tone="neutral">On track</StatusBadge>}
          </li>
        ))}
      </ul>
    </Panel>
  );
}

function sentence(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// ---------------------------------------------------------------------------------------------
// Referral pipeline — where every handoff sits now, and where the late ones stopped
// ---------------------------------------------------------------------------------------------

function ReferralPipelinePanel() {
  const stages = referralPipeline();
  const open = REFERRALS.filter(isOpenReferral);
  const stuck = REFERRALS.filter(isStuckReferral).sort((a, b) => a.dueBy.localeCompare(b.dueBy));
  const flow: FlowStage[] = stages.map((st) => {
    const names = st.referrals.map((r) => patientById(r.patientId)?.name ?? "Patient");
    const openStage = st.stage === "requested" || st.stage === "accepted" || st.stage === "booked";
    return {
      id: st.stage,
      label: REFERRAL_STAGE_LABEL[st.stage],
      count: st.referrals.length,
      people: st.referrals.map((r) => ({ name: patientById(r.patientId)?.name ?? "Patient", avatar: patientById(r.patientId)?.avatar })),
      hint: st.stuck.length ? `${st.stuck.length} past due here` : !st.referrals.length ? "none" : openStage ? "on time" : "closed",
      alert: st.stuck.length > 0,
      emphasis: st.stuck.length > 0,
      description: `${REFERRAL_STAGE_LABEL[st.stage]}: ${st.referrals.length}${names.length ? ` — ${names.join(", ")}` : ""}${st.stuck.length ? `; ${st.stuck.length} past due at this stage` : ""}`,
    };
  });
  return (
    <Panel
      icon={<ArrowsLeftRight />}
      title="Referral pipeline"
      subtitle={`${pluralize(REFERRALS.length, "referral")} · ${open.length} open · ${stuck.length} stopped past their due date`}
      href="/referrals"
      actionLabel="Open referrals"
    >
      <div className="px-2 pb-2">
        <StageFlow label="Referrals by current stage" stages={flow} />
      </div>
      {stuck.length ? (
        <Inset className="p-2">
          <p className="px-2 pb-1 pt-1 text-xs text-muted">Where the late ones stopped</p>
          <ul className="flex flex-col">
            {stuck.map((r) => {
              const p = patientById(r.patientId);
              const to = staffById(r.toId);
              const late = daysSince(r.dueBy);
              return (
                <li key={r.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-[12px] px-2 py-2">
                  <Avatar src={p?.avatar} name={p?.name ?? "Patient"} size="sm" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm text-ink">{p?.name}</span>
                    <span className="block truncate text-xs text-muted">
                      {DISCIPLINE_LABEL[r.toDiscipline]} · {to?.name} · requested {shortDate(r.requestedAt)}
                    </span>
                  </span>
                  <StageTrack stage={r.stage} stalled />
                  <StatusBadge tone="danger">
                    Stopped at {REFERRAL_STAGE_LABEL[r.stage].toLowerCase()} · {late > 0 ? `${late} d late` : "late"}
                  </StatusBadge>
                </li>
              );
            })}
          </ul>
        </Inset>
      ) : null}
    </Panel>
  );
}

// ---------------------------------------------------------------------------------------------
// Open tasks by owner — people list with counts, the selected owner's tasks beside it
// ---------------------------------------------------------------------------------------------

const BUCKET_COLOR = { overdue: "var(--color-danger)", today: "var(--color-warning)", later: "var(--color-ops)" } as const;
type Bucket = keyof typeof BUCKET_COLOR;
const bucketOf = (due: string): Bucket => (minutesUntil(due) < 0 ? "overdue" : istDayKey(due) === TODAY_KEY ? "today" : "later");

function TasksByOwnerPanel() {
  const open = TASKS.filter((t) => t.status !== "done");
  const owners = new Map<string, { overdue: number; today: number; later: number }>();
  for (const t of open) {
    const o = owners.get(t.ownerId) ?? { overdue: 0, today: 0, later: 0 };
    o[bucketOf(t.due)] += 1;
    owners.set(t.ownerId, o);
  }
  const rows = [...owners.entries()].map(([id, c]) => ({ id, ...c, total: c.overdue + c.today + c.later })).sort((a, b) => b.total - a.total || b.overdue - a.overdue);
  const [selected, setSelected] = useState(rows.some((r) => r.id === ME) ? ME : rows[0]?.id ?? "");
  const row = rows.find((r) => r.id === selected) ?? rows[0];
  const owner = staffById(row?.id ?? "");
  const tasks = open.filter((t) => t.ownerId === row?.id).sort((a, b) => a.due.localeCompare(b.due));

  return (
    <Panel icon={<ListChecks />} title="Open tasks by owner" subtitle={`${pluralize(open.length, "open task")} across ${pluralize(rows.length, "person", "people")} · pick someone to see theirs`} href="/tasks" actionLabel="Open tasks">
      <div className="grid grid-cols-1 gap-2 md:grid-cols-[minmax(0,264px)_minmax(0,1fr)]">
        <PeopleList
          selected={row?.id}
          onSelect={setSelected}
          people={rows.map((r) => {
            const s = staffById(r.id);
            return {
              id: r.id,
              name: r.id === ME ? `${s?.name} (you)` : s?.name ?? r.id,
              role: `${s?.title.split(" ·")[0] ?? ""}${r.overdue ? ` · ${r.overdue} overdue` : ""}`,
              avatar: s?.avatar,
              count: r.total,
            };
          })}
        />
        {row ? (
          <Inset className="flex flex-col gap-4">
            <div>
              <p className="text-sm text-ink">
                {row.id === ME ? "Your open tasks" : `${owner?.name}'s open tasks`} · {row.total}
              </p>
              <SegmentedBar
                className="mt-3"
                label={`${owner?.name}'s open tasks by due date`}
                parts={[
                  { label: "Overdue", value: row.overdue, color: BUCKET_COLOR.overdue },
                  { label: "Due today", value: row.today, color: BUCKET_COLOR.today },
                  { label: "Later", value: row.later, color: BUCKET_COLOR.later },
                ]}
              />
            </div>
            <ul className="-mx-2 flex flex-col">
              {tasks.map((t) => {
                const p = t.patientId ? patientById(t.patientId) : null;
                const b = bucketOf(t.due);
                return (
                  <li key={t.id}>
                    <Link href="/tasks" className="flex items-start gap-3 rounded-[12px] px-2 py-2 transition-colors hover:bg-canvas">
                      <span className="mt-1.5 size-2 shrink-0 rounded-full" style={{ background: BUCKET_COLOR[b] }} aria-hidden="true" />
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm text-ink">{t.title}</span>
                        <span className="block truncate text-xs text-muted">
                          {p ? `${p.name} · ` : ""}
                          {t.source}
                        </span>
                      </span>
                      <StatusBadge tone={b === "overdue" ? "danger" : b === "today" ? "warning" : "neutral"} className="shrink-0">
                        {b === "overdue" ? `Was due ${shortDate(t.due)}` : b === "today" ? `Today ${formatTime(t.due)}` : `Due ${shortDate(t.due)}`}
                      </StatusBadge>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </Inset>
        ) : null}
      </div>
    </Panel>
  );
}

// ---------------------------------------------------------------------------------------------
// Log a contact attempt (local only)
// ---------------------------------------------------------------------------------------------

function ContactDialog({
  open,
  initialPatientId,
  onOpenChange,
  onSave,
}: {
  open: boolean;
  initialPatientId: string;
  onOpenChange: (open: boolean) => void;
  onSave: (a: Omit<ContactAttempt, "id" | "at" | "byId">) => void;
}) {
  const formId = useId();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <ModalContent
        title="Log a contact attempt"
        description="Saved in this browser session only — nothing is sent to the patient."
        size="sm"
        footer={
          <>
            <DialogClose asChild>
              <Button variant="ghost">Cancel</Button>
            </DialogClose>
            <Button variant="dark" type="submit" form={formId}>
              Save attempt
            </Button>
          </>
        }
      >
        {open ? <ContactForm key={initialPatientId} formId={formId} initialPatientId={initialPatientId} onSave={onSave} /> : null}
      </ModalContent>
    </Dialog>
  );
}

function ContactForm({ formId, initialPatientId, onSave }: { formId: string; initialPatientId: string; onSave: (a: Omit<ContactAttempt, "id" | "at" | "byId">) => void }) {
  const [patientId, setPatientId] = useState(initialPatientId);
  const [channel, setChannel] = useState<ContactChannel>("Call");
  const [outcome, setOutcome] = useState<ContactOutcome | "">("");
  const [note, setNote] = useState("");
  const [errors, setErrors] = useState<{ patient?: string; outcome?: string }>({});
  const stalledIds = new Set(STALLED.map((s) => s.patientId));
  const options = [...PATIENTS]
    .sort((a, b) => Number(stalledIds.has(b.id)) - Number(stalledIds.has(a.id)) || a.name.localeCompare(b.name))
    .map((p) => ({ value: p.id, label: p.name, description: stalledIds.has(p.id) ? "Care stalled" : undefined }));

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const next = { patient: patientId ? undefined : "Choose who you contacted", outcome: outcome ? undefined : "Choose what happened" };
    setErrors(next);
    if (next.patient || next.outcome || !outcome) return;
    onSave({ patientId, channel, outcome, note: note.trim() });
  };

  return (
    <form id={formId} onSubmit={submit} className="flex flex-col gap-4" noValidate>
      <Field label="Patient" error={errors.patient}>
        {(f) => <Select id={f.id} value={patientId} onValueChange={(v) => setPatientId(v)} options={options} placeholder="Choose a patient" ariaLabel="Patient" />}
      </Field>
      <div className="flex flex-col gap-2">
        <span className="text-sm text-ink" id={`${formId}-channel`}>
          Channel
        </span>
        <Segmented items={CONTACT_CHANNELS.map((c) => ({ value: c, label: c }))} value={channel} onChange={setChannel} ariaLabel="Channel" size="sm" variant="tray" className="self-start" />
      </div>
      <Field label="Outcome" error={errors.outcome}>
        {(f) => <Select id={f.id} value={outcome || undefined} onValueChange={(v) => setOutcome(v as ContactOutcome)} options={CONTACT_OUTCOMES.map((o) => ({ value: o, label: o }))} placeholder="What happened?" ariaLabel="Outcome" />}
      </Field>
      <Field label="Note" optional hint="Avoid clinical detail — this log is visible to the whole care team.">
        {(f) => <Textarea {...f} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Will call back after 18:00" rows={3} />}
      </Field>
    </form>
  );
}

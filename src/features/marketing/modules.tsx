import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowUpRight, ClipboardText, DeviceMobile, Files, Queue, TestTube, Pulse, ChatCircleDots, CalendarBlank, BowlFood, ListChecks } from "@phosphor-icons/react/ssr";
import { APPOINTMENT_STATUS_LABEL, TODAY_APPOINTMENTS } from "@/data/appointments";
import { CARE_EVENTS, CARE_PLAN } from "@/data/featured";
import { patientById } from "@/data/patients";
import { minPlanFor, type FeatureId } from "@/data/plans";
import { NUTRITION_PLANS } from "@/data/programs";
import { DOCUMENTS, DOC_STATUS_LABEL, THREADS } from "@/data/records";
import { staffById } from "@/data/staff";
import { Avatar } from "@/components/ui/avatar";
import { StatusBadge, appointmentTone, type Tone } from "@/components/ui/status";
import { cn } from "@/lib/cn";
import { formatDate, formatTime } from "@/lib/format";
import { Section, SectionIntro } from "./section";
import s from "./motion.module.css";

/**
 * Modules bento. Each cell = claim + a small, real UI crop built from kit surfaces and the shared
 * synthetic fixtures (no screenshots, no invented metrics). Unequal spans express priority:
 * the shared care plan is the link between portals (doc §5A), so it gets the widest cell and the
 * section's one cobalt element.
 */

const pname = (id: string | null | undefined) => patientById(id)?.name ?? "Unidentified patient";
const sname = (id: string | null | undefined) => staffById(id ?? undefined)?.name ?? "Unassigned";
const short = (iso: string) => formatDate(iso, { day: "numeric", month: "short" });

const availability = (f: FeatureId) => {
  const p = minPlanFor(f);
  return p.id === "starter" ? "On every plan" : p.id === "team" ? "Team and Clinic plans" : "Clinic plan";
};

export function Modules() {
  return (
    <Section id="modules" nav="workflows" labelledBy="modules-title">
      <SectionIntro
        id="modules-title"
        eyebrow="Modules"
        title="Where do patients get lost between a report, a plan and the front desk?"
        lead="In the gaps between people. These five modules carry the record across those gaps. Every panel below is built from the product's own components, filled with synthetic data."
      />
      {/* Phones: a swipeable snap row (one module per screen). md: two columns. lg: the 7/5 + 4/4/4 bento. */}
      <div
        className="-mx-4 mt-12 flex snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto px-4 pb-2 scrollbar-none sm:-mx-6 sm:scroll-px-6 sm:px-6 md:mx-0 md:mt-16 md:grid md:grid-cols-2 md:gap-4 md:overflow-visible md:px-0 md:pb-0 lg:grid-cols-12"
      >
        <CarePlanCell className={cn(SLIDE, "md:col-span-2 lg:col-span-7")} />
        <DatesCell className={cn(SLIDE, "md:col-span-2 lg:col-span-5")} />
        <ReviewCell className={cn(SLIDE, "lg:col-span-4")} />
        <QueueCell className={cn(SLIDE, "lg:col-span-4")} />
        <PortalCell className={cn(SLIDE, "md:col-span-2 lg:col-span-4")} />
      </div>
      <p className="mt-3 text-xs text-muted md:hidden" aria-hidden="true">
        Swipe for all five modules →
      </p>
    </Section>
  );
}

const SLIDE = "w-[86%] shrink-0 snap-start md:w-auto";

function Cell({ icon, title, feature, claim, children, className }: { icon: ReactNode; title: string; feature: FeatureId; claim: string; children: ReactNode; className?: string }) {
  return (
    <article className={cn("flex flex-col rounded-card bg-sunken p-2", s.revealLg, className)}>
      <header className="flex items-center gap-3 p-2">
        <span aria-hidden="true" className="flex size-10 shrink-0 items-center justify-center rounded-full bg-surface text-ink [&_svg]:size-[18px]">
          {icon}
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-medium text-ink">{title}</h3>
          <p className="truncate text-xs text-muted">{availability(feature)}</p>
        </div>
        <Link
          href="/demo"
          aria-label={`Try ${title.toLowerCase()} in the live demo`}
          className="group/go flex size-10 shrink-0 items-center justify-center rounded-full bg-surface text-ink transition-[background-color,transform] duration-200 hover:bg-canvas active:scale-95"
        >
          <ArrowUpRight size={18} aria-hidden="true" className="transition-transform duration-500 [transition-timing-function:var(--ease-spring-pop)] group-hover/go:rotate-45" />
        </Link>
      </header>
      <p className="px-2 pb-4 pt-2 text-base leading-snug text-ink-2 md:max-w-[52ch]">{claim}</p>
      <div className="mt-auto flex flex-col gap-2">{children}</div>
    </article>
  );
}

function Row({ lead, title, meta, badge }: { lead: ReactNode; title: ReactNode; meta: ReactNode; badge?: { tone: Tone; label: string } }) {
  return (
    <div className="flex items-center gap-3 rounded-inner bg-surface p-4">
      {lead}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm text-ink">{title}</p>
        <p className="truncate text-xs text-muted">{meta}</p>
      </div>
      {badge ? (
        <StatusBadge tone={badge.tone} className="shrink-0">
          {badge.label}
        </StatusBadge>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------ shared care plan */

function CarePlanCell({ className }: { className?: string }) {
  const lead = staffById(CARE_PLAN.responsible)!;
  const lines = [
    { label: "Medical guidance", dot: "bg-medical", ...CARE_PLAN.medical },
    { label: "Nutrition plan", dot: "bg-nutrition", ...CARE_PLAN.nutrition },
    { label: "Movement plan", dot: "bg-movement", ...CARE_PLAN.movement },
  ];
  const statusTone = { open: "neutral", "in-progress": "info", done: "success" } as const;
  const statusLabel = { open: "Open", "in-progress": "In progress", done: "Done" } as const;
  return (
    <Cell
      icon={<ClipboardText />}
      title="Shared care plan"
      feature="care-plan"
      claim="One plan across medicine, nutrition and movement: the agreed goal, who is accountable, each discipline's current guidance, the next review and every open action with an owner."
      className={className}
    >
      <div className="rounded-inner bg-surface p-4">
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
          <span>{pname("p-kabir")} · {CARE_PLAN.episode}</span>
          <span className="inline-flex items-center gap-2">
            <Avatar src={lead.avatar} name={lead.name} size="xs" />
            Accountable: {lead.name}
          </span>
        </div>
        <p className="mt-3 text-sm text-ink">{CARE_PLAN.goal}</p>
      </div>
      <ul className="flex flex-col gap-2">
        {lines.map((l) => {
          const by = staffById(l.by);
          return (
            <li key={l.label} className="flex items-start gap-3 rounded-inner bg-surface p-4">
              <span aria-hidden="true" className={cn("mt-1.5 size-2 shrink-0 rounded-full", l.dot)} />
              <div className="min-w-0 flex-1">
                <p className="text-xs text-muted">{l.label}</p>
                <p className="mt-1 line-clamp-2 text-sm text-ink">{l.text}</p>
              </div>
              <span className="hidden shrink-0 items-center gap-2 text-xs text-muted sm:inline-flex">
                <Avatar src={by?.avatar} name={by?.name ?? ""} size="xs" />
                {short(l.updated)}
              </span>
            </li>
          );
        })}
      </ul>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <div className="flex flex-col justify-between gap-6 rounded-inner bg-primary p-4 text-white">
          <span className="text-xs text-white/90">Next review</span>
          <div>
            <p className="text-[26px] font-light leading-none tracking-[-0.02em] tabular">{formatDate(CARE_PLAN.nextReview.at, { weekday: "short", day: "numeric", month: "short" })}</p>
            <p className="mt-2 text-xs text-white/90">
              {formatTime(CARE_PLAN.nextReview.at)} · {CARE_PLAN.nextReview.label} with {sname(CARE_PLAN.nextReview.with)}
            </p>
          </div>
        </div>
        <div className="rounded-inner bg-surface p-4">
          <p className="text-xs text-muted">Open actions</p>
          <ul className="mt-2 flex flex-col gap-2">
            {CARE_PLAN.actions.map((a) => {
              const owner = staffById(a.owner) ?? patientById(a.owner);
              return (
                <li key={a.id} className="flex items-center gap-2 text-sm">
                  <Avatar src={owner?.avatar} name={owner?.name ?? ""} size="xs" />
                  <span className={cn("min-w-0 flex-1 truncate", a.status === "done" ? "text-muted line-through" : "text-ink")}>{a.label}</span>
                  <StatusBadge tone={statusTone[a.status]} dot={false} className="shrink-0">
                    {statusLabel[a.status]}
                  </StatusBadge>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </Cell>
  );
}

/* ------------------------------------------------------------ event vs entry dates */

function DatesCell({ className }: { className?: string }) {
  const old = DOCUMENTS.find((d) => d.id === "d4")!;
  const lipid = CARE_EVENTS.find((e) => e.id === "e26-24")!;
  const bp = CARE_EVENTS.find((e) => e.id === "e26-25")!;
  const reportYear = Number(old.reportDate.slice(0, 4));
  const uploadYear = Number(old.uploadedAt.slice(0, 4));
  return (
    <Cell
      icon={<CalendarBlank />}
      title="Care timeline"
      feature="overview"
      claim="Every entry keeps the date it happened apart from the date it was entered, with its author, state and source — so an old report uploaded today never looks like a new result."
      className={className}
    >
      <div className="rounded-inner bg-surface p-4">
        <p className="truncate text-sm text-ink">{old.title}</p>
        <p className="truncate text-xs text-muted">
          {pname(old.patientId)} · {old.source.toLowerCase()} · {old.pages} pages
        </p>
        {/* the thread between the two dates */}
        <div className="relative mt-6 h-16" aria-hidden="true">
          <div className="absolute inset-x-2 top-8 h-px bg-line" />
          {Array.from({ length: uploadYear - reportYear + 1 }, (_, n) => (
            <span key={n} className="absolute top-[30px] h-[5px] w-px bg-line-strong" style={{ left: `calc(8px + ${(n / (uploadYear - reportYear)) * 100}% - ${(n / (uploadYear - reportYear)) * 16}px)` }} />
          ))}
          <svg viewBox="0 0 100 32" preserveAspectRatio="none" className="absolute inset-x-2 top-0 h-8 w-[calc(100%-16px)] overflow-visible">
            <path d="M0,32 C20,0 80,0 100,32" fill="none" stroke="var(--color-primary)" strokeWidth={1.25} strokeDasharray="3 3" vectorEffect="non-scaling-stroke" />
          </svg>
          <span className="absolute left-0 top-[27px] size-[11px] rounded-full bg-primary ring-4 ring-surface" />
          <span className="absolute right-0 top-[27px] size-[11px] rounded-full bg-surface shadow-[inset_0_0_0_2px_var(--color-primary)] ring-4 ring-surface" />
        </div>
        <dl className="mt-1 grid grid-cols-2 gap-2 text-xs">
          <div>
            <dt className="text-muted">Report date</dt>
            <dd className="text-sm text-ink tabular">{formatDate(old.reportDate)}</dd>
          </div>
          <div className="text-right">
            <dt className="text-muted">Uploaded</dt>
            <dd className="text-sm text-ink tabular">{formatDate(old.uploadedAt)}</dd>
          </div>
        </dl>
        <p className="mt-3 text-xs text-muted">Filed under {reportYear} on the timeline, not under this week.</p>
      </div>
      <Row
        lead={<span aria-hidden="true" className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary text-white"><TestTube size={18} /></span>}
        title={lipid.title}
        meta={`Happened ${short(lipid.date)} · entered ${short(lipid.enteredAt)}, ${formatTime(lipid.enteredAt)}`}
        badge={{ tone: "warning", label: "Awaiting review" }}
      />
      <Row
        lead={<span aria-hidden="true" className="flex size-10 shrink-0 items-center justify-center rounded-full border-[1.5px] border-dashed border-primary bg-surface text-primary"><Pulse size={18} /></span>}
        title="Home BP log"
        meta={`${bp.summary.replace(".", "")} · by the patient`}
        badge={{ tone: "neutral", label: "Self-reported" }}
      />
    </Cell>
  );
}

/* ------------------------------------------------------------ report review */

function ReviewCell({ className }: { className?: string }) {
  const queue = DOCUMENTS.filter((d) => d.status === "awaiting-review" && d.dueBy?.startsWith("2026-11-13"))
    .sort((a, b) => (a.dueBy ?? "").localeCompare(b.dueBy ?? ""))
    .slice(0, 3);
  const unmatched = DOCUMENTS.find((d) => d.status === "unclassified" && !d.patientId)!;
  return (
    <Cell
      icon={<Files />}
      title="Report review"
      feature="documents"
      claim="Each report gets a reviewer, a due time and an outcome. Unmatched scans go to the front desk to identify — without opening the clinical content."
      className={className}
    >
      {queue.map((d) => {
        const reviewer = staffById(d.reviewerId ?? undefined);
        return (
          <Row
            key={d.id}
            lead={<Avatar src={reviewer?.avatar} name={reviewer?.name ?? ""} size="md" />}
            title={d.title}
            meta={
              <>
                {pname(d.patientId)} · due <span className="font-mono">{formatTime(d.dueBy!)}</span>
              </>
            }
            badge={{ tone: "warning", label: DOC_STATUS_LABEL[d.status] }}
          />
        );
      })}
      <Row
        lead={<span aria-hidden="true" className="flex size-10 shrink-0 items-center justify-center rounded-full bg-sunken text-ink"><Files size={18} /></span>}
        title="Scanned report, 3 pages"
        meta={`Front desk · uploaded ${formatTime(unmatched.uploadedAt)}`}
        badge={{ tone: "neutral", label: DOC_STATUS_LABEL[unmatched.status] }}
      />
    </Cell>
  );
}

/* ------------------------------------------------------------ front-desk queue */

function QueueCell({ className }: { className?: string }) {
  const tokens = TODAY_APPOINTMENTS.filter((a) => a.token && ["in-session", "arrived", "waiting"].includes(a.status));
  const missing = tokens.filter((a) => a.formsComplete === false).length;
  return (
    <Cell
      icon={<Queue />}
      title="Front-desk queue"
      feature="queue"
      claim="Tokens, arrivals and walk-ins on one screen, with missing intake forms flagged before the patient reaches the consult room."
      className={className}
    >
      {tokens.map((a) => (
        <Row
          key={a.id}
          lead={<span className="flex h-10 w-12 shrink-0 items-center justify-center rounded-full bg-sunken font-mono text-xs text-ink">{a.token}</span>}
          title={pname(a.patientId)}
          meta={`${formatTime(a.start)} · ${a.room}${a.kind === "walk-in" ? " · walk-in" : ""}`}
          badge={{ tone: appointmentTone(a.status), label: APPOINTMENT_STATUS_LABEL[a.status] }}
        />
      ))}
      <p className="flex items-center gap-2 rounded-inner bg-warning-soft px-4 py-3 text-xs text-warning">
        <span aria-hidden="true" className="size-1.5 rounded-full bg-warning" />
        {missing === 1 ? "1 intake form" : `${missing} intake forms`} missing in the queue right now
      </p>
    </Cell>
  );
}

/* ------------------------------------------------------------ patient portal */

function PortalCell({ className }: { className?: string }) {
  const next = TODAY_APPOINTMENTS.find((a) => a.id === "a-1100")!;
  const plan = NUTRITION_PLANS.find((p) => p.patientId === "p-kabir")!;
  const action = CARE_PLAN.actions.find((a) => a.owner === "p-kabir")!;
  const thread = THREADS.find((t) => t.patientId === "p-kabir" && t.channel === "patient")!;
  const rows = [
    { icon: <CalendarBlank />, label: "My next appointment", value: `Today ${formatTime(next.start)} · ${sname(next.staffId)}` },
    { icon: <BowlFood />, label: "My current plan", value: `Nutrition plan v${plan.version} · published ${short(plan.updatedAt)}` },
    { icon: <ListChecks />, label: "What I should do today", value: `${action.label} · due ${short(action.due)}` },
    { icon: <ChatCircleDots />, label: "How I contact the team", value: thread.expectedResponse },
  ];
  return (
    <Cell
      icon={<DeviceMobile />}
      title="Patient portal"
      feature="portal"
      claim="Patients see their next appointment, current plan and what to do today. Anything they log stays marked as self-reported until a practitioner reviews it."
      className={className}
    >
      <div className="rounded-inner bg-surface p-4">
        <p className="text-xs text-muted">Patient view · {pname("p-kabir")}</p>
        <ul className="mt-3 flex flex-col gap-3">
          {rows.map((r) => (
            <li key={r.label} className="flex items-center gap-3">
              <span aria-hidden="true" className="flex size-10 shrink-0 items-center justify-center rounded-full bg-sunken text-ink [&_svg]:size-[18px]">
                {r.icon}
              </span>
              <span className="min-w-0">
                <span className="block text-xs text-muted">{r.label}</span>
                <span className="block truncate text-sm text-ink">{r.value}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>
    </Cell>
  );
}

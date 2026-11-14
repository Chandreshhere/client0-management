import type { ReactNode } from "react";
import { ArrowsLeftRight, BowlFood, FileText, Heartbeat, NotePencil, PersonSimpleTaiChi, TestTube, WarningCircle } from "@phosphor-icons/react/ssr";
import { CARE_PLAN } from "@/data/featured";
import { NUTRITION_PLANS, CLASSES } from "@/data/programs";
import { patientById } from "@/data/patients";
import { PLANS } from "@/data/plans";
import { DEMO_USER, ROLE_ORDER, staffById } from "@/data/staff";
import type { Role } from "@/data/types";
import { Avatar } from "@/components/ui/avatar";
import { EagerAvatarStack } from "./eager-avatars";
import { StatusBadge, type Tone } from "@/components/ui/status";
import { cn } from "@/lib/cn";
import { formatDate } from "@/lib/format";
import { Section, SectionIntro } from "./section";
import s from "./motion.module.css";

/**
 * "Three disciplines, one record" (doc §2). Each discipline is a recessed group (the reference's
 * grey container) holding white insets with real fixture rows; threads converge into the one
 * cobalt element of the section — the shared record.
 */

const name = (id: string) => patientById(id)?.name ?? "Patient";
const kabir = patientById("p-kabir")!;
const sunrise = CLASSES.find((c) => c.id === "c-sunrise-13")!;
const count = (state: string) => sunrise.enrolled.filter((e) => e.attendance === state).length;
const kabirPlan = NUTRITION_PLANS.find((p) => p.patientId === "p-kabir")!;
const arunPlan = NUTRITION_PLANS.find((p) => p.patientId === "p-arun")!;
const aditiPlan = NUTRITION_PLANS.find((p) => p.patientId === "p-aditi")!;
const kabirInClass = sunrise.enrolled.find((e) => e.patientId === "p-kabir")!;

type Row = { icon: ReactNode; title: string; meta: string; badge: { tone: Tone; label: string } };
type Discipline = { role: Role; dot: string; question: string; rows: Row[]; does: string[] };

const DISCIPLINES: Discipline[] = [
  {
    role: "doctor",
    dot: "bg-medical",
    question: "Who am I seeing today, and what still needs my signature?",
    rows: [
      { icon: <TestTube />, title: "Lipid profile", meta: `${name("p-kabir")} · reported 11 Nov, uploaded 12 Nov`, badge: { tone: "warning", label: "Awaiting review" } },
      { icon: <FileText />, title: "Consultation note", meta: `${name("p-vivek")} · seen 4 Nov`, badge: { tone: "draft", label: "Draft" } },
      { icon: <ArrowsLeftRight />, title: "Assigned to nutrition", meta: `${name("p-arun")} · assigned 11 Nov`, badge: { tone: "danger", label: "Not seen" } },
    ],
    does: ["Pre-consultation summary", "Notes with drafts, signing and addenda", "Report-review inbox with due dates", "Assignments to nutrition and yoga: assigned → seen"],
  },
  {
    role: "nutritionist",
    dot: "bg-nutrition",
    question: "Whose plan needs publishing, and who is drifting from it?",
    rows: [
      { icon: <BowlFood />, title: `Heart-healthy vegetarian · v${kabirPlan.version}`, meta: `${name("p-kabir")} · published ${formatDate(kabirPlan.updatedAt, { day: "numeric", month: "short" })}`, badge: { tone: "success", label: "Published" } },
      { icon: <BowlFood />, title: `Post-MI, DASH-style · v${arunPlan.version}`, meta: `${name("p-arun")} · ${arunPlan.adherenceNote.toLowerCase()}`, badge: { tone: "draft", label: "Draft" } },
      { icon: <NotePencil />, title: "Breakfast skipped 3 of 7 days", meta: `${name(aditiPlan.patientId)} · food log`, badge: { tone: "neutral", label: "Self-reported" } },
    ],
    does: ["Meal plans with alternatives", "Versions: what changed, why, by whom", "Patient food logs on Pro, kept as self-reported", "Doctor guidance beside the plan"],
  },
  {
    role: "yoga",
    dot: "bg-movement",
    question: "Which sessions am I running, who is coming, and what guidance applies?",
    rows: [
      { icon: <PersonSimpleTaiChi />, title: sunrise.title, meta: `07:30 · ${count("present")} present, ${count("late")} late, ${count("absent")} absent`, badge: { tone: "success", label: "Marked" } },
      { icon: <Heartbeat />, title: kabirInClass.precaution ?? "Approved precautions", meta: `${name("p-kabir")} · from Dr. Ananya Rao`, badge: { tone: "info", label: "Current" } },
      { icon: <WarningCircle />, title: "Dizziness during class", meta: `${name("p-arun")} · escalated to his doctor`, badge: { tone: "danger", label: "Urgent task" } },
    ],
    does: ["Class and 1:1 calendar", "Clinician-approved precautions", "Attendance and private observations", "Flag a concern to the doctor"],
  },
];

/** Every other role and the plans that include it (from plan data): "Every plan", "Clinic+", "Pro". */
const OTHER_ROLES = ROLE_ORDER.filter((r) => !["doctor", "nutritionist", "yoga"].includes(r)).map((r) => {
  const first = PLANS.findIndex((p) => p.roles.includes(r));
  const plan = PLANS[first];
  return { role: r, plan: !plan ? "—" : first === 0 ? "Every plan" : first < PLANS.length - 1 ? `${plan.name}+` : plan.name };
});

export function Disciplines() {
  return (
    <Section id="product" nav="product" labelledBy="product-title">
      <SectionIntro
        id="product-title"
        eyebrow="Workspaces"
        title="Why does each practitioner in your clinic keep a different version of the same patient?"
        lead="Because most clinic software is built for one discipline. Carelane gives the doctor, the nutritionist and the yoga instructor their own workspace on top of one shared record — each sees what their work needs, and every note, plan and session lands on the same timeline."
      />

      <div className={cn("mt-12 md:mt-16", s.threadScope)}>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {DISCIPLINES.map((d) => (
            <DisciplineGroup key={d.role} d={d} />
          ))}
        </div>

        {/* threads: three workspaces → one record */}
        <svg aria-hidden="true" viewBox="0 0 1200 96" preserveAspectRatio="none" className="hidden h-24 w-full lg:block">
          {[
            { d: "M200,0 C200,56 600,40 600,96", c: "var(--color-medical)" },
            { d: "M600,0 L600,96", c: "var(--color-nutrition)" },
            { d: "M1000,0 C1000,56 600,40 600,96", c: "var(--color-movement)" },
          ].map((p) => (
            // No vector-effect: non-scaling-stroke breaks pathLength-normalised dashes (the draw-in).
            <path key={p.d} d={p.d} pathLength={1} fill="none" stroke={p.c} strokeWidth={1.5} strokeLinecap="round" className={s.threadDraw} />
          ))}
        </svg>
        <div aria-hidden="true" className="mx-auto h-8 w-px bg-line-strong lg:hidden" />

        <SharedRecord />
      </div>

      <div className={cn("mt-8 flex flex-col gap-4 rounded-card bg-surface p-6 md:flex-row md:items-center md:justify-between", s.reveal)}>
        <p className="max-w-[44ch] text-sm text-ink-2">Administration on every plan, reception on Clinic, care coordination and the patient on Pro — each with its own workspace on the same record.</p>
        <ul className="flex flex-wrap gap-2">
          {OTHER_ROLES.map((o) => (
            <li key={o.role} className="inline-flex h-8 items-center gap-2 rounded-full bg-sunken pl-3 pr-1 text-xs text-ink-2">
              {DEMO_USER[o.role].label}
              <span className="inline-flex h-6 items-center rounded-full bg-surface px-2 text-[11px] text-muted">{o.plan}</span>
            </li>
          ))}
        </ul>
      </div>
    </Section>
  );
}

function DisciplineGroup({ d }: { d: Discipline }) {
  const person = staffById(DEMO_USER[d.role].personId);
  return (
    <article className={cn("flex flex-col rounded-card bg-sunken p-2", s.reveal)} aria-labelledby={`ws-${d.role}`}>
      <header className="p-4">
        <div className="flex items-center justify-between gap-3">
          <span className="inline-flex items-center gap-2 text-xs text-muted">
            <span aria-hidden="true" className={cn("size-2 rounded-full", d.dot)} />
            {DEMO_USER[d.role].label} workspace
          </span>
          {person ? (
            <span className="inline-flex min-w-0 items-center gap-2 text-xs text-ink-2">
              <Avatar src={person.avatar} name={person.name} size="xs" loading="eager" />
              <span className="truncate">{person.name}</span>
            </span>
          ) : null}
        </div>
        <h3 id={`ws-${d.role}`} className="mt-4 text-[20px] font-normal leading-[1.2] tracking-[-0.012em] text-ink">
          {d.question}
        </h3>
      </header>
      <ul className="flex flex-col gap-2">
        {d.rows.map((r) => (
          <li key={r.title} className="flex items-center gap-3 rounded-inner bg-surface p-4">
            <span aria-hidden="true" className="flex size-10 shrink-0 items-center justify-center rounded-full bg-sunken text-ink [&_svg]:size-[18px]">
              {r.icon}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm text-ink">{r.title}</span>
              <span className="block truncate text-xs text-muted">{r.meta}</span>
            </span>
            <StatusBadge tone={r.badge.tone} className="shrink-0">
              {r.badge.label}
            </StatusBadge>
          </li>
        ))}
      </ul>
      <ul className="mt-auto grid grid-cols-1 gap-2 p-4 pt-6 text-sm text-ink-2">
        {d.does.map((x) => (
          <li key={x} className="flex items-center gap-3">
            <span aria-hidden="true" className="size-1.5 shrink-0 rounded-full bg-faint" />
            {x}
          </li>
        ))}
      </ul>
    </article>
  );
}

function SharedRecord() {
  const team = [CARE_PLAN.responsible, kabirPlan.authorId, sunrise.instructorId].map((id) => staffById(id)).filter((p): p is NonNullable<typeof p> => !!p);
  return (
    <div className={cn("mx-auto flex max-w-[760px] flex-col gap-4 rounded-card bg-primary p-6 text-white sm:flex-row sm:items-center", s.reveal)}>
      <Avatar src={kabir.avatar} name={kabir.name} size="lg" loading="eager" className="ring-2 ring-white/30" />
      <div className="min-w-0 flex-1">
        <p className="text-xs text-white/70">One shared record</p>
        <p className="mt-1 text-[22px] font-light leading-tight tracking-[-0.015em]">
          {kabir.name} · {CARE_PLAN.episode}
        </p>
        <p className="mt-2 text-xs text-white/70">Medical, nutrition and movement entries on one timeline — each with its author, date and state.</p>
      </div>
      <span className="sr-only">Care team: {team.map((p) => p.name).join(", ")}</span>
      <EagerAvatarStack people={team.map((p) => ({ name: p.name, avatar: p.avatar }))} size="md" />
    </div>
  );
}

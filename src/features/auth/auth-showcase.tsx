"use client";

import { motion, useReducedMotion } from "motion/react";
import type { ReactNode } from "react";
import type { Icon } from "@phosphor-icons/react";
import { ArrowUpRight, BowlFood, FileText, PersonSimpleTaiChi, Stethoscope, TestTube } from "@phosphor-icons/react";
import { Avatar } from "@/components/ui/avatar";
import { Pill } from "@/components/ui/pill";
import { FEATURED_PATIENT_ID, patientById } from "@/data/patients";
import { REFERRALS, REFERRAL_STAGES, REFERRAL_STAGE_LABEL } from "@/data/care";
import { staffById } from "@/data/staff";
import { formatDate } from "@/lib/format";
import { pop, snappy, spring } from "@/lib/motion";
import { cn } from "@/lib/cn";

/**
 * Cobalt showcase for the sign-in screens: a calm vignette assembled from the app's own pieces
 * (patient identity card, glass referral card with its five-stage stepper, a sliver of the care
 * timeline) joined by the reference's threads. Threads stand for documented associations
 * (stage → event), never causation. Decorative, so it is hidden from assistive tech; the one
 * sentence below it carries the meaning.
 *
 * Geometry is a fixed 600×440 stage (xl+) so every thread endpoint is known exactly.
 */

const patient = patientById(FEATURED_PATIENT_ID);
const referral = REFERRALS.find((r) => r.patientId === FEATURED_PATIENT_ID && r.toDiscipline === "nutrition");
const movementReferral = REFERRALS.find((r) => r.patientId === FEATURED_PATIENT_ID && r.toDiscipline === "movement");

const W = 600;
const H = 440;
const CARD_W = 300;
/** Glass referral card top; stepper rows are 24px tall starting 124px below it. */
const GLASS_Y = 88;
const stageY = (i: number) => GLASS_Y + 124 + 12 + 24 * i;
/** Timeline sliver card. */
const TL = { x: 360, y: 24, w: 240, rowH: 88, pad: 16 };
const rowY = (row: number) => TL.y + TL.pad + TL.rowH * row + TL.rowH / 2;
const BUBBLE = 40;
const CHIP = { x: 16, y: 372, w: 224, h: 32 };

const MONTHS = ["August", "September", "October", "November"] as const;

type Bubble = { id: string; icon: Icon; x: number; row: number; scheduled?: boolean };
const BUBBLES: Bubble[] = [
  { id: "sep-consult", icon: Stethoscope, x: 376, row: 1 },
  { id: "sep-nutrition", icon: BowlFood, x: 402, row: 1 },
  { id: "sep-note", icon: FileText, x: 428, row: 1 },
  { id: "oct-yoga-1", icon: PersonSimpleTaiChi, x: 380, row: 2 },
  { id: "oct-yoga-2", icon: PersonSimpleTaiChi, x: 436, row: 2 },
  { id: "oct-plan", icon: BowlFood, x: 462, row: 2 },
  { id: "nov-lab", icon: TestTube, x: 384, row: 3 },
  { id: "nov-consult", icon: Stethoscope, x: 440, row: 3, scheduled: true },
];
const MUTED_DOTS = [
  { x: 392, row: 0, d: 9 },
  { x: 446, row: 0, d: 6 },
  { x: 488, row: 1, d: 6 },
];

const centre = (id: string): [number, number] => {
  const b = BUBBLES.find((x) => x.id === id)!;
  return [b.x + BUBBLE / 2, rowY(b.row)];
};

const THREADS: { id: string; from: [number, number]; to: string }[] = [
  { id: "requested", from: [CARD_W, stageY(0)], to: "sep-consult" },
  { id: "booked", from: [CARD_W, stageY(2)], to: "sep-nutrition" },
  { id: "completed", from: [CARD_W, stageY(3)], to: "sep-nutrition" },
  { id: "acknowledged", from: [CARD_W, stageY(4)], to: "sep-note" },
  { id: "yoga-1", from: [CHIP.x + CHIP.w, CHIP.y + CHIP.h / 2], to: "oct-yoga-1" },
  { id: "yoga-2", from: [CHIP.x + CHIP.w, CHIP.y + CHIP.h / 2], to: "oct-yoga-2" },
];

function threadPath([sx, sy]: [number, number], [tx, ty]: [number, number]) {
  const dx = Math.max(32, (tx - sx) * 0.5);
  return `M${sx},${sy} C${sx + dx},${sy} ${tx - dx},${ty} ${tx},${ty}`;
}

const rise = (delay: number) => ({
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  transition: { ...spring, delay },
});

export function AuthShowcase() {
  return (
    <div className="relative flex h-full flex-col justify-between overflow-hidden rounded-card bg-primary p-8 text-white short:p-6">
      <div>
        <Pill tone="instances-light" className="text-white">
          Prototype · synthetic patients
        </Pill>
      </div>

      <div aria-hidden="true" className="flex flex-1 items-center py-8 short:py-4">
        {patient && referral ? (
          <>
            <Stage />
            <div className="flex w-[300px] flex-col gap-4 xl:hidden">
              <PatientCard />
              <ReferralCard />
              <YogaChip />
            </div>
          </>
        ) : null}
      </div>

      <p className="max-w-[26ch] text-[32px] font-light leading-[1.1] tracking-[-0.02em] text-white short:text-[26px]">
        One patient record, shared by the doctor, the nutritionist and the yoga instructor.
      </p>
    </div>
  );
}

/**
 * Threads are drawn twice from the same geometry: white strokes beneath the timeline card
 * (visible over cobalt) and cobalt strokes above it, clipped to the card's x-range. Same
 * path + same delay keeps both draw-ins in sync, with no gradient paint server needed.
 */
function Threads({ tone }: { tone: "white" | "cobalt" }) {
  const onCard = tone === "cobalt";
  const reduce = useReducedMotion();
  return (
    <svg
      className={cn("pointer-events-none absolute inset-0 overflow-visible", onCard ? "z-[2]" : "z-0")}
      style={onCard ? { clipPath: `inset(0 0 0 ${TL.x}px)` } : undefined}
      width={W}
      height={H}
      viewBox={`0 0 ${W} ${H}`}
    >
      {THREADS.map((t, i) => (
        <motion.path
          key={t.id}
          d={threadPath(t.from, centre(t.to))}
          fill="none"
          stroke={onCard ? "var(--color-primary)" : "#ffffff"}
          strokeOpacity={onCard ? 0.9 : 0.72}
          strokeWidth={1.25}
          strokeLinecap="round"
          // `initial` must match between server and client (useReducedMotion differs across the
          // two), so reduced motion only changes the transition: the threads appear at once.
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={
            reduce
              ? { duration: 0 }
              : {
                  pathLength: { type: "spring", stiffness: 60, damping: 20, delay: 0.8 + i * 0.11 },
                  opacity: { duration: 0.01, delay: 0.8 + i * 0.11 },
                }
          }
        />
      ))}
    </svg>
  );
}

function Stage() {
  return (
    // zoom (not transform) so the stage's layout box grows with it on wide panels
    <div className="relative hidden shrink-0 xl:block min-[1680px]:[zoom:1.2] min-[1880px]:[zoom:1.3]" style={{ width: W, height: H }}>
      <Threads tone="white" />
      {/* timeline sliver (white card, month rows, muted dots) */}
      <motion.div
        {...rise(0.2)}
        className="absolute z-[1] rounded-card bg-surface"
        style={{ left: TL.x, top: TL.y, width: TL.w, height: TL.pad * 2 + TL.rowH * MONTHS.length }}
      >
        <ol className="flex flex-col" style={{ padding: TL.pad }}>
          {MONTHS.map((m, i) => {
            const today = i === MONTHS.length - 1;
            return (
              <li key={m} className="flex items-center justify-end" style={{ height: TL.rowH }}>
                <span className={cn("text-right text-xs", today ? "font-medium text-ink" : "text-muted")}>
                  {m}
                  {today ? <span className="block text-[11px] font-normal text-muted">Today · 13</span> : null}
                </span>
              </li>
            );
          })}
        </ol>
      </motion.div>
      {MUTED_DOTS.map((d, i) => (
        <motion.span
          key={i}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ ...spring, delay: 0.5 }}
          className="absolute z-[1] rounded-full bg-line-strong"
          style={{ left: d.x, top: rowY(d.row) - d.d / 2, width: d.d, height: d.d }}
        />
      ))}

      <Threads tone="cobalt" />

      {/* event bubbles (above threads) */}
      {BUBBLES.map((b, i) => (
        <motion.span
          key={b.id}
          initial={{ opacity: 0, scale: 0.3 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ ...pop, delay: 0.35 + i * 0.05 }}
          className={cn(
            "absolute z-[3] flex items-center justify-center rounded-full ring-[3px] ring-surface",
            b.scheduled ? "bg-surface text-primary shadow-[inset_0_0_0_1.5px_var(--color-primary)]" : "bg-primary text-white",
          )}
          style={{ left: b.x, top: rowY(b.row) - BUBBLE / 2, width: BUBBLE, height: BUBBLE }}
        >
          {b.scheduled ? <span className="absolute inset-0 -z-[1] rounded-full bg-primary/25 animate-pulse-ring" /> : null}
          <b.icon size={18} />
        </motion.span>
      ))}

      <motion.div {...rise(0.05)} className="absolute left-0 top-0">
        <PatientCard />
      </motion.div>
      <motion.div {...rise(0.12)} className="absolute left-0" style={{ top: GLASS_Y }}>
        <ReferralCard />
      </motion.div>
      <motion.div {...rise(0.28)} className="absolute" style={{ left: CHIP.x, top: CHIP.y }}>
        <YogaChip />
      </motion.div>
    </div>
  );
}

function PatientCard() {
  if (!patient) return null;
  const programme = patient.program?.split(" · ")[0];
  return (
    <div className="flex h-16 items-center gap-3 rounded-card bg-surface p-2 text-ink" style={{ width: CARD_W }}>
      <Avatar src={patient.avatar} name={patient.name} size="lg" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{patient.name}</p>
        <p className="truncate text-xs text-muted">
          {patient.age} years old{programme ? ` · ${programme}` : ""}
        </p>
      </div>
      <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-sunken">
        <ArrowUpRight size={18} />
      </span>
    </div>
  );
}

function ReferralCard() {
  if (!referral) return null;
  const from = staffById(referral.fromId);
  const to = staffById(referral.toId);
  return (
    <div className="glass-dark rounded-card p-4 text-white" style={{ width: CARD_W }}>
      <div className="flex h-8 items-center justify-between">
        <Pill tone="instances-light" className="text-white">
          Referral · Nutrition
        </Pill>
        <span className="flex size-8 items-center justify-center rounded-full bg-white text-ink">
          <ArrowUpRight size={16} />
        </span>
      </div>
      <p className="mt-4 truncate text-[18px] font-light leading-6 tracking-[-0.01em]">Heart-healthy vegetarian plan</p>
      <p className="mt-1 truncate text-xs leading-4 text-white/75">
        {from?.name ?? "Doctor"} → {to?.name ?? "Nutritionist"}
      </p>
      <ol className="relative mt-4">
        {REFERRAL_STAGES.map((stage, i) => {
          const date = referral.stageDates[stage];
          const delay = 0.6 + i * 0.3;
          return (
            <li key={stage} className="relative flex h-6 items-center gap-3">
              {i > 0 ? <Segment delay={delay - 0.12} /> : null}
              <motion.span
                initial={{ opacity: 0.3, scale: 0.6 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ ...pop, delay }}
                className="relative z-[1] size-2.5 shrink-0 rounded-full bg-white"
              />
              <span className="text-xs">{REFERRAL_STAGE_LABEL[stage]}</span>
              <span className="ml-auto text-[11px] tabular text-white/75">{date ? formatDate(date, { day: "numeric", month: "short" }) : "—"}</span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/** Line between two stepper dots; fills top-down as the referral advances. */
function Segment({ delay }: { delay: number }) {
  return (
    <span className="absolute left-[4px] top-[-12px] h-6 w-0.5 overflow-hidden rounded-full bg-white/20">
      <motion.span initial={{ scaleY: 0 }} animate={{ scaleY: 1 }} transition={{ ...snappy, delay }} className="block size-full origin-top bg-white" />
    </span>
  );
}

function YogaChip(): ReactNode {
  return (
    <Pill tone="condition" icon={<PersonSimpleTaiChi />} className="h-8 justify-start bg-white/90 text-ink" style={{ width: CHIP.w }}>
      Cardiac rehab yoga
      <span className="text-muted">· {movementReferral?.stage === "completed" ? "Completed" : "In progress"}</span>
    </Pill>
  );
}

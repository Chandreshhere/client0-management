"use client";

import type { Icon } from "@phosphor-icons/react";
import { CalendarBlank, CaretLeft, CaretRight, ClipboardText, CurrencyInr, Path, Plus, ShieldWarning, Users, Warning } from "@phosphor-icons/react";
import type { PatientStatus } from "@/data/types";
import { PATIENT_STATUS_LABEL } from "@/data/patients";
import { APPOINTMENT_STATUS_LABEL } from "@/data/appointments";
import { staffById } from "@/data/staff";
import { formatDate, formatINR, formatTime } from "@/lib/format";
import { cn } from "@/lib/cn";
import { usePlan } from "@/components/shell/role-context";
import { Avatar, AvatarStack } from "@/components/ui/avatar";
import { IconButton } from "@/components/ui/icon-button";
import { StatusBadge, appointmentTone, type Tone } from "@/components/ui/status";
import { Tip } from "@/components/ui/tooltip";
import { FLAG_LABEL, dayWord, isLive, precautionsFor, type FlagId, type RegistryLens, type RegistryPatient, type Visit } from "./data";
import { OrganGlyph } from "./organ-glyph";

/** Small presentational pieces shared by the registry table, the cards and the summary. */

export const STATUS_TONE: Record<PatientStatus, Tone> = {
  "needs-attention": "warning",
  onboarding: "info",
  active: "success",
  completed: "neutral",
};

export function PatientStatusBadge({ status, className }: { status: PatientStatus; className?: string }) {
  const { has } = usePlan();
  // Programmes are a Pro feature; below Pro a finished episode of care is just "Care complete".
  const label = status === "completed" && !has("programmes") ? "Care complete" : PATIENT_STATUS_LABEL[status];
  return (
    <StatusBadge tone={STATUS_TONE[status]} className={className}>
      {label}
    </StatusBadge>
  );
}

const FLAG_STYLE: Record<FlagId, { cls: string; icon: Icon }> = {
  duplicate: { cls: "bg-primary-soft text-primary-ink", icon: Users },
  intake: { cls: "bg-sunken text-ink-2", icon: ClipboardText },
  rebook: { cls: "bg-warning-soft text-warning", icon: CalendarBlank },
  balance: { cls: "bg-sunken text-ink-2", icon: CurrencyInr },
  allergies: { cls: "bg-warning-soft text-warning", icon: Warning },
};

export function flagText(flag: FlagId, patient: RegistryPatient) {
  return flag === "balance" ? `${formatINR(patient.balanceDue)} due` : FLAG_LABEL[flag];
}

export function FlagPill({ flag, patient, onClick }: { flag: FlagId; patient: RegistryPatient; onClick?: () => void }) {
  const s = FLAG_STYLE[flag];
  const Glyph = s.icon;
  const cls = cn("inline-flex h-6 items-center gap-1 whitespace-nowrap rounded-full px-2 text-xs", s.cls);
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={cn(cls, "underline decoration-current/30 underline-offset-2 transition-[text-decoration-color] hover:decoration-current")}>
        <Glyph size={14} aria-hidden="true" className="shrink-0" />
        {flagText(flag, patient)}
        <span className="sr-only"> — review</span>
      </button>
    );
  }
  return (
    <span className={cls}>
      <Glyph size={14} aria-hidden="true" className="shrink-0" />
      {flagText(flag, patient)}
    </span>
  );
}

/**
 * Flags with a "+N" overflow. Balance is hidden for roles without billing permission; the admin
 * can open a possible duplicate from its flag.
 */
export function FlagPills({
  flags,
  patient,
  max = 2,
  showBalance,
  quietWhenEmpty,
  onDuplicate,
}: {
  flags: FlagId[];
  patient: RegistryPatient;
  max?: number;
  showBalance: boolean;
  quietWhenEmpty?: boolean;
  onDuplicate?: () => void;
}) {
  const visible = flags.filter((f) => f !== "balance" || showBalance);
  if (!visible.length) {
    if (quietWhenEmpty) return null;
    return (
      <span className="text-xs text-muted">
        <span aria-hidden="true">—</span>
        <span className="sr-only">No flags</span>
      </span>
    );
  }
  const shown = visible.slice(0, max);
  const rest = visible.slice(max);
  return (
    <div className="flex flex-wrap gap-1">
      {shown.map((f) => (
        <FlagPill key={f} flag={f} patient={patient} onClick={f === "duplicate" ? onDuplicate : undefined} />
      ))}
      {rest.length ? (
        <Tip label={rest.map((f) => flagText(f, patient)).join(" · ")}>
          <span tabIndex={0} className="inline-flex h-6 items-center rounded-full bg-sunken px-2 text-xs text-ink-2 tabular outline-none focus-visible:outline-2 focus-visible:outline-primary">
            +{rest.length}
            <span className="sr-only"> more: {rest.map((f) => flagText(f, patient)).join(", ")}</span>
          </span>
        </Tip>
      ) : null}
    </div>
  );
}

const lastVisitWord = (iso: string) => {
  const d = dayWord(iso);
  return d === "Today" || d === "Yesterday" ? d.toLowerCase() : formatDate(iso, { day: "numeric", month: "short" });
};

/**
 * "Today 12:00" + service, or the live queue state, or "Not booked" + last visit. Without the
 * diary (Core) it is the follow-up date on the record — no time, no queue state.
 */
export function NextVisitLine({ visit, last, className, diary = true }: { visit: Visit | null; last: string | null; className?: string; diary?: boolean }) {
  if (!diary) {
    return (
      <div className={cn("min-w-0", className)}>
        <p className="whitespace-nowrap text-sm text-ink-2">{visit ? dayWord(visit.start) : "Not set"}</p>
        <p className="truncate text-xs text-muted">{last ? `Last visit ${lastVisitWord(last)}` : "No visits yet"}</p>
      </div>
    );
  }
  if (!visit) {
    return (
      <div className={cn("min-w-0", className)}>
        <p className="text-sm text-ink-2">Not booked</p>
        <p className="truncate text-xs text-muted">{last ? `Last visit ${lastVisitWord(last)}` : "No visits yet"}</p>
      </div>
    );
  }
  return (
    <div className={cn("min-w-0", className)}>
      <p className="flex items-baseline gap-1.5 whitespace-nowrap text-sm text-ink">
        {dayWord(visit.start)}
        <span className="font-mono text-xs text-ink-2">{formatTime(visit.start)}</span>
      </p>
      {isLive(visit) ? (
        <StatusBadge tone={appointmentTone(visit.status)} className="mt-1">
          {APPOINTMENT_STATUS_LABEL[visit.status]}
        </StatusBadge>
      ) : (
        <p className="truncate text-xs text-muted">{visit.service ?? "Booked visit"}</p>
      )}
    </div>
  );
}

export function CareTeamStack({ ids, onAssign, max = 4 }: { ids: string[]; onAssign?: () => void; max?: number }) {
  const people = ids.map((id) => staffById(id)).filter((s): s is NonNullable<typeof s> => !!s);
  if (!people.length) {
    return onAssign ? (
      <button
        type="button"
        onClick={onAssign}
        className="inline-flex h-8 items-center gap-1.5 rounded-full pl-1 pr-3 text-xs text-ink-2 transition-colors hover:bg-sunken hover:text-ink"
      >
        <span className="flex size-6 items-center justify-center rounded-full border border-dashed border-line-strong text-muted" aria-hidden="true">
          <Plus size={12} />
        </span>
        Assign
      </button>
    ) : (
      <span className="text-xs text-muted">Not assigned</span>
    );
  }
  const names = people.map((p) => p.name).join(", ");
  return (
    <Tip label={names}>
      <span className="inline-flex">
        <AvatarStack people={people.map((p) => ({ name: p.name, avatar: p.avatar }))} max={max} size="sm" />
        <span className="sr-only">Care team: {names}</span>
      </span>
    </Tip>
  );
}

export const CONCERN_HEADER: Record<RegistryLens["concern"], string> = {
  diagnosis: "Primary concern",
  precautions: "Precautions",
  none: "Programme",
};

/**
 * The concern cell for clinical roles: the concern with its organ (doctor, nutritionist), the
 * doctor's precautions (yoga — never a diagnosis), or the programme (coordinator).
 */
export function ConcernCell({ patient: p, lens, programmeBelow, onOpen, className }: { patient: RegistryPatient; lens: RegistryLens; programmeBelow?: string; onOpen?: () => void; className?: string }) {
  if (lens.concern === "none") {
    return (
      <div className={cn("flex min-w-0 items-center gap-2", className)}>
        <Path size={16} aria-hidden="true" className="shrink-0 text-muted" />
        <p className="line-clamp-2 text-ink-2">{p.program ?? <span className="text-muted">No programme</span>}</p>
      </div>
    );
  }
  if (lens.concern === "precautions") {
    const pr = p.local ? null : precautionsFor(p.id);
    return (
      <div className={cn("flex min-w-0 items-start gap-2", className)}>
        <ShieldWarning size={16} aria-hidden="true" className={cn("mt-0.5 shrink-0", pr?.changed ? "text-warning" : "text-muted")} />
        <div className="min-w-0">
          <p className="text-pretty text-ink-2">{pr?.text ?? <span className="text-muted">No precautions recorded</span>}</p>
          {pr?.changed ? <p className="text-xs text-warning">Changed — acknowledge before the next session</p> : null}
        </div>
      </div>
    );
  }
  const concern = p.primaryConcern || <span className="text-muted">Not recorded yet</span>;
  return (
    <div className={cn("flex min-w-0 items-start gap-3", className)}>
      <OrganGlyph patient={p} />
      <div className="min-w-0 flex-1">
        {onOpen ? (
          <button type="button" onClick={onOpen} className="text-left text-sm leading-snug text-ink-2 hover:text-ink">
            {concern}
          </button>
        ) : (
          <p className="text-pretty text-ink-2">{concern}</p>
        )}
        {p.local ? (
          <p className="mt-0.5 truncate text-xs text-muted">Registered in this session</p>
        ) : lens.programmes ? (
          <p className={cn("mt-0.5 flex items-center gap-1.5 truncate text-xs text-muted", programmeBelow)}>
            <Path size={14} aria-hidden="true" className="shrink-0" />
            <span className="truncate">{p.program ?? "No programme"}</span>
          </p>
        ) : null}
      </div>
    </div>
  );
}

/** Primary doctor for demographic views: avatar and name, or "Assign" for those who set care teams. */
export function PrimaryDoctor({ id, onAssign }: { id: string | undefined; onAssign?: () => void }) {
  const s = staffById(id);
  if (!s) {
    return onAssign ? (
      <button
        type="button"
        onClick={onAssign}
        className="inline-flex h-8 items-center gap-1.5 rounded-full pl-1 pr-3 text-xs text-ink-2 transition-colors hover:bg-sunken hover:text-ink"
      >
        <span className="flex size-6 items-center justify-center rounded-full border border-dashed border-line-strong text-muted" aria-hidden="true">
          <Plus size={12} />
        </span>
        Assign doctor
      </button>
    ) : (
      <span className="text-xs text-muted">Not assigned</span>
    );
  }
  return (
    <span className="flex min-w-0 items-center gap-2">
      <Avatar src={s.avatar} name={s.name} size="sm" />
      <span className="min-w-0">
        <span className="block truncate text-sm text-ink-2">{s.name}</span>
        {s.status === "on-leave" ? <span className="block truncate text-xs text-warning">On leave</span> : null}
      </span>
    </span>
  );
}

/** Registration date (Core demographic views, where there's no appointment diary). */
export function RegisteredLine({ patient, className }: { patient: RegistryPatient; className?: string }) {
  return (
    <div className={cn("min-w-0", className)}>
      <p className="whitespace-nowrap text-sm text-ink-2">{formatDate(patient.registeredAt, { day: "numeric", month: "short", year: "numeric" })}</p>
      <p className="truncate text-xs text-muted">{patient.local ? `By ${patient.local.registeredBy}` : patient.intakeComplete ? "Intake complete" : "Intake pending"}</p>
    </div>
  );
}

/** Compact table marker for allergies that were never recorded (null ≠ "no known allergies"). */
export function AllergyAlert({ allergies }: { allergies: string[] | null }) {
  if (allergies !== null) return null;
  return (
    <Tip label="Allergies not recorded — ask before prescribing">
      <span
        tabIndex={0}
        className="inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-warning-soft text-warning outline-none focus-visible:outline-2 focus-visible:outline-primary"
      >
        <Warning size={12} weight="bold" aria-hidden="true" />
        <span className="sr-only">Allergies not recorded</span>
      </span>
    </Tip>
  );
}

/** Allergy line that never turns "not recorded" into "no known allergies". */
export function AllergyLine({ allergies, className }: { allergies: string[] | null; className?: string }) {
  if (allergies === null) {
    return (
      <p className={cn("flex items-start gap-1.5 text-xs text-warning", className)}>
        <Warning size={14} className="mt-px shrink-0" aria-hidden="true" />
        Allergies not recorded — ask before prescribing
      </p>
    );
  }
  if (allergies.length === 0) return <p className={cn("text-xs text-muted", className)}>No known allergies (confirmed)</p>;
  return (
    <p className={cn("text-xs text-ink-2", className)}>
      <span className="text-muted">Allergies · </span>
      {allergies.join(", ")}
    </p>
  );
}

/** Pagination: "Showing 1–10 of 24" + numbered pages. */
export function Pager({ page, pageCount, total, pageSize, onPage, className }: { page: number; pageCount: number; total: number; pageSize: number; onPage: (p: number) => void; className?: string }) {
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  return (
    <nav aria-label="Pagination" className={cn("flex flex-wrap items-center justify-between gap-3", className)}>
      <p className="text-xs text-muted" aria-live="polite">
        Showing <span className="tabular text-ink-2">{from}–{to}</span> of <span className="tabular text-ink-2">{total}</span>
      </p>
      {pageCount > 1 ? (
        <div className="flex items-center gap-1">
          <IconButton label="Previous page" variant="ghost" size="sm" disabled={page <= 1} onClick={() => onPage(page - 1)}>
            <CaretLeft />
          </IconButton>
          {Array.from({ length: pageCount }, (_, i) => i + 1).map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => onPage(n)}
              aria-current={n === page ? "page" : undefined}
              aria-label={`Page ${n}`}
              className={cn(
                "flex size-8 items-center justify-center rounded-full text-xs tabular transition-colors duration-200",
                n === page ? "bg-charcoal text-white" : "text-ink-2 hover:bg-sunken hover:text-ink",
              )}
            >
              {n}
            </button>
          ))}
          <IconButton label="Next page" variant="ghost" size="sm" disabled={page >= pageCount} onClick={() => onPage(page + 1)}>
            <CaretRight />
          </IconButton>
        </div>
      ) : null}
    </nav>
  );
}

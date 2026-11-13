"use client";

import type { Icon } from "@phosphor-icons/react";
import { CalendarBlank, CaretLeft, CaretRight, ClipboardText, CurrencyInr, Plus, Users, Warning } from "@phosphor-icons/react";
import type { PatientStatus } from "@/data/types";
import { PATIENT_STATUS_LABEL } from "@/data/patients";
import { APPOINTMENT_STATUS_LABEL } from "@/data/appointments";
import { staffById } from "@/data/staff";
import { formatDate, formatINR, formatTime } from "@/lib/format";
import { cn } from "@/lib/cn";
import { AvatarStack } from "@/components/ui/avatar";
import { IconButton } from "@/components/ui/icon-button";
import { StatusBadge, appointmentTone, type Tone } from "@/components/ui/status";
import { Tip } from "@/components/ui/tooltip";
import { FLAG_LABEL, dayWord, isLive, type FlagId, type RegistryPatient, type Visit } from "./data";

/** Small presentational pieces shared by the registry table, the cards and the summary. */

export const STATUS_TONE: Record<PatientStatus, Tone> = {
  "needs-attention": "warning",
  onboarding: "info",
  active: "success",
  completed: "neutral",
};

export function PatientStatusBadge({ status, className }: { status: PatientStatus; className?: string }) {
  return (
    <StatusBadge tone={STATUS_TONE[status]} className={className}>
      {PATIENT_STATUS_LABEL[status]}
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

export function FlagPill({ flag, patient }: { flag: FlagId; patient: RegistryPatient }) {
  const s = FLAG_STYLE[flag];
  const Glyph = s.icon;
  return (
    <span className={cn("inline-flex h-6 items-center gap-1 whitespace-nowrap rounded-full px-2 text-xs", s.cls)}>
      <Glyph size={14} aria-hidden="true" className="shrink-0" />
      {flagText(flag, patient)}
    </span>
  );
}

/** Flags with a "+N" overflow. Balance is hidden for roles without billing permission. */
export function FlagPills({ flags, patient, max = 2, showBalance, quietWhenEmpty }: { flags: FlagId[]; patient: RegistryPatient; max?: number; showBalance: boolean; quietWhenEmpty?: boolean }) {
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
        <FlagPill key={f} flag={f} patient={patient} />
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

/** "Today 12:00" + service, or the live queue state, or "Not booked" + last visit. */
export function NextVisitLine({ visit, last, className }: { visit: Visit | null; last: string | null; className?: string }) {
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

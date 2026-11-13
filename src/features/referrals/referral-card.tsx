"use client";

import Link from "next/link";
import { ArrowRight, ArrowUpRight, Clock, DotsThree, Hourglass, ListPlus, Lock, SealCheck, UserSwitch, WarningOctagon, ArrowSquareOut } from "@phosphor-icons/react";
import { staffById } from "@/data/staff";
import { patientById } from "@/data/patients";
import { cn } from "@/lib/cn";
import { Avatar } from "@/components/ui/avatar";
import { Button, type ButtonSize } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import { StatusBadge, priorityTone } from "@/components/ui/status";
import { Tip } from "@/components/ui/tooltip";
import { Dropdown, DropdownContent, DropdownItem, DropdownSeparator, DropdownTrigger } from "@/components/ui/dropdown";
import { PRIORITY_LABEL } from "@/features/tasks/task-meta";
import { DisciplineTag, PersonInline } from "@/features/tasks/ui";
import { OrganTag } from "@/features/tasks/organ-glyph";
import { referralSystem, referralSystemLabel } from "./system";
import { STAGE_ACTION, dueText, permissionFor, referralState, stopSummary, type ReferralState } from "./meta";
import { ReferralStepper } from "./stepper";
import { useReferralActions } from "./use-referral-actions";
import type { CareReferral } from "./store";

/** One referral: who/why · progress stepper · where it stopped · the next action (role-aware). */
export function ReferralCard({ referral, onOpen, onBook }: { referral: CareReferral; onOpen: () => void; onBook: (r: CareReferral) => void }) {
  const st = referralState(referral);
  const { coverFor } = useReferralActions();
  const patient = patientById(referral.patientId);
  const cover = coverFor(referral);
  const system = referralSystem(referral);

  return (
    <article className="grid grid-cols-1 gap-5 rounded-inner bg-surface p-4 transition-shadow duration-200 hover:shadow-[inset_0_0_0_1px_var(--color-line-strong)] md:p-6 xl:grid-cols-[minmax(0,300px)_minmax(0,1fr)_auto] xl:items-center xl:gap-8">
      <div className="min-w-0">
        <div className="flex items-center gap-3">
          <Avatar src={patient?.avatar} name={patient?.name ?? "Patient"} size="md" />
          <div className="min-w-0">
            <Link href={`/patients/${referral.patientId}`} className="block truncate text-sm text-ink underline-offset-2 hover:underline">
              {patient?.name ?? "Unknown patient"}
            </Link>
            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
              <DisciplineTag discipline={referral.toDiscipline} />
              {system ? <OrganTag info={system} label={referralSystemLabel(system)} className="max-w-[160px] text-xs" /> : null}
              {referral.priority === "high" || referral.priority === "urgent" ? <StatusBadge tone={priorityTone(referral.priority)}>{PRIORITY_LABEL[referral.priority]}</StatusBadge> : null}
              {referral.local ? <StatusBadge tone="draft">New · this session</StatusBadge> : null}
            </div>
          </div>
        </div>
        <p className="mt-3 line-clamp-2 text-sm leading-relaxed text-ink-2">{referral.reason}</p>
        <div className="mt-3 flex min-w-0 items-center gap-2 text-xs text-muted">
          <PersonInline id={referral.fromId} className="min-w-0 max-w-[45%]" />
          <ArrowRight size={14} className="shrink-0" aria-label="to" />
          <PersonInline id={referral.toId} className="min-w-0 max-w-[45%]" />
        </div>
      </div>

      <div className="min-w-0">
        <ReferralStepper referral={referral} compact />
        <StopLine referral={referral} st={st} className="mt-4" />
        {cover ? (
          <p className="mt-1.5 flex items-center gap-1.5 text-xs text-warning">
            <UserSwitch size={14} aria-hidden="true" />
            {cover.waiting.name} is on leave ({cover.waiting.workingHours.replace(/^On leave /, "")}) — {cover.cover.name} can cover.
          </p>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-2 xl:flex-nowrap xl:justify-end">
        <StageAction referral={referral} st={st} onBook={onBook} />
        <ReferralMore referral={referral} st={st} onOpen={onOpen} />
        <IconButton label={`Open referral for ${patient?.name ?? "patient"}`} onClick={onOpen} tooltip="top">
          <ArrowUpRight />
        </IconButton>
      </div>
    </article>
  );
}

export function StopLine({ referral, st, className }: { referral: CareReferral; st: ReferralState; className?: string }) {
  const Icon = !st.pending ? SealCheck : st.overdue ? WarningOctagon : st.stalled ? Hourglass : Clock;
  const tone = !st.pending ? "text-success" : st.overdue ? "text-danger" : st.stalled ? "text-warning" : "text-muted";
  return (
    <p className={cn("flex items-start gap-2 text-xs", tone, className)}>
      <Icon size={16} className="mt-px shrink-0" aria-hidden="true" />
      <span>
        {stopSummary(referral, st)}
        {st.pending ? <span className="text-muted"> · {st.overdue ? `was due ${dueText(referral.dueBy)}` : `due ${dueText(referral.dueBy)}`}</span> : null}
      </span>
    </p>
  );
}

/** The one next step, enabled only for the person allowed to take it (with the reason otherwise). */
export function StageAction({ referral, st, onBook, size = "md" }: { referral: CareReferral; st: ReferralState; onBook: (r: CareReferral) => void; size?: ButtonSize }) {
  const { advance, user, role } = useReferralActions();
  if (!st.pending) {
    return (
      <StatusBadge tone="success" className="h-8 px-3">
        Loop closed
      </StatusBadge>
    );
  }
  const pending = st.pending;
  const perm = permissionFor(referral, pending, user.id, role);
  const label = STAGE_ACTION[pending];
  if (perm.allowed) {
    return (
      <Button variant="dark" size={size} onClick={() => (pending === "booked" ? onBook(referral) : advance(referral, pending))}>
        {label}
      </Button>
    );
  }
  return (
    <Tip label={perm.reason}>
      <span tabIndex={0} className="inline-flex rounded-full" aria-label={`${label} unavailable: ${perm.reason}`}>
        <Button variant="secondary" size={size} disabled tabIndex={-1} leading={<Lock />} aria-hidden="true">
          {label}
        </Button>
      </span>
    </Tip>
  );
}

function ReferralMore({ referral, st, onOpen }: { referral: CareReferral; st: ReferralState; onOpen: () => void }) {
  const { chase, reassign, coverFor, canReassign, role } = useReferralActions();
  const cover = coverFor(referral);
  const waiting = staffById(st.waitingOn ?? undefined);
  return (
    <Dropdown>
      <Tip label="More actions">
        <DropdownTrigger asChild>
          <button type="button" aria-label="More actions" className="flex size-10 shrink-0 items-center justify-center rounded-full text-ink-2 transition-colors hover:bg-sunken hover:text-ink data-[state=open]:bg-sunken">
            <DotsThree size={20} weight="bold" />
          </button>
        </DropdownTrigger>
      </Tip>
      <DropdownContent className="w-[280px]">
        <DropdownItem icon={<ArrowUpRight />} onSelect={onOpen} description="Stage timeline and notes">
          Open details
        </DropdownItem>
        {st.pending && role !== "patient" ? (
          <DropdownItem icon={<ListPlus />} onSelect={() => chase(referral)} description={`A task for you to chase ${waiting?.name ?? "the care team"}`}>
            Create follow-up task
          </DropdownItem>
        ) : null}
        {cover ? (
          <DropdownItem
            icon={<UserSwitch />}
            disabled={!canReassign}
            onSelect={() => reassign(referral)}
            description={canReassign ? `${cover.waiting.name} is on leave` : "Coordinators and admins reassign during leave"}
          >
            Reassign to {cover.cover.name}
          </DropdownItem>
        ) : null}
        <DropdownSeparator />
        <DropdownItem asChild icon={<ArrowSquareOut />}>
          <Link href={`/patients/${referral.patientId}`}>Patient record</Link>
        </DropdownItem>
      </DropdownContent>
    </Dropdown>
  );
}

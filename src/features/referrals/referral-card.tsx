"use client";

import Link from "next/link";
import { ArrowRight, ArrowUpRight, CheckCircle, Clock, WarningCircle } from "@phosphor-icons/react";
import { staffById } from "@/data/staff";
import { patientById } from "@/data/patients";
import { formatTime } from "@/lib/format";
import { cn } from "@/lib/cn";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import { StatusBadge } from "@/components/ui/status";
import { DisciplineTag, PersonInline } from "@/features/tasks/ui";
import { dayPhrase, stamp } from "@/features/tasks/time";
import { DISCIPLINE_WORD, ageText, assignmentInfo, hoursLeft, type AssignmentInfo } from "./meta";
import { useAssignmentActions } from "./use-referral-actions";
import type { CareReferral } from "./store";

/** "Guidance" for nutrition, "Precautions" for yoga — the words each discipline uses. */
export const guidanceLabel = (r: CareReferral) => (r.toDiscipline === "movement" ? "Precautions" : "Guidance");

/**
 * One assignment: who it's about and where it went · the doctor's goals and guidance · its state
 * (assigned → seen) · one action for the viewer. `routingOnly` hides the clinical text (admins
 * see routing, not clinical content — rule 3).
 */
export function AssignmentRow({ referral, onOpen, onReassign, routingOnly = false }: { referral: CareReferral; onOpen: () => void; onReassign: () => void; routingOnly?: boolean }) {
  const info = assignmentInfo(referral);
  const patient = patientById(referral.patientId);
  return (
    <article className="grid grid-cols-1 gap-4 rounded-inner bg-surface p-4 md:p-6 lg:grid-cols-[minmax(0,272px)_minmax(0,1fr)_auto] lg:items-center lg:gap-8">
      <div className="min-w-0">
        <div className="flex items-center gap-3">
          <Avatar src={patient?.avatar} name={patient?.name ?? "Patient"} size="md" />
          <div className="min-w-0">
            <Link href={`/patients/${referral.patientId}`} className="block truncate text-sm text-ink underline-offset-4 hover:underline">
              {patient?.name ?? "Unknown patient"}
            </Link>
            <DisciplineTag discipline={referral.toDiscipline} label={DISCIPLINE_WORD[referral.toDiscipline]} className="mt-1" />
          </div>
        </div>
        <div className="mt-3 flex min-w-0 items-center gap-2 text-xs text-muted">
          <PersonInline id={referral.fromId} className="min-w-0 max-w-[45%]" />
          <ArrowRight size={14} className="shrink-0" aria-label="to" />
          <PersonInline id={referral.toId} className="min-w-0 max-w-[45%]" />
        </div>
      </div>

      <div className="min-w-0">
        {routingOnly ? (
          <p className="text-sm text-muted">Goals and guidance are visible to the care team.</p>
        ) : (
          <>
            <p className="line-clamp-2 text-sm leading-relaxed text-ink">{referral.goals}</p>
            {referral.guidance ? (
              <p className="mt-1 line-clamp-2 text-xs text-ink-2">
                <span className="text-muted">{guidanceLabel(referral)}: </span>
                {referral.guidance}
              </p>
            ) : null}
          </>
        )}
        <StatusLine referral={referral} info={info} className="mt-3" />
      </div>

      <RowAction referral={referral} info={info} onOpen={onOpen} onReassign={onReassign} />
    </article>
  );
}

/** Where the assignment stands, in words: waiting (and when it comes back), back with the doctor, or seen. */
export function StatusLine({ referral, info, className }: { referral: CareReferral; info: AssignmentInfo; className?: string }) {
  const from = staffById(referral.fromId)?.name ?? "the doctor";
  const to = staffById(referral.toId)?.name ?? "the recipient";
  if (info.status === "seen") {
    return (
      <p className={cn("flex items-start gap-2 text-xs text-success", className)}>
        <CheckCircle size={16} weight="fill" className="mt-px shrink-0" aria-hidden="true" />
        <span>
          Seen {referral.seenAt ? stamp(referral.seenAt).replace(", ", " · ") : ""}
          {referral.seenBy ? <span className="text-muted"> by {staffById(referral.seenBy)?.name ?? to}</span> : null}
        </span>
      </p>
    );
  }
  if (info.status === "back") {
    return (
      <p className={cn("flex items-start gap-2 text-xs text-warning", className)}>
        <WarningCircle size={16} weight="fill" className="mt-px shrink-0" aria-hidden="true" />
        <span>
          Not seen in 48 h — back with {from}
          <span className="text-muted"> · assigned {ageText(info.hours)} ago</span>
        </span>
      </p>
    );
  }
  return (
    <p className={cn("flex items-start gap-2 text-xs text-muted", className)}>
      <Clock size={16} className="mt-px shrink-0" aria-hidden="true" />
      <span>
        <span className="text-ink-2">Assigned {ageText(info.hours)} ago · not opened yet</span> · back with {from.split(" ").slice(0, 2).join(" ")} in {hoursLeft(info)} h ({dayPhrase(info.returnsAt)} {formatTime(info.returnsAt)})
        {referral.remindedAt ? <span> · reminded {formatTime(referral.remindedAt)}</span> : null}
      </span>
    </p>
  );
}

/** The one action this viewer has on this row. */
function RowAction({ referral, info, onOpen, onReassign }: { referral: CareReferral; info: AssignmentInfo; onOpen: () => void; onReassign: () => void }) {
  const { remind, isRecipient, canFollowUp } = useAssignmentActions();
  const patient = patientById(referral.patientId)?.name ?? "patient";
  const details = (
    <IconButton label={`Details for ${patient}`} tooltip="top" onClick={onOpen}>
      <ArrowUpRight />
    </IconButton>
  );
  let action: React.ReactNode = null;
  if (isRecipient(referral)) {
    action = (
      <Button
        variant={info.status === "seen" ? "secondary" : "dark"}
        onClick={onOpen}
      >
        Open
      </Button>
    );
    return <div className="flex items-center gap-2 lg:justify-end">{action}</div>;
  }
  if (canFollowUp(referral) && info.status === "back") {
    action = (
      <Button variant="dark" onClick={onReassign}>
        Reassign
      </Button>
    );
  } else if (canFollowUp(referral) && info.status === "new") {
    action = referral.remindedAt ? (
      <StatusBadge tone="neutral" className="h-8 px-3">
        Reminded {formatTime(referral.remindedAt)}
      </StatusBadge>
    ) : (
      <Button variant="secondary" onClick={() => remind(referral)}>
        Remind
      </Button>
    );
  }
  return (
    <div className="flex items-center gap-2 lg:justify-end">
      {action}
      {details}
    </div>
  );
}

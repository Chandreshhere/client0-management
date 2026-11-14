"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, ArrowSquareOut, Check } from "@phosphor-icons/react";
import { staffById } from "@/data/staff";
import { patientById } from "@/data/patients";
import { formatTime } from "@/lib/format";
import { cn } from "@/lib/cn";
import { Dialog, SheetContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { StatusBadge } from "@/components/ui/status";
import { DisciplineTag } from "@/features/tasks/ui";
import { personById } from "@/features/tasks/people";
import { dayPhrase, stamp } from "@/features/tasks/time";
import { DISCIPLINE_WORD, assignmentInfo } from "./meta";
import { guidanceLabel } from "./referral-card";
import { useAssignmentActions } from "./use-referral-actions";
import { useReferrals, type CareReferral } from "./store";

/** Assignment drawer: who assigned whom, the goals and guidance, and the two states. */
export function AssignmentSheet({ referralId, onClose, onReassign, routingOnly = false }: { referralId: string | null; onClose: () => void; onReassign: (r: CareReferral) => void; routingOnly?: boolean }) {
  const [shownId, setShownId] = useState<string | null>(referralId);
  if (referralId && referralId !== shownId) setShownId(referralId);
  const referrals = useReferrals();
  const r = referrals.find((x) => x.id === (referralId ?? shownId)) ?? null;
  return (
    <Dialog open={!!referralId} onOpenChange={(o) => !o && onClose()}>
      {r ? <SheetBody referral={r} onReassign={onReassign} routingOnly={routingOnly} /> : null}
    </Dialog>
  );
}

function SheetBody({ referral, onReassign, routingOnly }: { referral: CareReferral; onReassign: (r: CareReferral) => void; routingOnly: boolean }) {
  const info = assignmentInfo(referral);
  const { open, remind, isRecipient, canFollowUp, has } = useAssignmentActions();
  // Spec F5: the recipient opening it is what marks it seen (once — markSeen ignores repeats).
  useEffect(() => {
    open(referral);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [referral.id]);
  const patient = patientById(referral.patientId);
  const from = staffById(referral.fromId);
  const to = staffById(referral.toId);
  const recipient = isRecipient(referral);
  const workHref = referral.toDiscipline === "nutrition" ? { href: "/nutrition", label: "Nutrition plans" } : referral.toDiscipline === "movement" ? { href: "/classes", label: "Sessions" } : null;

  let primary: React.ReactNode = null;
  if (recipient && workHref) {
    primary = (
      <Button asChild variant="dark">
        <Link href={workHref.href}>{workHref.label}</Link>
      </Button>
    );
  } else if (canFollowUp(referral) && info.status === "back") {
    primary = (
      <Button variant="dark" onClick={() => onReassign(referral)}>
        Reassign
      </Button>
    );
  } else if (canFollowUp(referral) && info.status === "new") {
    primary = (
      <Button variant="dark" disabled={!!referral.remindedAt} onClick={() => remind(referral)}>
        {referral.remindedAt ? `Reminded ${formatTime(referral.remindedAt)}` : "Remind"}
      </Button>
    );
  }

  return (
    <SheetContent
      title={`${patient?.name ?? "Patient"} → ${DISCIPLINE_WORD[referral.toDiscipline]}`}
      description={`Assignment · ${stamp(referral.requestedAt)}`}
      footer={
        <>
          {routingOnly ? null : (
            <Button asChild variant="secondary">
              <Link href={`/patients/${referral.patientId}`}>
                Patient record <ArrowSquareOut />
              </Link>
            </Button>
          )}
          {primary}
        </>
      }
    >
      <div className="flex flex-wrap items-center gap-2">
        <DisciplineTag discipline={referral.toDiscipline} label={DISCIPLINE_WORD[referral.toDiscipline]} />
        <StatusBadge tone={info.status === "seen" ? "success" : info.status === "back" ? "warning" : "info"}>{info.status === "seen" ? "Seen" : info.status === "back" ? "Not seen in 48 h" : "Assigned"}</StatusBadge>
      </div>

      <div className="mt-6 flex items-center gap-3 rounded-inner bg-canvas p-4">
        <PersonCell id={referral.fromId} caption="Assigned by" />
        <ArrowRight size={18} className="shrink-0 text-muted" aria-label="to" />
        <PersonCell id={referral.toId} caption="Assigned to" />
      </div>

      {routingOnly ? (
        <p className="mt-6 text-sm text-muted">Goals and guidance are clinical — they're visible to the patient's care team.</p>
      ) : (
        <>
          <section className="mt-6">
            <h3 className="text-xs text-muted">Goals</h3>
            <p className="mt-1 text-sm leading-relaxed text-ink">{referral.goals}</p>
          </section>
          <section className="mt-6">
            <h3 className="text-xs text-muted">{guidanceLabel(referral)}</h3>
            <p className={cn("mt-1 text-sm leading-relaxed", referral.guidance ? "text-ink" : "text-muted")}>{referral.guidance || "None added."}</p>
          </section>
        </>
      )}

      <section className="mt-8" aria-label="Status">
        <h3 className="text-xs text-muted">Status</h3>
        <ol className="mt-3">
          <Step done title="Assigned" line={`${stamp(referral.requestedAt)} · ${from?.name ?? "Doctor"}`} connector={info.status === "seen"} />
          {info.status === "seen" ? (
            <Step done title="Seen" line={`${referral.seenAt ? stamp(referral.seenAt) : "Opened"} · ${personById(referral.seenBy ?? referral.toId)?.name ?? to?.name ?? ""}`} />
          ) : (
            <Step
              title="Seen"
              tone={info.status === "back" ? "warning" : "primary"}
              line={
                info.status === "back"
                  ? `Not opened in 48 hours — back with ${from?.name ?? "the doctor"} since ${dayPhrase(info.returnsAt)} ${formatTime(info.returnsAt)}${recipient ? ". Opening it still marks it seen." : ""}`
                  : `Waiting for ${to?.name ?? "the recipient"} to open it · back with ${from?.name ?? "the doctor"} ${dayPhrase(info.returnsAt)} ${formatTime(info.returnsAt)} if not`
              }
            />
          )}
        </ol>
        {referral.reassigned ? (
          <p className="mt-4 text-xs text-muted">
            Reassigned from {staffById(referral.reassigned.fromId)?.name} by {staffById(referral.reassigned.by)?.name} · {stamp(referral.reassigned.at)}
          </p>
        ) : null}
      </section>

      <p className="mt-8 text-xs leading-relaxed text-muted">
        An assignment has two states: assigned → seen. {has("calendar") ? "Booking the visit happens in the schedule, not here." : "Agree the first visit with the patient directly."}
      </p>
    </SheetContent>
  );
}

function Step({ title, line, done = false, connector = false, tone = "primary" }: { title: string; line: string; done?: boolean; connector?: boolean; tone?: "primary" | "warning" }) {
  return (
    <li className="relative flex gap-4 pb-6 last:pb-0" aria-current={done ? undefined : "step"}>
      {connector ? <span aria-hidden="true" className="absolute bottom-0 left-[11px] top-7 w-0.5 rounded-full bg-charcoal" /> : null}
      {done ? (
        <span className="relative z-[1] flex size-6 shrink-0 items-center justify-center rounded-full bg-charcoal text-white">
          <Check size={12} weight="bold" aria-hidden="true" />
        </span>
      ) : (
        <span className={cn("relative z-[1] flex size-6 shrink-0 items-center justify-center rounded-full bg-surface ring-2 ring-inset", tone === "warning" ? "ring-warning" : "ring-primary")}>
          <span className={cn("size-2 rounded-full", tone === "warning" ? "bg-warning" : "bg-primary")} aria-hidden="true" />
        </span>
      )}
      <div className="min-w-0 flex-1 pt-0.5">
        <p className="text-sm text-ink">{title}</p>
        <p className={cn("mt-0.5 text-xs", done ? "text-muted" : tone === "warning" ? "text-warning" : "text-primary-ink")}>{line}</p>
      </div>
    </li>
  );
}

function PersonCell({ id, caption }: { id: string; caption: string }) {
  const p = personById(id);
  const s = staffById(id);
  return (
    <div className="flex min-w-0 flex-1 items-center gap-2">
      <Avatar src={p?.avatar} name={p?.name ?? "Unknown"} size="sm" />
      <div className="min-w-0">
        <p className="text-[11px] text-muted">{caption}</p>
        <p className="truncate text-sm text-ink">{p?.name ?? "Unknown"}</p>
        {s?.status === "on-leave" ? <p className="truncate text-[11px] text-warning">{s.workingHours}</p> : <p className="truncate text-[11px] text-muted">{p?.title}</p>}
      </div>
    </div>
  );
}

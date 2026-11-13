"use client";

import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { ArrowRight, ArrowSquareOut, Check, ListPlus, PaperPlaneRight } from "@phosphor-icons/react";
import type { ReferralStage } from "@/data/types";
import { REFERRAL_STAGES, REFERRAL_STAGE_LABEL } from "@/data/care";
import { staffById } from "@/data/staff";
import { patientById } from "@/data/patients";
import { DISCIPLINE_LABEL } from "@/data/appointments";
import { formatTime } from "@/lib/format";
import { cn } from "@/lib/cn";
import { pop } from "@/lib/motion";
import { Dialog, SheetContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { Textarea } from "@/components/ui/input";
import { StatusBadge, priorityTone } from "@/components/ui/status";
import { useToast } from "@/components/ui/toast";
import { PRIORITY_LABEL } from "@/features/tasks/task-meta";
import { DisciplineTag } from "@/features/tasks/ui";
import { personById } from "@/features/tasks/people";
import { dayPhrase, stamp } from "@/features/tasks/time";
import { STAGE_WAITING, dueText, referralState, waitText } from "./meta";
import { StageAction, StopLine } from "./referral-card";
import { addReferralNote, useReferrals, type CareReferral } from "./store";
import { useReferralActions } from "./use-referral-actions";

const STAGE_MEANS: Record<ReferralStage, string> = {
  requested: "The referrer asks a colleague to see the patient",
  accepted: "The receiving practitioner agrees to take it on",
  booked: "An appointment is in the diary",
  completed: "The visit happened and an outcome was recorded",
  acknowledged: "The referrer has read the outcome — loop closed",
};

/** Referral drawer: people, reason, the five-stage timeline with who/when, notes and actions. */
export function ReferralSheet({ referralId, onClose, onBook }: { referralId: string | null; onClose: () => void; onBook: (r: CareReferral) => void }) {
  const [shownId, setShownId] = useState<string | null>(referralId);
  if (referralId && referralId !== shownId) setShownId(referralId);
  const referrals = useReferrals();
  const r = referrals.find((x) => x.id === (referralId ?? shownId)) ?? null;
  return (
    <Dialog open={!!referralId} onOpenChange={(o) => !o && onClose()}>
      {r ? <SheetBody referral={r} onBook={onBook} /> : null}
    </Dialog>
  );
}

function SheetBody({ referral, onBook }: { referral: CareReferral; onBook: (r: CareReferral) => void }) {
  const st = referralState(referral);
  const { chase, user, role } = useReferralActions();
  const { toast } = useToast();
  const [note, setNote] = useState("");
  const patient = patientById(referral.patientId);
  const from = staffById(referral.fromId);
  const to = staffById(referral.toId);
  const tone = st.overdue ? "danger" : st.stalled ? "warning" : "primary";

  const saveNote = () => {
    const text = note.trim();
    if (!text) return;
    addReferralNote(referral.id, user.id, text);
    setNote("");
    toast({ title: "Note added", description: "Saved in this browser session — nobody was notified." });
  };

  return (
    <SheetContent
      title={`${patient?.name ?? "Patient"} → ${DISCIPLINE_LABEL[referral.toDiscipline]}`}
      description={`Referral · requested ${stamp(referral.requestedAt)}`}
      footer={
        <>
          <Button asChild variant="secondary">
            <Link href={`/patients/${referral.patientId}`}>
              Patient record <ArrowSquareOut />
            </Link>
          </Button>
          {st.pending && role !== "patient" ? (
            <Button variant="secondary" leading={<ListPlus />} onClick={() => chase(referral)}>
              Follow-up task
            </Button>
          ) : null}
          <StageAction referral={referral} st={st} onBook={onBook} />
        </>
      }
    >
      <div className="flex flex-wrap items-center gap-2">
        <DisciplineTag discipline={referral.toDiscipline} />
        <StatusBadge tone={priorityTone(referral.priority)}>{PRIORITY_LABEL[referral.priority]} priority</StatusBadge>
        <StatusBadge tone={!st.pending ? "success" : st.overdue ? "danger" : st.stalled ? "warning" : "info"}>{!st.pending ? "Loop closed" : st.overdue ? "Past due date" : st.stalled ? "Stalled" : "Moving"}</StatusBadge>
      </div>

      <div className="mt-6 flex items-center gap-3 rounded-inner bg-canvas p-4">
        <PersonCell id={referral.fromId} caption="Referred by" />
        <ArrowRight size={18} className="shrink-0 text-muted" aria-label="to" />
        <PersonCell id={referral.toId} caption="Referred to" />
      </div>

      <section className="mt-6">
        <h3 className="text-xs text-muted">Reason</h3>
        <p className="mt-1 text-sm leading-relaxed text-ink">{referral.reason}</p>
        <StopLine referral={referral} st={st} className="mt-3" />
      </section>

      <section className="mt-8">
        <h3 className="text-xs text-muted">Progress</h3>
        <ol className="mt-3">
          {REFERRAL_STAGES.map((stage, i) => {
            const reached = i <= st.idx;
            const pending = stage === st.pending;
            const date = referral.stageDates[stage];
            const actor = personById(referral.actors[stage]);
            const nextReached = i + 1 <= st.idx;
            return (
              <li key={stage} className="relative flex gap-4 pb-6 last:pb-0" aria-current={pending ? "step" : undefined}>
                {i < REFERRAL_STAGES.length - 1 ? (
                  <span
                    aria-hidden="true"
                    className={cn("absolute bottom-0 left-[11px] top-7 w-0.5 rounded-full", nextReached ? "bg-charcoal" : "")}
                    style={nextReached ? undefined : { backgroundImage: "repeating-linear-gradient(180deg, var(--color-line-strong) 0 3px, transparent 3px 7px)" }}
                  />
                ) : null}
                {reached ? (
                  <span className="relative z-[1] flex size-6 shrink-0 items-center justify-center rounded-full bg-charcoal text-white">
                    <Check size={12} weight="bold" aria-hidden="true" />
                  </span>
                ) : pending ? (
                  <span className={cn("relative z-[1] flex size-6 shrink-0 items-center justify-center rounded-full bg-surface ring-2 ring-inset", { danger: "ring-danger", warning: "ring-warning", primary: "ring-primary" }[tone])}>
                    <span className={cn("absolute inset-0 rounded-full opacity-40 animate-pulse-ring", { danger: "bg-danger", warning: "bg-warning", primary: "bg-primary" }[tone])} aria-hidden="true" />
                    <span className={cn("relative size-2 rounded-full", { danger: "bg-danger", warning: "bg-warning", primary: "bg-primary" }[tone])} aria-hidden="true" />
                  </span>
                ) : (
                  <span className="relative z-[1] size-6 shrink-0 rounded-full bg-surface shadow-[inset_0_0_0_1.5px_var(--color-line-strong)]" />
                )}
                <div className="min-w-0 flex-1 pt-0.5">
                  <p className={cn("text-sm", reached || pending ? "text-ink" : "text-muted")}>{REFERRAL_STAGE_LABEL[stage]}</p>
                  {reached && date ? (
                    <p className="mt-0.5 text-xs text-muted">
                      {stamp(date)}
                      {actor ? ` · ${actor.name}` : ""}
                    </p>
                  ) : pending ? (
                    <p className={cn("mt-0.5 text-xs", { danger: "text-danger", warning: "text-warning", primary: "text-primary-ink" }[tone])}>
                      {st.visitUpcoming && referral.bookedFor
                        ? `Visit ${dayPhrase(referral.bookedFor)} ${formatTime(referral.bookedFor)} · ${personById(st.waitingOn)?.name ?? "care team"} records the outcome`
                        : `${STAGE_WAITING[stage]} · ${personById(st.waitingOn)?.name ?? "care team"} · ${waitText(st.waitingDays)} · ${st.overdue ? "was due" : "due"} ${dueText(referral.dueBy)}`}
                    </p>
                  ) : (
                    <p className="mt-0.5 text-xs text-muted">{STAGE_MEANS[stage]}</p>
                  )}
                  {stage === "booked" && referral.bookedFor && reached ? (
                    <p className="mt-2 inline-flex items-center gap-2 rounded-full bg-canvas px-3 py-1 text-xs text-ink-2">
                      Visit {dayPhrase(referral.bookedFor)} · {formatTime(referral.bookedFor)}
                      {referral.room ? ` · ${referral.room}` : ""}
                    </p>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ol>
      </section>

      <section className="mt-8">
        <h3 className="text-xs text-muted">Notes</h3>
        {referral.notes.length === 0 ? <p className="mt-2 text-sm text-muted">No notes yet.</p> : null}
        <ul className="mt-3 flex flex-col gap-3">
          <AnimatePresence initial={false}>
            {referral.notes.map((n) => {
              const who = personById(n.actorId);
              return (
                <motion.li key={n.id} initial={{ opacity: 0, y: 8, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={pop} className="flex gap-3">
                  <Avatar src={who?.avatar} name={who?.name ?? "Unknown"} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-muted">
                      <span className="text-ink">{who?.name ?? "Unknown"}</span> · {stamp(n.at)}
                    </p>
                    <p className="mt-1 rounded-inner bg-canvas px-3 py-2 text-sm leading-relaxed text-ink">{n.text}</p>
                  </div>
                </motion.li>
              );
            })}
          </AnimatePresence>
        </ul>
        {role !== "patient" ? (
          <div className="mt-4 rounded-inner bg-canvas p-3">
            <label htmlFor="referral-note" className="sr-only">
              Add a note
            </label>
            <Textarea id="referral-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Add a note — contact attempts, context for the receiver…" className="min-h-20 resize-none bg-surface" />
            <div className="mt-2 flex items-center justify-between gap-2">
              <p className="text-xs text-muted">Visible to the care team in this demo session.</p>
              <Button size="sm" variant="dark" leading={<PaperPlaneRight />} disabled={!note.trim()} onClick={saveNote}>
                Add note
              </Button>
            </div>
          </div>
        ) : null}
      </section>

      <p className="mt-8 text-xs text-muted">
        {from?.name ?? "The referrer"} referred to {to?.name ?? "the receiver"}. Accepting and completing belong to the receiver; acknowledging belongs to the referrer.
      </p>
    </SheetContent>
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

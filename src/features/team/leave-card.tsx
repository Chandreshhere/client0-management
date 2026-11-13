"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowCounterClockwise, ArrowUpRight, CalendarX, FileText, UserSwitch } from "@phosphor-icons/react";
import type { Staff } from "@/data/types";
import { STAFF, staffById } from "@/data/staff";
import { patientById } from "@/data/patients";
import { cn } from "@/lib/cn";
import { formatDate, formatTime, pluralize } from "@/lib/format";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, SheetContent } from "@/components/ui/dialog";
import { Select } from "@/components/ui/input";
import { StatusBadge } from "@/components/ui/status";
import { useToast } from "@/components/ui/toast";
import { usePlan, useRole } from "@/components/shell/role-context";
import { OrganImage } from "@/components/viz/organ";
import { InfoNote } from "@/features/settings/ui";
import { daysPhrase, whenInline } from "@/features/settings/time";
import { COVER_DOCTORS, LEAVE, cancelledToday, careTeamOf, caseloadByOrgan, patientOrgan, reviewsWaitingFor, seedCover, waitlistMentioning, type CoverChoice } from "./data";
import { reassignReview, restoreCover, saveCover, useTeamState } from "./store";

/**
 * Leave & reassignment (doc §2A temporary cover, §3C reassignment during leave) — the cobalt
 * focal card on /team. Caseload organs come from each patient's recorded conditions (body
 * system only; diagnoses stay with the care team). Every action is local and logged.
 */

const coverName = (c: CoverChoice, away: Staff) => (c === "none" ? "No cover needed" : c === "wait" ? `Waits for ${away.name}` : staffById(c)?.name ?? c);

export function useLeave() {
  const away = STAFF.find((s) => s.status === "on-leave" && LEAVE[s.id]) ?? null;
  const state = useTeamState();
  const seed = useMemo(() => (away ? seedCover(away.id) : {}), [away]);
  const cover = useMemo(() => ({ ...seed, ...state.cover }), [seed, state.cover]);
  return { away, leave: away ? LEAVE[away.id] : null, cover, coverAt: state.coverAt, reviews: state.reviews, sessionCover: state.cover };
}

export function LeaveFocal({ canManage, onReview }: { canManage: boolean; onReview: () => void }) {
  const { toast } = useToast();
  const { user } = useRole();
  const { has } = usePlan();
  const { away, leave, cover, reviews } = useLeave();
  if (!away || !leave) {
    return (
      <section className="flex flex-col justify-center gap-2 rounded-card bg-primary p-6 text-white">
        <h2 className="text-title font-normal">Nobody is on leave</h2>
        <p className="text-sm text-white/90">Leave and cover arrangements appear here when a clinician is away.</p>
      </section>
    );
  }
  const patients = careTeamOf(away.id);
  const groups = caseloadByOrgan(patients);
  const coverDoc = staffById(leave.coverId);
  const waiting = reviewsWaitingFor(away.id);
  const asks = waitlistMentioning(away.id);
  const moved = cancelledToday(away.id);
  const split = COVER_DOCTORS.map((d) => ({ d, n: Object.values(cover).filter((c) => c === d.id).length })).filter((x) => x.n > 0);
  const waitN = Object.values(cover).filter((c) => c === "wait").length;
  const noneN = Object.values(cover).filter((c) => c === "none").length;

  return (
    <section aria-labelledby="leave-title" className="flex flex-col gap-2 rounded-card bg-primary p-2 text-white">
      <div className="flex items-start justify-between gap-4 p-4">
        <div className="min-w-0">
          <span className="inline-flex h-8 items-center rounded-full px-3 text-xs text-white shadow-[inset_0_0_0_1px_rgb(255_255_255/0.4)]">
            {leave.reason} · {Number(leave.from.slice(8, 10))}–{formatDate(leave.until, { day: "numeric", month: "short" })}
          </span>
          <h2 id="leave-title" className="mt-4 text-title font-normal">
            {away.name} is on leave
          </h2>
          <p className="mt-2 text-sm text-white">
            Back {formatDate(leave.until, { day: "numeric", month: "short" })} · {daysPhrase(leave.until)} · {coverDoc?.name ?? "No one"} covering since {formatDate(leave.coverSince, { day: "numeric", month: "short" })}
          </p>
        </div>
        <Avatar src={away.avatar} name={away.name} size="lg" className="ring-2 ring-white/40" />
      </div>

      <div className="rounded-inner bg-surface p-4 text-ink">
        <div className="flex items-baseline justify-between gap-3">
          <h3 className="text-sm text-ink">Caseload by body system</h3>
          <span className="text-xs text-muted">{pluralize(patients.length, "patient")} on her list</span>
        </div>
        <ul className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-5">
          {groups.map((g) => (
            <li key={g.organ} className="flex flex-col items-center gap-1 rounded-[12px] bg-sunken px-1 pb-2 pt-1 text-center" title={`${g.system}: ${g.patients.map((p) => p.name).join(", ")}`}>
              <OrganImage kind={g.organ} className="size-12" />
              <span className="text-[11px] leading-tight text-ink-2">{g.label}</span>
              <span className="text-xs text-ink tabular">{g.patients.length}</span>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-[11px] text-muted">Organ = each patient&apos;s primary body system from their record. Diagnoses and notes stay with the care team.</p>
      </div>

      <div className="rounded-inner bg-surface p-4 text-ink">
        <h3 className="text-sm text-ink">Needs action before {formatDate(leave.until, { day: "numeric", month: "short" })}</h3>
        <ul className="mt-3 flex flex-col gap-3">
          {waiting.map((d) => {
            const p = patientById(d.patientId);
            const rerouted = reviews[d.id];
            return (
              <li key={d.id} className="flex flex-wrap items-start gap-3">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-sunken text-ink-2" aria-hidden="true">
                  <FileText size={16} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-ink">
                    {d.title} · {p?.name ?? "Unmatched"}
                  </p>
                  <p className="text-xs text-muted">
                    {rerouted ? `Routed to ${staffById(rerouted)?.name} in this session` : `Still routed to ${away.name}`}
                    {d.dueBy ? ` · review due ${whenInline(d.dueBy)}` : ""}
                  </p>
                </div>
                {canManage ? (
                  rerouted ? (
                    <Button size="sm" variant="ghost" leading={<ArrowCounterClockwise />} onClick={() => reassignReview(d.id, null, user.id)}>
                      Undo
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="dark"
                      onClick={() => {
                        reassignReview(d.id, leave.coverId, user.id);
                        toast({ tone: "success", title: `Routed to ${coverDoc?.name}`, description: "Routing only — the report wasn't opened. Saved in this browser session; nobody was notified." });
                      }}
                    >
                      Route to {coverDoc?.name.split(" ").slice(0, 2).join(" ")}
                    </Button>
                  )
                ) : null}
              </li>
            );
          })}
          {asks.length ? (
            <li className="flex flex-wrap items-start gap-3">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-sunken text-ink-2" aria-hidden="true">
                <UserSwitch size={16} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm text-ink">{pluralize(asks.length, "waitlist request")} name her</p>
                <p className="text-xs text-muted">{asks.map((w) => patientById(w.patientId)?.name).join(" · ")}</p>
              </div>
              {has("waitlist") ? (
                <Button asChild size="sm" variant="secondary" trailing={<ArrowUpRight />}>
                  <Link href="/schedule/waitlist">Waitlist</Link>
                </Button>
              ) : null}
            </li>
          ) : null}
          {moved.map((a) => (
            <li key={a.id} className="flex items-start gap-3">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-sunken text-ink-2" aria-hidden="true">
                <CalendarX size={16} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm text-ink">
                  {formatTime(a.start)} {a.service} · {patientById(a.patientId)?.name}
                </p>
                <p className="text-xs text-muted">Cancelled today{a.notes ? ` — ${a.notes}` : ""}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 p-4 pt-2">
        <p className="text-sm text-white">
          Cover:{" "}
          {split.map((x, i) => (
            <span key={x.d.id}>
              {i ? " · " : ""}
              {x.d.name} {x.n}
            </span>
          ))}
          {waitN ? ` · waiting for return ${waitN}` : ""}
          {noneN ? ` · not needed ${noneN}` : ""}
        </p>
        <Button variant="glass" onClick={onReview} trailing={<ArrowUpRight />}>
          {canManage ? "Review reassignment" : "View cover"}
        </Button>
      </div>
    </section>
  );
}

export function ReassignSheet({ open, onOpenChange, canManage }: { open: boolean; onOpenChange: (v: boolean) => void; canManage: boolean }) {
  const { toast } = useToast();
  const { user } = useRole();
  const { away, leave, cover, coverAt, sessionCover } = useLeave();
  const [draft, setDraft] = useState<Record<string, CoverChoice>>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setDraft(cover);
      setError(null);
    }
  }, [open, cover]);

  if (!away || !leave) return null;
  const patients = careTeamOf(away.id).sort((a, b) => Number(b.status === "needs-attention") - Number(a.status === "needs-attention") || a.name.localeCompare(b.name));
  const options = [
    ...COVER_DOCTORS.map((d) => ({ value: d.id, label: d.name, description: `${d.title}${d.id === leave.coverId ? " · covering" : ""}` })),
    { value: "wait", label: `Wait for her return (${formatDate(leave.until, { day: "numeric", month: "short" })})`, description: "No cover; bookings stay with her" },
    { value: "none", label: "No cover needed", description: "Programme complete or no open care" },
  ];
  const dirty = JSON.stringify(draft) !== JSON.stringify(cover);

  function save() {
    if (!away || !leave) return;
    const risky = patients.filter((p) => p.status === "needs-attention" && draft[p.id] === "wait");
    if (risky.length) {
      setError(`${risky.map((p) => p.name).join(", ")} ${risky.length === 1 ? "needs" : "need"} attention — choose a covering doctor instead of waiting until ${formatDate(leave.until, { day: "numeric", month: "short" })}.`);
      return;
    }
    const prev = { cover: sessionCover, coverAt };
    const counts = COVER_DOCTORS.map((d) => `${d.name} ${Object.values(draft).filter((c) => c === d.id).length}`).join(", ");
    saveCover(draft, user.id, counts);
    onOpenChange(false);
    toast({
      tone: "success",
      title: "Cover saved in this browser session",
      description: `${counts}. Nobody was notified and no calendars changed.`,
      action: { label: "Undo", onClick: () => restoreCover(prev, user.id) },
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <SheetContent
        title={`Cover for ${away.name}`}
        description={`${leave.reason} until ${formatDate(leave.until, { day: "numeric", month: "short" })} · temporary care-team access ends when she is back`}
        footer={
          canManage ? (
            <>
              <DialogClose asChild>
                <Button variant="ghost">Cancel</Button>
              </DialogClose>
              <Button variant="primary" onClick={save} disabled={!dirty}>
                Save cover
              </Button>
            </>
          ) : (
            <DialogClose asChild>
              <Button variant="secondary">Close</Button>
            </DialogClose>
          )
        }
      >
        <div className="flex flex-col gap-4">
          {canManage ? (
            <div className="flex flex-wrap items-center gap-2 rounded-inner bg-sunken p-3">
              <span className="text-xs text-muted">Set every active patient to</span>
              {COVER_DOCTORS.map((d) => (
                <Button
                  key={d.id}
                  size="sm"
                  variant="secondary"
                  onClick={() => setDraft((x) => Object.fromEntries(Object.entries(x).map(([pid, c]) => [pid, patientById(pid)?.status === "completed" ? c : d.id])))}
                >
                  {d.name}
                </Button>
              ))}
            </div>
          ) : null}
          {error ? (
            <InfoNote tone="danger" className="text-sm">
              {error}
            </InfoNote>
          ) : null}
          <ul className="flex flex-col gap-2">
            {patients.map((p) => {
              const o = patientOrgan(p);
              const choice = draft[p.id] ?? "wait";
              return (
                <li key={p.id} className={cn("grid grid-cols-[48px_minmax(0,1fr)] items-center gap-3 rounded-inner p-3", p.status === "needs-attention" ? "bg-warning-soft/60" : "bg-sunken/60")}>
                  <span className="flex size-12 items-center justify-center rounded-[12px] bg-surface">{o ? <OrganImage kind={o.organ} className="size-10" alt="" /> : null}</span>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link href={`/patients/${p.id}`} className="truncate text-sm text-ink underline-offset-2 hover:underline">
                        {p.name}
                      </Link>
                      {p.status === "needs-attention" ? <StatusBadge tone="warning">Needs attention</StatusBadge> : null}
                      {p.status === "completed" ? <StatusBadge tone="neutral">Programme complete</StatusBadge> : null}
                    </div>
                    <p className="truncate text-xs text-muted">
                      {o?.system ?? "No body system recorded"} · {p.nextAppointment ? `next ${whenInline(p.nextAppointment)}` : "nothing booked"}
                    </p>
                  </div>
                  <div className="col-span-2">
                    {canManage ? (
                      <Select
                        ariaLabel={`Cover for ${p.name}`}
                        size="sm"
                        value={choice}
                        onValueChange={(v) => {
                          setDraft((x) => ({ ...x, [p.id]: v }));
                          setError(null);
                        }}
                        options={options}
                      />
                    ) : (
                      <p className="text-xs text-ink-2">{coverName(choice, away)}</p>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
          <InfoNote>Cover is temporary care-team access approved by the clinical lead. It ends automatically on {formatDate(leave.until, { day: "numeric", month: "long" })}. Saved in this browser session only — no one is notified.</InfoNote>
        </div>
      </SheetContent>
    </Dialog>
  );
}

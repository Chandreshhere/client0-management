"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowSquareOut, CheckCircle, Eye, EyeSlash, NotePencil } from "@phosphor-icons/react";
import type { CareEvent } from "@/data/featured";
import { EVENT_TYPE_LABEL, LINK_LABEL, RECORD_STATE_LABEL } from "@/data/featured";
import { useRecord } from "./record-context";
import { formatDate, relativeTime } from "@/lib/format";
import { cn } from "@/lib/cn";
import { Dialog, SheetContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { StatusBadge, recordTone } from "@/components/ui/status";
import { Avatar } from "@/components/ui/avatar";
import { Textarea } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { EVENT_ICON, authorAvatar, authorName } from "./event-meta";

/**
 * Detail drawer (doc §5C / §6): what happened, when it happened vs when it was entered,
 * who entered it, state, source record and patient release — without leaving the patient.
 */
export function EventDrawer({ events, eventId, onClose, onOpenEvent, patientId }: { events: CareEvent[]; eventId: string | null; onClose: () => void; onOpenEvent: (id: string) => void; patientId: string }) {
  const e = events.find((x) => x.id === eventId) ?? null;
  const { conditionById } = useRecord();
  const { toast } = useToast();
  const [reviewed, setReviewed] = useState<Set<string>>(new Set());
  const [released, setReleased] = useState<Set<string>>(new Set());
  const [addendumFor, setAddendumFor] = useState<string | null>(null);
  const [addendum, setAddendum] = useState("");

  const related = e ? events.filter((x) => x.conditionId === e.conditionId && x.id !== e.id).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 4) : [];
  const Icon = e ? EVENT_ICON[e.type] : null;
  const state = e && reviewed.has(e.id) ? "completed" : e?.state;
  const isReleased = e ? e.released || released.has(e.id) : false;
  const sourceHref = e ? (e.type === "note" || e.type === "consult" ? `/patients/${patientId}/notes` : e.type === "lab" ? `/patients/${patientId}/labs` : e.type === "imaging" ? `/patients/${patientId}/imaging` : e.type === "vitals" ? `/patients/${patientId}/vitals` : `/patients/${patientId}/documents`) : "#";

  return (
    <Dialog open={!!e} onOpenChange={(o) => !o && onClose()}>
      {e && Icon ? (
        <SheetContent
          title={e.title}
          description={`${EVENT_TYPE_LABEL[e.type]} · ${conditionById(e.conditionId)?.name}`}
          footer={
            <>
              {e.state === "awaiting-review" && !reviewed.has(e.id) ? (
                <Button
                  variant="primary"
                  leading={<CheckCircle />}
                  onClick={() => {
                    setReviewed((s) => new Set(s).add(e.id));
                    toast({ title: "Marked as reviewed in this demo session", description: "In production this records your review outcome and follow-up action.", tone: "success" });
                  }}
                >
                  Mark reviewed
                </Button>
              ) : null}
              {!isReleased && e.state !== "scheduled" ? (
                <Button
                  variant="secondary"
                  leading={<Eye />}
                  onClick={() => {
                    setReleased((s) => new Set(s).add(e.id));
                    toast({ title: "Release recorded locally", description: "Patient release is a separate step from signing. Nothing was sent." });
                  }}
                >
                  Release to patient
                </Button>
              ) : null}
              {e.state === "signed" ? (
                <Button variant="secondary" leading={<NotePencil />} onClick={() => setAddendumFor(e.id)}>
                  Add addendum
                </Button>
              ) : null}
              <Button asChild variant="dark">
                <Link href={sourceHref}>
                  Open source <ArrowSquareOut />
                </Link>
              </Button>
            </>
          }
        >
          <div className="flex items-center gap-3">
            <span className={cn("flex size-12 items-center justify-center rounded-full", e.state === "scheduled" ? "bg-surface text-primary shadow-[inset_0_0_0_1.5px_var(--color-primary)]" : "bg-primary text-white")}>
              <Icon size={22} />
            </span>
            <div className="flex flex-wrap gap-2">
              <StatusBadge tone={recordTone(state!)}>{RECORD_STATE_LABEL[state!]}</StatusBadge>
              <StatusBadge tone={isReleased ? "info" : "neutral"} dot={false}>
                {isReleased ? <Eye size={12} aria-hidden="true" /> : <EyeSlash size={12} aria-hidden="true" />}
                {isReleased ? "Released to patient" : "Not released"}
              </StatusBadge>
            </div>
          </div>

          <section className="mt-6">
            <h3 className="text-xs text-muted">What happened</h3>
            <p className="mt-1 text-sm leading-relaxed text-ink">{e.summary}</p>
          </section>

          {e.values?.length ? (
            <section className="mt-6">
              <h3 className="text-xs text-muted">Results</h3>
              <table className="mt-2 w-full text-sm">
                <tbody>
                  {e.values.map((v) => (
                    <tr key={v.label} className="border-b border-line last:border-0">
                      <td className="py-2 text-ink-2">{v.label}</td>
                      <td className="py-2 text-right tabular">
                        {v.value} <span className="text-xs text-muted">{v.unit}</span>
                        {v.flag ? <span className={cn("ml-2 rounded-full px-1.5 text-[11px]", v.flag === "high" ? "bg-danger-soft text-danger" : "bg-warning-soft text-warning")}>{v.flag === "high" ? "High" : "Low"}</span> : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          ) : null}

          <dl className="mt-6 grid grid-cols-2 gap-x-4 gap-y-4 rounded-inner bg-canvas p-4 text-sm">
            <div>
              <dt className="text-xs text-muted">Event date</dt>
              <dd className="mt-0.5 text-ink">{formatDate(e.date)}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted">Entered in Carelane</dt>
              <dd className="mt-0.5 text-ink">{formatDate(e.enteredAt, { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false })}</dd>
            </div>
            <div className="col-span-2">
              <dt className="text-xs text-muted">Entered by</dt>
              <dd className="mt-1 flex items-center gap-2 text-ink">
                <Avatar src={authorAvatar(e.authorId)} name={authorName(e.authorId)} size="sm" />
                <span>
                  {authorName(e.authorId)} <span className="text-muted">· {e.authorRole}</span>
                </span>
              </dd>
            </div>
            <div className="col-span-2">
              <dt className="text-xs text-muted">Source record</dt>
              <dd className="mt-0.5 font-mono text-xs text-ink-2">{e.source}</dd>
            </div>
          </dl>
          {e.date.slice(0, 7) !== e.enteredAt.slice(0, 7) ? (
            <p className="mt-2 text-xs text-muted">Event and entry dates differ — this record was added {relativeTime(e.enteredAt)} for an event on {formatDate(e.date)}.</p>
          ) : null}

          {addendumFor === e.id ? (
            <section className="mt-6 rounded-inner bg-canvas p-4">
              <h3 className="text-sm text-ink">Addendum</h3>
              <p className="mt-1 text-xs text-muted">Signed records are never edited. An attributed addendum is linked to the original.</p>
              <Textarea className="mt-3" value={addendum} onChange={(ev) => setAddendum(ev.target.value)} placeholder="Correction or additional information…" aria-label="Addendum text" />
              <div className="mt-3 flex justify-end gap-2">
                <Button size="sm" variant="ghost" onClick={() => { setAddendumFor(null); setAddendum(""); }}>Cancel</Button>
                <Button
                  size="sm"
                  variant="dark"
                  disabled={!addendum.trim()}
                  onClick={() => {
                    toast({ title: "Addendum saved as a draft in this session", description: "Signing requires a verified identity, which this prototype doesn't have." });
                    setAddendumFor(null);
                    setAddendum("");
                  }}
                >
                  Save draft
                </Button>
              </div>
            </section>
          ) : null}

          {(() => {
            const outgoing = (e.links ?? []).map((l) => ({ ev: events.find((x) => x.id === l.to), label: LINK_LABEL[l.kind] })).filter((x) => x.ev);
            const incoming = events.flatMap((x) => (x.links ?? []).filter((l) => l.to === e.id).map((l) => ({ ev: x, label: LINK_LABEL[l.kind] })));
            if (!outgoing.length && !incoming.length) return null;
            return (
              <section className="mt-8">
                <h3 className="text-xs text-muted">Documented links</h3>
                <ul className="mt-2 flex flex-col gap-1">
                  {incoming.map(({ ev, label }) => (
                    <li key={`in-${ev!.id}`}>
                      <button type="button" onClick={() => onOpenEvent(ev!.id)} className="flex w-full items-center gap-2 rounded-[14px] p-2 text-left text-sm transition-colors hover:bg-canvas">
                        <span className="truncate">{ev!.title}</span>
                        <span className="shrink-0 rounded-full bg-sunken px-2 text-[11px] text-muted">{label} this</span>
                        <span className="ml-auto shrink-0 text-xs text-muted">{formatDate(ev!.date, { day: "numeric", month: "short" })}</span>
                      </button>
                    </li>
                  ))}
                  {outgoing.map(({ ev, label }) => (
                    <li key={`out-${ev!.id}`}>
                      <button type="button" onClick={() => onOpenEvent(ev!.id)} className="flex w-full items-center gap-2 rounded-[14px] p-2 text-left text-sm transition-colors hover:bg-canvas">
                        <span className="shrink-0 rounded-full bg-primary-soft px-2 text-[11px] text-primary-ink">this {label}</span>
                        <span className="truncate">{ev!.title}</span>
                        <span className="ml-auto shrink-0 text-xs text-muted">{formatDate(ev!.date, { day: "numeric", month: "short" })}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })()}

          {related.length ? (
            <section className="mt-8">
              <h3 className="text-xs text-muted">Also linked to {conditionById(e.conditionId)?.name}</h3>
              <ul className="mt-2 flex flex-col gap-1">
                {related.map((r) => {
                  const RI = EVENT_ICON[r.type];
                  return (
                    <li key={r.id}>
                      <button type="button" onClick={() => onOpenEvent(r.id)} className="flex w-full items-center gap-3 rounded-[14px] p-2 text-left transition-colors hover:bg-canvas">
                        <span className="flex size-8 items-center justify-center rounded-full bg-sunken text-ink-2"><RI size={16} /></span>
                        <span className="min-w-0 flex-1 truncate text-sm">{r.title}</span>
                        <span className="text-xs text-muted">{formatDate(r.date, { day: "numeric", month: "short", year: "2-digit" })}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          ) : null}
        </SheetContent>
      ) : null}
    </Dialog>
  );
}

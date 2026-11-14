"use client";

import { ArrowRight, PencilSimpleLine } from "@phosphor-icons/react";
import { formatTime } from "@/lib/format";
import { RECORD_STATE_LABEL, type CareEvent, type LinkKind } from "@/data/featured";
import { Button } from "@/components/ui/button";
import { Dialog, SheetContent } from "@/components/ui/dialog";
import { StatusBadge, recordTone } from "@/components/ui/status";
import { ScanThumb } from "@/features/patient/scan-thumb";
import { MetaRow } from "../ui";
import { IMAGING, RECORD, SYSTEMS, authorName, eventById } from "../record";
import { longDate, shortDate } from "../time";
import type { RecordRow } from "./data";

/** How a documented link reads from each end ("This visit ordered …" / "Ordered at …"). */
const FORWARD: Record<LinkKind, string> = { ordered: "Ordered", "reviewed-in": "Reviewed in", "led-to": "Led to", referred: "Referred to", revised: "Revised as", "follow-up": "Followed up by" };
const BACKWARD: Record<LinkKind, string> = { ordered: "Ordered at", "reviewed-in": "Reviews", "led-to": "Came from", referred: "Referral from", revised: "Revises", "follow-up": "Follow-up of" };

/** Documented links between this record and others the patient can see (both ends released). */
function visibleLinks(e: CareEvent) {
  const out: { label: string; other: CareEvent; dir: "to" | "from" }[] = [];
  for (const l of e.links ?? []) {
    const other = eventById(l.to);
    if (other?.released) out.push({ label: FORWARD[l.kind], other, dir: "to" });
  }
  for (const src of RECORD.events) {
    if (!src.released) continue;
    for (const l of src.links ?? []) if (l.to === e.id) out.push({ label: BACKWARD[l.kind], other: src, dir: "from" });
  }
  return out;
}

/** Details for one released record: dates kept apart, author, source, documented links. */
export function RecordSheet({ row, open, onOpenChange, onCorrect }: { row: RecordRow | null; open: boolean; onOpenChange: (o: boolean) => void; onCorrect: (recordId: string) => void }) {
  if (!row) return null;
  const e = row.event;
  const study = e ? IMAGING.find((s) => s.event.id === e.id) : undefined;
  const links = e ? visibleLinks(e) : [];
  const system = SYSTEMS.find((s) => s.id === row.systemId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <SheetContent
        title={row.title}
        description={`${longDate(`${row.date}T12:00:00+05:30`)} · ${row.author}`}
        footer={
          e ? (
            <Button variant="secondary" leading={<PencilSimpleLine />} onClick={() => onCorrect(e.id)}>
              Something wrong? Request a correction
            </Button>
          ) : undefined
        }
      >
        <div className="flex flex-col gap-6">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge tone={e ? recordTone(e.state) : "success"}>{e ? RECORD_STATE_LABEL[e.state] : row.state}</StatusBadge>
            <StatusBadge tone="neutral" dot={false}>
              Released to you
            </StatusBadge>
            {system ? <span className="text-xs text-muted">{system.area}</span> : null}
          </div>

          {study ? (
            <figure className="overflow-hidden rounded-inner bg-charcoal">
              <div className="aspect-[16/9]">
                <ScanThumb kind={study.kind} title={`Illustrative ${study.title} thumbnail — not your actual image`} />
              </div>
              <figcaption className="px-4 py-3 text-xs text-white/70">Illustrative picture — your actual images are kept by the imaging centre.</figcaption>
            </figure>
          ) : null}

          <p className="text-sm leading-relaxed text-ink">{row.summary}</p>

          {e?.values?.length ? (
            <dl className="divide-y divide-line rounded-inner bg-sunken px-4 py-2">
              {e.values.map((v) => (
                <MetaRow key={v.label} label={v.label}>
                  <span className="tabular">
                    {v.value} {v.unit}
                  </span>
                  {v.flag ? <span className="text-muted"> · {v.flag === "high" ? "above range" : "below range"}</span> : null}
                </MetaRow>
              ))}
            </dl>
          ) : null}

          <dl className="divide-y divide-line rounded-inner bg-sunken px-4 py-2">
            <MetaRow label={row.doc || (e && ["lab", "imaging", "document"].includes(e.type)) ? "Date issued" : "Date"}>{longDate(`${row.date}T12:00:00+05:30`)}</MetaRow>
            <MetaRow label="Added to your record">
              {longDate(row.enteredAt)} · {formatTime(row.enteredAt)}
            </MetaRow>
            <MetaRow label="By">
              {row.author}
              <span className="text-muted"> · {row.role}</span>
            </MetaRow>
            <MetaRow label="Source">
              <span className="font-mono text-xs">{row.source}</span>
            </MetaRow>
          </dl>

          {links.length ? (
            <section aria-labelledby="sheet-links" className="flex flex-col gap-2">
              <h3 id="sheet-links" className="text-sm text-ink">
                Connected records
              </h3>
              <p className="text-xs text-muted">Links your care team documented — they show what led to what, not a diagnosis.</p>
              <ul className="flex flex-col gap-2">
                {links.map((l) => (
                  <li key={`${l.dir}-${l.other.id}`} className="flex items-start gap-3 rounded-inner bg-sunken p-3 text-sm">
                    <ArrowRight size={16} className={l.dir === "from" ? "mt-0.5 shrink-0 rotate-180 text-muted" : "mt-0.5 shrink-0 text-muted"} aria-hidden="true" />
                    <span className="min-w-0">
                      <span className="block text-xs text-muted">{l.label}</span>
                      <span className="block text-ink">{l.other.title}</span>
                      <span className="block text-xs text-muted">
                        {shortDate(l.other.date)} · {authorName(l.other)}
                        {l.other.state === "scheduled" ? " · upcoming" : ""}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      </SheetContent>
    </Dialog>
  );
}

"use client";

import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { ArrowUpRight, ClipboardText, Pulse, Scan, Virus, FileText, Warning } from "@phosphor-icons/react";
import type { Patient } from "@/data/types";
import type { BodySystemId } from "@/data/featured";
import { useRecord } from "./record-context";
import { clinicNumber } from "@/data/patients";
import { cn } from "@/lib/cn";
import { spring } from "@/lib/motion";
import { Avatar } from "@/components/ui/avatar";
import { Group, GroupHeader, Inset } from "@/components/ui/card";
import { VitalWave } from "@/components/charts/wave";
import { ScanThumb } from "./scan-thumb";

/** Left column of the reference: identity, allergies + care plan, vitals, records, imaging. */
export function SummaryColumn({
  patient,
  active,
  onOpenProfile,
  onOpenCarePlan,
  onOpenEvent,
}: {
  patient: Patient;
  active: BodySystemId;
  onOpenProfile: () => void;
  onOpenCarePlan: () => void;
  onOpenEvent: (eventId: string) => void;
}) {
  const { record, systemById, conditionById } = useRecord();
  const sys = systemById(active);
  const featured = conditionById(sys.featuredConditionId)!;
  const plan = record.carePlan;
  const base = `/patients/${patient.id}`;

  return (
    <div className="flex flex-col gap-4">
      {/* Identity */}
      <Group className="flex items-center gap-3 p-2 pl-3">
        <Avatar src={patient.avatar} name={patient.name} size="lg" />
        <div className="min-w-0 flex-1 py-1">
          <p className="truncate text-sm font-medium text-ink">{patient.name}</p>
          <p className="truncate text-xs text-muted">{patient.age} years old</p>
          <p className="sr-only">Clinic number {clinicNumber(patient.id)}</p>
        </div>
        <button type="button" onClick={onOpenProfile} aria-label={`Open ${patient.name}'s profile`} className="flex size-10 shrink-0 items-center justify-center rounded-full bg-surface text-ink transition-[background-color,transform] hover:bg-canvas active:scale-95">
          <ArrowUpRight size={18} />
        </button>
      </Group>

      {/* Allergies + care plan */}
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-card bg-surface px-3 py-4">
          <div className="flex items-center gap-2 whitespace-nowrap text-sm text-ink">
            <Virus size={18} className="text-ink-2" aria-hidden="true" />
            Allergies
          </div>
          {patient.allergies === null ? (
            <p className="mt-3 flex items-start gap-1.5 text-xs text-warning">
              <Warning size={14} className="mt-px shrink-0" aria-hidden="true" />
              Not recorded — ask before prescribing
            </p>
          ) : patient.allergies.length === 0 ? (
            <p className="mt-3 text-xs text-muted">No known allergies (confirmed)</p>
          ) : (
            <p className="mt-3 text-xs leading-relaxed text-ink-2">{patient.allergies.join(", ")}</p>
          )}
        </div>
        <button type="button" onClick={onOpenCarePlan} className="group flex flex-col justify-start rounded-card bg-surface px-3 py-4 text-left transition-colors hover:bg-canvas">
          <span className="flex items-center gap-2 whitespace-nowrap text-sm text-ink">
            <ClipboardText size={18} className="text-ink-2" aria-hidden="true" />
            Care plan
          </span>
          <span className="mt-3 block text-xs leading-relaxed text-ink-2">{plan ? plan.episode.replace(" (", " · ").replace(")", "") : "No shared plan yet"}</span>
        </button>
      </div>

      <AnimatePresence mode="popLayout" initial={false}>
        <motion.div key={active} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, transition: { duration: 0.12 } }} transition={spring} className="flex flex-col gap-4">
          {/* Vital signs */}
          <Group>
            <GroupHeader icon={<Pulse />} title="Vital Signs" subtitle={featured.short} href={`${base}/vitals`} actionLabel="Open vital signs" />
            <div className="flex flex-col gap-2">
              {sys.vitals.map((v) => (
                <Inset key={v.label} className="pb-3 pt-2">
                  <VitalWave samples={v.wave} band={v.band} label={`${v.label} trend, latest ${v.value} ${v.unit}; reference ${v.range}`} />
                  <div className="mt-1 flex items-end justify-between gap-2">
                    <span className="text-xs text-muted">{v.label}</span>
                    <span className="flex items-baseline gap-1">
                      <span className="text-lg font-light leading-none tracking-[-0.01em] text-ink">{v.value}</span>
                      <span className="text-xs text-muted">{v.unit}</span>
                    </span>
                  </div>
                  {v.source !== "Clinic" ? <p className="mt-1 text-[11px] text-faint">{v.source}</p> : null}
                </Inset>
              ))}
            </div>
          </Group>

          {/* Records */}
          <Group>
            <GroupHeader icon={<ClipboardText />} title="Records" subtitle={featured.short} href={`${base}/documents`} actionLabel="Open records" />
            {sys.records.length === 0 ? <p className="px-2 pb-2 text-xs text-muted">No documents for this system yet.</p> : null}
            <div className="grid grid-cols-2 gap-2">
              {sys.records.map((r) => (
                <button key={r.id} type="button" onClick={() => onOpenEvent(r.eventId)} className="rounded-inner bg-surface p-4 text-left transition-colors hover:bg-canvas">
                  <span className="flex items-center justify-between">
                    <span className="flex size-8 items-center justify-center rounded-full bg-sunken text-ink-2">
                      <FileText size={16} aria-hidden="true" />
                    </span>
                    <span className="text-xs text-muted tabular">{r.stamp}</span>
                  </span>
                  <span className="mt-4 line-clamp-2 min-h-[2.5em] text-[13px] leading-tight text-ink">{r.title}</span>
                  <span className="block truncate text-xs text-muted">{r.subtitle}</span>
                </button>
              ))}
            </div>
          </Group>

          {/* Imaging */}
          <Group>
            <GroupHeader icon={<Scan />} title="Imaging" subtitle={featured.short} href={`${base}/imaging`} actionLabel="Open imaging" />
            {sys.imaging.length === 0 ? <p className="px-2 pb-2 text-xs text-muted">No imaging on record for this system — nothing has been requested.</p> : null}
            <div className="grid grid-cols-2 gap-2">
              {sys.imaging.map((img) => (
                <button key={img.id} type="button" onClick={() => onOpenEvent(img.eventId)} className="group relative aspect-[4/3] overflow-hidden rounded-inner text-left">
                  <ScanThumb kind={img.kind} title={img.title} className="transition-transform duration-500 [transition-timing-function:var(--ease-spring)] group-hover:scale-105" />
                  <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 to-transparent px-3 pb-2 pt-6 text-[11px] leading-tight text-white">
                    <span className="block truncate">{img.title}</span>
                  </span>
                </button>
              ))}
            </div>
            {sys.imaging.length ? <p className="px-2 pb-1 pt-2 text-[11px] text-muted">Illustrative renders — not diagnostic images.</p> : null}
          </Group>
        </motion.div>
      </AnimatePresence>

      <Link href={`${base}/notes`} className={cn("sr-only focus:not-sr-only")}>Go to notes</Link>
    </div>
  );
}

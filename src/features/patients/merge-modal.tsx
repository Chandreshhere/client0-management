"use client";

import { useState, type ReactNode } from "react";
import { CheckCircle, GitMerge } from "@phosphor-icons/react";
import { staffById } from "@/data/staff";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/cn";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Dialog, ModalContent } from "@/components/ui/dialog";
import { clinicNoOf, relatedRecords, type DuplicateMatch, type RegistryPatient } from "./data";

export type DuplicateChoice = { outcome: "merged"; keep: RegistryPatient; merge: RegistryPatient } | { outcome: "separate"; ids: string[] };

/** Candidate records for a flagged patient: the ones named at registration, else identity signals. */
export function duplicateCandidates(p: RegistryPatient, pool: RegistryPatient[]): DuplicateMatch[] {
  const signals = relatedRecords(p, pool);
  const named = p.local?.duplicateOf ?? [];
  if (!named.length) return signals;
  return named
    .map((id) => signals.find((m) => m.patient.id === id) ?? (pool.find((q) => q.id === id) ? { patient: pool.find((q) => q.id === id)!, reasons: ["Flagged at registration"], score: 0 } : null))
    .filter((m): m is DuplicateMatch => !!m);
}

/**
 * Admin review of a possible duplicate (F2). Shows both records side by side; the admin keeps one
 * and merges the other into it, or marks them as different people. Nothing is ever merged
 * automatically — a shared phone number is common in families.
 */
export function MergeModal({
  patient,
  pool,
  onClose,
  onDecide,
}: {
  patient: RegistryPatient | null;
  pool: RegistryPatient[];
  onClose: () => void;
  onDecide: (choice: DuplicateChoice) => void;
}) {
  return (
    <Dialog open={!!patient} onOpenChange={(o) => !o && onClose()}>
      {patient ? <Body key={patient.id} patient={patient} pool={pool} onClose={onClose} onDecide={onDecide} /> : null}
    </Dialog>
  );
}

function Body({ patient, pool, onClose, onDecide }: { patient: RegistryPatient; pool: RegistryPatient[]; onClose: () => void; onDecide: (c: DuplicateChoice) => void }) {
  const candidates = duplicateCandidates(patient, pool);
  const [otherId, setOtherId] = useState(candidates[0]?.patient.id ?? "");
  const match = candidates.find((m) => m.patient.id === otherId) ?? candidates[0];
  const other = match?.patient;
  // Keep the older record by default — it usually holds the history.
  const older = other && Date.parse(other.registeredAt) <= Date.parse(patient.registeredAt) ? other.id : patient.id;
  const [keepId, setKeepId] = useState(older);
  const keep = keepId === other?.id ? other : patient;
  const merge = keepId === other?.id ? patient : other;

  return (
    <ModalContent
      size="lg"
      title="Review possible duplicate"
      description="Compare the two records. Merge only if they are the same person — families often share one phone number."
      footer={
        other && merge ? (
          <>
            <p className="mr-auto max-w-[40ch] text-xs text-muted">Recorded in the activity log with your name. Nothing changes until you choose.</p>
            <Button variant="secondary" onClick={() => onDecide({ outcome: "separate", ids: [patient.id] })}>
              Not the same person
            </Button>
            <Button variant="dark" leading={<GitMerge />} onClick={() => onDecide({ outcome: "merged", keep, merge })}>
              Merge into <span className="font-mono text-xs">{clinicNoOf(keep)}</span>
            </Button>
          </>
        ) : (
          <>
            <Button variant="ghost" onClick={onClose}>Close</Button>
            <Button variant="dark" onClick={() => onDecide({ outcome: "separate", ids: [patient.id] })}>
              Clear the flag
            </Button>
          </>
        )
      }
    >
      {!other ? (
        <p className="rounded-inner bg-canvas p-4 text-sm text-ink-2">No matching record is left to compare — it may have been merged already. Clear the flag to take this patient off the duplicates list.</p>
      ) : (
        <>
          {candidates.length > 1 ? (
            <div className="mb-4 flex flex-wrap items-center gap-2" role="radiogroup" aria-label="Compare with">
              <span className="text-xs text-muted">Compare with</span>
              {candidates.map((m) => (
                <button
                  key={m.patient.id}
                  type="button"
                  role="radio"
                  aria-checked={m.patient.id === other.id}
                  onClick={() => {
                    setOtherId(m.patient.id);
                    setKeepId(Date.parse(m.patient.registeredAt) <= Date.parse(patient.registeredAt) ? m.patient.id : patient.id);
                  }}
                  className={cn("h-8 rounded-full px-3 text-xs transition-colors", m.patient.id === other.id ? "bg-charcoal text-white" : "bg-sunken text-ink-2 hover:text-ink")}
                >
                  {m.patient.name}
                </button>
              ))}
            </div>
          ) : null}

          <div className="flex flex-wrap gap-1">
            {match.reasons.map((r) => (
              <span key={r} className="inline-flex h-6 items-center rounded-full bg-primary-soft px-2 text-xs text-primary-ink">
                {r}
              </span>
            ))}
          </div>

          <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Record to keep">
            {[patient, other].map((p) => (
              <RecordCard key={p.id} patient={p} kept={p.id === keepId} onKeep={() => setKeepId(p.id)} />
            ))}
          </div>

          {merge ? (
            <p className="mt-4 text-xs text-muted">
              Merging moves {merge.name}&apos;s visits, documents and notes to <span className="font-mono">{clinicNoOf(keep)}</span>. <span className="font-mono">{clinicNoOf(merge)}</span> stops appearing in search and
              points to the kept record.
            </p>
          ) : null}
        </>
      )}
    </ModalContent>
  );
}

function RecordCard({ patient: p, kept, onKeep }: { patient: RegistryPatient; kept: boolean; onKeep: () => void }) {
  const doctor = staffById(p.careTeam.doctor);
  return (
    <button
      type="button"
      role="radio"
      aria-checked={kept}
      onClick={onKeep}
      className={cn(
        "flex flex-col rounded-card p-2 text-left transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
        kept ? "bg-charcoal" : "bg-sunken hover:bg-sunken-2",
      )}
    >
      <div className="flex flex-1 flex-col rounded-inner bg-surface p-4">
        <div className="flex items-center gap-3">
          <Avatar src={p.avatar} name={p.name} size="md" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm text-ink">{p.name}</p>
            <p className="font-mono text-xs text-muted">{clinicNoOf(p)}</p>
          </div>
        </div>
        <dl className="mt-4 grid grid-cols-[96px_1fr] gap-x-3 gap-y-2 text-xs">
          <Row term="Age · sex">
            {p.age} y · {p.sex}
          </Row>
          <Row term="Mobile">{p.phone}</Row>
          <Row term="Area">{p.area || "—"}</Row>
          <Row term="Primary doctor">{doctor?.name ?? "Not assigned"}</Row>
          <Row term="Registered">{formatDate(p.registeredAt, { day: "numeric", month: "short", year: "numeric" })}</Row>
          <Row term="Last visit">{p.lastVisit ? formatDate(p.lastVisit, { day: "numeric", month: "short", year: "numeric" }) : "None yet"}</Row>
        </dl>
      </div>
      <p className={cn("flex items-center gap-1.5 px-2 pb-1 pt-2 text-xs", kept ? "text-white" : "text-ink-2")}>
        {kept ? <CheckCircle size={16} weight="fill" aria-hidden="true" /> : null}
        {kept ? "Keep this record" : "Merge into the other record"}
      </p>
    </button>
  );
}

function Row({ term, children }: { term: string; children: ReactNode }) {
  return (
    <>
      <dt className="text-muted">{term}</dt>
      <dd className="min-w-0 truncate text-ink-2">{children}</dd>
    </>
  );
}

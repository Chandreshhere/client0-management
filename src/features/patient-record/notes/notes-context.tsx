"use client";

import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";
import { ArrowUpRight, CalendarX, CaretDown, ClipboardText, ClockCounterClockwise, Eye, FileText, Files, FirstAidKit, Notebook, NotePencil, SealCheck, ShieldCheck } from "@phosphor-icons/react";
import type { Patient } from "@/data/types";
import type { CareEvent } from "@/data/featured";
import { NOTES, RECORD_STATE_LABEL } from "@/data/featured";
import { DOC_STATUS_LABEL } from "@/data/records";
import { useRole } from "@/components/shell/role-context";
import { Group, GroupHeader, Inset } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import { Textarea } from "@/components/ui/input";
import { Segmented } from "@/components/ui/segmented";
import { StatusBadge, recordTone } from "@/components/ui/status";
import { ChipGroup } from "@/components/viz/cards";
import { useToast } from "@/components/ui/toast";
import { formatDate, formatTime, TODAY } from "@/lib/format";
import { cn } from "@/lib/cn";
import { authorName } from "@/features/patient/event-meta";
import { CHANGE_KIND_LABEL, MED_RECONCILED, MEDICATIONS, NOTE_SECTIONS, recordHref, type ChangeKind, type ChangeTarget, type RecordDocument } from "../data";
import { localId, updateRecord, useRecord } from "../store";
import { DOC_STATUS_TONE, useEffectiveStatus } from "../document-preview";
import { OrganThumb } from "../record-frame";
import { NOTE_KIND_LABEL, NOTE_LINK_LABEL, baseDocuments, derivedNotes, readableDates, docIdForEvent, isFeaturedPatient, recordOf, systemOf, treatments, type DerivedNote, type DerivedNoteKind } from "../record-model";
import { MonthBars, monthBuckets } from "../month-bars";
import { changesFor, problemsFor, sinceFor } from "./notes-data";

const fmtShort = (d: string) => formatDate(d, { day: "numeric", month: "short" });
const fmtMonth = (d: string) => formatDate(d, { month: "short", year: "numeric" });

/** Left side of the split view (doc §2B): what the doctor should know before and while writing. */
export function NotesContext({ patient, onOpenDoc, canWrite }: { patient: Patient; onOpenDoc: (docId: string) => void; canWrite: boolean }) {
  return (
    <div className="flex flex-col gap-4">
      <ClinicalContext patient={patient} />
      <ChangesSinceLastVisit patient={patient} onOpenDoc={onOpenDoc} />
      <RecentReports patient={patient} onOpenDoc={onOpenDoc} />
      <PreviousNotes patient={patient} canWrite={canWrite} />
    </div>
  );
}

/** Nothing on the record yet: allergies status and where the record starts. */
export function NoRecordContext({ patient }: { patient: Patient }) {
  const first = patient.name.split(" ")[0];
  return (
    <Group>
      <GroupHeader icon={<FirstAidKit />} title="Clinical context" subtitle="Nothing recorded yet" />
      <div className="flex flex-col gap-2">
        <Inset>
          <h3 className="text-xs text-muted">Allergies</h3>
          <AllergyList allergies={patient.allergies} />
        </Inset>
        <Inset>
          <h3 className="text-xs text-muted">Record</h3>
          <p className="mt-2 text-sm leading-relaxed text-ink-2">
            No conditions, results or previous notes are on {first}&apos;s record. Registered {formatDate(patient.registeredAt)}
            {patient.intakeComplete ? "; intake complete." : "; the intake form isn't complete yet."}
          </p>
          <p className="mt-2 text-xs text-muted">Primary concern at registration: {patient.primaryConcern}</p>
          <Button asChild variant="secondary" size="sm" className="mt-3">
            <Link href={recordHref(patient.id)}>
              Open registration &amp; intake
              <ArrowUpRight />
            </Link>
          </Button>
        </Inset>
      </div>
    </Group>
  );
}

function AllergyList({ allergies }: { allergies: string[] | null }) {
  if (allergies === null) return <p className="mt-2 text-sm text-warning">Not recorded — ask before prescribing</p>;
  if (allergies.length === 0) return <p className="mt-2 text-sm text-ink-2">No known allergies (confirmed)</p>;
  return (
    <ul className="mt-2 flex flex-wrap gap-2">
      {allergies.map((a) => (
        <li key={a} className="inline-flex h-7 items-center rounded-full bg-danger-soft px-3 text-xs text-danger">
          {a}
        </li>
      ))}
    </ul>
  );
}

/* ------------------------------------------------------------------ clinical context */

function ClinicalContext({ patient }: { patient: Patient }) {
  const featured = isFeaturedPatient(patient.id);
  const record = recordOf(patient.id);
  const { active, resolved } = problemsFor(patient.id);
  const meds = treatments(patient.id);
  return (
    <Group>
      <GroupHeader icon={<FirstAidKit />} title="Clinical context" subtitle="Allergies · active problems · medication" />
      <div className="flex flex-col gap-2">
        <Inset>
          <h3 className="text-xs text-muted">Allergies</h3>
          <AllergyList allergies={patient.allergies} />
        </Inset>

        <Inset>
          <h3 className="flex items-center justify-between text-xs text-muted">
            <span>Active problems · organ from each condition&apos;s body system</span>
            <span className="tabular">{active.length}</span>
          </h3>
          <ul className="mt-1">
            {active.map((c) => {
              const sys = record ? systemOf(record, c.systemId) : undefined;
              return (
                <li key={c.id} className="flex items-center justify-between gap-3 border-b border-line py-2 last:border-0">
                  <span className="flex min-w-0 items-center gap-3">
                    {sys ? <OrganThumb kind={sys.organ} size="md" /> : null}
                    <span className="min-w-0">
                      <span className="block truncate text-sm text-ink">{c.name}</span>
                      <span className="block text-xs text-muted">
                        {sys ? `${sys.name} · ` : ""}since {fmtMonth(c.since)}
                      </span>
                    </span>
                  </span>
                  <span className="shrink-0 rounded-full px-2.5 py-0.5 text-xs text-ink-2 shadow-[inset_0_0_0_1px_var(--color-line-strong)]">{c.status}</span>
                </li>
              );
            })}
          </ul>
          {resolved ? <p className="mt-1 text-xs text-muted">{resolved} resolved {resolved === 1 ? "problem" : "problems"} not shown</p> : null}
        </Inset>

        {featured ? (
          <Inset>
            <h3 className="text-xs text-muted">Medication · prescribed vs patient-reported</h3>
            <ul className="mt-1">
              {MEDICATIONS.map((m) => (
                <li key={m.id} className="flex items-start justify-between gap-3 border-b border-line py-2 last:border-0">
                  <span className="min-w-0">
                    <span className="block text-sm text-ink">{m.name}</span>
                    <span className="block text-xs text-ink-2">{m.dose}</span>
                    <span className="block text-[11px] text-muted">
                      Prescribed {fmtShort(m.prescribed)} · {authorName(m.by)}
                    </span>
                  </span>
                  <span className="flex w-[124px] shrink-0 flex-col items-end gap-1 text-right">
                    <StatusBadge tone={m.reported === "taking" ? "neutral" : m.reported === "partial" ? "warning" : "danger"} dot={m.reported !== "taking"}>
                      {m.reported === "taking" ? "Taking" : m.reported === "partial" ? "Misses doses" : "Not taking"}
                    </StatusBadge>
                    <span className="text-[11px] leading-tight text-muted">{m.reportedNote}</span>
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-1 text-xs text-muted">
              Patient-reported at reconciliation, {fmtShort(MED_RECONCILED.at)} · <span className="font-mono">{MED_RECONCILED.source.replace("Consultation note ", "")}</span>
            </p>
          </Inset>
        ) : (
          <Inset>
            <h3 className="text-xs text-muted">Medication &amp; treatment plans · as prescribed</h3>
            {meds.length ? (
              <ul className="mt-1">
                {meds.map((m) => {
                  // the plan text repeats its title before the first ";" — show only what it adds
                  const extra = m.detail.startsWith(m.name) ? m.detail.slice(m.name.length).replace(/^[;,.\s]+/, "") : m.detail;
                  return (
                  <li key={m.id} className="border-b border-line py-2 last:border-0">
                    <span className="block text-sm text-ink">{m.name}</span>
                    {extra ? <span className="block text-xs text-ink-2">{extra.charAt(0).toUpperCase() + extra.slice(1)}</span> : null}
                    <span className="block text-[11px] text-muted">
                      Started {formatDate(m.prescribed)} · {authorName(m.by)}
                    </span>
                  </li>
                  );
                })}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-muted">No medication or treatment plan recorded.</p>
            )}
            <p className="mt-1 text-xs text-muted">Whether the patient takes these as prescribed hasn&apos;t been reconciled yet — ask at this visit.</p>
          </Inset>
        )}
      </div>
    </Group>
  );
}

/* ------------------------------------------------------------------ changes since last visit */

type ChangeItem = { id: string; kind: ChangeKind; date: string; title: string; detail: string; byName: string; target: ChangeTarget; selfReported?: boolean; local?: boolean };

const KIND_ICON: Record<ChangeKind, ReactNode> = {
  report: <FileText />,
  plan: <ClipboardText />,
  guidance: <ShieldCheck />,
  missed: <CalendarX />,
};

function ChangesSinceLastVisit({ patient, onOpenDoc }: { patient: Patient; onOpenDoc: (docId: string) => void }) {
  const uploads = useRecord((s) => s.uploads);
  const reviews = useRecord((s) => s.reviews);
  const [kind, setKind] = useState<"all" | ChangeKind>("all");
  const since = sinceFor(patient);

  const items = useMemo<ChangeItem[]>(() => {
    const local: ChangeItem[] = uploads
      .filter((u) => u.patientId === patient.id && u.uploadedAt >= since)
      .map((u) => ({ id: u.id, kind: "report", date: u.uploadedAt.slice(0, 10), title: u.title, detail: `${u.type} dated ${formatDate(u.reportDate)} — added in this session.`, byName: u.uploadedBy, target: { tab: "documents", docId: u.id }, local: true }));
    const seeded: ChangeItem[] = changesFor(patient.id).map((c) => ({ ...c, byName: authorName(c.by) }));
    return [...local, ...seeded].sort((a, b) => b.date.localeCompare(a.date));
  }, [uploads, patient.id, since]);

  const kinds = (Object.keys(CHANGE_KIND_LABEL) as ChangeKind[]).filter((k) => items.some((i) => i.kind === k));
  const shown = items.filter((i) => kind === "all" || i.kind === kind);
  const sinceLabel = patient.lastVisit || isFeaturedPatient(patient.id) ? "Changes since last visit" : "Changes since registration";

  return (
    <Group>
      <GroupHeader icon={<ClockCounterClockwise />} title={sinceLabel} subtitle={`Since ${formatDate(since, { weekday: "short", day: "numeric", month: "short" })} · ${items.length} ${items.length === 1 ? "update" : "updates"}`} />
      {kinds.length > 1 ? (
        <div className="px-2 pb-3 pt-1">
          <Segmented<"all" | ChangeKind>
            ariaLabel="Filter changes"
            size="sm"
            className="flex-wrap"
            value={kind}
            onChange={setKind}
            items={[{ value: "all", label: "All", count: items.length }, ...kinds.map((k) => ({ value: k, label: CHANGE_KIND_LABEL[k], count: items.filter((i) => i.kind === k).length }))]}
          />
        </div>
      ) : null}
      <Inset className="py-1">
        {shown.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted">{items.length ? "Nothing in this category since then." : "Nothing new has reached the record since then."}</p>
        ) : (
          <ul>
            {shown.map((i) => {
              const docId = "tab" in i.target ? i.target.docId : undefined;
              const reviewed = docId ? !!reviews[docId] : false;
              return (
                <li key={i.id} className="flex items-start gap-3 border-b border-line py-3 last:border-0">
                  <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-sunken text-ink-2 [&_svg]:size-4">{KIND_ICON[i.kind]}</span>
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-ink">
                      {i.title}
                      {i.selfReported ? <span className="inline-flex h-5 items-center rounded-full bg-sunken px-2 text-[11px] text-ink-2">Self-reported</span> : null}
                    </p>
                    <p className="mt-0.5 text-xs leading-relaxed text-muted">{i.detail}</p>
                    <p className="mt-1 text-[11px] text-muted">
                      {fmtShort(i.date)} · {i.byName}
                      {reviewed ? <span className="text-success"> · reviewed in this session</span> : null}
                    </p>
                  </div>
                  <ChangeAction item={i} patientId={patient.id} onOpenDoc={onOpenDoc} />
                </li>
              );
            })}
          </ul>
        )}
      </Inset>
    </Group>
  );
}

function ChangeAction({ item, patientId, onOpenDoc }: { item: ChangeItem; patientId: string; onOpenDoc: (docId: string) => void }) {
  const t = item.target;
  if ("tab" in t && t.docId) {
    const docId = t.docId;
    return (
      <IconButton label={`Open ${item.title} beside the note`} size="sm" variant="ghost" tooltip="left" onClick={() => onOpenDoc(docId)}>
        <ArrowUpRight />
      </IconButton>
    );
  }
  const href = "tab" in t ? recordHref(patientId, t.tab) : t.href;
  const label = "tab" in t ? `Open ${item.title}` : t.label;
  return (
    <IconButton asChild label={label} size="sm" variant="ghost" tooltip="left">
      <Link href={href}>
        <ArrowUpRight />
      </Link>
    </IconButton>
  );
}

/* ------------------------------------------------------------------ recent reports */

function RecentReports({ patient, onOpenDoc }: { patient: Patient; onOpenDoc: (docId: string) => void }) {
  const uploads = useRecord((s) => s.uploads);
  const statusOf = useEffectiveStatus();
  const docs = useMemo<RecordDocument[]>(
    () =>
      [...uploads.filter((u) => u.patientId === patient.id), ...baseDocuments(patient.id)]
        .filter((d) => d.type === "Lab report" || d.type === "Imaging")
        .sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt))
        .slice(0, 4),
    [uploads, patient.id],
  );
  return (
    <Group>
      <GroupHeader icon={<Files />} title="Recent reports" subtitle="Opens beside the note" href={recordHref(patient.id, "documents")} actionLabel="Open all documents" />
      <div className="flex flex-col gap-2">
        {docs.length === 0 ? <Inset className="text-sm text-muted">No lab or imaging reports on file.</Inset> : null}
        {docs.map((d) => {
          const status = statusOf(d);
          return (
            <button key={d.id} type="button" onClick={() => onOpenDoc(d.id)} className="flex items-center gap-3 rounded-inner bg-surface p-3 text-left transition-colors hover:bg-canvas">
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm text-ink">{d.title}</span>
                <span className="block text-xs text-muted">
                  Report {fmtShort(d.reportDate)}
                  {d.reportDate.slice(0, 4) !== "2026" ? ` ${d.reportDate.slice(0, 4)}` : ""} · uploaded {fmtShort(d.uploadedAt)}
                </span>
              </span>
              <StatusBadge tone={DOC_STATUS_TONE[status]}>{DOC_STATUS_LABEL[status]}</StatusBadge>
            </button>
          );
        })}
      </div>
    </Group>
  );
}

/* ------------------------------------------------------------------ previous notes */

const KIND_ORDER: DerivedNoteKind[] = ["consultation", "review", "letter"];
type KindChip = "all" | DerivedNoteKind;

function PreviousNotes({ patient, canWrite }: { patient: Patient; canWrite: boolean }) {
  const featured = isFeaturedPatient(patient.id);
  const derived = derivedNotes(patient.id);
  const firstId = featured ? NOTES[0]?.id : derived[0]?.id;
  const [open, setOpen] = useState<string | null>(firstId ?? null);
  const [month, setMonth] = useState<string | null>(null);
  const [kinds, setKinds] = useState<DerivedNoteKind[]>([]);
  const toggle = (id: string) => setOpen((o) => (o === id ? null : id));

  // one list for both shapes: when each note was written and what kind it is
  const items = useMemo(
    () => (featured ? NOTES.map((n) => ({ id: n.id, date: n.date, kind: "consultation" as DerivedNoteKind })) : derived.map((n) => ({ id: n.id, date: n.date, kind: n.kind }))),
    [featured, derived],
  );
  const buckets = useMemo(() => monthBuckets(items.map((i) => ({ reportDate: i.date, awaiting: false }))).map((b) => (b.key === "earlier" ? { ...b, label: "Older" } : b)), [items]);
  const inMonth = (d: string) => !month || (month === "earlier" ? d.slice(0, 7) < buckets[1].key : d.startsWith(month));
  const shown = new Set(items.filter((i) => inMonth(i.date) && (kinds.length === 0 || kinds.includes(i.kind))).map((i) => i.id));
  const presentKinds = KIND_ORDER.filter((k) => items.some((i) => i.kind === k));
  const count = items.length;
  const filtered = month !== null || kinds.length > 0;
  const clear = () => {
    setMonth(null);
    setKinds([]);
  };
  const selectedBucket = buckets.find((b) => b.key === month);

  return (
    <Group>
      <GroupHeader icon={<Notebook />} title="Previous notes" subtitle={`${count} signed · corrections are addenda, the signed text never changes`} />
      <div className="flex flex-col gap-2">
        {count > 1 ? (
          <Inset>
            <div className="flex items-start justify-between gap-2">
              <h3 className="text-xs text-muted">Signed notes per month · by the date written</h3>
              {selectedBucket ? (
                <button type="button" onClick={() => setMonth(null)} className="inline-flex h-6 shrink-0 items-center gap-1 rounded-full bg-charcoal px-2.5 text-[11px] text-white">
                  {selectedBucket.long.replace(/^Before /, "< ")} · {selectedBucket.count}
                  <span aria-hidden="true">×</span>
                  <span className="sr-only">Clear month filter</span>
                </button>
              ) : null}
            </div>
            <MonthBars className="mt-2 h-20 gap-1" buckets={buckets} value={month} onChange={setMonth} noun={["signed note", "signed notes"]} label="Signed notes per month — select a month to filter" />
            {presentKinds.length > 1 ? (
              <ChipGroup<KindChip>
                ariaLabel="Note kind"
                variant="dark"
                className="mt-3"
                options={[{ value: "all", label: "All", count }, ...presentKinds.map((k) => ({ value: k, label: NOTE_KIND_LABEL[k], count: items.filter((i) => i.kind === k).length }))]}
                value={kinds.length ? kinds : ["all"]}
                onChange={(next) => {
                  const added = next.find((v) => !(kinds.length ? kinds : ["all"]).includes(v));
                  if (added === "all" || next.length === 0) setKinds([]);
                  else setKinds(next.filter((v): v is DerivedNoteKind => v !== "all"));
                }}
              />
            ) : null}
          </Inset>
        ) : null}
        {featured
          ? NOTES.filter((n) => shown.has(n.id)).map((n) => <SignedNote key={n.id} note={n} open={open === n.id} onToggle={() => toggle(n.id)} canWrite={canWrite} />)
          : derived.filter((n) => shown.has(n.id)).map((n) => <DerivedNoteCard key={n.id} patientId={patient.id} note={n} open={open === n.id} onToggle={() => toggle(n.id)} canWrite={canWrite} />)}
        {count === 0 ? <Inset className="text-sm text-muted">No signed notes on this record yet.</Inset> : null}
        {count > 0 && shown.size === 0 ? (
          <Inset className="flex items-center justify-between gap-3 text-sm text-muted">
            No signed notes match this month and kind.
            <Button size="sm" variant="secondary" onClick={clear}>
              Clear filters
            </Button>
          </Inset>
        ) : null}
        {filtered && shown.size > 0 ? (
          <p className="px-2 text-xs text-muted">
            Showing {shown.size} of {count} ·{" "}
            <button type="button" onClick={clear} className="text-ink-2 underline underline-offset-4">
              Clear filters
            </button>
          </p>
        ) : null}
      </div>
    </Group>
  );
}

type SignedNoteData = (typeof NOTES)[number];

/** Addenda list + "Add addendum" (unsigned, this session) — shared by both note kinds. */
function Addenda({ noteId, noteTitle, seeded, canWrite }: { noteId: string; noteTitle: string; seeded: { at: string; by: string; text: string }[]; canWrite: boolean }) {
  const { user } = useRole();
  const { toast } = useToast();
  const local = useRecord((s) => s.addenda);
  const [writing, setWriting] = useState(false);
  const [text, setText] = useState("");
  const addenda = [
    ...seeded.map((a) => ({ id: `${noteId}-${a.at}`, at: a.at, byName: authorName(a.by), text: a.text, draft: false })),
    ...local.filter((a) => a.noteId === noteId).map((a) => ({ id: a.id, at: a.at, byName: a.by, text: a.text, draft: true })),
  ];

  const save = () => {
    if (!text.trim()) return;
    updateRecord((s) => ({ ...s, addenda: [...s.addenda, { id: localId("add"), noteId, text: text.trim(), by: user.name, at: TODAY.toISOString() }] }));
    toast({ title: "Addendum saved as an unsigned draft", description: "Linked to the signed note in this browser session. Signing it needs a verified identity — not available here." });
    setText("");
    setWriting(false);
  };

  return (
    <>
      {addenda.length ? (
        <section className="mt-4" aria-label="Addenda">
          <h4 className="text-xs text-muted">Addenda</h4>
          <ol className="mt-2 flex flex-col gap-3 border-l border-line-strong pl-4">
            {addenda.map((a) => (
              <li key={a.id} className="relative">
                <span className={cn("absolute -left-[21px] top-1.5 size-2.5 rounded-full ring-2 ring-surface", a.draft ? "border border-dashed border-ink-2 bg-surface" : "bg-ink-2")} aria-hidden="true" />
                <p className="flex flex-wrap items-center gap-2 text-[11px] text-muted">
                  {formatDate(a.at, { day: "numeric", month: "short", year: "numeric" })}, {formatTime(a.at)} · {a.byName}
                  {a.draft ? <StatusBadge tone="draft">Unsigned · this session</StatusBadge> : null}
                </p>
                <p className="mt-0.5 text-sm leading-relaxed text-ink-2">{a.text}</p>
              </li>
            ))}
          </ol>
        </section>
      ) : null}
      {canWrite ? (
        writing ? (
          <div className="mt-4 flex flex-col gap-2">
            <Textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="Correction or additional information — the signed text stays unchanged." aria-label={`Addendum to ${noteTitle}`} className="min-h-20" autoFocus />
            <div className="flex justify-end gap-2">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setWriting(false);
                  setText("");
                }}
              >
                Cancel
              </Button>
              <Button size="sm" variant="dark" disabled={!text.trim()} onClick={save}>
                Save addendum
              </Button>
            </div>
          </div>
        ) : (
          <Button size="sm" variant="secondary" className="mt-4" leading={<NotePencil />} onClick={() => setWriting(true)}>
            Add addendum
          </Button>
        )
      ) : null}
    </>
  );
}

function useAddendaCount(noteId: string, seeded: number) {
  const local = useRecord((s) => s.addenda);
  return seeded + local.filter((a) => a.noteId === noteId).length;
}

function SignedNote({ note, open, onToggle, canWrite }: { note: SignedNoteData; open: boolean; onToggle: () => void; canWrite: boolean }) {
  const panelId = `note-panel-${note.id}`;
  const addendaCount = useAddendaCount(note.id, note.addenda.length);
  return (
    <Inset className="p-0">
      <button type="button" onClick={onToggle} aria-expanded={open} aria-controls={panelId} className="flex w-full items-start gap-3 rounded-inner p-4 text-left transition-colors hover:bg-canvas">
        <span className="min-w-0 flex-1">
          <span className="block text-sm text-ink">{note.title}</span>
          <span className="block text-xs text-muted">
            {formatDate(note.date)} · {authorName(note.authorId)}
            {addendaCount ? ` · ${addendaCount} addend${addendaCount === 1 ? "um" : "a"}` : ""}
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-2">
          <StatusBadge tone="success">Signed</StatusBadge>
          <CaretDown size={16} className={cn("text-muted transition-transform duration-300 [transition-timing-function:var(--ease-spring)]", open && "rotate-180")} aria-hidden="true" />
        </span>
      </button>
      {open ? (
        <div id={panelId} className="px-4 pb-4">
          <dl className="flex flex-col gap-3">
            {NOTE_SECTIONS.map((s) => (
              <div key={s.key}>
                <dt className="text-xs text-muted">{s.label}</dt>
                <dd className="mt-0.5 text-sm leading-relaxed text-ink-2">{note.sections[s.key]}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
            <SealCheck size={16} className="text-success" aria-hidden="true" />
            Signed by {authorName(note.authorId)} · {formatDate(note.signedAt)}, {formatTime(note.signedAt)}
            {note.released ? (
              <span className="inline-flex items-center gap-1">
                · <Eye size={14} aria-hidden="true" /> released to patient
              </span>
            ) : null}
          </p>
          <Addenda noteId={note.id} noteTitle={note.title} seeded={note.addenda} canWrite={canWrite} />
        </div>
      ) : null}
    </Inset>
  );
}

/** Where a linked event lives in the record tabs. */
function linkHref(patientId: string, e: CareEvent): string | null {
  const docId = docIdForEvent(patientId, e.id);
  if (e.type === "lab") return e.values?.length ? recordHref(patientId, "labs") : docId ? `${recordHref(patientId, "documents")}?doc=${docId}` : null;
  if (e.type === "imaging") return recordHref(patientId, "imaging");
  if (e.type === "vitals" || e.type === "movement") return e.values?.length ? recordHref(patientId, "vitals") : null;
  if (e.type === "document") return docId ? `${recordHref(patientId, "documents")}?doc=${docId}` : null;
  if (e.type === "medication") return `/patients/${patientId}/journey`;
  if (e.type === "nutrition") return "/nutrition";
  return null;
}

/** A signed note from a generated record: the record's text, plus what it documented links to. */
function DerivedNoteCard({ patientId, note, open, onToggle, canWrite }: { patientId: string; note: DerivedNote; open: boolean; onToggle: () => void; canWrite: boolean }) {
  const panelId = `note-panel-${note.id}`;
  const record = recordOf(patientId);
  const sys = record ? systemOf(record, note.systemId) : undefined;
  const addendaCount = useAddendaCount(note.id, 0);
  const letter = note.kind === "letter";
  const review = note.kind === "review";
  return (
    <Inset className="p-0">
      <button type="button" onClick={onToggle} aria-expanded={open} aria-controls={panelId} className="flex w-full items-start gap-3 rounded-inner p-4 text-left transition-colors hover:bg-canvas">
        {sys ? <OrganThumb kind={sys.organ} size="md" className="mt-0.5" /> : null}
        <span className="min-w-0 flex-1">
          <span className="block text-sm text-ink">{note.title}</span>
          <span className="block text-xs text-muted">
            {letter ? "Referral letter · " : review ? "Review · " : ""}
            {formatDate(note.date)} · {authorName(note.authorId)}
            {addendaCount ? ` · ${addendaCount} addend${addendaCount === 1 ? "um" : "a"}` : ""}
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-2">
          <StatusBadge tone={letter ? recordTone(note.state) : "success"}>{letter ? (note.state === "completed" ? "Acted on" : "Sent · open") : RECORD_STATE_LABEL[note.state]}</StatusBadge>
          <CaretDown size={16} className={cn("text-muted transition-transform duration-300 [transition-timing-function:var(--ease-spring)]", open && "rotate-180")} aria-hidden="true" />
        </span>
      </button>
      {open ? (
        <div id={panelId} className="px-4 pb-4">
          <dl className="flex flex-col gap-3">
            <div>
              <dt className="text-xs text-muted">{letter ? "Letter" : review ? "Measured and signed at this review" : "Note"}</dt>
              <dd className="mt-0.5 text-sm leading-relaxed text-ink-2">{readableDates(note.body)}</dd>
              {note.trend ? <dd className="mt-1 text-xs text-muted">{note.trend}</dd> : null}
            </div>
            {note.links.length ? (
              <div>
                <dt className="text-xs text-muted">Documented links · what this {letter ? "letter" : "note"} connects to in the record</dt>
                <dd className="mt-1">
                  <ul className="flex flex-col gap-1">
                    {note.links.map((l) => {
                      const href = linkHref(patientId, l.event);
                      const value = l.event.values?.map((v) => `${v.label} ${v.value}${v.unit ? ` ${v.unit}` : ""}`).join(", ");
                      const body = (
                        <>
                          <span className="w-[76px] shrink-0 text-xs text-muted">{NOTE_LINK_LABEL[l.kind]}</span>
                          <span className="min-w-0 flex-1 text-sm text-ink-2">
                            {l.event.title}
                            {value ? <span className="text-muted"> · {value}</span> : null}
                            <span className="block text-[11px] text-muted">{formatDate(l.event.date)}</span>
                          </span>
                          {href ? <ArrowUpRight size={14} className="mt-0.5 shrink-0 text-muted" aria-hidden="true" /> : null}
                        </>
                      );
                      return (
                        <li key={`${l.kind}-${l.event.id}`}>
                          {href ? (
                            <Link href={href} className="-mx-2 flex items-start gap-2 rounded-[12px] px-2 py-1.5 transition-colors hover:bg-canvas">
                              {body}
                            </Link>
                          ) : (
                            <span className="-mx-2 flex items-start gap-2 px-2 py-1.5">{body}</span>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </dd>
              </div>
            ) : null}
          </dl>
          <p className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
            <SealCheck size={16} className="text-success" aria-hidden="true" />
            {letter ? "Written" : "Signed"} by {authorName(note.authorId)} · {formatDate(note.signedAt)}, {formatTime(note.signedAt)} · <span className="font-mono">{note.source}</span>
            {note.released ? (
              <span className="inline-flex items-center gap-1">
                · <Eye size={14} aria-hidden="true" /> released to patient
              </span>
            ) : null}
          </p>
          <Addenda noteId={note.id} noteTitle={note.title} seeded={[]} canWrite={canWrite} />
        </div>
      ) : null}
    </Inset>
  );
}

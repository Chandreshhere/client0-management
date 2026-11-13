import type { Appointment, Patient } from "@/data/types";
import type { BodySystem, CareEvent, Condition, LinkKind, RecordState } from "@/data/featured";
import { CARE_EVENTS, LAB_PANELS } from "@/data/featured";
import { getRecord, hasRecord, type PatientRecord } from "@/data/record";
import { DOCUMENTS } from "@/data/records";
import { WEEK_APPOINTMENTS } from "@/data/appointments";
import { FEATURED_PATIENT_ID, patientById } from "@/data/patients";
import { authorName } from "@/features/patient/event-meta";
import { DOC_EVENT, EXTRA_DOCUMENTS, type ChangeKind, type ChangeTarget, type DocSource, type DocType, type RecordDocument, type StudyKind } from "./data";

/**
 * Everything the record tabs show for a patient, DERIVED from their own record
 * (`getRecord`: conditions → body systems → dated events with documented links) plus the shared
 * fixtures (documents, appointments). Kabir keeps his hand-written extras (notes, lab panels,
 * vital series); every other patient gets the same tabs computed from their data — never copied
 * numbers. Pure and deterministic, cached per patient.
 */

export const TODAY_DATE = "2026-11-13";
const fmtDay = (d: string) => new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" }).format(new Date(`${d}T12:00:00+05:30`));
const NOW_ISO = "2026-11-13T09:40:00+05:30";

export const isFeaturedPatient = (id: string) => id === FEATURED_PATIENT_ID;

/** Record summaries are generated with ISO dates ("reported 2026-10-02"); show them the app's way. */
export const readableDates = (text: string) => text.replace(/\b(\d{4}-\d{2}-\d{2})\b/g, (iso) => fmtDay(iso));

/** The patient's record, or null when nothing clinical is recorded yet (no classified condition). */
export function recordOf(patientId: string): PatientRecord | null {
  return hasRecord(patientId) ? getRecord(patientId) : null;
}

const memo = <T,>(fn: (id: string) => T) => {
  const cache = new Map<string, T>();
  return (id: string): T => {
    if (!cache.has(id)) cache.set(id, fn(id));
    return cache.get(id)!;
  };
};

export const eventById = (record: PatientRecord, id: string | undefined) => (id ? record.events.find((e) => e.id === id) : undefined);
export const systemOf = (record: PatientRecord, id: string | undefined) => record.systems.find((s) => s.id === id);
export const conditionOf = (record: PatientRecord, id: string | undefined) => record.conditions.find((c) => c.id === id);
export const conditionsOf = (record: PatientRecord, systemId: string) => record.conditions.filter((c) => c.systemId === systemId);

/** "Type 2 Diabetes, Hypertension" — the active problems a body system groups. */
export function systemConditionText(record: PatientRecord, s: BodySystem) {
  const cs = conditionsOf(record, s.id);
  const active = cs.filter((c) => c.status !== "Resolved");
  return (active.length ? active : cs).map((c) => c.name).join(", ");
}

/* ------------------------------------------------------------------ documents */

const LAB_PREFIX = "lab:";

function docTypeFor(e: CareEvent): DocType | null {
  if (e.type === "lab") return "Lab report";
  if (e.type === "imaging") return "Imaging";
  if (e.type === "document" && /^Referral/.test(e.source)) return "Referral letter";
  return null;
}

/**
 * Documents on file: the shared document queue for this patient plus every lab, imaging and
 * referral event in their record that produced a report (scheduled requests have none yet).
 * Report date = when it happened; uploaded = when it was entered in Carelane.
 */
export const baseDocuments = memo((patientId: string): RecordDocument[] => {
  const shared = DOCUMENTS.filter((d) => d.patientId === patientId);
  if (isFeaturedPatient(patientId)) {
    return [...shared.map((d) => ({ ...d, eventId: DOC_EVENT[d.id] })), ...EXTRA_DOCUMENTS];
  }
  const patient = patientById(patientId);
  const record = recordOf(patientId);
  const fromShared: RecordDocument[] = shared.map((d) => {
    const eventId = `${patientId}-${d.id}`;
    return { ...d, eventId: record && eventById(record, eventId) ? eventId : undefined };
  });
  if (!record || !patient) return fromShared;
  const sharedEventIds = new Set(fromShared.map((d) => d.eventId));
  const derived: RecordDocument[] = record.events
    .filter((e) => !sharedEventIds.has(e.id) && e.state !== "scheduled" && e.date <= TODAY_DATE)
    .flatMap((e): RecordDocument[] => {
      const type = docTypeFor(e);
      if (!type) return [];
      const lab = e.authorId.startsWith(LAB_PREFIX);
      const self = e.authorId === patientId;
      const source: DocSource = lab ? "Lab partner" : self ? "Patient upload" : "Clinic upload";
      const referral = type === "Referral letter";
      return [
        {
          id: e.id,
          title: e.title,
          patientId,
          type,
          reportDate: e.date,
          uploadedAt: e.enteredAt,
          uploadedBy: lab ? `Lab partner · ${authorName(e.authorId)}` : authorName(e.authorId),
          source,
          reviewerId: referral ? e.authorId : (patient.careTeam.doctor ?? null),
          dueBy: null,
          status: referral ? "filed" : e.state === "awaiting-review" ? "awaiting-review" : "reviewed",
          sensitivity: "standard",
          pages: Math.max(1, e.values?.length ?? 1),
          eventId: e.id,
          summary: e.summary,
        },
      ];
    });
  return [...fromShared, ...derived];
});

/** Care event behind a document (Kabir's hand-written events or the patient's derived record). */
export function eventForDoc(patientId: string, doc: RecordDocument): CareEvent | undefined {
  const id = doc.eventId ?? (isFeaturedPatient(patientId) ? DOC_EVENT[doc.id] : undefined);
  if (!id) return undefined;
  if (isFeaturedPatient(patientId)) return CARE_EVENTS.find((e) => e.id === id);
  const record = recordOf(patientId);
  return record ? eventById(record, id) : undefined;
}

/** Document id that carries a given event's report, if any. */
export function docIdForEvent(patientId: string, eventId: string | undefined) {
  if (!eventId) return undefined;
  return baseDocuments(patientId).find((d) => d.eventId === eventId)?.id;
}

/* ------------------------------------------------------------------ measurements */

export type Flag = "high" | "low" | null;
export type SeriesSource = "Lab" | "Clinic" | "Home device (self-reported)" | "Clinic & home";

export interface SeriesPoint {
  d: string;
  v: number;
  flag: Flag;
  self: boolean;
  eventId: string;
  state: RecordState;
}

export interface MeasureSeries {
  key: string;
  label: string;
  unit: string;
  systemId: string;
  /** lab results (Labs tab) vs clinic/home measurements (Vital signs tab) */
  lab: boolean;
  points: SeriesPoint[];
  low?: number;
  high?: number;
  decimals: number;
  source: SeriesSource;
}

/**
 * Two-sided targets the record's range strings can't express ("< 3" for INR loses the lower
 * limit; the generator flags values below 2 as low). Standard warfarin therapeutic range.
 */
const TWO_SIDED: Record<string, { low: number; high: number }> = { INR: { low: 2, high: 3 } };

function parseRange(text: string | undefined): { low?: number; high?: number } {
  if (!text) return {};
  const n = (s: string) => Number(s.replace(/,/g, ""));
  const two = text.match(/^\s*([\d.]+)\s*[–-]\s*([\d.]+)/);
  if (two) return { low: n(two[1]), high: n(two[2]) };
  const hi = text.match(/^\s*[<≤]\s*([\d.]+)/);
  if (hi) return { high: n(hi[1]) };
  const lo = text.match(/^\s*[>≥]\s*([\d.]+)/);
  if (lo) return { low: n(lo[1]) };
  return {};
}

const decimalsOf = (s: string) => (s.includes(".") ? s.split(".")[1].length : 0);

/**
 * One coherent series per measured label. When two body systems monitor the same label (e.g.
 * weight for NAFLD and for pre-diabetes) the generated record holds two independent series with
 * conflicting values; we keep the series of the first system that monitors it.
 */
export const measureSeries = memo((patientId: string): MeasureSeries[] => {
  const record = recordOf(patientId);
  if (!record) return [];
  const owner = new Map<string, string>();
  for (const s of record.systems) {
    for (const e of record.events) {
      if (e.systemId !== s.id) continue;
      for (const v of e.values ?? []) if (!owner.has(v.label)) owner.set(v.label, s.id);
    }
  }
  const out: MeasureSeries[] = [];
  for (const [label, systemId] of owner) {
    const events = record.events.filter((e) => e.systemId === systemId && e.values?.some((v) => v.label === label));
    const points: SeriesPoint[] = [];
    let unit = "";
    let decimals = 0;
    for (const e of events) {
      const v = e.values!.find((x) => x.label === label)!;
      const num = Number(v.value);
      if (!Number.isFinite(num)) continue;
      unit = v.unit ?? unit;
      decimals = Math.max(decimals, decimalsOf(v.value));
      points.push({ d: e.date, v: num, flag: v.flag ?? null, self: e.state === "self-reported" || e.authorId === patientId, eventId: e.id, state: e.state });
    }
    if (!points.length) continue;
    points.sort((a, b) => a.d.localeCompare(b.d));
    const system = systemOf(record, systemId);
    const reading = system?.vitals.find((v) => v.label === label);
    const range = TWO_SIDED[label] ?? parseRange(reading?.range);
    const lab = events.every((e) => e.type === "lab");
    const selfCount = points.filter((p) => p.self).length;
    const source: SeriesSource = lab ? "Lab" : selfCount === points.length ? "Home device (self-reported)" : selfCount ? "Clinic & home" : "Clinic";
    out.push({ key: label, label, unit, systemId, lab, points, low: range.low, high: range.high, decimals, source });
  }
  // system order first, then first appearance
  const order = (id: string) => record.systems.findIndex((s) => s.id === id);
  return out.sort((a, b) => order(a.systemId) - order(b.systemId));
});

export const flagFor = (v: number, low?: number, high?: number): Flag => (high !== undefined && v > high ? "high" : low !== undefined && v < low ? "low" : null);

/** "Target < 7 %", "Target ≥ 30 ng/mL", "Target 2 – 3". */
export function targetText(low: number | undefined, high: number | undefined, unit: string) {
  const u = unit ? ` ${unit}` : "";
  if (low !== undefined && high !== undefined) return `Target ${low} – ${high}${u}`;
  if (high !== undefined) return `Target < ${high}${u}`;
  if (low !== undefined) return `Target ≥ ${low}${u}`;
  return "No target set — trend only";
}

export const fmtValue = (v: number, decimals: number) => v.toFixed(decimals);

/* ------------------------------------------------------------------ lab analytes (Labs tab) */

export interface LabAnalyte {
  key: string;
  name: string;
  unit: string;
  low?: number;
  high?: number;
  /** "< 70", "13.5 – 17.5" */
  rangeText: string;
  isTarget: boolean;
  systemId?: string;
  decimals: number;
  points: { d: string; v: number; flag: Flag; eventId?: string }[];
}

export interface LabGroup {
  id: string;
  name: string;
  /** body system this group belongs to (organ for the strip and the chips) */
  systemId?: string;
  analytes: LabAnalyte[];
}

const KABIR_PANEL_SYSTEM: Record<string, string | undefined> = { lipid: "circulatory", cbc: "circulatory", metabolic: undefined };

export const labGroups = memo((patientId: string): LabGroup[] => {
  if (isFeaturedPatient(patientId)) {
    return LAB_PANELS.map((p) => ({
      id: p.id,
      name: p.name,
      systemId: KABIR_PANEL_SYSTEM[p.id],
      analytes: p.analytes.map((a) => {
        const low = "low" in a && typeof a.low === "number" ? a.low : undefined;
        const high = "high" in a && typeof a.high === "number" ? a.high : undefined;
        const isTarget = a.range.includes("(target)");
        const decimals = Math.max(0, ...a.points.map((pt) => decimalsOf(String(pt.v))));
        return {
          key: a.name,
          name: a.name,
          unit: a.unit,
          low,
          high,
          rangeText: a.range.replace(/\s*\(target\)/, ""),
          isTarget,
          decimals,
          points: [...a.points].sort((x, y) => x.d.localeCompare(y.d)).map((pt) => ({ d: pt.d, v: pt.v, flag: flagFor(pt.v, low, high) })),
        };
      }),
    }));
  }
  const record = recordOf(patientId);
  if (!record) return [];
  const labs = measureSeries(patientId).filter((s) => s.lab);
  return record.systems
    .map((s) => ({
      id: s.id,
      name: s.name,
      systemId: s.id,
      analytes: labs
        .filter((a) => a.systemId === s.id)
        .map((a) => ({
          key: a.key,
          name: a.label,
          unit: a.unit,
          low: a.low,
          high: a.high,
          rangeText: a.low !== undefined && a.high !== undefined ? `${a.low} – ${a.high}` : a.high !== undefined ? `< ${a.high}` : a.low !== undefined ? `≥ ${a.low}` : "—",
          isTarget: true,
          systemId: s.id,
          decimals: a.decimals,
          points: a.points.map((p) => ({ d: p.d, v: p.v, flag: p.flag ?? flagFor(p.v, a.low, a.high), eventId: p.eventId })),
        })),
    }))
    .filter((g) => g.analytes.length > 0);
});

/** Lab reports in the record that carry no transcribed values (the document holds them). */
export const untranscribedLabDocs = memo((patientId: string) =>
  baseDocuments(patientId).filter((d) => {
    if (d.type !== "Lab report") return false;
    const e = eventForDoc(patientId, d);
    return !e?.values?.length;
  }),
);

/* ------------------------------------------------------------------ imaging */

export interface Study {
  id: string;
  title: string;
  date: string;
  /** null = requested/scheduled, nothing to render yet */
  kind: StudyKind | null;
  systemId: string;
  event?: CareEvent;
  docId?: string;
}

/** Infer the render from the study title (the record's own kind mislabels spine MRI as chest CT). */
export function studyKindFor(title: string, featured: boolean): StudyKind {
  const t = title.toLowerCase();
  if (/spine|lumbar|cervical|spondyl/.test(t)) return "spine-mri";
  if (t.includes("angiograph") || t.includes("mra")) return "brain-mra";
  if (t.includes("carotid")) return "carotid";
  if (t.includes("x-ray")) return "chest-xray";
  if (/\bct\b|hrct/.test(t)) return "chest-ct";
  // the shared echo render prints Kabir's own EF; other patients get the unlabelled render
  if (t.includes("echo")) return featured ? "echo" : "echo-plain";
  return "cardiac-mri";
}

/**
 * Who stands behind a study: for reports that arrived as uploaded documents the record's author
 * is the assigned reviewer (the external reporting clinician isn't recorded); otherwise the
 * author reported it.
 */
export function studyPeople(patientId: string, study: Study): { reporter: string | null; reviewerId: string | null; via: string | null } {
  const e = study.event;
  if (!e) return { reporter: null, reviewerId: null, via: null };
  const doc = study.docId ? baseDocuments(patientId).find((d) => d.id === study.docId) : undefined;
  if (doc && /^Document /.test(e.source)) return { reporter: null, reviewerId: doc.reviewerId, via: `${doc.source}${doc.uploadedBy !== doc.source ? ` · ${doc.uploadedBy}` : ""}` };
  return { reporter: e.authorId, reviewerId: null, via: e.authorRole };
}

export const studies = memo((patientId: string): Study[] => {
  const record = recordOf(patientId);
  if (!record) return [];
  const featured = isFeaturedPatient(patientId);
  const linked: Study[] = record.systems.flatMap((s) =>
    s.imaging.map((img) => {
      const event = eventById(record, img.eventId);
      return {
        id: img.id,
        title: img.title,
        date: img.date,
        kind: featured ? img.kind : studyKindFor(img.title, false),
        systemId: s.id,
        event,
        docId: docIdForEvent(patientId, event?.id),
      };
    }),
  );
  const linkedEvents = new Set(linked.map((l) => l.event?.id));
  const unlinked: Study[] = record.events
    .filter((e) => e.type === "imaging" && !linkedEvents.has(e.id))
    .map((e) => ({
      id: e.id,
      title: e.title,
      date: e.date,
      kind: e.state === "scheduled" ? null : studyKindFor(e.title, featured),
      systemId: e.systemId,
      event: e,
      docId: docIdForEvent(patientId, e.id),
    }));
  return [...linked, ...unlinked];
});

/* ------------------------------------------------------------------ notes */

/** "based-on": an ordered result dated before the note; "earlier": any other link that points back in time. */
export type NoteLinkKind = LinkKind | "based-on" | "earlier";

export const NOTE_LINK_LABEL: Record<NoteLinkKind, string> = {
  ordered: "Ordered",
  "reviewed-in": "Reviewed in",
  "led-to": "Led to",
  referred: "Referred to",
  revised: "Revised as",
  "follow-up": "Follow-up",
  "based-on": "Based on",
  earlier: "Linked · earlier",
};

export type DerivedNoteKind = "consultation" | "review" | "letter";

export const NOTE_KIND_LABEL: Record<DerivedNoteKind, string> = { consultation: "Consultations", review: "Reviews", letter: "Letters" };

export interface DerivedNote {
  id: string;
  kind: DerivedNoteKind;
  /** reviews: how the measured value moved since the previous one ("Down 5 mmHg from 152 on 6 Nov 2025.") */
  trend?: string;
  title: string;
  /** when the note was entered (signed) */
  signedAt: string;
  /** date of the consultation / letter */
  date: string;
  authorId: string;
  authorRole: string;
  body: string;
  source: string;
  released: boolean;
  state: RecordState;
  conditionId: string;
  systemId: string;
  links: { kind: NoteLinkKind; event: CareEvent }[];
}

/** A doctor's signed review at which something was measured (BP review, neurology review…). */
const isDoctorReview = (e: CareEvent) => (e.type === "vitals" || e.type === "consult") && e.state === "signed" && e.source === "Clinic measurement" && e.authorRole === "Doctor";

/** "Down 5 mmHg from 152 on 6 Nov 2025." — the reviewed value against the previous one in the record. */
function reviewTrend(record: PatientRecord, e: CareEvent): string | undefined {
  const v = e.values?.[0];
  if (!v) return undefined;
  const prev = record.events
    .filter((x) => x.date < e.date && x.systemId === e.systemId && x.values?.some((y) => y.label === v.label))
    .sort((a, b) => b.date.localeCompare(a.date))[0];
  if (!prev) return `First ${v.label} on this record.`;
  const pv = prev.values!.find((y) => y.label === v.label)!;
  const a = Number(v.value), b = Number(pv.value);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return undefined;
  const decimals = Math.max(decimalsOf(v.value), decimalsOf(pv.value));
  const diff = +(a - b).toFixed(decimals);
  const u = v.unit ? ` ${v.unit}` : "";
  return diff === 0 ? `Unchanged from ${fmtDay(prev.date)}.` : `${diff > 0 ? "Up" : "Down"} ${Math.abs(diff).toFixed(decimals)}${u} from ${pv.value} on ${fmtDay(prev.date)}.`;
}

/**
 * Signed notes in a generated record: consultation notes (consult/note events signed against a
 * "Consultation note" source), the doctor's signed reviews (a clinic measurement the doctor
 * signed — the value and its change since the previous review are the note) and referral
 * letters. Appointments alone are not notes: a booked visit carries no clinical text. The body is
 * the record's own summary; the documented links say what the note ordered or led to. A linked
 * result dated before the note is what the note was based on, not something it ordered.
 */
export const derivedNotes = memo((patientId: string): DerivedNote[] => {
  if (isFeaturedPatient(patientId)) return [];
  const record = recordOf(patientId);
  if (!record) return [];
  return record.events
    .filter(
      (e) =>
        e.date <= TODAY_DATE &&
        (((e.type === "consult" || e.type === "note") && (e.state === "signed" || e.state === "amended") && /^Consultation note/.test(e.source)) ||
          isDoctorReview(e) ||
          (e.type === "document" && /^Referral/.test(e.source))),
    )
    .map((e) => ({
      id: e.id,
      kind: e.type === "document" ? ("letter" as const) : isDoctorReview(e) ? ("review" as const) : ("consultation" as const),
      trend: isDoctorReview(e) ? reviewTrend(record, e) : undefined,
      title: e.title,
      signedAt: e.enteredAt,
      date: e.date,
      authorId: e.authorId,
      authorRole: e.authorRole,
      body: e.summary,
      source: e.source,
      released: e.released,
      state: e.state,
      conditionId: e.conditionId,
      systemId: e.systemId,
      links: (e.links ?? []).flatMap((l) => {
        const to = eventById(record, l.to);
        if (!to) return [];
        // a forward-looking link can't point back in time: say what it is instead
        const kind: NoteLinkKind = to.date < e.date ? (l.kind === "ordered" ? "based-on" : "earlier") : l.kind;
        return [{ kind, event: to }];
      }),
    }))
    .sort((a, b) => b.signedAt.localeCompare(a.signedAt));
});

/** Medication and treatment plans recorded in a generated record, newest first. */
export const treatments = memo((patientId: string) => {
  const record = recordOf(patientId);
  if (!record || isFeaturedPatient(patientId)) return [];
  return record.events
    .filter((e) => e.type === "medication" && e.state !== "scheduled")
    .map((e) => ({ id: e.id, name: e.title, detail: readableDates(e.summary), prescribed: e.date, by: e.authorId, conditionId: e.conditionId }))
    .sort((a, b) => b.prescribed.localeCompare(a.prescribed));
});

/* ------------------------------------------------------------------ changes since last visit */

export interface DerivedChange {
  id: string;
  kind: ChangeKind;
  date: string;
  title: string;
  detail: string;
  by: string;
  target: ChangeTarget;
  selfReported?: boolean;
}

/** Since when "changes" are counted: the last visit, or registration for new patients. */
export function changesSince(patient: Patient) {
  return patient.lastVisit ?? patient.registeredAt;
}

/**
 * What reached the record after the last visit (entered after it, up to now): reports, plan and
 * medication changes, self-reported logs and missed sessions. Visits themselves are not changes.
 */
export const derivedChanges = memo((patientId: string): DerivedChange[] => {
  const patient = patientById(patientId);
  const record = recordOf(patientId);
  if (!patient || !record || isFeaturedPatient(patientId)) return [];
  const since = changesSince(patient);
  const sinceT = new Date(since).getTime();
  const nowT = new Date(NOW_ISO).getTime();
  const docs = baseDocuments(patientId);
  return record.events
    .filter((e) => {
      const t = new Date(e.enteredAt).getTime();
      return t > sinceT && t <= nowT && e.state !== "scheduled" && e.type !== "consult" && e.type !== "note";
    })
    .flatMap((e): DerivedChange[] => {
      const doc = docs.find((d) => d.eventId === e.id);
      const base = { id: e.id, date: e.enteredAt.slice(0, 10), by: e.authorId, selfReported: e.state === "self-reported" };
      if (e.type === "lab" || e.type === "imaging" || e.type === "document") {
        const value = e.values?.map((v) => `${v.label} ${v.value}${v.unit ? ` ${v.unit}` : ""}${v.flag ? ` (${v.flag})` : ""}`).join(", ");
        const target: ChangeTarget = doc ? { tab: "documents", docId: doc.id } : { tab: e.type === "imaging" ? "imaging" : "labs" };
        return [{ ...base, kind: "report", title: e.title, detail: value ? `${value}. Reported ${fmtDay(e.date)}.` : readableDates(e.summary), target }];
      }
      if (e.type === "vitals") {
        const value = e.values?.map((v) => `${v.label} ${v.value}${v.unit ? ` ${v.unit}` : ""}`).join(", ");
        return [{ ...base, kind: "report", title: e.title, detail: value ? `${value}.` : readableDates(e.summary), target: { tab: "vitals" } }];
      }
      if (e.type === "medication") return [{ ...base, kind: "plan", title: e.title, detail: readableDates(e.summary), target: { href: `/patients/${patientId}/journey`, label: "Open in the care journey" } }];
      if (e.type === "nutrition" || e.type === "movement") {
        // a booked session the patient didn't attend is a missed session, not a plan change
        const missed = /absent|did not attend/i.test(`${e.title} ${e.summary}`);
        const target: ChangeTarget = e.type === "nutrition" ? { href: "/nutrition", label: "Open nutrition plans" } : { href: "/classes", label: "Open classes" };
        return [{ ...base, kind: missed ? "missed" : "plan", title: e.title, detail: readableDates(e.summary), target }];
      }
      return [];
    })
    .sort((a, b) => b.date.localeCompare(a.date));
});

/* ------------------------------------------------------------------ appointments */

/** Today's doctor visit for this patient (links a new consultation note to it). */
export function todaysMedicalVisit(patientId: string): Appointment | undefined {
  return WEEK_APPOINTMENTS.find((a) => a.patientId === patientId && a.start.startsWith(TODAY_DATE) && a.discipline === "medical" && a.status !== "cancelled" && a.status !== "no-show");
}

/** Next upcoming appointment of any discipline. */
export function nextVisit(patientId: string): Appointment | undefined {
  return WEEK_APPOINTMENTS.filter((a) => a.patientId === patientId && a.start > NOW_ISO && a.status === "booked").sort((a, b) => a.start.localeCompare(b.start))[0];
}

export type { Condition };

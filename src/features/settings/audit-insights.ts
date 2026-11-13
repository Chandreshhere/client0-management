import type { Patient, Staff } from "@/data/types";
import { PATIENTS, patientById } from "@/data/patients";
import { staffById } from "@/data/staff";
import { primaryOrgan, type OrganKind } from "@/data/anatomy";
import { formatTime } from "@/lib/format";
import { AUDIT_CATEGORY_LABEL, type AuditCategory, type AuditEvent } from "./audit";
import { TODAY_KEY, addDays, daysAgo, istDayKey, shortDate } from "./time";

/**
 * Derived views of the audit log (Settings → Audit log). Everything is computed from the seeded
 * entries in ./audit plus whatever this browser session appended with `logAudit`.
 */

export type AuditScope = NonNullable<AuditEvent["scope"]>;

export const SCOPES: AuditScope[] = ["clinical", "metadata", "financial", "account"];

export const SCOPE_LABEL: Record<AuditScope, string> = {
  clinical: "Clinical content",
  metadata: "Metadata only",
  financial: "Financial",
  account: "Account & settings",
};

export const SCOPE_HINT: Record<AuditScope, string> = {
  clinical: "Someone opened or changed clinical content in a patient record",
  metadata: "Routed, uploaded or scheduled without opening clinical content",
  financial: "Invoices, payments, refunds and package credits",
  account: "Sign-ins, staff accounts, access grants and clinic settings",
};

export const scopeOf = (e: AuditEvent): AuditScope | null => e.scope ?? null;

// ---------------------------------------------------------------------------------------------
// Actors
// ---------------------------------------------------------------------------------------------

export type ActorKind = "staff" | "system" | "partner" | "patient";

export interface Actor {
  /** filter key: staff id, or a system group ("sys:gateway", "sys:lab", "sys:portal" …) */
  key: string;
  /** the name shown on this entry (a lab partner's or patient's own name) */
  name: string;
  /** the group name shown in the "who acted" list */
  groupName: string;
  role: string;
  avatar: string | null;
  kind: ActorKind;
  staff?: Staff;
}

const patientByName = (name: string): Patient | undefined => PATIENTS.find((p) => p.name === name);

export function actorOf(e: AuditEvent): Actor {
  const s = e.actorId ? staffById(e.actorId) : undefined;
  if (s) return { key: s.id, name: s.name, groupName: s.name, role: s.title.split(" ·")[0], avatar: s.avatar ?? null, kind: "staff", staff: s };
  const label = e.actorLabel ?? "System";
  const portal = /^(.*) · patient portal$/.exec(label);
  if (portal) {
    const p = patientByName(portal[1]);
    return { key: "sys:portal", name: portal[1], groupName: "Patients · portal", role: "Patient portal upload", avatar: p?.avatar ?? null, kind: "patient" };
  }
  const lab = /^Lab partner · (.*)$/.exec(label);
  if (lab) return { key: "sys:lab", name: lab[1], groupName: "Lab partners", role: "Lab partner upload", avatar: null, kind: "partner" };
  if (/gateway|reconciliation/i.test(label)) return { key: "sys:gateway", name: "Payment gateway", groupName: "Payment gateway", role: "Automated · UPI and cards", avatar: null, kind: "system" };
  if (/terminal/i.test(label)) return { key: "sys:terminal", name: "Card terminal", groupName: "Card terminal", role: "Automated · front desk", avatar: null, kind: "system" };
  return { key: `sys:${label}`, name: label, groupName: label, role: "Automated", avatar: null, kind: "system" };
}

/** Actors ranked by number of entries (ties: staff before systems, then name). */
export function actorRanking(events: AuditEvent[]) {
  const map = new Map<string, { actor: Actor; count: number; names: Set<string> }>();
  for (const e of events) {
    const a = actorOf(e);
    const hit = map.get(a.key) ?? { actor: a, count: 0, names: new Set<string>() };
    hit.count += 1;
    hit.names.add(a.name);
    map.set(a.key, hit);
  }
  return [...map.values()]
    .map((x) => ({
      ...x,
      // groups that stand for several outside actors say how many
      role: x.actor.kind === "staff" ? x.actor.role : x.names.size > 1 ? `${x.actor.kind === "patient" ? "Patients" : x.actor.kind === "partner" ? "Partners" : "Sources"}: ${[...x.names].join(", ")}` : x.actor.role,
    }))
    .sort((a, b) => b.count - a.count || Number(b.actor.kind === "staff") - Number(a.actor.kind === "staff") || a.actor.groupName.localeCompare(b.actor.groupName));
}

// ---------------------------------------------------------------------------------------------
// Time
// ---------------------------------------------------------------------------------------------

export type Period = "today" | "7d" | "30d" | "all";

export const PERIOD_LABEL: Record<Period, string> = { today: "Today", "7d": "Last 7 days", "30d": "Last 30 days", all: "All history" };

export const inPeriod = (e: AuditEvent, p: Period) => (p === "all" ? true : p === "today" ? istDayKey(e.at) === TODAY_KEY : daysAgo(e.at) <= (p === "7d" ? 6 : 29));

/** Oldest entry's day (for "since …" copy). */
export const firstDay = (events: AuditEvent[]) => events.reduce((min, e) => (istDayKey(e.at) < min ? istDayKey(e.at) : min), TODAY_KEY);

const WEEKDAY = new Intl.DateTimeFormat("en-IN", { weekday: "short", timeZone: "UTC" });
export const dayShort = (key: string) => `${WEEKDAY.format(new Date(`${key}T12:00:00Z`))} ${Number(key.slice(8, 10))}`;
const DAY_LONG = new Intl.DateTimeFormat("en-IN", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
export const dayLong = (key: string) => DAY_LONG.format(new Date(`${key}T12:00:00Z`));

/** Entries per day for the last `n` days (oldest → newest), split clinical vs everything else. */
export function entriesPerDay(events: AuditEvent[], n = 14) {
  return Array.from({ length: n }, (_, i) => {
    const key = addDays(TODAY_KEY, i - (n - 1));
    const day = events.filter((e) => istDayKey(e.at) === key);
    const clinical = day.filter((e) => e.scope === "clinical").length;
    return { key, label: dayShort(key), clinical, other: day.length - clinical };
  });
}

/** Group entries by IST day, newest day first, preserving the incoming order within a day. */
export function byDay(events: AuditEvent[]) {
  const out: { key: string; events: AuditEvent[] }[] = [];
  for (const e of events) {
    const key = istDayKey(e.at);
    const last = out[out.length - 1];
    if (last && last.key === key) last.events.push(e);
    else {
      const existing = out.find((g) => g.key === key);
      if (existing) existing.events.push(e);
      else out.push({ key, events: [e] });
    }
  }
  return out;
}

export const dayHeading = (key: string) => {
  const d = daysAgo(key);
  return d === 0 ? `Today · ${dayLong(key)}` : d === 1 ? `Yesterday · ${dayLong(key)}` : dayLong(key);
};

// ---------------------------------------------------------------------------------------------
// Categories & clinical access
// ---------------------------------------------------------------------------------------------

export function categoryCounts(events: AuditEvent[]) {
  return (Object.keys(AUDIT_CATEGORY_LABEL) as AuditCategory[]).map((c) => ({ category: c, label: AUDIT_CATEGORY_LABEL[c], count: events.filter((e) => e.category === c).length }));
}

/**
 * Patients whose clinical content was opened or changed (scope "clinical"), most entries first.
 * The organ is the patient's primary body system from their recorded conditions.
 */
export function clinicalByPatient(events: AuditEvent[]) {
  const map = new Map<string, { patient: Patient; organ: OrganKind | null; entries: AuditEvent[] }>();
  for (const e of events) {
    if (e.scope !== "clinical" || e.target?.kind !== "patient") continue;
    const p = patientById(e.target.id);
    if (!p) continue;
    const hit = map.get(p.id) ?? { patient: p, organ: primaryOrgan(p), entries: [] };
    hit.entries.push(e);
    map.set(p.id, hit);
  }
  return [...map.values()].sort((a, b) => b.entries.length - a.entries.length || Date.parse(b.entries[0].at) - Date.parse(a.entries[0].at));
}

// ---------------------------------------------------------------------------------------------
// Targets & export
// ---------------------------------------------------------------------------------------------

/** Where a target lives in the app (null when it has no page of its own). */
export function targetHref(t: AuditEvent["target"]): string | null {
  if (!t) return null;
  if (t.kind === "patient") return patientById(t.id) ? `/patients/${t.id}` : null;
  if (t.kind === "invoice") return "/billing";
  if (t.kind === "staff") return "/team";
  if (t.kind === "service") return "/settings/services";
  if (t.kind === "template") return "/settings/templates";
  if (t.kind === "branch" || t.kind === "clinic") return "/settings";
  return null;
}

const csvCell = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);

/** CSV of the given entries — the same columns the table shows, ISO timestamps in IST. */
export function auditCsv(events: AuditEvent[]) {
  const head = ["Timestamp (IST)", "Actor", "Actor type", "Category", "Action", "Record", "Detail", "Scope", "Source"];
  const rows = events.map((e) => {
    const a = actorOf(e);
    return [
      e.at,
      e.actorLabel && a.kind !== "staff" ? e.actorLabel : a.name,
      a.kind === "staff" ? a.role : a.kind,
      AUDIT_CATEGORY_LABEL[e.category],
      e.action,
      e.target?.label ?? "",
      e.detail ?? "",
      e.scope ? SCOPE_LABEL[e.scope] : "",
      e.local ? "This browser session" : "Synthetic history",
    ];
  });
  return [head, ...rows].map((r) => r.map(csvCell).join(",")).join("\n");
}

/** "13 Nov 08:44" */
export const stamp = (iso: string) => `${shortDate(iso)} ${formatTime(iso)}`;

import { useMemo } from "react";
import type { BranchId } from "@/data/types";
import { BRANCHES } from "@/data/staff";
import { createSessionStore, localId, useSessionStore } from "./session";
import { NOW_ISO } from "./time";
import { logAudit } from "./audit";
import { CLINIC_SEED, SERVICE_SEED, TEMPLATE_SEED, type ClinicProfile, type Service, type Template } from "./data";

/**
 * Settings changes made in this browser session (profile, clinic, rooms, services, templates,
 * access-review decisions). Seeds come from ./data; nothing leaves the browser. Every change is
 * written to the admin audit log.
 */
export interface ProfilePrefs {
  displayName: string;
  title: string;
  digest: boolean;
  reviewReminders: boolean;
  messageAlerts: boolean;
}

export type ReviewDecision = { action: "confirmed" | "revoked"; at: string; by: string };

interface SettingsState {
  profiles: Record<string, ProfilePrefs>;
  clinic: ClinicProfile | null;
  clinicAt: string | null;
  /** per branch: rooms added in this session, rooms removed */
  roomsAdded: Record<string, string[]>;
  roomsRemoved: Record<string, string[]>;
  services: Record<string, Service>;
  serviceOrder: string[];
  templates: Record<string, Template>;
  reviews: Record<string, ReviewDecision>;
}

const SEED: SettingsState = { profiles: {}, clinic: null, clinicAt: null, roomsAdded: {}, roomsRemoved: {}, services: {}, serviceOrder: [], templates: {}, reviews: {} };
export const settingsStore = createSessionStore<SettingsState>("carelane.admin.settings.v1", SEED);

export const useSettingsState = () => useSessionStore(settingsStore);

// ---------- profile ----------
export function saveProfile(userId: string, prefs: ProfilePrefs) {
  settingsStore.update((s) => ({ ...s, profiles: { ...s.profiles, [userId]: prefs } }));
  logAudit({ actorId: userId, category: "settings", action: "Updated their own profile and notification preferences", scope: "account" });
}

// ---------- clinic ----------
export function useClinic(): ClinicProfile {
  const s = useSettingsState();
  return s.clinic ?? CLINIC_SEED;
}

export function saveClinic(next: ClinicProfile, actorId: string, changed: string[]) {
  settingsStore.update((s) => ({ ...s, clinic: next, clinicAt: NOW_ISO }));
  logAudit({ actorId, category: "settings", action: `Updated the clinic profile — ${changed.join(", ")}`, target: { kind: "clinic", id: "clinic", label: next.name }, scope: "account" });
}

// ---------- rooms ----------
export function useRooms() {
  const s = useSettingsState();
  return useMemo(
    () =>
      BRANCHES.map((b) => ({
        ...b,
        rooms: [...b.rooms.filter((r) => !(s.roomsRemoved[b.id] ?? []).includes(r)), ...(s.roomsAdded[b.id] ?? [])],
        added: s.roomsAdded[b.id] ?? [],
      })),
    [s.roomsAdded, s.roomsRemoved],
  );
}

export function addRoom(branch: BranchId, room: string, actorId: string) {
  settingsStore.update((s) => ({ ...s, roomsAdded: { ...s.roomsAdded, [branch]: [...(s.roomsAdded[branch] ?? []), room] } }));
  logAudit({ actorId, category: "settings", action: `Added room “${room}”`, target: { kind: "branch", id: branch, label: BRANCHES.find((b) => b.id === branch)?.name ?? branch }, scope: "account" });
}

export function removeRoom(branch: BranchId, room: string, actorId: string) {
  settingsStore.update((s) => {
    const added = s.roomsAdded[branch] ?? [];
    if (added.includes(room)) return { ...s, roomsAdded: { ...s.roomsAdded, [branch]: added.filter((r) => r !== room) } };
    return { ...s, roomsRemoved: { ...s.roomsRemoved, [branch]: [...(s.roomsRemoved[branch] ?? []), room] } };
  });
  logAudit({ actorId, category: "settings", action: `Removed room “${room}”`, target: { kind: "branch", id: branch, label: BRANCHES.find((b) => b.id === branch)?.name ?? branch }, scope: "account" });
}

export function restoreRoom(branch: BranchId, room: string, actorId: string, wasAdded: boolean) {
  settingsStore.update((s) =>
    wasAdded
      ? { ...s, roomsAdded: { ...s.roomsAdded, [branch]: [...(s.roomsAdded[branch] ?? []), room] } }
      : { ...s, roomsRemoved: { ...s.roomsRemoved, [branch]: (s.roomsRemoved[branch] ?? []).filter((r) => r !== room) } },
  );
  logAudit({ actorId, category: "settings", action: `Restored room “${room}” (undo)`, target: { kind: "branch", id: branch, label: BRANCHES.find((b) => b.id === branch)?.name ?? branch }, scope: "account" });
}

// ---------- services ----------
export function useServices(): Service[] {
  const s = useSettingsState();
  return useMemo(() => {
    const seeded = SERVICE_SEED.map((sv) => s.services[sv.id] ?? sv);
    const added = s.serviceOrder.map((id) => s.services[id]).filter((x): x is Service => !!x && !SERVICE_SEED.some((sv) => sv.id === x.id));
    return [...seeded, ...added];
  }, [s.services, s.serviceOrder]);
}

export function upsertService(next: Omit<Service, "id"> & { id?: string }, actorId: string): Service {
  const isNew = !next.id;
  const sv: Service = { ...next, id: next.id ?? localId("sv"), local: isNew ? true : next.local };
  const before = isNew ? null : (settingsStore.get().services[sv.id] ?? SERVICE_SEED.find((x) => x.id === sv.id) ?? null);
  settingsStore.update((s) => ({ ...s, services: { ...s.services, [sv.id]: sv }, serviceOrder: isNew ? [...s.serviceOrder, sv.id] : s.serviceOrder }));
  const changes = before
    ? [before.price !== sv.price ? `price ₹${before.price} → ₹${sv.price}` : null, before.durationMin !== sv.durationMin ? `duration ${before.durationMin} → ${sv.durationMin} min` : null, before.name !== sv.name ? `renamed from “${before.name}”` : null, !!before.archived !== !!sv.archived ? (sv.archived ? "archived" : "restored") : null].filter(Boolean).join(", ")
    : `${sv.durationMin} min, ₹${sv.price}`;
  logAudit({ actorId, category: "settings", action: `${isNew ? "Added" : "Edited"} service “${sv.name}”${changes ? ` — ${changes}` : ""}`, target: { kind: "service", id: sv.id, label: sv.name }, scope: "account" });
  return sv;
}

export function revertService(id: string, previous: Service | null, actorId: string) {
  settingsStore.update((s) => {
    const services = { ...s.services };
    if (previous) services[id] = previous;
    else delete services[id];
    return { ...s, services, serviceOrder: previous ? s.serviceOrder : s.serviceOrder.filter((x) => x !== id) };
  });
  logAudit({ actorId, category: "settings", action: "Reverted a service change (undo)", target: { kind: "service", id, label: previous?.name ?? id }, scope: "account" });
}

// ---------- templates ----------
export function useTemplates(): Template[] {
  const s = useSettingsState();
  return useMemo(() => TEMPLATE_SEED.map((t) => s.templates[t.id] ?? t), [s.templates]);
}

export function saveTemplate(t: Template, actorId: string, pendingReview: boolean) {
  const next: Template = { ...t, status: pendingReview ? "awaiting-review" : "published", editedBy: actorId, editedAt: NOW_ISO };
  settingsStore.update((s) => ({ ...s, templates: { ...s.templates, [t.id]: next } }));
  logAudit({ actorId, category: "settings", action: pendingReview ? `Edited template “${t.name}” — awaiting clinical review before use` : `Edited template “${t.name}”`, target: { kind: "template", id: t.id, label: t.name }, scope: "account" });
  return next;
}

export function revertTemplate(id: string, previous: Template | null, actorId: string) {
  settingsStore.update((s) => {
    const templates = { ...s.templates };
    if (previous) templates[id] = previous;
    else delete templates[id];
    return { ...s, templates };
  });
  logAudit({ actorId, category: "settings", action: "Reverted a template edit (undo)", target: { kind: "template", id, label: previous?.name ?? id }, scope: "account" });
}

// ---------- access review ----------
export function decideReview(id: string, decision: ReviewDecision["action"], actorId: string, label: string, staffName: string) {
  settingsStore.update((s) => ({ ...s, reviews: { ...s.reviews, [id]: { action: decision, at: NOW_ISO, by: actorId } } }));
  logAudit({ actorId, category: "access", action: `${decision === "confirmed" ? "Confirmed access in review" : label} — ${staffName}`, detail: "Recorded in this browser session; no real permission changed", scope: "account" });
}

export function undoReview(id: string, actorId: string, staffName: string) {
  settingsStore.update((s) => {
    const reviews = { ...s.reviews };
    delete reviews[id];
    return { ...s, reviews };
  });
  logAudit({ actorId, category: "access", action: `Reopened an access review (undo) — ${staffName}`, scope: "account" });
}

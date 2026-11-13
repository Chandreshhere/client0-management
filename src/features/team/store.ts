import type { BranchId } from "@/data/types";
import { staffById } from "@/data/staff";
import { patientById } from "@/data/patients";
import { DOCUMENTS } from "@/data/records";
import { createSessionStore, localId, useSessionStore } from "@/features/settings/session";
import { NOW_ISO } from "@/features/settings/time";
import { logAudit } from "@/features/settings/audit";
import type { CoverChoice, StaffRole } from "./data";

/**
 * Team changes made in this browser session: invites (never emailed), role changes,
 * deactivations, leave cover and review reassignment. Nothing is sent to an identity provider
 * or to staff; every change is also written to the admin audit log.
 */
export interface Invite {
  id: string;
  name: string;
  email: string;
  role: StaffRole;
  branch: BranchId;
  /** ready = a seat is free (would send once email is connected) · needs-seat = waits for a seat */
  status: "ready" | "needs-seat";
  at: string;
}

interface TeamState {
  invites: Invite[];
  deactivated: Record<string, string>;
  /** requested role changes; a clinical role waits for the clinical lead's approval */
  roles: Record<string, { role: StaffRole; pending: boolean }>;
  /** patientId → cover choice for the person on leave (absent = documented seed) */
  cover: Record<string, CoverChoice>;
  coverAt: string | null;
  /** documentId → reviewer staff id (reassigned in this session) */
  reviews: Record<string, string>;
}

const SEED: TeamState = { invites: [], deactivated: {}, roles: {}, cover: {}, coverAt: null, reviews: {} };
export const teamStore = createSessionStore<TeamState>("carelane.admin.team.v2", SEED);

export const useTeamState = () => useSessionStore(teamStore);

const staffTarget = (id: string) => ({ kind: "staff" as const, id, label: staffById(id)?.name ?? id });

export function addInvite(input: Omit<Invite, "id" | "at">, actorId: string): Invite {
  const inv: Invite = { ...input, id: localId("invite"), at: NOW_ISO };
  teamStore.update((s) => ({ ...s, invites: [inv, ...s.invites] }));
  logAudit({
    actorId,
    category: "account",
    action: `Drafted an invite for ${inv.name} (${inv.role}) — not emailed${inv.status === "needs-seat" ? "; waiting for a free seat" : ""}`,
    detail: inv.email,
    scope: "account",
  });
  return inv;
}

export function removeInvite(id: string, actorId: string) {
  const inv = teamStore.get().invites.find((i) => i.id === id);
  teamStore.update((s) => ({ ...s, invites: s.invites.filter((i) => i.id !== id) }));
  if (inv) logAudit({ actorId, category: "account", action: `Withdrew the draft invite for ${inv.name}`, detail: inv.email, scope: "account" });
}

export function restoreInvite(inv: Invite, actorId: string) {
  teamStore.update((s) => ({ ...s, invites: [inv, ...s.invites.filter((i) => i.id !== inv.id)] }));
  logAudit({ actorId, category: "account", action: `Restored the draft invite for ${inv.name} (undo)`, detail: inv.email, scope: "account" });
}

export function setDeactivated(staffId: string, on: boolean, actorId: string) {
  teamStore.update((s) => {
    const next = { ...s.deactivated };
    if (on) next[staffId] = NOW_ISO;
    else delete next[staffId];
    return { ...s, deactivated: next };
  });
  logAudit({ actorId, category: "account", action: on ? "Deactivated a staff account — sign-in blocked, records kept" : "Reactivated a staff account", target: staffTarget(staffId), scope: "account" });
}

export const CLINICAL_ROLES: StaffRole[] = ["doctor", "nutritionist", "yoga"];

/**
 * Request a role change. Moving someone INTO a clinical role grants clinical access, which an
 * administrator can't approve — it waits for the clinical lead. Other changes apply (locally).
 */
export function setRole(staffId: string, role: StaffRole | null, actorId: string, label?: string) {
  const pending = !!role && CLINICAL_ROLES.includes(role) && staffById(staffId)?.role !== role;
  teamStore.update((s) => {
    const next = { ...s.roles };
    if (role) next[staffId] = { role, pending };
    else delete next[staffId];
    return { ...s, roles: next };
  });
  logAudit({
    actorId,
    category: "access",
    action: !role ? "Withdrew a role change" : pending ? `Requested a change to ${label ?? role} — awaiting the clinical lead's approval` : `Changed workspace role to ${label ?? role}`,
    target: staffTarget(staffId),
    scope: "account",
  });
}

export function saveCover(cover: Record<string, CoverChoice>, actorId: string, summary: string) {
  teamStore.update((s) => ({ ...s, cover, coverAt: NOW_ISO }));
  logAudit({ actorId, category: "access", action: `Saved leave cover for Dr. Sana Qureshi's patients — ${summary}`, detail: "Nobody was notified", target: staffTarget("s-sana"), scope: "account" });
}

export function restoreCover(previous: { cover: Record<string, CoverChoice>; coverAt: string | null }, actorId: string) {
  teamStore.update((s) => ({ ...s, cover: previous.cover, coverAt: previous.coverAt }));
  logAudit({ actorId, category: "access", action: "Reverted the leave cover change (undo)", target: staffTarget("s-sana"), scope: "account" });
}

export function reassignReview(documentId: string, reviewerId: string | null, actorId: string) {
  teamStore.update((s) => {
    const next = { ...s.reviews };
    if (reviewerId) next[documentId] = reviewerId;
    else delete next[documentId];
    return { ...s, reviews: next };
  });
  const doc = DOCUMENTS.find((d) => d.id === documentId);
  const who = reviewerId ? staffById(reviewerId)?.name : null;
  logAudit({
    actorId,
    category: "document",
    action: reviewerId ? `Re-routed a report for review to ${who} — routing only, contents not opened` : "Returned a report to its original reviewer (undo)",
    target: doc ? { kind: "patient", id: doc.patientId ?? "", label: `${patientById(doc.patientId)?.name ?? "Unmatched"} · ${doc.title}` } : undefined,
    scope: "metadata",
  });
}

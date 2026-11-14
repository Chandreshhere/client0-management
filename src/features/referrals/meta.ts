import type { ReferralStage, Role } from "@/data/types";
import { REFERRAL_STAGES } from "@/data/care";
import { staffById } from "@/data/staff";
import { TODAY, formatTime } from "@/lib/format";
import { TODAY_KEY, byTime, dayKey, dayName, dayPhrase, hoursSince } from "@/features/tasks/time";
import type { CareReferral } from "./store";

/**
 * Where a referral is, where it stopped, and who can move it on.
 * The pending stage is the one after the last reached stage — that's "where progress stopped".
 */
export type Health = "overdue" | "stalled" | "on-track" | "closed";

export const HEALTH_LABEL: Record<Health, string> = {
  overdue: "Past due date",
  stalled: "Stalled over 2 days",
  "on-track": "Moving",
  closed: "Loop closed",
};

/** What reaching each stage means — and what the pending stage is waiting for. */
export const STAGE_WAITING: Record<ReferralStage, string> = {
  requested: "Waiting to be requested",
  accepted: "Waiting for acceptance",
  booked: "Waiting to be booked",
  completed: "Waiting for the visit to be completed",
  acknowledged: "Waiting for the referrer to acknowledge",
};

export const STAGE_ACTION: Record<ReferralStage, string> = {
  requested: "Request",
  accepted: "Accept",
  booked: "Book",
  completed: "Mark completed",
  acknowledged: "Acknowledge",
};

export interface ReferralState {
  idx: number;
  pending: ReferralStage | null;
  since: string;
  waitingDays: number;
  overdue: boolean;
  stalled: boolean;
  visitUpcoming: boolean;
  waitingOn: string | null;
  health: Health;
}

export function referralState(r: CareReferral): ReferralState {
  const idx = REFERRAL_STAGES.indexOf(r.stage);
  const pending = idx < REFERRAL_STAGES.length - 1 ? REFERRAL_STAGES[idx + 1] : null;
  const since = r.stageDates[r.stage] ?? r.requestedAt;
  const hours = hoursSince(since);
  const visitUpcoming = r.stage === "booked" && !!r.bookedFor && new Date(r.bookedFor).getTime() > TODAY.getTime();
  // An upcoming booked visit is the next step happening — not a missed deadline.
  const overdue = !!pending && !visitUpcoming && new Date(r.dueBy).getTime() < TODAY.getTime();
  const stalled = !!pending && !visitUpcoming && hours > 48;
  const waitingOn = pending === "acknowledged" ? r.fromId : pending ? r.toId : null;
  const health: Health = !pending ? "closed" : overdue ? "overdue" : stalled ? "stalled" : "on-track";
  // Calendar days (IST), the same count the dashboards show: requested 4 Nov → "9 days" on 13 Nov.
  const waitingDays = Math.round((Date.parse(TODAY_KEY) - Date.parse(dayKey(since))) / 86_400_000);
  return { idx, pending, since, waitingDays, overdue, stalled, visitUpcoming, waitingOn, health };
}

const HEALTH_RANK: Record<Health, number> = { overdue: 0, stalled: 1, "on-track": 2, closed: 3 };

export function byUrgency(a: CareReferral, b: CareReferral) {
  const sa = referralState(a);
  const sb = referralState(b);
  return HEALTH_RANK[sa.health] - HEALTH_RANK[sb.health] || byTime(sa.since, sb.since);
}

export const waitText = (days: number) => (days < 1 ? "since today" : days === 1 ? "1 day" : `${days} days`);

/** When something is due: "today 18:00", "tomorrow 18:00", "Sun, 15 Nov". */
export const dueText = (iso: string) => {
  const d = dayName(iso);
  return d === "Today" || d === "Tomorrow" ? `${d.toLowerCase()} ${formatTime(iso)}` : dayPhrase(iso);
};

/**
 * Role awareness: the receiving practitioner accepts and completes; the receiver, front desk or
 * a coordinator books; only the referrer acknowledges. Returns why not, so the UI can explain.
 */
export function permissionFor(r: CareReferral, stage: ReferralStage, userId: string, role: Role): { allowed: boolean; reason?: string } {
  const to = staffById(r.toId);
  const from = staffById(r.fromId);
  switch (stage) {
    case "accepted":
      return userId === r.toId ? { allowed: true } : { allowed: false, reason: `Only ${to?.name ?? "the receiving practitioner"} can accept — they're receiving it.` };
    case "booked":
      return userId === r.toId || role === "frontdesk" || role === "coordinator" || role === "admin"
        ? { allowed: true }
        : { allowed: false, reason: `Booked by ${to?.name ?? "the receiver"}, the front desk or a coordinator.` };
    case "completed":
      return userId === r.toId ? { allowed: true } : { allowed: false, reason: `Only ${to?.name ?? "the receiving practitioner"} can record completion.` };
    case "acknowledged":
      return userId === r.fromId ? { allowed: true } : { allowed: false, reason: `Only ${from?.name ?? "the referrer"}, who referred, can acknowledge.` };
    default:
      return { allowed: false };
  }
}

/** One-line answer to "where did it stop?" */
export function stopSummary(r: CareReferral, st: ReferralState): string {
  const to = staffById(r.toId)?.name ?? "the receiver";
  const from = staffById(r.fromId)?.name ?? "the referrer";
  switch (st.pending) {
    case null:
      return `Loop closed — acknowledged by ${from}.`;
    case "accepted":
      return `Waiting for ${to} to accept · ${waitText(st.waitingDays)}`;
    case "booked":
      return `Accepted by ${to} — not booked yet · ${waitText(st.waitingDays)}`;
    case "completed":
      return st.visitUpcoming && r.bookedFor
        ? `Booked for ${dayPhrase(r.bookedFor)} ${formatTime(r.bookedFor)}${r.room ? ` · ${r.room}` : ""}`
        : `Visit ${r.bookedFor ? `on ${dayPhrase(r.bookedFor)} ` : ""}held — completion not recorded · ${waitText(st.waitingDays)}`;
    case "acknowledged":
      return `Completed — waiting for ${from} to acknowledge · ${waitText(st.waitingDays)}`;
    default:
      return "";
  }
}

import type { Role, Staff } from "@/data/types";
import { PATIENTS } from "@/data/patients";
import { BRANCHES } from "@/data/staff";

/**
 * Demo permission model (deny by default). This mirrors the product brief: account administration
 * never includes clinical content, and administrators can't grant themselves clinical access
 * (doc §2A). Real enforcement belongs on the server on every request (doc §7).
 */
export const MATRIX_ROLES: Role[] = ["admin", "doctor", "nutritionist", "yoga", "frontdesk", "coordinator", "patient"];

/** full: open and change · scoped: limited (caption says how) · meta: routing/status only, never content · none: refused */
export type Level = "full" | "scoped" | "meta" | "none";

export interface Grant {
  level: Level;
  scope?: string;
  /** shown in the tooltip */
  why?: string;
  /** cannot be granted by an administrator to themselves */
  locked?: boolean;
}

export type PermissionGroup = "Patient record" | "Operations" | "Administration";

export interface PermissionRow {
  id: string;
  group: PermissionGroup;
  label: string;
  description: string;
  clinical: boolean;
  grants: Record<Role, Grant>;
}

const SELF_GRANT = "Account administration never includes clinical content. A clinical lead approves clinical access — administrators can't grant it to themselves.";
const none: Grant = { level: "none" };
const adminClinical: Grant = { level: "none", scope: "Can't self-grant", why: SELF_GRANT, locked: true };

export const PERMISSIONS: PermissionRow[] = [
  {
    id: "identity", group: "Patient record", label: "Identity & contact", description: "Name, date of birth, phone, address, emergency contact.", clinical: false,
    grants: {
      admin: { level: "full", scope: "All branches" },
      doctor: { level: "scoped", scope: "Care team", why: "Patients they're assigned to, plus temporary cover." },
      nutritionist: { level: "scoped", scope: "Care team" },
      yoga: { level: "scoped", scope: "Care team" },
      frontdesk: { level: "scoped", scope: "Own branch", why: "Front desk sees patients registered at their branch. Branch moves need an access review." },
      coordinator: { level: "full", scope: "All branches" },
      patient: { level: "scoped", scope: "Own record" },
    },
  },
  {
    id: "notes", group: "Patient record", label: "Consultation notes", description: "Structured notes, drafts, signed versions and addenda.", clinical: true,
    grants: {
      admin: adminClinical,
      doctor: { level: "scoped", scope: "Care team · signs own", why: "Read the care team's notes; sign only their own. Corrections become attributed addenda." },
      nutritionist: { level: "meta", scope: "Shared guidance", why: "Sees the current, attributed guidance the doctor published for nutrition — not the full note." },
      yoga: { level: "meta", scope: "Approved precautions", why: "Sees clinician-approved precautions only. Instructors never need a diagnosis to run a session." },
      frontdesk: none,
      coordinator: { level: "meta", scope: "Status only", why: "Sees whether a note is draft, signed or released — not its contents." },
      patient: { level: "scoped", scope: "Released summaries", why: "Patients see consultation summaries a clinician has explicitly released." },
    },
  },
  {
    id: "reports", group: "Patient record", label: "Reports & documents", description: "Lab reports, imaging and letters — the clinical content.", clinical: true,
    grants: {
      admin: { level: "meta", scope: "Routing only", why: "Can match patients, classify and assign reviewers without reading contents.", locked: true },
      doctor: { level: "scoped", scope: "Assigned & care team" },
      nutritionist: { level: "scoped", scope: "Care team" },
      yoga: none,
      frontdesk: { level: "meta", scope: "Routing only", why: "Receives and routes reports without permission to read them (doc §3A)." },
      coordinator: { level: "meta", scope: "Routing only" },
      patient: { level: "scoped", scope: "Own & released" },
    },
  },
  {
    id: "prescriptions", group: "Patient record", label: "Prescriptions", description: "Create, sign and release prescriptions.", clinical: true,
    grants: { admin: adminClinical, doctor: { level: "full", scope: "Create & sign" }, nutritionist: none, yoga: none, frontdesk: none, coordinator: none, patient: { level: "scoped", scope: "Released" } },
  },
  {
    id: "nutrition", group: "Patient record", label: "Nutrition plans", description: "Meal plans, versions, substitutions and adherence reviews.", clinical: true,
    grants: {
      admin: adminClinical,
      doctor: { level: "scoped", scope: "Read · care team" },
      nutritionist: { level: "full", scope: "Create & publish" },
      yoga: none,
      frontdesk: none,
      coordinator: { level: "meta", scope: "Status only" },
      patient: { level: "scoped", scope: "Published version" },
    },
  },
  {
    id: "movement", group: "Patient record", label: "Movement plans & precautions", description: "Session plans, approved precautions and clearance.", clinical: true,
    grants: {
      admin: adminClinical,
      doctor: { level: "full", scope: "Approves precautions" },
      nutritionist: { level: "scoped", scope: "Read · care team" },
      yoga: { level: "scoped", scope: "Session plans · reads precautions" },
      frontdesk: none,
      coordinator: { level: "meta", scope: "Status only" },
      patient: { level: "scoped", scope: "Approved guidance" },
    },
  },
  {
    id: "logs", group: "Patient record", label: "Self-reported logs", description: "Food, habit and measurement logs entered by patients.", clinical: true,
    grants: {
      admin: adminClinical,
      doctor: { level: "scoped", scope: "Care team" },
      nutritionist: { level: "scoped", scope: "Care team" },
      yoga: { level: "scoped", scope: "Attendance & observations" },
      frontdesk: none,
      coordinator: { level: "meta", scope: "Missing-log alerts" },
      patient: { level: "full", scope: "Own logs" },
    },
  },
  {
    id: "diary", group: "Operations", label: "Appointments & diary", description: "Book, reschedule, cancel and check in.", clinical: false,
    grants: {
      admin: { level: "full" },
      doctor: { level: "scoped", scope: "Own diary" },
      nutritionist: { level: "scoped", scope: "Own diary" },
      yoga: { level: "scoped", scope: "Own classes" },
      frontdesk: { level: "scoped", scope: "Own branch" },
      coordinator: { level: "full" },
      patient: { level: "scoped", scope: "Own bookings" },
    },
  },
  {
    id: "billing", group: "Operations", label: "Invoices & payments", description: "Invoices, receipts, balances and manual payment entry.", clinical: false,
    grants: {
      admin: { level: "full" },
      doctor: { level: "none", why: "On the Clinic plan billing sits with the front desk. A solo doctor on Starter manages it." },
      nutritionist: none,
      yoga: { level: "meta", scope: "Package balances", why: "Sees session balances where permitted (doc §2D) — not invoices." },
      frontdesk: { level: "scoped", scope: "Own branch" },
      coordinator: none,
      patient: { level: "scoped", scope: "Own invoices" },
    },
  },
  {
    id: "tasks", group: "Operations", label: "Tasks & referrals", description: "Follow-ups, handoffs and escalations.", clinical: false,
    grants: {
      admin: { level: "scoped", scope: "Operational" },
      doctor: { level: "full" },
      nutritionist: { level: "full" },
      yoga: { level: "scoped", scope: "Escalations" },
      frontdesk: { level: "scoped", scope: "Operational" },
      coordinator: { level: "full" },
      patient: none,
    },
  },
  {
    id: "users", group: "Administration", label: "Invite & deactivate users", description: "Staff accounts, roles and branch membership.", clinical: false,
    grants: { admin: { level: "full", scope: "Not own account" , why: "Administrators manage other accounts. Changes to their own role need another administrator." }, doctor: none, nutritionist: none, yoga: none, frontdesk: none, coordinator: none, patient: none },
  },
  {
    id: "grant-clinical", group: "Administration", label: "Grant clinical access", description: "Approve who can open clinical sections.", clinical: false,
    grants: {
      admin: adminClinical,
      doctor: { level: "scoped", scope: "Clinical lead · not to self", why: "The clinical lead (Dr. Ananya Rao) approves clinical access for others, never for herself." },
      nutritionist: none,
      yoga: none,
      frontdesk: none,
      coordinator: none,
      patient: none,
    },
  },
  {
    id: "access-review", group: "Administration", label: "Access review", description: "Confirm or revoke who can see which patients.", clinical: false,
    grants: { admin: { level: "full" }, doctor: { level: "scoped", scope: "Clinical sections" }, nutritionist: none, yoga: none, frontdesk: none, coordinator: none, patient: none },
  },
  {
    id: "audit", group: "Administration", label: "Audit log", description: "Attributed account, record and export actions.", clinical: false,
    grants: { admin: { level: "full", scope: "Read-only", why: "Entries can't be edited or deleted — not even by administrators." }, doctor: none, nutritionist: none, yoga: none, frontdesk: none, coordinator: none, patient: none },
  },
  {
    id: "export", group: "Administration", label: "Export data", description: "Exports of permitted fields; every export is logged.", clinical: false,
    grants: { admin: { level: "scoped", scope: "Permitted fields only" }, doctor: none, nutritionist: none, yoga: none, frontdesk: none, coordinator: none, patient: { level: "scoped", scope: "Own record request" } },
  },
];

export const PERMISSION_GROUPS: PermissionGroup[] = ["Patient record", "Operations", "Administration"];

export const LEVEL_LABEL: Record<Level, string> = {
  full: "Full access",
  scoped: "Limited",
  meta: "Status or routing only",
  none: "No access",
};

/** What a role can do, for the staff detail sheet. */
export function permissionsFor(role: Role) {
  return PERMISSIONS.map((p) => ({ row: p, grant: p.grants[role] })).filter((x) => x.grant.level !== "none");
}

export function deniedFor(role: Role) {
  return PERMISSIONS.filter((p) => p.grants[role].level === "none");
}

// ---------------------------------------------------------------------------------------------
// Access review (doc §2A: who can see which patients, incl. staff who changed roles or left)
// ---------------------------------------------------------------------------------------------

export const careTeamOf = (staffId: string) => PATIENTS.filter((p) => Object.values(p.careTeam).includes(staffId));
export const patientsAtBranch = (branch: Staff["branch"]) => PATIENTS.filter((p) => p.branch === branch);
export const branchName = (id: Staff["branch"]) => BRANCHES.find((b) => b.id === id)?.name ?? id;

export interface AccessReview {
  id: string;
  staffId: string;
  /** who they can see */
  patientScope: string;
  patientCount: number;
  sections: string[];
  lastReviewed: string;
  flag?: { title: string; detail: string; revokeLabel: string; revokeResult: string };
}

const team = (id: string) => careTeamOf(id).length;
/** Dr. Sana Qureshi's active patients (a completed programme needs no cover). */
const COVERED = careTeamOf("s-sana").filter((p) => p.status !== "completed").length;
const IND = patientsAtBranch("indiranagar").length;
const HSR = patientsAtBranch("hsr").length;

export const ACCESS_REVIEWS: AccessReview[] = [
  {
    id: "ar-ishaan", staffId: "s-ishaan", patientScope: `Front desk at Indiranagar and HSR Layout`, patientCount: IND + HSR,
    sections: ["Identity & contact", "Appointments & diary", "Invoices & payments", "Document routing"], lastReviewed: "2026-10-01",
    flag: {
      title: "Moved to HSR Layout on 12 Nov",
      detail: `Still holds front-desk access at Indiranagar (${IND} patients, the diary and billing). A branch move doesn't remove the old branch's access automatically.`,
      revokeLabel: "Revoke Indiranagar access",
      revokeResult: `Indiranagar access revoked — HSR Layout only (${HSR} patients)`,
    },
  },
  {
    id: "ar-sana", staffId: "s-sana", patientScope: `Care team for ${team("s-sana")} patients`, patientCount: team("s-sana"),
    sections: ["Consultation notes", "Reports & documents", "Prescriptions", "Movement precautions"], lastReviewed: "2026-10-01",
    flag: {
      title: "On leave until 18 Nov — sign-in still open",
      detail: "Dr. Vikram Iyer is covering her patients, so her account doesn't need to be active while she's away. A dormant clinical login is a common way in — suspend it until she's back.",
      revokeLabel: "Suspend sign-in until 18 Nov",
      revokeResult: "Sign-in suspended until 18 Nov — care-team access kept for her return",
    },
  },
  { id: "ar-neha", staffId: "s-neha", patientScope: "All branches · identity, diary and billing", patientCount: PATIENTS.length, sections: ["Identity & contact", "Appointments & diary", "Invoices & payments", "Document routing"], lastReviewed: "2026-10-01" },
  { id: "ar-ananya", staffId: "s-ananya", patientScope: `Care team for ${team("s-ananya")} patients · clinical lead`, patientCount: team("s-ananya"), sections: ["Consultation notes", "Reports & documents", "Prescriptions", "Grant clinical access"], lastReviewed: "2026-10-01" },
  {
    id: "ar-vikram", staffId: "s-vikram", patientScope: `Care team for ${team("s-vikram")} patients + temporary cover for ${COVERED} of Dr. Sana Qureshi's`, patientCount: team("s-vikram") + COVERED,
    sections: ["Consultation notes", "Reports & documents", "Prescriptions"], lastReviewed: "2026-10-01",
    flag: {
      title: "Temporary cover ends 18 Nov",
      detail: `Granted 10 Nov and approved by the clinical lead, so he can act for Dr. Sana Qureshi's ${COVERED} active patients (he updated Rekha Iyengar's SpO₂ floor this morning). Confirm it should lapse on 18 Nov.`,
      revokeLabel: "End cover now",
      revokeResult: "Cover ended early — Dr. Sana Qureshi's patients have no covering doctor until 18 Nov",
    },
  },
  { id: "ar-meera", staffId: "s-meera", patientScope: `Care team for ${team("s-meera")} patients`, patientCount: team("s-meera"), sections: ["Nutrition plans", "Reports & documents", "Self-reported logs"], lastReviewed: "2026-10-01" },
  { id: "ar-rohan", staffId: "s-rohan", patientScope: `Care team for ${team("s-rohan")} patients`, patientCount: team("s-rohan"), sections: ["Nutrition plans", "Reports & documents", "Self-reported logs"], lastReviewed: "2026-10-01" },
  { id: "ar-kavya", staffId: "s-kavya", patientScope: `Care team for ${team("s-kavya")} patients`, patientCount: team("s-kavya"), sections: ["Session plans", "Approved precautions", "Attendance"], lastReviewed: "2026-10-01" },
  { id: "ar-lakshmi", staffId: "s-lakshmi", patientScope: `Care team for ${team("s-lakshmi")} patients`, patientCount: team("s-lakshmi"), sections: ["Session plans", "Approved precautions", "Attendance"], lastReviewed: "2026-10-01" },
  { id: "ar-arjun", staffId: "s-arjun", patientScope: `Care team for ${team("s-arjun")} patients`, patientCount: team("s-arjun"), sections: ["Session plans", "Approved precautions", "Attendance"], lastReviewed: "2026-10-01" },
  { id: "ar-sneha", staffId: "s-sneha", patientScope: `Front desk at Indiranagar (${IND} patients)`, patientCount: IND, sections: ["Identity & contact", "Appointments & diary", "Invoices & payments", "Document routing"], lastReviewed: "2026-10-01" },
  { id: "ar-farhan", staffId: "s-farhan", patientScope: `Coordination for ${team("s-farhan")} programme patients`, patientCount: team("s-farhan"), sections: ["Identity & contact", "Care-plan status", "Tasks & referrals"], lastReviewed: "2026-10-01" },
];

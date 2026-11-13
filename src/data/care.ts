import type { AppNotification, Referral, ReferralStage, Task } from "./types";

/** Synthetic tasks, referrals and notifications shared by every workspace. */

const T = (day: number, hhmm = "18:00") => `2026-11-${String(day).padStart(2, "0")}T${hhmm}:00+05:30`;

export const TASKS: Task[] = [
  { id: "t1", title: "Review lipid panel (LDL 118 mg/dL)", patientId: "p-kabir", ownerId: "s-ananya", createdBy: "s-sneha", due: T(13, "11:00"), priority: "high", status: "todo", source: "Lab partner upload · 12 Nov", discipline: "medical" },
  { id: "t2", title: "Sign consultation note from 4 Nov", patientId: "p-vivek", ownerId: "s-ananya", createdBy: "s-ananya", due: T(13), priority: "normal", status: "in-progress", source: "Unsigned draft", discipline: "medical" },
  { id: "t3", title: "Clinical review: dizziness during class", patientId: "p-arun", ownerId: "s-ananya", createdBy: "s-kavya", due: T(13, "15:00"), priority: "urgent", status: "todo", source: "Escalated by Kavya Nair", discipline: "medical" },
  { id: "t4", title: "Call after no-show — not rebooked", patientId: "p-rajesh", ownerId: "s-farhan", createdBy: "s-meera", due: T(13, "13:00"), priority: "high", status: "todo", source: "Missed follow-up", discipline: "operations" },
  { id: "t5", title: "Accept referral: post-MI nutrition plan", patientId: "p-arun", ownerId: "s-meera", createdBy: "s-ananya", due: T(14), priority: "high", status: "todo", source: "Referral from Dr. Ananya Rao", discipline: "nutrition" },
  { id: "t6", title: "Confirm updated breathwork precautions", patientId: "p-rekha", ownerId: "s-lakshmi", createdBy: "s-vikram", due: T(13, "16:30"), priority: "urgent", status: "blocked", source: "Guidance changed · awaiting doctor", discipline: "movement" },
  { id: "t7", title: "Collect intake form before 14:00 consult", patientId: "p-priya", ownerId: "s-sneha", createdBy: "s-sneha", due: T(13, "13:45"), priority: "normal", status: "todo", source: "Intake incomplete", discipline: "operations" },
  { id: "t8", title: "Guardian / age consent check", patientId: "p-tanvi", ownerId: "s-sneha", createdBy: "s-meera", due: T(13, "16:00"), priority: "high", status: "todo", source: "Intake incomplete", discipline: "operations" },
  { id: "t9", title: "Review possible duplicate (shared phone number)", patientId: "p-kunal", ownerId: "s-neha", createdBy: "s-sneha", due: T(13), priority: "normal", status: "todo", source: "Duplicate detection", discipline: "operations" },
  { id: "t10", title: "Reassign Dr. Sana Qureshi's patients during leave", ownerId: "s-neha", createdBy: "s-neha", due: T(14), priority: "high", status: "in-progress", source: "Staff leave · until 18 Nov", discipline: "operations" },
  { id: "t11", title: "Publish meal plan v3 after review", patientId: "p-aditi", ownerId: "s-meera", createdBy: "s-meera", due: T(14), priority: "normal", status: "in-progress", source: "Plan builder", discipline: "nutrition" },
  { id: "t12", title: "Review 6 food-log photos (self-reported)", patientId: "p-sameer", ownerId: "s-rohan", createdBy: "s-rohan", due: T(15), priority: "low", status: "todo", source: "Patient food log", discipline: "nutrition" },
  { id: "t13", title: "Prepare Heart Health cohort case discussion", ownerId: "s-farhan", createdBy: "s-ananya", due: T(17), priority: "normal", status: "todo", source: "Care-team message", discipline: "operations" },
  { id: "t14", title: "Send programme completion summary", patientId: "p-deepak", ownerId: "s-farhan", createdBy: "s-arjun", due: T(12), priority: "normal", status: "todo", source: "Programme ended 9 Oct", discipline: "operations" },
  { id: "t15", title: "Reconcile failed UPI payment INV-2611-0412", patientId: "p-harish", ownerId: "s-sneha", createdBy: "s-sneha", due: T(13), priority: "high", status: "todo", source: "Payment gateway callback failed", discipline: "operations" },
  { id: "t16", title: "Access review: Ishaan Gupta moved to HSR", ownerId: "s-neha", createdBy: "s-neha", due: T(20), priority: "low", status: "todo", source: "Role change", discipline: "operations" },
  { id: "t17", title: "Book 2-week follow-up before checkout", patientId: "p-lakshmi-n", ownerId: "s-sneha", createdBy: "s-meera", due: T(13, "10:45"), priority: "normal", status: "todo", source: "Consultation outcome", discipline: "operations" },
  { id: "t18", title: "Home-practice sheet released", patientId: "p-kabir", ownerId: "s-kavya", createdBy: "s-kavya", due: T(11), priority: "low", status: "done", source: "Session plan", discipline: "movement" },
];

export const REFERRAL_STAGES: ReferralStage[] = ["requested", "accepted", "booked", "completed", "acknowledged"];
export const REFERRAL_STAGE_LABEL: Record<ReferralStage, string> = {
  requested: "Requested",
  accepted: "Accepted",
  booked: "Booked",
  completed: "Completed",
  acknowledged: "Acknowledged",
};

export const REFERRALS: Referral[] = [
  { id: "r1", patientId: "p-kabir", fromId: "s-ananya", toId: "s-meera", toDiscipline: "nutrition", reason: "Heart-healthy vegetarian plan; LDL 142 mg/dL at baseline", stage: "acknowledged", requestedAt: "2026-09-08T10:00:00+05:30", stageDates: { requested: "2026-09-08T10:00:00+05:30", accepted: "2026-09-08T15:20:00+05:30", booked: "2026-09-09T09:00:00+05:30", completed: "2026-09-12T12:00:00+05:30", acknowledged: "2026-09-13T09:30:00+05:30" }, dueBy: "2026-09-15T18:00:00+05:30", priority: "normal" },
  { id: "r2", patientId: "p-kabir", fromId: "s-ananya", toId: "s-kavya", toDiscipline: "movement", reason: "Cardiac rehab yoga; keep HR under 110 bpm; no inversions", stage: "completed", requestedAt: "2026-09-08T10:05:00+05:30", stageDates: { requested: "2026-09-08T10:05:00+05:30", accepted: "2026-09-08T11:00:00+05:30", booked: "2026-09-08T11:10:00+05:30", completed: "2026-09-15T08:30:00+05:30" }, dueBy: "2026-09-20T18:00:00+05:30", priority: "normal" },
  { id: "r3", patientId: "p-arun", fromId: "s-ananya", toId: "s-meera", toDiscipline: "nutrition", reason: "Post-MI diet; weight 84 kg; triglycerides 260 mg/dL", stage: "requested", requestedAt: "2026-11-11T12:30:00+05:30", stageDates: { requested: "2026-11-11T12:30:00+05:30" }, dueBy: "2026-11-13T18:00:00+05:30", priority: "high" },
  { id: "r4", patientId: "p-rajesh", fromId: "s-vikram", toId: "s-rohan", toDiscipline: "nutrition", reason: "Diabetes nutrition reset; HbA1c 8.4%", stage: "accepted", requestedAt: "2026-10-30T11:00:00+05:30", stageDates: { requested: "2026-10-30T11:00:00+05:30", accepted: "2026-11-03T10:00:00+05:30" }, dueBy: "2026-11-10T18:00:00+05:30", priority: "high" },
  { id: "r5", patientId: "p-aditi", fromId: "s-vikram", toId: "s-lakshmi", toDiscipline: "movement", reason: "PCOS strength & flow, 2× weekly", stage: "booked", requestedAt: "2026-11-02T16:00:00+05:30", stageDates: { requested: "2026-11-02T16:00:00+05:30", accepted: "2026-11-03T09:00:00+05:30", booked: "2026-11-03T09:15:00+05:30" }, dueBy: "2026-11-16T18:00:00+05:30", priority: "normal" },
  { id: "r6", patientId: "p-rekha", fromId: "s-sana", toId: "s-lakshmi", toDiscipline: "movement", reason: "Breathwork for COPD; SpO₂ floor 90% during practice", stage: "completed", requestedAt: "2026-10-20T10:00:00+05:30", stageDates: { requested: "2026-10-20T10:00:00+05:30", accepted: "2026-10-20T14:00:00+05:30", booked: "2026-10-21T09:00:00+05:30", completed: "2026-11-10T17:45:00+05:30" }, dueBy: "2026-11-12T18:00:00+05:30", priority: "normal" },
  { id: "r7", patientId: "p-fatima", fromId: "s-sana", toId: "s-arjun", toDiscipline: "movement", reason: "Back care programme; avoid loaded flexion", stage: "booked", requestedAt: "2026-10-06T10:00:00+05:30", stageDates: { requested: "2026-10-06T10:00:00+05:30", accepted: "2026-10-06T18:00:00+05:30", booked: "2026-10-07T10:00:00+05:30" }, dueBy: "2026-10-14T18:00:00+05:30", priority: "normal" },
  { id: "r8", patientId: "p-harish", fromId: "s-ananya", toId: "s-meera", toDiscipline: "nutrition", reason: "Consistent vitamin K intake while on warfarin", stage: "requested", requestedAt: "2026-11-04T12:00:00+05:30", stageDates: { requested: "2026-11-04T12:00:00+05:30" }, dueBy: "2026-11-08T18:00:00+05:30", priority: "high" },
  { id: "r9", patientId: "p-gaurav", fromId: "s-vikram", toId: "s-kavya", toDiscipline: "movement", reason: "Low-impact yoga; OSA — avoid supine breath-holds", stage: "accepted", requestedAt: "2026-11-10T08:00:00+05:30", stageDates: { requested: "2026-11-10T08:00:00+05:30", accepted: "2026-11-11T07:00:00+05:30" }, dueBy: "2026-11-17T18:00:00+05:30", priority: "normal" },
  { id: "r10", patientId: "p-tanvi", fromId: "s-vikram", toId: "s-meera", toDiscipline: "nutrition", reason: "Iron-rich vegetarian diet; ferritin 9 ng/mL", stage: "booked", requestedAt: "2026-11-12T10:00:00+05:30", stageDates: { requested: "2026-11-12T10:00:00+05:30", accepted: "2026-11-12T11:00:00+05:30", booked: "2026-11-12T11:05:00+05:30" }, dueBy: "2026-11-14T18:00:00+05:30", priority: "normal" },
];

export const NOTIFICATIONS: AppNotification[] = [
  { id: "n1", kind: "report-review", title: "Lipid panel waiting for your review", body: "Kabir Malhotra · reported 11 Nov, uploaded 12 Nov by lab partner", at: "2026-11-12T18:20:00+05:30", read: false, actionLabel: "Review report", href: "/documents", patientId: "p-kabir", roles: ["doctor", "admin"] },
  { id: "n2", kind: "referral-pending", title: "Referral not accepted for 2 days", body: "Arun Kumar → Nutrition (Meera Krishnan)", at: "2026-11-13T09:00:00+05:30", read: false, actionLabel: "Open referral", href: "/referrals", patientId: "p-arun", roles: ["doctor", "nutritionist", "coordinator", "admin"] },
  { id: "n3", kind: "guidance-changed", title: "Session guidance changed", body: "Rekha Iyengar · SpO₂ floor raised to 92% — review before 17:00 session", at: "2026-11-13T08:45:00+05:30", read: false, actionLabel: "Review precautions", href: "/classes", patientId: "p-rekha", roles: ["yoga", "coordinator", "doctor"] },
  { id: "n4", kind: "missed-follow-up", title: "Missed follow-up, not rebooked", body: "Rajesh Pillai · no-show at 09:00 nutrition review", at: "2026-11-13T09:20:00+05:30", read: false, actionLabel: "Log contact attempt", href: "/tasks", patientId: "p-rajesh", roles: ["coordinator", "frontdesk", "nutritionist"] },
  { id: "n5", kind: "payment-failed", title: "Payment confirmation failed", body: "INV-2611-0412 · UPI callback not received — not marked paid", at: "2026-11-13T08:05:00+05:30", read: false, actionLabel: "Reconcile", href: "/billing", patientId: "p-harish", roles: ["frontdesk", "admin"] },
  { id: "n6", kind: "intake-missing", title: "2 intake forms incomplete for today", body: "Priya Venkatesh (14:00), Tanvi Rao (16:30)", at: "2026-11-13T08:30:00+05:30", read: true, actionLabel: "Open queue", href: "/schedule/queue", roles: ["frontdesk", "admin"] },
  { id: "n7", kind: "message", title: "New message from Kabir Malhotra", body: "“Can I swap the Saturday class for Sunday this week?”", at: "2026-11-13T07:55:00+05:30", read: true, actionLabel: "Reply", href: "/messages", patientId: "p-kabir", roles: ["yoga", "coordinator", "frontdesk"] },
  { id: "n8", kind: "report-review", title: "Unidentified report in intake queue", body: "Scanned PDF, 3 pages — patient not matched", at: "2026-11-13T09:05:00+05:30", read: false, actionLabel: "Identify patient", href: "/documents", roles: ["frontdesk", "admin"] },
  { id: "n9", kind: "message", title: "Your plan was updated", body: "Meera Krishnan published nutrition plan v4", at: "2026-11-12T17:10:00+05:30", read: false, actionLabel: "View plan", href: "/portal/plan", roles: ["patient"] },
  { id: "n10", kind: "missed-follow-up", title: "Reminder: Heart Health review today", body: "11:00 with Dr. Ananya Rao · Consult 1", at: "2026-11-13T07:00:00+05:30", read: true, actionLabel: "View appointment", href: "/portal/appointments", roles: ["patient"] },
];

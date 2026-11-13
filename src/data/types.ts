/**
 * Domain types for the Carelane UI prototype.
 * All records are synthetic fixtures — see src/data/README note in each module.
 */

export type Role = "admin" | "doctor" | "nutritionist" | "yoga" | "frontdesk" | "coordinator" | "patient";

export type Discipline = "medical" | "nutrition" | "movement" | "operations";

export interface Staff {
  id: string;
  name: string;
  role: Exclude<Role, "patient">;
  sex: "Female" | "Male";
  title: string;
  discipline: Discipline;
  avatar: string;
  email: string;
  branch: BranchId;
  room?: string;
  status: "available" | "in-session" | "on-break" | "on-leave" | "off";
  workingHours: string;
}

export type BranchId = "indiranagar" | "hsr";

export interface Branch {
  id: BranchId;
  name: string;
  city: string;
  rooms: string[];
}

export type PatientStatus = "active" | "onboarding" | "needs-attention" | "completed";

export interface Patient {
  id: string;
  name: string;
  age: number;
  sex: "Female" | "Male";
  avatar: string;
  phone: string;
  area: string;
  primaryConcern: string;
  conditions: string[];
  allergies: string[] | null; // null = not recorded (never shown as "no known allergies")
  program: string | null;
  status: PatientStatus;
  careTeam: { doctor?: string; nutritionist?: string; yoga?: string; coordinator?: string };
  lastVisit: string | null;
  nextAppointment: string | null;
  intakeComplete: boolean;
  abhaLinked: boolean;
  balanceDue: number;
  registeredAt: string;
  branch: BranchId;
  tags: string[];
}

export type AppointmentStatus =
  | "booked"
  | "arrived"
  | "waiting"
  | "in-session"
  | "checkout"
  | "completed"
  | "cancelled"
  | "no-show";

export interface Appointment {
  id: string;
  patientId: string;
  staffId: string;
  service: string;
  discipline: Discipline;
  start: string; // ISO
  durationMin: number;
  room: string;
  status: AppointmentStatus;
  kind: "consultation" | "follow-up" | "review" | "session" | "class" | "walk-in";
  token?: string;
  notes?: string;
  formsComplete?: boolean;
  /** check-in time (arrived / waiting / in-session / checkout / completed today) */
  arrivedAt?: string;
}

export type TaskStatus = "todo" | "in-progress" | "blocked" | "done";
export type Priority = "low" | "normal" | "high" | "urgent";

export interface Task {
  id: string;
  title: string;
  patientId?: string;
  ownerId: string;
  createdBy: string;
  due: string;
  priority: Priority;
  status: TaskStatus;
  source: string;
  discipline: Discipline;
}

export type ReferralStage = "requested" | "accepted" | "booked" | "completed" | "acknowledged";

export interface Referral {
  id: string;
  patientId: string;
  fromId: string;
  toId: string;
  toDiscipline: Discipline;
  reason: string;
  stage: ReferralStage;
  requestedAt: string;
  stageDates: Partial<Record<ReferralStage, string>>;
  dueBy: string;
  priority: Priority;
}

export type NotificationKind =
  | "report-review"
  | "referral-pending"
  | "guidance-changed"
  | "missed-follow-up"
  | "payment-failed"
  | "message"
  | "intake-missing";

export interface AppNotification {
  id: string;
  kind: NotificationKind;
  title: string;
  body: string;
  at: string;
  read: boolean;
  actionLabel: string;
  href: string;
  patientId?: string;
  roles: Role[];
}

export type AttendanceState = "present" | "absent" | "late" | "cancelled" | "rescheduled" | "pending";

export interface YogaClass {
  id: string;
  title: string;
  kind: "group" | "individual";
  instructorId: string;
  room: string;
  start: string;
  durationMin: number;
  capacity: number;
  focus: string;
  enrolled: { patientId: string; attendance: AttendanceState; precaution?: string; clearance: "current" | "expired" | "changed" }[];
  waitlist: string[];
}

export type PlanStatus = "draft" | "in-review" | "published" | "superseded";

export interface NutritionPlanSummary {
  id: string;
  patientId: string;
  title: string;
  version: number;
  status: PlanStatus;
  authorId: string;
  updatedAt: string;
  preference: string;
  calories: number;
  adherenceNote: string;
  nextReview: string;
}

export type DocStatus = "unclassified" | "awaiting-review" | "reviewed" | "filed";

export interface ClinicalDocument {
  id: string;
  title: string;
  patientId: string | null; // null = patient not yet identified (intake queue)
  type: "Lab report" | "Imaging" | "Discharge summary" | "Prescription" | "Referral letter" | "Consent form";
  reportDate: string; // when the test/event happened
  uploadedAt: string; // when it entered Carelane
  uploadedBy: string;
  source: "Patient upload" | "Front desk scan" | "Lab partner" | "Email import";
  reviewerId: string | null;
  dueBy: string | null;
  status: DocStatus;
  sensitivity: "standard" | "restricted";
  pages: number;
}

export interface MessageThread {
  id: string;
  subject: string;
  patientId: string | null;
  participants: string[]; // staff ids and/or patient id
  lastMessage: string;
  lastAt: string;
  unread: number;
  channel: "patient" | "care-team";
  expectedResponse: string;
}

export type InvoiceStatus = "paid" | "partially-paid" | "due" | "overdue" | "refunded" | "failed";

export interface Invoice {
  id: string;
  number: string;
  patientId: string;
  issuedAt: string;
  items: { label: string; amount: number }[];
  total: number;
  paid: number;
  status: InvoiceStatus;
  method: "UPI" | "Card" | "Cash" | "Package credit" | "Bank transfer" | null;
  /** payment attempts; only `confirmed` ones count as collected */
  payments?: { at: string; amount: number; method: NonNullable<Invoice["method"]>; confirmed: boolean }[];
}

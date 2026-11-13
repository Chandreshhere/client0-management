import type { Discipline, Invoice, InvoiceStatus } from "@/data/types";
import { INVOICES, INVOICE_STATUS_LABEL } from "@/data/records";
import { PACKAGES } from "@/data/programs";
import { PATIENTS } from "@/data/patients";
import type { Tone } from "@/components/ui/status";

/**
 * Billing fixtures that the shared data layer doesn't carry: per-invoice payment history and the
 * programme catalogue behind the session-credit packages. Everything here is synthetic and
 * derived to agree with `INVOICES` and `PACKAGES` (amounts, methods and dates match).
 */

export type PayMethod = NonNullable<Invoice["method"]>;

/** Methods a person can record by hand (package credit is applied from the package itself). */
export const RECORDABLE_METHODS: Exclude<PayMethod, "Package credit">[] = ["UPI", "Card", "Cash", "Bank transfer"];
export const ALL_METHODS: PayMethod[] = ["UPI", "Card", "Cash", "Bank transfer", "Package credit"];

/**
 * How a money movement is known to have happened. Only `gateway` and `bank` are external
 * confirmations; `desk` is cash counted by staff; `manual` is anything recorded in this demo
 * session (no gateway is connected); `pending` is an attempt with no confirmation.
 */
export type Confirmation = "gateway" | "bank" | "desk" | "package" | "manual" | "pending";

export interface PaymentEvent {
  id: string;
  invoiceId: string;
  at: string;
  /** rupees; negative for refunds; the unconfirmed attempt carries the amount that was requested */
  amount: number;
  method: PayMethod;
  kind: "payment" | "refund" | "credit" | "attempt" | "check";
  confirmation: Confirmation;
  byId: string | null;
  byLabel?: string;
  reference?: string;
  note?: string;
  local?: boolean;
}

/**
 * Enrichment for the shared payment attempts (`INVOICES[].payments`): who/what recorded each one
 * and its reference. Amounts, methods, times and confirmation come from the shared data.
 */
const META: Record<string, Pick<PaymentEvent, "byId"> & Partial<Pick<PaymentEvent, "byLabel" | "reference" | "note">>> = {
  "INV-2611-0412": { byId: null, byLabel: "Payment gateway", reference: "UPI collect 6271 0412 8830", note: "Collect request sent to the patient's UPI app. The gateway's confirmation callback never arrived." },
  "INV-2611-0405": { byId: null, byLabel: "Card terminal", reference: "AUTH 820193 · ••4417" },
  "INV-2611-0398": { byId: "s-sneha", note: "Part payment at the desk." },
  "INV-2611-0391": { byId: null, byLabel: "Payment gateway", reference: "UTR 330412 775901" },
  "INV-2611-0366": { byId: null, byLabel: "Payment gateway", reference: "UTR 331410 220846" },
  "INV-2611-0359": { byId: null, byLabel: "Card terminal", reference: "AUTH 771045 · ••0932" },
  "INV-2611-0351": { byId: null, byLabel: "Payment gateway", reference: "UTR 331712 908113" },
  "INV-2611-0344": { byId: "s-sneha" },
  "INV-2611-0337": { byId: null, byLabel: "Payment gateway", reference: "UTR 331006 451290" },
  "INV-2611-0372": { byId: "s-neha", reference: "NEFT PRNA0910RF16", note: "Refund for 2 unused Back Care sessions." },
};

function confirmationOf(p: { amount: number; method: PayMethod; confirmed: boolean }): Confirmation {
  if (!p.confirmed) return "pending";
  if (p.method === "Cash") return "desk";
  if (p.method === "Bank transfer") return "bank";
  if (p.method === "Package credit") return "package";
  return "gateway";
}

const SHARED_PAYMENTS: PaymentEvent[] = INVOICES.flatMap((inv) =>
  (inv.payments ?? []).map((p, i): PaymentEvent => ({
    id: `pe-${inv.id}-${i}`,
    invoiceId: inv.id,
    at: p.at,
    amount: p.amount,
    method: p.method,
    kind: !p.confirmed ? "attempt" : p.amount < 0 ? "refund" : "payment",
    confirmation: confirmationOf(p),
    byId: META[inv.number]?.byId ?? null,
    byLabel: META[inv.number]?.byLabel,
    reference: META[inv.number]?.reference,
    note: META[inv.number]?.note,
  })),
);

/** History = shared payment attempts + two non-monetary entries this page adds. */
export const SEED_PAYMENTS: PaymentEvent[] = [
  ...SHARED_PAYMENTS,
  // The 08:05 reconciliation check from the activity history (no money moved).
  { id: "pe-i2-check", invoiceId: "i2", at: "2026-11-13T08:05:00+05:30", amount: 3200, method: "UPI", kind: "check", confirmation: "pending", byId: null, byLabel: "Reconciliation check", reference: "UPI collect 6271 0412 8830", note: "Still no confirmation from the gateway — invoice left unpaid." },
  // Kabir's programme-covered review (₹0, a package credit rather than a payment).
  { id: "pe-i3-credit", invoiceId: "i3", at: "2026-11-06T11:12:00+05:30", amount: 0, method: "Package credit", kind: "credit", confirmation: "package", byId: "s-sneha", note: "Covered by the Heart Health programme — no charge." },
];

/** Short badge text; the full sentence for manual entries lives in the event's note. */
export const CONFIRMATION_LABEL: Record<Confirmation, string> = {
  gateway: "Confirmed by gateway",
  bank: "Confirmed by bank",
  desk: "Counted at the desk",
  package: "Package credit",
  manual: "Recorded manually",
  pending: "Not confirmed",
};

export const CONFIRMATION_TONE: Record<Confirmation, Tone> = {
  gateway: "success",
  bank: "success",
  desk: "success",
  package: "neutral",
  manual: "info",
  pending: "danger",
};

/** Display status: the shared invoice states plus "recorded" (settled by a manual entry this session). */
export type DisplayStatus = InvoiceStatus | "recorded";

export const STATUS_LABEL: Record<DisplayStatus, string> = { ...INVOICE_STATUS_LABEL, recorded: "Recorded manually" };

export const STATUS_TONE: Record<DisplayStatus, Tone> = {
  paid: "success",
  "partially-paid": "info",
  due: "warning",
  overdue: "danger",
  refunded: "neutral",
  failed: "danger",
  recorded: "info",
};

export const OPEN_STATUSES: DisplayStatus[] = ["due", "overdue", "partially-paid", "failed"];

// ---------------------------------------------------------------------------------------------
// Programmes & packages
// ---------------------------------------------------------------------------------------------

export interface Programme {
  id: string;
  name: string;
  /** must match the start of `Patient.program` and `PACKAGES[].name` */
  match: string;
  weeks: number | null;
  price: number;
  billing: "upfront" | "monthly" | "per-block";
  includes: { discipline: Exclude<Discipline, "operations">; label: string; count: number }[];
  /** session credits a package grants (the yoga/movement sessions) */
  credits: number;
  validityDays: number;
  reviewPoints: string[];
}

/** Programme catalogue (synthetic). Prices agree with the invoices that reference them. */
export const PROGRAMMES: Programme[] = [
  {
    id: "heart-health", name: "Heart Health · 12 weeks", match: "Heart Health", weeks: 12, price: 42000, billing: "upfront",
    includes: [{ discipline: "medical", label: "Cardiology reviews", count: 6 }, { discipline: "nutrition", label: "Nutrition follow-ups", count: 4 }, { discipline: "movement", label: "Cardiac rehab yoga", count: 24 }],
    credits: 24, validityDays: 112, reviewPoints: ["Week 4 · cardiology review", "Week 8 · combined review", "Week 12 · discharge summary"],
  },
  {
    id: "pcos-care", name: "PCOS Care · 16 weeks", match: "PCOS Care", weeks: 16, price: 38000, billing: "upfront",
    includes: [{ discipline: "medical", label: "Endocrine reviews", count: 4 }, { discipline: "nutrition", label: "Nutrition follow-ups", count: 6 }, { discipline: "movement", label: "Yoga sessions", count: 32 }],
    credits: 32, validityDays: 140, reviewPoints: ["Week 6 · cycle & labs review", "Week 16 · programme review"],
  },
  {
    id: "back-care", name: "Back Care · 8 weeks", match: "Back Care", weeks: 8, price: 14400, billing: "upfront",
    includes: [{ discipline: "medical", label: "GP assessment", count: 1 }, { discipline: "movement", label: "Back-care yoga", count: 16 }],
    credits: 16, validityDays: 70, reviewPoints: ["Week 4 · mobility check", "Week 8 · discharge"],
  },
  {
    id: "breath-balance", name: "Breath & Balance · 12 sessions", match: "Breath & Balance", weeks: null, price: 9600, billing: "per-block",
    includes: [{ discipline: "movement", label: "Breathwork sessions", count: 12 }],
    credits: 12, validityDays: 60, reviewPoints: ["Session 6 · instructor check-in"],
  },
  {
    id: "diabetes-reset", name: "Diabetes Reset · 12 weeks", match: "Diabetes Reset", weeks: 12, price: 28000, billing: "upfront",
    includes: [{ discipline: "medical", label: "Diabetes reviews", count: 4 }, { discipline: "nutrition", label: "Nutrition follow-ups", count: 6 }, { discipline: "movement", label: "Yoga sessions", count: 12 }],
    credits: 12, validityDays: 98, reviewPoints: ["Week 6 · HbA1c recheck", "Week 12 · programme review"],
  },
  {
    id: "weight-mgmt", name: "Weight Management · 24 weeks", match: "Weight Management", weeks: 24, price: 39000, billing: "monthly",
    includes: [{ discipline: "medical", label: "Medical reviews", count: 4 }, { discipline: "nutrition", label: "Nutrition follow-ups", count: 12 }, { discipline: "movement", label: "Yoga sessions", count: 24 }],
    credits: 24, validityDays: 182, reviewPoints: ["Month 3 · body-composition review", "Month 6 · programme review"],
  },
];

export const programmeById = (id: string) => PROGRAMMES.find((p) => p.id === id);
export const programmeForName = (name: string) => PROGRAMMES.find((p) => name.startsWith(p.match));

/** Patients enrolled in a programme, read from the shared registry (`Patient.program`). */
export const enrolledIn = (p: Programme) => PATIENTS.filter((pt) => pt.program?.startsWith(p.match));

export const billingLabel = (p: Programme) =>
  p.billing === "monthly" ? `${p.weeks ? Math.round(p.weeks / 4) : ""} monthly instalments` : p.billing === "per-block" ? "Paid per block" : "Paid upfront";

/** Seeded patient packages from the shared data, keyed for local edits. */
export interface PackageRow {
  key: string;
  patientId: string;
  name: string;
  used: number;
  total: number;
  expires: string; // YYYY-MM-DD
  local?: boolean;
  soldAt?: string;
}

export const SEED_PACKAGES: PackageRow[] = PACKAGES.map((p, i) => ({ key: `pk-${i}-${p.patientId}`, ...p }));

/** Invoices as shared, re-exported for the store. */
export const BASE_INVOICES: Invoice[] = INVOICES;

import type { Discipline, Invoice, InvoiceStatus } from "@/data/types";
import { INVOICES } from "@/data/records";
import { PACKAGES } from "@/data/programs";
import type { Tone } from "@/components/ui/status";

/**
 * Billing fixtures that the shared data layer doesn't carry: who recorded each payment, which
 * practitioner an invoice is collected for, and the package catalogue behind the session credits.
 * Everything here is synthetic and agrees with `INVOICES` and `PACKAGES` (amounts, methods, dates).
 */

export type PayMethod = NonNullable<Invoice["method"]>;

/**
 * Methods reception records by hand (spec: cash, UPI, card). Package credit is applied from the
 * package itself; bank transfer only appears on refunds. Online payments and confirmed UPI are the
 * payment-gateway add-on — nothing here is confirmed by a gateway.
 */
export const RECORDABLE_METHODS: ("Cash" | "UPI" | "Card")[] = ["Cash", "UPI", "Card"];
export const ALL_METHODS: PayMethod[] = ["Cash", "UPI", "Card", "Bank transfer", "Package credit"];

/** How a money movement entered Carelane: recorded by a person at the desk, or a package credit. */
export type Confirmation = "recorded" | "package";

export interface PaymentEvent {
  id: string;
  invoiceId: string;
  at: string;
  /** rupees; negative for refunds */
  amount: number;
  method: PayMethod;
  kind: "payment" | "refund" | "credit";
  confirmation: Confirmation;
  byId: string | null;
  reference?: string;
  note?: string;
  local?: boolean;
}

/**
 * Who recorded each shared payment and the reference they typed in (terminal slip, UPI app).
 * Amounts, methods and times come from the shared data. The one unconfirmed UPI attempt in the
 * shared data (INV-2611-0412) is not a payment: without the payment-gateway add-on nothing confirms
 * it, so the invoice is simply due until reception records a payment.
 */
const META: Record<string, Pick<PaymentEvent, "byId"> & Partial<Pick<PaymentEvent, "reference" | "note">>> = {
  "INV-2611-0405": { byId: "s-sneha", reference: "AUTH 820193 · ••4417" },
  "INV-2611-0398": { byId: "s-sneha", note: "Part payment at the desk." },
  "INV-2611-0391": { byId: "s-sneha", reference: "UTR 330412 775901" },
  "INV-2611-0366": { byId: "s-sneha", reference: "UTR 331410 220846" },
  "INV-2611-0359": { byId: "s-sneha", reference: "AUTH 771045 · ••0932" },
  "INV-2611-0351": { byId: "s-ishaan", reference: "UTR 331712 908113" },
  "INV-2611-0344": { byId: "s-sneha" },
  "INV-2611-0337": { byId: "s-sneha", reference: "UTR 331006 451290" },
  "INV-2611-0372": { byId: "s-neha", reference: "NEFT PRNA0910RF16", note: "Refund for 2 unused Back Care sessions." },
};

/** Practitioner each invoice is collected for (the patient's clinician for the billed service). */
export const INVOICE_PRACTITIONER: Record<string, string> = {
  i1: "s-ananya",
  i2: "s-ananya",
  i3: "s-ananya",
  i4: "s-vikram",
  i5: "s-vikram",
  i6: "s-ananya",
  i7: "s-sana",
  i8: "s-sana",
  i9: "s-arjun",
  i10: "s-vikram",
  i11: "s-lakshmi",
  i12: "s-vikram",
  i13: "s-sana",
  i14: "s-ananya",
};

/** Only payments someone recorded count; an unconfirmed attempt is dropped (the invoice stays due). */
const SHARED_PAYMENTS: PaymentEvent[] = INVOICES.flatMap((inv) =>
  (inv.payments ?? [])
    .filter((p) => p.confirmed)
    .map((p, i): PaymentEvent => ({
      id: `pe-${inv.id}-${i}`,
      invoiceId: inv.id,
      at: p.at,
      amount: p.amount,
      method: p.method,
      kind: p.amount < 0 ? "refund" : "payment",
      confirmation: p.method === "Package credit" ? "package" : "recorded",
      byId: META[inv.number]?.byId ?? null,
      reference: META[inv.number]?.reference,
      note: META[inv.number]?.note,
    })),
);

/** History = recorded shared payments + Kabir's package credit (₹0, not a payment). */
export const SEED_PAYMENTS: PaymentEvent[] = [
  ...SHARED_PAYMENTS,
  { id: "pe-i3-credit", invoiceId: "i3", at: "2026-11-06T11:12:00+05:30", amount: 0, method: "Package credit", kind: "credit", confirmation: "package", byId: "s-sneha", note: "Covered by the Heart Health package — no charge." },
];

export const CONFIRMATION_LABEL: Record<Confirmation, string> = {
  recorded: "Recorded",
  package: "Package credit",
};

export const CONFIRMATION_TONE: Record<Confirmation, Tone> = {
  recorded: "success",
  package: "neutral",
};

/** Invoice states shown in billing. "Paid" only once payments covering the total are recorded. */
export type DisplayStatus = Exclude<InvoiceStatus, "failed">;

export const STATUS_LABEL: Record<DisplayStatus, string> = {
  paid: "Paid",
  "partially-paid": "Partly paid",
  due: "Due",
  overdue: "Overdue",
  refunded: "Refunded",
};

export const STATUS_TONE: Record<DisplayStatus, Tone> = {
  paid: "success",
  "partially-paid": "info",
  due: "warning",
  overdue: "danger",
  refunded: "neutral",
};

export const OPEN_STATUSES: DisplayStatus[] = ["due", "overdue", "partially-paid"];

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

/** Package catalogue (synthetic; named after the clinic's programmes). Prices agree with the invoices that reference them. */
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

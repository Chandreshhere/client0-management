import { ADDONS, PLANS, minPlanFor, minPlanForRole, planById, yearlyCost } from "@/data/plans";
import { formatINR } from "@/lib/format";

/**
 * FAQ — single source for the visible answers and the FAQPage JSON-LD (no drift between them).
 * Every price, seat count and plan name is read from @/data/plans. Answers state only what the
 * product spec and plan data establish; anything unspecified is said plainly.
 */
export type Faq = { id: string; q: string; a: string };

const core = planById("core");
const clinic = planById("clinic");
const pro = planById("pro");
const FIVE = 5;
const list = (items: string[]) => (items.length <= 1 ? items.join("") : `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`);

const ALL: Record<string, Faq> = {
  what: {
    id: "what",
    q: "What is Carelane?",
    a: `Carelane is clinic management software for outpatient clinics that combine medical consultations, nutrition and yoga: one shared patient record that every role reaches by patient ID, phone or name. Doctors, nutritionists, yoga instructors and admins work on it in every plan; ${clinic.name} adds Reception, and ${pro.name} adds care coordinators and the patients themselves.`,
  },
  shared: {
    id: "shared",
    q: "Can a doctor, a nutritionist and a yoga instructor work on the same patient?",
    a: `Yes, on every plan — ${core.name} included. The doctor assigns the patient to nutrition or yoga with goals and precautions, and notes, reports, plan versions, sessions and flags all land on the same dated timeline. Each role sees what its work needs: instructors see precautions, not diagnoses.`,
  },
  onboarding: {
    id: "onboarding",
    q: "What does onboarding cost?",
    a: `Onboarding is a one-time fee: ${list(PLANS.map((p) => `${formatINR(p.onboardingFee)} on ${p.name}`))}. It is charged once, on top of the monthly fee per practitioner. The exact scope is agreed before onboarding starts.`,
  },
  monthly: {
    id: "monthly",
    q: "How is the monthly fee calculated?",
    a: `Per practitioner — each doctor, nutritionist and yoga instructor — per month, before GST. Billed annually: ${list(PLANS.map((p) => `${p.name} ${formatINR(p.price.annual)}`))}. Billed monthly: ${list(PLANS.map((p) => `${formatINR(p.price.monthly)} on ${p.name}`))}. Admin and reception seats are free up to ${list(PLANS.map((p) => `${p.freeSeats} on ${p.name}`))}, then ${formatINR(core.extraSeat)} a seat a month.`,
  },
  five: {
    id: "five",
    q: "Which plan for a team of five?",
    a: `For ${FIVE} practitioners billed annually: ${list(PLANS.map((p) => `${p.name} ${formatINR(yearlyCost(p, FIVE))} a year`))}, plus the one-time onboarding fee. Choose by what the clinic does with Carelane: ${core.name} for one shared patient record; ${clinic.name} to run the front office too — appointments, check-in, billing and packages; ${pro.name} to bring patients into the care team with the app, programmes and several branches.`,
  },
  addons: {
    id: "addons",
    q: "What isn't included in any plan?",
    a: `Add-ons, priced separately and available with any plan: ${list(ADDONS.map((a) => `${a.label} (${a.basis.charAt(0).toLowerCase()}${a.basis.slice(1)})`))}. None is included in ${list(PLANS.map((p) => p.name))}.`,
  },
  compliance: {
    id: "compliance",
    q: "Are consent and the activity log extra?",
    a: `No. DPDP consent at registration, access rules and the activity log are in every plan, ${core.name} included — compliance is never an upsell.`,
  },
  anatomy: {
    id: "anatomy",
    q: "Why does each patient's record open on a different organ?",
    a: "Carelane files every recorded condition under a body system, and the patient overview shows that system's organ: COPD opens on the lungs, CKD on the kidneys, type 2 diabetes on the pancreas, knee osteoarthritis on the knee joint. A patient with conditions in several systems gets one card per system. The 3D organs are illustrations for orientation, not the patient's imaging, and a record with no condition yet shows no organ.",
  },
  abha: {
    id: "abha",
    q: "Does Carelane work with ABHA and ABDM?",
    a: "The clinic's own patient ID is generated at registration and kept separate from ABHA, which is optional and stored only if the patient gives it. Consent-based record sharing through ABDM is an add-on, priced per clinic and available with any plan; it isn't part of this prototype.",
  },
  residency: {
    id: "residency",
    q: "Where is patient data stored?",
    a: "Data residency is on the roadmap. Today Carelane is a prototype: the demo runs in your browser on synthetic data and does not store patient information on a server.",
  },
  dpdp: {
    id: "dpdp",
    q: "Is Carelane compliant with India's DPDP Act?",
    a: "We don't claim DPDP compliance for the prototype. The DPDP framework commences in phases, so the obligations that apply will be checked against the actual launch date and operating model.",
  },
  demo: {
    id: "demo",
    q: "Is the live demo using real patient data?",
    a: "No. Every patient, practitioner and appointment in the demo is synthetic and belongs to a fictional clinic. Changes you make stay in your browser session, and no payment, message or clinical signature is ever sent.",
  },
  portal: {
    id: "portal",
    q: "Can patients log in too?",
    a: `Yes, on ${minPlanForRole("patient").name}. The patient app shows appointments, the current nutrition plan and yoga schedule, records a practitioner has released, invoices and messages to the care team. Food logs and home readings are in ${minPlanFor("self-report").name} too, and anything a patient enters stays labelled self-reported until a practitioner reviews it.`,
  },
  try: {
    id: "try",
    q: "Can we try a plan before deciding?",
    a: "Yes. The live demo has a separate login for each plan and role — each one is a real setup on synthetic data, with no sign-up. To see another plan or role, go back to the demo page and pick another login.",
  },
};

export const LANDING_FAQ: Faq[] = [ALL.what, ALL.shared, ALL.anatomy, ALL.monthly, ALL.five, ALL.onboarding, ALL.compliance, ALL.abha, ALL.residency, ALL.dpdp, ALL.demo, ALL.portal];
export const PRICING_FAQ: Faq[] = [ALL.monthly, ALL.five, ALL.onboarding, ALL.addons, ALL.compliance, ALL.shared, ALL.portal, ALL.residency, ALL.try];

/** Landing FAQ grouped for the topic index beside the list; every id is in LANDING_FAQ. */
export const LANDING_FAQ_TOPICS = [
  { label: "Product and workflow", ids: ["what", "shared", "anatomy", "portal"] },
  { label: "Plans and pricing", ids: ["monthly", "five", "onboarding", "compliance"] },
  { label: "Data, privacy and ABDM", ids: ["abha", "residency", "dpdp"] },
  { label: "The live demo", ids: ["demo"] },
] as const;

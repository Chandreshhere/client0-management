import { PLANS, monthlyCost, planById } from "@/data/plans";
import { formatINR } from "@/lib/format";

/**
 * FAQ — single source for the visible answers and the FAQPage JSON-LD (no drift between them).
 * Answers state only what the product brief and plan data establish; anything unspecified is
 * said plainly ("agreed during onboarding", "on the roadmap").
 */
export type Faq = { id: string; q: string; a: string };

const starter = planById("starter");
const team = planById("team");
const clinic = planById("clinic");
const teamAt5 = monthlyCost(team, 5) ?? 0;
const clinicAt5 = monthlyCost(clinic, 5) ?? 0;
const range = (p: (typeof PLANS)[number]) => (p.pricing.kind === "per-user" ? `${p.pricing.minUsers}–${p.pricing.maxUsers} users` : "");

const ALL: Record<string, Faq> = {
  what: {
    id: "what",
    q: "What is Carelane?",
    a: "Carelane is clinic management software for outpatient clinics that combine medical consultations, nutrition support and yoga. Doctors, nutritionists, yoga instructors, front-desk staff, care coordinators, administrators and patients each get their own workspace on one shared patient record.",
  },
  shared: {
    id: "shared",
    q: "Can a doctor, a nutritionist and a yoga instructor work on the same patient?",
    a: `Yes, on the ${team.name} and ${clinic.name} plans. Each discipline works in its own workspace, and notes, plans, referrals and sessions land on the same patient timeline. ${starter.name} includes the doctor workspace only.`,
  },
  setup: {
    id: "setup",
    q: "What does the setup fee cover?",
    a: `The setup fee is a one-time charge: ${formatINR(starter.setupFee)} on ${starter.name}, ${formatINR(team.setupFee)} on ${team.name} and ${formatINR(clinic.setupFee)} on ${clinic.name}. Setup scope is agreed during onboarding.`,
  },
  monthly: {
    id: "monthly",
    q: "How is the monthly fee calculated?",
    a: `${starter.name} is a flat ${formatINR(starter.pricing.monthly)} a month. ${team.name} is ${formatINR(team.pricing.monthly)} per user per month for ${range(team)}. ${clinic.name} is ${formatINR(clinic.pricing.monthly)} per user per month for ${range(clinic)}.`,
  },
  five: {
    id: "five",
    q: "Which plan is cheaper for a team of five?",
    a: `Five users fits both ${team.name} and ${clinic.name}. At five users ${clinic.name} costs ${formatINR(clinicAt5)} a month against ${formatINR(teamAt5)} on ${team.name}, with the same ${formatINR(clinic.setupFee)} setup fee, and it adds the patient portal, the care-coordinator workspace and administration.`,
  },
  anatomy: {
    id: "anatomy",
    q: "Why does each patient's record open on a different organ?",
    a: "Carelane files every recorded condition under a body system, and the patient overview shows that system's organ: COPD opens on the lungs, CKD on the kidneys, type 2 diabetes on the pancreas, knee osteoarthritis on the knee joint. A patient with conditions in several systems gets one card per system. The 3D organs are illustrations for orientation, not the patient's imaging, and a record with no condition yet shows no organ.",
  },
  abha: {
    id: "abha",
    q: "Does Carelane work with ABHA and ABDM?",
    a: "Not yet. The clinic's own patient number is kept separate from ABHA, which is voluntary for patients. ABDM integration is on the roadmap as a separate workstream built on ABDM's published FHIR profiles.",
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
    a: `Yes, on the ${clinic.name} plan. The patient portal shows a patient their next appointment, current plan, daily actions, released records, invoices and messages. Anything a patient enters stays labelled as self-reported until a practitioner reviews it.`,
  },
  try: {
    id: "try",
    q: "Can we try a plan before deciding?",
    a: "Yes. The live demo opens each plan with its own workspaces and synthetic data, with no sign-up. You can switch plan or role from inside the demo at any time.",
  },
};

export const LANDING_FAQ: Faq[] = [ALL.what, ALL.shared, ALL.anatomy, ALL.setup, ALL.monthly, ALL.abha, ALL.residency, ALL.dpdp, ALL.demo, ALL.portal];
export const PRICING_FAQ: Faq[] = [ALL.setup, ALL.monthly, ALL.five, ALL.shared, ALL.portal, ALL.residency, ALL.try];

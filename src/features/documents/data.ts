/**
 * Synthetic detail behind the shared DOCUMENTS fixtures (src/data/records.ts): what each report
 * says (for people allowed to read it), reviews already recorded, and the non-clinical notes the
 * intake desk works from. Values are transcribed for the demo and fictional.
 */
export type ReviewOutcome = "normal" | "follow-up" | "discuss";

export const OUTCOME_LABEL: Record<ReviewOutcome, string> = {
  normal: "Normal",
  "follow-up": "Follow-up needed",
  discuss: "Discuss with patient",
};

export const OUTCOME_HINT: Record<ReviewOutcome, string> = {
  normal: "No action beyond filing",
  "follow-up": "Something needs doing — creates a task",
  discuss: "Explain at the next visit or by message",
};

export interface DocValue {
  label: string;
  value: string;
  unit?: string;
  ref?: string;
  flag?: "high" | "low";
}

export interface DocContent {
  summary: string;
  values?: DocValue[];
  /** the one finding a stat card leads with, when the report has no structured values */
  headline?: { value: string; label: string };
}

export interface DocReview {
  outcome: ReviewOutcome;
  by: string;
  at: string;
  comment?: string;
  taskId?: string;
}

export const DOC_CONTENT: Record<string, DocContent> = {
  d1: {
    summary: "Fasting lipid profile. LDL 118 mg/dL — up from 96 mg/dL in August and above the < 70 mg/dL secondary-prevention target. HDL and triglycerides are within range.",
    // matches the same panel on Kabir's record (LAB_PANELS / event e26-24); total = LDL + HDL + TG/5
    values: [
      { label: "Total cholesterol", value: "192", unit: "mg/dL", ref: "< 200" },
      { label: "LDL cholesterol", value: "118", unit: "mg/dL", ref: "< 70 (CAD target)", flag: "high" },
      { label: "HDL cholesterol", value: "44", unit: "mg/dL", ref: "> 40" },
      { label: "Triglycerides", value: "148", unit: "mg/dL", ref: "< 150" },
    ],
  },
  d2: {
    summary: "Complete blood count with a handwritten note from an outside clinic. Name on the report partially legible.",
    values: [
      { label: "Haemoglobin", value: "12.1", unit: "g/dL", ref: "13.0–17.0", flag: "low" },
      { label: "WBC", value: "7.4", unit: "×10³/µL", ref: "4.0–11.0" },
      { label: "Platelets", value: "236", unit: "×10³/µL", ref: "150–410" },
    ],
  },
  d3: {
    summary: "Transthoracic echo: LVEF 45%, mild hypokinesia of the inferior wall. No pericardial effusion. Valves normal.",
    values: [
      { label: "LVEF", value: "45", unit: "%", ref: "55–70", flag: "low" },
      { label: "LV end-diastolic diameter", value: "5.1", unit: "cm", ref: "4.2–5.8" },
    ],
  },
  d4: {
    summary: "2019 admission for new-onset atrial fibrillation. Started on warfarin; discharged stable with INR 2.4. Historical report — not a new result.",
    values: [{ label: "INR at discharge", value: "2.4", ref: "2.0–3.0 (on warfarin)" }],
  },
  d5: {
    summary: "Glycaemic control above target.",
    values: [
      { label: "HbA1c", value: "8.4", unit: "%", ref: "< 7.0", flag: "high" },
      { label: "Fasting glucose", value: "162", unit: "mg/dL", ref: "70–100", flag: "high" },
    ],
  },
  d6: {
    summary: "TSH raised with a normal free T4 — consistent with subclinical hypothyroidism.",
    values: [
      { label: "TSH", value: "7.8", unit: "mIU/L", ref: "0.4–4.5", flag: "high" },
      { label: "Free T4", value: "0.9", unit: "ng/dL", ref: "0.8–1.8" },
    ],
  },
  d7: { summary: "Restricted psychiatric evaluation. Content is visible only to the assigned clinician." },
  d8: {
    summary: "Obstructive pattern, moderate. Resting SpO₂ 93% on room air.",
    values: [
      { label: "FEV1/FVC", value: "0.62", ref: "> 0.70", flag: "low" },
      { label: "FEV1 (% predicted)", value: "58", unit: "%", ref: "> 80", flag: "low" },
      { label: "Resting SpO₂", value: "93", unit: "%", ref: "≥ 95", flag: "low" },
    ],
  },
  d9: { summary: "Signed programme-enrolment consent (1 page). No clinical values." },
  d10: { summary: "Atorvastatin 20 mg once nightly, 90 days. Signed by Dr. Ananya Rao." },
  d11: { summary: "L4–L5 posterior disc bulge without nerve-root compression. Mild facet arthropathy.", headline: { value: "L4–L5", label: "Disc bulge level" } },
  d12: {
    summary: "Iron-deficiency picture.",
    values: [
      { label: "Haemoglobin", value: "10.9", unit: "g/dL", ref: "12.0–15.5", flag: "low" },
      { label: "Ferritin", value: "9", unit: "ng/mL", ref: "15–150", flag: "low" },
    ],
  },
};

export const SEEDED_REVIEWS: Record<string, DocReview> = {
  d5: { outcome: "follow-up", by: "s-vikram", at: "2026-10-22T10:00:00+05:30", comment: "Above target — nutrition reset referral sent to Rohan Desai." },
  d7: { outcome: "normal", by: "s-ananya", at: "2026-10-16T15:00:00+05:30", comment: "Filed as restricted." },
  d10: { outcome: "normal", by: "s-ananya", at: "2026-09-08T10:45:00+05:30" },
  d11: { outcome: "discuss", by: "s-sana", at: "2026-10-07T12:00:00+05:30", comment: "Explain the disc findings; continue the back-care programme." },
};

/** What the intake desk can see without opening the clinical content. */
export const INTAKE_HINTS: Record<string, { note: string; suggest?: string }> = {
  d2: { note: "Handed in at the desk by a family member. The cover sheet reads “R. Pillai”; no date of birth.", suggest: "p-rajesh" },
  d9: { note: "Scanned at check-in. File against the programme enrolment — no clinical review needed.", suggest: "p-tanvi" },
};

/**
 * The figure a document's stat card leads with: an explicit headline, else the first flagged
 * value, else the first value. Null when the report carries nothing quantitative.
 */
export function docHeadline(docId: string): { value: string; label: string } | null {
  const c = DOC_CONTENT[docId];
  if (!c) return null;
  if (c.headline) return c.headline;
  const v = c.values?.find((x) => x.flag) ?? c.values?.[0];
  if (!v) return null;
  return { value: v.value, label: `${v.label}${v.unit ? ` (${v.unit})` : ""}${v.flag ? ` · ${v.flag}` : ""}` };
}

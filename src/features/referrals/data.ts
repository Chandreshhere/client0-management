/**
 * Synthetic detail behind the shared REFERRALS fixtures (src/data/care.ts), read as assignments
 * (spec F5): the doctor's goals and the guidance (nutrition) or precautions (yoga) that go with
 * each one, and who opened it. Goals for instructors are written without diagnoses (rule 3).
 */
export interface AssignmentExtra {
  goals: string;
  /** nutrition guidance or yoga precautions, as the doctor wrote them */
  guidance: string;
  /** who opened it (the recipient, unless it was reassigned) */
  seenBy?: string;
}

export const ASSIGNMENT_EXTRAS: Record<string, AssignmentExtra> = {
  r1: { goals: "Heart-healthy vegetarian plan; bring LDL from 96 to under 70 mg/dL", guidance: "Sodium under 2 g a day · no coconut oil for cooking · keep paneer to twice a week", seenBy: "s-meera" },
  r2: { goals: "Gentle flow three times a week; build stamina for daily walks", guidance: "HR ceiling 110 bpm · no inversions · no breath retention", seenBy: "s-kavya" },
  r3: { goals: "Post-MI diet: weight 84 kg → 78 kg over 12 weeks; triglycerides 260 mg/dL", guidance: "Low sodium, DASH-style · no alcohol · non-vegetarian, prefers fish" },
  r4: { goals: "Diabetes nutrition reset; HbA1c 8.4% → under 7%", guidance: "Kerala meals, rice to one cup per meal · no fruit juice · keep dinner before 20:00", seenBy: "s-rohan" },
  r5: { goals: "Strength & flow, twice a week", guidance: "Hydration break mid-class · no hot room", seenBy: "s-lakshmi" },
  r6: { goals: "Breathwork and paced walking preparation", guidance: "SpO₂ floor 90% during practice · stop and rest below it", seenBy: "s-lakshmi" },
  r7: { goals: "Back care programme, 8 sessions", guidance: "Avoid loaded flexion · chair support for standing work", seenBy: "s-arjun" },
  r8: { goals: "Consistent vitamin K intake while on warfarin", guidance: "Keep leafy greens steady day to day, don't cut them out · INR checked weekly" },
  r9: { goals: "Low-impact yoga, twice a week", guidance: "No supine breath-holds · seated options for every standing pose", seenBy: "s-kavya" },
  r10: { goals: "Iron-rich vegetarian diet; ferritin 9 ng/mL", guidance: "Jain — no root vegetables · vitamin C with iron-rich meals · tea away from meals", seenBy: "s-meera" },
};

/** Who covers whom while someone is on leave (suggested first when reassigning). */
export const COVER_FOR: Record<string, string> = { "s-sana": "s-vikram" };

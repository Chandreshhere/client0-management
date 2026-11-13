/**
 * Anatomy model: which body system (and which 3D organ) a recorded condition belongs to.
 * Every organ render, body-system card and timeline group in the UI is derived from the
 * patient's actual conditions through this mapping — never hard-coded to a heart.
 */
import type { Patient } from "./types";

export type OrganKind = "heart" | "brain" | "lungs" | "kidney" | "liver" | "cells" | "thyroid" | "pancreas" | "spine" | "uterus" | "gut" | "knee";

export type SystemKey =
  | "cardiovascular"
  | "respiratory"
  | "neurological"
  | "renal"
  | "hepatic"
  | "haematology"
  | "endocrine"
  | "metabolic"
  | "musculoskeletal"
  | "reproductive"
  | "digestive";

export const SYSTEM_INFO: Record<SystemKey, { name: string; organ: OrganKind; organLabel: string }> = {
  cardiovascular: { name: "Blood Circulatory", organ: "heart", organLabel: "Heart" },
  respiratory: { name: "Respiratory", organ: "lungs", organLabel: "Lungs" },
  neurological: { name: "Nervous", organ: "brain", organLabel: "Brain" },
  renal: { name: "Renal", organ: "kidney", organLabel: "Kidneys" },
  hepatic: { name: "Hepatic", organ: "liver", organLabel: "Liver" },
  haematology: { name: "Blood", organ: "cells", organLabel: "Blood cells" },
  endocrine: { name: "Endocrine", organ: "thyroid", organLabel: "Thyroid" },
  metabolic: { name: "Metabolic", organ: "pancreas", organLabel: "Pancreas" },
  musculoskeletal: { name: "Musculoskeletal", organ: "spine", organLabel: "Spine & joints" },
  reproductive: { name: "Reproductive", organ: "uterus", organLabel: "Uterus & ovaries" },
  digestive: { name: "Digestive", organ: "gut", organLabel: "Stomach & gut" },
};

export const ORGAN_LABEL: Record<OrganKind, string> = {
  heart: "Heart",
  brain: "Brain",
  lungs: "Lungs",
  kidney: "Kidneys",
  liver: "Liver",
  cells: "Blood",
  thyroid: "Thyroid",
  pancreas: "Pancreas",
  spine: "Spine",
  uterus: "Uterus",
  gut: "Stomach",
  knee: "Knee joint",
};

/** Within a system, some conditions are better shown by a different model (knee vs spine). */
const ORGAN_OVERRIDES: [RegExp, OrganKind][] = [[/knee|rheumatoid|osteoarthritis|joint/i, "knee"]];

export function organForSystem(key: SystemKey, conditions: string[]): OrganKind {
  for (const [re, organ] of ORGAN_OVERRIDES) if (conditions.some((c) => re.test(c)) && key === "musculoskeletal") return organ;
  return SYSTEM_INFO[key].organ;
}

/** Ordered rules: first match wins (e.g. "gestational diabetes" is metabolic, not reproductive). */
const RULES: [RegExp, SystemKey][] = [
  [/diabet|insulin|glucose|hba1c|obesity|weight/i, "metabolic"],
  [/coronary|myocard|infarct|atrial|tachycard|hypertension|dyslipid|cardiac|heart|palpitation|arrhythm/i, "cardiovascular"],
  [/asthma|copd|bronch|apnoea|apnea|post-viral|respirat|pneumon|lung/i, "respiratory"],
  [/ckd|renal|kidney|nephr/i, "renal"],
  [/nafld|fatty liver|liver|hepat/i, "hepatic"],
  [/anaemia|anemia|ferritin|iron/i, "haematology"],
  [/thyroid/i, "endocrine"],
  [/migraine|aneurysm|amnesia|stroke|epilep|neuro|anxiety|insomnia|depress|atherosclerosis/i, "neurological"],
  [/pcos|polycystic|pregnan|trimester|menopaus|endometri/i, "reproductive"],
  [/spondyl|lumbar|cervical|back|osteo|arthritis|knee|joint|sciatica/i, "musculoskeletal"],
  [/ibs|irritable|bowel|gastr|reflux|lactose|crohn|colitis/i, "digestive"],
];

export function classifyCondition(name: string): SystemKey | null {
  for (const [re, key] of RULES) if (re.test(name)) return key;
  return null;
}

/** Body systems involved for a patient, in the order their conditions are recorded. */
export function patientSystems(p: Pick<Patient, "conditions">): { key: SystemKey; conditions: string[] }[] {
  const out: { key: SystemKey; conditions: string[] }[] = [];
  for (const c of p.conditions) {
    const key = classifyCondition(c);
    if (!key) continue;
    const hit = out.find((s) => s.key === key);
    if (hit) hit.conditions.push(c);
    else out.push({ key, conditions: [c] });
  }
  return out;
}

/** The organ that best represents this patient's primary problem (null if nothing recorded yet). */
export function primaryOrgan(p: Pick<Patient, "conditions">): OrganKind | null {
  const s = patientSystems(p)[0];
  return s ? organForSystem(s.key, s.conditions) : null;
}

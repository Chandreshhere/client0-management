import { ORGAN_LABEL, SYSTEM_INFO, classifyCondition, organForSystem, type OrganKind } from "@/data/anatomy";
import { PATIENTS, patientById } from "@/data/patients";
import { ALL_RECORD_PATIENTS, getRecord } from "@/data/record";

/**
 * Data for "Every condition, its own anatomy". Nothing here is a statistic about real clinics:
 *  - `families` are plain-language condition names, each checked against the shared classifier
 *    (classifyCondition → organForSystem) at build time, so a label that would not open this
 *    organ is dropped instead of shown;
 *  - `patients` are the synthetic demo patients whose own record (getRecord) has a body system
 *    drawn with this organ, with the conditions recorded under it.
 */

export const ORGAN_ORDER: OrganKind[] = ["heart", "lungs", "brain", "pancreas", "kidney", "liver", "thyroid", "cells", "uterus", "gut", "spine", "knee"];

const FAMILY_CANDIDATES: Record<OrganKind, string[]> = {
  heart: ["Coronary artery disease", "Hypertension", "Atrial fibrillation", "Myocardial infarction", "Dyslipidaemia"],
  lungs: ["Asthma", "COPD", "Sleep apnoea", "Post-viral syndrome"],
  brain: ["Migraine", "Anxiety", "Insomnia", "Stroke", "Epilepsy"],
  pancreas: ["Type 2 diabetes", "Pre-diabetes", "Insulin resistance", "Obesity"],
  kidney: ["CKD", "Kidney disease", "Nephritis"],
  liver: ["NAFLD", "Fatty liver", "Hepatitis"],
  thyroid: ["Hypothyroidism", "Hyperthyroidism"],
  cells: ["Iron-deficiency anaemia", "Anaemia", "Low ferritin"],
  uterus: ["PCOS", "Pregnancy", "Perimenopause", "Endometriosis"],
  gut: ["IBS", "Acid reflux", "Gastritis", "Lactose intolerance"],
  spine: ["Lumbar spondylosis", "Cervical spondylosis", "Sciatica", "Osteopenia"],
  knee: ["Knee osteoarthritis", "Rheumatoid arthritis", "Joint pain"],
};

/** The organ a single condition name would open, using the same rules as every record. */
export function organOfCondition(name: string): OrganKind | null {
  const key = classifyCondition(name);
  return key ? organForSystem(key, [name]) : null;
}

export type OrganPatient = { id: string; name: string; avatar: string; age: number; conditions: string[] };
export type OrganEntry = { kind: OrganKind; label: string; systemName: string; families: string[]; patients: OrganPatient[] };

export function organEntries(): OrganEntry[] {
  return ORGAN_ORDER.map((kind) => {
    const families = FAMILY_CANDIDATES[kind].filter((f) => organOfCondition(f) === kind);
    const key = families.length ? classifyCondition(families[0]) : null;
    const patients = ALL_RECORD_PATIENTS.flatMap((id) => {
      const record = getRecord(id);
      const p = patientById(id);
      if (!record || !p) return [];
      const systems = record.systems.filter((s) => s.organ === kind);
      if (!systems.length) return [];
      const conditions = record.conditions.filter((c) => systems.some((s) => s.id === c.systemId)).map((c) => c.name);
      return [{ id, name: p.name, avatar: p.avatar, age: p.age, conditions }];
    });
    return { kind, label: ORGAN_LABEL[kind], systemName: key ? SYSTEM_INFO[key].name : "", families, patients };
  });
}

/** Demo patients with no recorded condition yet — their record shows no organ at all. */
export function patientsWithoutOrgan() {
  return PATIENTS.filter((p) => !ALL_RECORD_PATIENTS.includes(p.id)).map((p) => ({ id: p.id, name: p.name, concern: p.primaryConcern }));
}

export const PATIENT_TOTAL = PATIENTS.length;

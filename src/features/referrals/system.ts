import { SYSTEM_INFO, classifyCondition, organForSystem, patientSystems, type SystemKey } from "@/data/anatomy";
import { patientById } from "@/data/patients";
import type { OrganInfo } from "@/features/tasks/organ-glyph";
import type { CareReferral } from "./store";

/** Clinical shorthand that referral reasons use but condition names spell out. */
const SHORTHAND: [RegExp, SystemKey][] = [
  [/\bOSA\b|sleep apn/i, "respiratory"],
  [/\bpost-?MI\b|\bMI\b|cardiac rehab/i, "cardiovascular"],
];

/**
 * The body system a referral is about: the system named by its reason, if the patient has a
 * recorded condition in it; otherwise the patient's primary system. Never invented — a patient
 * with no recorded conditions has no system (and the UI shows no organ).
 */
export function referralSystem(r: Pick<CareReferral, "patientId" | "reason">): (OrganInfo & { matched: boolean }) | null {
  const p = patientById(r.patientId);
  if (!p) return null;
  const systems = patientSystems(p);
  if (!systems.length) return null;
  const named = SHORTHAND.find(([re]) => re.test(r.reason))?.[1] ?? classifyCondition(r.reason);
  const hit = named ? systems.find((s) => s.key === named) : undefined;
  const s = hit ?? systems[0];
  return { organ: organForSystem(s.key, s.conditions), system: SYSTEM_INFO[s.key].name, conditions: s.conditions, matched: !!hit };
}

export function referralSystemLabel(info: NonNullable<ReturnType<typeof referralSystem>>) {
  return info.matched
    ? `Body system this referral concerns: ${info.system} — from the referral reason, matching ${info.conditions.join(", ")} on the record`
    : `Patient's primary body system: ${info.system} — ${info.conditions.join(", ")} (the referral reason names no system)`;
}

// Generates illustrated avatars for every synthetic staff member and patient.
// Style: DiceBear "Notionists" by Zoish — design CC0 1.0, code MIT.
// Run: node --no-warnings scripts/generate-avatars.mjs
import { writeFileSync, mkdirSync } from "node:fs";
import { createAvatar } from "@dicebear/core";
import * as notionists from "@dicebear/notionists";
import { STAFF } from "../src/data/staff.ts";
import { PATIENTS } from "../src/data/patients.ts";

const v = (n) => `variant${String(n).padStart(2, "0")}`;
// Hair variants classified by eye from a rendered contact sheet (see README → Avatars).
const HAIR_F = [58, 48, 47, 46, 45, 41, 39, 37, 36, 28, 23, 10, 2, 43, 59].map(v);
const HAIR_M = [60, 56, 55, 54, 53, 52, 49, 44, 38, 35, 34, 33, 32, 31, 27, 26, 25, 24, 22, 21, 19, 18, 17, 16, 15, 13, 12, 7, 6, 5, 3, 1].map(v);
const HAIR_F_OLD = [v(61)];
const HAIR_M_OLD = [v(42)];
const BODY = Array.from({ length: 24 }, (_, i) => v(i + 1)); // excludes variant25 (hand-sign prop)
const BG = ["d7e3ff", "e3e6e1", "dde7f2", "ece6dc", "e6e0f2"];

const out = new URL("../public/avatars/", import.meta.url);
mkdirSync(out, { recursive: true });

const people = [...STAFF.map((s) => ({ ...s, age: 40 })), ...PATIENTS];
people.forEach((p, i) => {
  const female = p.sex === "Female";
  const old = (p.age ?? 40) >= 60;
  const hair = old ? (female ? HAIR_F_OLD : HAIR_M_OLD) : female ? HAIR_F : HAIR_M;
  const svg = createAvatar(notionists, {
    seed: `${p.id}-carelane`,
    backgroundColor: [BG[i % BG.length]],
    backgroundType: ["solid"],
    hair,
    body: BODY,
    beardProbability: female ? 0 : 35,
    glassesProbability: 0,
    gestureProbability: 0,
    bodyIconProbability: 0,
    scale: 112,
    translateY: 4,
  }).toString();
  writeFileSync(new URL(`${p.id}.svg`, out), svg);
});
console.log(`wrote ${people.length} avatars`);

import type { ReferralStage } from "@/data/types";

/**
 * Synthetic detail behind the shared REFERRALS fixtures (src/data/care.ts): who moved each
 * referral to each stage, when booked visits happen, and notes along the way.
 */
export interface ReferralNote {
  id: string;
  at: string;
  actorId: string;
  text: string;
}

export interface ReferralExtra {
  bookedFor?: string;
  room?: string;
  actors: Partial<Record<ReferralStage, string>>;
  notes?: ReferralNote[];
  /** a task in TASKS that tracks this referral (closed when the referral moves on) */
  linkedTaskId?: string;
}

const at = (month: number, day: number, hhmm: string) => `2026-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}T${hhmm}:00+05:30`;

export const REFERRAL_EXTRAS: Record<string, ReferralExtra> = {
  r1: {
    bookedFor: at(9, 12, "11:00"),
    room: "Nutrition Studio",
    actors: { requested: "s-ananya", accepted: "s-meera", booked: "s-sneha", completed: "s-meera", acknowledged: "s-ananya" },
    notes: [{ id: "r1-n1", at: at(9, 12, "12:05"), actorId: "s-meera", text: "Completion note: plan v1 published — vegetarian, 1,800 kcal, sodium under 2 g." }],
  },
  r2: {
    bookedFor: at(9, 9, "07:30"),
    room: "Yoga Hall",
    actors: { requested: "s-ananya", accepted: "s-kavya", booked: "s-kavya", completed: "s-kavya" },
    notes: [{ id: "r2-n1", at: at(9, 15, "08:40"), actorId: "s-kavya", text: "Completion note: 6-session block finished; HR stayed under 110 bpm throughout. Home practice released." }],
  },
  r3: { actors: { requested: "s-ananya" }, linkedTaskId: "t5" },
  r4: {
    actors: { requested: "s-vikram", accepted: "s-rohan" },
    notes: [{ id: "r4-n1", at: at(11, 7, "11:00"), actorId: "s-farhan", text: "Two call attempts to book — no answer. Patient also missed today's 09:00 review." }],
  },
  r5: { bookedFor: at(11, 13, "12:00"), room: "Yoga Hall", actors: { requested: "s-vikram", accepted: "s-lakshmi", booked: "s-sneha" } },
  r6: {
    bookedFor: at(10, 21, "17:00"),
    room: "Therapy Room",
    actors: { requested: "s-sana", accepted: "s-lakshmi", booked: "s-lakshmi", completed: "s-lakshmi" },
    notes: [
      { id: "r6-n1", at: at(11, 10, "17:50"), actorId: "s-lakshmi", text: "Completion note: SpO₂ stayed at or above 92% in every session. Ready for the doctor's acknowledgement." },
      { id: "r6-n2", at: at(11, 12, "09:00"), actorId: "s-farhan", text: "Dr. Qureshi is on leave until 18 Nov — acknowledgement needs a covering doctor." },
    ],
  },
  r7: {
    bookedFor: at(10, 9, "17:30"),
    room: "Yoga Deck",
    actors: { requested: "s-sana", accepted: "s-arjun", booked: "s-ishaan" },
    notes: [{ id: "r7-n1", at: at(10, 9, "19:00"), actorId: "s-arjun", text: "First session held. Completion of the referral not recorded yet." }],
  },
  r8: {
    actors: { requested: "s-ananya" },
    notes: [{ id: "r8-n1", at: at(11, 6, "10:00"), actorId: "s-farhan", text: "Raised at the Thursday huddle — still not accepted." }],
  },
  r9: { actors: { requested: "s-vikram", accepted: "s-kavya" } },
  r10: { bookedFor: at(11, 13, "16:30"), room: "Nutrition Studio", actors: { requested: "s-vikram", accepted: "s-meera", booked: "s-meera" } },
};

/** Who covers whom while someone is on leave (used by "Reassign"). */
export const COVER_FOR: Record<string, string> = { "s-sana": "s-vikram" };

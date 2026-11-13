/**
 * Synthetic conversation history behind the shared THREADS fixtures (src/data/records.ts).
 * 4–8 messages per thread; each thread's last message matches its `lastMessage` / `lastAt`.
 * Fictional people, fictional content.
 */
export interface ChatMessage {
  id: string;
  threadId: string;
  authorId: string;
  body: string;
  at: string;
  /** set only on messages written in this browser session */
  local?: boolean;
}

const at = (month: number, day: number, hhmm: string) => `2026-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}T${hhmm}:00+05:30`;

let n = 0;
const m = (threadId: string, authorId: string, when: string, body: string): ChatMessage => ({ id: `${threadId}-${++n}`, threadId, authorId, at: when, body });

export const MESSAGES: ChatMessage[] = [
  // m1 · Swap Saturday class? (patient channel)
  m("m1", "s-kavya", at(11, 10, "18:05"), "Hi Kabir — your home-practice sheet for weeks 9–10 is in the portal now. Keep the standing sequence to 10 minutes and stop if you feel light-headed."),
  m("m1", "p-kabir", at(11, 10, "19:40"), "Got it, thank you! The breathing part is much easier now."),
  m("m1", "s-kavya", at(11, 11, "08:15"), "Great to hear. Remember: heart rate under 110 during practice, as Dr. Rao advised."),
  m("m1", "s-farhan", at(11, 11, "09:02"), "Hi Kabir, Farhan here from care coordination. Your week-9 review with Dr. Rao is on Friday at 11:00."),
  m("m1", "p-kabir", at(11, 12, "20:10"), "Quick one — I have a family function on Saturday morning."),
  m("m1", "p-kabir", at(11, 13, "07:55"), "Can I swap the Saturday class for Sunday this week?"),

  // m2 · Arun — dizziness in class (care team)
  m("m2", "s-kavya", at(11, 13, "07:48"), "Arun felt light-headed during the standing balance sequence at Sunrise Cardiac Rehab. I paused the session; he recovered seated within 4 minutes. HR 104 after rest."),
  m("m2", "s-kavya", at(11, 13, "07:52"), "I've escalated a clinical review task to you, Dr. Rao. No interpretation from my side — just what I observed."),
  m("m2", "s-farhan", at(11, 13, "08:01"), "Thanks Kavya. He's booked with Dr. Rao at 15:00 today — I'll flag it at check-in."),
  m("m2", "s-kavya", at(11, 13, "08:10"), "Seated variations only until you review, please confirm."),

  // m3 · Food log photos this week (patient channel)
  m("m3", "s-rohan", at(11, 9, "10:00"), "Hi Sameer, this week please photograph lunch and dinner — no need to log snacks yet."),
  m("m3", "p-sameer", at(11, 9, "13:22"), "Will do. Is the office canteen dal okay, or should I carry lunch?"),
  m("m3", "s-rohan", at(11, 9, "15:05"), "Canteen dal is fine — add a bowl of salad and skip the second roti."),
  m("m3", "p-sameer", at(11, 12, "21:30"), "Uploaded 6 photos — weekend was tough!"),

  // m4 · Rekha — new SpO₂ floor (care team)
  m("m4", "s-lakshmi", at(11, 12, "19:20"), "Rekha's spirometry is in — uploaded by BreathWell Labs this evening."),
  m("m4", "s-farhan", at(11, 12, "19:45"), "Dr. Qureshi is on leave until 18 Nov — I've asked her to look before tomorrow's 17:00 breathwork."),
  m("m4", "s-lakshmi", at(11, 12, "19:52"), "Thank you. Until then I'll keep her on the current plan: SpO₂ floor 90%, seated only."),
  m("m4", "s-sana", at(11, 13, "08:44"), "Raised floor to 92% after spirometry. Please adapt today's session."),

  // m5 · Invoice question (patient channel)
  m("m5", "p-neelam", at(10, 28, "12:10"), "Thank you for today. Could you send the invoice when it's ready?"),
  m("m5", "s-sneha", at(11, 10, "11:00"), "Hello Mrs. Chaudhary, the invoice INV-2611-0380 for your 28 Oct consultation is in the portal."),
  m("m5", "s-sneha", at(11, 10, "11:02"), "It shows ₹900 due. You can pay at the front desk or by UPI from the portal."),
  m("m5", "p-neelam", at(11, 11, "14:20"), "Was the October session included in the package?"),

  // m6 · Plan v4 — dinner timing (patient channel)
  m("m6", "p-kabir", at(11, 11, "21:05"), "On office days I get home around 19:15 — the 19:00 dinner in the plan is too early for me."),
  m("m6", "s-meera", at(11, 12, "09:30"), "Thanks for telling me — that's exactly what the plan should adapt to."),
  m("m6", "s-meera", at(11, 12, "17:10"), "I've published plan v4. Same foods, shifted timing, plus a 17:30 snack so you're not too hungry on the way home."),
  m("m6", "s-meera", at(11, 12, "17:12"), "Moved dinner alternatives to 19:30 on office days."),

  // m7 · Cover for Dr. Sana's patients (care team)
  m("m7", "s-neha", at(11, 10, "09:05"), "Dr. Qureshi is on leave from today until 18 Nov. Eleven active patients need cover."),
  m("m7", "s-farhan", at(11, 10, "09:30"), "I'll go through the list and flag anything time-sensitive — Rekha Iyengar's breathwork guidance is one."),
  m("m7", "s-neha", at(11, 12, "18:40"), "Six reassigned so far. Two urgent report reviews are still open."),
  m("m7", "s-vikram", at(11, 12, "19:05"), "I can take the two urgent reviews on Monday."),

  // m8 · Reschedule request (patient channel)
  m("m8", "s-ishaan", at(11, 6, "18:30"), "Hi Fatima, your Evening Back Care class is confirmed for Fridays at 17:30 at HSR Layout."),
  m("m8", "p-fatima", at(11, 6, "19:02"), "Thank you! Do I need to bring my own mat?"),
  m("m8", "s-ishaan", at(11, 7, "10:15"), "Mats are provided — just bring water and wear something comfortable."),
  m("m8", "p-fatima", at(11, 12, "09:40"), "Could I move Friday to 18:30?"),
];

/** Patient-facing wording for expected response times (shown in the banner). */
export const RESPONSE_COPY: Record<string, string> = {
  "Reply within 1 working day": "The care team usually replies within 1 working day (Mon–Sat).",
  "Reply within 2 working days": "The care team usually replies within 2 working days (Mon–Sat).",
  "Care team · same day": "Care-team thread — same-day response expected.",
  Internal: "Internal staff thread — not visible to patients.",
};

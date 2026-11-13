/**
 * Synthetic activity history for the shared TASKS fixtures (src/data/care.ts).
 * Each task gets its creation event plus, for a few, what happened since — so the detail
 * drawer shows a believable trail. Times are IST; "now" is Fri 13 Nov 2026, 09:40.
 */
export type ActivityKind = "created" | "status" | "reassigned" | "due" | "priority" | "comment" | "note";

export interface TaskActivity {
  id: string;
  at: string;
  actorId: string;
  kind: ActivityKind;
  text: string;
}

const at = (day: number, hhmm: string, month = 11) => `2026-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}T${hhmm}:00+05:30`;

export const TASK_HISTORY: Record<string, TaskActivity[]> = {
  t1: [
    { id: "t1-a", at: at(12, "18:15"), actorId: "s-sneha", kind: "note", text: "Lipid profile arrived from Anand Diagnostics — reported 11 Nov, uploaded 12 Nov." },
    { id: "t1-b", at: at(12, "18:20"), actorId: "s-sneha", kind: "created", text: "Routed to Dr. Ananya Rao for review (front desk can't open clinical content)." },
  ],
  t2: [
    { id: "t2-a", at: at(4, "10:05"), actorId: "s-ananya", kind: "created", text: "Consultation note saved as a draft — not yet signed." },
    { id: "t2-b", at: at(12, "17:40"), actorId: "s-ananya", kind: "status", text: "Started — reviewing medication changes before signing." },
  ],
  t3: [
    { id: "t3-a", at: at(13, "07:48"), actorId: "s-kavya", kind: "note", text: "Light-headed during the standing balance sequence (Sunrise Cardiac Rehab Flow). Session paused; recovered seated in 4 min. HR 104 after rest." },
    { id: "t3-b", at: at(13, "07:52"), actorId: "s-kavya", kind: "created", text: "Escalated for clinical review — observation only, no interpretation." },
    { id: "t3-c", at: at(13, "08:01"), actorId: "s-farhan", kind: "comment", text: "He's booked with Dr. Rao at 15:00 today — flagged at check-in." },
  ],
  t4: [{ id: "t4-a", at: at(13, "09:20"), actorId: "s-meera", kind: "created", text: "No-show at the 09:00 nutrition review and not rebooked." }],
  t5: [{ id: "t5-a", at: at(11, "12:30"), actorId: "s-ananya", kind: "created", text: "Referral sent: post-MI nutrition plan, triglycerides 260 mg/dL." }],
  t6: [
    { id: "t6-a", at: at(13, "08:44"), actorId: "s-sana", kind: "note", text: "SpO₂ floor raised to 92% after spirometry." },
    { id: "t6-b", at: at(13, "08:45"), actorId: "s-sana", kind: "created", text: "Instructor to confirm adapted breathwork before the 17:00 session." },
    { id: "t6-c", at: at(13, "08:58"), actorId: "s-lakshmi", kind: "status", text: "Blocked — needs written confirmation; Dr. Qureshi is on leave until 18 Nov." },
  ],
  t7: [{ id: "t7-a", at: at(13, "08:30"), actorId: "s-sneha", kind: "created", text: "Intake form incomplete for the 14:00 new consultation." }],
  t8: [{ id: "t8-a", at: at(12, "17:00"), actorId: "s-meera", kind: "created", text: "Age on file is 19 — confirm whether guardian consent is still needed for the programme." }],
  t9: [{ id: "t9-a", at: at(13, "08:56"), actorId: "s-sneha", kind: "created", text: "New registration shares a phone number with an existing patient. Not merged automatically." }],
  t10: [
    { id: "t10-a", at: at(10, "09:00"), actorId: "s-neha", kind: "created", text: "Dr. Sana Qureshi on leave until 18 Nov — 11 active patients need cover." },
    { id: "t10-b", at: at(12, "18:40"), actorId: "s-neha", kind: "status", text: "In progress — 6 of 11 patients reassigned." },
  ],
  t11: [
    { id: "t11-a", at: at(11, "16:00"), actorId: "s-meera", kind: "created", text: "Plan v3 drafted from the PCOS template — needs individual review before publishing." },
    { id: "t11-b", at: at(12, "11:20"), actorId: "s-meera", kind: "status", text: "In progress — swapping breakfast options for Jain preferences." },
  ],
  t12: [{ id: "t12-a", at: at(12, "21:35"), actorId: "s-rohan", kind: "created", text: "6 food-log photos uploaded by the patient (self-reported)." }],
  t13: [{ id: "t13-a", at: at(12, "19:10"), actorId: "s-ananya", kind: "created", text: "From a care-team message: prepare the Heart Health cohort case discussion." }],
  t14: [{ id: "t14-a", at: at(9, "18:00", 10), actorId: "s-arjun", kind: "created", text: "Back Care programme ended — completion summary due to the patient." }],
  t15: [{ id: "t15-a", at: at(13, "08:05"), actorId: "s-sneha", kind: "created", text: "UPI callback not received — invoice stays unpaid until the gateway confirms." }],
  t16: [{ id: "t16-a", at: at(12, "10:00"), actorId: "s-neha", kind: "created", text: "Ishaan Gupta moved to HSR Layout — review which patients and sections he can still access." }],
  t17: [{ id: "t17-a", at: at(13, "08:40"), actorId: "s-meera", kind: "created", text: "Consultation outcome: 2-week follow-up to be booked before checkout." }],
  t18: [
    { id: "t18-a", at: at(10, "12:00"), actorId: "s-kavya", kind: "created", text: "Release the week 9–10 home-practice sheet." },
    { id: "t18-b", at: at(11, "08:15"), actorId: "s-kavya", kind: "status", text: "Completed — released to the patient portal." },
  ],
};

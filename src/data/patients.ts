import type { Patient } from "./types";

/**
 * Synthetic patient registry (fictional people, masked phone numbers).
 * `allergies: null` means "not recorded" — the UI must never render that as "No known allergies".
 */
export const PATIENTS: Patient[] = [
  {
    id: "p-kabir", name: "Kabir Malhotra", age: 30, sex: "Male", avatar: "/avatars/p-kabir.svg", phone: "+91 98•• ••• 214", area: "Indiranagar",
    primaryConcern: "Coronary artery disease — post-hospitalisation recovery", conditions: ["Coronary artery disease", "Nodal tachycardia", "Bronchial asthma"],
    allergies: ["Penicillin", "IV contrast dye"], program: "Heart Health · 12 weeks", status: "active",
    careTeam: { doctor: "s-ananya", nutritionist: "s-meera", yoga: "s-kavya", coordinator: "s-farhan" },
    lastVisit: "2026-11-06T10:30:00+05:30", nextAppointment: "2026-11-13T11:00:00+05:30", intakeComplete: true, abhaLinked: true, balanceDue: 0,
    registeredAt: "2024-03-12T10:00:00+05:30", branch: "indiranagar", tags: ["Cardiac", "Programme"],
  },
  {
    id: "p-aditi", name: "Aditi Sharma", age: 34, sex: "Female", avatar: "/avatars/p-aditi.svg", phone: "+91 99•• ••• 087", area: "Domlur",
    primaryConcern: "PCOS with insulin resistance", conditions: ["PCOS", "Insulin resistance"], allergies: [], program: "PCOS Care · 16 weeks", status: "active",
    careTeam: { doctor: "s-vikram", nutritionist: "s-meera", yoga: "s-lakshmi", coordinator: "s-farhan" },
    lastVisit: "2026-11-10T16:00:00+05:30", nextAppointment: "2026-11-13T12:30:00+05:30", intakeComplete: true, abhaLinked: false, balanceDue: 0,
    registeredAt: "2026-07-02T09:00:00+05:30", branch: "indiranagar", tags: ["Endocrine", "Programme"],
  },
  {
    id: "p-rajesh", name: "Rajesh Pillai", age: 58, sex: "Male", avatar: "/avatars/p-rajesh.svg", phone: "+91 97•• ••• 552", area: "HAL 2nd Stage",
    primaryConcern: "Type 2 diabetes, HbA1c 8.4%", conditions: ["Type 2 diabetes", "Hypertension"], allergies: ["Sulfa drugs"], program: "Diabetes Reset · 12 weeks", status: "needs-attention",
    careTeam: { doctor: "s-vikram", nutritionist: "s-rohan", yoga: "s-arjun", coordinator: "s-farhan" },
    lastVisit: "2026-10-21T11:15:00+05:30", nextAppointment: null, intakeComplete: true, abhaLinked: true, balanceDue: 2400,
    registeredAt: "2025-11-18T09:00:00+05:30", branch: "indiranagar", tags: ["Endocrine", "Not rebooked"],
  },
  {
    id: "p-fatima", name: "Fatima Khan", age: 42, sex: "Female", avatar: "/avatars/p-fatima.svg", phone: "+91 90•• ••• 731", area: "Koramangala",
    primaryConcern: "Chronic lower-back pain", conditions: ["Lumbar spondylosis"], allergies: null, program: "Back Care · 8 weeks", status: "active",
    careTeam: { doctor: "s-sana", yoga: "s-arjun", coordinator: "s-farhan" },
    lastVisit: "2026-11-11T18:00:00+05:30", nextAppointment: "2026-11-14T18:00:00+05:30", intakeComplete: false, abhaLinked: false, balanceDue: 0,
    registeredAt: "2026-10-05T09:00:00+05:30", branch: "hsr", tags: ["Musculoskeletal", "Intake pending"],
  },
  {
    id: "p-vivek", name: "Vivek Menon", age: 47, sex: "Male", avatar: "/avatars/p-vivek.svg", phone: "+91 98•• ••• 660", area: "Whitefield",
    primaryConcern: "Hypertension, weight management", conditions: ["Hypertension", "Obesity class I"], allergies: [], program: "Weight Management · 24 weeks", status: "active",
    careTeam: { doctor: "s-ananya", nutritionist: "s-rohan", yoga: "s-kavya", coordinator: "s-farhan" },
    lastVisit: "2026-11-04T09:30:00+05:30", nextAppointment: "2026-11-13T09:30:00+05:30", intakeComplete: true, abhaLinked: true, balanceDue: 0,
    registeredAt: "2026-05-20T09:00:00+05:30", branch: "indiranagar", tags: ["Cardiometabolic"],
  },
  {
    id: "p-ishita", name: "Ishita Banerjee", age: 29, sex: "Female", avatar: "/avatars/p-ishita.svg", phone: "+91 96•• ••• 118", area: "HSR Layout",
    primaryConcern: "Prenatal wellness, 22 weeks", conditions: ["Pregnancy — 2nd trimester", "Iron-deficiency anaemia"], allergies: ["Latex"], program: "Prenatal Care", status: "active",
    careTeam: { doctor: "s-sana", nutritionist: "s-meera", yoga: "s-lakshmi", coordinator: "s-farhan" },
    lastVisit: "2026-11-09T10:00:00+05:30", nextAppointment: "2026-11-13T08:00:00+05:30", intakeComplete: true, abhaLinked: true, balanceDue: 0,
    registeredAt: "2026-08-14T09:00:00+05:30", branch: "hsr", tags: ["Prenatal"],
  },
  {
    id: "p-arun", name: "Arun Kumar", age: 63, sex: "Male", avatar: "/avatars/p-arun.svg", phone: "+91 94•• ••• 903", area: "Jayanagar",
    primaryConcern: "Post-MI cardiac rehabilitation", conditions: ["Myocardial infarction (2026)", "Dyslipidaemia"], allergies: ["Aspirin (GI intolerance)"], program: "Heart Health · 12 weeks", status: "needs-attention",
    careTeam: { doctor: "s-ananya", nutritionist: "s-meera", yoga: "s-kavya", coordinator: "s-farhan" },
    lastVisit: "2026-10-30T12:00:00+05:30", nextAppointment: "2026-11-13T15:00:00+05:30", intakeComplete: true, abhaLinked: true, balanceDue: 1800,
    registeredAt: "2026-09-02T09:00:00+05:30", branch: "indiranagar", tags: ["Cardiac", "Missed sessions"],
  },
  {
    id: "p-priya", name: "Priya Venkatesh", age: 38, sex: "Female", avatar: "/avatars/p-priya.svg", phone: "+91 99•• ••• 420", area: "Ulsoor",
    primaryConcern: "Hypothyroidism, fatigue", conditions: ["Hypothyroidism"], allergies: [], program: null, status: "onboarding",
    careTeam: { doctor: "s-vikram" },
    lastVisit: null, nextAppointment: "2026-11-13T14:00:00+05:30", intakeComplete: false, abhaLinked: false, balanceDue: 0,
    registeredAt: "2026-11-11T09:00:00+05:30", branch: "indiranagar", tags: ["New", "Intake pending"],
  },
  {
    id: "p-mohit", name: "Mohit Agarwal", age: 26, sex: "Male", avatar: "/avatars/p-mohit.svg", phone: "+91 88•• ••• 375", area: "BTM Layout",
    primaryConcern: "Exercise-induced asthma", conditions: ["Bronchial asthma"], allergies: null, program: null, status: "active",
    careTeam: { doctor: "s-sana", yoga: "s-lakshmi" },
    lastVisit: "2026-10-15T17:30:00+05:30", nextAppointment: "2026-11-18T17:30:00+05:30", intakeComplete: true, abhaLinked: false, balanceDue: 0,
    registeredAt: "2026-04-11T09:00:00+05:30", branch: "hsr", tags: ["Respiratory"],
  },
  {
    id: "p-lakshmi-n", name: "Lakshmi Narayan", age: 71, sex: "Female", avatar: "/avatars/p-lakshmi-n.svg", phone: "+91 80•• ••• 219", area: "Malleshwaram",
    primaryConcern: "Osteoarthritis knees, fall prevention", conditions: ["Osteoarthritis (bilateral knee)", "Osteopenia"], allergies: ["Ibuprofen"], program: "Healthy Ageing", status: "active",
    careTeam: { doctor: "s-sana", nutritionist: "s-meera", yoga: "s-arjun", coordinator: "s-farhan" },
    lastVisit: "2026-11-07T09:00:00+05:30", nextAppointment: "2026-11-13T10:00:00+05:30", intakeComplete: true, abhaLinked: true, balanceDue: 0,
    registeredAt: "2025-06-23T09:00:00+05:30", branch: "indiranagar", tags: ["Musculoskeletal", "Caregiver access"],
  },
  {
    id: "p-sameer", name: "Sameer Joshi", age: 44, sex: "Male", avatar: "/avatars/p-sameer.svg", phone: "+91 99•• ••• 845", area: "Bellandur",
    primaryConcern: "Fatty liver (NAFLD), pre-diabetes", conditions: ["NAFLD grade II", "Pre-diabetes"], allergies: [], program: "Metabolic Reset · 12 weeks", status: "active",
    careTeam: { doctor: "s-vikram", nutritionist: "s-rohan", coordinator: "s-farhan" },
    lastVisit: "2026-11-12T19:00:00+05:30", nextAppointment: "2026-11-26T19:00:00+05:30", intakeComplete: true, abhaLinked: false, balanceDue: 0,
    registeredAt: "2026-08-01T09:00:00+05:30", branch: "hsr", tags: ["Metabolic"],
  },
  {
    id: "p-neelam", name: "Neelam Chaudhary", age: 52, sex: "Female", avatar: "/avatars/p-neelam.svg", phone: "+91 98•• ••• 532", area: "Indiranagar",
    primaryConcern: "Menopausal symptoms, sleep", conditions: ["Perimenopause", "Insomnia"], allergies: [], program: null, status: "active",
    careTeam: { doctor: "s-sana", yoga: "s-lakshmi" },
    lastVisit: "2026-10-28T11:00:00+05:30", nextAppointment: "2026-11-20T11:00:00+05:30", intakeComplete: true, abhaLinked: true, balanceDue: 900,
    registeredAt: "2026-02-14T09:00:00+05:30", branch: "indiranagar", tags: ["Women's health"],
  },
  {
    id: "p-tanvi", name: "Tanvi Rao", age: 19, sex: "Female", avatar: "/avatars/p-tanvi.svg", phone: "+91 70•• ••• 664", area: "Banashankari",
    primaryConcern: "Iron-deficiency anaemia, low energy", conditions: ["Iron-deficiency anaemia"], allergies: null, program: null, status: "onboarding",
    careTeam: { nutritionist: "s-meera" },
    lastVisit: null, nextAppointment: "2026-11-13T16:30:00+05:30", intakeComplete: false, abhaLinked: false, balanceDue: 0,
    registeredAt: "2026-11-12T09:00:00+05:30", branch: "indiranagar", tags: ["New", "Guardian consent"],
  },
  {
    id: "p-harish", name: "Harish Gowda", age: 55, sex: "Male", avatar: "/avatars/p-harish.svg", phone: "+91 96•• ••• 301", area: "Rajajinagar",
    primaryConcern: "Atrial fibrillation, anticoagulated", conditions: ["Atrial fibrillation"], allergies: ["Penicillin"], program: null, status: "needs-attention",
    careTeam: { doctor: "s-ananya", coordinator: "s-farhan" },
    lastVisit: "2026-09-18T10:00:00+05:30", nextAppointment: null, intakeComplete: true, abhaLinked: true, balanceDue: 3200,
    registeredAt: "2025-03-09T09:00:00+05:30", branch: "indiranagar", tags: ["Cardiac", "Overdue review"],
  },
  {
    id: "p-zoya", name: "Zoya Siddiqui", age: 31, sex: "Female", avatar: "/avatars/p-zoya.svg", phone: "+91 99•• ••• 776", area: "Frazer Town",
    primaryConcern: "Migraine with aura", conditions: ["Migraine with aura"], allergies: [], program: null, status: "active",
    careTeam: { doctor: "s-sana", yoga: "s-lakshmi" },
    lastVisit: "2026-11-03T15:00:00+05:30", nextAppointment: "2026-12-01T15:00:00+05:30", intakeComplete: true, abhaLinked: false, balanceDue: 0,
    registeredAt: "2026-06-30T09:00:00+05:30", branch: "indiranagar", tags: ["Neurology"],
  },
  {
    id: "p-deepak", name: "Deepak Saxena", age: 49, sex: "Male", avatar: "/avatars/p-deepak.svg", phone: "+91 98•• ••• 128", area: "Electronic City",
    primaryConcern: "Cervical spondylosis, desk posture", conditions: ["Cervical spondylosis"], allergies: [], program: "Back Care · 8 weeks", status: "completed",
    careTeam: { doctor: "s-sana", yoga: "s-arjun" },
    lastVisit: "2026-10-09T18:30:00+05:30", nextAppointment: null, intakeComplete: true, abhaLinked: false, balanceDue: 0,
    registeredAt: "2026-07-21T09:00:00+05:30", branch: "hsr", tags: ["Musculoskeletal", "Programme complete"],
  },
  {
    id: "p-ananya-s", name: "Ananya Srinivasan", age: 36, sex: "Female", avatar: "/avatars/p-ananya-s.svg", phone: "+91 97•• ••• 489", area: "Sadashivanagar",
    primaryConcern: "Gestational diabetes follow-up", conditions: ["Gestational diabetes (resolved)", "Pre-diabetes"], allergies: [], program: "Diabetes Reset · 12 weeks", status: "active",
    careTeam: { doctor: "s-vikram", nutritionist: "s-meera", coordinator: "s-farhan" },
    lastVisit: "2026-11-05T12:00:00+05:30", nextAppointment: "2026-11-19T12:00:00+05:30", intakeComplete: true, abhaLinked: true, balanceDue: 0,
    registeredAt: "2026-01-10T09:00:00+05:30", branch: "indiranagar", tags: ["Endocrine"],
  },
  {
    id: "p-karthik", name: "Karthik Subramanian", age: 40, sex: "Male", avatar: "/avatars/p-karthik.svg", phone: "+91 90•• ••• 942", area: "Indiranagar",
    primaryConcern: "Stress, high resting heart rate", conditions: ["Generalised anxiety", "Sinus tachycardia"], allergies: [], program: null, status: "active",
    careTeam: { doctor: "s-ananya", yoga: "s-kavya" },
    lastVisit: "2026-11-10T08:00:00+05:30", nextAppointment: "2026-11-16T08:00:00+05:30", intakeComplete: true, abhaLinked: false, balanceDue: 0,
    registeredAt: "2026-09-27T09:00:00+05:30", branch: "indiranagar", tags: ["Cardiac", "Mind-body"],
  },
  {
    id: "p-rekha", name: "Rekha Iyengar", age: 66, sex: "Female", avatar: "/avatars/p-rekha.svg", phone: "+91 80•• ••• 573", area: "Basavanagudi",
    primaryConcern: "COPD, breathlessness on exertion", conditions: ["COPD (moderate)"], allergies: ["Codeine"], program: "Breath & Balance", status: "needs-attention",
    careTeam: { doctor: "s-sana", yoga: "s-lakshmi", coordinator: "s-farhan" },
    lastVisit: "2026-10-24T10:30:00+05:30", nextAppointment: "2026-11-13T17:00:00+05:30", intakeComplete: true, abhaLinked: true, balanceDue: 0,
    registeredAt: "2025-12-02T09:00:00+05:30", branch: "indiranagar", tags: ["Respiratory", "Guidance changed"],
  },
  {
    id: "p-nikhil", name: "Nikhil Bose", age: 33, sex: "Male", avatar: "/avatars/p-nikhil.svg", phone: "+91 98•• ••• 694", area: "HSR Layout",
    primaryConcern: "IBS, food intolerances", conditions: ["Irritable bowel syndrome"], allergies: ["Lactose (intolerance)"], program: null, status: "active",
    careTeam: { doctor: "s-vikram", nutritionist: "s-rohan" },
    lastVisit: "2026-11-08T13:00:00+05:30", nextAppointment: "2026-11-22T13:00:00+05:30", intakeComplete: true, abhaLinked: false, balanceDue: 0,
    registeredAt: "2026-03-17T09:00:00+05:30", branch: "hsr", tags: ["Gastro"],
  },
  {
    id: "p-meenakshi", name: "Meenakshi Sundaram", age: 45, sex: "Female", avatar: "/avatars/p-meenakshi.svg", phone: "+91 94•• ••• 237", area: "JP Nagar",
    primaryConcern: "Rheumatoid arthritis, morning stiffness", conditions: ["Rheumatoid arthritis"], allergies: ["Methotrexate (nausea)"], program: null, status: "active",
    careTeam: { doctor: "s-sana", nutritionist: "s-meera", yoga: "s-arjun" },
    lastVisit: "2026-10-31T09:30:00+05:30", nextAppointment: "2026-11-14T09:30:00+05:30", intakeComplete: true, abhaLinked: true, balanceDue: 1500,
    registeredAt: "2025-09-12T09:00:00+05:30", branch: "indiranagar", tags: ["Musculoskeletal"],
  },
  {
    id: "p-gaurav", name: "Gaurav Tiwari", age: 37, sex: "Male", avatar: "/avatars/p-gaurav.svg", phone: "+91 99•• ••• 051", area: "Marathahalli",
    primaryConcern: "Obesity, sleep apnoea", conditions: ["Obesity class II", "Obstructive sleep apnoea"], allergies: [], program: "Weight Management · 24 weeks", status: "active",
    careTeam: { doctor: "s-vikram", nutritionist: "s-rohan", yoga: "s-kavya", coordinator: "s-farhan" },
    lastVisit: "2026-11-10T07:30:00+05:30", nextAppointment: "2026-11-17T07:30:00+05:30", intakeComplete: true, abhaLinked: false, balanceDue: 0,
    registeredAt: "2026-06-05T09:00:00+05:30", branch: "hsr", tags: ["Cardiometabolic"],
  },
  {
    id: "p-sunita", name: "Sunita Patil", age: 59, sex: "Female", avatar: "/avatars/p-sunita.svg", phone: "+91 97•• ••• 816", area: "Yelahanka",
    primaryConcern: "Hypertension, CKD stage 2", conditions: ["Hypertension", "CKD stage 2"], allergies: ["ACE inhibitors (cough)"], program: null, status: "active",
    careTeam: { doctor: "s-ananya", nutritionist: "s-meera" },
    lastVisit: "2026-11-11T11:30:00+05:30", nextAppointment: "2026-12-04T11:30:00+05:30", intakeComplete: true, abhaLinked: true, balanceDue: 0,
    registeredAt: "2025-04-28T09:00:00+05:30", branch: "indiranagar", tags: ["Cardiometabolic", "Renal"],
  },
  {
    id: "p-kunal", name: "Kunal Mehta", age: 30, sex: "Male", avatar: "/avatars/p-kunal.svg", phone: "+91 98•• ••• 214", area: "Indiranagar",
    primaryConcern: "Palpitations — new referral", conditions: [], allergies: null, program: null, status: "onboarding",
    careTeam: {},
    lastVisit: null, nextAppointment: null, intakeComplete: false, abhaLinked: false, balanceDue: 0,
    registeredAt: "2026-11-13T08:55:00+05:30", branch: "indiranagar", tags: ["Possible duplicate", "New"],
  },
];

export const FEATURED_PATIENT_ID = "p-kabir";

export const patientById = (id: string | null | undefined) => PATIENTS.find((p) => p.id === id);

export const PATIENT_STATUS_LABEL: Record<Patient["status"], string> = {
  active: "Active",
  onboarding: "Onboarding",
  "needs-attention": "Needs attention",
  completed: "Programme complete",
};

/** Synthetic clinic number shown in the UI (kept separate from ABHA, per the plan). */
export const clinicNumber = (id: string) => {
  const idx = PATIENTS.findIndex((p) => p.id === id);
  if (idx >= 0) return `PR-${String(1040 + idx * 7).padStart(5, "0")}`;
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return `PR-${String(20000 + (h % 70000)).padStart(5, "0")}`;
};

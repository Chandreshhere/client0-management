import type { Branch, Role, Staff } from "./types";

/** Synthetic clinic staff. Names and contact details are fictional. */

export const CLINIC = {
  name: "Prana Integrative Clinic",
  shortName: "Prana",
  legal: "Prana Integrative Health Pvt. Ltd. (fictional)",
} as const;

export const BRANCHES: Branch[] = [
  { id: "indiranagar", name: "Indiranagar", city: "Bengaluru", rooms: ["Consult 1", "Consult 2", "Consult 3", "Nutrition Studio", "Yoga Hall", "Therapy Room"] },
  { id: "hsr", name: "HSR Layout", city: "Bengaluru", rooms: ["Consult A", "Consult B", "Studio", "Yoga Deck"] },
];

export const STAFF: Staff[] = [
  { id: "s-ananya", name: "Dr. Ananya Rao", role: "doctor", sex: "Female", title: "Cardiologist · Internal medicine", discipline: "medical", avatar: "/avatars/s-ananya.svg", email: "ananya.rao@prana.example", branch: "indiranagar", room: "Consult 1", status: "in-session", workingHours: "09:00 – 17:00" },
  { id: "s-vikram", name: "Dr. Vikram Iyer", role: "doctor", sex: "Male", title: "Endocrinologist", discipline: "medical", avatar: "/avatars/s-vikram.svg", email: "vikram.iyer@prana.example", branch: "indiranagar", room: "Consult 2", status: "off", workingHours: "10:00 – 18:00" },
  { id: "s-sana", name: "Dr. Sana Qureshi", role: "doctor", sex: "Female", title: "General physician", discipline: "medical", avatar: "/avatars/s-sana.svg", email: "sana.qureshi@prana.example", branch: "hsr", room: "Consult A", status: "on-leave", workingHours: "On leave until 18 Nov" },
  { id: "s-meera", name: "Meera Krishnan", role: "nutritionist", sex: "Female", title: "Clinical nutritionist", discipline: "nutrition", avatar: "/avatars/s-meera.svg", email: "meera.k@prana.example", branch: "indiranagar", room: "Nutrition Studio", status: "available", workingHours: "09:30 – 17:30" },
  { id: "s-rohan", name: "Rohan Desai", role: "nutritionist", sex: "Male", title: "Sports & metabolic nutrition", discipline: "nutrition", avatar: "/avatars/s-rohan.svg", email: "rohan.desai@prana.example", branch: "hsr", room: "Studio", status: "off", workingHours: "11:00 – 19:00" },
  { id: "s-kavya", name: "Kavya Nair", role: "yoga", sex: "Female", title: "Therapeutic yoga instructor", discipline: "movement", avatar: "/avatars/s-kavya.svg", email: "kavya.nair@prana.example", branch: "indiranagar", room: "Yoga Hall", status: "available", workingHours: "07:00 – 13:00" },
  { id: "s-arjun", name: "Arjun Bhat", role: "yoga", sex: "Male", title: "Yoga therapist · Back care", discipline: "movement", avatar: "/avatars/s-arjun.svg", email: "arjun.bhat@prana.example", branch: "hsr", room: "Yoga Deck", status: "off", workingHours: "15:00 – 20:00" },
  { id: "s-lakshmi", name: "Lakshmi Reddy", role: "yoga", sex: "Female", title: "Prenatal & breathwork", discipline: "movement", avatar: "/avatars/s-lakshmi.svg", email: "lakshmi.r@prana.example", branch: "indiranagar", room: "Therapy Room", status: "on-break", workingHours: "08:00 – 14:00" },
  { id: "s-sneha", name: "Sneha Kulkarni", role: "frontdesk", sex: "Female", title: "Front desk lead", discipline: "operations", avatar: "/avatars/s-sneha.svg", email: "sneha.k@prana.example", branch: "indiranagar", room: "Reception", status: "available", workingHours: "08:30 – 17:00" },
  { id: "s-ishaan", name: "Ishaan Gupta", role: "frontdesk", sex: "Male", title: "Front desk", discipline: "operations", avatar: "/avatars/s-ishaan.svg", email: "ishaan.g@prana.example", branch: "hsr", room: "Reception", status: "off", workingHours: "12:00 – 20:00" },
  { id: "s-farhan", name: "Farhan Sheikh", role: "coordinator", sex: "Male", title: "Care coordinator", discipline: "operations", avatar: "/avatars/s-farhan.svg", email: "farhan.s@prana.example", branch: "indiranagar", status: "available", workingHours: "09:00 – 18:00" },
  { id: "s-neha", name: "Neha Joshi", role: "admin", sex: "Female", title: "Clinic manager", discipline: "operations", avatar: "/avatars/s-neha.svg", email: "neha.joshi@prana.example", branch: "indiranagar", status: "available", workingHours: "09:00 – 18:00" },
];

export const staffById = (id: string | undefined) => STAFF.find((s) => s.id === id);

/** The demo identity shown for each workspace when switching roles. */
export const DEMO_USER: Record<Role, { personId: string; label: string; description: string }> = {
  admin: { personId: "s-neha", label: "Admin", description: "Registration, staff, services, access and clinic operations" },
  doctor: { personId: "s-ananya", label: "Doctor", description: "Consultations, notes, report review, guidance and referrals" },
  nutritionist: { personId: "s-meera", label: "Nutritionist", description: "Assessments, meal plans, food logs and adherence reviews" },
  yoga: { personId: "s-kavya", label: "Yoga instructor", description: "Classes, rosters, precautions, attendance and escalation" },
  frontdesk: { personId: "s-sneha", label: "Front desk", description: "Diary, arrivals, token queue, forms and checkout" },
  coordinator: { personId: "s-farhan", label: "Care coordinator", description: "Stalled care, referrals, follow-ups and programme progress" },
  patient: { personId: "p-kabir", label: "Patient", description: "Your appointments, plan, daily actions, records and messages" },
};

export const ROLE_ORDER: Role[] = ["doctor", "nutritionist", "yoga", "frontdesk", "coordinator", "admin", "patient"];

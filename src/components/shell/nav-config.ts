import type { Icon } from "@phosphor-icons/react";
import {
  CalendarBlank,
  ChatCircleDots,
  ClipboardText,
  Files,
  GearSix,
  House,
  ListChecks,
  ArrowsLeftRight,
  BowlFood,
  PersonSimpleTaiChi,
  Receipt,
  UsersThree,
  Users,
  Heartbeat,
  SlidersHorizontal,
} from "@phosphor-icons/react";
import type { Role } from "@/data/types";
import type { FeatureId } from "@/data/plans";
import { TASKS, REFERRALS, NOTIFICATIONS } from "@/data/care";
import { DOCUMENTS, THREADS } from "@/data/records";

/**
 * Navigation per workspace (doc §2–3: each role gets genuinely different workflows).
 * `children` render as an expandable group in the sidebar and as pill tabs in the header.
 */
export type NavLeaf = { label: string; href: string; feature?: FeatureId };
export type NavItem = { id: string; label: string; href: string; icon: Icon; badge?: number; feature?: FeatureId; children?: NavLeaf[] };
export type NavSection = { id: string; label: string; items: NavItem[] };

const openTasks = TASKS.filter((t) => t.status !== "done").length;
const pendingReferrals = REFERRALS.filter((r) => r.stage === "requested" || r.stage === "accepted").length;
const docsToReview = DOCUMENTS.filter((d) => d.status === "awaiting-review" || d.status === "unclassified").length;
const unread = THREADS.reduce((s, t) => s + t.unread, 0);

const I = {
  home: { id: "home", label: "Home", href: "/dashboard", icon: House },
  patients: { id: "patients", label: "Patients", href: "/patients", icon: Users, feature: "patients" },
  schedule: {
    id: "schedule", label: "Schedule", href: "/schedule", icon: CalendarBlank, feature: "calendar",
    children: [
      { label: "Calendar", href: "/schedule", feature: "calendar" },
      { label: "Queue", href: "/schedule/queue", feature: "queue" },
      { label: "Waitlist", href: "/schedule/waitlist", feature: "waitlist" },
    ],
  },
  tasks: { id: "tasks", label: "Tasks", href: "/tasks", icon: ListChecks, badge: openTasks, feature: "tasks" },
  referrals: { id: "referrals", label: "Referrals", href: "/referrals", icon: ArrowsLeftRight, badge: pendingReferrals, feature: "referrals" },
  documents: { id: "documents", label: "Documents", href: "/documents", icon: Files, badge: docsToReview, feature: "documents" },
  messages: { id: "messages", label: "Messages", href: "/messages", icon: ChatCircleDots, badge: unread, feature: "messages" },
  nutrition: {
    id: "nutrition", label: "Nutrition", href: "/nutrition", icon: BowlFood, feature: "nutrition",
    children: [
      { label: "Plans", href: "/nutrition" },
      { label: "Plan builder", href: "/nutrition/builder" },
      { label: "Food logs", href: "/nutrition/logs" },
    ],
  },
  classes: {
    id: "classes", label: "Classes", href: "/classes", icon: PersonSimpleTaiChi, feature: "classes",
    children: [
      { label: "This week", href: "/classes" },
      { label: "Next session roster", href: "/classes/c-breath-13" },
    ],
  },
  billing: {
    id: "billing", label: "Billing", href: "/billing", icon: Receipt, feature: "billing",
    children: [
      { label: "Invoices", href: "/billing", feature: "billing" },
      { label: "Packages", href: "/billing/packages", feature: "packages" },
    ],
  },
  team: { id: "team", label: "Team", href: "/team", icon: UsersThree, feature: "admin" },
  settings: {
    id: "settings", label: "Settings", href: "/settings", icon: GearSix,
    children: [
      { label: "General", href: "/settings" },
      { label: "Services", href: "/settings/services" },
      { label: "Access", href: "/settings/access", feature: "access" },
      { label: "Templates", href: "/settings/templates", feature: "admin" },
      { label: "Audit log", href: "/settings/audit", feature: "access" },
    ],
  },
  // patient portal
  pHome: { id: "p-home", label: "Home", href: "/dashboard", icon: House },
  pAppointments: { id: "p-appointments", label: "Appointments", href: "/portal/appointments", icon: CalendarBlank },
  pPlan: { id: "p-plan", label: "My plan", href: "/portal/plan", icon: Heartbeat },
  pRecords: { id: "p-records", label: "Records", href: "/portal/records", icon: ClipboardText },
  pMessages: { id: "p-messages", label: "Messages", href: "/messages", icon: ChatCircleDots, badge: 1 },
  pBilling: { id: "p-billing", label: "Billing", href: "/portal/billing", icon: Receipt },
  pPrefs: { id: "p-prefs", label: "Preferences", href: "/portal/preferences", icon: SlidersHorizontal },
} satisfies Record<string, NavItem>;

export const NAV: Record<Role, NavSection[]> = {
  doctor: [
    { id: "ws", label: "Workspace", items: [I.home, I.patients, I.schedule, I.tasks] },
    { id: "clinical", label: "Clinical", items: [I.documents, I.referrals, I.messages] },
    { id: "practice", label: "Practice", items: [I.billing, I.settings] },
  ],
  nutritionist: [
    { id: "ws", label: "Workspace", items: [I.home, I.patients, I.schedule, I.tasks] },
    { id: "clinical", label: "Clinical", items: [I.nutrition, I.referrals, I.messages] },
  ],
  yoga: [
    { id: "ws", label: "Workspace", items: [I.home, I.classes, I.patients, I.tasks] },
    { id: "clinical", label: "Care team", items: [I.referrals, I.messages] },
  ],
  frontdesk: [
    { id: "ws", label: "Workspace", items: [I.home, I.schedule, I.patients, I.tasks] },
    { id: "ops", label: "Operations", items: [I.documents, I.billing, I.messages] },
  ],
  coordinator: [
    { id: "ws", label: "Workspace", items: [I.home, I.patients, I.tasks, I.schedule] },
    { id: "care", label: "Care", items: [I.referrals, I.classes, I.messages] },
  ],
  admin: [
    { id: "ws", label: "Workspace", items: [I.home, I.patients, I.schedule, I.tasks] },
    { id: "ops", label: "Operations", items: [I.documents, I.billing, I.team, I.messages] },
    { id: "admin", label: "Administration", items: [I.settings] },
  ],
  patient: [
    { id: "me", label: "My care", items: [I.pHome, I.pAppointments, I.pPlan, I.pRecords] },
    { id: "contact", label: "Account", items: [I.pMessages, I.pBilling, I.pPrefs] },
  ],
};

/** Unread action-needed notifications per role (for the bell badge). */
export const unreadFor = (role: Role) => NOTIFICATIONS.filter((n) => !n.read && n.roles.includes(role)).length;

/** Header pill tabs derived from the route (deterministic → no flash on SSR). */
export function headerTabsFor(pathname: string): { items: NavLeaf[]; active: string | null; key: string } | null {
  const patient = pathname.match(/^\/patients\/([^/]+)(\/[^/]+)?/);
  if (patient && patient[1] !== "new") {
    const base = `/patients/${patient[1]}`;
    const items = [
      { label: "Overview", href: base },
      { label: "Journey", href: `${base}/journey` },
      { label: "Notes", href: `${base}/notes` },
      { label: "Documents", href: `${base}/documents` },
      { label: "Labs", href: `${base}/labs` },
      { label: "Imaging", href: `${base}/imaging` },
      { label: "Vital Signs", href: `${base}/vitals` },
    ];
    return { items, active: items.find((i) => i.href === pathname)?.href ?? base, key: "patient-tabs" };
  }
  const sections = [I.schedule, I.nutrition, I.billing, I.settings, I.classes];
  for (const s of sections) {
    if (pathname === s.href || pathname.startsWith(`${s.href}/`)) {
      const items = s.children ?? [];
      const exact = items.find((c) => c.href === pathname);
      const prefix = [...items].sort((a, b) => b.href.length - a.href.length).find((c) => pathname.startsWith(c.href));
      return { items, active: exact?.href ?? prefix?.href ?? null, key: `${s.id}-tabs` };
    }
  }
  return null;
}

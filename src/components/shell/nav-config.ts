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
import { TASKS, REFERRALS, NOTIFICATIONS, ASSIGNMENT_RETURN_HOURS, assignmentState } from "@/data/care";
import { DEMO_USER } from "@/data/staff";
import { DOCUMENTS, THREADS } from "@/data/records";
import { sectionHref, sectionLabel, sectionOfPath, sectionsFor } from "@/features/patient/profile/sections";

/**
 * Navigation per workspace (doc §2–3: each role gets genuinely different workflows).
 * `children` render as an expandable group in the sidebar and as pill tabs in the header.
 */
export type NavLeaf = { label: string; href: string; feature?: FeatureId };
export type NavItem = { id: string; label: string; href: string; icon: Icon; badge?: number; feature?: FeatureId; children?: NavLeaf[] };
export type NavSection = { id: string; label: string; items: NavItem[] };


const I = {
  home: { id: "home", label: "Home", href: "/dashboard", icon: House },
  patients: { id: "patients", label: "Patients", href: "/patients", icon: Users, feature: "patients" },
  schedule: {
    id: "schedule", label: "Schedule", href: "/schedule", icon: CalendarBlank, feature: "calendar",
    children: [
      { label: "Calendar", href: "/schedule", feature: "calendar" },
      { label: "Check-in", href: "/schedule/queue", feature: "queue" },
      { label: "Waitlist", href: "/schedule/waitlist", feature: "waitlist" },
    ],
  },
  tasks: { id: "tasks", label: "Tasks", href: "/tasks", icon: ListChecks, feature: "tasks" },
  referrals: { id: "referrals", label: "Assignments", href: "/referrals", icon: ArrowsLeftRight, feature: "referrals" },
  documents: { id: "documents", label: "Documents", href: "/documents", icon: Files, feature: "documents" },
  messages: { id: "messages", label: "Messages", href: "/messages", icon: ChatCircleDots, feature: "messages" },
  nutrition: {
    id: "nutrition", label: "Nutrition", href: "/nutrition", icon: BowlFood, feature: "nutrition",
    children: [
      { label: "Plans", href: "/nutrition", feature: "nutrition" },
      { label: "Plan builder", href: "/nutrition/builder", feature: "nutrition" },
      { label: "Food logs", href: "/nutrition/logs", feature: "self-report" },
    ],
  },
  classes: {
    id: "classes", label: "Sessions", href: "/classes", icon: PersonSimpleTaiChi, feature: "classes",
    children: [
      { label: "This week", href: "/classes", feature: "classes" },
      { label: "Next session", href: "/classes/c-breath-13", feature: "classes" },
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
  programmes: { id: "programmes", label: "Programmes", href: "/programmes", icon: Heartbeat, feature: "programmes" },
  settings: {
    id: "settings", label: "Settings", href: "/settings", icon: GearSix,
    children: [
      { label: "General", href: "/settings" },
      { label: "Services & fees", href: "/settings/services", feature: "billing" },
      { label: "Access", href: "/settings/access", feature: "access" },
      { label: "Templates", href: "/settings/templates", feature: "admin" },
      { label: "Activity log", href: "/settings/audit", feature: "audit" },
    ],
  },
  // patient app (Pro)
  pHome: { id: "p-home", label: "Home", href: "/dashboard", icon: House },
  pAppointments: { id: "p-appointments", label: "Appointments", href: "/portal/appointments", icon: CalendarBlank },
  pPlan: { id: "p-plan", label: "My plan", href: "/portal/plan", icon: Heartbeat },
  pRecords: { id: "p-records", label: "Records", href: "/portal/records", icon: ClipboardText },
  pMessages: { id: "p-messages", label: "Messages", href: "/messages", icon: ChatCircleDots, badge: 1, feature: "messages" },
  pBilling: { id: "p-billing", label: "Billing", href: "/portal/billing", icon: Receipt },
  pPrefs: { id: "p-prefs", label: "Preferences", href: "/portal/preferences", icon: SlidersHorizontal },
} satisfies Record<string, NavItem>;

/**
 * Menus per role (spec "Roles and access"): each role sees only what it acts on — billing is the
 * front office's (Reception, Admin), clinical work is the practitioners'. Items outside the current
 * plan are removed by `navFor`, never shown locked (spec rule 7: show only what's built).
 */
export const NAV: Record<Role, NavSection[]> = {
  doctor: [
    { id: "ws", label: "Workspace", items: [I.home, I.patients, I.schedule, I.tasks] },
    { id: "clinical", label: "Clinical", items: [I.documents, I.referrals, I.messages] },
    { id: "practice", label: "Practice", items: [I.settings] },
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
    { id: "care", label: "Care", items: [I.referrals, I.programmes, I.classes, I.messages] },
  ],
  admin: [
    { id: "ws", label: "Workspace", items: [I.home, I.patients, I.documents] },
    { id: "ops", label: "Operations", items: [I.schedule, I.billing, I.team] },
    { id: "admin", label: "Administration", items: [I.settings] },
  ],
  patient: [
    { id: "me", label: "My care", items: [I.pHome, I.pAppointments, I.pPlan, I.pRecords] },
    { id: "contact", label: "Account", items: [I.pMessages, I.pBilling, I.pPrefs] },
  ],
};

/**
 * Badges count only what is waiting for this person (spec rule 2: one owner per item) — their own
 * open tasks, assignments they haven't opened (or, for a doctor, ones that came back unseen after
 * 48 h), reports they review, and unread threads they take part in.
 */
function badgeFor(id: string, role: Role): number | undefined {
  const me = DEMO_USER[role].personId;
  const hours = (iso: string) => (Date.parse("2026-11-13T09:40:00+05:30") - Date.parse(iso)) / 3_600_000;
  switch (id) {
    case "tasks":
      return TASKS.filter((t) => t.status !== "done" && t.ownerId === me).length || undefined;
    case "referrals":
      return (
        REFERRALS.filter((r) => assignmentState(r) === "assigned" && (role === "doctor" ? r.fromId === me && hours(r.requestedAt) >= ASSIGNMENT_RETURN_HOURS : role === "coordinator" ? hours(r.requestedAt) >= ASSIGNMENT_RETURN_HOURS : r.toId === me)).length ||
        undefined
      );
    case "documents":
      if (role === "doctor") return DOCUMENTS.filter((d) => d.status === "awaiting-review" && d.reviewerId === me).length || undefined;
      if (role === "admin" || role === "frontdesk") return DOCUMENTS.filter((d) => d.status === "unclassified").length || undefined;
      return undefined;
    case "messages":
      return THREADS.filter((t) => role === "coordinator" || t.participants.includes(me)).reduce((n, t) => n + t.unread, 0) || undefined;
    default:
      return undefined;
  }
}

/**
 * The role's menu for the current plan: items and sub-items whose feature the plan doesn't include
 * are dropped; a group left with one child becomes a plain link to it; empty sections disappear.
 */
export function navFor(role: Role, has: (f: FeatureId) => boolean): NavSection[] {
  return NAV[role]
    .map((section) => ({
      ...section,
      items: section.items.flatMap((raw): NavItem[] => {
        const item = role === "patient" || !["tasks", "referrals", "documents", "messages"].includes(raw.id) ? raw : { ...raw, badge: badgeFor(raw.id, role) };
        if (item.feature && !has(item.feature)) return [];
        if (!item.children) return [item];
        const children = item.children.filter((c) => !c.feature || has(c.feature));
        if (children.length === 0) return [];
        if (children.length === 1) return [{ ...item, href: children[0].href, children: undefined }];
        return [{ ...item, children }];
      }),
    }))
    .filter((section) => section.items.length > 0);
}

/** Unread action-needed notifications per role (for the bell badge). */
export const unreadFor = (role: Role, has: (f: FeatureId) => boolean = () => true) => NOTIFICATIONS.filter((n) => !n.read && n.roles.includes(role) && (!n.feature || has(n.feature))).length;

/** Header pill tabs derived from the route (deterministic → no flash on SSR). */
export function headerTabsFor(pathname: string, has: (f: FeatureId) => boolean = () => true, role?: Role): { items: NavLeaf[]; active: string | null; key: string } | null {
  const patient = pathname.match(/^\/patients\/([^/]+)(\/[^/]+)?/);
  if (patient && patient[1] !== "new") {
    // The five-section profile + Timeline, only the sections this role sees (Admin and Reception:
    // Profile and Documents). Without a role (older callers) every section is listed; the pages
    // themselves redirect a role away from sections it doesn't see.
    const items = sectionsFor(role, has).map((id) => ({ label: sectionLabel(role, id), href: sectionHref(patient[1], id) }));
    const current = sectionOfPath(pathname);
    return { items, active: current ? sectionHref(patient[1], current) : null, key: "patient-tabs" };
  }
  const sections = [I.schedule, I.nutrition, I.billing, I.settings, I.classes];
  for (const s of sections) {
    if (pathname === s.href || pathname.startsWith(`${s.href}/`)) {
      const items = (s.children ?? []).filter((c: NavLeaf) => !c.feature || has(c.feature));
      if (items.length < 2) return null;
      const exact = items.find((c) => c.href === pathname);
      const prefix = [...items].sort((a, b) => b.href.length - a.href.length).find((c) => pathname.startsWith(c.href));
      return { items, active: exact?.href ?? prefix?.href ?? null, key: `${s.id}-tabs` };
    }
  }
  return null;
}

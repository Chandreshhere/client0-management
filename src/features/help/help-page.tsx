"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import {
  ArrowUpRight,
  Buildings,
  CaretDown,
  Check,
  Clock,
  Database,
  Image as ImageIcon,
  Keyboard,
  Plug,
  Swap,
  Tag,
  Users,
} from "@phosphor-icons/react";
import type { Role } from "@/data/types";
import { BRANCHES, CLINIC, DEMO_USER, ROLE_ORDER, STAFF, staffById } from "@/data/staff";
import { PATIENTS, patientById } from "@/data/patients";
import { WEEK_APPOINTMENTS } from "@/data/appointments";
import { TASKS } from "@/data/care";
import { DOCUMENTS } from "@/data/records";
import { FEATURES, FEATURE_GROUPS, PLANS, addedFeatures, featureById, monthlyCost, planById, type PlanId } from "@/data/plans";
import { TODAY, formatDayLabel, formatINR, formatTime } from "@/lib/format";
import { cn } from "@/lib/cn";
import { useRole } from "@/components/shell/role-context";
import { LockBadge, priceLine } from "@/components/shell/plan-switcher";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Group, GroupHeader, Inset, SectionTitle } from "@/components/ui/card";
import { DemoFlag, Kbd, PageHeader } from "@/components/ui/misc";
import { Dropdown, DropdownContent, DropdownLabel, DropdownRadioGroup, DropdownRadioItem, DropdownTrigger } from "@/components/ui/dropdown";
import { StatusBadge, type Tone } from "@/components/ui/status";
import { Tip } from "@/components/ui/tooltip";
import { useToast } from "@/components/ui/toast";
import { ReadingVisuals } from "./reading-visuals";

/** /help — shortcuts, how the demo works (roles × plans), how to read the visuals, what is synthetic, links. */

type ShortcutId = "search" | "sidebar" | "slash" | "escape" | "navigate" | "tab";

const SHORTCUTS: { id: ShortcutId; keys: ReactNode; does: string }[] = [
  {
    id: "search",
    keys: (
      <>
        <Kbd>⌘</Kbd>
        <Kbd>K</Kbd>
        <span className="px-1 text-xs text-muted">or</span>
        <Kbd>Ctrl</Kbd>
        <Kbd>K</Kbd>
      </>
    ),
    does: "Search patients, pages and actions — or switch workspace",
  },
  {
    id: "sidebar",
    keys: (
      <>
        <Kbd>⌘</Kbd>
        <Kbd>B</Kbd>
        <span className="px-1 text-xs text-muted">or</span>
        <Kbd>Ctrl</Kbd>
        <Kbd>B</Kbd>
      </>
    ),
    does: "Collapse or expand the sidebar",
  },
  { id: "slash", keys: <Kbd>/</Kbd>, does: "Open search when you're not typing in a field" },
  { id: "escape", keys: <Kbd>Esc</Kbd>, does: "Close menus, dialogs and drawers — focus returns to where you were" },
  {
    id: "navigate",
    keys: (
      <>
        <Kbd>↑</Kbd>
        <Kbd>↓</Kbd>
        <Kbd>↵</Kbd>
      </>
    ),
    does: "Move through search results and menus, then open",
  },
  {
    id: "tab",
    keys: (
      <>
        <Kbd>Tab</Kbd>
        <Kbd>⇧ Tab</Kbd>
      </>
    ),
    does: "Move between controls — focus is always visible",
  },
];

const STATES: { tone: Tone; label: string; meaning: string }[] = [
  { tone: "draft", label: "Draft", meaning: "Saved but not signed; still editable." },
  { tone: "neutral", label: "Saving", meaning: "Being written — wait before leaving." },
  { tone: "success", label: "Saved", meaning: "Stored. In this demo: in your browser session." },
  { tone: "warning", label: "Awaiting review", meaning: "A clinician must review it before it counts." },
  { tone: "success", label: "Signed", meaning: "Locked. Corrections become attributed addenda." },
  { tone: "info", label: "Released", meaning: "Published to the patient portal." },
  { tone: "danger", label: "Failed", meaning: "Didn't go through — nothing was sent or charged." },
  { tone: "warning", label: "Needs attention", meaning: "Someone has to act on it." },
  { tone: "neutral", label: "Self-reported", meaning: "Entered by the patient; not yet verified." },
];

const TOUR: { role: Role; tip: string }[] = [
  { role: "doctor", tip: "open Kabir Malhotra's care map and today's report reviews." },
  { role: "frontdesk", tip: "register a patient while booking; watch the duplicate check." },
  { role: "coordinator", tip: "find care that has stalled — referrals nobody accepted." },
];

const LINKS: { href: string; label: string; detail: string }[] = [
  { href: "/patients/p-kabir", label: "Featured patient", detail: "Kabir Malhotra — hand-written care map and timeline" },
  { href: "/patients/p-kabir/journey", label: "Care journey", detail: "Documented links between events, by who acted" },
  { href: "/patients?view=browse", label: "Browse patients", detail: "Organ, body-system shares, readings and care team" },
  { href: "/patients?new=1", label: "Register a patient", detail: "Duplicate checks and booking in one form" },
  { href: "/patients", label: "Patient registry", detail: "Search, filters, saved views" },
  { href: "/schedule", label: "Schedule", detail: "Today's diary, Fri 13 Nov" },
  { href: "/tasks", label: "Tasks", detail: "Follow-ups with owners and due dates" },
  { href: "/pricing", label: "Compare plans", detail: "Pricing and the full feature list" },
];

function personFor(role: Role) {
  const id = DEMO_USER[role].personId;
  if (role === "patient") {
    const p = patientById(id);
    return p ? { name: p.name, title: "Patient", avatar: p.avatar } : null;
  }
  const s = staffById(id);
  return s ? { name: s.name, title: s.title, avatar: s.avatar } : null;
}

export function HelpPage() {
  const { role, setRole, plan, setPlan, user } = useRole();
  const { toast } = useToast();
  const details = planById(plan);
  const [pressed, setPressed] = useState<ShortcutId | null>(null);

  // Echo shortcuts as they're pressed (the shell performs the actual action).
  useEffect(() => {
    let timer = 0;
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      const k = e.key.toLowerCase();
      const id: ShortcutId | null =
        mod && k === "k" ? "search" : mod && k === "b" ? "sidebar" : !mod && e.key === "/" ? "slash" : e.key === "Escape" ? "escape" : e.key === "ArrowUp" || e.key === "ArrowDown" ? "navigate" : e.key === "Tab" ? "tab" : null;
      if (!id) return;
      setPressed(id);
      window.clearTimeout(timer);
      timer = window.setTimeout(() => setPressed(null), 1600);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.clearTimeout(timer);
    };
  }, []);

  const changePlan = (id: PlanId) => {
    if (id === plan) return;
    setPlan(id);
    const p = planById(id);
    toast({ title: `Demo switched to ${p.name}`, description: `Features and roles re-gated instantly. ${p.roles.length} ${p.roles.length === 1 ? "role" : "roles"} available. Nothing was billed.`, tone: "success" });
  };

  return (
    <div className="@container flex flex-col gap-10 pb-16">
      <PageHeader
        eyebrow={<DemoFlag />}
        title="Help & shortcuts"
        description="How this Carelane prototype works — the seven workspaces, what each plan unlocks, the keyboard shortcuts — and exactly what is synthetic."
      />

      {/* Session focal + shortcuts */}
      <div className="grid grid-cols-1 items-start gap-6 @[960px]:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)]">
        <section aria-labelledby="session-title" className="relative flex min-h-[304px] flex-col overflow-hidden rounded-card bg-primary p-6 text-white">
          <Rings />
          <span className="relative inline-flex h-8 w-fit items-center rounded-full px-3 text-xs text-white/90 shadow-[inset_0_0_0_1px_rgb(255_255_255/0.35)]">Your demo session</span>
          <div className="relative mt-6 flex items-center gap-4">
            <Avatar src={user.avatar} name={user.name} size="xl" className="ring-2 ring-white/30" />
            <div className="min-w-0">
              <h2 id="session-title" className="truncate text-title font-normal">
                {user.name}
              </h2>
              <p className="mt-1 text-sm text-white/80">
                {DEMO_USER[role].label} workspace · {details.name} plan
              </p>
            </div>
          </div>
          <p className="relative mt-4 max-w-[44ch] text-sm text-white/80">{DEMO_USER[role].description}.</p>
          <div className="relative mt-auto flex flex-wrap gap-2 pt-6">
            <Dropdown>
              <DropdownTrigger asChild>
                <Button variant="glass" trailing={<CaretDown />}>
                  Plan: {details.name}
                </Button>
              </DropdownTrigger>
              <DropdownContent align="start" className="w-[300px]">
                <DropdownLabel>Demo plan — re-gates features instantly</DropdownLabel>
                <DropdownRadioGroup value={plan} onValueChange={(v) => changePlan(v as PlanId)}>
                  {PLANS.map((p) => (
                    <DropdownRadioItem key={p.id} value={p.id} description={`${priceLine(p.id)} · ${p.usersLabel}`}>
                      {p.name}
                    </DropdownRadioItem>
                  ))}
                </DropdownRadioGroup>
              </DropdownContent>
            </Dropdown>
            <Button asChild variant="glass">
              <Link href="/dashboard">
                Open my home
                <ArrowUpRight aria-hidden="true" />
              </Link>
            </Button>
          </div>
        </section>

        <Group>
          <GroupHeader icon={<Keyboard />} title="Keyboard shortcuts" subtitle="Press one — it lights up here" />
          <ul className="flex flex-col gap-2">
            {SHORTCUTS.map((s) => (
              <li key={s.id}>
                <Inset className={cn("flex flex-wrap items-center justify-between gap-3 py-3 transition-colors duration-300", pressed === s.id && "bg-primary-soft")}>
                  <span className="text-sm text-ink">{s.does}</span>
                  <span className="flex items-center gap-1">
                    {s.keys}
                    {pressed === s.id ? <span className="ml-2 text-xs text-primary-ink" aria-live="polite">Pressed</span> : null}
                  </span>
                </Inset>
              </li>
            ))}
          </ul>
          <p className="px-2 pb-1 pt-3 text-xs text-muted">On phones the sidebar is a drawer — tap the menu button at the top left.</p>
        </Group>
      </div>

      {/* Roles */}
      <section aria-labelledby="roles-title" className="flex flex-col gap-4">
        <SectionTitle
          as="h2"
          title={<span id="roles-title">Seven workspaces, one patient record</span>}
          description="Each role gets its own home and navigation over the same shared record. The role switcher is a demo convenience — in production access comes from a verified login and is checked on the server."
        />
        <ul className="grid grid-cols-1 gap-4 @[640px]:grid-cols-2 @[1040px]:grid-cols-4">
          {ROLE_ORDER.map((r) => {
            const person = personFor(r);
            const allowed = details.roles.includes(r);
            const firstPlan = PLANS.find((p) => p.roles.includes(r));
            const current = r === role;
            return (
              <li key={r}>
                <article className="flex h-full flex-col rounded-card bg-sunken p-2">
                  <div className="flex flex-1 flex-col rounded-inner bg-surface p-4">
                    <div className="flex items-center gap-3">
                      {person ? <Avatar src={person.avatar} name={person.name} size="md" /> : null}
                      <div className="min-w-0">
                        <h3 className="text-sm font-medium text-ink">{DEMO_USER[r].label}</h3>
                        <p className="truncate text-xs text-muted">{person ? `${person.name} · ${person.title}` : ""}</p>
                      </div>
                    </div>
                    <p className="mt-3 text-sm text-ink-2">{DEMO_USER[r].description}.</p>
                    <p className="mt-auto flex flex-wrap gap-1 pt-4">
                      {PLANS.map((p) => (
                        <span
                          key={p.id}
                          className={cn(
                            "inline-flex h-6 items-center gap-1 rounded-full px-2 text-xs",
                            p.roles.includes(r) ? "bg-sunken text-ink-2" : "text-faint shadow-[inset_0_0_0_1px_var(--color-line)]",
                          )}
                        >
                          {p.roles.includes(r) ? <Check size={12} weight="bold" aria-hidden="true" /> : null}
                          {p.name}
                          <span className="sr-only">{p.roles.includes(r) ? " — included" : " — not included"}</span>
                        </span>
                      ))}
                    </p>
                  </div>
                  <div className="flex items-center justify-between gap-2 px-2 pb-1 pt-3">
                    {current ? (
                      <StatusBadge tone="dark">You are here</StatusBadge>
                    ) : allowed ? (
                      <Button size="sm" variant="secondary" leading={<Swap />} onClick={() => setRole(r)}>
                        Switch to {DEMO_USER[r].label.toLowerCase()}
                      </Button>
                    ) : (
                      <Tip label={`Switch the demo to the ${firstPlan?.name ?? "Clinic"} plan first`}>
                        <span tabIndex={0} aria-disabled="true" className="inline-flex h-8 cursor-not-allowed items-center gap-1.5 rounded-full px-3 text-xs text-muted shadow-[inset_0_0_0_1px_var(--color-line-strong)] outline-none focus-visible:outline-2 focus-visible:outline-primary">
                          <LockBadge />
                          Needs {firstPlan?.name ?? "Clinic"} plan
                        </span>
                      </Tip>
                    )}
                  </div>
                </article>
              </li>
            );
          })}
          <li className="@[640px]:col-span-2 @[1040px]:col-span-1">
            <article className="flex h-full flex-col rounded-card bg-surface p-4 shadow-[inset_0_0_0_1px_var(--color-line)]">
              <h3 className="text-sm font-medium text-ink">Where to start</h3>
              <ul className="mt-3 flex flex-col gap-3 text-sm text-ink-2">
                {TOUR.map((t) => (
                  <li key={t.role}>
                    <span className="text-ink">{DEMO_USER[t.role].label}</span> — {t.tip}
                  </li>
                ))}
              </ul>
            </article>
          </li>
        </ul>
      </section>

      {/* What the organs, percentages, lines and marks mean · the Journey tab */}
      <ReadingVisuals />

      {/* Plans */}
      <section aria-labelledby="plans-title" className="flex flex-col gap-4">
        <SectionTitle
          as="h2"
          title={<span id="plans-title">Plans and what each unlocks</span>}
          description="Read straight from the plan catalogue. Switching a plan here re-gates pages, menus and buttons across the demo — locked items say which plan they need."
        />
        <div className="grid grid-cols-1 gap-4 @[960px]:grid-cols-3">
          {PLANS.map((p) => {
            const current = p.id === plan;
            const added = addedFeatures(p).map((f) => featureById(f).label);
            const example = p.pricing.kind === "per-user" ? monthlyCost(p, p.pricing.maxUsers) : null;
            return (
              <article key={p.id} className="flex flex-col rounded-card bg-surface p-6">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-xl font-light tracking-[-0.01em] text-ink">{p.name}</h3>
                  {current ? <StatusBadge tone="dark">Current demo plan</StatusBadge> : null}
                </div>
                <p className="mt-1 text-sm text-muted">{p.audience}</p>
                <p className="mt-6 text-[28px] font-light leading-none tracking-[-0.02em] text-ink tabular">{priceLine(p.id)}</p>
                <p className="mt-2 text-xs text-muted">
                  {formatINR(p.setupFee)} one-time setup · {p.usersLabel}
                  {example !== null && p.pricing.kind === "per-user" ? ` · ${p.pricing.maxUsers} users = ${formatINR(example)} / month` : ""}
                </p>
                <h4 className="mt-6 text-xs text-muted">{p.includesPrevious ? `Everything in ${planById(p.includesPrevious).name}, plus` : "Includes"}</h4>
                <ul className="mt-2 flex flex-col gap-1.5">
                  {added.map((label) => (
                    <li key={label} className="flex items-start gap-2 text-sm text-ink-2">
                      <Check size={16} className="mt-0.5 shrink-0 text-ink" aria-hidden="true" />
                      {label}
                    </li>
                  ))}
                </ul>
                <p className="mt-4 text-xs text-muted">Roles: {p.roles.map((r) => DEMO_USER[r].label).join(", ")}</p>
                <div className="mt-auto pt-6">
                  <Button variant={current ? "soft" : "secondary"} disabled={current} onClick={() => changePlan(p.id)} className="w-full">
                    {current ? "In use in this demo" : `Use ${p.name} in the demo`}
                  </Button>
                </div>
              </article>
            );
          })}
        </div>
        <FeatureMatrix current={plan} />
      </section>

      {/* Synthetic · states · links */}
      <div className="grid grid-cols-1 items-start gap-6 @[1080px]:grid-cols-3">
        <Group>
          <GroupHeader icon={<Database />} title="What is synthetic" subtitle="Everything — here is exactly how" />
          <ul className="flex flex-col gap-2">
            <Fact icon={<Users size={18} />} title={`${PATIENTS.length} patients, ${STAFF.length} staff`}>
              Fictional people with illustrated avatars. Phone numbers are masked and never complete.
            </Fact>
            <Fact icon={<Buildings size={18} />} title={CLINIC.name}>
              {CLINIC.legal} with {BRANCHES.length} branches: {BRANCHES.map((b) => b.name).join(" and ")}.
            </Fact>
            <Fact icon={<Clock size={18} />} title={`Today is ${formatDayLabel(TODAY.toISOString())}, ${formatTime(TODAY.toISOString())} IST`}>
              The clock is fixed so the diary ({WEEK_APPOINTMENTS.length} appointments this week), {TASKS.length} tasks and {DOCUMENTS.length} documents always look current.
            </Fact>
            <Fact icon={<Database size={18} />} title="No backend">
              Registrations, care-team changes and drafts are kept in this browser session only. Close the tab and they&apos;re gone.
            </Fact>
            <Fact icon={<Plug size={18} />} title="Nothing is connected">
              Payments, SMS and WhatsApp, email, lab partners and ABDM are not wired up — so Carelane never shows a payment, delivery or signature as successful.
            </Fact>
            <Fact icon={<ImageIcon size={18} />} title="Illustrative images">
              Scans and organ renders are illustrations, not diagnostic images. Which organ appears follows the patient&apos;s recorded conditions.
            </Fact>
          </ul>
        </Group>

        <Group>
          <GroupHeader icon={<Tag />} title="States you'll see" subtitle="Visible, never implied" />
          <Inset className="py-2">
            <dl className="divide-y divide-line">
              {STATES.map((s) => (
                <div key={s.label} className="flex items-start gap-3 py-3">
                  <dt className="w-[132px] shrink-0">
                    <StatusBadge tone={s.tone}>{s.label}</StatusBadge>
                  </dt>
                  <dd className="text-sm text-ink-2">{s.meaning}</dd>
                </div>
              ))}
            </dl>
          </Inset>
          <p className="px-2 pb-1 pt-3 text-xs text-muted">An empty allergy list is never shown as “no known allergies” unless someone confirmed it.</p>
        </Group>

        <Group>
          <GroupHeader icon={<ArrowUpRight />} title="Good places to start" subtitle="Each opens in this tab" />
          <ul className="flex flex-col gap-2">
            {LINKS.map((l) => (
              <li key={l.href}>
                <Link href={l.href} className="group flex items-center gap-3 rounded-inner bg-surface p-4 transition-colors hover:bg-canvas">
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm text-ink">{l.label}</span>
                    <span className="block truncate text-xs text-muted">{l.detail}</span>
                  </span>
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-canvas text-ink transition-[background-color,transform] group-hover:scale-105 group-hover:bg-surface" aria-hidden="true">
                    <ArrowUpRight size={18} />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Group>
      </div>
    </div>
  );
}

function Fact({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <li>
      <Inset className="flex items-start gap-3">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-sunken text-ink-2" aria-hidden="true">
          {icon}
        </span>
        <div className="min-w-0">
          <p className="text-sm text-ink">{title}</p>
          <p className="mt-0.5 text-xs text-muted">{children}</p>
        </div>
      </Inset>
    </li>
  );
}

/** Plan × feature matrix, grouped like the catalogue. Current plan column is marked. */
function FeatureMatrix({ current }: { current: PlanId }) {
  return (
    <div className="overflow-hidden rounded-card bg-surface">
      {/* relative: keeps absolutely-positioned sr-only text inside the scroller (no page overflow) */}
      <div data-lenis-prevent className="scrollbar-thin relative overflow-x-auto">
        <table className="w-full border-separate border-spacing-0 text-sm">
          <caption className="sr-only">Features included in each plan</caption>
          <thead>
            <tr>
              <th scope="col" className="h-12 px-4 text-left text-xs font-normal text-muted shadow-[inset_0_-1px_0_var(--color-line)] @[640px]:px-6">
                Feature
              </th>
              {PLANS.map((p) => (
                <th key={p.id} scope="col" className="h-12 w-[68px] px-1 text-center text-xs font-normal shadow-[inset_0_-1px_0_var(--color-line)] @[640px]:w-[112px] @[640px]:px-3">
                  <span className={cn("inline-flex h-7 items-center rounded-full px-2.5 @[640px]:px-3", p.id === current ? "bg-charcoal text-white" : "text-muted")}>
                    {p.name}
                    {p.id === current ? <span className="sr-only"> (current)</span> : null}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          {FEATURE_GROUPS.map((g) => (
            <tbody key={g}>
              <tr>
                <th scope="colgroup" colSpan={PLANS.length + 1} className="bg-canvas px-4 py-2 text-left text-xs font-normal text-muted @[640px]:px-6">
                  {g}
                </th>
              </tr>
              {FEATURES.filter((f) => f.group === g).map((f) => (
                <tr key={f.id} className="transition-colors hover:bg-canvas">
                  <th scope="row" className="px-4 py-3 text-left font-normal shadow-[inset_0_-1px_0_var(--color-line)] @[640px]:px-6">
                    <span className="block text-sm text-ink">{f.label}</span>
                    <span className="hidden text-xs text-muted @[640px]:block">{f.description}</span>
                  </th>
                  {PLANS.map((p) => {
                    const yes = p.features.includes(f.id);
                    return (
                      <td key={p.id} className={cn("px-1 py-3 text-center shadow-[inset_0_-1px_0_var(--color-line)] @[640px]:px-3", p.id === current && "bg-canvas/60")}>
                        {yes ? (
                          <>
                            <Check size={18} weight="bold" className="mx-auto text-ink" aria-hidden="true" />
                            <span className="sr-only">Included</span>
                          </>
                        ) : (
                          <>
                            <span className="text-faint" aria-hidden="true">—</span>
                            <span className="sr-only">Not included</span>
                          </>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          ))}
        </table>
      </div>
    </div>
  );
}

/** Decorative concentric rings for the cobalt card (aria-hidden). */
function Rings() {
  return (
    <svg viewBox="0 0 200 200" className="pointer-events-none absolute -bottom-16 -right-16 size-[260px] text-white" aria-hidden="true">
      {[96, 76, 56, 36].map((r, i) => (
        <circle key={r} cx="100" cy="100" r={r} fill="none" stroke="currentColor" strokeOpacity={0.08 + i * 0.04} />
      ))}
    </svg>
  );
}

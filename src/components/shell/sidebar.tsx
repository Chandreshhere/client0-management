"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { CaretDown, MapPin, SidebarSimple, Check, Question } from "@phosphor-icons/react";
import { cn } from "@/lib/cn";
import { snappy, spring } from "@/lib/motion";
import { BRANCHES } from "@/data/staff";
import { PATIENTS } from "@/data/patients";
import { useRole } from "./role-context";
import { navFor, type NavItem } from "./nav-config";
import { Tip } from "@/components/ui/tooltip";
import { Avatar } from "@/components/ui/avatar";
import { Dropdown, DropdownContent, DropdownItem, DropdownLabel, DropdownTrigger } from "@/components/ui/dropdown";
import { Logo } from "./logo";
import { DemoLoginCard, LockBadge } from "./plan-switcher";
import { minPlanFor } from "@/data/plans";

export const SIDEBAR_EXPANDED = 248;
export const SIDEBAR_COLLAPSED = 82;

function isActive(pathname: string, href: string) {
  if (href === "/dashboard") return pathname === "/dashboard";
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Desktop sidebar: a floating white rail that collapses to 82px. */
export function Sidebar() {
  const { sidebarCollapsed: collapsed, setSidebarCollapsed } = useRole();
  const reduce = useReducedMotion();
  return (
    <motion.aside
      aria-label="Primary"
      initial={false}
      animate={{ width: collapsed ? SIDEBAR_COLLAPSED : SIDEBAR_EXPANDED }}
      transition={reduce ? { duration: 0 } : spring}
      className="sticky top-0 z-30 hidden h-dvh shrink-0 p-4 pr-0 lg:block"
      style={{ width: collapsed ? SIDEBAR_COLLAPSED : SIDEBAR_EXPANDED }}
    >
      <div className="flex h-full flex-col overflow-hidden rounded-card bg-surface">
        <div className={cn("flex h-[72px] shrink-0 items-center short:h-14", collapsed ? "justify-center px-2" : "justify-between pl-6 pr-3")}>
          <Logo collapsed={collapsed} />
          {!collapsed ? (
            <Tip label="Collapse sidebar" shortcut="⌘B" side="right">
              <button
                type="button"
                onClick={() => setSidebarCollapsed(true)}
                aria-label="Collapse sidebar"
                aria-expanded="true"
                className="flex size-10 items-center justify-center rounded-full text-muted transition-colors hover:bg-sunken hover:text-ink"
              >
                <SidebarSimple size={20} />
              </button>
            </Tip>
          ) : null}
        </div>
        <NavBody collapsed={collapsed} />
        <div className={cn("shrink-0 border-t border-line p-3", collapsed && "flex flex-col items-center gap-2 px-2")}>
          {collapsed ? <DemoLoginCard collapsed /> : null}
          {collapsed ? (
            <Tip label="Expand sidebar" shortcut="⌘B" side="right">
              <button
                type="button"
                onClick={() => setSidebarCollapsed(false)}
                aria-label="Expand sidebar"
                aria-expanded="false"
                className="flex size-11 short:size-9 items-center justify-center rounded-full text-muted transition-colors hover:bg-sunken hover:text-ink"
              >
                <SidebarSimple size={20} className="-scale-x-100" />
              </button>
            </Tip>
          ) : (
            <div className="flex flex-col gap-2">
              <DemoLoginCard collapsed={false} />
              <p className="px-1 text-[11px] leading-snug text-muted">Prototype · synthetic data, no backend.</p>
            </div>
          )}
        </div>
      </div>
    </motion.aside>
  );
}

/** Shared nav list — used by the desktop rail and the mobile drawer. */
export function NavBody({ collapsed, onNavigate }: { collapsed: boolean; onNavigate?: () => void }) {
  const pathname = usePathname();
  const { role, has } = useRole();
  // only what the plan includes (spec rule 7) — nothing locked in the menu
  const sections = navFor(role, has);
  const recent = role === "patient" ? [] : PATIENTS.filter((p) => ["p-kabir", "p-aditi", "p-arun"].includes(p.id));

  // On short screens the nav scrolls (scrollbar hidden): fade its bottom edge while more items
  // sit below, so a half-visible last row reads as "scroll for more", not as a clipping bug.
  const scrollRef = useRef<HTMLDivElement>(null);
  const [moreBelow, setMoreBelow] = useState(false);
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const update = () => setMoreBelow(el.scrollHeight - el.clientHeight - el.scrollTop > 4);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    Array.from(el.children).forEach((c) => ro.observe(c));
    el.addEventListener("scroll", update, { passive: true });
    return () => {
      ro.disconnect();
      el.removeEventListener("scroll", update);
    };
  }, [collapsed, role]);

  return (
    <div
      ref={scrollRef}
      className={cn(
        "scrollbar-none min-h-0 flex-1 overflow-y-auto pb-4",
        collapsed ? "px-2" : "px-3",
        moreBelow && "[mask-image:linear-gradient(to_bottom,black_calc(100%-40px),transparent)]",
      )}
    >
      {role !== "patient" ? <BranchSwitcher collapsed={collapsed} /> : null}
      <LayoutGroup id="sidebar-nav">
        {sections.map((section) => (
          <div key={section.id} className="mt-4 first:mt-2 short:mt-2">
            {collapsed ? (
              <div className="mx-auto my-2 h-px w-6 bg-line" aria-hidden="true" />
            ) : (
              <p className="px-3 pb-2 pt-1 text-xs text-muted">{section.label}</p>
            )}
            <ul className="flex flex-col gap-1">
              {section.items.map((item) => (
                <li key={item.id}>
                  {item.children ? (
                    <NavGroup item={item} collapsed={collapsed} pathname={pathname} onNavigate={onNavigate} has={has} />
                  ) : (
                    <NavLink item={item} collapsed={collapsed} active={isActive(pathname, item.href)} onNavigate={onNavigate} locked={!!item.feature && !has(item.feature)} />
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </LayoutGroup>

      {recent.length ? (
        <div className="mt-6">
          {collapsed ? <div className="mx-auto my-2 h-px w-6 bg-line" aria-hidden="true" /> : <p className="px-3 pb-2 text-xs text-muted">Recent patients</p>}
          <ul className={cn("flex flex-col gap-1", collapsed && "items-center")}>
            {recent.map((p) => (
              <li key={p.id}>
                <Tip label={p.name} side="right" disabled={!collapsed}>
                  <Link
                    href={`/patients/${p.id}`}
                    onClick={onNavigate}
                    className={cn(
                      "flex items-center gap-3 rounded-full text-sm text-ink-2 transition-colors hover:bg-sunken hover:text-ink",
                      collapsed ? "size-11 short:size-9 justify-center" : "h-11 short:h-9 px-2",
                    )}
                  >
                    <Avatar src={p.avatar} name={p.name} size="sm" />
                    {!collapsed ? <span className="truncate">{p.name}</span> : <span className="sr-only">{p.name}</span>}
                  </Link>
                </Tip>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {!collapsed ? (
        <Link href="/help" onClick={onNavigate} className="mt-6 flex h-11 short:h-9 short:mt-3 items-center gap-3 rounded-full px-3 text-sm text-muted transition-colors hover:bg-sunken hover:text-ink">
          <Question size={20} />
          Help &amp; shortcuts
        </Link>
      ) : null}
    </div>
  );
}

function ActivePill() {
  return <motion.span layoutId="nav-active-pill" transition={snappy} className="absolute inset-0 rounded-full bg-charcoal" aria-hidden="true" />;
}

function Badge({ n, active, collapsed }: { n?: number; active: boolean; collapsed: boolean }) {
  if (!n) return null;
  if (collapsed) return <span className="absolute right-1.5 top-1.5 size-2 rounded-full bg-primary ring-2 ring-surface" aria-hidden="true" />;
  return <span className={cn("relative z-[1] ml-auto rounded-full px-2 text-[11px] leading-5 tabular", active ? "bg-white/20 text-white" : "bg-sunken text-ink-2")}>{n}</span>;
}

function NavLink({ item, collapsed, active, onNavigate, locked }: { item: NavItem; collapsed: boolean; active: boolean; onNavigate?: () => void; locked?: boolean }) {
  const Icon = item.icon;
  const link = (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={cn(
        "relative flex items-center rounded-full text-sm transition-colors duration-200",
        collapsed ? "mx-auto size-11 short:size-9 justify-center" : "h-11 short:h-9 gap-3 px-3",
        active ? "text-white" : locked ? "text-faint hover:bg-sunken hover:text-muted" : "text-ink-2 hover:bg-sunken hover:text-ink",
      )}
    >
      {active ? <ActivePill /> : null}
      <Icon size={20} weight={active ? "fill" : "regular"} className="relative z-[1] shrink-0" aria-hidden="true" />
      {collapsed ? <span className="sr-only">{item.label}{locked ? " (not in plan)" : ""}</span> : <span className="relative z-[1] truncate">{item.label}</span>}
      {locked ? (collapsed ? null : <LockBadge className="relative z-[1] ml-auto" />) : <Badge n={item.badge} active={active} collapsed={collapsed} />}
      {collapsed && item.badge && !locked ? <span className="sr-only">, {item.badge} pending</span> : null}
      {!collapsed && locked ? <span className="sr-only"> (not in plan)</span> : null}
    </Link>
  );
  return collapsed ? (
    <Tip label={locked && item.feature ? `${item.label} · ${minPlanFor(item.feature).name} plan` : item.badge ? `${item.label} · ${item.badge}` : item.label} side="right">
      {link}
    </Tip>
  ) : (
    link
  );
}

function NavGroup({ item, collapsed, pathname, onNavigate, has }: { item: NavItem; collapsed: boolean; pathname: string; onNavigate?: () => void; has: (f: NonNullable<NavItem["feature"]>) => boolean }) {
  const inside = isActive(pathname, item.href) || !!item.children?.some((c) => isActive(pathname, c.href));
  const [open, setOpen] = useState(inside);
  useEffect(() => {
    if (inside) setOpen(true);
  }, [inside]);
  const Icon = item.icon;
  const panelId = `nav-group-${item.id}`;

  if (collapsed) {
    return (
      <Dropdown modal={false}>
        <Tip label={item.label} side="right">
          <DropdownTrigger asChild>
            <button
              type="button"
              aria-label={item.label}
              className={cn(
                "relative mx-auto flex size-11 short:size-9 items-center justify-center rounded-full transition-colors duration-200",
                inside ? "text-white" : "text-ink-2 hover:bg-sunken hover:text-ink data-[state=open]:bg-sunken",
              )}
            >
              {inside ? <ActivePill /> : null}
              <Icon size={20} weight={inside ? "fill" : "regular"} className="relative z-[1]" aria-hidden="true" />
            </button>
          </DropdownTrigger>
        </Tip>
        <DropdownContent side="right" align="start" sideOffset={12} className="min-w-[200px]">
          <DropdownLabel>{item.label}</DropdownLabel>
          {item.children!.map((c) => {
            const active = pathname === c.href;
            return (
              <DropdownItem key={c.href} asChild>
                <Link href={c.href} onClick={onNavigate} aria-current={active ? "page" : undefined}>
                  <span className="flex flex-1 items-center justify-between gap-2">
                    {c.label}
                    {active ? <Check size={16} weight="bold" className="!text-primary" /> : c.feature && !has(c.feature) ? <LockBadge /> : null}
                  </span>
                </Link>
              </DropdownItem>
            );
          })}
        </DropdownContent>
      </Dropdown>
    );
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={panelId}
        className={cn(
          "relative flex h-11 short:h-9 w-full items-center gap-3 rounded-full px-3 text-sm transition-colors duration-200",
          inside && !open ? "text-white" : inside ? "text-ink" : "text-ink-2 hover:bg-sunken hover:text-ink",
        )}
      >
        {inside && !open ? <ActivePill /> : null}
        <Icon size={20} weight={inside ? "fill" : "regular"} className="relative z-[1] shrink-0" aria-hidden="true" />
        <span className="relative z-[1] truncate">{item.label}</span>
        <Badge n={item.badge} active={inside && !open} collapsed={false} />
        <CaretDown size={14} className={cn("relative z-[1] ml-auto shrink-0 transition-transform duration-300 [transition-timing-function:var(--ease-spring)]", open ? "rotate-180" : "rotate-0")} aria-hidden="true" />
      </button>
      <AnimatePresence initial={false}>
        {open ? (
          <motion.ul
            id={panelId}
            key="panel"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={spring}
            className="relative ml-[22px] overflow-hidden border-l border-line pl-3"
          >
            {item.children!.map((c) => {
              const active = pathname === c.href;
              return (
                <li key={c.href} className="py-0.5 first:pt-1 last:pb-1">
                  <Link
                    href={c.href}
                    onClick={onNavigate}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "relative flex h-9 items-center rounded-full px-3 text-sm transition-colors duration-200",
                      active ? "text-white" : "text-muted hover:bg-sunken hover:text-ink",
                    )}
                  >
                    {active ? <ActivePill /> : null}
                    <span className="relative z-[1] truncate">{c.label}</span>
                    {!active && c.feature && !has(c.feature) ? (
                      <>
                        <LockBadge className="relative z-[1] ml-auto" />
                        <span className="sr-only"> (not in plan)</span>
                      </>
                    ) : null}
                  </Link>
                </li>
              );
            })}
          </motion.ul>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

function BranchSwitcher({ collapsed }: { collapsed: boolean }) {
  const [branch, setBranch] = useState(BRANCHES[0].id);
  const current = BRANCHES.find((b) => b.id === branch)!;
  const trigger = (
    <DropdownTrigger asChild>
      <button
        type="button"
        aria-label={`Branch: ${current.name}. Change branch`}
        className={cn(
          "flex items-center gap-3 rounded-full bg-sunken text-sm text-ink transition-colors hover:bg-sunken-2 data-[state=open]:bg-sunken-2",
          collapsed ? "mx-auto size-11 short:size-9 justify-center" : "h-11 short:h-9 w-full px-3",
        )}
      >
        <MapPin size={18} className="shrink-0" aria-hidden="true" />
        {!collapsed ? (
          <>
            <span className="min-w-0 flex-1 truncate text-left">
              {current.name}
              <span className="text-muted"> · {current.city}</span>
            </span>
            <CaretDown size={14} className="shrink-0 text-muted" aria-hidden="true" />
          </>
        ) : null}
      </button>
    </DropdownTrigger>
  );
  return (
    <Dropdown>
      {collapsed ? <Tip label={`Branch · ${current.name}`} side="right">{trigger}</Tip> : trigger}
      <DropdownContent side={collapsed ? "right" : "bottom"} align="start" className="w-[260px]">
        <DropdownLabel>Switch branch</DropdownLabel>
        {BRANCHES.map((b) => (
          <DropdownItem key={b.id} onSelect={() => setBranch(b.id)} description={`${b.city} · ${b.rooms.length} rooms`}>
            <span className="flex items-center justify-between gap-2">
              {b.name}
              {b.id === branch ? <Check size={16} weight="bold" className="!text-primary" /> : null}
            </span>
          </DropdownItem>
        ))}
      </DropdownContent>
    </Dropdown>
  );
}

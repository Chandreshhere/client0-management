"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { CalendarPlus, List, ListPlus, MagnifyingGlass, NotePencil, Plus, UploadSimple, UserPlus, ChatCircleText } from "@phosphor-icons/react";
import { cn } from "@/lib/cn";
import { PillNav } from "@/components/ui/segmented";
import { Dropdown, DropdownContent, DropdownItem, DropdownLabel, DropdownTrigger } from "@/components/ui/dropdown";
import { Tip } from "@/components/ui/tooltip";
import { headerTabsFor } from "./nav-config";
import { Notifications } from "./notifications";
import { UserMenu } from "./user-menu";
import { useRole } from "./role-context";
import { Logo } from "./logo";

/**
 * Header row from the reference: white search pill, then charcoal/outline pill tabs, then
 * actions. Sticky on the canvas; gains a hairline once the page scrolls.
 */
export function Header({ onOpenSearch, onOpenMobileNav }: { onOpenSearch: () => void; onOpenMobileNav: () => void }) {
  const pathname = usePathname();
  const { has, role } = useRole();
  const tabs = headerTabsFor(pathname, has, role);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 4);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={cn(
        "sticky top-0 z-20 bg-canvas transition-shadow duration-300",
        scrolled && "shadow-[0_1px_0_var(--color-line)]",
      )}
    >
      {/* One grid, two layouts: lg = single row (search · tabs · actions); below lg = tabs drop to row 2. */}
      <div className="grid grid-cols-[minmax(0,auto)_minmax(0,1fr)_auto] items-center gap-x-2 gap-y-2 px-4 pb-2 pt-3 lg:gap-x-3 lg:px-6 lg:py-3">
        <div className="col-start-1 row-start-1 flex min-w-0 items-center gap-2">
          <button
            type="button"
            onClick={onOpenMobileNav}
            aria-label="Open navigation"
            className="flex size-10 shrink-0 items-center justify-center rounded-full bg-surface shadow-[inset_0_0_0_1px_var(--color-line)] lg:hidden"
          >
            <List size={20} />
          </button>
          <Logo className="mr-1 lg:hidden" />
          <button
            type="button"
            onClick={onOpenSearch}
            // With section tabs in this row the full search pill only shows on very wide screens;
            // otherwise it would squeeze the tabs (e.g. a patient's "Vital Signs" was cut off).
            className={cn(
              "group hidden h-10 w-[220px] shrink-0 items-center gap-3 rounded-full bg-surface pl-4 pr-2 text-sm text-faint shadow-[inset_0_0_0_1px_var(--color-line)] transition-shadow hover:shadow-[inset_0_0_0_1px_var(--color-line-strong)] xl:w-[260px]",
              tabs ? "2xl:flex" : "md:flex",
            )}
            aria-label="Search (Command K)"
          >
            <MagnifyingGlass size={18} className="text-ink-2" aria-hidden="true" />
            <span className="flex-1 text-left">Search</span>
            <kbd className="rounded-md bg-sunken px-1.5 py-0.5 font-mono text-[11px] text-muted">⌘K</kbd>
          </button>
        </div>

        {tabs ? (
          <div className="col-span-3 row-start-2 min-w-0 lg:col-span-1 lg:col-start-2 lg:row-start-1">
            <TabStrip>
              <PillNav items={tabs.items} activeHref={tabs.active} ariaLabel="Section" layoutKey={tabs.key} />
            </TabStrip>
          </div>
        ) : null}

        <div className="col-start-3 row-start-1 flex items-center gap-2 lg:gap-3">
          <button
            type="button"
            onClick={onOpenSearch}
            aria-label="Search"
            className={cn("flex size-10 shrink-0 items-center justify-center rounded-full bg-surface shadow-[inset_0_0_0_1px_var(--color-line)]", tabs ? "2xl:hidden" : "md:hidden")}
          >
            <MagnifyingGlass size={18} />
          </button>
          <NewMenu />
          <Notifications />
          <UserMenu compact={!!tabs} />
        </div>
      </div>
    </header>
  );
}

/**
 * Horizontally scrolling tab strip. When tabs don't all fit (narrow screens), the clipped edge
 * fades out and the active tab is scrolled into view, so no tab is silently cut in half.
 */
function TabStrip({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ start: false, end: false });
  const pathname = usePathname();
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setEdges({ start: el.scrollLeft > 4, end: el.scrollWidth - el.clientWidth - el.scrollLeft > 4 });
    const active = el.querySelector<HTMLElement>("[aria-current=page]");
    if (active && (active.offsetLeft < el.scrollLeft || active.offsetLeft + active.offsetWidth > el.scrollLeft + el.clientWidth)) {
      el.scrollLeft = active.offsetLeft - 16;
    }
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    el.addEventListener("scroll", update, { passive: true });
    return () => {
      ro.disconnect();
      el.removeEventListener("scroll", update);
    };
  }, [pathname]);
  const mask =
    edges.start && edges.end
      ? "[mask-image:linear-gradient(to_right,transparent,black_32px,black_calc(100%-32px),transparent)]"
      : edges.end
        ? "[mask-image:linear-gradient(to_right,black_calc(100%-32px),transparent)]"
        : edges.start
          ? "[mask-image:linear-gradient(to_right,transparent,black_32px)]"
          : "";
  return (
    <div ref={ref} className={cn("scrollbar-none -my-2 overflow-x-auto py-2", mask)}>
      {children}
    </div>
  );
}

function NewMenu() {
  const { role } = useRole();
  if (role === "patient") {
    return (
      <Tip label="Message your care team" side="bottom">
        <Link href="/messages?new=1" aria-label="New message" className="hidden size-10 shrink-0 items-center justify-center rounded-full bg-charcoal text-white transition-colors hover:bg-ink-2 sm:flex">
          <ChatCircleText size={18} />
        </Link>
      </Tip>
    );
  }
  const clinical = role === "doctor" || role === "nutritionist" || role === "yoga";
  return (
    <Dropdown>
      <Tip label="Create" side="bottom">
        <DropdownTrigger asChild>
          <button type="button" aria-label="Create new" className="hidden size-10 shrink-0 items-center justify-center rounded-full bg-charcoal text-white transition-[background-color,transform] hover:bg-ink-2 active:scale-95 data-[state=open]:rotate-45 sm:flex">
            <Plus size={18} weight="bold" />
          </button>
        </DropdownTrigger>
      </Tip>
      <DropdownContent className="w-[260px]">
        <DropdownLabel>Create</DropdownLabel>
        <DropdownItem asChild icon={<CalendarPlus />} shortcut="A">
          <Link href="/schedule?new=1">New appointment</Link>
        </DropdownItem>
        <DropdownItem asChild icon={<UserPlus />}>
          <Link href="/patients?new=1">Register patient</Link>
        </DropdownItem>
        {clinical ? (
          <DropdownItem asChild icon={<NotePencil />}>
            <Link href="/patients/p-kabir/notes?new=1">Consultation note</Link>
          </DropdownItem>
        ) : null}
        <DropdownItem asChild icon={<ListPlus />}>
          <Link href="/tasks?new=1">Task</Link>
        </DropdownItem>
        <DropdownItem asChild icon={<UploadSimple />}>
          <Link href="/documents?upload=1">Upload document</Link>
        </DropdownItem>
      </DropdownContent>
    </Dropdown>
  );
}

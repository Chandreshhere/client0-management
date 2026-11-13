"use client";

import { Dialog as D } from "radix-ui";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { X } from "@phosphor-icons/react";
import { useRole } from "./role-context";
import { Sidebar, NavBody } from "./sidebar";
import { Header } from "./header";
import { CommandPalette } from "./command-palette";
import { Logo } from "./logo";
import { LockedFeature } from "./plan-switcher";
import { featureForPath } from "@/data/plans";

/**
 * Workspace frame: floating sidebar rail + sticky header + page.
 * Keyboard: ⌘/Ctrl+K search · ⌘/Ctrl+B collapse sidebar · "/" search.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const { sidebarCollapsed, setSidebarCollapsed, has } = useRole();
  const [searchOpen, setSearchOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();
  const gated = featureForPath(pathname);
  const locked = gated !== null && !has(gated);

  useEffect(() => setMobileOpen(false), [pathname]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      const target = e.target as HTMLElement | null;
      const typing = !!target && (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName));
      if (mod && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen((v) => !v);
      } else if (mod && e.key.toLowerCase() === "b") {
        e.preventDefault();
        setSidebarCollapsed(!sidebarCollapsed);
      } else if (!typing && !mod && e.key === "/") {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [sidebarCollapsed, setSidebarCollapsed]);

  return (
    <div className="flex min-h-dvh">
      <a href="#main" className="sr-only z-[100] rounded-full bg-charcoal px-4 py-2 text-sm text-white focus:not-sr-only focus:fixed focus:left-4 focus:top-4">
        Skip to content
      </a>
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Header onOpenSearch={() => setSearchOpen(true)} onOpenMobileNav={() => setMobileOpen(true)} />
        <main id="main" className="min-w-0 flex-1 px-4 pb-16 pt-4 lg:px-6 lg:pt-6">
          {locked && gated ? <LockedFeature feature={gated} /> : children}
        </main>
      </div>
      <CommandPalette open={searchOpen} onOpenChange={setSearchOpen} />

      <D.Root open={mobileOpen} onOpenChange={setMobileOpen}>
        <D.Portal>
          <D.Overlay className="anim-overlay fixed inset-0 z-[60] bg-[rgb(20_24_21/0.32)] lg:hidden" />
          <D.Content className="anim-sheet-left fixed bottom-2 left-2 top-2 z-[61] flex w-[min(300px,calc(100vw-48px))] flex-col rounded-card bg-surface shadow-pop outline-none lg:hidden">
            <D.Title className="sr-only">Navigation</D.Title>
            <D.Description className="sr-only">Main navigation</D.Description>
            <div className="flex h-[72px] items-center justify-between pl-6 pr-3">
              <Logo />
              <D.Close aria-label="Close navigation" className="flex size-10 items-center justify-center rounded-full hover:bg-sunken">
                <X size={18} />
              </D.Close>
            </div>
            <NavBody collapsed={false} onNavigate={() => setMobileOpen(false)} />
          </D.Content>
        </D.Portal>
      </D.Root>
    </div>
  );
}

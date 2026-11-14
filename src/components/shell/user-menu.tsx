"use client";

import Link from "next/link";
import { CaretDown, Gear, Keyboard, SignOut, UserCircle } from "@phosphor-icons/react";
import type { Role } from "@/data/types";
import { DEMO_USER, ROLE_ORDER } from "@/data/staff";
import { planById } from "@/data/plans";
import { Avatar } from "@/components/ui/avatar";
import {
  Dropdown,
  DropdownContent,
  DropdownItem,
  DropdownLabel,
  DropdownRadioGroup,
  DropdownRadioItem,
  DropdownSeparator,
  DropdownTrigger,
} from "@/components/ui/dropdown";
import { useToast } from "@/components/ui/toast";
import { useRole } from "./role-context";
import { cn } from "@/lib/cn";

/** Profile menu + demo workspace switcher (the role dropdown is a demo affordance only). */
/** `compact`: avatar only below 2xl — used when the header row also carries section tabs. */
export function UserMenu({ compact = false }: { compact?: boolean }) {
  const { role, setRole, user, plan } = useRole();
  const allowed = planById(plan).roles;
  const { toast } = useToast();
  return (
    <Dropdown>
      <DropdownTrigger asChild>
        <button
          type="button"
          aria-label={`Account menu: ${user.name}, ${DEMO_USER[role].label} workspace`}
          className="flex h-10 shrink-0 items-center gap-2 rounded-full bg-surface pl-1 pr-1 shadow-[inset_0_0_0_1px_var(--color-line)] transition-colors hover:bg-canvas data-[state=open]:shadow-[inset_0_0_0_1px_var(--color-line-strong)] sm:pr-3"
        >
          <Avatar src={user.avatar} name={user.name} size="sm" />
          <span className={cn("hidden min-w-0 text-left leading-tight", compact ? "2xl:block" : "xl:block")}>
            <span className="block max-w-[140px] truncate text-xs font-medium text-ink">{user.name}</span>
            <span className="block text-[11px] text-muted">{DEMO_USER[role].label}</span>
          </span>
          <CaretDown size={14} className="hidden text-muted sm:block" aria-hidden="true" />
        </button>
      </DropdownTrigger>
      <DropdownContent className="w-[300px]">
        <div className="flex items-center gap-3 px-3 pb-3 pt-2">
          <Avatar src={user.avatar} name={user.name} size="md" />
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{user.name}</p>
            <p className="truncate text-xs text-muted">{user.title}</p>
          </div>
        </div>
        <DropdownSeparator />
        <DropdownLabel>Switch workspace · demo only</DropdownLabel>
        <DropdownRadioGroup value={role} onValueChange={(v) => setRole(v as Role)}>
          {ROLE_ORDER.filter((r) => allowed.includes(r)).map((r) => (
            <DropdownRadioItem key={r} value={r}>
              {DEMO_USER[r].label}
            </DropdownRadioItem>
          ))}
        </DropdownRadioGroup>
        {allowed.length < ROLE_ORDER.length ? (
          <p className="px-3 pb-1 text-[11px] text-muted">More workspaces on higher plans · <Link href="/pricing" className="text-primary hover:underline">compare</Link></p>
        ) : null}
        <DropdownSeparator />
        <DropdownItem asChild icon={<UserCircle />}>
          <Link href={role === "patient" ? "/portal/preferences" : "/settings"}>{role === "patient" ? "Profile & preferences" : "Profile & settings"}</Link>
        </DropdownItem>
        <DropdownItem asChild icon={<Keyboard />} shortcut="?">
          <Link href="/help">Keyboard shortcuts</Link>
        </DropdownItem>
        {role === "admin" ? (
          <DropdownItem asChild icon={<Gear />}>
            <Link href="/settings/access">Access review</Link>
          </DropdownItem>
        ) : null}
        <DropdownSeparator />
        <DropdownItem
          icon={<SignOut />}
          onSelect={() => toast({ title: "Sign-in isn't part of this prototype", description: "Authentication is production work; use the workspace switcher above to try other roles." })}
        >
          Sign out
        </DropdownItem>
      </DropdownContent>
    </Dropdown>
  );
}

"use client";

import { Command } from "cmdk";
import { Dialog as D } from "radix-ui";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowRight, CalendarPlus, MagnifyingGlass, UserPlus, ListPlus, UploadSimple, Swap } from "@phosphor-icons/react";
import { PATIENTS, clinicNumber } from "@/data/patients";
import { DEMO_USER } from "@/data/staff";
import { planById } from "@/data/plans";
import type { Patient } from "@/data/types";
import { Avatar } from "@/components/ui/avatar";
import { useRole } from "./role-context";
import { navFor } from "./nav-config";

/** ⌘K palette: jump to patients and pages, run quick actions, switch demo workspace. */
export function CommandPalette({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const router = useRouter();
  const { role, plan, has, user } = useRole();
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  const go = (href: string) => {
    onOpenChange(false);
    router.push(href);
  };

  const pages = navFor(role, has).flatMap((s) => s.items.flatMap((i) => (i.children ? i.children.map((c) => ({ label: `${i.label} · ${c.label}`, href: c.href, icon: i.icon })) : [{ label: i.label, href: i.href, icon: i.icon }])));
  const staffRole = role !== "patient";
  // F1: find by ID, phone or name, your own patients first. Admin and reception see demographics
  // only (spec rule 3), so their results show the phone number instead of the diagnosis.
  const clinicalView = role === "doctor" || role === "nutritionist" || role === "yoga" || role === "coordinator";
  const mine = (p: Patient) => Object.values(p.careTeam).includes(user.id);
  const ordered = [...PATIENTS].sort((a, b) => Number(mine(b)) - Number(mine(a)));
  const canRegister = role === "doctor" || role === "admin" || role === "frontdesk";

  return (
    <D.Root open={open} onOpenChange={onOpenChange}>
      <D.Portal>
        <D.Overlay className="anim-overlay fixed inset-0 z-[80] bg-[rgb(20_24_21/0.32)]" />
        <D.Content className="anim-modal fixed left-1/2 top-[12vh] z-[81] w-[min(640px,calc(100vw-32px))] -translate-x-1/2 overflow-hidden rounded-card bg-surface shadow-pop outline-none">
          <D.Title className="sr-only">Search Carelane</D.Title>
          <D.Description className="sr-only">Search patients and pages, or run a quick action.</D.Description>
          <Command label="Search Carelane" loop className="flex max-h-[min(70vh,560px)] flex-col">
            <div className="flex items-center gap-3 border-b border-line px-5">
              <MagnifyingGlass size={20} className="shrink-0 text-muted" aria-hidden="true" />
              <Command.Input
                value={query}
                onValueChange={setQuery}
                placeholder={staffRole ? "Search patients, pages and actions…" : "Search your care…"}
                className="h-16 w-full bg-transparent text-base text-ink outline-none placeholder:text-faint"
              />
              <kbd className="rounded-md bg-sunken px-1.5 py-0.5 font-mono text-[11px] text-muted">Esc</kbd>
            </div>
            <Command.List className="scrollbar-thin min-h-0 flex-1 overflow-y-auto p-2 [&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:pt-3 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:text-muted overscroll-contain">
              <Command.Empty className="px-4 py-10 text-center text-sm text-muted">No matches for “{query}”.</Command.Empty>

              {staffRole ? (
                <Command.Group heading="Patients">
                  {ordered.slice(0, query ? ordered.length : 5).map((p) => (
                    <Item key={p.id} value={`${p.name} ${clinicNumber(p.id)} ${p.phone} ${p.phone.replace(/\D/g, "")}${clinicalView ? ` ${p.primaryConcern}` : ""}`} onSelect={() => go(`/patients/${p.id}`)}>
                      <Avatar src={p.avatar} name={p.name} size="sm" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate">
                          {p.name}
                          {mine(p) ? <span className="ml-2 text-xs text-primary">Your patient</span> : null}
                        </span>
                        <span className="block truncate text-xs text-muted">
                          <span className="font-mono">{clinicNumber(p.id)}</span> · {p.age} y · {clinicalView ? p.primaryConcern : p.phone}
                        </span>
                      </span>
                    </Item>
                  ))}
                </Command.Group>
              ) : null}

              <Command.Group heading="Go to">
                {pages.map((p) => (
                  <Item key={p.href + p.label} value={`go ${p.label}`} onSelect={() => go(p.href)}>
                    <span className="flex size-8 items-center justify-center rounded-full bg-sunken text-ink-2"><p.icon size={16} /></span>
                    <span className="flex-1">{p.label}</span>
                  </Item>
                ))}
              </Command.Group>

              {staffRole ? (
                <Command.Group heading="Actions">
                  {has("calendar") && role !== "yoga" ? <Item value="new appointment book" onSelect={() => go("/schedule?new=1")}><Act icon={<CalendarPlus size={16} />} />New appointment</Item> : null}
                  {canRegister ? <Item value="register patient new" onSelect={() => go("/patients?new=1")}><Act icon={<UserPlus size={16} />} />Register patient</Item> : null}
                  <Item value="new task" onSelect={() => go("/tasks?new=1")}><Act icon={<ListPlus size={16} />} />New task</Item>
                  {role !== "yoga" ? <Item value="upload document report" onSelect={() => go("/documents?upload=1")}><Act icon={<UploadSimple size={16} />} />Upload a report</Item> : null}
                </Command.Group>
              ) : null}

              <Command.Group heading="Demo">
                <Item value="switch demo login plan role" onSelect={() => go("/demo")}>
                  <Act icon={<Swap size={16} />} />
                  <span className="flex-1">Switch demo login</span>
                  <span className="truncate text-xs text-muted">{planById(plan).name} plan · {DEMO_USER[role].label}</span>
                </Item>
              </Command.Group>
            </Command.List>
            <div className="flex items-center gap-4 border-t border-line px-5 py-3 text-xs text-muted">
              <span className="flex items-center gap-1.5"><kbd className="rounded bg-sunken px-1 font-mono">↑↓</kbd> navigate</span>
              <span className="flex items-center gap-1.5"><kbd className="rounded bg-sunken px-1 font-mono">↵</kbd> open</span>
              <span className="ml-auto">Results show synthetic demo data</span>
            </div>
          </Command>
        </D.Content>
      </D.Portal>
    </D.Root>
  );
}

function Item({ children, onSelect, value }: { children: React.ReactNode; onSelect: () => void; value: string }) {
  return (
    <Command.Item
      value={value}
      onSelect={onSelect}
      className="group flex min-h-12 cursor-pointer items-center gap-3 rounded-[14px] px-3 py-2 text-sm text-ink outline-none data-[selected=true]:bg-sunken"
    >
      {children}
      <ArrowRight size={16} className="ml-auto shrink-0 text-faint opacity-0 transition-opacity group-data-[selected=true]:opacity-100" aria-hidden="true" />
    </Command.Item>
  );
}

const Act = ({ icon }: { icon: React.ReactNode }) => <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-sunken text-ink-2">{icon}</span>;

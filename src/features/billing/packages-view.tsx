"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowUpRight, CalendarPlus, DotsThree, Package, Plus, UserCircle } from "@phosphor-icons/react";
import type { Role } from "@/data/types";
import { patientById } from "@/data/patients";
import { cn } from "@/lib/cn";
import { formatDate, pluralize } from "@/lib/format";
import { Avatar, AvatarStack } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dropdown, DropdownContent, DropdownItem, DropdownTrigger } from "@/components/ui/dropdown";
import { IconButton } from "@/components/ui/icon-button";
import { EmptyState, PageHeader, Stat } from "@/components/ui/misc";
import { Segmented } from "@/components/ui/segmented";
import { StatusBadge, type Tone } from "@/components/ui/status";
import { useToast } from "@/components/ui/toast";
import { useRole } from "@/components/shell/role-context";
import { DisciplineTag, ReadOnlyBanner } from "@/features/settings/ui";
import { addDays, daysPhrase, daysUntil } from "@/features/settings/time";
import { PROGRAMMES, billingLabel, enrolledIn, programmeForName, type PackageRow } from "./data";
import { CreditMeter, type MeterTone } from "./credit-meter";
import { money } from "./meta";
import { SellPackageModal } from "./sell-package";
import { extendPackage, usePackages } from "./store";

const SELL_ROLES: Role[] = ["admin", "frontdesk"];

type Health = { key: "expired" | "used-up" | "expiring" | "low" | "active"; label: string; tone: Tone; meter: MeterTone; note: string };

/** Most severe state first; each carries a text label so colour is never the only signal. */
function healthOf(p: PackageRow): Health {
  const left = p.total - p.used;
  const days = daysUntil(p.expires);
  if (days < 0) return { key: "expired", label: "Expired", tone: "danger", meter: "danger", note: `${pluralize(left, "credit")} unused` };
  if (left <= 0) return { key: "used-up", label: "All used", tone: "neutral", meter: "muted", note: "Every credit has been used" };
  if (days <= 30) return { key: "expiring", label: "Expires soon", tone: "warning", meter: "warning", note: `${pluralize(left, "credit")} to use ${daysPhrase(p.expires)}` };
  if (left <= Math.max(2, Math.round(p.total * 0.2))) return { key: "low", label: "Running low", tone: "warning", meter: "warning", note: `Only ${left} left — offer a renewal` };
  return { key: "active", label: "Active", tone: "success", meter: "neutral", note: "" };
}

type Filter = "all" | "attention" | "active";

export function PackagesView() {
  const { role, user } = useRole();
  const { toast } = useToast();
  const router = useRouter();
  const packages = usePackages();
  const canSell = SELL_ROLES.includes(role);
  const [filter, setFilter] = useState<Filter>("all");
  const [sellOpen, setSellOpen] = useState(false);
  const [preset, setPreset] = useState<string | null>(null);
  const [flashKey, setFlashKey] = useState<string | null>(null);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const rows = useMemo(() => packages.map((p) => ({ p, h: healthOf(p) })), [packages]);
  const attention = rows.filter((r) => r.h.key === "expiring" || r.h.key === "low" || r.h.key === "expired");
  const active = rows.filter((r) => r.h.key !== "expired" && r.h.key !== "used-up");
  const shown = (filter === "attention" ? attention : filter === "active" ? active : rows).slice().sort((a, b) => order(a.h) - order(b.h) || daysUntil(a.p.expires) - daysUntil(b.p.expires));

  const creditsLeft = active.reduce((s, r) => s + (r.p.total - r.p.used), 0);
  const creditsSold = active.reduce((s, r) => s + r.p.total, 0);
  const expiring = rows.filter((r) => r.h.key === "expiring").sort((a, b) => daysUntil(a.p.expires) - daysUntil(b.p.expires));
  const low = rows.filter((r) => r.p.total - r.p.used <= Math.max(2, Math.round(r.p.total * 0.2)) && r.p.used < r.p.total && daysUntil(r.p.expires) >= 0);

  if (role === "patient") {
    return (
      <div className="flex flex-col gap-6 lg:gap-8">
        <PageHeader title="Packages" />
        <Card>
          <EmptyState
            icon={<Package />}
            title="Your session balance is in your portal"
            description="This page is for the clinic team. Your own package and remaining sessions are shown in your portal."
            action={
              <Button asChild variant="dark">
                <Link href="/portal/billing">Open my billing</Link>
              </Button>
            }
          />
        </Card>
      </div>
    );
  }

  const openSell = (programmeId: string | null) => {
    setPreset(programmeId);
    setSellOpen(true);
  };

  return (
    <div className="flex flex-col gap-6 lg:gap-8">
      <PageHeader
        eyebrow="Billing"
        title="Packages"
        description="Programme packages and session credits. A credit is used when a session is marked attended — nothing on this page takes a payment."
        actions={
          canSell ? (
            <Button variant="primary" leading={<Plus />} onClick={() => openSell(null)}>
              Sell package
            </Button>
          ) : undefined
        }
      />

      {!canSell ? <ReadOnlyBanner>Package balances are visible to the care team. The front desk and administrators sell and change packages.</ReadOnlyBanner> : null}

      <section aria-label="Package summary" className="grid grid-cols-2 gap-2 sm:gap-4 xl:grid-cols-4">
        <Stat label="Active packages" value={active.length} context={`${pluralize(new Set(active.map((r) => r.p.patientId)).size, "patient")}`} className="p-4 sm:p-6" />
        <Stat label="Credits left" value={creditsLeft} context={`of ${creditsSold} on active packages`} className="p-4 sm:p-6" />
        <Stat
          label="Expiring within 30 days"
          value={expiring.length}
          context={expiring[0] ? `Next: ${patientById(expiring[0].p.patientId)?.name.split(" ")[0]} · ${formatDate(expiring[0].p.expires, { day: "numeric", month: "short" })}` : "None"}
          className="p-4 sm:p-6"
        />
        <Stat
          label="Running low"
          value={low.length}
          context={low[0] ? `${patientById(low[0].p.patientId)?.name.split(" ")[0]} · ${pluralize(low[0].p.total - low[0].p.used, "credit")} left` : "None"}
          className="p-4 sm:p-6"
        />
      </section>

      <section aria-labelledby="credits-title" className="flex flex-col gap-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 id="credits-title" className="text-lg font-normal tracking-[-0.01em] text-ink">
              Session credits
            </h2>
            <p className="mt-1 text-sm text-muted">One pip per session · filled = used</p>
          </div>
          <Segmented
            ariaLabel="Filter packages"
            size="sm"
            variant="tray"
            value={filter}
            onChange={setFilter}
            items={[
              { value: "all", label: "All", count: rows.length },
              { value: "attention", label: "Needs attention", count: attention.length },
              { value: "active", label: "Active", count: active.length },
            ]}
          />
        </div>

        {shown.length === 0 ? (
          <Card>
            <EmptyState icon={<Package />} title="Nothing needs attention" description="No package is expiring within 30 days or running low on credits." action={<Button variant="secondary" onClick={() => setFilter("all")}>Show all packages</Button>} />
          </Card>
        ) : (
          <ul className="flex flex-col rounded-card bg-surface p-2">
            {shown.map(({ p, h }) => {
              const pt = patientById(p.patientId);
              const left = p.total - p.used;
              return (
                <li
                  key={p.key}
                  data-pkg-key={p.key}
                  className={cn(
                    "grid grid-cols-1 items-center gap-x-6 gap-y-3 rounded-inner p-4 transition-colors duration-700 md:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)_150px_200px] xl:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)_170px_240px]",
                    flashKey === p.key ? "bg-primary-soft" : "hover:bg-canvas/70",
                  )}
                >
                  <div className="flex min-w-0 items-center gap-3">
                    {pt ? <Avatar src={pt.avatar} name={pt.name} size="md" /> : null}
                    <div className="min-w-0">
                      <p className="truncate text-sm text-ink">{pt?.name ?? "Unknown patient"}</p>
                      <p className="truncate text-xs text-muted">
                        {p.name}
                        {p.local ? " · sold this session" : ""}
                      </p>
                    </div>
                  </div>

                  <div className="min-w-0">
                    <div className="mb-2 flex items-baseline justify-between gap-3 text-xs">
                      <span className="text-muted tabular">
                        {p.used} of {p.total} used
                      </span>
                      <span className="text-ink tabular">{pluralize(left, "credit")} left</span>
                    </div>
                    <CreditMeter used={p.used} total={p.total} tone={h.meter} label={`${pt?.name ?? "Patient"} — ${p.name}`} />
                  </div>

                  <div className="min-w-0">
                    <p className="text-sm text-ink tabular">Expires {formatDate(p.expires, { day: "numeric", month: "short", year: "numeric" })}</p>
                    <p className={cn("text-xs", h.key === "expired" ? "text-danger" : h.key === "expiring" ? "text-warning" : "text-muted")}>{daysPhrase(p.expires)}</p>
                  </div>

                  <div className="flex items-center justify-between gap-3 md:justify-end">
                    <span className="flex flex-col items-start gap-1 md:items-end">
                      <StatusBadge tone={h.tone}>{h.label}</StatusBadge>
                      {h.note ? <span className="text-xs text-muted md:text-right">{h.note}</span> : null}
                    </span>
                    <Dropdown>
                      <DropdownTrigger asChild>
                        <IconButton label={`Actions for ${pt?.name ?? "patient"}'s package`} variant="ghost" size="md">
                          <DotsThree size={20} weight="bold" />
                        </IconButton>
                      </DropdownTrigger>
                      <DropdownContent className="w-[260px]">
                        {canSell ? (
                          <DropdownItem
                            icon={<CalendarPlus />}
                            description="Moves the expiry date; credits stay the same"
                            onSelect={() => {
                              extendPackage(p.key, 30, user.id);
                              toast({
                                tone: "success",
                                title: `Extended to ${formatDate(addDays(p.expires, 30), { day: "numeric", month: "short", year: "numeric" })}`,
                                description: `${pt?.name}'s ${p.name} — saved in this browser session only. The patient isn't notified.`,
                                action: { label: "Undo", onClick: () => extendPackage(p.key, -30, user.id) },
                              });
                            }}
                          >
                            Extend validity by 30 days
                          </DropdownItem>
                        ) : null}
                        {pt ? (
                          <DropdownItem icon={<UserCircle />} onSelect={() => router.push(`/patients/${pt.id}`)}>
                            Open patient record
                          </DropdownItem>
                        ) : null}
                        {canSell ? (
                          <DropdownItem icon={<Plus />} onSelect={() => openSell(programmeForName(p.name)?.id ?? null)}>
                            Sell a renewal
                          </DropdownItem>
                        ) : null}
                      </DropdownContent>
                    </Dropdown>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        <p className="text-xs text-muted">Packages from the shared registry plus any sold in this browser session. Credits are used from session attendance, not from this page.</p>
      </section>

      <section aria-labelledby="catalogue-title" className="flex flex-col gap-4">
        <div>
          <h2 id="catalogue-title" className="text-lg font-normal tracking-[-0.01em] text-ink">
            Programme catalogue
          </h2>
          <p className="mt-1 text-sm text-muted">Programmes combine consultations, nutrition follow-ups and yoga with set review points.</p>
        </div>
        <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {PROGRAMMES.map((prog) => {
            const enrolled = enrolledIn(prog);
            return (
              <li key={prog.id} className="flex flex-col rounded-card bg-surface p-6">
                <div className="flex items-start justify-between gap-3">
                  <h3 className="text-lg font-normal leading-tight tracking-[-0.01em] text-ink">{prog.match}</h3>
                  <span className="inline-flex h-6 shrink-0 items-center rounded-full px-2.5 text-xs text-muted shadow-[inset_0_0_0_1px_var(--color-line-strong)]">
                    {prog.credits} credits
                  </span>
                </div>
                <p className="mt-4 text-[26px] font-light leading-none tracking-[-0.02em] text-ink tabular">{money(prog.price)}</p>
                <p className="mt-1 text-xs text-muted">
                  {[prog.weeks ? `${prog.weeks} weeks` : null, prog.weeks ? billingLabel(prog).replace(/^P/, "p") : billingLabel(prog), `valid ${Math.round(prog.validityDays / 7)} weeks`].filter(Boolean).join(" · ")}
                </p>
                <ul className="mt-4 flex flex-col gap-1.5 rounded-inner bg-sunken p-3">
                  {prog.includes.map((inc) => (
                    <li key={inc.label} className="flex items-center justify-between gap-3">
                      <DisciplineTag discipline={inc.discipline} label={inc.label} />
                      <span className="text-xs text-ink tabular">× {inc.count}</span>
                    </li>
                  ))}
                </ul>
                <p className="mt-3 text-xs text-muted">Reviews: {prog.reviewPoints.join(" · ")}</p>
                <div className="mt-auto flex items-center justify-between gap-3 pt-4">
                  <span className="flex min-w-0 items-center gap-2 text-xs text-muted">
                    {enrolled.length ? <AvatarStack people={enrolled.map((e) => ({ name: e.name, avatar: e.avatar }))} max={3} size="xs" /> : null}
                    {enrolled.length ? pluralize(enrolled.length, "patient") + " enrolled" : "No one enrolled"}
                  </span>
                  {canSell ? (
                    <Button size="sm" variant="secondary" onClick={() => openSell(prog.id)} trailing={<ArrowUpRight />}>
                      Sell
                    </Button>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      {canSell ? (
        <SellPackageModal
          open={sellOpen}
          onOpenChange={setSellOpen}
          presetProgramme={preset}
          packages={packages}
          onSold={(key) => {
            setFilter("all");
            setFlashKey(key);
            requestAnimationFrame(() =>
              requestAnimationFrame(() => document.querySelector<HTMLElement>(`[data-pkg-key="${CSS.escape(key)}"]`)?.scrollIntoView({ block: "center", behavior: "smooth" })),
            );
            window.clearTimeout(timer.current);
            timer.current = window.setTimeout(() => setFlashKey(null), 2400);
          }}
        />
      ) : null}
    </div>
  );
}

const ORDER: Record<Health["key"], number> = { expired: 0, expiring: 1, low: 2, active: 3, "used-up": 4 };
const order = (h: Health) => ORDER[h.key];

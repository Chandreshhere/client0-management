"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowUpRight, CalendarPlus, DotsThree, Package, Plus, UserCircle } from "@phosphor-icons/react";
import type { Role } from "@/data/types";
import { patientById } from "@/data/patients";
import { cn } from "@/lib/cn";
import { formatDate, pluralize } from "@/lib/format";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dropdown, DropdownContent, DropdownItem, DropdownTrigger } from "@/components/ui/dropdown";
import { IconButton } from "@/components/ui/icon-button";
import { EmptyState, PageHeader } from "@/components/ui/misc";
import { Segmented } from "@/components/ui/segmented";
import { StatusBadge } from "@/components/ui/status";
import { useToast } from "@/components/ui/toast";
import { staffById } from "@/data/staff";
import { useRole } from "@/components/shell/role-context";
import { DisciplineTag, ReadOnlyBanner } from "@/features/settings/ui";
import { addDays, daysPhrase, daysUntil } from "@/features/settings/time";
import { PROGRAMMES, billingLabel, programmeForName } from "./data";
import { CreditMeter } from "./credit-meter";
import { CreditsFocal, ExpiryRunway } from "./package-overview";
import { alertRecipients, healthOf, pace, runways, type Health } from "./package-insights";
import { money } from "./meta";
import { SellPackageModal } from "./sell-package";
import { extendPackage, usePackages } from "./store";

const SELL_ROLES: Role[] = ["admin", "frontdesk"];

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
  // packages that need a faster weekly pace than their programme schedules (see ExpiryRunway)
  const atRisk = useMemo(() => new Map(runways(packages).filter((r) => r.atRisk).map((r) => [r.row.key, r])), [packages]);
  const attention = rows.filter((r) => r.h.key === "expiring" || r.h.key === "low" || r.h.key === "expired" || atRisk.has(r.p.key));
  const active = rows.filter((r) => r.h.key !== "expired" && r.h.key !== "used-up");
  const shown = (filter === "attention" ? attention : filter === "active" ? active : rows).slice().sort((a, b) => order(a.h) - order(b.h) || daysUntil(a.p.expires) - daysUntil(b.p.expires));

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

  /** Bring one package row into view and flash it (from the bubbles and the runway). */
  const flashRow = (key: string) => {
    setFlashKey(key);
    requestAnimationFrame(() =>
      requestAnimationFrame(() => document.querySelector<HTMLElement>(`[data-pkg-key="${CSS.escape(key)}"]`)?.scrollIntoView({ block: "center", behavior: "smooth" })),
    );
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setFlashKey(null), 2400);
  };
  const focusPackage = (key: string) => {
    setFilter("all");
    flashRow(key);
  };
  const showAttention = () => {
    setFilter("attention");
    requestAnimationFrame(() => document.getElementById("credits-title")?.scrollIntoView({ block: "start", behavior: "smooth" }));
  };

  return (
    <div className="flex flex-col gap-6 lg:gap-8">
      <PageHeader
        eyebrow="Billing"
        title="Packages"
        description="Session packages and their credits. One credit is used each time attendance is marked. Alerts go to Reception and the patient's instructor at 2 credits left and 14 days before expiry."
        actions={
          canSell ? (
            <Button variant="primary" leading={<Plus />} onClick={() => openSell(null)}>
              Sell package
            </Button>
          ) : undefined
        }
      />

      {!canSell ? <ReadOnlyBanner>Package balances are visible to the care team. Reception and administrators sell and change packages.</ReadOnlyBanner> : null}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <CreditsFocal packages={packages} onFocusPackage={focusPackage} onShowAttention={() => showAttention()} />
        <ExpiryRunway packages={packages} onFocusPackage={focusPackage} />
      </div>

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
            <EmptyState icon={<Package />} title="Nothing needs attention" description="No package expires within 14 days, has 2 or fewer credits left, or is behind its planned pace." action={<Button variant="secondary" onClick={() => setFilter("all")}>Show all packages</Button>} />
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
                      {h.key === "low" || h.key === "expiring" ? (
                        <span className="text-xs text-muted md:text-right">
                          Alert: {alertRecipients(p).map((r) => (r === "Reception" ? r : staffById(r)?.name.split(" ")[0] ?? r)).join(", ")}
                        </span>
                      ) : null}
                      {atRisk.has(p.key) ? (
                        <span className="text-xs text-danger md:text-right">
                          Needs {pace(atRisk.get(p.key)?.needed ?? 0)} · plan {pace(atRisk.get(p.key)?.planned ?? 0)}
                        </span>
                      ) : null}
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
        <p className="text-xs text-muted">Packages from the shared registry plus any sold in this browser session. Credits are used when attendance is marked, not from this page.</p>
      </section>

      <section aria-labelledby="catalogue-title" className="flex flex-col gap-4">
        <div>
          <h2 id="catalogue-title" className="text-lg font-normal tracking-[-0.01em] text-ink">
            Package catalogue
          </h2>
          <p className="mt-1 text-sm text-muted">What each package includes, how long it&apos;s valid and its price.</p>
        </div>
        <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {PROGRAMMES.map((prog) => {
            const sold = active.filter((r) => programmeForName(r.p.name)?.id === prog.id).length;
            return (
              <li key={prog.id} className="flex flex-col rounded-card bg-surface p-6">
                <div className="flex items-start justify-between gap-3">
                  <h3 className="min-w-0 text-lg font-normal leading-tight tracking-[-0.01em] text-ink">{prog.match}</h3>
                  <span className="inline-flex h-6 shrink-0 items-center rounded-full px-2.5 text-xs text-muted shadow-[inset_0_0_0_1px_var(--color-line-strong)]">{prog.credits} credits</span>
                </div>
                <p className="mt-4 text-[26px] font-light leading-none tracking-[-0.02em] text-ink tabular">{money(prog.price)}</p>
                <p className="mt-1 text-xs text-muted">
                  {[prog.weeks ? `${prog.weeks} weeks` : null, prog.weeks ? billingLabel(prog).replace(/^P/, "p") : billingLabel(prog), `valid ${Math.round(prog.validityDays / 7)} weeks`].filter(Boolean).join(" · ")}
                </p>
                {/* the "includes" box takes any spare row height, so cards in a row keep their footers level */}
                <ul className="mt-4 flex flex-1 flex-col gap-1.5 rounded-inner bg-sunken p-3">
                  {prog.includes.map((inc) => (
                    <li key={inc.label} className="flex items-center justify-between gap-3">
                      <DisciplineTag discipline={inc.discipline} label={inc.label} />
                      <span className="text-xs text-ink tabular">× {inc.count}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-auto flex items-center justify-between gap-3 pt-4">
                  <span className="text-xs text-muted">{sold ? pluralize(sold, "active package") : "None active"}</span>
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
            flashRow(key);
          }}
        />
      ) : null}
    </div>
  );
}

const ORDER: Record<Health["key"], number> = { expired: 0, expiring: 1, low: 2, active: 3, "used-up": 4 };
const order = (h: Health) => ORDER[h.key];

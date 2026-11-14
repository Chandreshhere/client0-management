"use client";

import Link from "next/link";
import { useMemo, useRef, useState, type ReactNode } from "react";
import { ArrowUpRight, ClockCounterClockwise, CurrencyInr, DownloadSimple, FirstAidKit, Lock, Tag, UserGear, UsersThree, X } from "@phosphor-icons/react";
import { cn } from "@/lib/cn";
import { formatTime, pluralize } from "@/lib/format";
import { BarChart } from "@/components/charts/bar-chart";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, Group, GroupHeader, Inset } from "@/components/ui/card";
import { EmptyState, PageHeader } from "@/components/ui/misc";
import { SearchInput } from "@/components/ui/input";
import { StatusBadge } from "@/components/ui/status";
import { useToast } from "@/components/ui/toast";
import { ChipGroup, MediaStatCard, PeopleList, SectionLabel } from "@/components/viz/cards";
import { useRole } from "@/components/shell/role-context";
import { AUDIT_CATEGORY_LABEL, logAudit, useAuditEvents, type AuditCategory, type AuditEvent } from "./audit";
import {
  PERIOD_LABEL,
  SCOPES,
  SCOPE_HINT,
  SCOPE_LABEL,
  actorOf,
  actorRanking,
  auditCsv,
  byDay,
  categoryCounts,
  clinicalByPatient,
  dayHeading,
  entriesPerDay,
  firstDay,
  inPeriod,
  stamp,
  targetHref,
  type AuditScope,
  type Period,
} from "./audit-insights";
import { FilterPill, InfoNote, TableCard } from "./ui";
import { FitBubbles, MeterRow } from "./viz";
import { TODAY_KEY, istDayKey, shortDate } from "./time";

/**
 * Settings → Audit log (doc §2A, §7): an attributed, append-only history. The cobalt focal card
 * splits the period's entries by category (bubbles) and scope (tiles); "Who acted" ranks people
 * and automated sources (ref 5 doctor list with counts); dark media cards show whose clinical
 * content was opened (by patient — the admin never sees what the content is). Every figure is computed from
 * the seeded entries plus this browser session's actions.
 */

const SCOPE_ICON: Record<AuditScope, ReactNode> = {
  clinical: <FirstAidKit />,
  metadata: <Tag />,
  financial: <CurrencyInr />,
  account: <UserGear />,
};

const SERIES = [
  { id: "clinical", name: "Clinical content", color: "var(--color-charcoal)" },
  { id: "other", name: "Other entries", color: "#a9afa9" },
];

/** Shorter names inside bubbles (the full name is in the tooltip and the chips). */
const BUBBLE_LABEL: Partial<Record<AuditCategory, string>> = { record: "Records" };

/** Entries rendered before "Show more" (the log can grow with every session action). */
const PAGE = 20;

const countTick = (v: number) => (Number.isInteger(v) ? String(v) : "");

export function AuditView() {
  const { role } = useRole();
  if (role !== "admin") {
    return (
      <div className="flex flex-col gap-6 lg:gap-8">
        <PageHeader eyebrow="Settings" title="Activity log" />
        <Card>
          <EmptyState
            icon={<Lock />}
            title="The activity log is read by administrators"
            description="It records who opened, changed or exported what across the clinic. Ask an administrator if you need to know who accessed a record — every access is logged, including yours."
          />
        </Card>
      </div>
    );
  }
  return <AuditWorkspace />;
}

function AuditWorkspace() {
  const { user } = useRole();
  const { toast } = useToast();
  const events = useAuditEvents();
  const tableRef = useRef<HTMLElement>(null);
  const [period, setPeriod] = useState<Period>("all");
  const [categories, setCategories] = useState<AuditCategory[]>([]);
  const [scope, setScope] = useState<AuditScope | "all">("all");
  const [actor, setActor] = useState<string>("all");
  const [patient, setPatient] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [limit, setLimit] = useState(PAGE);

  const since = firstDay(events);
  const periodEvents = useMemo(() => events.filter((e) => inPeriod(e, period)), [events, period]);
  const periodText = period === "all" ? `since ${shortDate(since)}` : PERIOD_LABEL[period].toLowerCase();

  const cats = useMemo(() => categoryCounts(periodEvents), [periodEvents]);
  const bubbleCats = cats.filter((c) => c.count > 0);
  const actors = useMemo(() => actorRanking(periodEvents), [periodEvents]);
  const clinical = useMemo(() => clinicalByPatient(periodEvents), [periodEvents]);
  const clinicalCount = periodEvents.filter((e) => e.scope === "clinical").length;
  const clinicalByAdmins = periodEvents.filter((e) => e.scope === "clinical" && actorOf(e).staff?.role === "admin").length;
  const clinicians = new Set(periodEvents.filter((e) => e.scope === "clinical").map((e) => actorOf(e).key)).size;
  const local = events.filter((e) => e.local).length;

  const q = query.trim().toLowerCase();
  const shown = useMemo(
    () =>
      periodEvents
        .filter((e) => !categories.length || categories.includes(e.category))
        .filter((e) => scope === "all" || e.scope === scope)
        .filter((e) => actor === "all" || actorOf(e).key === actor)
        .filter((e) => !patient || (e.target?.kind === "patient" && e.target.id === patient))
        .filter((e) => {
          if (!q) return true;
          const a = actorOf(e);
          return `${a.name} ${e.actorLabel ?? ""} ${e.action} ${e.detail ?? ""} ${e.target?.label ?? ""} ${AUDIT_CATEGORY_LABEL[e.category]}`.toLowerCase().includes(q);
        }),
    [periodEvents, categories, scope, actor, patient, q],
  );
  const visible = shown.slice(0, limit);
  const filtered = categories.length > 0 || scope !== "all" || actor !== "all" || !!patient || q !== "";

  // the chart follows the actor picked in "Who acted" (its own 14-day window)
  const chartEvents = actor === "all" ? events : events.filter((e) => actorOf(e).key === actor);
  const days = entriesPerDay(chartEvents, 14);
  const chartTotal = days.reduce((s, d) => s + d.clinical + d.other, 0);
  const selActor = actors.find((a) => a.actor.key === actor) ?? null;
  const latest = chartEvents[0];
  const actorCats = categoryCounts(actor === "all" ? periodEvents : periodEvents.filter((e) => actorOf(e).key === actor))
    .filter((c) => c.count > 0)
    .sort((a, b) => b.count - a.count);

  const clearAll = () => {
    setCategories([]);
    setScope("all");
    setActor("all");
    setPatient(null);
    setQuery("");
  };
  const toTable = () => requestAnimationFrame(() => tableRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));

  function exportCsv() {
    try {
      const csv = auditCsv(shown);
      const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = `carelane-audit-${TODAY_KEY}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      logAudit({ actorId: user.id, category: "export", action: `Exported ${pluralize(shown.length, "audit entry", "audit entries")} as CSV`, detail: filtered ? "Filtered view · generated in this browser" : "Full log · generated in this browser", scope: "account" });
      toast({
        tone: "success",
        title: `CSV downloaded · ${pluralize(shown.length, "entry", "entries")}`,
        description: "Generated in this browser from the synthetic log — nothing was uploaded. The export itself is now in the log.",
      });
    } catch (err) {
      console.warn("[carelane] audit export failed", err);
      toast({ tone: "danger", title: "Export failed", description: "This browser blocked the download. Nothing was created or logged." });
    }
  }

  return (
    <div className="flex flex-col gap-6 lg:gap-8">
      <PageHeader
        eyebrow="Settings"
        title="Activity log"
        description="Who opened, changed or exported what — and on which record. Entries are append-only: an undo is logged as its own entry. Synthetic history plus the actions taken in this browser session."
        actions={
          <Button variant="secondary" leading={<DownloadSimple />} onClick={exportCsv} disabled={!shown.length}>
            Export CSV
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        {/* ---------- focal: categories (bubbles) + scope (tiles) ---------- */}
        <section aria-labelledby="audit-focal-title" className="flex flex-col gap-2 rounded-card bg-primary p-2 text-white">
          <div className="flex flex-wrap items-start justify-between gap-4 p-4">
            <div className="min-w-0">
              <span className="inline-flex h-8 items-center rounded-full px-3 text-xs text-white shadow-[inset_0_0_0_1px_rgb(255_255_255/0.4)]">
                {PERIOD_LABEL[period]}
                {period === "all" ? ` · since ${shortDate(since)}` : ""}
              </span>
              <h2 id="audit-focal-title" className="mt-4 text-sm text-white/90">
                Logged actions
              </h2>
              <p className="mt-1 text-[44px] font-light leading-none tracking-[-0.025em] tabular">{periodEvents.length}</p>
              <p className="mt-2 text-xs text-white/90">{local ? `${pluralize(local, "entry", "entries")} from this browser session` : "None from this browser session yet"}</p>
            </div>
            <p className="max-w-[24ch] text-xs text-white/90 sm:text-right">Bubble area = entries in each category · select one to filter the log</p>
          </div>
          {periodEvents.length ? (
            <>
              <div className="px-2">
                <FitBubbles
                  title="Audit entries by category"
                  height={200}
                  selected={categories.length === 1 ? categories[0] : null}
                  onSelect={(id) => {
                    const c = id as AuditCategory;
                    setCategories((cur) => (cur.length === 1 && cur[0] === c ? [] : [c]));
                    toTable();
                  }}
                  items={bubbleCats.map((c) => ({ id: c.category, label: BUBBLE_LABEL[c.category] ?? c.label, value: c.count, display: String(c.count), detail: `${pluralize(c.count, "entry", "entries")} ${periodText}` }))}
                  smallNote="Unlabelled bubbles"
                />
              </div>
              <ul className="grid grid-cols-2 gap-2" aria-label="Entries by scope">
                {SCOPES.map((s) => {
                  const n = periodEvents.filter((e) => e.scope === s).length;
                  const on = scope === s;
                  return (
                    <li key={s}>
                      <button
                        type="button"
                        aria-pressed={on}
                        onClick={() => {
                          setScope(on ? "all" : s);
                          toTable();
                        }}
                        title={SCOPE_HINT[s]}
                        className={cn(
                          "group flex h-full w-full flex-col gap-3 rounded-inner p-4 text-left transition-[background-color,transform] duration-300 [transition-timing-function:var(--ease-spring)] hover:-translate-y-0.5",
                          on ? "bg-charcoal text-white" : "bg-surface text-ink",
                        )}
                      >
                        <span className="flex items-center justify-between gap-2">
                          <span className={cn("flex min-w-0 items-center gap-2 text-xs [&_svg]:size-4 [&_svg]:shrink-0", on ? "text-white/75" : "text-muted")}>
                            {SCOPE_ICON[s]}
                            <span className="truncate">{SCOPE_LABEL[s]}</span>
                          </span>
                          <ArrowUpRight size={16} className={cn("shrink-0 transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5", on ? "text-white" : "text-ink-2")} aria-hidden="true" />
                        </span>
                        <span>
                          <span className="block text-[22px] font-light leading-none tracking-[-0.01em] tabular">{n}</span>
                          <span className={cn("mt-1.5 block text-xs", on ? "text-white/75" : "text-muted")}>{periodEvents.length ? `${Math.round((n / periodEvents.length) * 100)}% of entries` : "—"}</span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </>
          ) : (
            <p className="mx-2 mb-2 rounded-inner bg-surface p-4 text-sm text-ink">Nothing was logged {periodText}.</p>
          )}
        </section>

        {/* ---------- who acted + entries per day ---------- */}
        <Group role="region" aria-labelledby="actors-title" className="flex flex-col">
          <GroupHeader
            icon={<UsersThree />}
            title={<span id="actors-title">Who acted</span>}
            subtitle={`${pluralize(actors.filter((a) => a.actor.kind === "staff").length, "person", "people")} and ${pluralize(actors.filter((a) => a.actor.kind !== "staff").length, "outside or automated source")} · ${periodText}`}
          />
          <div className="grid grid-cols-1 gap-2 md:grid-cols-[minmax(0,272px)_minmax(0,1fr)]">
            <div className="flex flex-col gap-2 p-2 pt-0 md:pt-2">
              <PeopleList
                selected={actor}
                onSelect={(id) => setActor(id === actor && id !== "all" ? "all" : id)}
                people={[
                  { id: "all", name: "Everyone", role: `All actors · ${periodText}`, avatar: null, count: periodEvents.length },
                  ...actors.slice(0, 7).map((a) => ({ id: a.actor.key, name: a.actor.groupName, role: a.role, avatar: a.actor.avatar, count: a.count })),
                ]}
              />
              {actors.length > 7 ? <p className="px-2 text-[11px] text-muted">{pluralize(actors.length - 7, "more actor")} — use search to find them.</p> : null}
              <p className="px-2 text-[11px] text-muted">Count = entries attributed to that account or source. Select one to filter the log and the chart.</p>
            </div>
            <Inset className="flex min-w-0 flex-col gap-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-ink">{selActor ? selActor.actor.groupName : "Everyone"} · entries per day</p>
                  <p className="text-xs text-muted">
                    {shortDate(days[0].key)} – {shortDate(days[days.length - 1].key)} · axis = day of the month
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-[26px] font-light leading-none tracking-[-0.01em] text-ink tabular">{chartTotal}</p>
                  <p className="mt-1 text-xs text-muted">{pluralize(chartTotal, "entry", "entries")} in 14 days</p>
                </div>
              </div>
              {chartTotal ? (
                <BarChart
                  ariaLabel={`${selActor ? selActor.actor.groupName : "Everyone"}, audit entries per day ${shortDate(days[0].key)} to ${shortDate(days[days.length - 1].key)}: ${days
                    .filter((d) => d.clinical + d.other > 0)
                    .map((d) => `${shortDate(d.key)} ${d.clinical} clinical, ${d.other} other`)
                    .join("; ")}`}
                  categories={days.map((d) => String(Number(d.key.slice(8, 10))))}
                  series={SERIES}
                  values={[days.map((d) => d.clinical), days.map((d) => d.other)]}
                  highlight={days.length - 1}
                  formatY={countTick}
                  height={176}
                />
              ) : (
                <p className="flex min-h-[176px] items-center justify-center rounded-[12px] bg-sunken p-6 text-center text-sm text-muted">No entries from {selActor?.actor.groupName ?? "anyone"} in the last 14 days.</p>
              )}
              {actorCats.length ? (
                <div className="flex flex-col gap-3 border-t border-line pt-4">
                  <p className="text-xs text-muted">
                    What {selActor ? selActor.actor.groupName.split(" ").slice(0, 2).join(" ") : "everyone"} did · {periodText}
                  </p>
                  {actorCats.slice(0, 4).map((c) => (
                    <MeterRow key={c.category} label={c.label} value={c.count} max={actorCats[0].count} display={c.count} />
                  ))}
                </div>
              ) : null}
              {latest ? (
                <p className="text-xs text-muted">
                  Latest: <span className="text-ink-2">{latest.action}</span> · {stamp(latest.at)}
                </p>
              ) : null}
            </Inset>
          </div>
        </Group>
      </div>

      {/* ---------- clinical content opened (dark media cards, ref 5) ---------- */}
      <section aria-labelledby="clinical-title">
        <SectionLabel>
          <span id="clinical-title">Clinical content opened or changed · {periodText}</span>
        </SectionLabel>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {clinical.map((c) => (
            <MediaStatCard
              key={c.patient.id}
              value={c.entries.length}
              label={`${c.patient.name.split(" ")[0]}’s record`}
              time={stamp(c.entries[0].at)}
              // The admin reads who touched a record, not what's in it: the patient, never their body system.
              media={
                <div className="flex h-full w-full items-center justify-center">
                  <Avatar src={c.patient.avatar} name={c.patient.name} size="xl" />
                </div>
              }
              onOpen={() => {
                setPatient(c.patient.id);
                setScope("all");
                setCategories([]);
                setActor("all");
                toTable();
              }}
              className={patient === c.patient.id ? "ring-2 ring-primary ring-offset-2 ring-offset-canvas" : undefined}
            />
          ))}
          <div className="flex flex-col justify-between gap-4 rounded-card bg-surface p-4 sm:col-span-2 xl:col-span-1">
            <p className="text-xs text-muted">Clinical entries · {periodText}</p>
            <div>
              <p className="text-[32px] font-light leading-none tracking-[-0.02em] text-ink tabular">{clinicalCount}</p>
              <p className="mt-1 text-xs text-muted">
                by {pluralize(clinicians, "clinician")} · <span className={clinicalByAdmins ? "text-danger" : "text-ink-2"}>{clinicalByAdmins} by administrators</span>
              </p>
            </div>
          </div>
        </div>
        <p className="mt-3 text-xs text-muted">
          {clinical.length
            ? "Big number = entries that opened or changed that patient's clinical content · time = the latest one. Select a card to list the entries."
            : `No clinical content was opened or changed ${periodText}.`}
        </p>
      </section>

      {/* ---------- filters + log ---------- */}
      <section ref={tableRef} aria-labelledby="log-title" className="flex scroll-mt-28 flex-col gap-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 id="log-title" className="text-lg font-normal tracking-[-0.01em] text-ink">
              Entries
            </h2>
            <p className="mt-1 text-sm text-muted">
              {pluralize(shown.length, "entry", "entries")} of {periodEvents.length} · newest first · times in IST
            </p>
          </div>
          {filtered ? (
            <Button variant="ghost" size="sm" leading={<X />} onClick={clearAll}>
              Clear filters
            </Button>
          ) : null}
        </div>
        <div className="scrollbar-none -mx-4 overflow-x-auto px-4 py-1 lg:-mx-6 lg:px-6">
          <ChipGroup<AuditCategory>
            ariaLabel="Category"
            className="w-max flex-nowrap"
            value={categories}
            onChange={setCategories}
            options={cats.filter((c) => c.count > 0 || categories.includes(c.category)).map((c) => ({ value: c.category, label: c.label, count: c.count }))}
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <FilterPill<Period>
            label="Period"
            value={period}
            defaultValue="all"
            onChange={setPeriod}
            options={(Object.keys(PERIOD_LABEL) as Period[]).map((p) => ({ value: p, label: PERIOD_LABEL[p], count: events.filter((e) => inPeriod(e, p)).length }))}
          />
          <FilterPill<AuditScope | "all">
            label="Scope"
            value={scope}
            defaultValue="all"
            onChange={setScope}
            options={[{ value: "all", label: "Any" }, ...SCOPES.map((s) => ({ value: s, label: SCOPE_LABEL[s], description: SCOPE_HINT[s], count: periodEvents.filter((e) => e.scope === s).length }))]}
          />
          {actor !== "all" ? <RemovableChip label={`Actor · ${actors.find((a) => a.actor.key === actor)?.actor.groupName ?? "Unknown"}`} onRemove={() => setActor("all")} /> : null}
          {patient ? <RemovableChip label={`Record · ${clinical.find((c) => c.patient.id === patient)?.patient.name ?? "Patient"}`} onRemove={() => setPatient(null)} /> : null}
          <SearchInput className="w-full sm:ml-auto sm:w-[280px]" placeholder="Search action, person, record" aria-label="Search the activity log" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>

        {shown.length === 0 ? (
          <Card>
            <EmptyState
              icon={<ClockCounterClockwise />}
              title="No entries match"
              description={`Nothing ${periodText} matches these filters. Widen the period or clear the filters.`}
              action={
                <Button variant="secondary" onClick={clearAll}>
                  Clear filters
                </Button>
              }
            />
          </Card>
        ) : (
          <>
            <TableCard minWidth={980} className="hidden md:block">
              <table className="w-full table-fixed text-sm">
                <caption className="sr-only">Audit entries, newest first</caption>
                <colgroup>
                  <col className="w-[96px]" />
                  <col className="w-[236px]" />
                  <col />
                  <col className="w-[220px]" />
                  <col className="w-[168px]" />
                </colgroup>
                <thead>
                  <tr className="text-left text-xs text-muted">
                    <th scope="col" className="py-4 pl-6 pr-3 font-normal">Time</th>
                    <th scope="col" className="px-3 py-4 font-normal">Actor</th>
                    <th scope="col" className="px-3 py-4 font-normal">Action</th>
                    <th scope="col" className="px-3 py-4 font-normal">Record</th>
                    <th scope="col" className="py-4 pl-3 pr-6 font-normal">Scope</th>
                  </tr>
                </thead>
                {byDay(visible).map((g) => (
                  <tbody key={g.key}>
                    <tr className="border-t border-line bg-canvas/60">
                      <th scope="colgroup" colSpan={5} className="py-2 pl-6 text-left text-xs font-normal text-muted">
                        {dayHeading(g.key)} · {pluralize(shown.filter((e) => istDayKey(e.at) === g.key).length, "entry", "entries")}
                      </th>
                    </tr>
                    {g.events.map((e) => (
                      <EntryRow key={e.id} e={e} />
                    ))}
                  </tbody>
                ))}
              </table>
            </TableCard>

            <div className="flex flex-col gap-4 md:hidden">
              {byDay(visible).map((g) => (
                <section key={g.key} aria-label={dayHeading(g.key)}>
                  <h3 className="mb-2 px-2 text-xs text-muted">
                    {dayHeading(g.key)} · {shown.filter((e) => istDayKey(e.at) === g.key).length}
                  </h3>
                  <ul className="flex flex-col gap-2">
                    {g.events.map((e) => (
                      <EntryCard key={e.id} e={e} />
                    ))}
                  </ul>
                </section>
              ))}
            </div>
            {shown.length > visible.length ? (
              <div className="flex flex-wrap items-center justify-center gap-3">
                <p className="text-xs text-muted">
                  Showing {visible.length} of {shown.length}
                </p>
                <Button variant="secondary" size="sm" onClick={() => setLimit((n) => n + PAGE)}>
                  Show {Math.min(PAGE, shown.length - visible.length)} more
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setLimit(shown.length)}>
                  Show all
                </Button>
              </div>
            ) : null}
          </>
        )}

        <InfoNote icon={<Lock />}>
          Append-only: entries can&apos;t be edited or deleted, and an undo is written as a new entry. The history above is synthetic; actions taken on the billing, team and settings pages in this browser session appear at the top, marked “This session”. Exports contain exactly the entries shown.
        </InfoNote>
      </section>
    </div>
  );
}

function RemovableChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="inline-flex h-10 items-center gap-1 rounded-full bg-charcoal pl-4 pr-1 text-sm text-white">
      <span className="max-w-[220px] truncate">{label}</span>
      <button type="button" onClick={onRemove} aria-label={`Remove filter: ${label}`} className="flex size-8 items-center justify-center rounded-full transition-colors hover:bg-white/15">
        <X size={14} />
      </button>
    </span>
  );
}

function ScopeTag({ e }: { e: AuditEvent }) {
  if (!e.scope) return <span className="text-xs text-faint">Not set</span>;
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-ink-2 [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-muted" title={SCOPE_HINT[e.scope]}>
      {SCOPE_ICON[e.scope]}
      {SCOPE_LABEL[e.scope]}
    </span>
  );
}

function TargetLink({ e }: { e: AuditEvent }) {
  if (!e.target) return <span className="text-xs text-faint">—</span>;
  const href = targetHref(e.target);
  return href ? (
    <Link href={href} className="group block max-w-full text-sm text-ink underline-offset-2 hover:underline">
      <span className="line-clamp-2">
        {e.target.label}
        <ArrowUpRight size={12} className="ml-1 inline align-[-1px] text-muted transition-transform group-hover:-translate-y-px group-hover:translate-x-px" aria-hidden="true" />
      </span>
    </Link>
  ) : (
    <span className="block truncate text-sm text-ink-2">{e.target.label}</span>
  );
}

function ActorCell({ e }: { e: AuditEvent }) {
  const a = actorOf(e);
  return (
    <span className="flex min-w-0 items-center gap-2.5">
      <Avatar src={a.avatar} name={a.name} size="sm" />
      <span className="min-w-0">
        <span className="block truncate text-sm text-ink">{a.name}</span>
        <span className="block truncate text-xs text-muted">{a.role}</span>
      </span>
    </span>
  );
}

function EntryRow({ e }: { e: AuditEvent }) {
  return (
    <tr className={cn("border-t border-line align-top", e.local && "bg-primary-soft/40")}>
      <td className="py-3 pl-6 pr-3 font-mono text-[13px] text-ink-2 tabular">{formatTime(e.at)}</td>
      <td className="px-3 py-3">
        <ActorCell e={e} />
      </td>
      <td className="px-3 py-3">
        <p className="text-sm text-ink">{e.action}</p>
        <p className="mt-0.5 text-xs text-muted">
          {AUDIT_CATEGORY_LABEL[e.category]}
          {e.detail ? ` · ${e.detail}` : ""}
        </p>
        {e.local ? <StatusBadge tone="info" className="mt-1.5">This session</StatusBadge> : null}
      </td>
      <td className="px-3 py-3">
        <TargetLink e={e} />
      </td>
      <td className="py-3 pl-3 pr-6">
        <ScopeTag e={e} />
      </td>
    </tr>
  );
}

function EntryCard({ e }: { e: AuditEvent }) {
  return (
    <li className={cn("flex flex-col gap-3 rounded-inner p-4", e.local ? "bg-primary-soft/60" : "bg-surface")}>
      <div className="flex items-center justify-between gap-3">
        <span className="font-mono text-[13px] text-ink-2 tabular">{formatTime(e.at)}</span>
        <ScopeTag e={e} />
      </div>
      <ActorCell e={e} />
      <div>
        <p className="text-sm text-ink">{e.action}</p>
        <p className="mt-0.5 text-xs text-muted">
          {AUDIT_CATEGORY_LABEL[e.category]}
          {e.detail ? ` · ${e.detail}` : ""}
        </p>
      </div>
      {e.target || e.local ? (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <TargetLink e={e} />
          {e.local ? <StatusBadge tone="info">This session</StatusBadge> : null}
        </div>
      ) : null}
    </li>
  );
}

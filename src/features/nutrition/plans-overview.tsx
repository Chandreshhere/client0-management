"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { motion } from "motion/react";
import { ArrowUpRight, CalendarCheck, CaretDown, ForkKnife, NotePencil, Plus, SortAscending, Stack, Warning, ClipboardText, ListPlus, Check } from "@phosphor-icons/react";
import { ChipGroup, SectionLabel } from "@/components/viz/cards";
import { IconButton } from "@/components/ui/icon-button";
import type { PlanStatus } from "@/data/types";
import { PLAN_STATUS_LABEL } from "@/data/programs";
import { PATIENTS, clinicNumber, patientById } from "@/data/patients";
import { STAFF, staffById } from "@/data/staff";
import { REFERRALS } from "@/data/care";
import { TODAY, formatDate, formatTime, pluralize, relativeTime } from "@/lib/format";
import { cn } from "@/lib/cn";
import { spring } from "@/lib/motion";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, Group, GroupHeader } from "@/components/ui/card";
import { Dialog, ModalContent } from "@/components/ui/dialog";
import { Dropdown, DropdownContent, DropdownLabel, DropdownRadioGroup, DropdownRadioItem, DropdownTrigger } from "@/components/ui/dropdown";
import { Field, Input, SearchInput, Select } from "@/components/ui/input";
import { EmptyState, PageHeader, Stat } from "@/components/ui/misc";
import { Pill } from "@/components/ui/pill";
import { Segmented } from "@/components/ui/segmented";
import { StatusBadge } from "@/components/ui/status";
import { Tip } from "@/components/ui/tooltip";
import { useToast } from "@/components/ui/toast";
import { useRole } from "@/components/shell/role-context";
import { GUIDANCE, TEMPLATES, templateById, type FoodLog } from "./data";
import { PLAN_TONE, followedVersion, newId, nowIso, type PlanRecord } from "./model";
import { planFocus, type PlanFocus } from "./insight";
import { LogsTile, MacroTiles, OrganBadge, PlanOrganCard } from "./viz";
import { planActions, taskActions, useNutrition } from "./store";
import { DietMark, SelfReported, preferenceDiet } from "./ui";

/** /nutrition — the nutritionist's plan list (doc §2C): KPIs, today's reviews, filterable versioned plans. */

type StatusFilter = "all" | PlanStatus;
type SortKey = "review" | "updated" | "patient";

const WEEK_START = new Date("2026-11-09T00:00:00+05:30").getTime();
const DAY_END = new Date("2026-11-13T23:59:59+05:30").getTime();
const isToday = (iso: string) => iso.startsWith("2026-11-13");

const SORT_LABEL: Record<SortKey, string> = { review: "Next review", updated: "Recently updated", patient: "Patient A–Z" };

const builderHref = (id: string) => `/nutrition/builder?plan=${id}`;

export function NutritionPlans() {
  const router = useRouter();
  const { toast } = useToast();
  const { role, user, has } = useRole();
  const state = useNutrition();
  const isNutritionist = role === "nutritionist";

  const [author, setAuthor] = useState<string>(isNutritionist ? user.id : "all");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("review");
  const [newOpen, setNewOpen] = useState(false);
  const [systems, setSystems] = useState<string[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const plans = useMemo(() => state.order.map((id) => state.plans[id]).filter(Boolean), [state.order, state.plans]);
  const logs = useMemo(() => Object.values(state.logs), [state.logs]);
  /** the body system each plan addresses, from the patient's record (organ glyphs + system filter) */
  const focusOf = useMemo(() => new Map(plans.map((p) => [p.id, planFocus(p.patientId)])), [plans]);
  const scoped = useMemo(() => (author === "all" ? plans : plans.filter((p) => p.authorId === author)), [plans, author]);
  const scopedPatients = useMemo(() => new Set(scoped.map((p) => p.patientId)), [scoped]);

  const kpi = useMemo(() => {
    const drafts = scoped.filter((p) => p.status === "draft");
    const review = scoped.filter((p) => p.status === "in-review");
    const publishedWeek = scoped.filter((p) => p.status === "published" && new Date(p.updatedAt).getTime() >= WEEK_START);
    const logs = Object.values(state.logs).filter((l) => l.status === "new" && scopedPatients.has(l.patientId));
    const oldest = logs.map((l) => l.loggedAt).sort()[0];
    return { drafts, review, publishedWeek, logs, oldest };
  }, [scoped, state.logs, scopedPatients]);

  const dueToday = useMemo(
    () => scoped.filter((p) => isToday(p.nextReview) && p.status !== "superseded").sort((a, b) => a.nextReview.localeCompare(b.nextReview)),
    [scoped],
  );

  // Referrals to nutrition nobody has accepted yet (doc §5B: show where progress stopped).
  const waitingReferrals = useMemo(
    () => REFERRALS.filter((r) => r.toDiscipline === "nutrition" && r.stage === "requested" && (author === "all" || r.toId === author)).sort((a, b) => a.dueBy.localeCompare(b.dueBy)),
    [author],
  );

  const counts = useMemo(() => {
    const c: Record<StatusFilter, number> = { all: scoped.length, draft: 0, "in-review": 0, published: 0, superseded: 0 };
    for (const p of scoped) c[p.status] += 1;
    return c;
  }, [scoped]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = scoped.filter((p) => {
      if (status !== "all" && p.status !== status) return false;
      if (systems.length && !systems.includes(focusOf.get(p.id)?.system.name ?? "none")) return false;
      if (!q) return true;
      const name = patientById(p.patientId)?.name ?? "";
      return `${name} ${p.title} ${p.preference}`.toLowerCase().includes(q);
    });
    return [...list].sort((a, b) => {
      if (sort === "updated") return b.updatedAt.localeCompare(a.updatedAt);
      if (sort === "patient") return (patientById(a.patientId)?.name ?? "").localeCompare(patientById(b.patientId)?.name ?? "");
      return a.nextReview.localeCompare(b.nextReview);
    });
  }, [scoped, status, query, sort, systems, focusOf]);

  // System chips: the body systems the plans in this view address (counts ignore the chip itself).
  const systemOptions = useMemo(() => {
    const counts = new Map<string, number>();
    for (const p of scoped) {
      if (status !== "all" && p.status !== status) continue;
      const name = focusOf.get(p.id)?.system.name ?? "none";
      counts.set(name, (counts.get(name) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([name, count]) => ({ value: name, label: name === "none" ? "No condition recorded" : name, count }));
  }, [scoped, status, focusOf]);

  const focusPlan = rows.find((p) => p.id === selectedId) ?? rows[0] ?? null;

  const authors = STAFF.filter((s) => s.role === "nutritionist");
  const authorOptions = [
    { value: "all", label: "All nutritionists" },
    ...authors.map((s) => ({ value: s.id, label: s.id === user.id ? `${s.name} (you)` : s.name })),
  ];

  const followUp = (plan: PlanRecord) => {
    const coordinator = has("coordinator");
    const ownerId = coordinator ? "s-farhan" : "s-sneha";
    const patient = patientById(plan.patientId);
    taskActions.add({ id: newId("task"), title: `Rebook missed nutrition review — ${patient?.name}`, patientId: plan.patientId, ownerId, createdBy: user.id, at: nowIso() });
    toast({
      title: `Follow-up task created for ${staffById(ownerId)?.name}`,
      description: coordinator ? "Recorded in this browser session — nothing was sent." : "Coordinator workspace is on the Clinic plan, so it went to the front desk. Recorded locally only.",
      tone: "success",
    });
  };

  const followedUp = (patientId: string) => state.tasks.some((t) => t.patientId === patientId);
  const newPlanButton = (
    <Button variant="primary" leading={<Plus weight="bold" />} onClick={() => setNewOpen(true)} disabled={!isNutritionist}>
      New plan
    </Button>
  );

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Nutrition plans"
        description="Every plan is versioned. Patients only see the published version — drafts and reviews stay with the care team."
        actions={
          <>
            <Button asChild variant="secondary" leading={<ForkKnife />}>
              <Link href="/nutrition/logs">Food logs</Link>
            </Button>
            {isNutritionist ? (
              newPlanButton
            ) : (
              <Tip label="Only nutritionists create meal plans">
                <span tabIndex={0} className="rounded-full">{newPlanButton}</span>
              </Tip>
            )}
          </>
        }
      />

      <section aria-label="Plan summary" className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Drafts" icon={<NotePencil />} value={kpi.drafts.length} context={namesOf(kpi.drafts) || "None open"} />
        <Stat label="In review" icon={<ClipboardText />} value={kpi.review.length} context={kpi.review.map((p) => `${firstName(p.patientId)} · v${p.version}`).join(", ") || "Nothing waiting"} />
        <Stat label="Published this week" icon={<Check />} value={kpi.publishedWeek.length} context={kpi.publishedWeek.map((p) => `${firstName(p.patientId)} v${p.version}`).join(" · ") || "None since Monday"} />
        <Link href="/nutrition/logs" className="group rounded-card outline-offset-2 transition-transform duration-300 [transition-timing-function:var(--ease-spring)] active:scale-[0.99]">
          <Stat
            className="h-full transition-colors group-hover:bg-surface/70"
            label="Food logs to review"
            icon={<ArrowUpRight />}
            value={kpi.logs.length}
            context={kpi.oldest ? `Self-reported · oldest ${formatDate(kpi.oldest, { day: "numeric", month: "short" })}` : "All caught up"}
          />
        </Link>
      </section>

      <Group aria-label="Needs you today">
        <GroupHeader
          icon={<CalendarCheck />}
          title="Needs you today"
          subtitle={`${formatDate(TODAY.toISOString(), { weekday: "short", day: "numeric", month: "short" })} · ${pluralize(dueToday.length, "review")} · ${pluralize(waitingReferrals.length, "referral")} awaiting acceptance`}
          href="/schedule"
          actionLabel="Open schedule"
        />
        {dueToday.length || waitingReferrals.length ? (
          <ul className="grid grid-cols-1 gap-2 md:grid-cols-2 2xl:grid-cols-4">
            {dueToday.map((p) => {
              const patient = patientById(p.patientId);
              const missed = new Date(p.nextReview).getTime() < TODAY.getTime();
              return (
                <li key={p.id} className="flex flex-col gap-4 rounded-inner bg-surface p-4">
                  <div className="flex items-center gap-3">
                    <Avatar src={patient?.avatar} name={patient?.name ?? "Patient"} size="md" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-ink">{patient?.name}</p>
                      <p className="truncate text-xs text-muted">{p.title}</p>
                    </div>
                    <span className={cn("text-sm tabular", missed ? "text-danger" : "text-ink")}>{formatTime(p.nextReview)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    {missed ? <StatusBadge tone="danger">Missed · not rebooked</StatusBadge> : <StatusBadge tone="info">{p.status === "draft" ? "Assessment" : "Review"}</StatusBadge>}
                    {missed ? (
                      followedUp(p.patientId) ? (
                        <span className="flex items-center gap-1 text-xs text-success"><Check size={14} aria-hidden="true" /> Follow-up task created</span>
                      ) : (
                        <Button size="sm" variant="dark" leading={<ListPlus />} onClick={() => followUp(p)}>Create follow-up</Button>
                      )
                    ) : (
                      <Button asChild size="sm" variant="secondary" trailing={<ArrowUpRight />}>
                        <Link href={builderHref(p.id)}>Open plan</Link>
                      </Button>
                    )}
                  </div>
                </li>
              );
            })}
            {waitingReferrals.map((r) => {
              const patient = patientById(r.patientId);
              const from = staffById(r.fromId);
              const overdue = new Date(r.dueBy).getTime() < TODAY.getTime();
              return (
                <li key={r.id} className="flex flex-col gap-4 rounded-inner bg-surface p-4">
                  <div className="flex items-center gap-3">
                    <Avatar src={patient?.avatar} name={patient?.name ?? "Patient"} size="md" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-ink">{patient?.name}</p>
                      <p className="truncate text-xs text-muted">{r.reason}</p>
                    </div>
                    <span className="text-right text-xs text-muted">
                      from
                      <span className="block text-ink-2">{from?.name.replace("Dr. ", "Dr ")}</span>
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <StatusBadge tone={overdue ? "danger" : "warning"}>{overdue ? `Overdue since ${formatDate(r.dueBy, { day: "numeric", month: "short" })}` : `Accept by ${formatTime(r.dueBy)}`}</StatusBadge>
                    <Button asChild size="sm" variant="secondary" trailing={<ArrowUpRight />}>
                      <Link href="/referrals">Open referral</Link>
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="rounded-inner bg-surface p-4 text-sm text-muted">Nothing is due today for this selection.</p>
        )}
      </Group>

      <section aria-label="Plans" className="@container">
        <div className="grid grid-cols-1 gap-6 @[1040px]:grid-cols-[minmax(0,1fr)_392px]">
          <Card padded={false} className="min-w-0 overflow-hidden">
            <div className="flex flex-col gap-4 p-6 pb-4">
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                  <h2 className="text-lg font-normal tracking-[-0.01em] text-ink">Plans</h2>
                  <p className="mt-1 text-sm text-muted">
                    {author === "all" ? "All nutritionists" : author === user.id ? "Your caseload" : staffById(author)?.name} · <span className="hidden @[1040px]:inline">select a plan to preview it</span>
                    <span className="@[1040px]:hidden">open a plan to edit it in the builder</span>
                  </p>
                </div>
                <div className="flex w-full flex-wrap items-center gap-2">
                  <SearchInput aria-label="Search plans" placeholder="Search patient or plan" value={query} onChange={(e) => setQuery(e.target.value)} className="w-full @[560px]:w-56" />
                  <Select ariaLabel="Author" value={author} onValueChange={setAuthor} options={authorOptions} className="w-auto min-w-[188px] flex-1 @[560px]:flex-none" />
                  <Dropdown>
                    <DropdownTrigger asChild>
                      <Button variant="secondary" leading={<SortAscending />} trailing={<CaretDown size={14} />} aria-label={`Sort: ${SORT_LABEL[sort]}`}>
                        <span className="hidden sm:inline">{SORT_LABEL[sort]}</span>
                      </Button>
                    </DropdownTrigger>
                    <DropdownContent className="w-[220px]">
                      <DropdownLabel>Sort plans by</DropdownLabel>
                      <DropdownRadioGroup value={sort} onValueChange={(v) => setSort(v as SortKey)}>
                        {(Object.keys(SORT_LABEL) as SortKey[]).map((k) => (
                          <DropdownRadioItem key={k} value={k}>{SORT_LABEL[k]}</DropdownRadioItem>
                        ))}
                      </DropdownRadioGroup>
                    </DropdownContent>
                  </Dropdown>
                </div>
              </div>
              <div className="scrollbar-none -mx-6 overflow-x-auto px-6" data-lenis-prevent>
                <Segmented
                  ariaLabel="Plan status"
                  size="sm"
                  value={status}
                  onChange={setStatus}
                  items={[
                    { value: "all", label: "All", count: counts.all },
                    { value: "draft", label: PLAN_STATUS_LABEL.draft, count: counts.draft },
                    { value: "in-review", label: PLAN_STATUS_LABEL["in-review"], count: counts["in-review"] },
                    { value: "published", label: PLAN_STATUS_LABEL.published, count: counts.published },
                    { value: "superseded", label: PLAN_STATUS_LABEL.superseded, count: counts.superseded },
                  ]}
                />
              </div>
              {systemOptions.length > 1 ? (
                <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                  <span className="text-xs text-muted">Addresses</span>
                  <ChipGroup ariaLabel="Filter by the body system the plan addresses" variant="dark" options={systemOptions} value={systems} onChange={setSystems} />
                </div>
              ) : null}
            </div>

            {rows.length === 0 ? (
              <EmptyState
                icon={<Stack />}
                title="No plans match"
                description={query ? `Nothing matches “${query}” in this view.` : "No plans with this status or body system for the selected nutritionist."}
                action={<Button size="sm" variant="secondary" onClick={() => { setQuery(""); setStatus("all"); setAuthor("all"); setSystems([]); }}>Clear filters</Button>}
              />
            ) : (
              <ul className="flex flex-col gap-1 px-2 pb-2" aria-label={`Plans, ${SORT_LABEL[sort].toLowerCase()} order`}>
                {rows.map((p) => (
                  <PlanRow key={p.id} plan={p} focus={focusOf.get(p.id) ?? null} selected={focusPlan?.id === p.id} onSelect={() => setSelectedId(p.id)} />
                ))}
              </ul>
            )}
          </Card>

          <aside aria-label="Selected plan" className="flex min-w-0 flex-col gap-4 @[1040px]:sticky @[1040px]:top-24 @[1040px]:self-start">
            {focusPlan ? (
              <PlanFocusPanel plan={focusPlan} plans={rows} logs={logs} onSelect={setSelectedId} />
            ) : (
              <Card>
                <p className="text-sm text-muted">Select a plan to see the body system it addresses and its day against the doctor&apos;s targets.</p>
              </Card>
            )}
          </aside>
        </div>
      </section>

      <NewPlanModal
        open={newOpen}
        onOpenChange={setNewOpen}
        existing={new Set(plans.filter((p) => p.status !== "superseded").map((p) => p.patientId))}
        onCreate={(input) => {
          const id = newId("np-local");
          planActions.create({ ...input, id, by: user.id, at: nowIso() });
          setNewOpen(false);
          setStatus("all");
          toast({ title: "Draft v1 created in this browser session", description: "It stays a draft until you review every slot and publish.", tone: "success", action: { label: "Open builder", onClick: () => router.push(builderHref(id)) } });
        }}
      />
    </div>
  );
}

const firstName = (patientId: string) => patientById(patientId)?.name.split(" ")[0] ?? "Patient";
const namesOf = (plans: PlanRecord[]) => plans.slice(0, 2).map((p) => patientById(p.patientId)?.name).join(", ") + (plans.length > 2 ? ` +${plans.length - 2}` : "");

function splitNote(note: string) {
  const self = /\(self-reported\)/i.test(note);
  return { text: note.replace(/\s*\(self-reported\)\s*/i, ""), self };
}

function NextReview({ iso }: { iso: string }) {
  const t = new Date(iso).getTime();
  const missed = t < TODAY.getTime();
  const today = isToday(iso);
  if (today) {
    return (
      <span className={cn("flex flex-col", missed ? "text-danger" : "text-ink")}>
        <span className="tabular">{missed ? "Missed" : "Today"} {formatTime(iso)}</span>
        <span className="text-xs text-muted">{missed ? "Not rebooked" : relativeTime(iso)}</span>
      </span>
    );
  }
  return (
    <span className="flex flex-col text-ink-2">
      <span className="tabular">{formatDate(iso, { weekday: "short", day: "numeric", month: "short" })}</span>
      <span className="text-xs text-muted">{t > DAY_END ? relativeTime(iso) : formatTime(iso)}</span>
    </span>
  );
}

/**
 * One plan: the organ of the body system it addresses (from the patient's record), patient, plan,
 * status and next review. Wide screens: the row previews the plan in the side panel; phones: the
 * row opens the builder. The title always opens the builder.
 */
function PlanRow({ plan, focus, selected, onSelect }: { plan: PlanRecord; focus: PlanFocus | null; selected: boolean; onSelect: () => void }) {
  const patient = patientById(plan.patientId);
  const author = staffById(plan.authorId);
  const note = splitNote(plan.adherenceNote);
  return (
    <motion.li
      layout="position"
      transition={spring}
      className={cn(
        "relative rounded-inner p-3 transition-[background-color,box-shadow] duration-200",
        selected ? "bg-canvas @[1040px]:shadow-[inset_0_0_0_1.5px_var(--color-line-strong)]" : "hover:bg-canvas",
      )}
    >
      <button type="button" onClick={onSelect} aria-pressed={selected} aria-label={`Preview ${patient?.name}'s plan`} className="absolute inset-0 hidden rounded-inner @[1040px]:block" />
      <Link href={builderHref(plan.id)} aria-label={`Open ${patient?.name}'s plan in the builder`} className="absolute inset-0 rounded-inner @[1040px]:hidden" />
      <div className="pointer-events-none relative grid grid-cols-[48px_minmax(0,1fr)_auto] items-start gap-x-3 gap-y-2">
        <OrganBadge focus={focus} className="row-span-2" />
        <div className="min-w-0">
          <p className="flex min-w-0 items-baseline gap-2">
            <span className="truncate text-sm text-ink">{patient?.name}</span>
            <span className="hidden shrink-0 font-mono text-[11px] text-muted @[560px]:inline">{clinicNumber(plan.patientId)}</span>
          </p>
          <p className="truncate text-xs text-muted">{focus ? `${focus.system.name}${focus.condition ? ` · ${focus.condition.name}` : ""}` : "No condition recorded yet"}</p>
        </div>
        <StatusBadge tone={PLAN_TONE[plan.status]}>{PLAN_STATUS_LABEL[plan.status]}</StatusBadge>
        <div className="col-start-2 min-w-0">
          <Link href={builderHref(plan.id)} className="pointer-events-auto relative rounded-md text-sm text-ink-2 underline-offset-4 hover:text-ink hover:underline">
            {plan.title}
          </Link>
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            <Pill size="sm" tone={selected ? "white" : "neutral"} icon={<DietMark diet={preferenceDiet(plan.preference)} />}>{plan.preference}</Pill>
            <span className="font-mono text-[11px] text-muted">v{plan.version}</span>
            {plan.createdLocally ? <Pill size="sm" tone="primary">New · this session</Pill> : null}
            <span className="text-xs text-muted">· {relativeTime(plan.updatedAt)} · {author?.name.split(" ")[0] ?? "—"}</span>
          </div>
        </div>
        <div className="col-start-3 row-start-2 text-right text-sm">
          <NextReview iso={plan.nextReview} />
        </div>
        <p className="col-span-2 col-start-2 flex flex-wrap items-center gap-2 text-xs text-ink-2">
          {note.text}
          {note.self ? <SelfReported /> : null}
        </p>
      </div>
    </motion.li>
  );
}

/**
 * Selected plan at a glance (refs 3 & 6): the organ of the system it addresses with the marker to
 * watch, then the plan's day against the doctor's targets and the patient's self-reported logging.
 */
function PlanFocusPanel({ plan, plans, logs, onSelect }: { plan: PlanRecord; plans: PlanRecord[]; logs: FoodLog[]; onSelect: (id: string) => void }) {
  const patient = patientById(plan.patientId);
  const first = patient?.name.split(" ")[0] ?? "Patient";
  const guidance = GUIDANCE[plan.patientId];
  const doctor = guidance ? staffById(guidance.by) : undefined;
  const targets = guidance?.targets ?? { kcal: plan.calories, protein: 60, fibre: 25 };
  const follows = followedVersion(plan);
  return (
    <>
      <Select
        ariaLabel="Plan to preview"
        value={plan.id}
        onValueChange={onSelect}
        className="@[1040px]:hidden"
        options={plans.map((p) => ({ value: p.id, label: patientById(p.patientId)?.name ?? p.id, description: p.title }))}
      />
      <PlanOrganCard
        key={plan.id}
        patientId={plan.patientId}
        className="anim-pop"
        heroClassName="max-w-[200px]"
        header={
          <div className="mb-2 flex items-center gap-3">
            <Avatar src={patient?.avatar} name={patient?.name ?? "Patient"} size="md" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm text-ink">{patient?.name}</p>
              <p className="truncate text-xs text-muted">{patient?.age} · {patient?.primaryConcern}</p>
            </div>
            <IconButton asChild label={`Open ${first}'s plan in the builder`} tooltip="left" variant="soft">
              <Link href={builderHref(plan.id)}>
                <ArrowUpRight />
              </Link>
            </IconButton>
          </div>
        }
      />
      <section aria-label={`${first}'s plan day against targets`}>
        <SectionLabel actions={<StatusBadge tone={PLAN_TONE[plan.status]}>v{plan.version} · {PLAN_STATUS_LABEL[plan.status]}</StatusBadge>}>Plan day vs targets</SectionLabel>
        <div className="grid grid-cols-1 gap-3 @[480px]:grid-cols-2">
          <MacroTiles slots={plan.slots} targets={targets} tileClassName={(id) => (id === "kcal" ? "@[480px]:col-span-2" : undefined)} />
          <LogsTile logs={logs} patientId={plan.patientId} className="@[480px]:col-span-2" />
        </div>
        <p className="mt-2 text-xs text-muted">
          Bars: each meal slot, early morning → dinner. Targets from {doctor ? `${doctor.name}'s guidance ${guidance?.version}` : "the plan"}. {follows ? `${first} follows v${follows}.` : `${first} has no published version yet.`} Logs are self-reported.
        </p>
      </section>
    </>
  );
}

const PREFERENCES = ["Vegetarian", "Eggetarian", "Jain", "Non-vegetarian"];

function NewPlanModal({
  open,
  onOpenChange,
  existing,
  onCreate,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  existing: Set<string>;
  onCreate: (input: { patientId: string; title: string; preference: string; templateId: string | null }) => void;
}) {
  const [patientId, setPatientId] = useState("");
  const [templateId, setTemplateId] = useState("blank");
  const [title, setTitle] = useState("");
  const [preference, setPreference] = useState("Vegetarian");
  const [tried, setTried] = useState(false);

  const candidates = PATIENTS.filter((p) => !existing.has(p.id) && p.status !== "completed");
  const errors = { patient: !patientId ? "Choose a patient" : null, title: !title.trim() ? "Give the plan a short title" : null };

  const reset = () => {
    setPatientId("");
    setTemplateId("blank");
    setTitle("");
    setPreference("Vegetarian");
    setTried(false);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) reset(); }}>
      <ModalContent
        title="New meal plan"
        description="Starts as Draft v1. A reusable template is only a starting point — every slot needs individual review before publishing."
        footer={
          <>
            <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button
              variant="dark"
              onClick={() => {
                setTried(true);
                if (errors.patient || errors.title) return;
                onCreate({ patientId, title: title.trim(), preference, templateId: templateId === "blank" ? null : templateId });
                reset();
              }}
            >
              Create draft
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <Field label="Patient" error={tried ? errors.patient : null} hint="Patients who already have a current plan are opened from the list instead.">
            {(a) => (
              <Select
                id={a.id}
                value={patientId || undefined}
                onValueChange={setPatientId}
                placeholder="Choose a patient"
                options={candidates.map((p) => ({ value: p.id, label: p.name, description: p.primaryConcern }))}
              />
            )}
          </Field>
          <Field label="Start from" hint="Templates carry reviewed swaps; you still check each slot for this patient.">
            {(a) => (
              <Select
                id={a.id}
                value={templateId}
                onValueChange={(v) => {
                  setTemplateId(v);
                  const t = templateById(v);
                  if (t) {
                    setPreference(t.preference);
                    if (!title.trim()) setTitle(t.name);
                  }
                }}
                options={[{ value: "blank", label: "Blank plan", description: "Six empty meal slots" }, ...TEMPLATES.map((t) => ({ value: t.id, label: t.name, description: t.description }))]}
              />
            )}
          </Field>
          <Field label="Plan title" error={tried ? errors.title : null}>
            {(a) => <Input {...a} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Heart-healthy vegetarian · South Indian" />}
          </Field>
          <Field label="Food preference">
            {(a) => <Select id={a.id} value={preference} onValueChange={setPreference} options={PREFERENCES.map((p) => ({ value: p, label: p }))} />}
          </Field>
          <p className="flex items-start gap-2 rounded-inner bg-warning-soft p-4 text-xs text-warning">
            <Warning size={16} className="mt-px shrink-0" aria-hidden="true" />
            Created in this browser session only — no record is written to a server in this prototype.
          </p>
        </div>
      </ModalContent>
    </Dialog>
  );
}

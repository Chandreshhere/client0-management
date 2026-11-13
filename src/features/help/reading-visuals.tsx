"use client";

import Link from "next/link";
import { useMemo, type ReactNode } from "react";
import { ArrowUpRight, Path } from "@phosphor-icons/react";
import type { OrganKind } from "@/data/anatomy";
import { ORGAN_LABEL, SYSTEM_INFO, organForSystem, patientSystems } from "@/data/anatomy";
import { LINK_LABEL, type LinkKind } from "@/data/featured";
import { PATIENTS, FEATURED_PATIENT_ID, patientById } from "@/data/patients";
import { getRecord } from "@/data/record";
import { systemShares } from "@/data/insights";
import { formatDate } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Group, GroupHeader, Inset, SectionTitle } from "@/components/ui/card";
import { BodyConditionCard, WaveSpark } from "@/components/viz/condition";
import { OrganImage } from "@/components/viz/organ";
import { primaryConditionOf, systemHistory } from "@/features/patients/anatomy";

/**
 * Help → "Reading the visuals": what every organ, percentage, line and mark means, worked from
 * the live demo data (nothing here is typed in by hand), plus how the Journey tab is built.
 */

const FEATURED = patientById(FEATURED_PATIENT_ID)!;
/** "Blood Circulatory → heart · Respiratory → lungs · …", straight from the anatomy model. */
const SYSTEM_ORGANS = Object.values(SYSTEM_INFO)
  .map((s) => `${s.name} → ${s.organLabel.toLowerCase()}`)
  .join(" · ");
const LINK_ORDER: LinkKind[] = ["ordered", "reviewed-in", "led-to", "referred", "revised", "follow-up"];
const JOURNEY_LANES = [
  { label: "Medical", hint: "consults, notes, medication" },
  { label: "Diagnostics", hint: "labs, imaging, tests" },
  { label: "Nutrition", hint: "plans and reviews" },
  { label: "Movement", hint: "yoga and mobility" },
  { label: "Patient-reported", hint: "self-reported logs" },
];

function useOrganMap() {
  return useMemo(() => {
    const rows = new Map<OrganKind, { organ: OrganKind; systems: Set<string>; conditions: Set<string>; patients: Set<string>; lead: number }>();
    const none: string[] = [];
    for (const p of PATIENTS) {
      const lead = primaryConditionOf(p)?.organ ?? null;
      if (!lead) none.push(p.name);
      for (const s of patientSystems(p)) {
        const organ = organForSystem(s.key, s.conditions);
        const row = rows.get(organ) ?? { organ, systems: new Set<string>(), conditions: new Set<string>(), patients: new Set<string>(), lead: 0 };
        row.systems.add(SYSTEM_INFO[s.key].name);
        s.conditions.forEach((c) => row.conditions.add(c));
        if (!row.patients.has(p.id) && organ === lead) row.lead += 1;
        row.patients.add(p.id);
        rows.set(organ, row);
      }
    }
    return { rows: [...rows.values()].sort((a, b) => b.patients.size - a.patients.size || ORGAN_LABEL[a.organ].localeCompare(ORGAN_LABEL[b.organ])), none };
  }, []);
}

function useFeaturedFacts() {
  return useMemo(() => {
    const record = getRecord(FEATURED_PATIENT_ID)!;
    const shares = systemShares(record);
    const linkCounts = LINK_ORDER.map((kind) => ({ kind, count: record.events.reduce((n, e) => n + (e.links ?? []).filter((l) => l.kind === kind).length, 0) })).filter((l) => l.count > 0);
    // identical to the Journey tab's default view (all event types, latest year)
    const year = record.years[0];
    const evs = record.events.filter((e) => e.date.startsWith(String(year)));
    const ids = new Set(evs.map((e) => e.id));
    const yearLinks = evs.reduce((n, e) => n + (e.links ?? []).filter((l) => ids.has(l.to)).length, 0);
    return { shares, linkCounts, year, yearEvents: evs.length, yearLinks };
  }, []);
}

/** A real reading series to explain the trend line: the first lab value with ≥4 readings in a record. */
function useTrendExample() {
  return useMemo(() => {
    for (const source of ["Lab", "Clinic"] as const) {
      for (const p of PATIENTS) {
        if (p.id === FEATURED_PATIENT_ID) continue;
        const record = getRecord(p.id);
        const s = record?.systems[0];
        if (!record || !s) continue;
        const label = s.vitals.find((v) => v.source === source && v.label !== "No readings yet")?.label;
        if (!label) continue;
        const hist = systemHistory(record, s.id, label);
        if (hist.length >= 4) {
          const unit = record.events.flatMap((e) => e.values ?? []).find((v) => v.label === label)?.unit ?? "";
          return { patient: p, label, unit, hist };
        }
      }
    }
    return null;
  }, []);
}

export function ReadingVisuals() {
  const organs = useOrganMap();
  const facts = useFeaturedFacts();
  const trend = useTrendExample();
  const maxLinks = Math.max(1, ...facts.linkCounts.map((l) => l.count));
  const first = FEATURED.name.split(" ")[0];
  const since = (() => {
    const d = new Date("2026-11-13T00:00:00Z");
    d.setUTCMonth(d.getUTCMonth() - 12);
    return formatDate(`${d.toISOString().slice(0, 10)}T00:00:00+05:30`, { day: "numeric", month: "short", year: "numeric" });
  })();

  return (
    <section id="reading-the-visuals" aria-labelledby="visuals-title" className="flex scroll-mt-28 flex-col gap-4">
      <SectionTitle
        as="h2"
        title={<span id="visuals-title">Reading the visuals</span>}
        description="Every organ, percentage, line and bar is computed from the patient's own record — nothing is decoration. Each example below is worked from the live demo data."
      />

      <div className="grid grid-cols-1 items-start gap-4 @[1080px]:grid-cols-2">
        {/* Organs */}
        <Group>
          <GroupHeader
            title="Organs"
            subtitle="Each patient's lead body system, from their conditions"
            href="/patients?view=browse"
            actionLabel="Browse patients with their organs"
          />
          <Inset className="py-1">
            <ul className="divide-y divide-line" aria-label="Organs in use in this clinic">
              {organs.rows.map((r) => (
                <li key={r.organ} className="flex items-center gap-3 py-2">
                  <span className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-canvas" aria-hidden="true">
                    <OrganImage kind={r.organ} className="size-10 scale-[1.3]" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-ink">
                      {ORGAN_LABEL[r.organ]} <span className="text-muted">· {[...r.systems].join(", ")}</span>
                    </p>
                    <p className="truncate text-xs text-muted" title={[...r.conditions].join(", ")}>
                      {[...r.conditions].join(", ")}
                    </p>
                  </div>
                  <p className="shrink-0 text-right text-xs text-muted">
                    <span className="tabular text-ink-2">{r.patients.size}</span> {r.patients.size === 1 ? "patient" : "patients"}
                    <span className="block">lead for <span className="tabular">{r.lead}</span></span>
                  </p>
                </li>
              ))}
              <li className="flex items-center gap-3 py-2">
                <span className="size-10 shrink-0 rounded-full border border-dashed border-line-strong" aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-ink">No organ</p>
                  <p className="text-xs text-muted">Nothing recorded yet — {organs.none.length ? organs.none.join(", ") : "nobody right now"}. An honest empty state, never a default heart.</p>
                </div>
              </li>
            </ul>
          </Inset>
          <p className="px-2 pb-1 pt-3 text-xs text-muted">
            One organ model per body system: {SYSTEM_ORGANS}. Knee, osteoarthritis and rheumatoid arthritis show the knee joint.
          </p>
        </Group>

        <div className="flex flex-col gap-4">
          {/* Percentages */}
          <Group>
            <GroupHeader title="Percentages" subtitle={`Share of care activity · ${first}'s record`} />
            <div className="grid grid-cols-1 gap-2 @[640px]:grid-cols-3 @[1080px]:grid-cols-1">
              {facts.shares.map((s) => (
                <BodyConditionCard
                  key={s.id}
                  className="rounded-inner"
                  icon={<OrganImage kind={s.organ} className="size-9 scale-[1.3]" />}
                  label={s.name}
                  percent={s.percent}
                  progress={{ value: s.events, max: Math.max(1, s.total) }}
                  count={s.open}
                />
              ))}
            </div>
            <p className="px-2 pb-1 pt-3 text-xs text-muted">
              % = that system&apos;s dated events ÷ all of {first}&apos;s dated events since {since}
              {facts.shares[0] ? ` (${facts.shares[0].name}: ${facts.shares[0].events} of ${facts.shares[0].total})` : ""}. The bar shows the same fraction; the badge counts open items — awaiting review, scheduled or draft.
            </p>
          </Group>

          {/* Lines */}
          <Group>
            <GroupHeader title="Lines" subtitle="Only where the record relates two things" />
            <Inset>
              <p className="text-sm text-ink-2">
                <span className="text-ink">Overview threads</span> run from a condition to an event that was documented against it.{" "}
                <span className="text-ink">Journey connectors</span> join two events only when one documents a link to the other — never because they sit next to each other.
              </p>
              <h3 className="mt-4 text-xs text-muted">Documented links in {first}&apos;s record, by kind</h3>
              <ul className="mt-2 flex flex-col gap-2">
                {facts.linkCounts.map((l) => (
                  <li key={l.kind} className="grid grid-cols-[96px_minmax(0,1fr)_32px] items-center gap-3">
                    <span className="truncate text-xs text-ink-2">{LINK_LABEL[l.kind]}</span>
                    <span className="h-2 overflow-hidden rounded-full bg-sunken" aria-hidden="true">
                      <span className="block h-full rounded-full bg-charcoal" style={{ width: `${(l.count / maxLinks) * 100}%` }} />
                    </span>
                    <span className="text-right text-xs text-ink tabular">{l.count}</span>
                  </li>
                ))}
              </ul>
            </Inset>
          </Group>
        </div>

        {/* Readings & marks */}
        <Group>
          <GroupHeader title="Readings and marks" subtitle="What the small things mean" />
          <div className="flex flex-col gap-2">
            {trend ? (
              <Inset className="flex items-center gap-4">
                <div className="h-14 w-[136px] shrink-0">
                  <WaveSpark
                    values={trend.hist.map((h) => h.value)}
                    label={`${trend.label} for ${trend.patient.name}: ${trend.hist.length} readings from ${trend.hist[0].value} to ${trend.hist[trend.hist.length - 1].value} ${trend.unit}`}
                  />
                </div>
                <p className="min-w-0 text-xs text-muted">
                  <span className="block text-sm text-ink">Trend line = every reading of that value</span>
                  {trend.patient.name}&apos;s {trend.label}: {trend.hist.length} readings, {trend.hist[0].value} → {trend.hist[trend.hist.length - 1].value} {trend.unit}, oldest to newest. A single reading shows “first reading — no trend yet”.
                </p>
              </Inset>
            ) : null}
            <Inset className="py-1">
              <dl className="divide-y divide-line">
                <MarkRow mark={<span className="size-3 rounded-full bg-primary" />} term="Recorded event">A dated entry in the record — consult, lab, reading, plan.</MarkRow>
                <MarkRow mark={<span className="size-3 rounded-full bg-surface shadow-[inset_0_0_0_1.5px_var(--color-primary)]" />} term="Scheduled">Booked for a future date; it hasn&apos;t happened yet.</MarkRow>
                <MarkRow mark={<span className="size-3 rounded-full border border-dashed border-primary" />} term="Draft">Written but not signed — still editable.</MarkRow>
                <MarkRow mark={<span className="size-3 rounded-full bg-warning" />} term="Awaiting review">A result a clinician hasn&apos;t reviewed yet.</MarkRow>
                <MarkRow mark={<span className="size-3 rounded-full bg-ops" />} term="Grey">Other body systems — context for the one you selected.</MarkRow>
                <MarkRow mark={<span className="rounded-full bg-sunken px-2 py-0.5 text-[11px] text-ink-2">Self-reported</span>} term="Self-reported">Entered by the patient (diary, home device); not verified.</MarkRow>
                <MarkRow mark={<span className="text-xs text-warning">Above target</span>} term="Flags">Compared with that measurement&apos;s monitoring target.</MarkRow>
              </dl>
            </Inset>
          </div>
        </Group>

        {/* Journey */}
        <Group id="journey" className="scroll-mt-28">
          <GroupHeader icon={<Path />} title="The Journey tab" subtitle="One patient's care as a metro map" />
          <div className="flex flex-col gap-2">
            <Inset>
              <ul className="flex flex-col gap-2 text-sm text-ink-2">
                <li>
                  <span className="text-ink">Lanes</span> = who acted: {JOURNEY_LANES.map((l) => `${l.label} (${l.hint})`).join(" · ")}.
                </li>
                <li>
                  <span className="text-ink">Across</span> = the event date, by month. Pick a year at the top right.
                </li>
                <li>
                  <span className="text-ink">Connectors</span> = documented links: ordered → result → reviewed in → led to, referrals, revisions and follow-ups.
                </li>
                <li>
                  <span className="text-ink">Chips</span> filter by kind of record (docs, labs & tests, imaging, medications, visits, nutrition & movement) and by body system. Click a card to open the event.
                </li>
              </ul>
            </Inset>
            <Inset className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-ink">
                {FEATURED.name} · {facts.year}: <span className="tabular">{facts.yearEvents}</span> events, <span className="tabular">{facts.yearLinks}</span> documented links
                <span className="block text-xs text-muted">Patients with nothing recorded see an explanation instead of an empty map.</span>
              </p>
              <Button asChild variant="dark" size="sm">
                <Link href={`/patients/${FEATURED_PATIENT_ID}/journey`}>
                  Open the journey
                  <ArrowUpRight aria-hidden="true" />
                </Link>
              </Button>
            </Inset>
          </div>
        </Group>
      </div>
    </section>
  );
}

function MarkRow({ mark, term, children }: { mark: ReactNode; term: string; children: ReactNode }) {
  return (
    <div className="flex items-start gap-3 py-2">
      <dt className="flex h-5 w-[96px] shrink-0 items-center">
        <span className="flex items-center" aria-hidden="true">
          {mark}
        </span>
        <span className="sr-only">{term}</span>
      </dt>
      <dd className="min-w-0 text-sm text-ink-2">
        <span className="text-ink">{term}</span> — {children}
      </dd>
    </div>
  );
}

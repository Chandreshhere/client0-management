"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { BowlFood, Brain, Drop, FileText, Heart, Heartbeat, Pill, PersonSimpleTaiChi, Pulse, Scan, Stethoscope, TestTube, Wind, Bone, Gauge } from "@phosphor-icons/react";
import type { OrganKind } from "@/data/anatomy";
import { ORGAN_LABEL } from "@/data/anatomy";
import type { CareEventType } from "@/data/featured";
import { getRecord, ALL_RECORD_PATIENTS } from "@/data/record";
import { careTeamActivity, eventsByType, latestMeasurements, measureHistory, monthlyDensity, systemShares, upcoming } from "@/data/insights";
import { Sparkline } from "@/components/charts/bar-chart";
import { patientById } from "@/data/patients";
import { staffById } from "@/data/staff";
import { VITAL_SERIES } from "@/data/featured";
import { formatDate } from "@/lib/format";
import { PageHeader } from "@/components/ui/misc";
import { Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { OrganHero, OrganCarousel, GlassCard } from "@/components/viz/organ";
import { BodyConditionCard, VitalTile, BarsSpark, EcgSpark, WaveSpark, ValuePill, SparkValue } from "@/components/viz/condition";
import { BubbleChart } from "@/components/viz/bubble-chart";
import { YearScrubber, MonthStrip } from "@/components/viz/timeline-scrubber";
import { MediaStatCard, PeopleList, ScheduleCard, SectionLabel } from "@/components/viz/cards";
import { ScanThumb } from "@/features/patient/scan-thumb";

const TYPE_ICON: Record<CareEventType, React.ReactNode> = {
  note: <FileText />, document: <FileText />, lab: <TestTube />, vitals: <Pulse />, medication: <Pill />, imaging: <Scan />, consult: <Stethoscope />, nutrition: <BowlFood />, movement: <PersonSimpleTaiChi />,
};
const SYSTEM_ICON: Record<string, React.ReactNode> = {
  circulatory: <Heartbeat />, cardiovascular: <Heartbeat />, nervous: <Brain />, neurological: <Brain />, respiratory: <Wind />, metabolic: <Gauge />, renal: <Drop />, hepatic: <Drop />, haematology: <Drop />, endocrine: <Gauge />, musculoskeletal: <Bone />, reproductive: <Heart />, digestive: <BowlFood />,
};

/** Hotspot anchor points per organ model (percent of the hero box), anatomically placed. */
const ANCHORS: Record<OrganKind, { x: number; y: number }[]> = {
  heart: [{ x: 58, y: 66 }, { x: 64, y: 24 }, { x: 34, y: 44 }],
  brain: [{ x: 40, y: 38 }, { x: 64, y: 62 }, { x: 52, y: 26 }],
  lungs: [{ x: 34, y: 56 }, { x: 66, y: 60 }, { x: 50, y: 22 }],
  kidney: [{ x: 56, y: 44 }, { x: 40, y: 66 }],
  liver: [{ x: 40, y: 48 }, { x: 52, y: 62 }],
  cells: [{ x: 40, y: 40 }, { x: 62, y: 60 }],
  thyroid: [{ x: 38, y: 48 }, { x: 62, y: 48 }],
  pancreas: [{ x: 34, y: 54 }, { x: 60, y: 46 }],
  spine: [{ x: 50, y: 64 }, { x: 50, y: 40 }],
  uterus: [{ x: 50, y: 46 }, { x: 28, y: 46 }, { x: 72, y: 46 }],
  gut: [{ x: 56, y: 46 }, { x: 44, y: 70 }],
  knee: [{ x: 50, y: 52 }, { x: 56, y: 44 }],
};

export function KitGallery() {
  const [pid, setPid] = useState("p-kabir");
  const record = useMemo(() => getRecord(pid)!, [pid]);
  const patient = patientById(pid)!;
  const shares = useMemo(() => systemShares(record), [record]);
  const [systemId, setSystemId] = useState<string | null>(null);
  const activeSystem = record.systems.find((s) => s.id === (systemId ?? record.systems[0]?.id)) ?? record.systems[0];
  const [organ, setOrgan] = useState<OrganKind | null>(null);
  const carouselOrgan = organ && record.systems.some((s) => s.organ === organ) ? organ : activeSystem.organ;
  const year = record.years[0];
  const [range, setRange] = useState<[number, number]>([record.years[record.years.length - 1], record.years[0]]);
  const density = useMemo(() => monthlyDensity(record), [record]);
  const team = useMemo(() => careTeamActivity(record), [record]);
  const [doc, setDoc] = useState<string | undefined>(undefined);
  const measures = useMemo(() => latestMeasurements(record), [record]);
  const next = upcoming(record);
  const conds = record.conditions.filter((c) => c.systemId === activeSystem.id);
  const months = ["2026-08", "2026-09", "2026-10", "2026-11"];
  const [month, setMonth] = useState("2026-11");
  const hr = VITAL_SERIES.find((v) => v.id === "hr")!;
  const bp = VITAL_SERIES.find((v) => v.id === "bp")!;
  const bpPoints = bp.points as { v: number; v2?: number }[];
  const bpLast = bpPoints[bpPoints.length - 1];

  return (
    <div className="flex flex-col gap-10">
      <PageHeader
        eyebrow="Internal · references 2–6 · every value below is computed from the selected patient's record"
        title="Visual kit"
        description="Pick a patient: the organ, systems, percentages, bubbles, timelines and care team all follow their own conditions and events."
        actions={
          <Select
            ariaLabel="Patient"
            value={pid}
            onValueChange={(v) => {
              setPid(v);
              setSystemId(null);
              setOrgan(null);
            }}
            className="w-[300px]"
            options={ALL_RECORD_PATIENTS.map((id) => ({ value: id, label: patientById(id)!.name, description: patientById(id)!.conditions.join(", ") }))}
          />
        }
      />

      <section className="grid gap-6 xl:grid-cols-[1.1fr_1fr]">
        <div className="relative rounded-card bg-surface p-6">
          <p className="text-xs text-muted">{patient.name} · {activeSystem.name}</p>
          <h2 className="text-display font-light">Overview Conditions</h2>
          <OrganHero
            kind={activeSystem.organ}
            label={`${ORGAN_LABEL[activeSystem.organ]} — conditions recorded for ${patient.name}`}
            className="mx-auto mt-2 max-w-[420px]"
            hotspots={conds.map((c, i) => ({ id: c.id, ...ANCHORS[activeSystem.organ][i % ANCHORS[activeSystem.organ].length], label: c.name, detail: `${c.status} · ${c.markers} linked records`, active: i === 0 }))}
          >
            <GlassCard className="absolute bottom-[6%] left-0 w-[210px]">
              <p className="text-[11px] text-muted">{activeSystem.vitals[0].label} · {activeSystem.vitals[0].source}</p>
              <p className="text-lg font-light text-ink">
                {activeSystem.vitals[0].value} <span className="text-xs text-muted">{activeSystem.vitals[0].unit}</span>
              </p>
              <div className="h-10">
                <WaveSpark label={`${activeSystem.vitals[0].label} trend`} values={activeSystem.vitals[0].wave} />
              </div>
            </GlassCard>
          </OrganHero>
        </div>
        <div className="flex flex-col gap-4">
          <SectionLabel>{activeSystem.name} · latest readings</SectionLabel>
          <div className="grid gap-3 sm:grid-cols-2">
            {activeSystem.vitals.map((v) => (
              <VitalTile key={v.label} icon={SYSTEM_ICON[activeSystem.id] ?? <Pulse />} label={`${v.label} · ${v.source}`} value={v.value} unit={v.unit} chart={<WaveSpark label={`${v.label} trend`} values={v.wave} />} aside={<SparkValue value={v.value} sub={v.unit} />} />
            ))}
            {pid === "p-kabir" ? (
              <>
                <VitalTile icon={<Drop />} label="Blood pressure · systolic, all readings" value={`${bpLast.v}/${bpLast.v2}`} unit="mmHg" chart={<BarsSpark label="Systolic readings" values={bp.points.map((p) => p.v - 100)} />} aside={<SparkValue value={bpLast.v} sub={`/${bpLast.v2}`} />} />
                <VitalTile icon={<Heartbeat />} label="Resting heart rate · latest" value={`${hr.points.at(-1)!.v} bpm`} accent chart={<EcgSpark label={`ECG-style trace at ${hr.points.at(-1)!.v} bpm`} beats={Math.round(hr.points.at(-1)!.v / 20)} />} aside={<ValuePill value={hr.points.at(-1)!.v} unit="bpm" />} />
              </>
            ) : null}
          </div>
          <SectionLabel>Share of care activity · last 12 months</SectionLabel>
          <div className="grid gap-3 sm:grid-cols-2">
            {shares.map((b) => (
              <BodyConditionCard
                key={b.id}
                icon={SYSTEM_ICON[b.id] ?? <Pulse />}
                label={b.name}
                percent={b.percent}
                progress={{ value: b.events, max: Math.max(1, b.total) }}
                count={b.open}
                active={activeSystem.id === b.id}
                onClick={() => setSystemId(b.id)}
              >
                {activeSystem.id === b.id ? <span className="text-[11px] text-muted">{b.events} of {b.total} events · {b.open} open (awaiting review / scheduled)</span> : null}
              </BodyConditionCard>
            ))}
          </div>
        </div>
      </section>

      <OrganCarousel
        title={`${patient.name.split(" ")[0]}'s body systems`}
        items={record.systems.map((s) => ({ kind: s.organ, label: s.name, note: `${record.conditions.filter((c) => c.systemId === s.id).length} condition(s)` }))}
        selected={carouselOrgan}
        onSelect={(k) => {
          setOrgan(k);
          const s = record.systems.find((x) => x.organ === k);
          if (s) setSystemId(s.id);
        }}
      />

      <section className="grid gap-6 lg:grid-cols-[1fr_1fr_320px]">
        <div className="rounded-card bg-primary p-5 text-white">
          <p className="text-xs text-white/70">{patient.name} · {year}</p>
          <p className="text-xl font-light">Records by type</p>
          <BubbleChart title={`Records by type in ${year}`} items={eventsByType(record, year).slice(0, 7)} />
        </div>
        <div className="grid grid-cols-2 content-start gap-3">
          {measures.slice(0, 4).map((m) => (
            <MediaStatCard
              key={m.label}
              value={m.value}
              label={`${m.label}${m.unit ? ` (${m.unit})` : ""}${m.flag ? ` · ${m.flag}` : ""}`}
              time={formatDate(m.event.date, { day: "2-digit", month: "short" })}
              media={
                m.event.type === "imaging" ? (
                  <ScanThumb kind={m.event.systemId === "respiratory" ? "chest-ct" : m.event.systemId === "nervous" || m.event.systemId === "neurological" ? "brain-mra" : "echo"} />
                ) : (
                  <div className="flex size-full items-center justify-end pr-3">
                    {measureHistory(record, m.label).length > 1 ? (
                      <Sparkline tone="white" className="h-12 w-[110px]" values={measureHistory(record, m.label).map((p) => p.value)} />
                    ) : (
                      <span className="text-[10px] text-white/50">first reading</span>
                    )}
                  </div>
                )
              }
            />
          ))}
          {measures.length === 0 ? <p className="col-span-2 text-sm text-muted">No structured measurements recorded yet.</p> : null}
        </div>
        <ScheduleCard
          title="Next on the diary"
          date={next[0] ? formatDate(next[0].date, { weekday: "short", day: "numeric", month: "short" }) : "Nothing booked"}
          dayLabel={next[0]?.title ?? "No upcoming appointments"}
          people={team.slice(0, 3).map((t) => ({ id: t.staff.id, name: t.staff.name, avatar: t.staff.avatar, note: t.staff.title }))}
          selected={doc ?? team[0]?.staff.id}
          onSelect={setDoc}
          action={{ label: "Book follow-up", onClick: () => undefined }}
        />
      </section>

      <section className="grid gap-6 lg:grid-cols-[320px_1fr]">
        <div>
          <SectionLabel>Care team · records authored for this patient</SectionLabel>
          <PeopleList selected={doc ?? team[0]?.staff.id} onSelect={setDoc} people={team.map((t) => ({ id: t.staff.id, name: t.staff.name, role: t.staff.title.split(" ·")[0], avatar: t.staff.avatar, count: t.count }))} />
        </div>
        <div className="flex flex-col gap-4">
          <SectionLabel>Activity by month</SectionLabel>
          <YearScrubber label="Record years" years={[...record.years].reverse()} density={density} value={range} onChange={setRange} />
          <MonthStrip
            active={month}
            onSelect={setMonth}
            months={months.map((k) => ({
              key: k,
              label: new Intl.DateTimeFormat("en-IN", { month: "short" }).format(new Date(`${k}-01`)),
              items: record.events.filter((e) => e.date.startsWith(k)).slice(0, 4).map((e) => ({ id: e.id, icon: TYPE_ICON[e.type], label: e.title })),
            }))}
          />
          <div className="flex flex-wrap items-center gap-3 rounded-card bg-surface p-5">
            <p className="flex-1 text-sm text-muted">The journey map (documented links between events, laid out by who acted and when) lives on each patient&apos;s Journey tab.</p>
            <Button asChild variant="dark">
              <Link href={`/patients/${pid}/journey`}>Open {patient.name.split(" ")[0]}&apos;s journey</Link>
            </Button>
          </div>
          <p className="text-xs text-muted">Doctors in this list: {team.map((t) => staffById(t.staff.id)?.name).join(", ")}.</p>
        </div>
      </section>
    </div>
  );
}

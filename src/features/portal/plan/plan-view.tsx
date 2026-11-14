"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { PlusCircle } from "@phosphor-icons/react";
import { pluralize } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { OrganCarousel } from "@/components/viz/organ";
import { CARE_PLAN } from "@/data/featured";
import { MessageButton, PortalHeader, Reveal } from "../ui";
import { usePortalStore } from "../store";
import { CURRENT_WEEK, PROGRAMME, SYSTEMS, systemById } from "../record";
import { planStore, type ReadingKind } from "./store";
import { PlanHero } from "./hero";
import { ConditionTiles } from "./tiles";
import { TodayPanel } from "./today";
import { MedicinesPanel } from "./medicines";
import { MealsPanel } from "./meals";
import { MovementPanel } from "./movement";
import { ReadingsPanel } from "./readings";
import { LogReadingModal } from "./log-modal";

/** Side column that is shorter than its neighbour: sticky from lg, scrolls inside if the viewport is short. */
const SIDE_RAIL = "lg:sticky lg:top-20 lg:self-start lg:max-h-[calc(100dvh-96px)] lg:overflow-y-auto scrollbar-thin lg:rounded-card";

/**
 * /portal/plan — reference 3 for the patient: the organ of the selected body system (from the
 * record), "My … condition" tiles, the body-condition carousel, then today's plan, medicines,
 * meals, movement and self-reported readings. Nothing here is clinical input: everything the
 * patient logs stays self-reported and in this browser session.
 */
export function PlanView() {
  const state = usePortalStore(planStore);
  const [systemId, setSystemId] = useState(SYSTEMS[0]?.id ?? "");
  const system = systemById(systemId);
  const [conditionBySystem, setConditionBySystem] = useState<Record<string, string>>({});
  const conditionId = conditionBySystem[system.id] ?? system.conditions.find((c) => c.status !== "Resolved")?.id ?? system.conditions[0]?.id ?? "";
  const [log, setLog] = useState<{ open: boolean; kind: ReadingKind; nonce: number }>({ open: false, kind: "bp", nonce: 0 });
  const openLog = (kind: ReadingKind = "bp") => setLog((l) => ({ open: true, kind, nonce: l.nonce + 1 }));

  return (
    <div className="flex flex-col gap-6">
      <Suspense fallback={null}>
        <LogParam onLog={() => openLog("bp")} />
      </Suspense>

      <PortalHeader
        title="My plan"
        description={`${PROGRAMME.name} · week ${CURRENT_WEEK} of ${PROGRAMME.weeks}. Goal: ${CARE_PLAN.goal}`}
        actions={
          <>
            <Button variant="dark" leading={<PlusCircle />} onClick={() => openLog("bp")}>
              Log a reading
            </Button>
            <MessageButton />
          </>
        }
      />

      <div className="grid grid-cols-1 gap-8 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.08fr)]">
        <Reveal index={0} className="flex">
          <PlanHero system={system} conditionId={conditionId} onSelectCondition={(id) => setConditionBySystem((m) => ({ ...m, [system.id]: id }))} />
        </Reveal>
        <Reveal index={1} className="flex min-w-0 flex-col gap-8">
          <ConditionTiles system={system} readings={state.readings} />
          <OrganCarousel
            title="My body condition"
            items={SYSTEMS.map((s) => ({ kind: s.organ, label: s.area, note: `${pluralize(s.conditions.length, "condition")} · ${pluralize(s.records.length, "record")}` }))}
            selected={system.organ}
            onSelect={(k) => {
              const s = SYSTEMS.find((x) => x.organ === k);
              if (s) setSystemId(s.id);
            }}
          />
        </Reveal>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
        <Reveal index={2}>
          <TodayPanel ticks={state.ticks} meals={state.meals ?? {}} readings={state.readings} onLogBp={() => openLog("bp")} />
        </Reveal>
        {/* Shorter than the day list beside it: ride along instead of stretching an empty grey group. */}
        <Reveal index={3} className={SIDE_RAIL}>
          <MedicinesPanel />
        </Reveal>
      </div>

      <Reveal index={4}>
        <MealsPanel meals={state.meals} />
      </Reveal>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Reveal index={5}>
          <MovementPanel readings={state.readings} />
        </Reveal>
        <Reveal index={6} className={SIDE_RAIL}>
          <ReadingsPanel readings={state.readings} onLog={openLog} />
        </Reveal>
      </div>

      <LogReadingModal key={`log-${log.nonce}`} open={log.open} initialKind={log.kind} onOpenChange={(o) => setLog((l) => ({ ...l, open: o }))} />
    </div>
  );
}

/** `/portal/plan?log=1` opens "Log a reading" (then tidies the URL). */
function LogParam({ onLog }: { onLog: () => void }) {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const handled = useRef(false);
  useEffect(() => {
    if (handled.current || params.get("log") !== "1") return;
    handled.current = true;
    onLog();
    router.replace(pathname, { scroll: false });
  }, [params, onLog, router, pathname]);
  return null;
}

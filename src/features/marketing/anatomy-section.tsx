import { cn } from "@/lib/cn";
import { AnatomyExplorer } from "./anatomy-explorer";
import { PATIENT_TOTAL, organEntries, patientsWithoutOrgan } from "./anatomy-model";
import { Section, SectionIntro } from "./section";
import s from "./motion.module.css";

/**
 * "Every condition, its own anatomy" — the twelve organ models and what opens each one.
 * Entries are computed on the server from the shared anatomy rules and every demo record, then
 * handed to the client explorer (static renders only: the page's one live organ is the hero's).
 */
export function AnatomySection() {
  const entries = organEntries();
  const without = patientsWithoutOrgan();
  return (
    <Section id="anatomy" nav="product" labelledBy="anatomy-title">
      <SectionIntro
        id="anatomy-title"
        eyebrow="Anatomy"
        title="Every condition, its own anatomy."
        lead="Carelane files each recorded condition under a body system, and the record opens on that system's organ: COPD on the lungs, CKD on the kidneys, diabetes on the pancreas, knee osteoarthritis on the knee joint. Pick a model to see which conditions open it and which demo patients it belongs to."
      />
      <div className={cn("mt-12 md:mt-16", s.revealTall)}>
        <AnatomyExplorer entries={entries} total={PATIENT_TOTAL} without={without} />
      </div>
    </Section>
  );
}

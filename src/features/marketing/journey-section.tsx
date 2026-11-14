import { cn } from "@/lib/cn";
import { JourneyProof } from "./journey-proof";
import { Section, SectionIntro } from "./section";
import s from "./motion.module.css";

/** Care journey section (refs 5 & 6): documented links between records, for four synthetic patients. */
export function JourneySection() {
  return (
    <Section id="journey" nav="product" labelledBy="journey-title">
      <SectionIntro
        id="journey-title"
        eyebrow="Care journey"
        title="Why was that test ordered — and what did it lead to?"
        lead="Carelane draws a line between two records only when the record documents the link: a consult that ordered a test, a result reviewed at a visit, an assignment that started a plan, a reading followed up a month later. Pick a patient and a link kind, then select any stop to see what points to it and what it led to."
      />
      <div className={cn("mt-12 md:mt-16", s.revealTall)}>
        <JourneyProof />
      </div>
    </Section>
  );
}

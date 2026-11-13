import type { ReactNode } from "react";
import { Database, IdentificationCard, LockKey, ShareNetwork, UserCheck } from "@phosphor-icons/react/ssr";
import { clinicNumber, patientById } from "@/data/patients";
import { StatusBadge } from "@/components/ui/status";
import { cn } from "@/lib/cn";
import { Section, SectionIntro } from "./section";
import s from "./motion.module.css";

/**
 * India-first details, stated honestly: what the prototype shows today versus what is planned.
 * Wording follows the product brief (doc §7): ABHA is voluntary and kept separate from the clinic
 * number; ABDM is a later workstream; DPDP obligations depend on the phased commencement.
 */
const kabir = patientById("p-kabir")!;

type Note = { icon: ReactNode; title: string; body: string; status: "prototype" | "roadmap"; extra?: ReactNode; className?: string };

const NOTES: Note[] = [
  {
    icon: <IdentificationCard />,
    title: "The clinic number stays separate from ABHA",
    body: "Every patient keeps the clinic's own number. ABHA is voluntary, so it sits beside that number as a separate field and never replaces it.",
    status: "prototype",
    className: "lg:col-span-2",
    extra: (
      <dl className="mt-6 grid grid-cols-1 gap-2 sm:grid-cols-2">
        <div className="rounded-inner bg-canvas p-4">
          <dt className="text-xs text-muted">Clinic number</dt>
          <dd className="mt-1 font-mono text-sm text-ink">{clinicNumber(kabir.id)}</dd>
        </div>
        <div className="rounded-inner bg-canvas p-4">
          <dt className="text-xs text-muted">ABHA</dt>
          <dd className="mt-1 text-sm text-ink">{kabir.abhaLinked ? "Linked by the patient" : "Not linked"} · voluntary</dd>
        </div>
      </dl>
    ),
  },
  {
    icon: <UserCheck />,
    title: "Consent and preferences in the portal",
    body: "Patients set their communication preferences and can request access to, or correction of, their record from the patient portal.",
    status: "prototype",
  },
  {
    icon: <ShareNetwork />,
    title: "ABDM integration",
    body: "Planned as its own workstream on ABDM's published FHIR R4 profiles, through the official onboarding process. Record sharing will be consent-based.",
    status: "roadmap",
  },
  {
    icon: <LockKey />,
    title: "DPDP Act",
    body: "The framework commences in phases. Obligations will be mapped against the actual launch date and operating model — we don't claim compliance for this prototype.",
    status: "roadmap",
  },
  {
    icon: <Database />,
    title: "Data residency",
    body: "Hosting region and residency commitments are not set yet. The demo stores nothing on a server: it runs in your browser on synthetic data.",
    status: "roadmap",
  },
];

export function IndiaFirst() {
  return (
    <Section id="india" nav="workflows" labelledBy="india-title">
      <SectionIntro
        id="india-title"
        eyebrow="India-first"
        title="Will it handle ABHA, consent and India's data-protection rules?"
        lead="Partly today; the rest is on the roadmap, and each item below says which. Carelane is planned India-first: rupee pricing, the clinic's own patient number kept apart from ABHA, and consent handled in the patient portal."
      />
      <ul className="mt-12 grid grid-cols-1 gap-4 md:mt-16 md:grid-cols-2 lg:grid-cols-3">
        {NOTES.map((n) => (
          <li key={n.title} className={cn("flex flex-col rounded-card bg-surface p-6", s.reveal, n.className)}>
            <div className="flex items-center justify-between gap-3">
              <span aria-hidden="true" className="flex size-10 items-center justify-center rounded-full bg-sunken text-ink [&_svg]:size-[18px]">
                {n.icon}
              </span>
              {n.status === "prototype" ? <StatusBadge tone="success">In the prototype</StatusBadge> : <StatusBadge tone="draft">Roadmap</StatusBadge>}
            </div>
            <h3 className="mt-6 text-[20px] font-normal leading-[1.2] tracking-[-0.012em] text-ink">{n.title}</h3>
            <p className="mt-2 max-w-[60ch] text-sm text-muted">{n.body}</p>
            {n.extra}
          </li>
        ))}
      </ul>
    </Section>
  );
}

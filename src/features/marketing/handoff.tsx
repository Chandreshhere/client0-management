import { minPlanFor } from "@/data/plans";
import { cn } from "@/lib/cn";
import { ReferralStepper } from "./referral-stepper";
import { Section, SectionIntro } from "./section";
import s from "./motion.module.css";

/** Referral handoff section (doc §5B): the stepper plus three short notes on how stalls surface. */
const NOTES = [
  { title: "Every stage has an owner", body: "Each step records who moved it and when, so “referred” never silently means “done”." },
  { title: "Stalls surface on their own", body: "A referral that isn't accepted or booked shows up as a notification and a task for the people who can unblock it." },
  { title: `On ${minPlanFor("referrals").name} and above`, body: "Referrals need more than one discipline, so they arrive with the multi-role workspaces." },
];

export function Handoff() {
  return (
    <Section id="workflows" nav="workflows" labelledBy="workflows-title">
      <SectionIntro
        id="workflows-title"
        eyebrow="Referral workflow"
        title="“Referred to nutrition” — but did anyone accept, book or see the patient?"
        lead="In Carelane a referral moves through five owned stages: Requested, Accepted, Booked, Completed and Acknowledged. Each stage keeps a person and a time, so the care team can see exactly where progress stopped."
      />
      <div className={cn("mt-12 md:mt-16", s.revealTall)}>
        <ReferralStepper />
      </div>
      <ul className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
        {NOTES.map((n) => (
          <li key={n.title} className={cn("rounded-card bg-sunken p-6", s.reveal)}>
            <p className="text-base text-ink">{n.title}</p>
            <p className="mt-2 text-sm text-muted">{n.body}</p>
          </li>
        ))}
      </ul>
    </Section>
  );
}

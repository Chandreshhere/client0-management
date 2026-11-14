import { ASSIGNMENT_RETURN_HOURS } from "@/data/care";
import { minPlanFor, minPlanForRole } from "@/data/plans";
import { cn } from "@/lib/cn";
import { availabilityLabel } from "@/features/pricing/model";
import { AssignmentTrack } from "./assignment-track";
import { Section, SectionIntro } from "./section";
import s from "./motion.module.css";

/** Assignment handoff section (spec F5): the two-state track plus three short notes on ownership. */
const assignmentsOn = availabilityLabel(minPlanFor("referrals"));
const NOTES = [
  {
    title: "One owner until it's seen",
    body: "Only the nutritionist or instructor it was assigned to has it in their pending list. Everyone else on the care team sees it on the patient's timeline.",
  },
  {
    title: `Unseen after ${ASSIGNMENT_RETURN_HOURS} hours, it comes back`,
    body: `An assignment nobody has opened goes back to the doctor's pending list. On ${minPlanForRole("coordinator").name}, the care coordinator sees it too.`,
  },
  {
    title: assignmentsOn === "Every plan" ? "On every plan; booking lives in scheduling" : `On ${assignmentsOn}; booking lives in scheduling`,
    body: `Assigning isn't booking. Appointments and classes are booked in the calendar, on ${availabilityLabel(minPlanFor("calendar"))} — never a step in the assignment.`,
  },
];

export function Handoff() {
  return (
    <Section id="workflows" nav="workflows" labelledBy="workflows-title">
      <SectionIntro
        id="workflows-title"
        eyebrow="Assignments"
        title="“Assigned to nutrition” — but has anyone opened it?"
        lead={`In Carelane the doctor assigns a patient to a nutritionist or a yoga instructor with goals and precautions. An assignment has two states: assigned, then seen — the moment the recipient opens it. If nobody opens it within ${ASSIGNMENT_RETURN_HOURS} hours, it goes back to the doctor.`}
      />
      <div className={cn("mt-12 md:mt-16", s.revealTall)}>
        <AssignmentTrack />
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

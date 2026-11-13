"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo, useState } from "react";
import { CalendarPlus, ChatCircleText, Copy, DotsThree, LockSimple, Path, Plus, ShieldCheck, Users, UsersThree } from "@phosphor-icons/react";
import type { Patient, Task } from "@/data/types";
import { PATIENTS, clinicNumber } from "@/data/patients";
import { DEMO_USER, staffById } from "@/data/staff";
import { REFERRALS, TASKS } from "@/data/care";
import { DOCUMENTS, INVOICES } from "@/data/records";
import { CLASSES, NUTRITION_PLANS, PACKAGES } from "@/data/programs";
import { APPOINTMENT_STATUS_LABEL } from "@/data/appointments";
import { minPlanFor } from "@/data/plans";
import { formatDate, formatTime } from "@/lib/format";
import { useRole } from "@/components/shell/role-context";
import { LockBadge } from "@/components/shell/plan-switcher";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Group, Inset } from "@/components/ui/card";
import { IconButton } from "@/components/ui/icon-button";
import { Dropdown, DropdownContent, DropdownItem, DropdownLabel, DropdownSeparator, DropdownTrigger } from "@/components/ui/dropdown";
import { Tip } from "@/components/ui/tooltip";
import { useToast } from "@/components/ui/toast";
import { BILLING_ROLES, CARE_SLOTS, branchLabel, careTeamIds, dayWord, flagsFor, isLive, lastVisitAt, recentVisits, relatedRecords, upcomingVisits } from "./data";
import { usePatientsSession, withSessionCareTeam } from "./session-store";
import { FlagPills, PatientStatusBadge } from "./registry-bits";
import { AssignCareTeamModal } from "./assign-care-team";
import {
  AppointmentsGroup,
  BillingGroup,
  DocumentsGroup,
  FocalCard,
  NutritionGroup,
  ProgrammeGroup,
  RecordSetupGroup,
  ReferralsGroup,
  SafetyGroup,
  TasksGroup,
  referralStalled,
  type Focal,
  type SetupStep,
} from "./summary-sections";

const PRIORITY_RANK: Record<Task["priority"], number> = { urgent: 0, high: 1, normal: 2, low: 3 };
const SLOT_COLOR: Record<(typeof CARE_SLOTS)[number]["key"], string> = {
  doctor: "var(--color-medical)",
  nutritionist: "var(--color-nutrition)",
  yoga: "var(--color-movement)",
  coordinator: "var(--color-ops)",
};

/**
 * Summary for a patient with nothing recorded yet (no condition mapped to a body system, so no
 * organ, shares, timeline or journey can be computed). Shown on both the Overview and Journey
 * routes for them. Same language as the overview: grey groups with white insets and one cobalt
 * focal card — the next appointment, or the most urgent open item when nothing is booked — plus
 * the record set-up steps that are still open.
 */
export function PatientSummary({ patient: base }: { patient: Patient }) {
  const pathname = usePathname();
  const onJourney = pathname?.endsWith("/journey") ?? false;
  const { role, user, has } = useRole();
  const { toast } = useToast();
  const { session, setCareTeams } = usePatientsSession();
  const [assignOpen, setAssignOpen] = useState(false);
  const patient = useMemo(() => withSessionCareTeam(base, session), [base, session]);

  const data = useMemo(() => {
    const upcoming = upcomingVisits(patient, session.visits);
    const tasks = TASKS.filter((t) => t.patientId === patient.id);
    const open = tasks.filter((t) => t.status !== "done").sort((a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] || Date.parse(a.due) - Date.parse(b.due));
    const referrals = REFERRALS.filter((r) => r.patientId === patient.id);
    // Clinicians get a clinical focal (operational items stay in the task list); ops roles see everything.
    const clinical = role === "doctor" || role === "nutritionist" || role === "yoga";
    const urgent = open.find((t) => (t.priority === "urgent" || t.priority === "high") && (!clinical || t.discipline !== "operations"));
    const stalled = referrals.find(referralStalled);
    const focal: Focal = upcoming[0]
      ? { kind: "visit", visit: upcoming[0] }
      : urgent
        ? { kind: "task", task: urgent }
        : stalled
          ? { kind: "referral", referral: stalled }
          : { kind: "none" };
    return {
      upcoming,
      focal,
      later: upcoming.slice(1),
      recent: recentVisits(patient),
      open,
      doneCount: tasks.length - open.length,
      referrals,
      docs: DOCUMENTS.filter((d) => d.patientId === patient.id).sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt)),
      invoices: INVOICES.filter((i) => i.patientId === patient.id).sort((a, b) => b.issuedAt.localeCompare(a.issuedAt)),
      plan: NUTRITION_PLANS.filter((p) => p.patientId === patient.id).sort((a, b) => b.version - a.version)[0],
      classes: CLASSES.filter((c) => c.enrolled.some((e) => e.patientId === patient.id)).sort((a, b) => a.start.localeCompare(b.start)),
      pkg: PACKAGES.find((p) => p.patientId === patient.id),
      flags: flagsFor(patient, upcoming[0] ?? null),
    };
  }, [patient, session.visits, role]);

  // Patients only ever see their own record (the featured patient is the demo patient user).
  if (role === "patient" && patient.id !== DEMO_USER.patient.personId) return <NotYourRecord />;

  const no = clinicNumber(patient.id);
  const showBilling = BILLING_ROLES.includes(role);
  const firstName = patient.name.split(" ")[0];

  // Record set-up: what is on file and what is still missing — each step read from the data.
  const teamIds = careTeamIds(patient.careTeam);
  const flaggedDuplicate = data.flags.includes("duplicate");
  const matches = flaggedDuplicate ? relatedRecords(patient, [...PATIENTS, ...session.added]) : [];
  const next = data.upcoming[0] ?? null;
  const last = lastVisitAt(patient);
  const steps: SetupStep[] = [
    { id: "registered", label: "Registered", state: "done", detail: `${formatDate(patient.registeredAt)} · clinic number ${no}` },
    {
      id: "identity",
      label: "Identity checked",
      state: flaggedDuplicate ? "todo" : "done",
      detail: matches.length ? (
        <>
          Possible duplicate of{" "}
          {matches.map((m, i) => (
            <span key={m.patient.id}>
              {i ? "; " : ""}
              <Link href={`/patients/${m.patient.id}`} className="text-ink-2 underline decoration-line-strong underline-offset-2 hover:text-ink">
                {m.patient.name}
              </Link>
              {" — "}
              {m.reasons.join(", ").toLowerCase()}
            </span>
          ))}
          . Nothing is merged until someone reviews it.
        </>
      ) : flaggedDuplicate ? (
        "Flagged as a possible duplicate — waiting for review."
      ) : (
        "No other record shares this mobile number or name."
      ),
    },
    { id: "intake", label: "Intake form", state: patient.intakeComplete ? "done" : "todo", detail: patient.intakeComplete ? "Completed" : "Not completed yet" },
    {
      id: "allergies",
      label: "Allergies recorded",
      state: patient.allergies === null ? "todo" : "done",
      detail: patient.allergies === null ? "Not recorded — ask before prescribing" : patient.allergies.length ? patient.allergies.join(", ") : "No known allergies (confirmed)",
    },
    {
      id: "team",
      label: "Care team assigned",
      state: teamIds.length ? "done" : "todo",
      detail: teamIds.length ? teamIds.map((id) => staffById(id)?.name).filter(Boolean).join(", ") : has("multi-role") ? "Nobody assigned yet" : `Nobody assigned yet · care teams are on the ${minPlanFor("multi-role").name} plan`,
      action: !teamIds.length && has("multi-role") ? (
        <Button size="sm" variant="secondary" onClick={() => setAssignOpen(true)}>
          Assign
        </Button>
      ) : undefined,
    },
    {
      id: "visit",
      label: "First visit",
      state: last ? "done" : next ? "in-progress" : "todo",
      detail: last
        ? `Last visit ${formatDate(last, { day: "numeric", month: "short" })}`
        : next
          ? isLive(next)
            ? `In the clinic now · ${APPOINTMENT_STATUS_LABEL[next.status]}`
            : `Booked · ${dayWord(next.start)} ${formatTime(next.start)}`
          : "Not booked yet",
    },
    {
      id: "condition",
      label: "First condition recorded",
      state: patient.conditions.length ? "in-progress" : "todo",
      detail: patient.conditions.length
        ? `Recorded but not mapped to a body system yet: ${patient.conditions.join(", ")}`
        : "Starts the body-system overview, timeline and journey",
    },
    { id: "abha", label: "ABHA linked", optional: true, state: patient.abhaLinked ? "done" : "todo", detail: patient.abhaLinked ? "Linked" : "Voluntary — care never depends on it" },
  ];

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(no);
      toast({ title: `Copied ${no}`, description: "Clinic number — kept separate from ABHA.", tone: "success" });
    } catch {
      toast({ title: "Couldn't reach the clipboard", description: `The clinic number is ${no}.`, tone: "warning" });
    }
  };

  return (
    <div className="@container flex flex-col gap-6">
      {/* Identity + care team */}
      <Group className="grid grid-cols-1 gap-2 @[1080px]:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
        <Inset className="flex flex-col gap-5 p-6 @[640px]:flex-row @[640px]:items-start">
          <Avatar src={patient.avatar} name={patient.name} size="xl" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs text-muted">
                <span className="font-mono text-ink-2">{no}</span> · {onJourney ? "Journey" : "Patient summary"} · nothing recorded yet
              </p>
              <div className="flex shrink-0 items-center gap-2">
                <Button asChild variant="dark" size="md">
                  <Link href={`/schedule?new=1&patient=${patient.id}`}>
                    <CalendarPlus aria-hidden="true" />
                    Book
                  </Link>
                </Button>
                {has("messages") ? (
                  <Tip label="Message">
                    <Link
                      href={`/messages?new=1&patient=${patient.id}`}
                      aria-label={`Message ${patient.name}`}
                      className="flex size-10 items-center justify-center rounded-full bg-surface text-ink shadow-[inset_0_0_0_1px_var(--color-line)] transition-[background-color,box-shadow] hover:bg-canvas hover:shadow-[inset_0_0_0_1px_var(--color-line-strong)]"
                    >
                      <ChatCircleText size={18} />
                    </Link>
                  </Tip>
                ) : (
                  <Tip label={`Messaging is on the ${minPlanFor("messages").name} plan`}>
                    <span tabIndex={0} aria-disabled="true" className="flex size-10 cursor-not-allowed items-center justify-center rounded-full bg-surface text-faint shadow-[inset_0_0_0_1px_var(--color-line)] outline-none focus-visible:outline-2 focus-visible:outline-primary">
                      <ChatCircleText size={18} aria-hidden="true" />
                      <span className="sr-only">Message — available on the {minPlanFor("messages").name} plan</span>
                    </span>
                  </Tip>
                )}
                <Dropdown>
                  <DropdownTrigger asChild>
                    <IconButton label="More actions" variant="white" className="data-[state=open]:bg-canvas">
                      <DotsThree weight="bold" />
                    </IconButton>
                  </DropdownTrigger>
                  <DropdownContent className="w-[264px]">
                    <DropdownLabel>{patient.name}</DropdownLabel>
                    {has("multi-role") ? (
                      <DropdownItem icon={<UsersThree />} onSelect={() => setAssignOpen(true)}>
                        Assign care team
                      </DropdownItem>
                    ) : (
                      <DropdownItem disabled icon={<UsersThree />} description={`Available on ${minPlanFor("multi-role").name} plan`}>
                        <span className="flex items-center gap-2">Assign care team <LockBadge /></span>
                      </DropdownItem>
                    )}
                    <DropdownItem icon={<Copy />} onSelect={copy} description={<span className="font-mono">{no}</span>}>
                      Copy clinic number
                    </DropdownItem>
                    <DropdownSeparator />
                    <DropdownItem asChild icon={<Users />}>
                      <Link href="/patients">Back to registry</Link>
                    </DropdownItem>
                  </DropdownContent>
                </Dropdown>
              </div>
            </div>
            <h1 className="mt-2 text-[32px] font-light leading-[1.05] tracking-[-0.028em] text-ink @[640px]:text-[40px]">{patient.name}</h1>
            <p className="mt-2 text-sm text-muted">
              {patient.age} years · {patient.sex} · {patient.area} · {branchLabel(patient.branch)} branch
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <PatientStatusBadge status={patient.status} />
              {patient.program ? <span className="inline-flex h-6 items-center rounded-full bg-sunken px-2.5 text-xs text-ink-2">{patient.program}</span> : null}
              <span className="inline-flex h-6 items-center gap-1 rounded-full px-2.5 text-xs text-ink-2 shadow-[inset_0_0_0_1px_var(--color-line-strong)]">
                <ShieldCheck size={14} aria-hidden="true" />
                ABHA {patient.abhaLinked ? "linked" : "not linked"}
              </span>
              <FlagPills flags={data.flags.filter((f) => f !== "allergies")} patient={patient} showBalance={showBilling} max={4} quietWhenEmpty />
            </div>
          </div>
        </Inset>
        <ul className="grid grid-cols-1 gap-2 @[480px]:grid-cols-2" aria-label="Care team">
          {CARE_SLOTS.map((slot) => {
            const s = staffById(patient.careTeam[slot.key]);
            return (
              <li key={slot.key}>
                <Inset className="flex h-full items-center gap-3">
                  {s ? (
                    <Avatar src={s.avatar} name={s.name} size="md" />
                  ) : has("multi-role") ? (
                    <Tip label={`Assign ${slot.label.toLowerCase()}`}>
                      <button
                        type="button"
                        onClick={() => setAssignOpen(true)}
                        aria-label={`Assign ${slot.label.toLowerCase()}`}
                        className="flex size-10 shrink-0 items-center justify-center rounded-full border border-dashed border-line-strong text-muted transition-colors hover:border-ink-2 hover:bg-canvas hover:text-ink"
                      >
                        <Plus size={16} />
                      </button>
                    </Tip>
                  ) : (
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-full border border-dashed border-line-strong text-muted" aria-hidden="true">
                      <Users size={16} />
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-1.5 whitespace-nowrap text-xs text-muted">
                      <span className="size-1.5 shrink-0 rounded-full" style={{ background: SLOT_COLOR[slot.key] }} aria-hidden="true" />
                      <span className="truncate">{slot.label}</span>
                    </p>
                    <p className="truncate text-sm text-ink">{s?.name ?? "Not assigned"}</p>
                    {s?.status === "on-leave" ? <p className="truncate text-xs text-warning">{s.workingHours}</p> : null}
                  </div>
                </Inset>
              </li>
            );
          })}
        </ul>
      </Group>

      {onJourney ? (
        <section aria-labelledby="journey-empty-title" className="flex flex-col gap-4 rounded-card bg-surface p-6 @[720px]:flex-row @[720px]:items-center">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-sunken text-ink-2" aria-hidden="true">
            <Path size={20} />
          </span>
          <div className="min-w-0 flex-1">
            <h2 id="journey-empty-title" className="text-lg font-normal text-ink">
              No journey to map yet
            </h2>
            <p className="mt-1 max-w-[76ch] text-sm text-muted">
              The journey connects dated events only where the record documents a link — a consult that ordered a test, a result reviewed at a visit, a referral that started a plan. Nothing is recorded for {firstName} yet, so there is nothing to connect. What is on file is below.
            </p>
          </div>
          <Button asChild variant="secondary" className="shrink-0">
            <Link href="/help#journey">How the journey works</Link>
          </Button>
        </section>
      ) : null}

      {/* Stands in for the body-system overview. On narrow screens it follows the body, so the
          "in the clinic now" card stays near the top. */}
      <RecordSetupGroup steps={steps} firstName={firstName} className="order-1 @[1080px]:order-none" />

      {/* Body: safety & plans · focal & visits · open work */}
      <div className="grid grid-cols-1 items-start gap-6 @[720px]:grid-cols-2 @[1080px]:grid-cols-3">
        <div className="order-2 flex flex-col gap-4 @[720px]:order-none">
          <SafetyGroup patient={patient} />
          <ProgrammeGroup patient={patient} classes={data.classes} pkg={data.pkg} has={has} />
          <NutritionGroup plan={data.plan} has={has} />
        </div>
        <div className="order-1 flex flex-col gap-4 @[720px]:order-none">
          <FocalCard focal={data.focal} patient={patient} />
          <AppointmentsGroup later={data.focal.kind === "visit" ? data.later : data.upcoming} recent={data.recent} afterFocal={data.focal.kind === "visit"} />
        </div>
        <div className="order-3 grid grid-cols-1 items-start gap-4 @[720px]:col-span-2 @[720px]:grid-cols-2 @[1080px]:col-span-1 @[1080px]:grid-cols-1">
          <TasksGroup tasks={data.open} doneCount={data.doneCount} userId={user.id} firstName={firstName} />
          <ReferralsGroup referrals={data.referrals} has={has} />
          <DocumentsGroup docs={data.docs} canSeeRestricted={role === "doctor"} />
          <BillingGroup invoices={data.invoices} balance={patient.balanceDue} allowed={showBilling} />
        </div>
      </div>

      <p className="order-2 text-xs text-muted @[1080px]:order-none">
        Synthetic record · registered {formatDate(patient.registeredAt)} · changes made here stay in this browser session.
      </p>

      <AssignCareTeamModal
        target={assignOpen ? { mode: "team", id: patient.id } : null}
        patients={PATIENTS.map((p) => withSessionCareTeam(p, session))}
        onClose={() => setAssignOpen(false)}
        onSave={(teams, summary) => {
          setCareTeams(teams);
          setAssignOpen(false);
          toast({ ...summary, tone: "success" });
        }}
      />
    </div>
  );
}

function NotYourRecord() {
  return (
    <div className="mx-auto flex min-h-[56vh] max-w-[560px] flex-col items-center justify-center text-center">
      <span className="flex size-16 items-center justify-center rounded-full bg-charcoal text-white">
        <LockSimple size={26} />
      </span>
      <h1 className="mt-6 text-[36px] font-light leading-[1.05] tracking-[-0.028em] text-ink">Not your record</h1>
      <p className="mt-3 max-w-[44ch] text-sm text-muted">
        Patient accounts only see their own record. In production the server refuses this request — this demo shows the message instead.
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        <Button asChild variant="dark">
          <Link href="/dashboard">Go to my home</Link>
        </Button>
        <Button asChild variant="secondary">
          <Link href="/help">How roles work</Link>
        </Button>
      </div>
    </div>
  );
}

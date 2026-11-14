"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowRight, ArrowsLeftRight, BowlFood, Camera, NotePencil, PaperPlaneTilt, Ruler, Warning } from "@phosphor-icons/react";
import { patientById } from "@/data/patients";
import { staffById } from "@/data/staff";
import { PLAN_STATUS_LABEL } from "@/data/programs";
import { Button } from "@/components/ui/button";
import { Card, Group, GroupHeader, Inset } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/misc";
import { StatusBadge } from "@/components/ui/status";
import { useToast } from "@/components/ui/toast";
import { useRole } from "@/components/shell/role-context";
import { formatDate, TODAY } from "@/lib/format";
import { useNutrition, planActions } from "@/features/nutrition/store";
import { GUIDANCE, ROUTINES, SLOTS } from "@/features/nutrition/data";
import { PLAN_TONE, kcal, type PlanRecord } from "@/features/nutrition/model";
import { FollowUpCard } from "@/features/nutrition/adherence-form";
import { GuidanceSummary, RoutinePanel, VersionHistory } from "@/features/nutrition/builder-rail";
import { PlanPdfButton } from "@/features/nutrition/plan-pdf";
import { FlagToDoctorModal } from "@/features/tasks/flag-modal";
import { ProfileFrame } from "./frame";
import { AssignDialog } from "./assign-dialog";
import { useProfileStore } from "./profile-store";
import { assignmentsOf, firstName } from "./derive";

const fmtDay = (iso: string) => formatDate(iso, { day: "numeric", month: "short" });

/**
 * Nutrition section (spec F6): current plan, version history with reasons, assessment, follow-up
 * entries — with the doctor's guidance alongside. The nutritionist on the care team works here;
 * everyone else reads it.
 */
export function NutritionSection({ patientId }: { patientId: string }) {
  const patient = patientById(patientId)!;
  const { role, user, has } = useRole();
  const { toast } = useToast();
  const { plans, followUps, logs } = useNutrition();
  const local = useProfileStore((s) => s.assignments);
  const [flagging, setFlagging] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const first = firstName(patient);

  const plan: PlanRecord | undefined = useMemo(
    () =>
      Object.values(plans)
        .filter((p) => p.patientId === patientId && p.status !== "superseded")
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0] ??
      Object.values(plans)
        .filter((p) => p.patientId === patientId)
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0],
    [plans, patientId],
  );
  const assignment = useMemo(() => assignmentsOf(patientId, local).find((a) => a.discipline === "nutrition"), [patientId, local]);
  const nutritionistId = patient.careTeam.nutritionist ?? assignment?.toId;
  const nutritionist = staffById(nutritionistId);
  const mine = role === "nutritionist" && nutritionistId === user.id;
  const guidance = GUIDANCE[patientId];
  const routine = ROUTINES[patientId];
  const ownFollowUps = followUps.filter((f) => f.patientId === patientId);
  const latestWeight = [...ownFollowUps].sort((a, b) => b.at.localeCompare(a.at)).find((f) => f.weightKg !== null);
  const patientLogs = has("self-report") ? Object.values(logs).filter((l) => l.patientId === patientId) : [];
  const newLogs = patientLogs.filter((l) => l.status === "new").length;

  const release = () => {
    if (!plan) return;
    planActions.release(plan.id, user.id, TODAY.toISOString());
    toast({ title: `Plan v${plan.version} released to ${first}`, description: "Visible in the patient app. Releasing is a separate step from publishing. Saved in this browser session.", tone: "success" });
  };

  const builderHref = plan ? `/nutrition/builder?plan=${plan.id}` : "/nutrition";
  const primary = mine ? (
    plan?.status === "published" ? (
      <Button asChild variant="primary" leading={<NotePencil />}>
        <Link href={builderHref}>Revise as v{plan.version + 1}</Link>
      </Button>
    ) : plan ? (
      <Button asChild variant="primary" leading={<NotePencil />}>
        <Link href={builderHref}>Continue plan v{plan.version}</Link>
      </Button>
    ) : (
      <Button asChild variant="primary" leading={<NotePencil />}>
        <Link href="/nutrition">Start plan v1</Link>
      </Button>
    )
  ) : null;

  const released = plan?.released && plan.released.version === plan.version;
  const actions = (
    <>
      {plan && plan.status === "published" && (mine || role === "doctor") ? (
        has("release") ? (
          released ? (
            <StatusBadge tone="info">v{plan.version} in the patient app</StatusBadge>
          ) : mine ? (
            <Button variant="secondary" leading={<PaperPlaneTilt />} onClick={release}>
              Release to patient
            </Button>
          ) : null
        ) : (
          <PlanPdfButton plan={plan} />
        )
      ) : null}
      {role === "nutritionist" && has("flags") ? (
        <Button variant="secondary" leading={<Warning />} onClick={() => setFlagging(true)}>
          Flag to doctor
        </Button>
      ) : null}
      {role === "doctor" && !nutritionistId ? (
        <Button variant="primary" leading={<ArrowsLeftRight />} onClick={() => setAssigning(true)}>
          Assign to nutrition
        </Button>
      ) : null}
      {primary}
    </>
  );

  if (!plan && !nutritionistId) {
    return (
      <ProfileFrame patient={patient} title="Nutrition" description="Current plan, versions, assessment and follow-ups, with the doctor's guidance alongside." actions={role === "doctor" ? actions : undefined}>
        <Card className="py-6">
          <EmptyState
            icon={<BowlFood />}
            title={`${first} isn't assigned to nutrition`}
            description={role === "doctor" ? "Assign a nutritionist from the care team with goals and any guidance. The plan, its versions and follow-ups will appear here." : `The doctor assigns nutrition from ${first}'s care team. Once assigned to you, it appears in your pending list.`}
            action={
              role === "doctor" ? (
                <Button variant="dark" leading={<ArrowsLeftRight />} onClick={() => setAssigning(true)}>
                  Assign to nutrition
                </Button>
              ) : undefined
            }
          />
        </Card>
        <AssignDialog open={assigning} onOpenChange={setAssigning} patient={patient} discipline="nutrition" />
      </ProfileFrame>
    );
  }

  return (
    <ProfileFrame
      patient={patient}
      title="Nutrition"
      description={mine ? `Your plan for ${first}, its versions and follow-ups — the doctor's guidance is alongside.` : `${nutritionist ? `${nutritionist.name}'s` : "The"} plan for ${first}, its versions and follow-ups. Read-only.`}
      actions={actions}
    >
      <div className="grid grid-cols-1 items-start gap-6 @[1040px]:grid-cols-[minmax(0,1fr)_minmax(320px,384px)]">
        <div className="flex min-w-0 flex-col gap-6">
          <CurrentPlan plan={plan} assignmentState={assignment?.state} canEdit={mine} />
          {plan ? <VersionHistory plan={plan} sessionChanges={[]} showRelease={has("release")} /> : null}
          <FollowUpCard patientId={patientId} entries={followUps} canWrite={mine} />
          {has("self-report") ? (
            <Group>
              <GroupHeader icon={<Camera />} title="Food logs" subtitle={patientLogs.length ? `${patientLogs.length} self-reported · ${newLogs} to review` : "Nothing logged in the patient app yet"} href={patientLogs.length ? "/nutrition/logs" : undefined} actionLabel="Open food logs" />
              {patientLogs.length ? (
                <ul className="flex flex-col gap-2">
                  {patientLogs
                    .sort((a, b) => b.eatenAt.localeCompare(a.eatenAt))
                    .slice(0, 3)
                    .map((l) => (
                      <li key={l.id} className="flex items-start gap-3 rounded-inner bg-surface p-4">
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm text-ink">{l.text}</span>
                          <span className="block text-xs text-muted">
                            {fmtDay(l.eatenAt)} · planned: {l.planned}
                          </span>
                        </span>
                        <StatusBadge tone={l.status === "new" ? "neutral" : l.status === "flagged" ? "warning" : "success"}>{l.status === "new" ? "Self-reported" : l.status === "flagged" ? "Flagged" : "Reviewed"}</StatusBadge>
                      </li>
                    ))}
                </ul>
              ) : null}
            </Group>
          ) : null}
        </div>
        <div className="flex min-w-0 flex-col gap-6">
          <GuidanceSummary guidance={guidance} />
          <Group>
            <GroupHeader icon={<Ruler />} title="Assessment" subtitle="Preferences and measurements" />
            <div className="grid grid-cols-2 gap-2">
              <Inset>
                <p className="text-xs text-muted">Preference</p>
                <p className="mt-1 text-sm text-ink">{plan?.preference ?? routine?.preferences[0] ?? "Not recorded"}</p>
              </Inset>
              <Inset>
                <p className="text-xs text-muted">Weight</p>
                <p className="mt-1 text-sm text-ink">{latestWeight?.weightKg != null ? `${latestWeight.weightKg.toFixed(1)} kg` : "Not recorded"}</p>
                {latestWeight ? <p className="text-[11px] text-muted">{fmtDay(latestWeight.at)}</p> : null}
              </Inset>
              {guidance ? (
                <Inset className="col-span-2">
                  <p className="text-xs text-muted">Targets from the doctor</p>
                  <p className="mt-1 text-sm text-ink tabular">
                    {kcal(guidance.targets.kcal)} kcal · protein {guidance.targets.protein} g · fibre {guidance.targets.fibre} g
                  </p>
                </Inset>
              ) : null}
            </div>
          </Group>
          <RoutinePanel patient={patient} routine={routine} />
          {assignment ? (
            <Card>
              <p className="flex items-center gap-2 text-sm text-ink">
                <ArrowsLeftRight size={18} className="text-ink-2" aria-hidden="true" />
                Assignment
              </p>
              <p className="mt-2 text-sm leading-relaxed text-ink-2">{assignment.reason}</p>
              <p className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted">
                From {staffById(assignment.fromId)?.name} · {fmtDay(assignment.at)}
                <StatusBadge tone={assignment.state === "seen" ? "success" : assignment.overdue ? "danger" : "warning"}>{assignment.state === "seen" ? "Seen" : assignment.overdue ? "Not seen in 48 h" : "Assigned"}</StatusBadge>
              </p>
            </Card>
          ) : null}
        </div>
      </div>
      <FlagToDoctorModal open={flagging} onOpenChange={setFlagging} patients={[{ id: patient.id, hint: plan ? `Nutrition plan v${plan.version}` : undefined }]} context={plan ? `Nutrition plan v${plan.version}` : "Nutrition"} />
    </ProfileFrame>
  );
}

/** The plan the patient follows now: meals by time slot, with the version and its status. */
function CurrentPlan({ plan, assignmentState, canEdit }: { plan: PlanRecord | undefined; assignmentState: "assigned" | "seen" | undefined; canEdit: boolean }) {
  if (!plan) {
    return (
      <Group>
        <GroupHeader icon={<BowlFood />} title="Current plan" subtitle={assignmentState === "assigned" ? "Assigned — not seen by the nutritionist yet" : "No plan yet"} />
        <Inset>
          <p className="text-sm text-muted">The nutritionist starts with an assessment, then publishes plan v1 with the doctor&apos;s guidance alongside.</p>
        </Inset>
      </Group>
    );
  }
  const slots = SLOTS.map((s) => ({ ...s, items: plan.slots[s.id] ?? [] })).filter((s) => s.items.length);
  return (
    <Group>
      <GroupHeader
        icon={<BowlFood />}
        title={plan.title}
        subtitle={`${kcal(plan.calories)} kcal · ${plan.preference} · next review ${fmtDay(plan.nextReview)}`}
        action={
          <StatusBadge tone={PLAN_TONE[plan.status]}>
            v{plan.version} · {PLAN_STATUS_LABEL[plan.status]}
          </StatusBadge>
        }
      />
      {slots.length ? (
        <ul className="grid grid-cols-1 gap-2 @[640px]:grid-cols-2">
          {slots.map((s) => (
            <li key={s.id} className="rounded-inner bg-surface p-4">
              <p className="flex items-baseline justify-between gap-2 text-xs text-muted">
                {s.label}
                <span className="font-mono text-[11px]">{s.home}</span>
              </p>
              <p className="mt-1 text-sm leading-relaxed text-ink">{s.items.map((i) => i.name).join(", ")}</p>
            </li>
          ))}
        </ul>
      ) : (
        <Inset>
          <p className="text-sm text-muted">No meals added yet.</p>
        </Inset>
      )}
      {canEdit ? (
        <Link href={`/nutrition/builder?plan=${plan.id}`} className="mt-2 flex items-center justify-end gap-1 px-2 pb-1 text-xs text-ink-2 underline decoration-line-strong underline-offset-4 hover:decoration-ink">
          Open in the plan builder <ArrowRight size={12} aria-hidden="true" />
        </Link>
      ) : null}
    </Group>
  );
}

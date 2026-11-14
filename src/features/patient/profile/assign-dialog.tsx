"use client";

import { useEffect, useState } from "react";
import { PaperPlaneTilt } from "@phosphor-icons/react";
import type { Patient } from "@/data/types";
import { STAFF, staffById } from "@/data/staff";
import { ASSIGNMENT_RETURN_HOURS } from "@/data/care";
import { Dialog, ModalContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Field, Select, Textarea } from "@/components/ui/input";
import { Segmented } from "@/components/ui/segmented";
import { useToast } from "@/components/ui/toast";
import { useRole } from "@/components/shell/role-context";
import { TODAY } from "@/lib/format";
import { createTask } from "@/features/tasks/store";
import { profileId, updateProfile } from "./profile-store";
import { firstName } from "./derive";

type Discipline = "nutrition" | "yoga";

/**
 * F5 — Assign to a discipline (doctor → nutritionist or instructor): pick the discipline and the
 * person, add goals plus guidance or precautions. It lands in the recipient's pending list as
 * "assigned" and becomes "seen" when they open it; unseen after 48 hours it returns to the doctor.
 */
export function AssignDialog({ open, onOpenChange, patient, discipline: initial = "nutrition" }: { open: boolean; onOpenChange: (v: boolean) => void; patient: Patient; discipline?: Discipline }) {
  const { user } = useRole();
  const { toast } = useToast();
  const [discipline, setDiscipline] = useState<Discipline>(initial);
  const [toId, setToId] = useState("");
  const [goals, setGoals] = useState("");
  const [guidance, setGuidance] = useState("");
  const [tried, setTried] = useState(false);

  const people = STAFF.filter((s) => s.role === (discipline === "nutrition" ? "nutritionist" : "yoga"));
  const teamId = discipline === "nutrition" ? patient.careTeam.nutritionist : patient.careTeam.yoga;

  useEffect(() => {
    if (!open) return;
    setDiscipline(initial);
    setGoals("");
    setGuidance("");
    setTried(false);
  }, [open, initial]);

  useEffect(() => {
    setToId(teamId ?? people.find((s) => s.status !== "on-leave")?.id ?? people[0]?.id ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset the person when the discipline changes
  }, [discipline, open]);

  const goalsError = goals.trim().length < 6 ? "Say what you'd like them to work on." : null;

  const submit = () => {
    setTried(true);
    if (goalsError || !toId) return;
    const at = TODAY.toISOString();
    const to = staffById(toId);
    updateProfile((s) => ({
      ...s,
      assignments: [{ id: profileId("asg"), patientId: patient.id, fromId: user.id, toId, discipline, goals: goals.trim(), guidance: guidance.trim(), at }, ...s.assignments],
      // precautions set with a yoga assignment must be acknowledged by the instructor (F7)
      precautions: discipline === "yoga" && guidance.trim() ? [{ id: profileId("pre"), patientId: patient.id, text: guidance.trim(), reason: "Set with a new yoga assignment", by: user.id, at }, ...s.precautions] : s.precautions,
    }));
    createTask(
      {
        title: `New ${discipline === "nutrition" ? "nutrition" : "yoga"} assignment: ${patient.name}`,
        patientId: patient.id,
        ownerId: toId,
        due: new Date(TODAY.getTime() + ASSIGNMENT_RETURN_HOURS * 3_600_000).toISOString(),
        priority: "normal",
        source: `Assigned by ${user.name}`,
        discipline: discipline === "nutrition" ? "nutrition" : "movement",
        notes: [goals.trim(), guidance.trim()].filter(Boolean).join("\n"),
      },
      user.id,
    );
    onOpenChange(false);
    toast({
      title: `Assigned to ${to?.name ?? "the team"}`,
      description: `It's in their pending list as “assigned” and shows as seen once they open it. Not seen in ${ASSIGNMENT_RETURN_HOURS} hours, it comes back to you. Saved in this browser session.`,
      tone: "success",
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <ModalContent
        title="Assign to nutrition or yoga"
        description={`For ${patient.name}. States: assigned → seen.`}
        footer={
          <>
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button variant="dark" leading={<PaperPlaneTilt />} onClick={submit}>
              Assign
            </Button>
          </>
        }
      >
        <form
          noValidate
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <div className="flex flex-col gap-2">
            <span className="text-sm text-ink">Discipline</span>
            <Segmented
              ariaLabel="Discipline"
              variant="tray"
              size="sm"
              className="self-start"
              value={discipline}
              onChange={setDiscipline}
              items={[
                { value: "nutrition", label: "Nutrition" },
                { value: "yoga", label: "Yoga" },
              ]}
            />
          </div>
          <Field label="Assign to">
            {({ id }) => (
              <Select
                id={id}
                value={toId || undefined}
                onValueChange={setToId}
                options={people.map((s) => ({
                  value: s.id,
                  label: s.name,
                  description: s.id === teamId ? `On ${firstName(patient)}'s care team` : s.status === "on-leave" ? `${s.title} · ${s.workingHours}` : s.title,
                }))}
              />
            )}
          </Field>
          <Field label="Goals" error={tried ? goalsError : null}>
            {(p) => (
              <Textarea
                value={goals}
                onChange={(e) => setGoals(e.target.value)}
                placeholder={discipline === "nutrition" ? "e.g. Heart-healthy vegetarian plan; LDL-C below 70 mg/dL by March" : "e.g. Build to 30 minutes of daily activity without symptoms"}
                {...p}
              />
            )}
          </Field>
          <Field
            label={discipline === "nutrition" ? "Nutrition guidance" : "Precautions"}
            optional
            hint={discipline === "nutrition" ? "Targets or restrictions — shown beside the nutritionist's plan." : "Rules for the instructor, e.g. “HR ceiling 110 bpm; no inversions”. Write precautions, not diagnoses — the instructor acknowledges them before the next session."}
          >
            {(p) => <Textarea value={guidance} onChange={(e) => setGuidance(e.target.value)} {...p} />}
          </Field>
        </form>
      </ModalContent>
    </Dialog>
  );
}

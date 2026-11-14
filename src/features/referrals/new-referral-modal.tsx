"use client";

import { useEffect, useMemo, useState } from "react";
import type { Discipline } from "@/data/types";
import { patientById } from "@/data/patients";
import { staffById } from "@/data/staff";
import { Dialog, ModalContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Field, Select, Textarea } from "@/components/ui/input";
import { Segmented } from "@/components/ui/segmented";
import { useToast } from "@/components/ui/toast";
import { useRole } from "@/components/shell/role-context";
import { DISCIPLINE_DOT, patientOptions, staffOptions } from "@/features/tasks/people";
import { cn } from "@/lib/cn";
import { createAssignment, type CareReferral } from "./store";

const TARGETS: { value: Discipline; label: string }[] = [
  { value: "nutrition", label: "Nutrition" },
  { value: "movement", label: "Yoga" },
];
const CARE_TEAM_KEY = { nutrition: "nutritionist", movement: "yoga" } as const;

/** Spec F5: the doctor picks the discipline and the person, adds goals plus guidance or precautions. */
export function NewAssignmentModal({ open, onOpenChange, onCreated, defaultPatientId }: { open: boolean; onOpenChange: (o: boolean) => void; onCreated: (r: CareReferral) => void; defaultPatientId?: string }) {
  const { user } = useRole();
  const { toast } = useToast();
  const [patientId, setPatientId] = useState("");
  const [discipline, setDiscipline] = useState<Discipline>("nutrition");
  const [toId, setToId] = useState("");
  const [goals, setGoals] = useState("");
  const [guidance, setGuidance] = useState("");
  const [errors, setErrors] = useState<{ patient?: string; to?: string; goals?: string }>({});

  useEffect(() => {
    if (!open) return;
    setPatientId(defaultPatientId ?? "");
    setDiscipline("nutrition");
    setGoals("");
    setGuidance("");
    setErrors({});
  }, [open, defaultPatientId]);

  const receivers = useMemo(() => staffOptions((s) => s.discipline === discipline), [discipline]);

  // Default to the patient's own nutritionist / instructor (if they're not on leave).
  useEffect(() => {
    const key = discipline === "movement" ? CARE_TEAM_KEY.movement : CARE_TEAM_KEY.nutrition;
    const team = patientById(patientId)?.careTeam[key];
    const preferred = team && staffById(team)?.status !== "on-leave" ? team : receivers.find((o) => staffById(o.value)?.status !== "on-leave")?.value;
    setToId(preferred ?? "");
  }, [patientId, discipline, receivers]);

  const yoga = discipline === "movement";

  const submit = () => {
    const next: typeof errors = {};
    if (!patientId) next.patient = "Choose the patient.";
    if (!toId) next.to = `Choose the ${yoga ? "instructor" : "nutritionist"}.`;
    if (goals.trim().length < 8) next.goals = "Add the goals — what this should achieve.";
    setErrors(next);
    if (Object.keys(next).length) return;
    const r = createAssignment({ patientId, fromId: user.id, toId, toDiscipline: discipline, goals: goals.trim(), guidance: guidance.trim() });
    const to = staffById(toId);
    onOpenChange(false);
    onCreated(r);
    toast({
      title: `Assigned to ${to?.name}`,
      description: `It's in ${to?.name.split(" ")[0]}'s pending list. If it isn't opened within 48 hours it comes back to you. Saved in this browser session — nobody was notified.`,
      tone: "success",
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <ModalContent
        title="New assignment"
        description="Assign a patient to a nutritionist or a yoga instructor. It's marked seen when they open it."
        size="md"
        footer={
          <>
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button variant="dark" onClick={submit}>
              Assign
            </Button>
          </>
        }
      >
        <form
          noValidate
          className="grid grid-cols-1 gap-4 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <Field label="Patient" error={errors.patient} className="sm:col-span-2">
            {(p) => (
              <Select
                {...p}
                value={patientId}
                onValueChange={(v) => {
                  setPatientId(v);
                  setErrors((x) => ({ ...x, patient: undefined, to: undefined }));
                }}
                placeholder="Choose a patient"
                options={patientOptions()}
              />
            )}
          </Field>
          <div className="flex flex-col gap-2">
            <span className="text-sm text-ink">Assign to</span>
            <Segmented
              ariaLabel="Discipline"
              variant="tray"
              size="sm"
              value={discipline}
              onChange={setDiscipline}
              className="w-max"
              items={TARGETS.map((d) => ({ value: d.value, label: d.label, icon: <span className={cn("size-2 rounded-full", DISCIPLINE_DOT[d.value])} aria-hidden="true" /> }))}
            />
          </div>
          <Field label={yoga ? "Instructor" : "Nutritionist"} error={errors.to} hint={toId && patientById(patientId)?.careTeam[yoga ? "yoga" : "nutritionist"] === toId ? "On this patient's care team." : undefined}>
            {(p) => (
              <Select
                {...p}
                value={toId}
                onValueChange={(v) => {
                  setToId(v);
                  setErrors((x) => ({ ...x, to: undefined }));
                }}
                placeholder="Choose who"
                options={receivers}
              />
            )}
          </Field>
          <Field label="Goals" error={errors.goals} className="sm:col-span-2">
            {(p) => (
              <Textarea
                {...p}
                value={goals}
                onChange={(e) => {
                  setGoals(e.target.value);
                  if (errors.goals && e.target.value.trim().length >= 8) setErrors((x) => ({ ...x, goals: undefined }));
                }}
                rows={3}
                placeholder={yoga ? "e.g. Gentle flow twice a week; build stamina for daily walks." : "e.g. Weight 84 → 78 kg over 12 weeks; bring triglycerides under 150 mg/dL."}
              />
            )}
          </Field>
          <Field
            label={yoga ? "Precautions" : "Guidance"}
            optional
            className="sm:col-span-2"
            hint={yoga ? "Instructors see precautions, not diagnoses — write what to avoid or watch for." : "Targets or restrictions shown beside the nutritionist's plan."}
          >
            {(p) => <Textarea {...p} value={guidance} onChange={(e) => setGuidance(e.target.value)} rows={2} placeholder={yoga ? "e.g. HR ceiling 110 bpm · no inversions" : "e.g. Sodium under 2 g a day · no alcohol"} />}
          </Field>
          <button type="submit" className="sr-only">
            Assign
          </button>
        </form>
      </ModalContent>
    </Dialog>
  );
}

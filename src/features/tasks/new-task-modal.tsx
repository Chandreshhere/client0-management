"use client";

import { useEffect, useState } from "react";
import type { Priority } from "@/data/types";
import { staffById } from "@/data/staff";
import { Dialog, ModalContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { Segmented } from "@/components/ui/segmented";
import { useToast } from "@/components/ui/toast";
import { useRole } from "@/components/shell/role-context";
import { createTask } from "./store";
import { DUE_TIMES, PRIORITY_LABEL } from "./task-meta";
import { patientOptions, staffOptions } from "./people";
import { TODAY_KEY, isoAt, shortDay } from "./time";

const NO_PATIENT = "none";

/** New task (?new=1 entry point and the page's "New task" button). Saved in this browser session. */
export function NewTaskModal({ open, onOpenChange, onCreated }: { open: boolean; onOpenChange: (o: boolean) => void; onCreated: (id: string) => void }) {
  const { user, role } = useRole();
  const { toast } = useToast();
  const me = role !== "patient" ? user.id : "s-farhan";
  const [title, setTitle] = useState("");
  const [patientId, setPatientId] = useState(NO_PATIENT);
  const [ownerId, setOwnerId] = useState(me);
  const [date, setDate] = useState(TODAY_KEY);
  const [time, setTime] = useState("18:00");
  const [priority, setPriority] = useState<Priority>("normal");
  const [notes, setNotes] = useState("");
  const [errors, setErrors] = useState<{ title?: string; date?: string }>({});

  useEffect(() => {
    if (!open) return;
    setTitle("");
    setPatientId(NO_PATIENT);
    setOwnerId(me);
    setDate(TODAY_KEY);
    setTime("18:00");
    setPriority("normal");
    setNotes("");
    setErrors({});
  }, [open, me]);

  const submit = () => {
    const next: typeof errors = {};
    if (!title.trim()) next.title = "Give the task a short, specific title — it's what the owner sees first.";
    if (!date) next.date = "Pick a due date.";
    else if (date < TODAY_KEY) next.date = "That date has passed — pick today or later.";
    setErrors(next);
    if (Object.keys(next).length) return;
    const due = isoAt(date, time);
    const task = createTask(
      {
        title: title.trim(),
        patientId: patientId === NO_PATIENT ? undefined : patientId,
        ownerId,
        due,
        priority,
        source: `Created by ${user.name}`,
        notes: notes.trim() || undefined,
      },
      user.id,
    );
    onOpenChange(false);
    const owner = staffById(ownerId);
    toast({
      title: "Task created",
      description: `${owner?.id === user.id ? "Assigned to you" : `Assigned to ${owner?.name}`} · due ${shortDay(due)}, ${time}. Saved in this browser session — nobody was notified.`,
      tone: "success",
      action: { label: "Open", onClick: () => onCreated(task.id) },
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <ModalContent
        title="New task"
        description="Give it an owner and a due date so it can't fall through the cracks."
        size="md"
        footer={
          <>
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button variant="dark" onClick={submit}>
              Create task
            </Button>
          </>
        }
      >
        <form
          className="grid grid-cols-1 gap-4 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
          noValidate
        >
          <Field label="Title" error={errors.title} className="sm:col-span-2">
            {(p) => (
              <Input
                {...p}
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value);
                  if (errors.title) setErrors((x) => ({ ...x, title: undefined }));
                }}
                placeholder="e.g. Call to rebook the missed nutrition review"
              />
            )}
          </Field>
          <Field label="Patient" optional>
            {(p) => <Select {...p} value={patientId} onValueChange={setPatientId} options={[{ value: NO_PATIENT, label: "No patient — clinic task" }, ...patientOptions()]} />}
          </Field>
          <Field label="Owner">
            {(p) => <Select {...p} value={ownerId} onValueChange={setOwnerId} options={staffOptions().map((o) => (o.value === user.id ? { ...o, label: `${o.label} (you)` } : o))} />}
          </Field>
          <Field label="Due date" error={errors.date}>
            {(p) => <Input {...p} type="date" value={date} min={TODAY_KEY} onChange={(e) => setDate(e.target.value)} />}
          </Field>
          <Field label="Due time">
            {(p) => <Select {...p} value={time} onValueChange={setTime} options={DUE_TIMES.map((t) => ({ value: t, label: t }))} />}
          </Field>
          <div className="flex flex-col gap-2 sm:col-span-2">
            <span className="text-sm text-ink" id="new-task-priority">
              Priority
            </span>
            <div className="scrollbar-none overflow-x-auto" data-lenis-prevent>
              <Segmented
                ariaLabel="Priority"
                size="sm"
                variant="tray"
                value={priority}
                onChange={setPriority}
                className="w-max"
                items={(["low", "normal", "high", "urgent"] as Priority[]).map((p) => ({ value: p, label: PRIORITY_LABEL[p] }))}
              />
            </div>
          </div>
          <Field label="Notes" optional className="sm:col-span-2">
            {(p) => <Textarea {...p} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Context the owner needs — what, why, and what done looks like." />}
          </Field>
          <button type="submit" className="sr-only">
            Create task
          </button>
        </form>
      </ModalContent>
    </Dialog>
  );
}

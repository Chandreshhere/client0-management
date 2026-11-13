"use client";

import { useEffect, useMemo, useState } from "react";
import type { MessageThread } from "@/data/types";
import { patientById } from "@/data/patients";
import { staffById } from "@/data/staff";
import { Dialog, ModalContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { Segmented } from "@/components/ui/segmented";
import { useToast } from "@/components/ui/toast";
import { useRole } from "@/components/shell/role-context";
import { patientOptions, staffOptions } from "@/features/tasks/people";
import { createThread } from "./store";

type Kind = "patient" | "care-team";
const NONE = "none";

/** New message (?new=1). Saved in this browser session; never delivered (no messaging integration). */
export function NewMessageModal({ open, onOpenChange, onCreated }: { open: boolean; onOpenChange: (o: boolean) => void; onCreated: (thread: MessageThread) => void }) {
  const { user, role } = useRole();
  const { toast } = useToast();
  const isPatient = role === "patient";
  const [kind, setKind] = useState<Kind>("patient");
  const [to, setTo] = useState("");
  const [about, setAbout] = useState(NONE);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [errors, setErrors] = useState<{ to?: string; subject?: string; body?: string }>({});

  useEffect(() => {
    if (!open) return;
    setKind("patient");
    setTo("");
    setAbout(NONE);
    setSubject("");
    setBody("");
    setErrors({});
  }, [open]);

  // Patients write to their own care team (plus the front desk); staff write to patients or colleagues.
  const recipients = useMemo(() => {
    if (isPatient) {
      const team = patientById(user.id)?.careTeam ?? {};
      const ids = Array.from(new Set([team.doctor, team.nutritionist, team.yoga, team.coordinator, "s-sneha"].filter((id): id is string => !!id)));
      return ids.map((id) => {
        const s = staffById(id);
        return { value: id, label: s?.name ?? id, description: id === "s-sneha" ? "Front desk · appointments & billing" : s?.title };
      });
    }
    return kind === "patient" ? patientOptions() : staffOptions((s) => s.id !== user.id);
  }, [isPatient, kind, user.id]);

  const submit = () => {
    const next: typeof errors = {};
    if (!to) next.to = isPatient ? "Choose who on your care team should read this." : "Choose a recipient.";
    if (!subject.trim()) next.subject = "Add a short subject so the thread is easy to find.";
    if (!body.trim()) next.body = "Write your message.";
    setErrors(next);
    if (Object.keys(next).length) return;
    const channel: Kind = isPatient ? "patient" : kind;
    const patientId = isPatient ? user.id : kind === "patient" ? to : about === NONE ? null : about;
    const thread = createThread(
      {
        subject: subject.trim(),
        patientId,
        participants: Array.from(new Set([user.id, to])),
        channel,
        expectedResponse: channel === "patient" ? "Reply within 1 working day" : "Care team · same day",
      },
      user.id,
      body.trim(),
    );
    onOpenChange(false);
    onCreated(thread);
    const toName = staffById(to)?.name ?? patientById(to)?.name ?? "them";
    toast({
      title: "Message saved — not delivered",
      description: `Kept in this browser session only. This prototype has no messaging integration, so ${toName} didn't receive it.`,
      tone: "warning",
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <ModalContent
        title="New message"
        description={isPatient ? "Your care team usually replies within 1 working day. Not for emergencies — call 112." : "Start a thread with a patient or a colleague."}
        size="md"
        footer={
          <>
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button variant="dark" onClick={submit}>
              Send message
            </Button>
          </>
        }
      >
        <form
          noValidate
          className="grid grid-cols-1 gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          {!isPatient ? (
            <div className="flex flex-col gap-2">
              <span className="text-sm text-ink">Conversation with</span>
              <Segmented
                ariaLabel="Conversation type"
                size="sm"
                variant="tray"
                value={kind}
                onChange={(k) => {
                  setKind(k);
                  setTo("");
                  setErrors((x) => ({ ...x, to: undefined }));
                }}
                className="w-max"
                items={[
                  { value: "patient", label: "A patient" },
                  { value: "care-team", label: "Care team" },
                ]}
              />
            </div>
          ) : null}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="To" error={errors.to} className={!isPatient && kind === "care-team" ? undefined : "sm:col-span-2"}>
              {(p) => (
                <Select
                  {...p}
                  value={to}
                  onValueChange={(v) => {
                    setTo(v);
                    setErrors((x) => ({ ...x, to: undefined }));
                  }}
                  placeholder={isPatient ? "Choose someone on your care team" : kind === "patient" ? "Choose a patient" : "Choose a colleague"}
                  options={recipients}
                />
              )}
            </Field>
            {!isPatient && kind === "care-team" ? (
              <Field label="About patient" optional>
                {(p) => <Select {...p} value={about} onValueChange={setAbout} options={[{ value: NONE, label: "No specific patient" }, ...patientOptions()]} />}
              </Field>
            ) : null}
          </div>
          <Field label="Subject" error={errors.subject}>
            {(p) => (
              <Input
                {...p}
                value={subject}
                onChange={(e) => {
                  setSubject(e.target.value);
                  if (errors.subject) setErrors((x) => ({ ...x, subject: undefined }));
                }}
                placeholder={isPatient ? "e.g. Question about my meal plan" : "e.g. Rebooking after a missed review"}
              />
            )}
          </Field>
          <Field label="Message" error={errors.body}>
            {(p) => (
              <Textarea
                {...p}
                value={body}
                onChange={(e) => {
                  setBody(e.target.value);
                  if (errors.body) setErrors((x) => ({ ...x, body: undefined }));
                }}
                placeholder="Write your message…"
              />
            )}
          </Field>
          <p className="text-xs text-muted">Saved in this browser only. It won&apos;t be delivered — this prototype has no messaging integration.</p>
          <button type="submit" className="sr-only">
            Send message
          </button>
        </form>
      </ModalContent>
    </Dialog>
  );
}

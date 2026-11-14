"use client";

import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { useId, useState, type FormEvent, type ReactNode } from "react";
import { ChatText, Envelope, ListChecks, Phone, PhoneCall, Plus, WhatsappLogo } from "@phosphor-icons/react";
import { spring } from "@/lib/motion";
import { pluralize } from "@/lib/format";
import { useRole } from "@/components/shell/role-context";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, ModalContent } from "@/components/ui/dialog";
import { Field, Select, Textarea } from "@/components/ui/input";
import { Segmented } from "@/components/ui/segmented";
import { StatusBadge } from "@/components/ui/status";
import { useToast } from "@/components/ui/toast";
import { DEMO_USER, staffById } from "@/data/staff";
import { PATIENTS, patientById } from "@/data/patients";
import { DISCIPLINE_LABEL } from "@/data/appointments";
import { CLASSES } from "@/data/programs";
import {
  CONTACT_ATTEMPTS,
  CONTACT_CHANNELS,
  CONTACT_OUTCOMES,
  NOW_ISO,
  NOW_LABEL,
  TODAY_KEY,
  daysSince,
  istDayKey,
  profileHref,
  shortDate,
  whenLabel,
  type ContactAttempt,
  type ContactChannel,
  type ContactOutcome,
} from "./data";
import { followUpsOwnedBy, repeatedMissedSessions, unseenAssignmentsForCoordinator } from "./owners";
import { useDashboardState } from "./session";
import { DashGrid, DashboardHeader, FocalCard, FocalHead, FocalStat, OwnerTag, Panel, Rail, Reveal } from "./ui";

/**
 * Care-coordinator home (Pro) — "Whose care has stalled?"
 * Follow-ups overdue, assignments not seen in 48 hours and repeated missed sessions — each item
 * with one owner shown — plus the contact log the coordinator acts through. Clinical detail is
 * left out (coordinators see status, not content). Programme cohorts live on the Programmes screen.
 */
const ME = DEMO_USER.coordinator.personId;
/** Programme cohorts live off the home. There is no /programmes screen yet, so this opens the patient list (filterable by programme). */
const PROGRAMMES_HREF = "/programmes";

const CHANNEL_ICON: Record<ContactChannel, typeof Phone> = { Call: Phone, SMS: ChatText, WhatsApp: WhatsappLogo, Email: Envelope };
const outcomeTone = (o: ContactOutcome) => (o === "Spoke to patient" ? "success" : o === "Wrong number" ? "danger" : o === "Left message" ? "info" : "warning");

export function CoordinatorHome() {
  const { plan } = useRole();
  const { toast } = useToast();
  const { seen } = useDashboardState();
  const [attempts, setAttempts] = useState<ContactAttempt[]>(CONTACT_ATTEMPTS);
  const [dialog, setDialog] = useState<{ open: boolean; patientId: string }>({ open: false, patientId: "" });
  const [nudged, setNudged] = useState<Record<string, string>>({});

  const followUps = followUpsOwnedBy(ME, plan);
  const unseen = unseenAssignmentsForCoordinator(plan, seen);
  const missed = repeatedMissedSessions(plan);
  const total = followUps.length + unseen.length + missed.length;
  const patients = new Set([...followUps, ...unseen, ...missed].map((x) => x.patientId)).size;
  const lastContact = (patientId: string) => attempts.filter((a) => a.patientId === patientId).sort((a, b) => b.at.localeCompare(a.at))[0];
  const stalledIds = new Set([...followUps, ...unseen, ...missed].map((x) => x.patientId));

  const addAttempt = (a: Omit<ContactAttempt, "id" | "at" | "byId">) => {
    setAttempts((xs) => [{ ...a, id: `ca-local-${xs.length + 1}`, at: NOW_ISO, byId: ME }, ...xs]);
    toast({ tone: "success", title: `Contact logged · ${patientById(a.patientId)?.name}`, description: "Recorded in this browser session — nothing was sent to the patient." });
  };

  const logFor = (patientId: string) => setDialog({ open: true, patientId });

  return (
    <div className="flex flex-col gap-6">
      <DashboardHeader
        summary={`${pluralize(total, "item")} stalled across ${pluralize(patients, "patient")} · ${pluralize(followUps.length, "follow-up")} overdue · ${pluralize(unseen.length, "assignment")} not seen · ${pluralize(missed.length, "patient")} missing sessions`}
        actions={
          <>
            <Button variant="dark" onClick={() => logFor("")}>
              <PhoneCall />
              Log contact
            </Button>
            <Button asChild variant="secondary">
              <Link href={PROGRAMMES_HREF}>
                <ListChecks />
                Programmes
              </Link>
            </Button>
          </>
        }
      />

      <DashGrid>
        <Reveal index={0} className="lg:col-span-2">
          <StalledCard total={total} patients={patients} counts={{ followUps: followUps.length, unseen: unseen.length, missed: missed.length }}>
              {followUps.map((f) => (
                <StalledItem
                  key={f.id}
                  kind="Follow-up overdue"
                  patientId={f.patientId}
                  reason={f.reason}
                  detail={f.detail}
                  ownerId={f.ownerId}
                  contact={lastContact(f.patientId)}
                  action={
                    <Button size="sm" variant="dark" onClick={() => logFor(f.patientId)} aria-label={`Log contact with ${patientById(f.patientId)?.name}`}>
                      Log contact
                    </Button>
                  }
                />
              ))}
              {unseen.map((r) => {
                const to = staffById(r.toId);
                return (
                  <StalledItem
                    key={r.id}
                    kind="Assignment not seen"
                    patientId={r.patientId}
                    reason={`${DISCIPLINE_LABEL[r.toDiscipline]} assignment not opened`}
                    detail={`Assigned to ${to?.name} on ${shortDate(r.requestedAt)} · ${pluralize(daysSince(r.requestedAt), "day")} unseen · back on the doctor's list`}
                    ownerId={r.fromId}
                    action={
                      nudged[r.id] ? (
                        <StatusBadge tone="success">Nudged {nudged[r.id]}</StatusBadge>
                      ) : (
                        <>
                          <Button asChild size="sm" variant="ghost">
                            <Link href="/referrals">Reassign</Link>
                          </Button>
                          <Button
                            size="sm"
                            variant="dark"
                            onClick={() => {
                              setNudged((s) => ({ ...s, [r.id]: NOW_LABEL }));
                              toast({ title: `Reminder recorded for ${to?.name}`, description: "Saved in this browser session — nothing was sent." });
                            }}
                          >
                            Nudge {to?.name.split(" ")[0]}
                          </Button>
                        </>
                      )
                    }
                  />
                );
              })}
              {missed.map((m) => {
                const instructor = staffById(m.absences[0].instructorId);
                const title = CLASSES.find((c) => c.start === m.absences[0].at && c.instructorId === m.absences[0].instructorId)?.title;
                return (
                  <StalledItem
                    key={m.id}
                    kind="Missed sessions"
                    patientId={m.patientId}
                    reason={`Absent from ${pluralize(m.absences.length, "session")}`}
                    detail={`${m.absences.map((a) => shortDate(a.at)).join(" and ")}${title ? ` · ${title}` : ""} with ${instructor?.name}`}
                    ownerId={m.ownerId}
                    contact={lastContact(m.patientId)}
                    action={
                      <Button size="sm" variant="dark" onClick={() => logFor(m.patientId)} aria-label={`Log contact with ${patientById(m.patientId)?.name}`}>
                        Log contact
                      </Button>
                    }
                  />
                );
              })}
          </StalledCard>
        </Reveal>

        <Rail index={1}>
          <Panel
            icon={<PhoneCall />}
            title="Contact log"
            subtitle={`${attempts.filter((a) => istDayKey(a.at) === TODAY_KEY).length} today · ${attempts.length} this week`}
            action={
              <Button size="sm" variant="secondary" className="shadow-none" onClick={() => logFor("")} aria-label="Log a contact attempt">
                <Plus />
                Log
              </Button>
            }
          >
            <ul className="flex flex-col gap-2">
              <AnimatePresence initial={false}>
                {attempts.map((a) => {
                  const p = patientById(a.patientId);
                  const Icon = CHANNEL_ICON[a.channel];
                  return (
                    <motion.li key={a.id} layout initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={spring}>
                      <Link href={profileHref(a.patientId)} className="block rounded-inner bg-surface p-4 transition-colors duration-200 hover:bg-canvas">
                        <span className="flex items-start gap-3">
                          <Avatar src={p?.avatar} name={p?.name ?? "Patient"} size="sm" />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm text-ink">{p?.name}</span>
                            <span className="flex items-center gap-1.5 text-xs text-muted">
                              <Icon size={14} aria-hidden="true" />
                              {a.channel} · {whenLabel(a.at)}
                            </span>
                          </span>
                          <StatusBadge tone={outcomeTone(a.outcome)}>{a.outcome}</StatusBadge>
                        </span>
                        {a.note ? <span className="mt-3 block text-xs text-ink-2">{a.note}</span> : null}
                      </Link>
                    </motion.li>
                  );
                })}
              </AnimatePresence>
            </ul>
          </Panel>
        </Rail>
      </DashGrid>

      <ContactDialog
        open={dialog.open}
        initialPatientId={dialog.patientId}
        stalledIds={stalledIds}
        onOpenChange={(open) => setDialog((d) => ({ ...d, open }))}
        onSave={(a) => {
          addAttempt(a);
          setDialog({ open: false, patientId: "" });
        }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------------------------
// Focal: care that has stalled, grouped by what stopped
// ---------------------------------------------------------------------------------------------

function StalledCard({ total, patients, counts, children }: { total: number; patients: number; counts: { followUps: number; unseen: number; missed: number }; children: ReactNode }) {
  const id = useId();
  return (
    <FocalCard labelledBy={id} className="h-full">
      <FocalHead
        id={id}
        label="Whose care has stalled"
        title={total ? `${pluralize(patients, "patient")} need a push today` : "Nothing has stalled"}
        meta={`${pluralize(counts.followUps, "follow-up")} overdue · ${pluralize(counts.unseen, "assignment")} not seen in 48 hours · ${pluralize(counts.missed, "patient")} missing sessions. Each item has one owner; clinical detail stays on the record.`}
        aside={<FocalStat value={total} caption="stalled items" />}
      />
      {total ? <ul className="grid grid-cols-1 gap-2 md:grid-cols-2">{children}</ul> : <p className="rounded-inner bg-white/10 px-4 py-3 text-sm text-white">Every assignment has been opened, follow-ups are booked and nobody is missing sessions.</p>}
    </FocalCard>
  );
}

function StalledItem({ kind, patientId, reason, detail, ownerId, contact, action }: { kind: string; patientId: string; reason: string; detail: string; ownerId: string; contact?: ContactAttempt; action: ReactNode }) {
  const p = patientById(patientId);
  return (
    <li className="flex flex-col rounded-inner bg-surface p-4 text-ink">
      <div className="flex items-start gap-3">
        <Avatar src={p?.avatar} name={p?.name ?? "Patient"} size="sm" />
        <div className="min-w-0 flex-1">
          <div className="flex min-h-6 items-start justify-between gap-2">
            <Link href={profileHref(patientId)} className="min-w-0 truncate pt-0.5 text-sm text-ink underline-offset-4 hover:underline">
              {p?.name}
            </Link>
            <StatusBadge tone="neutral" dot={false} className="shrink-0">
              {kind}
            </StatusBadge>
          </div>
          <p className="text-xs text-ink-2">{reason}</p>
          <p className="text-xs text-muted">{detail}</p>
          {contact ? (
            <p className="mt-1 text-xs text-muted">
              Last contact: {contact.channel} · {contact.outcome.toLowerCase()} · {whenLabel(contact.at).replace(/^Today/, "today").replace(/^Yesterday/, "yesterday")}
            </p>
          ) : null}
        </div>
      </div>
      <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-4">
        <OwnerTag staffId={ownerId} me={ME} />
        <span className="flex flex-wrap items-center gap-2">{action}</span>
      </div>
    </li>
  );
}

// ---------------------------------------------------------------------------------------------
// Log a contact attempt (local only)
// ---------------------------------------------------------------------------------------------

function ContactDialog({
  open,
  initialPatientId,
  stalledIds,
  onOpenChange,
  onSave,
}: {
  open: boolean;
  initialPatientId: string;
  stalledIds: Set<string>;
  onOpenChange: (open: boolean) => void;
  onSave: (a: Omit<ContactAttempt, "id" | "at" | "byId">) => void;
}) {
  const formId = useId();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <ModalContent
        title="Log a contact attempt"
        description="Record a call or message you made. Saved in this browser session only — nothing is sent to the patient."
        size="sm"
        footer={
          <>
            <DialogClose asChild>
              <Button variant="ghost">Cancel</Button>
            </DialogClose>
            <Button variant="dark" type="submit" form={formId}>
              Save attempt
            </Button>
          </>
        }
      >
        {open ? <ContactForm key={initialPatientId} formId={formId} initialPatientId={initialPatientId} stalledIds={stalledIds} onSave={onSave} /> : null}
      </ModalContent>
    </Dialog>
  );
}

function ContactForm({ formId, initialPatientId, stalledIds, onSave }: { formId: string; initialPatientId: string; stalledIds: Set<string>; onSave: (a: Omit<ContactAttempt, "id" | "at" | "byId">) => void }) {
  const [patientId, setPatientId] = useState(initialPatientId);
  const [channel, setChannel] = useState<ContactChannel>("Call");
  const [outcome, setOutcome] = useState<ContactOutcome | "">("");
  const [note, setNote] = useState("");
  const [errors, setErrors] = useState<{ patient?: string; outcome?: string }>({});
  const options = [...PATIENTS]
    .sort((a, b) => Number(stalledIds.has(b.id)) - Number(stalledIds.has(a.id)) || a.name.localeCompare(b.name))
    .map((p) => ({ value: p.id, label: p.name, description: stalledIds.has(p.id) ? "Care stalled" : undefined }));

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const next = { patient: patientId ? undefined : "Choose who you contacted", outcome: outcome ? undefined : "Choose what happened" };
    setErrors(next);
    if (next.patient || next.outcome || !outcome) return;
    onSave({ patientId, channel, outcome, note: note.trim() });
  };

  return (
    <form id={formId} onSubmit={submit} className="flex flex-col gap-4" noValidate>
      <Field label="Patient" error={errors.patient}>
        {(f) => <Select id={f.id} value={patientId} onValueChange={(v) => setPatientId(v)} options={options} placeholder="Choose a patient" ariaLabel="Patient" />}
      </Field>
      <div className="flex flex-col gap-2">
        <span className="text-sm text-ink">Channel</span>
        <Segmented items={CONTACT_CHANNELS.map((c) => ({ value: c, label: c }))} value={channel} onChange={setChannel} ariaLabel="Channel" size="sm" variant="tray" className="self-start" />
      </div>
      <Field label="Outcome" error={errors.outcome}>
        {(f) => <Select id={f.id} value={outcome || undefined} onValueChange={(v) => setOutcome(v as ContactOutcome)} options={CONTACT_OUTCOMES.map((o) => ({ value: o, label: o }))} placeholder="What happened?" ariaLabel="Outcome" />}
      </Field>
      <Field label="Note" optional hint="Avoid clinical detail — this log is visible to the whole care team.">
        {(f) => <Textarea {...f} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Will call back after 18:00" rows={3} />}
      </Field>
    </form>
  );
}

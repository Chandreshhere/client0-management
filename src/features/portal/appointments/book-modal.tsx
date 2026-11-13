"use client";

import { AnimatePresence, motion } from "motion/react";
import { useId, useState, type ReactNode } from "react";
import { ArrowLeft, CheckCircle } from "@phosphor-icons/react";
import { cn } from "@/lib/cn";
import { spring } from "@/lib/motion";
import { formatTime } from "@/lib/format";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Dialog, ModalContent } from "@/components/ui/dialog";
import { Field, Textarea } from "@/components/ui/input";
import { DemoFlag } from "@/components/ui/misc";
import { BRANCHES, staffById } from "@/data/staff";
import type { PortalAppt } from "./data";
import { BOOK_SERVICES, BRANCH_INFO, POLICY, nextFreeSlot, serviceById } from "./data";
import { SlotPicker } from "./slot-picker";
import { addRequest } from "./store";
import { DemoNote, DisciplineTag, MetaRow } from "../ui";
import { localId } from "../store";
import { dayLabel, nowIso } from "../time";

const STEPS = ["Service", "Practitioner", "Time", "Confirm"] as const;
type Step = 0 | 1 | 2 | 3 | 4;
const NOTE_MAX = 300;

/**
 * Book or request a visit. Mount with a fresh `key` per opening so every flow starts clean.
 * The request is saved in this browser session only and labelled as such — the clinic is not told.
 */
export function BookModal({
  open,
  onOpenChange,
  initialServiceId,
  initialStaffId,
  initialDay,
  initialSlot,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  initialServiceId?: string;
  /** with a service: skip straight to times with this practitioner */
  initialStaffId?: string;
  /** "YYYY-MM-DD" to open the time step on */
  initialDay?: string;
  /** ISO start of a time the patient already picked (pre-selected on the time step) */
  initialSlot?: string;
}) {
  const presetStaff = initialServiceId && initialStaffId && serviceById(initialServiceId)?.staff.includes(initialStaffId) ? initialStaffId : null;
  const [step, setStep] = useState<Step>(initialServiceId ? (presetStaff ? 2 : 1) : 0);
  const [dir, setDir] = useState(1);
  const [serviceId, setServiceId] = useState<string | null>(initialServiceId ?? null);
  const [staffId, setStaffId] = useState<string | null>(() => {
    if (presetStaff) return presetStaff;
    const s = initialServiceId ? serviceById(initialServiceId) : undefined;
    return s && s.staff.length === 1 ? s.staff[0] : null;
  });
  const [slot, setSlot] = useState<string | null>(presetStaff && initialSlot ? initialSlot : null);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<PortalAppt | null>(null);

  const service = serviceId ? serviceById(serviceId) : undefined;
  const staff = staffById(staffId ?? undefined);

  const go = (to: Step) => {
    setDir(to > step ? 1 : -1);
    setError(null);
    setStep(to);
  };

  const next = () => {
    if (step === 0 && !service) return setError("Choose what the visit is for.");
    if (step === 1 && !staff) return setError("Choose who you'd like to see.");
    if (step === 2 && !slot) return setError("Choose a time that suits you.");
    if (step === 3) return submit();
    go((step + 1) as Step);
  };

  const submit = () => {
    if (!service || !staff || !slot) return;
    const appt: PortalAppt = {
      id: localId("req"),
      start: slot,
      durationMin: service.durationMin,
      service: service.name,
      discipline: service.discipline,
      kind: service.discipline === "movement" ? "session" : service.id === "consult" ? "consultation" : "follow-up",
      staffId: staff.id,
      room: staff.room ?? "Room to be confirmed",
      branch: staff.branch,
      status: "requested",
      cost: service.cost,
      local: true,
      requestNote: note.trim() || undefined,
      pending: { label: "Requested by you", at: nowIso(), reply: "The front desk confirms within 1 working day" },
    };
    addRequest(appt);
    setCreated(appt);
    go(4);
  };

  const footer =
    step === 4 ? (
      <>
        <Button
          variant="secondary"
          onClick={() => {
            setServiceId(null);
            setStaffId(null);
            setSlot(null);
            setNote("");
            setCreated(null);
            go(0);
          }}
        >
          Book another
        </Button>
        <Button variant="dark" onClick={() => onOpenChange(false)}>
          Done
        </Button>
      </>
    ) : (
      <>
        {step > 0 ? (
          <Button variant="ghost" className="mr-auto" onClick={() => go((step - 1) as Step)} leading={<ArrowLeft />}>
            Back
          </Button>
        ) : null}
        <Button variant="ghost" onClick={() => onOpenChange(false)}>
          Cancel
        </Button>
        <Button variant={step === 3 ? "primary" : "dark"} onClick={next}>
          {step === 3 ? "Send request" : "Continue"}
        </Button>
      </>
    );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <ModalContent
        size="lg"
        title={step === 4 ? "Request saved" : "Book or request a visit"}
        description={step === 4 ? undefined : "Pick a service, a person and a time. The clinic confirms every request."}
        footer={footer}
      >
        {step < 4 ? <StepRail step={step} /> : null}
        <div className="relative overflow-hidden">
          <AnimatePresence mode="wait" initial={false} custom={dir}>
            <motion.div
              key={step}
              custom={dir}
              initial={{ opacity: 0, x: dir * 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: dir * -24, transition: { duration: 0.12 } }}
              transition={spring}
              className="pt-4"
            >
              {step === 0 ? (
                <ChoiceGroup label="Service">
                  {BOOK_SERVICES.map((s) => (
                    <Choice
                      key={s.id}
                      checked={serviceId === s.id}
                      onSelect={() => {
                        setServiceId(s.id);
                        setStaffId(s.staff.length === 1 ? s.staff[0] : null);
                        setSlot(null);
                        setError(null);
                      }}
                    >
                      <DisciplineTag discipline={s.discipline} />
                      <span className="text-base text-ink">{s.name}</span>
                      <span className="text-sm text-muted">{s.description}</span>
                      <span className="mt-auto pt-2 text-xs text-ink-2">
                        {s.durationMin} min · {s.cost}
                      </span>
                    </Choice>
                  ))}
                </ChoiceGroup>
              ) : null}

              {step === 1 && service ? (
                <ChoiceGroup label="Practitioner">
                  {service.staff.map((id) => {
                    const p = staffById(id)!;
                    const onLeave = p.status === "on-leave";
                    const free = onLeave ? null : nextFreeSlot(id, service.durationMin);
                    const branch = BRANCHES.find((b) => b.id === p.branch);
                    return (
                      <Choice
                        key={id}
                        checked={staffId === id}
                        disabled={onLeave || !free}
                        onSelect={() => {
                          setStaffId(id);
                          setSlot(null);
                          setError(null);
                        }}
                      >
                        <span className="flex items-center gap-3">
                          <Avatar src={p.avatar} name={p.name} size="md" />
                          <span className="min-w-0">
                            <span className="block truncate text-base text-ink">{p.name}</span>
                            <span className="block truncate text-sm text-muted">{p.title}</span>
                          </span>
                        </span>
                        <span className="mt-auto pt-2 text-xs text-ink-2">
                          {branch?.name} branch ·{" "}
                          {onLeave ? p.workingHours : free ? `Next free: ${dayLabel(free)} · ${formatTime(free)}` : "No open times this week"}
                        </span>
                      </Choice>
                    );
                  })}
                </ChoiceGroup>
              ) : null}

              {step === 2 && service && staff ? (
                <div className="flex flex-col gap-4">
                  <p className="text-sm text-ink-2">
                    Open times with <span className="text-ink">{staff.name}</span> · {service.durationMin} min
                  </p>
                  <SlotPicker
                    staffId={staff.id}
                    durationMin={service.durationMin}
                    initialDay={initialDay}
                    value={slot}
                    onChange={(iso) => {
                      setSlot(iso);
                      setError(null);
                    }}
                    invalid={!!error}
                  />
                </div>
              ) : null}

              {step === 3 && service && staff && slot ? (
                <div className="flex flex-col gap-4">
                  <dl className="divide-y divide-line rounded-inner bg-sunken px-4 py-2">
                    <MetaRow label="Service">{service.name}</MetaRow>
                    <MetaRow label="With">{staff.name}</MetaRow>
                    <MetaRow label="When">
                      {dayLabel(slot)} · {formatTime(slot)} · {service.durationMin} min
                    </MetaRow>
                    <MetaRow label="Where">
                      {staff.room ?? "Room to be confirmed"} · {BRANCH_INFO[staff.branch].name.split(" · ")[1]}
                    </MetaRow>
                    <MetaRow label="Cost">{service.cost}</MetaRow>
                  </dl>
                  <Field label="Anything the clinic should know?" optional hint={`${note.length} / ${NOTE_MAX}`}>
                    {(f) => <Textarea {...f} value={note} maxLength={NOTE_MAX} onChange={(e) => setNote(e.target.value)} placeholder="For example: I can only come before 10:00 on weekdays." />}
                  </Field>
                  <DemoNote>
                    {POLICY.free} {POLICY.late}
                  </DemoNote>
                  <DemoNote>This demo doesn&apos;t contact the clinic — your request is saved in this browser session only.</DemoNote>
                </div>
              ) : null}

              {step === 4 && created ? <Done appt={created} /> : null}
            </motion.div>
          </AnimatePresence>
        </div>
        {error ? (
          <p role="alert" className="mt-4 text-sm text-danger">
            {error}
          </p>
        ) : null}
      </ModalContent>
    </Dialog>
  );
}

function StepRail({ step }: { step: number }) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs text-muted">
        Step {step + 1} of {STEPS.length} · <span className="text-ink">{STEPS[step]}</span>
      </p>
      <ol className="grid grid-cols-4 gap-2" aria-label="Booking steps">
        {STEPS.map((s, i) => (
          <li key={s} className="flex flex-col gap-2">
            <span className="h-1 overflow-hidden rounded-full bg-sunken">
              <span
                className="block h-full rounded-full bg-charcoal transition-[width] duration-500 [transition-timing-function:var(--ease-spring)]"
                style={{ width: i <= step ? "100%" : "0%" }}
              />
            </span>
            <span className={cn("hidden text-xs sm:block", i === step ? "text-ink" : "text-muted")} aria-current={i === step ? "step" : undefined}>
              {s}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}

function ChoiceGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div role="radiogroup" aria-label={label} className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      {children}
    </div>
  );
}

/** Radio card: recessed at rest, white with a charcoal ring when chosen (genuinely selected). */
function Choice({ checked, disabled, onSelect, children }: { checked: boolean; disabled?: boolean; onSelect: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={checked}
      disabled={disabled}
      onClick={onSelect}
      className={cn(
        "flex min-h-[136px] flex-col items-start gap-1 rounded-inner p-4 text-left transition-[background-color,box-shadow] duration-200",
        checked ? "bg-surface shadow-[inset_0_0_0_2px_var(--color-charcoal)]" : "bg-sunken hover:bg-sunken-2",
        disabled && "opacity-50",
      )}
    >
      {children}
    </button>
  );
}

function Done({ appt }: { appt: PortalAppt }) {
  const id = useId();
  const staff = staffById(appt.staffId);
  return (
    <section aria-labelledby={id} className="flex flex-col items-center gap-4 py-4 text-center">
      <motion.span
        initial={{ scale: 0.6, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 520, damping: 30, mass: 1 }}
        className="flex size-16 items-center justify-center rounded-full bg-success-soft text-success"
        aria-hidden="true"
      >
        <CheckCircle size={32} weight="fill" />
      </motion.span>
      <div className="flex flex-col items-center gap-2">
        <h3 id={id} className="text-xl font-normal tracking-[-0.01em] text-ink">
          Request sent to the clinic
        </h3>
        <DemoFlag>Demo — nothing was sent</DemoFlag>
      </div>
      <p className="max-w-[48ch] text-sm text-ink-2">
        {appt.service} with {staff?.name} · {dayLabel(appt.start)} at {formatTime(appt.start)}.
      </p>
      <p className="max-w-[52ch] text-sm text-muted">
        In the live portal the front desk confirms this time, or offers another, within 1 working day. Here it&apos;s saved in this browser session and listed under
        “Waiting for the clinic”.
      </p>
    </section>
  );
}

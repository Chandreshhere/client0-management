"use client";

import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { useDeferredValue, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ArrowUpRight, CalendarPlus, ShieldCheck, Users, Warning } from "@phosphor-icons/react";
import type { Appointment, BranchId, Patient } from "@/data/types";
import { STAFF, staffById } from "@/data/staff";
import { TODAY, formatDate, formatTime } from "@/lib/format";
import { cn } from "@/lib/cn";
import { spring } from "@/lib/motion";
import { usePlan, useRole } from "@/components/shell/role-context";
import { useClinic } from "@/features/settings/store";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Dialog, ModalContent } from "@/components/ui/dialog";
import { Checkbox, Field, Input, Select, Switch } from "@/components/ui/input";
import {
  FIRST_VISIT_SERVICES,
  LANGUAGES,
  TODAY_YMD,
  abhaDigits,
  ageOn,
  branchLabel,
  clinicNoOf,
  dayWord,
  findDuplicates,
  formatAbha,
  freeSlots,
  isIndianMobile,
  localityOf,
  maskPhone,
  nextClinicNumber,
  phoneDigits,
  type DuplicateMatch,
  type RegistryPatient,
  type Sex,
} from "./data";

type Form = {
  name: string;
  dob: string;
  sex: Sex | "";
  phone: string;
  email: string;
  address: string;
  emergencyName: string;
  emergencyPhone: string;
  concern: string;
  language: string;
  branch: BranchId;
  abha: string;
  doctor: string;
  consent: boolean;
};

type Booking = { on: boolean; service: string; staff: string; slot: string };
type ErrorKey = keyof Form | "duplicate" | "service" | "staff" | "slot";
type Errors = Partial<Record<ErrorKey, string>>;

const EMPTY_FORM: Form = {
  name: "",
  dob: "",
  sex: "",
  phone: "",
  email: "",
  address: "",
  emergencyName: "",
  emergencyPhone: "",
  concern: "",
  language: "English",
  branch: "indiranagar",
  abha: "",
  doctor: "",
  consent: false,
};
const EMPTY_BOOKING: Booking = { on: false, service: "", staff: "", slot: "" };
/** Order used to focus the first invalid field after a submit attempt. */
const FIELD_ORDER: ErrorKey[] = ["name", "dob", "sex", "phone", "email", "duplicate", "address", "emergencyName", "emergencyPhone", "language", "concern", "branch", "abha", "doctor", "service", "staff", "slot", "consent"];
const DOCTORS = STAFF.filter((s) => s.role === "doctor");

export interface Registration {
  patient: RegistryPatient;
  visit: Appointment | null;
  flaggedDuplicate: boolean;
}

/**
 * Register a patient (F2) — Doctor, Admin or Reception; opened from the page header, the "+" menu,
 * ⌘K, or /patients?new=1. Name, phone, date of birth, sex, address and emergency contact → a
 * duplicate check by phone shows any possible match before saving (the admin merges later, never
 * automatically) → DPDP consent recorded with the date and who recorded it → clinic ID generated,
 * ABHA optional → primary doctor assigned, so the patient appears in that doctor's list.
 */
export function RegisterPatientModal({
  open,
  onOpenChange,
  pool,
  localPatients,
  sessionVisits,
  onRegistered,
  onOpenLocal,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pool: RegistryPatient[];
  localPatients: RegistryPatient[];
  sessionVisits: Appointment[];
  onRegistered: (r: Registration) => void;
  onOpenLocal: (id: string) => void;
}) {
  const { has } = usePlan();
  const { user, role } = useRole();
  const clinic = useClinic();
  const clinicalForm = role === "doctor";
  const canBook = has("calendar");
  const [form, setForm] = useState<Form>(EMPTY_FORM);
  const [booking, setBooking] = useState<Booking>(EMPTY_BOOKING);
  const [ackKey, setAckKey] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const formRef = useRef<HTMLFormElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const revealDuplicates = () => formRef.current?.querySelector<HTMLElement>('[data-cell="duplicate"]')?.scrollIntoView({ block: "center", behavior: "smooth" });

  // Fresh form each time the modal opens (state survives the closing animation, then resets).
  useEffect(() => {
    if (open) {
      // A doctor registering is usually the patient's doctor.
      setForm({ ...EMPTY_FORM, doctor: role === "doctor" ? user.id : "" });
      setBooking(EMPTY_BOOKING);
      setAckKey(null);
      setAttempt(0);
    }
  }, [open]);

  const set = <K extends keyof Form>(key: K, value: Form[K]) => setForm((f) => ({ ...f, [key]: value }));

  // Duplicate detection while typing (deferred so typing stays responsive).
  const dName = useDeferredValue(form.name);
  const dPhone = useDeferredValue(form.phone);
  const dDob = useDeferredValue(form.dob);
  const matches = useMemo(() => findDuplicates({ name: dName, phone: dPhone, dob: dDob }, pool), [dName, dPhone, dDob, pool]);
  const matchKey = matches.map((m) => m.patient.id).join(",");
  const continued = matchKey !== "" && ackKey === matchKey;

  const services = FIRST_VISIT_SERVICES.filter((s) => !s.feature || has(s.feature));
  const service = services.find((s) => s.id === booking.service);
  const practitioners = service ? STAFF.filter((s) => s.role === service.role) : [];
  const available = practitioners.filter((s) => s.status !== "on-leave");
  const onLeave = practitioners.filter((s) => s.status === "on-leave");
  const slots = useMemo(() => (service && booking.staff ? freeSlots(booking.staff, service.durationMin, sessionVisits) : []), [service, booking.staff, sessionVisits]);

  const age = ageOn(form.dob);
  const clinicNo = nextClinicNumber(localPatients);

  const errors: Errors = attempt > 0 ? validate(form, booking, matches.length > 0 && !continued) : {};
  const hasErrors = Object.keys(errors).length > 0;

  // After a failed submit, move focus to the first problem.
  useEffect(() => {
    if (!attempt) return;
    const first = FIELD_ORDER.find((k) => errors[k]);
    if (!first) return;
    const cell = formRef.current?.querySelector<HTMLElement>(`[data-cell="${first}"]`);
    const target = cell?.querySelector<HTMLElement>("input:not([type=hidden]), button, [tabindex]");
    target?.focus();
    cell?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once per submit attempt
  }, [attempt]);

  // Booking a consultation: the primary doctor is the natural practitioner.
  useEffect(() => {
    if (booking.service === "consult" && !booking.staff && form.doctor && available.some((s) => s.id === form.doctor)) setBooking((b) => ({ ...b, staff: form.doctor }));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only when the service or doctor changes
  }, [booking.service, form.doctor]);

  const submit = () => {
    const e = validate(form, booking, matches.length > 0 && !continued);
    if (Object.keys(e).length) {
      setAttempt((n) => n + 1);
      return;
    }
    const id = `local-${Date.now().toString(36)}`;
    const staff = staffById(booking.staff);
    const visit: Appointment | null =
      booking.on && service && staff
        ? {
            id: `${id}-first`,
            patientId: id,
            staffId: staff.id,
            service: service.label,
            discipline: service.discipline,
            start: booking.slot,
            durationMin: service.durationMin,
            room: staff.room ?? "To be assigned",
            status: "booked",
            kind: "consultation",
            formsComplete: false,
          }
        : null;
    const careTeam: Patient["careTeam"] = { doctor: form.doctor };
    if (visit && service && service.role !== "doctor") careTeam[service.role] = visit.staffId;
    const patient: RegistryPatient = {
      id,
      name: form.name.trim().replace(/\s+/g, " "),
      age: ageOn(form.dob) ?? 0,
      sex: form.sex || "Other",
      avatar: null,
      phone: maskPhone(phoneDigits(form.phone)),
      area: localityOf(form.address),
      primaryConcern: clinicalForm ? form.concern.trim() : "",
      conditions: [],
      allergies: null,
      program: null,
      status: "onboarding",
      careTeam,
      lastVisit: null,
      nextAppointment: visit?.start ?? null,
      intakeComplete: false,
      abhaLinked: false,
      balanceDue: 0,
      registeredAt: TODAY.toISOString(),
      branch: form.branch,
      tags: continued ? ["New", "Possible duplicate"] : ["New"],
      local: {
        clinicNo,
        dob: form.dob,
        email: form.email.trim() || null,
        language: form.language,
        abha: abhaDigits(form.abha) || null,
        address: form.address.trim().replace(/\s+/g, " "),
        emergency: { name: form.emergencyName.trim(), phone: maskPhone(phoneDigits(form.emergencyPhone)) },
        consentAt: TODAY.toISOString(),
        consentBy: user.name,
        duplicateOf: continued ? matches.map((m) => m.patient.id) : [],
        registeredBy: user.name,
      },
    };
    onRegistered({ patient, visit: canBook ? visit : null, flaggedDuplicate: continued });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <ModalContent
        size="lg"
        // Mouse/trackpad: start in "Full name". Touch: keep Radix's default so the keyboard doesn't pop up unasked.
        onOpenAutoFocus={(e) => {
          if (window.matchMedia("(pointer: fine)").matches) {
            e.preventDefault();
            nameRef.current?.focus();
          }
        }}
        title="Register patient"
        description="Creates the patient's record with a clinic ID. ABHA is optional and kept separate."
        footer={
          <>
            <p className="mr-auto text-xs text-muted">
              Clinic ID on save <span className="ml-1 font-mono text-ink-2">{clinicNo}</span>
            </p>
            {hasErrors ? (
              <p className="w-full text-xs text-danger sm:order-first sm:w-auto" role="alert">
                Fix the highlighted fields to continue.
              </p>
            ) : null}
            <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button variant="dark" onClick={submit} leading={booking.on && canBook ? <CalendarPlus /> : undefined}>
              {booking.on && canBook ? "Register & book" : "Register patient"}
            </Button>
          </>
        }
      >
        <form
          ref={formRef}
          noValidate
          className="grid grid-cols-1 gap-x-4 gap-y-4 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <SectionLabel>Identity</SectionLabel>
          <Cell k="name" span>
            <Field
              label="Full name"
              error={errors.name}
              hint={matches.some((m) => m.reasons.some((r) => r.endsWith("name"))) ? <DupHint count={matches.length} continued={continued} onReview={revealDuplicates} /> : undefined}
            >
              {(p) => <Input ref={nameRef} value={form.name} onChange={(e) => set("name", e.target.value)} autoComplete="name" placeholder="As on an ID document" {...p} />}
            </Field>
          </Cell>
          <Cell k="dob">
            <Field label="Date of birth" error={errors.dob} hint={age !== null && age >= 0 && age < 18 ? `Age ${age} — record a guardian's consent at the desk.` : age !== null && age >= 0 ? `Age ${age}` : undefined}>
              {(p) => <Input type="date" value={form.dob} min="1900-01-01" max={TODAY_YMD} onChange={(e) => set("dob", e.target.value)} {...p} />}
            </Field>
          </Cell>
          <Cell k="sex">
            <Field label="Sex" error={errors.sex}>
              {({ id }) => (
                <Select
                  id={id}
                  value={form.sex || undefined}
                  onValueChange={(v) => set("sex", v as Sex)}
                  placeholder="Choose"
                  options={[
                    { value: "Female", label: "Female" },
                    { value: "Male", label: "Male" },
                    { value: "Other", label: "Other / prefer to self-describe" },
                  ]}
                  className={cn("w-full", errors.sex && "shadow-[inset_0_0_0_1.5px_var(--color-danger)]")}
                />
              )}
            </Field>
          </Cell>
          <Cell k="phone">
            <Field
              label="Mobile"
              error={errors.phone}
              hint={
                errors.phone ? undefined : matches.some((m) => m.reasons.some((r) => r.startsWith("Same mobile"))) ? (
                  <DupHint count={matches.length} continued={continued} onReview={revealDuplicates} />
                ) : (
                  "Checked against existing records before saving."
                )
              }
            >
              {(p) => (
                <div className="relative">
                  <span className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-sm text-muted" aria-hidden="true">+91</span>
                  <Input inputMode="tel" autoComplete="tel-national" value={form.phone} onChange={(e) => set("phone", e.target.value)} placeholder="98765 43210" className="pl-12 tabular" {...p} />
                </div>
              )}
            </Field>
          </Cell>
          <Cell k="email">
            <Field label="Email" optional error={errors.email}>
              {(p) => <Input type="email" autoComplete="email" value={form.email} onChange={(e) => set("email", e.target.value)} placeholder="name@example.com" {...p} />}
            </Field>
          </Cell>

          <AnimatePresence initial={false}>
            {matches.length ? (
              <motion.div
                key="dupes"
                data-cell="duplicate"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={spring}
                className="overflow-hidden sm:col-span-2"
              >
                <DuplicateCard
                  matches={matches}
                  continued={continued}
                  error={errors.duplicate}
                  onContinue={() => setAckKey(matchKey)}
                  onUndo={() => setAckKey(null)}
                  onOpenLocal={(id) => {
                    onOpenChange(false);
                    onOpenLocal(id);
                  }}
                />
              </motion.div>
            ) : null}
          </AnimatePresence>

          <SectionLabel>Contact</SectionLabel>
          <Cell k="address" span>
            <Field label="Address" error={errors.address} hint={!errors.address ? "House, street and area — the last part is used as the locality." : undefined}>
              {(p) => <Input value={form.address} onChange={(e) => set("address", e.target.value)} autoComplete="street-address" placeholder="e.g. 14, 2nd Cross, Domlur" {...p} />}
            </Field>
          </Cell>
          <Cell k="emergencyName">
            <Field label="Emergency contact" error={errors.emergencyName}>
              {(p) => <Input value={form.emergencyName} onChange={(e) => set("emergencyName", e.target.value)} placeholder="Name and relation, e.g. Riya (sister)" {...p} />}
            </Field>
          </Cell>
          <Cell k="emergencyPhone">
            <Field label="Emergency contact mobile" error={errors.emergencyPhone}>
              {(p) => (
                <div className="relative">
                  <span className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-sm text-muted" aria-hidden="true">+91</span>
                  <Input inputMode="tel" value={form.emergencyPhone} onChange={(e) => set("emergencyPhone", e.target.value)} placeholder="98765 43210" className="pl-12 tabular" {...p} />
                </div>
              )}
            </Field>
          </Cell>
          <Cell k="language">
            <Field label="Preferred language">
              {({ id }) => <Select id={id} value={form.language} onValueChange={(v) => set("language", v)} options={LANGUAGES.map((l) => ({ value: l, label: l }))} className="w-full" />}
            </Field>
          </Cell>
          {has("branches") ? (
            <Cell k="branch">
              <Field label="Home branch">
                {({ id }) => (
                  <Select
                    id={id}
                    value={form.branch}
                    onValueChange={(v) => set("branch", v as BranchId)}
                    options={(["indiranagar", "hsr"] as BranchId[]).map((b) => ({ value: b, label: branchLabel(b) }))}
                    className="w-full"
                  />
                )}
              </Field>
            </Cell>
          ) : (
            <Cell k="abha">
              <AbhaField value={form.abha} error={errors.abha} onChange={(v) => set("abha", v)} />
            </Cell>
          )}
          {has("branches") ? (
            <Cell k="abha" span>
              <AbhaField value={form.abha} error={errors.abha} onChange={(v) => set("abha", v)} />
            </Cell>
          ) : null}

          <SectionLabel>Care</SectionLabel>
          <Cell k="doctor" span={!clinicalForm}>
            <Field label="Primary doctor" error={errors.doctor} hint={!errors.doctor ? "Reviews this patient's reports. The patient appears in their list." : undefined}>
              {({ id }) => (
                <Select
                  id={id}
                  value={form.doctor || undefined}
                  placeholder="Choose a doctor"
                  onValueChange={(v) => set("doctor", v)}
                  options={DOCTORS.map((d) => ({ value: d.id, label: d.id === user.id ? `${d.name} (you)` : d.name, description: d.status === "on-leave" ? d.workingHours : d.title }))}
                  className={cn("w-full", errors.doctor && "shadow-[inset_0_0_0_1.5px_var(--color-danger)]")}
                />
              )}
            </Field>
          </Cell>
          {clinicalForm ? (
            <Cell k="concern">
              <Field label="Reason for visit" optional>
                {(p) => <Input value={form.concern} onChange={(e) => set("concern", e.target.value)} placeholder="e.g. Palpitations on climbing stairs" {...p} />}
              </Field>
            </Cell>
          ) : null}

          {canBook ? (
            <div className="flex items-start justify-between gap-4 rounded-inner bg-canvas p-4 sm:col-span-2">
              <div>
                <label htmlFor="register-book-now" className="text-sm text-ink">Book first appointment now</label>
                <p className="mt-0.5 text-xs text-muted">Checked against the practitioner&apos;s diary and classes.</p>
              </div>
              <Switch id="register-book-now" checked={booking.on} onCheckedChange={(on) => setBooking((b) => ({ ...b, on }))} />
            </div>
          ) : null}

          <AnimatePresence initial={false}>
            {booking.on && canBook ? (
              <motion.div
                key="booking"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={spring}
                className="-mx-1 overflow-hidden px-1 sm:col-span-2"
              >
                <div className="grid grid-cols-1 gap-4 pb-1 sm:grid-cols-3">
                  <Cell k="service">
                    <Field label="Service" error={errors.service}>
                      {({ id }) => (
                        <Select
                          id={id}
                          value={booking.service || undefined}
                          placeholder="Choose"
                          onValueChange={(v) => setBooking((b) => ({ ...b, service: v, staff: "", slot: "" }))}
                          options={services.map((s) => ({ value: s.id, label: s.label, description: `${s.durationMin} min` }))}
                          className={cn("w-full", errors.service && "shadow-[inset_0_0_0_1.5px_var(--color-danger)]")}
                        />
                      )}
                    </Field>
                  </Cell>
                  <Cell k="staff">
                    <Field label="Practitioner" error={errors.staff} hint={!errors.staff && onLeave.length ? onLeave.map((s) => `${s.name} — ${s.workingHours.charAt(0).toLowerCase()}${s.workingHours.slice(1)}`).join(" · ") : undefined}>
                      {({ id }) => (
                        <Select
                          id={id}
                          value={booking.staff || undefined}
                          placeholder={service ? "Choose" : "Pick a service first"}
                          disabled={!service}
                          onValueChange={(v) => setBooking((b) => ({ ...b, staff: v, slot: "" }))}
                          options={available.map((s) => ({ value: s.id, label: s.name, description: `${branchLabel(s.branch)} · ${s.workingHours}` }))}
                          className={cn("w-full", errors.staff && "shadow-[inset_0_0_0_1.5px_var(--color-danger)]")}
                        />
                      )}
                    </Field>
                  </Cell>
                  <Cell k="slot">
                    <Field label="Time" error={errors.slot} hint={!errors.slot && booking.staff && !slots.length ? "No free slots today or tomorrow." : undefined}>
                      {({ id }) => (
                        <Select
                          id={id}
                          value={booking.slot || undefined}
                          placeholder={booking.staff ? (slots.length ? "Choose" : "None free") : "Pick a practitioner"}
                          disabled={!booking.staff || !slots.length}
                          onValueChange={(v) => setBooking((b) => ({ ...b, slot: v }))}
                          options={slots}
                          className={cn("w-full", errors.slot && "shadow-[inset_0_0_0_1.5px_var(--color-danger)]")}
                        />
                      )}
                    </Field>
                  </Cell>
                </div>
                {booking.staff && !slots.length ? (
                  <p className="mt-2 text-xs text-muted">
                    Try another practitioner, or{" "}
                    <Link href="/schedule?new=1" className="text-ink underline decoration-line-strong underline-offset-2 hover:decoration-ink">
                      book from the schedule
                    </Link>
                    .
                  </p>
                ) : null}
                <p className="mt-2 text-xs text-muted">Held in this browser session. Tell the patient the time — SMS confirmations are an add-on.</p>
              </motion.div>
            ) : null}
          </AnimatePresence>

          <Cell k="consent" span>
            <div className={cn("flex items-start gap-3 rounded-inner p-4 shadow-[inset_0_0_0_1px_var(--color-line)]", errors.consent && "shadow-[inset_0_0_0_1.5px_var(--color-danger)]")}>
              <Checkbox
                id="register-consent"
                checked={form.consent}
                onCheckedChange={(v) => set("consent", v === true)}
                aria-invalid={errors.consent ? true : undefined}
                aria-describedby={errors.consent ? "register-consent-error" : undefined}
                className="mt-0.5"
              />
              <div className="min-w-0 flex-1">
                <label htmlFor="register-consent" className="text-sm text-ink">
                  The patient consents to {clinic.shortName || clinic.name} keeping this record for their care
                </label>
                <p className="mt-0.5 text-xs text-muted">DPDP consent. Privacy notice shown and explained; consent can be withdrawn at any time.</p>
                {form.consent ? (
                  <p className="mt-2 flex items-center gap-1.5 text-xs text-ink-2">
                    <ShieldCheck size={14} aria-hidden="true" className="shrink-0 text-success" />
                    Recorded by {user.name} · {formatDate(TODAY.toISOString(), { day: "numeric", month: "short", year: "numeric" })}
                  </p>
                ) : null}
                {errors.consent ? (
                  <p id="register-consent-error" className="mt-1 text-xs text-danger">
                    {errors.consent}
                  </p>
                ) : null}
              </div>
            </div>
          </Cell>
          <button type="submit" className="sr-only">Register patient</button>
        </form>
      </ModalContent>
    </Dialog>
  );
}

function validate(f: Form, b: Booking, unreviewedDuplicates: boolean): Errors {
  const e: Errors = {};
  if (f.name.trim().length < 2) e.name = "Enter the patient's full name.";
  else if (!/\p{L}{2}/u.test(f.name)) e.name = "Use letters for the name.";
  const age = ageOn(f.dob);
  if (!f.dob) e.dob = "Enter a date of birth.";
  else if (age === null || f.dob > TODAY_YMD) e.dob = "Date of birth can't be in the future.";
  else if (age > 120) e.dob = "Check the year — that's over 120 years.";
  if (!f.sex) e.sex = "Choose an option.";
  const d = phoneDigits(f.phone);
  if (!d) e.phone = "Enter a mobile number.";
  else if (!isIndianMobile(d)) e.phone = "Enter a 10-digit Indian mobile number starting with 6–9.";
  if (f.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email.trim())) e.email = "Check the email address.";
  if (unreviewedDuplicates) e.duplicate = "Open the existing record, or register as a new patient for the admin to review.";
  if (f.address.trim().length < 4) e.address = "Enter the address.";
  if (f.emergencyName.trim().length < 2) e.emergencyName = "Enter an emergency contact.";
  const ed = phoneDigits(f.emergencyPhone);
  if (!ed) e.emergencyPhone = "Enter their mobile number.";
  else if (!isIndianMobile(ed)) e.emergencyPhone = "Enter a 10-digit Indian mobile number.";
  if (f.abha.trim() && abhaDigits(f.abha).length !== 14) e.abha = "ABHA numbers have 14 digits — or leave it blank.";
  if (!f.doctor) e.doctor = "Choose the patient's primary doctor.";
  if (b.on) {
    if (!b.service) e.service = "Choose a service.";
    if (!b.staff) e.staff = "Choose a practitioner.";
    if (!b.slot) e.slot = "Choose a time.";
  }
  if (!f.consent) e.consent = "Consent is needed to create a record.";
  return e;
}

/** Inline notice under the field that triggered a match (the card itself can be off-screen on phones). */
function DupHint({ count, continued, onReview }: { count: number; continued: boolean; onReview: () => void }) {
  return (
    <span className={continued ? "text-muted" : "text-warning"}>
      {continued ? "Flagged for the admin to review." : `${count} possible existing ${count === 1 ? "record" : "records"}.`}{" "}
      <button type="button" onClick={onReview} className="underline decoration-current/40 underline-offset-2 hover:decoration-current">
        Review
      </button>
    </span>
  );
}

function AbhaField({ value, error, onChange }: { value: string; error?: string; onChange: (v: string) => void }) {
  const digits = abhaDigits(value);
  return (
    <Field
      label="ABHA number"
      optional
      error={error}
      hint={!error ? (digits.length === 14 ? `${formatAbha(digits)} · stored, not verified` : "Only if the patient gives it. Kept separate from the clinic ID.") : undefined}
    >
      {(p) => <Input inputMode="numeric" value={value} onChange={(e) => onChange(e.target.value)} placeholder="14 digits" className="tabular" {...p} />}
    </Field>
  );
}

function SectionLabel({ children }: { children: ReactNode }) {
  return <p className="-mb-1 text-xs text-muted sm:col-span-2">{children}</p>;
}

/** Grid cell that marks its field for "focus the first error". */
function Cell({ k, span, children }: { k: ErrorKey; span?: boolean; children: ReactNode }) {
  return (
    <div data-cell={k} className={cn("min-w-0", span && "sm:col-span-2")}>
      {children}
    </div>
  );
}

function DuplicateCard({
  matches,
  continued,
  error,
  onContinue,
  onUndo,
  onOpenLocal,
}: {
  matches: DuplicateMatch[];
  continued: boolean;
  error?: string;
  onContinue: () => void;
  onUndo: () => void;
  onOpenLocal: (id: string) => void;
}) {
  return (
    <div className={cn("rounded-inner p-2 transition-colors duration-300", continued ? "bg-sunken" : "bg-warning-soft")} role="status" aria-live="polite">
      <div className="flex items-start gap-3 px-2 pb-3 pt-2">
        <span className={cn("mt-0.5 shrink-0", continued ? "text-muted" : "text-warning")}>{continued ? <Users size={18} aria-hidden="true" /> : <Warning size={18} aria-hidden="true" />}</span>
        <div className="min-w-0">
          <p className="text-sm text-ink">
            {continued ? "Will be registered and flagged for the admin to review" : matches.length > 1 ? `${matches.length} possible existing records` : "Possible existing record"}
          </p>
          <p className="mt-0.5 text-xs text-ink-2">
            {continued
              ? "The admin compares the records and decides whether to merge. Nothing is merged automatically."
              : "Check before creating a new record. Only the admin merges records — a shared phone number is common in families."}
          </p>
        </div>
      </div>
      <ul className="flex flex-col gap-1">
        {matches.map((m) => (
          <li key={m.patient.id} className="flex flex-col gap-3 rounded-[8px] bg-surface p-3 sm:flex-row sm:items-center">
            <div className="flex min-w-0 flex-1 items-start gap-3">
              <Avatar src={m.patient.avatar} name={m.patient.name} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-ink">{m.patient.name}</p>
                <p className="truncate text-xs text-muted">
                  <span className="font-mono">{clinicNoOf(m.patient)}</span> · {m.patient.age} y · {m.patient.sex} · {m.patient.area}
                </p>
                <p className="mt-1 flex flex-wrap gap-1">
                  {m.reasons.map((r) => (
                    <span key={r} className="inline-flex h-6 items-center whitespace-nowrap rounded-full bg-sunken px-2 text-xs text-ink-2">
                      {r}
                    </span>
                  ))}
                </p>
              </div>
            </div>
            {m.patient.local ? (
              <Button size="sm" variant="secondary" onClick={() => onOpenLocal(m.patient.id)} trailing={<ArrowUpRight />} className="self-start sm:self-auto">
                Open existing record
              </Button>
            ) : (
              <Button asChild size="sm" variant="secondary" className="self-start sm:self-auto">
                <Link href={`/patients/${m.patient.id}`}>
                  Open existing record
                  <ArrowUpRight aria-hidden="true" />
                </Link>
              </Button>
            )}
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap items-center justify-between gap-2 px-2 pb-1 pt-3">
        {error ? <p className="text-xs text-danger">{error}</p> : <span />}
        {continued ? (
          <Button size="sm" variant="ghost" onClick={onUndo}>
            Undo
          </Button>
        ) : (
          <Button size="sm" variant="secondary" onClick={onContinue} className="h-auto min-h-8 w-full whitespace-normal py-1.5 text-center sm:w-auto">
            Not the same person — register as new
          </Button>
        )}
      </div>
    </div>
  );
}

/** Toast copy for a registration — says exactly what happened (nothing left this browser). */
export function registrationToast(r: Registration) {
  const visit = r.visit;
  const staff = visit ? staffById(visit.staffId) : undefined;
  const doctor = staffById(r.patient.careTeam.doctor);
  const parts = [`Clinic ID ${clinicNoOf(r.patient)}.`];
  if (doctor) parts.push(`Added to ${doctor.name}'s patients.`);
  if (visit) {
    const day = dayWord(visit.start);
    const when = day === "Today" || day === "Tomorrow" ? day.toLowerCase() : `on ${day}`;
    parts.push(`First visit held ${when} at ${formatTime(visit.start)}${staff ? ` with ${staff.name}` : ""}.`);
  }
  parts.push(`Consent recorded by ${r.patient.local?.consentBy ?? "you"}.`);
  if (r.flaggedDuplicate) parts.push("Flagged for the admin to review as a possible duplicate.");
  return { title: `${r.patient.name} registered`, description: parts.join(" "), tone: r.flaggedDuplicate ? ("warning" as const) : ("success" as const) };
}

"use client";

import { useMemo, useRef, useState } from "react";
import { ArrowRight, CalendarCheck, CheckCircle, Clock, Coffee, UserCircleMinus, WarningCircle } from "@phosphor-icons/react";
import { DISCIPLINE_LABEL } from "@/data/appointments";
import { staffById } from "@/data/staff";
import { cn } from "@/lib/cn";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Dialog, ModalContent } from "@/components/ui/dialog";
import { Field, Input, Select, Switch, Textarea } from "@/components/ui/input";
import { Segmented } from "@/components/ui/segmented";
import { useToast } from "@/components/ui/toast";
import { usePlan, useRole } from "@/components/shell/role-context";
import { DAY_END, DAY_START, DURATIONS, NOW_MIN, PRACTITIONERS, ROOMS, SERVICES, TODAY_KEY, serviceById, servicesFor } from "./data";
import {
  addDays,
  durationLabel,
  findConflicts,
  hhmm,
  hoursOn,
  hoursLabel,
  isoAt,
  nextFreeSlot,
  outsideHours,
  patientOverlaps,
  rangeLabel,
  shortDay,
  slotProblems,
  touchesLunch,
  type Booking,
  type Conflict,
} from "./engine";
import { PatientPicker } from "./patient-picker";
import { useSchedule } from "./store";
import { DisciplineDot } from "./ui";

export type BookingPrefill = { patientId?: string; staffId?: string; date?: string; start?: number; serviceId?: string };

/**
 * New appointment (also reached via /schedule?new=1). One reservation check covers the
 * practitioner AND the room, across appointments and classes, for every weekly occurrence.
 */
export function NewAppointmentModal({
  open,
  session,
  prefill,
  onOpenChange,
  onBooked,
}: {
  open: boolean;
  session: number;
  prefill: BookingPrefill;
  onOpenChange: (open: boolean) => void;
  onBooked: (created: Booking[]) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <BookingForm key={session} prefill={prefill} onCancel={() => onOpenChange(false)} onBooked={onBooked} />
    </Dialog>
  );
}

const START_OPTIONS = Array.from({ length: (DAY_END - DAY_START) / 15 }, (_, i) => DAY_START + i * 15).map((m) => ({ value: String(m), label: hhmm(m) }));

function BookingForm({ prefill, onCancel, onBooked }: { prefill: BookingPrefill; onCancel: () => void; onBooked: (created: Booking[]) => void }) {
  const { user } = useRole();
  const { has } = usePlan();
  const { occupants, events, person, addBookings } = useSchedule();
  const { toast } = useToast();
  const multi = has("multi-role");
  const allowedStaff = multi ? PRACTITIONERS : PRACTITIONERS.filter((p) => p.id === user.id);
  const self = PRACTITIONERS.find((p) => p.id === user.id)?.id;

  const [init] = useState(() => {
    const staffId = prefill.staffId && allowedStaff.some((s) => s.id === prefill.staffId) ? prefill.staffId : self ?? allowedStaff[0]?.id ?? "s-ananya";
    const svc = (prefill.serviceId && serviceById(prefill.serviceId)?.staffIds.includes(staffId) ? serviceById(prefill.serviceId) : undefined) ?? servicesFor(staffId)[0] ?? SERVICES[0];
    const room = staffById(staffId)?.room ?? "Consult 1";
    const date = prefill.date && prefill.date >= TODAY_KEY ? prefill.date : TODAY_KEY;
    let start = prefill.start;
    if (start === undefined) {
      const from = date === TODAY_KEY ? Math.ceil(NOW_MIN / 15) * 15 : 9 * 60;
      start = nextFreeSlot({ staffId, room, date, start: from, duration: svc.durationMin }, occupants, { maxDays: 0 })?.start ?? from;
    }
    return { staffId, serviceId: svc.id, room, date, start, duration: svc.durationMin };
  });

  const [patientId, setPatientId] = useState<string | null>(prefill.patientId ?? null);
  const [serviceId, setServiceId] = useState(init.serviceId);
  const [staffId, setStaffId] = useState(init.staffId);
  const [room, setRoom] = useState(init.room);
  const [date, setDate] = useState(init.date);
  const [start, setStart] = useState(init.start);
  const [duration, setDuration] = useState(init.duration);
  const [repeat, setRepeat] = useState<"none" | "weekly">("none");
  const [count, setCount] = useState(4);
  const [notes, setNotes] = useState("");
  const [reminder, setReminder] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const patientRef = useRef<HTMLDivElement>(null);

  const service = serviceById(serviceId) ?? SERVICES[0];
  const staff = staffById(staffId);
  const eligible = allowedStaff.filter((s) => service.staffIds.includes(s.id));

  const changeService = (id: string) => {
    const svc = serviceById(id);
    if (!svc) return;
    setServiceId(id);
    setDuration(svc.durationMin);
    if (!svc.staffIds.includes(staffId)) {
      const next = allowedStaff.find((s) => svc.staffIds.includes(s.id));
      if (next) {
        if (room === staffById(staffId)?.room) setRoom(next.room ?? room);
        setStaffId(next.id);
      }
    }
  };

  const changeStaff = (id: string) => {
    if (room === staffById(staffId)?.room) setRoom(staffById(id)?.room ?? room);
    setStaffId(id);
  };

  const occurrences = repeat === "weekly" ? count : 1;
  const dates = useMemo(() => Array.from({ length: occurrences }, (_, k) => addDays(date, 7 * k)), [date, occurrences]);

  const checks = useMemo(
    () =>
      dates.map((d) => {
        const req = { staffId, room, date: d, start, duration };
        return { date: d, problems: slotProblems(req), conflicts: findConflicts(req, occupants) };
      }),
    [dates, staffId, room, start, duration, occupants],
  );
  const problems = [...new Set(checks.flatMap((c) => c.problems))];
  const clashes = checks.flatMap((c) => c.conflicts.map((cf) => ({ ...cf, date: c.date })));
  const blocking = problems.length > 0 || clashes.length > 0;
  const suggestion = useMemo(
    () => (blocking ? nextFreeSlot({ staffId, room, date: date < TODAY_KEY ? TODAY_KEY : date, start, duration }, occupants, { occurrences }) : null),
    [blocking, staffId, room, date, start, duration, occupants, occurrences],
  );
  const lunch = touchesLunch(start, duration);
  // Soft check: the patient's own bookings and classes at the same time (shown, not blocking).
  const patientBusy = useMemo(
    () => (patientId ? dates.flatMap((d) => patientOverlaps(patientId, { date: d, start, duration }, events).map((e) => ({ e, date: d }))) : []),
    [patientId, dates, start, duration, events],
  );
  const offHours = outsideHours({ staffId, date, start, duration });
  const dayLoad = occupants.filter((o) => o.staffId === staffId && o.date === date).length;
  const staffHours = hoursOn(staffId, date);
  const patientMissing = submitted && !patientId;

  const describe = (c: Conflict & { date: string }) => {
    const o = c.occupant;
    const who = o.patientId ? person(o.patientId)?.name ?? "a patient" : "group class";
    const when = `${repeat === "weekly" ? `${shortDay(c.date)} · ` : ""}${rangeLabel(o.start, o.end)}`;
    const otherStaff = staffById(o.staffId)?.name ?? "another practitioner";
    if (c.on.length === 2) return `${staff?.name} and ${room} are booked ${when} — ${who}, ${o.title}.`;
    if (c.on[0] === "practitioner") return `${staff?.name} is booked ${when} in ${o.room} — ${who}, ${o.title}.`;
    return `${room} is in use ${when} by ${otherStaff} — ${o.kind === "class" ? o.title : `${who}, ${o.title}`}.`;
  };

  const save = () => {
    setSubmitted(true);
    if (!patientId) {
      patientRef.current?.querySelector<HTMLElement>("input,button")?.focus();
      return;
    }
    if (blocking) {
      panelRef.current?.focus();
      return;
    }
    const p = person(patientId);
    const seriesId = occurrences > 1 ? `series-${patientId}-${date}-${start}` : undefined;
    const created = addBookings(
      dates.map((d) => ({
        patientId,
        staffId,
        service: service.label,
        discipline: service.discipline,
        start: isoAt(d, start),
        durationMin: duration,
        room,
        status: "booked",
        kind: service.kind,
        formsComplete: p ? (p.local ? false : p.intakeComplete) : false,
        notes: notes.trim() || undefined,
        seriesId,
        reminder,
      })),
    );
    toast({
      title: occurrences > 1 ? `${occurrences} weekly appointments booked` : `Booked · ${shortDay(date)}, ${hhmm(start)}`,
      description: `${p?.name ?? "Patient"} with ${staff?.name}. Saved in this browser session only. ${reminder ? "No reminder was sent — reminders aren't connected in this prototype." : ""}`.trim(),
      tone: "success",
    });
    onBooked(created);
  };

  return (
    <ModalContent
      size="lg"
      title="New appointment"
      description="Checks the practitioner and the room against appointments and classes before booking."
      footer={
        <>
          <p className="mr-auto hidden min-w-0 truncate text-xs text-muted sm:block">
            {shortDay(date)} · {rangeLabel(start, start + duration)} · {room}
            {occurrences > 1 ? ` · weekly × ${occurrences}` : ""}
          </p>
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
          <Button variant="primary" onClick={save} leading={<CalendarCheck />}>
            {occurrences > 1 ? `Book ${occurrences} appointments` : "Book appointment"}
          </Button>
        </>
      }
    >
      <form
        className="grid grid-cols-1 gap-4 sm:grid-cols-6"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <div ref={patientRef} className="sm:col-span-6">
          <Field label="Patient" error={patientMissing ? "Choose a patient or register a new one." : undefined}>
            {({ id, ...aria }) => <PatientPicker value={patientId} onChange={setPatientId} id={id} invalid={aria["aria-invalid"]} describedBy={aria["aria-describedby"]} />}
          </Field>
        </div>

        <Field label="Service" className="sm:col-span-3" hint={`${DISCIPLINE_LABEL[service.discipline]} · usually ${durationLabel(service.durationMin)}`}>
          {(p) => (
            <Select
              {...p}
              ariaLabel="Service"
              value={serviceId}
              onValueChange={changeService}
              options={SERVICES.filter((s) => allowedStaff.some((p) => s.staffIds.includes(p.id))).map((s) => ({
                value: s.id,
                label: (
                  <span className="inline-flex items-center gap-2">
                    <DisciplineDot discipline={s.discipline} />
                    {s.label}
                  </span>
                ),
                description: `${DISCIPLINE_LABEL[s.discipline]} · ${s.durationMin} min`,
              }))}
            />
          )}
        </Field>

        <Field
          label="Practitioner"
          className="sm:col-span-3"
          hint={`${multi ? `${pluralBookings(dayLoad)} on ${shortDay(date)}` : "Other practitioners' diaries are part of the Team plan."}${staffHours ? ` · works ${hoursLabel(staffHours)}` : ""}`}
        >
          {(p) => (
            <Select
              {...p}
              ariaLabel="Practitioner"
              value={staffId}
              onValueChange={changeStaff}
              options={eligible.map((s) => ({
                value: s.id,
                label: (
                  <span className="inline-flex items-center gap-2">
                    <Avatar src={s.avatar} name={s.name} size="xs" />
                    {s.name}
                  </span>
                ),
                description: s.title,
              }))}
            />
          )}
        </Field>

        <Field label="Date" className="sm:col-span-2">
          {(p) => <Input type="date" min={TODAY_KEY} value={date} onChange={(e) => e.target.value && setDate(e.target.value)} {...p} />}
        </Field>
        <Field label="Start time" className="sm:col-span-2">
          {({ id }) => <Select id={id} ariaLabel="Start time" value={String(start)} onValueChange={(v) => setStart(Number(v))} options={START_OPTIONS} />}
        </Field>
        <Field label="Duration" className="sm:col-span-2">
          {({ id }) => (
            <Select
              id={id}
              ariaLabel="Duration"
              value={String(duration)}
              onValueChange={(v) => setDuration(Number(v))}
              options={DURATIONS.map((d) => ({ value: String(d), label: durationLabel(d) }))}
            />
          )}
        </Field>

        <Field label="Room" className="sm:col-span-3">
          {({ id }) => (
            <Select
              id={id}
              ariaLabel="Room"
              value={room}
              onValueChange={setRoom}
              options={ROOMS.map((r) => ({ value: r.room, label: r.room, description: r.branchName }))}
            />
          )}
        </Field>

        <div className="flex flex-col gap-2 sm:col-span-3">
          <span className="text-sm text-ink" id="repeat-label">
            Repeat
          </span>
          <div className="flex flex-wrap items-center gap-2">
            <Segmented
              ariaLabel="Repeat"
              variant="tray"
              size="sm"
              value={repeat}
              onChange={setRepeat}
              items={[
                { value: "none", label: "Doesn't repeat" },
                { value: "weekly", label: "Weekly" },
              ]}
            />
            {repeat === "weekly" ? (
              <Select
                size="sm"
                ariaLabel="Number of weeks"
                value={String(count)}
                onValueChange={(v) => setCount(Number(v))}
                options={Array.from({ length: 11 }, (_, i) => i + 2).map((n) => ({ value: String(n), label: `× ${n} weeks` }))}
                className="w-auto"
              />
            ) : null}
          </div>
        </div>

        <div className="sm:col-span-6">
          {blocking ? (
            <div ref={panelRef} tabIndex={-1} role="alert" className="rounded-inner bg-danger-soft p-4 outline-none focus-visible:outline-2 focus-visible:outline-danger">
              <p className="flex items-center gap-2 text-sm font-medium text-danger">
                <WarningCircle size={18} weight="fill" aria-hidden="true" />
                {clashes.length ? `This time clashes with ${clashes.length === 1 ? "another booking" : `${clashes.length} bookings`}` : "This time can't be booked"}
              </p>
              <ul className="mt-2 flex flex-col gap-1 pl-7 text-sm text-ink-2">
                {problems.map((p) => (
                  <li key={p} className="list-disc">
                    {p}
                  </li>
                ))}
                {clashes.map((c) => (
                  <li key={`${c.date}-${c.occupant.id}`} className="list-disc">
                    {describe(c)}
                  </li>
                ))}
              </ul>
              <div className="mt-4 flex flex-wrap items-center gap-2 pl-7">
                {suggestion ? (
                  <Button
                    size="sm"
                    variant="dark"
                    trailing={<ArrowRight />}
                    onClick={() => {
                      setDate(suggestion.date);
                      setStart(suggestion.start);
                    }}
                  >
                    Next free slot · {suggestion.date === date ? "" : `${shortDay(suggestion.date)}, `}
                    {hhmm(suggestion.start)}
                  </Button>
                ) : (
                  <p className="text-xs text-muted">No free slot for this practitioner and room in the next two weeks.</p>
                )}
                <p className="text-xs text-muted">Checks {staff?.name} and {room} together{occurrences > 1 ? `, for all ${occurrences} weeks` : ""}.</p>
              </div>
            </div>
          ) : (
            <div ref={panelRef} tabIndex={-1} role="status" className="flex items-center gap-2 rounded-inner bg-success-soft px-4 py-3 text-sm text-success outline-none">
              <CheckCircle size={18} weight="fill" aria-hidden="true" />
              <span>
                {staff?.name} and {room} are free {shortDay(date)}, {rangeLabel(start, start + duration)}
                {occurrences > 1 ? ` — and on all ${occurrences} weekly dates` : ""}.
              </span>
            </div>
          )}
          {patientBusy.length ? (
            <ul className="mt-2 flex flex-col gap-1 text-xs text-ink-2" aria-label="Patient already booked">
              {patientBusy.slice(0, 3).map(({ e, date: d }) => (
                <li key={`${e.id}-${d}`} className="flex items-start gap-2">
                  <UserCircleMinus size={14} className="mt-px shrink-0 text-warning" aria-hidden="true" />
                  <span>
                    {person(patientId ?? "")?.name ?? "This patient"} {e.cls ? "is enrolled in" : "already has"} {e.cls ? e.cls.title : e.booking?.service ?? "a booking"}
                    {" "}with {staffById(e.staffId)?.name ?? "another practitioner"}, {repeat === "weekly" ? `${shortDay(d)} ` : ""}
                    {rangeLabel(e.start, e.end)} — allowed for joint care, but the times overlap.
                  </span>
                </li>
              ))}
              {patientBusy.length > 3 ? <li className="pl-6 text-muted">+{patientBusy.length - 3} more overlaps</li> : null}
            </ul>
          ) : null}
          {lunch ? (
            <p className="mt-2 flex items-center gap-2 text-xs text-muted">
              <Coffee size={14} aria-hidden="true" />
              Overlaps the 13:00–14:00 lunch break — allowed, but check with the practitioner.
            </p>
          ) : null}
          {offHours ? (
            <p className="mt-2 flex items-center gap-2 text-xs text-muted">
              <Clock size={14} aria-hidden="true" />
              Outside {staff?.name}&apos;s working hours ({hoursLabel(offHours)}, from their staff profile) — allowed, but check with them.
            </p>
          ) : null}
          {occurrences > 1 ? (
            <ul className="mt-2 flex flex-wrap gap-1" aria-label="Occurrences">
              {checks.map((c) => (
                <li
                  key={c.date}
                  className={cn(
                    "inline-flex h-6 items-center rounded-full px-2.5 text-xs",
                    c.conflicts.length || c.problems.length ? "bg-danger-soft text-danger" : "bg-sunken text-ink-2",
                  )}
                >
                  {shortDay(c.date)}
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        <Field label="Notes for the team" optional className="sm:col-span-6">
          {(p) => <Textarea rows={2} className="min-h-20" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. Bring last ECG report; prefers Hindi" {...p} />}
        </Field>

        <div className="flex items-start gap-3 rounded-inner bg-sunken p-4 sm:col-span-6">
          <Switch id="reminder-switch" checked={reminder} onCheckedChange={setReminder} aria-describedby="reminder-note" />
          <div className="min-w-0">
            <label htmlFor="reminder-switch" className="text-sm text-ink">
              Send reminder
            </label>
            <p id="reminder-note" className="text-xs text-muted">
              Reminders aren&apos;t connected in this prototype — nothing will be sent. The preference is saved with the booking.
            </p>
          </div>
        </div>
        <button type="submit" className="sr-only">
          Book appointment
        </button>
      </form>
    </ModalContent>
  );
}

const pluralBookings = (n: number) => (n === 0 ? "No bookings" : n === 1 ? "1 booking" : `${n} bookings`);

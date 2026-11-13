"use client";

import { useMemo, useState } from "react";
import { CalendarX, ClockCountdown, LockSimple } from "@phosphor-icons/react";
import { staffById } from "@/data/staff";
import { cn } from "@/lib/cn";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Dialog, ModalContent } from "@/components/ui/dialog";
import { Checkbox, Field, Select, Textarea } from "@/components/ui/input";
import { usePlan, useRole } from "@/components/shell/role-context";
import { CANCEL_REASONS, PRACTITIONERS, ROOMS, TODAY_KEY, serviceForLabel } from "./data";
import { addDays, dateOf, durationLabel, freeSlots, hhmm, isSunday, isoAt, minOf, onLeave, rangeLabel, shortDay, type Booking } from "./engine";
import { displayName, useSchedule } from "./store";

/** Reschedule: pick a day, then one of the slots where both the practitioner and the room are free. */
export function RescheduleModal({ bookingId, onClose, onDone }: { bookingId: string | null; onClose: () => void; onDone: (next: Booking, prev: Booking) => void }) {
  const { bookings } = useSchedule();
  const booking = bookingId ? bookings.find((b) => b.id === bookingId) : undefined;
  return (
    <Dialog open={!!booking} onOpenChange={(o) => !o && onClose()}>
      {booking ? <RescheduleForm key={booking.id} booking={booking} onClose={onClose} onDone={onDone} /> : null}
    </Dialog>
  );
}

function RescheduleForm({ booking, onClose, onDone }: { booking: Booking; onClose: () => void; onDone: (next: Booking, prev: Booking) => void }) {
  const { occupants, person, patchBooking, privacy } = useSchedule();
  const { has } = usePlan();
  const { user } = useRole();
  const svc = serviceForLabel(booking.service);
  const pool = has("multi-role") ? PRACTITIONERS : PRACTITIONERS.filter((p) => p.id === user.id || p.id === booking.staffId);
  const eligible = pool.filter((p) => (svc ? svc.staffIds.includes(p.id) : p.discipline === booking.discipline) || p.id === booking.staffId);
  const [staffId, setStaffId] = useState(booking.staffId);
  const [room, setRoom] = useState(booking.room);
  const startDay = dateOf(booking.start) > TODAY_KEY ? dateOf(booking.start) : TODAY_KEY;
  const [date, setDate] = useState(startDay);
  const [slot, setSlot] = useState<number | null>(null);
  const duration = booking.durationMin;

  const days = useMemo(() => {
    const out: string[] = [];
    for (let i = 0; out.length < 8 && i < 14; i++) {
      const d = addDays(TODAY_KEY, i);
      if (!isSunday(d)) out.push(d);
    }
    return out;
  }, []);

  const slotsFor = (d: string) => freeSlots({ staffId, room, date: d, duration, excludeIds: [booking.id] }, occupants, 30);
  const slots = slotsFor(date);
  const who = person(booking.patientId);
  const oldStart = minOf(booking.start);

  const confirm = () => {
    if (slot === null) return;
    const prev = patchBooking(booking.id, { start: isoAt(date, slot), staffId, room });
    if (prev) onDone({ ...booking, start: isoAt(date, slot), staffId, room }, prev);
  };

  return (
    <ModalContent
      size="md"
      title="Reschedule appointment"
      description={`${displayName(who?.name ?? "Patient", privacy)}${privacy ? "" : ` · ${booking.service}`}`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Keep current time
          </Button>
          <Button variant="dark" disabled={slot === null} onClick={confirm} leading={<ClockCountdown />}>
            {slot === null ? "Pick a new slot" : `Move to ${shortDay(date)}, ${hhmm(slot)}`}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-6">
        <p className="rounded-inner bg-sunken px-4 py-3 text-sm text-ink-2">
          Currently {shortDay(dateOf(booking.start))} · <span className="font-mono text-[13px]">{rangeLabel(oldStart, oldStart + duration)}</span> with {staffById(booking.staffId)?.name} in {booking.room}
        </p>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Practitioner">
            {({ id }) => (
              <Select
                id={id}
                ariaLabel="Practitioner"
                value={staffId}
                onValueChange={(v) => {
                  if (room === staffById(staffId)?.room) setRoom(staffById(v)?.room ?? room);
                  setStaffId(v);
                  setSlot(null);
                }}
                options={eligible.map((s) => ({
                  value: s.id,
                  label: (
                    <span className="inline-flex items-center gap-2">
                      <Avatar src={s.avatar} name={s.name} size="xs" />
                      {s.name}
                    </span>
                  ),
                }))}
              />
            )}
          </Field>
          <Field label="Room">
            {({ id }) => (
              <Select
                id={id}
                ariaLabel="Room"
                value={room}
                onValueChange={(v) => {
                  setRoom(v);
                  setSlot(null);
                }}
                options={ROOMS.map((r) => ({ value: r.room, label: r.room, description: r.branchName }))}
              />
            )}
          </Field>
        </div>

        <div>
          <p className="text-sm text-ink">Day</p>
          <div role="radiogroup" aria-label="Day" className="scrollbar-none -mx-1 mt-2 flex gap-1 overflow-x-auto px-1 pb-1" data-lenis-prevent>
            {days.map((d) => {
              const n = slotsFor(d).length;
              const active = d === date;
              return (
                <button
                  key={d}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => {
                    setDate(d);
                    setSlot(null);
                  }}
                  className={cn(
                    "flex shrink-0 flex-col items-start rounded-inner px-3 py-2 text-left transition-colors",
                    active ? "bg-charcoal text-white" : "bg-sunken text-ink hover:bg-sunken-2",
                  )}
                >
                  <span className="text-sm">{shortDay(d).replace(/ \w+$/, "")}</span>
                  <span className={cn("text-xs", active ? "text-white/75" : "text-muted")}>{onLeave(staffId, d) ? "On leave" : `${n} free`}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <p className="text-sm text-ink">
            Free slots · {durationLabel(duration)} <span className="text-muted">— practitioner and room both free</span>
          </p>
          {slots.length ? (
            <div role="radiogroup" aria-label="Free slots" className="mt-2 grid grid-cols-4 gap-1 sm:grid-cols-6">
              {slots.map((m) => (
                <button
                  key={m}
                  type="button"
                  role="radio"
                  aria-checked={slot === m}
                  onClick={() => setSlot(m)}
                  className={cn(
                    "h-10 rounded-full font-mono text-[13px] transition-colors",
                    slot === m ? "bg-charcoal text-white" : "bg-surface text-ink shadow-[inset_0_0_0_1px_var(--color-line)] hover:shadow-[inset_0_0_0_1px_var(--color-line-strong)]",
                  )}
                >
                  {hhmm(m)}
                </button>
              ))}
            </div>
          ) : (
            <p className="mt-2 rounded-inner bg-sunken px-4 py-3 text-sm text-muted">
              {onLeave(staffId, date) ? `${staffById(staffId)?.name} is on leave that day.` : "No free slot that day for this practitioner and room — try another day or room."}
            </p>
          )}
        </div>
        <p className="text-xs text-muted">The patient isn&apos;t notified — messaging isn&apos;t connected in this prototype.</p>
      </div>
    </ModalContent>
  );
}

/** Cancel with a reason (required), an optional note and — on Team plans — a nudge to offer the slot. */
export function CancelModal({ bookingId, onClose, onDone }: { bookingId: string | null; onClose: () => void; onDone: (prev: Booking, offer: boolean) => void }) {
  const { bookings } = useSchedule();
  const booking = bookingId ? bookings.find((b) => b.id === bookingId) : undefined;
  return (
    <Dialog open={!!booking} onOpenChange={(o) => !o && onClose()}>
      {booking ? <CancelForm key={booking.id} booking={booking} onClose={onClose} onDone={onDone} /> : null}
    </Dialog>
  );
}

function CancelForm({ booking, onClose, onDone }: { booking: Booking; onClose: () => void; onDone: (prev: Booking, offer: boolean) => void }) {
  const { person, patchBooking, waitlist, privacy } = useSchedule();
  const { has } = usePlan();
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [offer, setOffer] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const who = person(booking.patientId);
  const start = minOf(booking.start);
  const matches = waitlist.filter((w) => w.status === "waiting" && (w.staffIds.includes(booking.staffId) || w.discipline === booking.discipline)).length;

  const confirm = () => {
    if (!reason) {
      setError("Choose a reason — it's kept with the appointment history.");
      return;
    }
    const prev = patchBooking(booking.id, { status: "cancelled", cancelReason: reason, cancelNote: note.trim() || undefined });
    if (prev) onDone(prev, has("waitlist") && offer && matches > 0);
  };

  return (
    <ModalContent
      size="sm"
      title="Cancel appointment"
      description={`${displayName(who?.name ?? "Patient", privacy)} · ${shortDay(dateOf(booking.start))}, ${rangeLabel(start, start + booking.durationMin)}`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Keep appointment
          </Button>
          <Button variant="danger" onClick={confirm} leading={<CalendarX />}>
            Cancel appointment
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Field label="Reason" error={error}>
          {(p) => (
            <Select
              {...p}
              ariaLabel="Cancellation reason"
              value={reason}
              placeholder="Choose a reason"
              onValueChange={(v) => {
                setReason(v);
                setError(null);
              }}
              options={CANCEL_REASONS.map((r) => ({ value: r, label: r }))}
            />
          )}
        </Field>
        <Field label="Note" optional>
          {(p) => <Textarea rows={2} className="min-h-20" value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Called at 09:35, will rebook next week" {...p} />}
        </Field>
        {has("waitlist") ? (
          <label className="flex items-start gap-3 rounded-inner bg-sunken p-4 text-sm">
            <Checkbox checked={offer} onCheckedChange={(v) => setOffer(v === true)} disabled={matches === 0} className="mt-0.5" />
            <span>
              <span className="block text-ink">Offer the freed slot to the waitlist</span>
              <span className="block text-xs text-muted">
                {matches > 0 ? `${matches} waiting ${matches === 1 ? "patient matches" : "patients match"} this practitioner or discipline.` : "Nobody on the waitlist matches this practitioner or discipline."}
              </span>
            </span>
          </label>
        ) : (
          <p className="flex items-center gap-2 rounded-inner bg-sunken p-4 text-xs text-muted">
            <LockSimple size={14} aria-hidden="true" />
            Offering freed slots to a waitlist is part of the Team plan.
          </p>
        )}
        <p className="text-xs text-muted">No cancellation message is sent — messaging isn&apos;t connected in this prototype.</p>
      </div>
    </ModalContent>
  );
}

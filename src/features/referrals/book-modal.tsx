"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarCheck, Clock, MapPin } from "@phosphor-icons/react";
import { WEEK_APPOINTMENTS, DISCIPLINE_LABEL } from "@/data/appointments";
import { staffById } from "@/data/staff";
import { patientById } from "@/data/patients";
import { TODAY, formatDate } from "@/lib/format";
import { cn } from "@/lib/cn";
import { Dialog, ModalContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Segmented } from "@/components/ui/segmented";
import { Avatar } from "@/components/ui/avatar";
import { TODAY_KEY, clinicDays, dayKey, isoAt, timeSlots } from "@/features/tasks/time";
import type { CareReferral } from "./store";

const toMin = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));
const toHHMM = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

function workingWindow(hours: string): [string, string] | null {
  const m = hours.match(/(\d{2}:\d{2})\s*[–-]\s*(\d{2}:\d{2})/);
  return m ? [m[1], m[2]] : null;
}

/** Mini scheduler for "Book": the receiver's working hours minus what's already in the diary. */
export function BookModal({ referral, onClose, onBook }: { referral: CareReferral | null; onClose: () => void; onBook: (r: CareReferral, startIso: string, room: string) => void }) {
  const [shown, setShown] = useState<CareReferral | null>(referral);
  if (referral && referral !== shown) setShown(referral);
  const r = referral ?? shown;
  return (
    <Dialog open={!!referral} onOpenChange={(o) => !o && onClose()}>
      {r ? <BookBody key={r.id} referral={r} onClose={onClose} onBook={onBook} /> : null}
    </Dialog>
  );
}

function BookBody({ referral, onClose, onBook }: { referral: CareReferral; onClose: () => void; onBook: (r: CareReferral, startIso: string, room: string) => void }) {
  const staff = staffById(referral.toId);
  const patient = patientById(referral.patientId);
  const hours = useMemo(() => (staff ? workingWindow(staff.workingHours) : null), [staff]);
  const room = staff?.room ?? "Consult 1";
  const days = useMemo(() => clinicDays(6), []);
  const [duration, setDuration] = useState<"30" | "45" | "60">(referral.toDiscipline === "movement" ? "45" : "30");
  const [day, setDay] = useState(days[0]);
  const [slot, setSlot] = useState<string | null>(null);
  const nowMin = toMin(formatDate(TODAY.toISOString(), { hour: "2-digit", minute: "2-digit", hour12: false }));

  const slotsFor = useMemo(() => {
    const dur = Number(duration);
    return (key: string) => {
      if (!hours) return [];
      const busy = WEEK_APPOINTMENTS.filter((a) => a.staffId === referral.toId && dayKey(a.start) === key && a.status !== "cancelled").map((a) => {
        const s = toMin(formatDate(a.start, { hour: "2-digit", minute: "2-digit", hour12: false }));
        return [s, s + a.durationMin] as const;
      });
      return timeSlots(hours[0], toHHMM(toMin(hours[1]) - dur), 30)
        .filter((t) => key !== TODAY_KEY || toMin(t) >= nowMin + 20)
        .map((t) => {
          const s = toMin(t);
          const taken = busy.some(([b0, b1]) => s < b1 && s + dur > b0);
          return { time: t, taken };
        });
    };
  }, [duration, hours, referral.toId, nowMin]);

  const slots = slotsFor(day);

  useEffect(() => {
    setSlot(null);
  }, [day, duration]);

  const startIso = slot ? isoAt(day, slot) : null;
  const end = slot ? toHHMM(toMin(slot) + Number(duration)) : null;

  return (
    <ModalContent
      title={`Book ${patient?.name ?? "patient"}`}
      description={`${DISCIPLINE_LABEL[referral.toDiscipline]} referral · with ${staff?.name ?? "the receiving practitioner"}`}
      size="md"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="dark" leading={<CalendarCheck />} disabled={!startIso} onClick={() => startIso && onBook(referral, startIso, room)}>
            {slot ? `Book ${formatDate(isoAt(day, slot), { weekday: "short", day: "numeric", month: "short" })} · ${slot}` : "Pick a time"}
          </Button>
        </>
      }
    >
      <div className="flex items-center gap-3 rounded-inner bg-canvas p-3">
        <Avatar src={staff?.avatar} name={staff?.name ?? "Practitioner"} size="md" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm text-ink">{staff?.name}</p>
          <p className="truncate text-xs text-muted">
            {staff?.title} · {staff?.workingHours}
          </p>
        </div>
        <span className="hidden items-center gap-1.5 text-xs text-muted sm:inline-flex">
          <MapPin size={14} aria-hidden="true" />
          {room}
        </span>
      </div>

      {!hours ? (
        <p className="mt-6 rounded-inner bg-warning-soft p-4 text-sm text-warning">{staff?.name} isn&apos;t taking bookings ({staff?.workingHours}). Reassign the referral first.</p>
      ) : (
        <>
          <section className="mt-6">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-xs text-muted" id="book-day">
                Day
              </h3>
              <Segmented
                ariaLabel="Duration"
                size="sm"
                variant="tray"
                value={duration}
                onChange={setDuration}
                items={[
                  { value: "30", label: "30 min" },
                  { value: "45", label: "45 min" },
                  { value: "60", label: "60 min" },
                ]}
              />
            </div>
            <div role="radiogroup" aria-labelledby="book-day" className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-6">
              {days.map((d) => {
                const free = slotsFor(d).filter((s) => !s.taken).length;
                const active = d === day;
                return (
                  <button
                    key={d}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => setDay(d)}
                    className={cn(
                      "flex flex-col items-center gap-0.5 rounded-inner px-2 py-2 text-center transition-[background-color,color,box-shadow] duration-200",
                      active ? "bg-charcoal text-white" : "bg-surface text-ink shadow-[inset_0_0_0_1px_var(--color-line)] hover:shadow-[inset_0_0_0_1px_var(--color-line-strong)]",
                    )}
                  >
                    <span className={cn("text-[11px]", active ? "text-white/70" : "text-muted")}>{d === TODAY_KEY ? "Today" : formatDate(isoAt(d, "12:00"), { weekday: "short" })}</span>
                    <span className="text-sm tabular">{formatDate(isoAt(d, "12:00"), { day: "numeric", month: "short" })}</span>
                    <span className={cn("text-[11px] tabular", active ? "text-white/70" : free === 0 ? "text-danger" : "text-muted")}>{free === 0 ? "Full" : `${free} free`}</span>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="mt-6">
            <h3 className="text-xs text-muted" id="book-time">
              Time
            </h3>
            {slots.length === 0 ? (
              <p className="mt-3 text-sm text-muted">No times left on this day — pick another.</p>
            ) : (
              <div role="radiogroup" aria-labelledby="book-time" className="mt-3 grid grid-cols-4 gap-2 sm:grid-cols-6">
                {slots.map((s) => {
                  const active = s.time === slot;
                  return (
                    <button
                      key={s.time}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      disabled={s.taken}
                      onClick={() => setSlot(s.time)}
                      aria-label={s.taken ? `${s.time}, already booked` : s.time}
                      className={cn(
                        "h-10 rounded-full text-sm tabular transition-[background-color,color,box-shadow] duration-200",
                        active
                          ? "bg-charcoal text-white"
                          : s.taken
                            ? "cursor-not-allowed bg-sunken text-faint line-through"
                            : "bg-surface text-ink shadow-[inset_0_0_0_1px_var(--color-line)] hover:shadow-[inset_0_0_0_1px_var(--color-line-strong)]",
                      )}
                    >
                      {s.time}
                    </button>
                  );
                })}
              </div>
            )}
            <p className="mt-3 text-xs text-muted">Struck-through times are already taken in {staff?.name}&apos;s diary.</p>
          </section>

          <div className="mt-6 flex items-start gap-3 rounded-inner bg-canvas p-4">
            <Clock size={18} className="mt-0.5 shrink-0 text-muted" aria-hidden="true" />
            <p className="text-sm text-ink-2">
              {slot ? (
                <>
                  <span className="text-ink">
                    {formatDate(isoAt(day, slot), { weekday: "long", day: "numeric", month: "long" })}, {slot}–{end}
                  </span>{" "}
                  · {room}.{" "}
                </>
              ) : null}
              Holds the slot in this browser session only — the patient isn&apos;t sent a confirmation and the shared diary isn&apos;t changed.
            </p>
          </div>
        </>
      )}
    </ModalContent>
  );
}

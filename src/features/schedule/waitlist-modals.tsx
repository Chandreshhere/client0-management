"use client";

import { useMemo, useState } from "react";
import { CalendarCheck, ListPlus, PersonSimpleTaiChi } from "@phosphor-icons/react";
import type { Discipline, Priority } from "@/data/types";
import { CLASSES } from "@/data/programs";
import { DISCIPLINE_LABEL } from "@/data/appointments";
import { staffById } from "@/data/staff";
import { cn } from "@/lib/cn";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Dialog, ModalContent } from "@/components/ui/dialog";
import { Field, Input, Select, Switch, Textarea } from "@/components/ui/input";
import { Segmented } from "@/components/ui/segmented";
import { DIARY_TO, PREFERENCE_CHIPS, PRACTITIONERS, PRIORITY_LABEL, SERVICES, TODAY_KEY, serviceById } from "./data";
import { dateOf, freeSlots, hhmm, matchesPreference, minOf, onLeave, shortDay } from "./engine";
import { PatientPicker } from "./patient-picker";
import { useSchedule, type WaitEntry, type WaitOffer } from "./store";
import { DisciplineDot } from "./ui";
import { offerDays, prefersOf } from "./waitlist-insights";


/** Offer a slot: free gaps in the diary (practitioner and room both free) or a place in a class. */
export function OfferSlotModal({ entry, onClose, onOffer }: { entry: WaitEntry | null; onClose: () => void; onOffer: (entry: WaitEntry, offer: WaitOffer) => void }) {
  return (
    <Dialog open={!!entry} onOpenChange={(o) => !o && onClose()}>
      {entry ? <OfferForm key={entry.id} entry={entry} onClose={onClose} onOffer={onOffer} /> : null}
    </Dialog>
  );
}

function OfferForm({ entry, onClose, onOffer }: { entry: WaitEntry; onClose: () => void; onOffer: (entry: WaitEntry, offer: WaitOffer) => void }) {
  const { occupants, person, classSeats } = useSchedule();
  const svc = serviceById(entry.serviceId);
  const duration = svc?.durationMin ?? 30;
  const prefers = prefersOf(entry);
  const requested = entry.staffIds.map((id) => staffById(id)).filter((s): s is NonNullable<typeof s> => !!s);
  const requestedAway = requested.length > 0 && requested.every((s) => offerDays().every((d) => onLeave(s.id, d)));
  const [scope, setScope] = useState<"requested" | "any">(requestedAway ? "any" : "requested");
  const [matchPrefs, setMatchPrefs] = useState(prefers.length > 0);
  const [choice, setChoice] = useState<WaitOffer | null>(null);
  const who = person(entry.patientId);
  const days = offerDays();

  const pool = useMemo(() => {
    if (scope === "requested" && requested.length) return requested;
    return PRACTITIONERS.filter((p) => p.discipline === entry.discipline && (!svc || svc.staffIds.includes(p.id) || p.discipline === svc.discipline));
  }, [scope, requested, entry.discipline, svc]);

  const groups = useMemo(
    () =>
      days.map((d) => ({
        date: d,
        rows: pool.map((s) => {
          const leave = onLeave(s.id, d);
          const all = leave ? [] : freeSlots({ staffId: s.id, room: s.room ?? "Consult 1", date: d, duration }, occupants, 30);
          const slots = matchPrefs && prefers.length ? all.filter((t) => prefers.some((p) => matchesPreference(d, t, p))) : all;
          return { staff: s, leave, slots, hidden: all.length - slots.length };
        }),
      })),
    [days, pool, duration, occupants, matchPrefs, prefers],
  );
  const total = groups.reduce((n, g) => n + g.rows.reduce((m, r) => m + r.slots.length, 0), 0);

  const classOptions = entry.classId
    ? CLASSES.filter((c) => c.kind === "group" && dateOf(c.start) >= TODAY_KEY && dateOf(c.start) <= DIARY_TO && !(dateOf(c.start) === TODAY_KEY && minOf(c.start) < 9 * 60 + 40))
        .map((c) => ({ c, taken: c.enrolled.filter((e) => e.attendance !== "cancelled").length + (classSeats[c.id] ?? 0) }))
        .sort((a, b) => a.c.start.localeCompare(b.c.start))
    : [];

  const summary =
    choice?.kind === "slot"
      ? `${shortDay(choice.date)}, ${hhmm(choice.start)} with ${staffById(choice.staffId)?.name}`
      : choice?.kind === "class"
        ? CLASSES.find((c) => c.id === choice.classId)?.title
        : null;

  return (
    <ModalContent
      size="lg"
      title={`Offer a slot to ${who?.name ?? "this patient"}`}
      description={`${entry.want} · prefers ${entry.preferred}`}
      footer={
        <>
          <p className="mr-auto hidden min-w-0 truncate text-xs text-muted sm:block">{summary ? `Offer: ${summary}` : "Pick a slot to offer"}</p>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="dark" disabled={!choice} onClick={() => choice && onOffer(entry, choice)} leading={<CalendarCheck />}>
            Record offer
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-6">
        {entry.classId ? (
          <div className="flex flex-col gap-2">
            <p className="text-sm text-ink">Class places · {shortDay(TODAY_KEY)} – {shortDay(DIARY_TO)}</p>
            <ul role="radiogroup" aria-label="Classes" className="flex flex-col gap-1">
              {classOptions.map(({ c, taken }) => {
                const full = taken >= c.capacity;
                const on = choice?.kind === "class" && choice.classId === c.id;
                return (
                  <li key={c.id}>
                    <button
                      type="button"
                      role="radio"
                      aria-checked={on}
                      disabled={full}
                      onClick={() => setChoice({ kind: "class", classId: c.id })}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-inner p-3 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-60",
                        on ? "bg-charcoal text-white" : "bg-sunken text-ink hover:bg-sunken-2",
                      )}
                    >
                      <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-full", on ? "bg-white/15" : "bg-surface")}>
                        <PersonSimpleTaiChi size={18} aria-hidden="true" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm">{c.title}</span>
                        <span className={cn("block truncate text-xs", on ? "text-white/75" : "text-muted")}>
                          {shortDay(dateOf(c.start))}, {hhmm(minOf(c.start))} · {staffById(c.instructorId)?.name} · {c.room}
                        </span>
                      </span>
                      <span className={cn("shrink-0 text-xs", full ? "text-danger" : on ? "text-white/75" : "text-muted")}>{full ? `Full · ${taken}/${c.capacity}` : `${c.capacity - taken} of ${c.capacity} free`}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
            <p className="text-xs text-muted">A full class can&apos;t be offered — keep them waiting, or offer a place in another class.</p>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              {requested.length ? (
                <Segmented
                  ariaLabel="Practitioners"
                  variant="tray"
                  size="sm"
                  value={scope}
                  onChange={(v) => {
                    setScope(v);
                    setChoice(null);
                  }}
                  items={[
                    { value: "requested", label: requested.length === 1 ? requested[0].name : "Requested" },
                    { value: "any", label: `Any ${DISCIPLINE_LABEL[entry.discipline].toLowerCase()} practitioner` },
                  ]}
                />
              ) : null}
              {prefers.length ? (
                <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-ink">
                  <Switch
                    checked={matchPrefs}
                    onCheckedChange={(v) => {
                      setMatchPrefs(v);
                      setChoice(null);
                    }}
                  />
                  Match preferred times
                </label>
              ) : null}
            </div>

            {scope === "requested" && requestedAway ? (
              <p className="rounded-inner bg-warning-soft px-4 py-3 text-sm text-warning">
                {requested.map((s) => s.name).join(", ")} {requested.length === 1 ? "is" : "are"} on leave for the rest of the demo diary. Switch to any practitioner, or keep them waiting.
              </p>
            ) : null}

            <div className="flex flex-col gap-4">
              {groups.map((g) => (
                <section key={g.date} aria-label={shortDay(g.date)}>
                  <h3 className="text-sm text-ink">{shortDay(g.date)}</h3>
                  <ul className="mt-2 flex flex-col gap-2">
                    {g.rows.map((r) => (
                      <li key={r.staff.id} className="rounded-inner bg-sunken p-3">
                        <div className="flex items-center gap-2 text-xs text-muted">
                          <Avatar src={r.staff.avatar} name={r.staff.name} size="xs" />
                          <span className="text-sm text-ink">{r.staff.name}</span>· {r.staff.room}
                          <span className="ml-auto">{r.leave ? "On leave" : `${r.slots.length} free`}</span>
                        </div>
                        {r.slots.length ? (
                          <div role="radiogroup" aria-label={`${r.staff.name}, ${shortDay(g.date)}`} className="mt-2 flex flex-wrap gap-1">
                            {r.slots.map((t) => {
                              const on = choice?.kind === "slot" && choice.date === g.date && choice.start === t && choice.staffId === r.staff.id;
                              return (
                                <button
                                  key={t}
                                  type="button"
                                  role="radio"
                                  aria-checked={on}
                                  onClick={() => setChoice({ kind: "slot", date: g.date, start: t, duration, staffId: r.staff.id, room: r.staff.room ?? "Consult 1" })}
                                  className={cn(
                                    "h-8 rounded-full px-3 font-mono text-xs transition-colors",
                                    on ? "bg-charcoal text-white" : "bg-surface text-ink hover:shadow-[inset_0_0_0_1px_var(--color-line-strong)]",
                                  )}
                                >
                                  {hhmm(t)}
                                </button>
                              );
                            })}
                          </div>
                        ) : !r.leave ? (
                          <p className="mt-2 text-xs text-muted">{r.hidden ? `No slot matches “${entry.preferred}” — ${r.hidden} outside those times.` : "Fully booked."}</p>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
            {total === 0 && matchPrefs && prefers.length ? (
              <p className="text-xs text-muted">Nothing matches their preferred times in the demo diary — turn off &ldquo;Match preferred times&rdquo; to see every free slot.</p>
            ) : null}
          </>
        )}
        <p className="text-xs text-muted">
          Free slots come from the synthetic diary ({shortDay(TODAY_KEY)} – {shortDay(DIARY_TO)}). Recording an offer doesn&apos;t contact the patient — messaging isn&apos;t connected. Mark their reply on the waitlist.
        </p>
      </div>
    </ModalContent>
  );
}

/** Add someone to the waitlist: what they want, who with, when suits them, and how urgent it is. */
export function AddWaitlistModal({ open, session, onOpenChange, onAdded }: { open: boolean; session: number; onOpenChange: (o: boolean) => void; onAdded: (e: WaitEntry) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <AddForm key={session} onCancel={() => onOpenChange(false)} onAdded={onAdded} />
    </Dialog>
  );
}

function AddForm({ onCancel, onAdded }: { onCancel: () => void; onAdded: (e: WaitEntry) => void }) {
  const { addWaitlist } = useSchedule();
  const [patientId, setPatientId] = useState<string | null>(null);
  const [discipline, setDiscipline] = useState<Exclude<Discipline, "operations">>("medical");
  const [serviceId, setServiceId] = useState(SERVICES.find((s) => s.discipline === "medical")!.id);
  const [staffId, setStaffId] = useState("any");
  const [chips, setChips] = useState<string[]>([]);
  const [other, setOther] = useState("");
  const [priority, setPriority] = useState<Priority>("normal");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  const services = SERVICES.filter((s) => s.discipline === discipline);
  const service = serviceById(serviceId) ?? services[0];
  const eligible = PRACTITIONERS.filter((p) => service.staffIds.includes(p.id));

  const save = () => {
    if (!patientId) {
      setError("Choose a patient or register a new one.");
      return;
    }
    const staff = staffId === "any" ? undefined : staffById(staffId);
    const picked = PREFERENCE_CHIPS.filter((c) => chips.includes(c.id));
    const preferred = [...picked.map((c) => c.label), other.trim()].filter(Boolean).join(", ") || "Any time";
    const e = addWaitlist({
      patientId,
      want: `${service.label}${staff ? ` with ${staff.name}` : ""}`,
      preferred,
      discipline,
      priority,
      staffIds: staff ? [staff.id] : eligible.map((p) => p.id),
      serviceId: service.id,
      prefers: picked.map((c) => c.prefer),
      note: note.trim() || undefined,
    });
    onAdded(e);
  };

  return (
    <ModalContent
      size="md"
      title="Add to waitlist"
      description="They'll be matched against freed and open slots in the diary."
      footer={
        <>
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
          <Button variant="primary" onClick={save} leading={<ListPlus />}>
            Add to waitlist
          </Button>
        </>
      }
    >
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <Field label="Patient" error={error}>
          {({ id, ...aria }) => (
            <PatientPicker
              value={patientId}
              onChange={(v) => {
                setPatientId(v);
                setError(null);
              }}
              id={id}
              invalid={aria["aria-invalid"]}
              describedBy={aria["aria-describedby"]}
            />
          )}
        </Field>
        <div className="flex flex-col gap-2">
          <span className="text-sm text-ink">Discipline</span>
          <Segmented
            ariaLabel="Discipline"
            variant="tray"
            size="sm"
            className="self-start"
            value={discipline}
            onChange={(d) => {
              setDiscipline(d);
              setServiceId(SERVICES.find((s) => s.discipline === d)!.id);
              setStaffId("any");
            }}
            items={(["medical", "nutrition", "movement"] as const).map((d) => ({ value: d, label: DISCIPLINE_LABEL[d], icon: <DisciplineDot discipline={d} /> }))}
          />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Wants">
            {({ id }) => (
              <Select
                id={id}
                ariaLabel="Service"
                value={service.id}
                onValueChange={(v) => {
                  setServiceId(v);
                  setStaffId("any");
                }}
                options={services.map((s) => ({ value: s.id, label: s.label, description: `${s.durationMin} min` }))}
              />
            )}
          </Field>
          <Field label="With">
            {({ id }) => (
              <Select
                id={id}
                ariaLabel="Practitioner"
                value={staffId}
                onValueChange={setStaffId}
                options={[
                  { value: "any", label: `Any ${DISCIPLINE_LABEL[discipline].toLowerCase()} practitioner` },
                  ...eligible.map((s) => ({
                    value: s.id,
                    label: (
                      <span className="inline-flex items-center gap-2">
                        <Avatar src={s.avatar} name={s.name} size="xs" />
                        {s.name}
                      </span>
                    ),
                  })),
                ]}
              />
            )}
          </Field>
        </div>
        <fieldset className="flex flex-col gap-2">
          <legend className="text-sm text-ink">Preferred times</legend>
          <div className="mt-2 flex flex-wrap gap-1">
            {PREFERENCE_CHIPS.map((c) => {
              const on = chips.includes(c.id);
              return (
                <button
                  key={c.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setChips((xs) => (on ? xs.filter((x) => x !== c.id) : [...xs, c.id]))}
                  className={cn(
                    "h-8 rounded-full px-3 text-xs transition-colors",
                    on ? "bg-charcoal text-white" : "bg-surface text-ink-2 shadow-[inset_0_0_0_1px_var(--color-line)] hover:text-ink hover:shadow-[inset_0_0_0_1px_var(--color-line-strong)]",
                  )}
                >
                  {c.label}
                </button>
              );
            })}
          </div>
          <Input value={other} onChange={(e) => setOther(e.target.value)} placeholder="Anything else? e.g. not before 10:00, after school pick-up" aria-label="Other time preferences" />
        </fieldset>
        <div className="flex flex-col gap-2">
          <span className="text-sm text-ink">Priority</span>
          <Segmented
            ariaLabel="Priority"
            variant="tray"
            size="sm"
            className="self-start"
            value={priority}
            onChange={setPriority}
            items={(["low", "normal", "high", "urgent"] as const).map((p) => ({ value: p, label: PRIORITY_LABEL[p] }))}
          />
        </div>
        <Field label="Note" optional>
          {(p) => <Textarea rows={2} className="min-h-20" value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Overdue review — doctor asked for this week" {...p} />}
        </Field>
        <button type="submit" className="sr-only">
          Add to waitlist
        </button>
      </form>
    </ModalContent>
  );
}

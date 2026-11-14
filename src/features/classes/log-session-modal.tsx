"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import type { YogaClass } from "@/data/types";
import { PATIENTS } from "@/data/patients";
import { cn } from "@/lib/cn";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Dialog, ModalContent } from "@/components/ui/dialog";
import { Checkbox, Field, Input, Select } from "@/components/ui/input";
import { Segmented } from "@/components/ui/segmented";
import { useToast } from "@/components/ui/toast";
import { useRole } from "@/components/shell/role-context";
import { TODAY_KEY, isoAt, timeSlots } from "@/features/tasks/time";
import { WEEK_CLASSES, precautionText } from "./model";
import { classActions } from "./store";

/**
 * Session log (spec F7, Core): the instructor records a 1:1 or group session — date, time and
 * patients — then marks attendance and writes progress notes on its roster. Clinic+ adds capacity
 * and a weekly repeat for group classes. Saved in this browser session only.
 */
type Kind = YogaClass["kind"];

/** Each patient's latest precaution on record (from their most recent session enrolment). */
function latestEnrolment(patientId: string) {
  for (let i = WEEK_CLASSES.length - 1; i >= 0; i--) {
    const e = WEEK_CLASSES[i].enrolled.find((x) => x.patientId === patientId);
    if (e) return e;
  }
  return null;
}

const SLOTS = timeSlots("06:00", "20:00", 30);
const DURATIONS = ["30", "45", "60", "75", "90"];

export function LogSessionModal({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  return <Dialog open={open} onOpenChange={onOpenChange}>{open ? <Body onClose={() => onOpenChange(false)} /> : null}</Dialog>;
}

function Body({ onClose }: { onClose: () => void }) {
  const { user, has } = useRole();
  const { toast } = useToast();
  const router = useRouter();
  const scheduling = has("group-classes");
  const [kind, setKind] = useState<Kind>("individual");
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(TODAY_KEY);
  const [time, setTime] = useState("17:30");
  const [duration, setDuration] = useState("45");
  const [room, setRoom] = useState("");
  const [capacity, setCapacity] = useState("8");
  const [weekly, setWeekly] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);
  const [tried, setTried] = useState(false);

  const mine = useMemo(() => {
    const inMySessions = new Set(WEEK_CLASSES.filter((c) => c.instructorId === user.id).flatMap((c) => c.enrolled.map((e) => e.patientId)));
    return new Set(PATIENTS.filter((p) => p.careTeam.yoga === user.id || inMySessions.has(p.id)).map((p) => p.id));
  }, [user.id]);
  const patients = useMemo(() => [...PATIENTS].sort((a, b) => Number(mine.has(b.id)) - Number(mine.has(a.id)) || a.name.localeCompare(b.name)), [mine]);

  const cap = Number(capacity);
  const errors = {
    patients: picked.length === 0 ? "Choose who the session is with." : kind === "individual" && picked.length > 1 ? "A 1:1 session is with one patient." : null,
    date: !date ? "Pick a date." : null,
    capacity: scheduling && kind === "group" && (!Number.isFinite(cap) || cap < Math.max(2, picked.length) || cap > 30) ? `Between ${Math.max(2, picked.length)} and 30 places.` : null,
  };

  const toggle = (id: string, on: boolean) => setPicked((xs) => (kind === "individual" ? (on ? [id] : []) : on ? [...xs, id] : xs.filter((x) => x !== id)));

  const submit = () => {
    setTried(true);
    if (errors.patients || errors.date || errors.capacity) return;
    const id = `c-local-${Date.now().toString(36)}`;
    const enrolled = picked.map((pid) => {
      const last = latestEnrolment(pid);
      return { patientId: pid, attendance: "pending" as const, clearance: last?.clearance ?? ("current" as const), ...(last?.precaution ? { precaution: precautionText(last.precaution) } : {}) };
    });
    classActions.log({
      id,
      title: title.trim() || (kind === "individual" ? "1:1 session" : "Group session"),
      kind,
      instructorId: user.id,
      room: room.trim() || (kind === "individual" ? "Therapy Room" : "Yoga Hall"),
      start: isoAt(date, time),
      durationMin: Number(duration),
      capacity: scheduling && kind === "group" ? cap : enrolled.length,
      focus: "",
      enrolled,
      waitlist: [],
      weekly: scheduling && kind === "group" ? weekly : false,
      loggedBy: user.id,
    });
    onClose();
    toast({ title: "Session logged", description: "Saved in this browser session. Mark attendance and write progress notes on its roster.", tone: "success" });
    router.push(`/classes/${id}`);
  };

  return (
    <ModalContent
      title="Log a session"
      description="A 1:1 or group session: when, and who it's with."
      size="md"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="dark" onClick={submit}>
            Log session
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
        <div className="flex flex-col gap-2 sm:col-span-2">
          <span className="text-sm text-ink">Session</span>
          <Segmented
            ariaLabel="Session type"
            size="sm"
            variant="tray"
            className="self-start"
            value={kind}
            onChange={(k) => {
              setKind(k);
              if (k === "individual") setPicked((xs) => xs.slice(0, 1));
            }}
            items={[
              { value: "individual", label: "1:1" },
              { value: "group", label: "Group" },
            ]}
          />
        </div>
        <Field label="Name" optional className="sm:col-span-2">
          {(a) => <Input {...a} value={title} onChange={(ev) => setTitle(ev.target.value)} placeholder={kind === "individual" ? "1:1 session" : "e.g. Evening Breath & Balance"} />}
        </Field>
        <Field label="Date" error={tried ? errors.date : null}>
          {(a) => <Input {...a} type="date" value={date} onChange={(ev) => setDate(ev.target.value)} />}
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Time">
            {(a) => <Select id={a.id} value={time} onValueChange={setTime} options={SLOTS.map((t) => ({ value: t, label: t }))} />}
          </Field>
          <Field label="Minutes">
            {(a) => <Select id={a.id} value={duration} onValueChange={setDuration} options={DURATIONS.map((d) => ({ value: d, label: d }))} />}
          </Field>
        </div>
        <Field label="Room" optional>
          {(a) => <Input {...a} value={room} onChange={(ev) => setRoom(ev.target.value)} placeholder={kind === "individual" ? "Therapy Room" : "Yoga Hall"} />}
        </Field>
        {scheduling && kind === "group" ? (
          <Field label="Places" error={tried ? errors.capacity : null}>
            {(a) => <Input {...a} type="number" inputMode="numeric" min={2} max={30} value={capacity} onChange={(ev) => setCapacity(ev.target.value)} />}
          </Field>
        ) : (
          <span className="hidden sm:block" />
        )}
        {scheduling && kind === "group" ? (
          <label htmlFor="log-weekly" className="flex cursor-pointer items-center gap-3 rounded-inner p-3 shadow-[inset_0_0_0_1px_var(--color-line)] sm:col-span-2">
            <Checkbox id="log-weekly" checked={weekly} onCheckedChange={(v) => setWeekly(v === true)} />
            <span className="text-sm text-ink">
              Repeats weekly <span className="text-muted">· same day and time</span>
            </span>
          </label>
        ) : null}
        <fieldset className="flex flex-col gap-2 sm:col-span-2">
          <legend className="mb-2 flex w-full items-baseline justify-between gap-2 text-sm text-ink">
            {kind === "individual" ? "Patient" : "Patients"}
            <span className="text-xs text-muted tabular">{picked.length ? `${picked.length} chosen` : "Your patients first"}</span>
          </legend>
          <ul className="scrollbar-thin flex max-h-[240px] flex-col gap-1 overflow-y-auto overscroll-contain rounded-inner bg-canvas p-1">
            {patients.map((p) => {
              const on = picked.includes(p.id);
              const last = latestEnrolment(p.id);
              const rule = precautionText(last?.precaution);
              return (
                <li key={p.id}>
                  <label htmlFor={`log-p-${p.id}`} className={cn("flex cursor-pointer items-center gap-3 rounded-[12px] px-3 py-2 transition-colors", on ? "bg-surface" : "hover:bg-surface/70")}>
                    <Checkbox id={`log-p-${p.id}`} checked={on} onCheckedChange={(v) => toggle(p.id, v === true)} />
                    <Avatar src={p.avatar} name={p.name} size="xs" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm text-ink">{p.name}</span>
                      <span className="block truncate text-xs text-muted">{rule ? `Precaution: ${rule}` : "No session precautions"}</span>
                    </span>
                    {mine.has(p.id) ? <span className="shrink-0 text-[11px] text-muted">Yours</span> : null}
                  </label>
                </li>
              );
            })}
          </ul>
          {tried && errors.patients ? <p className="text-xs text-danger">{errors.patients}</p> : null}
        </fieldset>
        <button type="submit" className="sr-only">
          Log session
        </button>
      </form>
    </ModalContent>
  );
}

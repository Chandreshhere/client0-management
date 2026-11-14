"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { Buildings, DoorOpen, GearSix, Lock, MapPin, Plus, Trash } from "@phosphor-icons/react";
import type { BranchId } from "@/data/types";
import { STAFF, staffById } from "@/data/staff";
import { PATIENTS } from "@/data/patients";
import { formatTime, pluralize } from "@/lib/format";
import { cn } from "@/lib/cn";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, Group, GroupHeader, Inset } from "@/components/ui/card";
import { EmptyState, PageHeader } from "@/components/ui/misc";
import { Field, Input, Select, Switch, Textarea } from "@/components/ui/input";
import { IconButton } from "@/components/ui/icon-button";
import { Tip } from "@/components/ui/tooltip";
import { useToast } from "@/components/ui/toast";
import { usePlan, useRole } from "@/components/shell/role-context";
import { LockBadge } from "@/components/shell/plan-switcher";
import { InfoNote, ROLE_LABEL, ReadOnlyBanner, SaveState, type SaveStatus } from "./ui";
import { OrganImage } from "@/components/viz/organ";
import { caseloadByOrgan } from "@/features/team/data";
import { DayTrack, DayTrackScale } from "./viz";
import { NOW_ISO, NOW_MIN, hhmm } from "./time";
import { BRANCH_ADDRESS, CLINIC_FIXED, roomBookingsToday, settingsAccess, type ClinicProfile } from "./data";
import { addRoom, removeRoom, restoreRoom, saveClinic, saveProfile, useClinic, useRooms, useSettingsState, type ProfilePrefs } from "./store";

/** Settings → General: your profile (every staff role), clinic profile and branches (owners). */
export function GeneralView() {
  const { role } = useRole();
  if (role === "patient") {
    return (
      <div className="flex flex-col gap-6 lg:gap-8">
        <PageHeader title="Settings" />
        <Card>
          <EmptyState
            icon={<GearSix />}
            title="Your preferences live in your portal"
            description="Clinic settings are for the clinic team. Your contact details, reminders and privacy choices are in your portal."
            action={
              <Button asChild variant="dark">
                <Link href="/portal/preferences">Open my preferences</Link>
              </Button>
            }
          />
        </Card>
      </div>
    );
  }
  return <GeneralWorkspace />;
}

/** Fake latency so "Saving…" is visible; the save itself is synchronous and local. */
function useSaver() {
  const [status, setStatus] = useState<SaveStatus>({ kind: "clean" });
  const t = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(t.current), []);
  return {
    status,
    setDirty: () => setStatus({ kind: "dirty" }),
    run: (fn: () => void) => {
      setStatus({ kind: "saving" });
      window.clearTimeout(t.current);
      t.current = window.setTimeout(() => {
        fn();
        setStatus({ kind: "saved", at: formatTime(NOW_ISO) });
      }, 450);
    },
  };
}

function GeneralWorkspace() {
  const { role } = useRole();
  const { plan } = usePlan();
  const access = settingsAccess(role, plan);
  return (
    <div className="flex flex-col gap-6 lg:gap-8">
      <PageHeader eyebrow="Settings" title="General" description="Your own profile, the clinic's details and its branches. Changes are saved in this browser session and written to the audit log — nothing leaves this browser." />
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <ProfileCard />
        <ClinicCard canEdit={access.canEditClinic} ownerLabel={access.ownerLabel} />
      </div>
      <BranchesSection canEdit={access.canEditClinic} />
    </div>
  );
}

// ---------------------------------------------------------------------------------------------

function ProfileCard() {
  const { user } = useRole();
  const s = useSettingsState();
  const staff = staffById(user.id);
  const base: ProfilePrefs = useMemo(() => s.profiles[user.id] ?? { displayName: user.name, title: user.title, digest: true, reviewReminders: true, messageAlerts: false }, [s.profiles, user]);
  const [form, setForm] = useState<ProfilePrefs>(base);
  const [error, setError] = useState<string | null>(null);
  const saver = useSaver();
  useEffect(() => setForm(base), [base]);
  const dirty = JSON.stringify(form) !== JSON.stringify(base);
  const set = <K extends keyof ProfilePrefs>(k: K, v: ProfilePrefs[K]) => {
    setForm((f) => ({ ...f, [k]: v }));
    saver.setDirty();
  };

  return (
    <section aria-labelledby="profile-title" className="flex flex-col gap-6 rounded-card bg-surface p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <Avatar src={user.avatar} name={user.name} size="lg" />
          <div className="min-w-0">
            <h2 id="profile-title" className="text-lg font-normal tracking-[-0.01em] text-ink">
              Your profile
            </h2>
            <p className="truncate text-xs text-muted">
              {staff ? `${ROLE_LABEL(staff.role)} workspace · ${staff.workingHours}` : user.title}
            </p>
          </div>
        </div>
        <SaveState status={dirty && saver.status.kind !== "saving" ? { kind: "dirty" } : saver.status} />
      </div>
      <form
        className="flex flex-col gap-5"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          if (form.displayName.trim().length < 2) {
            setError("Enter the name colleagues and patients will see.");
            return;
          }
          setError(null);
          saver.run(() => saveProfile(user.id, { ...form, displayName: form.displayName.trim(), title: form.title.trim() }));
        }}
      >
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <Field label="Display name" error={error ?? undefined}>
            {(a) => <Input {...a} value={form.displayName} onChange={(e) => { set("displayName", e.target.value); setError(null); }} autoComplete="name" />}
          </Field>
          <Field label="Job title" optional>
            {(a) => <Input {...a} value={form.title} onChange={(e) => set("title", e.target.value)} />}
          </Field>
        </div>
        <Field label="Work email" hint="Managed by the clinic administrator — it's your sign-in name.">
          {(a) => <Input {...a} value={staff?.email ?? ""} readOnly disabled className="text-ink-2" />}
        </Field>
        <fieldset className="flex flex-col gap-3">
          <legend className="mb-1 text-sm text-ink">Notifications</legend>
          {(
            [
              ["digest", "Morning summary", "What needs you today, at 08:00"],
              ["reviewReminders", "Review reminders", "Reports and notes waiting on you"],
              ["messageAlerts", "Message alerts", "Each new patient or care-team message"],
            ] as const
          ).map(([k, label, hint]) => (
            <label key={k} className="flex items-center justify-between gap-4 rounded-[14px] bg-sunken px-4 py-3">
              <span>
                <span className="block text-sm text-ink">{label}</span>
                <span className="block text-xs text-muted">{hint}</span>
              </span>
              <Switch checked={form[k]} onCheckedChange={(v) => set(k, v)} aria-label={label} />
            </label>
          ))}
          <p className="text-xs text-muted">Preferences are stored, but no email or alert is sent from this prototype.</p>
        </fieldset>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" disabled={!dirty} onClick={() => { setForm(base); setError(null); }}>
            Discard
          </Button>
          <Button type="submit" variant="dark" disabled={!dirty} loading={saver.status.kind === "saving"}>
            Save profile
          </Button>
        </div>
      </form>
    </section>
  );
}

// ---------------------------------------------------------------------------------------------

type ClinicErrors = Partial<Record<keyof ClinicProfile, string>>;
const CLINIC_FIELDS: { key: keyof ClinicProfile; label: string }[] = [
  { key: "name", label: "clinic name" },
  { key: "shortName", label: "short name" },
  { key: "legal", label: "legal name" },
  { key: "phone", label: "phone" },
  { key: "email", label: "email" },
  { key: "slotMinutes", label: "default slot" },
  { key: "receiptNote", label: "receipt note" },
];

function ClinicCard({ canEdit, ownerLabel }: { canEdit: boolean; ownerLabel: string }) {
  const { toast } = useToast();
  const { user } = useRole();
  const saved = useClinic();
  const [form, setForm] = useState<ClinicProfile>(saved);
  const [errors, setErrors] = useState<ClinicErrors>({});
  const saver = useSaver();
  useEffect(() => setForm(saved), [saved]);
  const changed = CLINIC_FIELDS.filter((f) => form[f.key] !== saved[f.key]);
  const dirty = changed.length > 0;
  const set = (k: keyof ClinicProfile, v: string) => {
    setForm((f) => ({ ...f, [k]: v }));
    setErrors((e) => ({ ...e, [k]: undefined }));
    saver.setDirty();
  };

  function validate(): ClinicErrors {
    const e: ClinicErrors = {};
    if (form.name.trim().length < 3) e.name = "Enter the clinic's name.";
    if (!form.shortName.trim()) e.shortName = "Enter a short name.";
    else if (form.shortName.trim().length > 12) e.shortName = "Keep it to 12 characters — it ends every text message.";
    if (!/^\+?[0-9][0-9 ]{8,15}$/.test(form.phone.trim())) e.phone = "Use digits and spaces, e.g. +91 80 4000 2626.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(form.email.trim())) e.email = "That doesn't look like an email address.";
    if (form.receiptNote.trim().length > 200) e.receiptNote = "Keep the receipt note under 200 characters.";
    return e;
  }

  const fixed = (
    <dl className="grid grid-cols-2 gap-x-4 gap-y-3 rounded-inner bg-sunken p-4 text-sm">
      <div>
        <dt className="text-xs text-muted">Invoice numbers</dt>
        <dd className="mt-0.5 font-mono text-[13px] text-ink">{CLINIC_FIXED.invoicePrefix}0001…</dd>
      </div>
      <div>
        <dt className="text-xs text-muted">Week</dt>
        <dd className="mt-0.5 text-ink">{CLINIC_FIXED.week}</dd>
      </div>
      <div>
        <dt className="text-xs text-muted">Time zone</dt>
        <dd className="mt-0.5 text-ink">{CLINIC_FIXED.timezone}</dd>
      </div>
      <div>
        <dt className="text-xs text-muted">Currency</dt>
        <dd className="mt-0.5 text-ink">{CLINIC_FIXED.currency}</dd>
      </div>
    </dl>
  );

  return (
    <section aria-labelledby="clinic-title" className="flex flex-col gap-6 rounded-card bg-surface p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-sunken text-ink-2">
            <Buildings size={20} />
          </span>
          <div className="min-w-0">
            <h2 id="clinic-title" className="text-lg font-normal tracking-[-0.01em] text-ink">
              Clinic profile
            </h2>
            <p className="truncate text-xs text-muted">Shown on invoices, receipts, messages and the patient portal</p>
          </div>
        </div>
        {canEdit ? <SaveState status={dirty && saver.status.kind !== "saving" ? { kind: "dirty" } : saver.status} /> : null}
      </div>

      {canEdit ? (
        <form
          className="flex flex-col gap-5"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            const errs = validate();
            setErrors(errs);
            if (Object.keys(errs).length) return;
            const labels = changed.map((f) => f.label);
            const next = Object.fromEntries(Object.entries(form).map(([k, v]) => [k, typeof v === "string" ? v.trim() : v])) as ClinicProfile;
            saver.run(() => {
              saveClinic(next, user.id, labels);
              toast({ tone: "success", title: "Clinic profile saved locally", description: `Changed ${labels.join(", ")}. Invoices and messages in this prototype aren't re-sent.` });
            });
          }}
        >
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-[minmax(0,1fr)_160px]">
            <Field label="Clinic name" error={errors.name}>
              {(a) => <Input {...a} value={form.name} onChange={(e) => set("name", e.target.value)} />}
            </Field>
            <Field label="Short name" error={errors.shortName} hint={errors.shortName ? undefined : `${form.shortName.trim().length}/12 · signs texts`}>
              {(a) => <Input {...a} value={form.shortName} onChange={(e) => set("shortName", e.target.value)} />}
            </Field>
          </div>
          <Field label="Legal name" hint="Printed on invoices and receipts">
            {(a) => <Input {...a} value={form.legal} onChange={(e) => set("legal", e.target.value)} />}
          </Field>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <Field label="Phone" error={errors.phone}>
              {(a) => <Input {...a} inputMode="tel" value={form.phone} onChange={(e) => set("phone", e.target.value)} className="tabular" />}
            </Field>
            <Field label="Email" error={errors.email}>
              {(a) => <Input {...a} type="email" value={form.email} onChange={(e) => set("email", e.target.value)} />}
            </Field>
          </div>
          <Field label="Default appointment length" hint="New bookings start with this length; services can override it">
            {(a) => (
              <Select
                id={a.id}
                ariaLabel="Default appointment length"
                value={form.slotMinutes}
                onValueChange={(v) => set("slotMinutes", v)}
                options={["15", "20", "30", "45", "60"].map((m) => ({ value: m, label: `${m} minutes` }))}
              />
            )}
          </Field>
          <Field label="Receipt note" error={errors.receiptNote} hint={errors.receiptNote ? undefined : `${form.receiptNote.trim().length}/200`}>
            {(a) => <Textarea {...a} value={form.receiptNote} onChange={(e) => set("receiptNote", e.target.value)} className="min-h-20" />}
          </Field>
          {fixed}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" disabled={!dirty} onClick={() => { setForm(saved); setErrors({}); }}>
              Discard
            </Button>
            <Button type="submit" variant="dark" disabled={!dirty} loading={saver.status.kind === "saving"}>
              Save clinic profile
            </Button>
          </div>
        </form>
      ) : (
        <>
          <dl className="grid grid-cols-1 gap-x-4 gap-y-3 text-sm sm:grid-cols-2">
            {(
              [
                ["Clinic name", saved.name],
                ["Short name", saved.shortName],
                ["Legal name", saved.legal],
                ["Phone", saved.phone],
                ["Email", saved.email],
                ["Default appointment", `${saved.slotMinutes} minutes`],
                // Shown read-only too (the edit form has them): the card no longer ends far above the profile card.
                ["Opening hours", `${hhmm(CLINIC_FIXED.hours.start)}–${hhmm(CLINIC_FIXED.hours.end)}`],
                ["Receipt note", saved.receiptNote],
              ] as const
            ).map(([k, v]) => (
              <div key={k}>
                <dt className="text-xs text-muted">{k}</dt>
                <dd className="mt-0.5 text-ink">{v}</dd>
              </div>
            ))}
          </dl>
          {fixed}
          <InfoNote icon={<Lock />} className="mt-auto">
            Clinic details are changed by {ownerLabel}.
          </InfoNote>
        </>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------------------------

function BranchesSection({ canEdit }: { canEdit: boolean }) {
  const { has } = usePlan();
  const branches = useRooms();
  const multi = has("branches");
  const shown = multi ? branches : branches.slice(0, 1);
  const hidden = multi ? [] : branches.slice(1);
  return (
    <section aria-labelledby="branches-title" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="branches-title" className="text-lg font-normal tracking-[-0.01em] text-ink">
            Branches & rooms
          </h2>
          <p className="mt-1 text-sm text-muted">Each room shows today&apos;s bookings from the diary · white = opening hours · charcoal = booked · grey = already happened · line = now</p>
        </div>
      </div>
      {!canEdit ? <ReadOnlyBanner>Rooms and branches are managed by administrators. You can see how each room is used today.</ReadOnlyBanner> : null}
      {/* Branches differ in room count: each card keeps its own height (no stretched grey group), and the
          shorter one rides along (sticky) while the longer one scrolls. */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2 xl:items-start">
        {shown.map((b) => (
          <BranchCard key={b.id} branch={b} canEdit={canEdit} />
        ))}
        {hidden.map((b) => (
          <Group key={b.id} className="flex flex-col justify-center">
            <Inset className="flex flex-col items-start gap-3 p-6">
              <span className="flex items-center gap-2 text-sm text-ink">
                <LockBadge />
                {b.name} · {b.city}
              </span>
              <p className="text-sm text-muted">Multi-branch management is on the Clinic plan. This branch&apos;s rooms and staff stay hidden on your current plan.</p>
              <Button asChild size="sm" variant="secondary">
                <Link href="/pricing">Compare plans</Link>
              </Button>
            </Inset>
          </Group>
        ))}
      </div>
    </section>
  );
}

function BranchCard({ branch, canEdit }: { branch: ReturnType<typeof useRooms>[number]; canEdit: boolean }) {
  const { toast } = useToast();
  const { user } = useRole();
  const [room, setRoom] = useState("");
  const [error, setError] = useState<string | null>(null);
  const staff = STAFF.filter((s) => s.branch === branch.id).length;
  const registered = PATIENTS.filter((p) => p.branch === branch.id);
  const patients = registered.length;
  const mix = caseloadByOrgan(registered);
  const unrecorded = patients - mix.reduce((s, g) => s + g.patients.length, 0);
  const rows = branch.rooms.map((r) => ({ room: r, bookings: roomBookingsToday(r), added: branch.added.includes(r) }));
  const minutes = rows.reduce((s, r) => s + r.bookings.reduce((m, b) => m + b.minutes, 0), 0);
  const count = rows.reduce((s, r) => s + r.bookings.length, 0);
  const open = CLINIC_FIXED.hours.end - CLINIC_FIXED.hours.start;
  const pct = Math.round((minutes / (open * Math.max(1, rows.length))) * 100);

  function add() {
    const name = room.trim();
    if (!name) return setError("Name the room.");
    if (name.length > 24) return setError("Keep room names to 24 characters.");
    if (branch.rooms.some((r) => r.toLowerCase() === name.toLowerCase())) return setError(`${branch.name} already has “${name}”.`);
    addRoom(branch.id as BranchId, name, user.id);
    setRoom("");
    setError(null);
    toast({ tone: "success", title: `Added “${name}”`, description: "Saved in this browser session. It can be booked once the diary reads rooms from settings — not in this prototype." });
  }

  return (
    <Group className="flex flex-col xl:sticky xl:top-20">
      <GroupHeader
        icon={<MapPin />}
        title={`${branch.name} · ${branch.city}`}
        subtitle={`${BRANCH_ADDRESS[branch.id] ?? branch.city} · open 07:00–20:00`}
        action={<span className="hidden text-xs text-muted sm:inline">{pluralize(staff, "staff member")} · {pluralize(patients, "patient")}</span>}
      />
      <div className="flex flex-col gap-2">
        <Inset className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="text-sm text-ink">
            {pluralize(count, "booking")} today
            <span className="text-muted"> · {Math.floor(minutes / 60)}h {String(minutes % 60).padStart(2, "0")}m across {pluralize(rows.length, "room")}</span>
          </p>
          <p className="text-xs text-muted">{pct}% of opening hours booked</p>
        </Inset>
        {patients ? (
          <Inset className="flex flex-col gap-3">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="text-sm text-ink">
                {pluralize(patients, "patient")} registered here
                <span className="text-muted"> · by primary body system</span>
              </p>
              {unrecorded ? <p className="text-xs text-muted">{unrecorded} with no condition recorded yet</p> : null}
            </div>
            <ul className="scrollbar-none -mx-1 flex gap-2 overflow-x-auto px-1" aria-label={`${branch.name} patients by primary body system`}>
              {mix.map((g) => (
                <li key={g.organ} className="shrink-0">
                  <Tip label={`${g.system} · ${g.patients.map((p) => p.name).join(", ")}`}>
                    <span tabIndex={0} className="flex w-[76px] flex-col items-center gap-0.5 rounded-[12px] bg-sunken px-1 pb-2 pt-1 text-center outline-none focus-visible:outline-2 focus-visible:outline-primary">
                      <OrganImage kind={g.organ} className="size-11" />
                      <span className="w-full truncate text-[11px] leading-tight text-ink-2">{g.label}</span>
                      <span className="text-xs text-ink tabular">{g.patients.length}</span>
                    </span>
                  </Tip>
                </li>
              ))}
            </ul>
            <p className="text-[11px] text-muted">Organ = each patient&apos;s primary body system from their recorded conditions — the mix this branch&apos;s rooms and services serve.</p>
          </Inset>
        ) : null}
        <ul className="flex flex-col gap-2">
          {rows.map((r) => {
            const bookedMin = r.bookings.reduce((m, b) => m + b.minutes, 0);
            return (
              <li key={r.room}>
                <Inset className="flex flex-col gap-2">
                  <div className="flex items-center justify-between gap-3">
                    <span className="flex min-w-0 items-center gap-2 text-sm text-ink">
                      <DoorOpen size={16} className="shrink-0 text-muted" aria-hidden="true" />
                      <span className="truncate">{r.room}</span>
                      {r.added ? <span className="shrink-0 text-xs text-muted">· added this session</span> : null}
                    </span>
                    <span className="flex shrink-0 items-center gap-2">
                      <span className="text-xs text-muted tabular">{r.bookings.length ? `${pluralize(r.bookings.length, "booking")} · ${bookedMin} min` : "Free today"}</span>
                      {canEdit ? (
                        r.bookings.length ? (
                          <Tip label={`${pluralize(r.bookings.length, "booking")} today use ${r.room} — move them first`}>
                            <span tabIndex={0} className="rounded-full">
                              <IconButton label={`Remove ${r.room}`} variant="ghost" size="sm" disabled>
                                <Trash />
                              </IconButton>
                            </span>
                          </Tip>
                        ) : (
                          <IconButton
                            label={`Remove ${r.room}`}
                            variant="ghost"
                            size="sm"
                            tooltip
                            onClick={() => {
                              removeRoom(branch.id as BranchId, r.room, user.id);
                              toast({ title: `Removed “${r.room}”`, description: "Saved in this browser session.", action: { label: "Undo", onClick: () => restoreRoom(branch.id as BranchId, r.room, user.id, r.added) } });
                            }}
                          >
                            <Trash />
                          </IconButton>
                        )
                      ) : null}
                    </span>
                  </div>
                  <DayTrack
                    window={CLINIC_FIXED.hours}
                    blocks={r.bookings.map((b) => ({ start: b.start, end: b.end, label: `${b.service} ${b.minutes} min`, tone: b.end <= NOW_MIN || b.status === "completed" || b.status === "no-show" ? ("done" as const) : ("booked" as const) }))}
                    now={NOW_MIN}
                    label={`${r.room} today: ${r.bookings.length ? r.bookings.map((b) => `${hhmm(b.start)} ${b.service}`).join(", ") : "no bookings"}`}
                    height="h-2.5"
                  />
                </Inset>
              </li>
            );
          })}
        </ul>
        <Inset className="pb-2 pt-1">
          <DayTrackScale />
        </Inset>
        {canEdit ? (
          <form
            className={cn("flex flex-col gap-2 rounded-inner bg-surface p-4")}
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              add();
            }}
          >
            <Field label={`Add a room at ${branch.name}`} error={error ?? undefined}>
              {(a) => (
                <div className="flex gap-2">
                  <Input {...a} value={room} onChange={(e) => { setRoom(e.target.value); setError(null); }} placeholder="e.g. Consult 4" />
                  <Button type="submit" variant="secondary" leading={<Plus />}>
                    Add
                  </Button>
                </div>
              )}
            </Field>
          </form>
        ) : null}
      </div>
    </Group>
  );
}


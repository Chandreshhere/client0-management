"use client";

import Link from "next/link";
import { useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { MagnifyingGlass, UserPlus, Warning } from "@phosphor-icons/react";
import { cn } from "@/lib/cn";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input, Select } from "@/components/ui/input";
import { useRole } from "@/components/shell/role-context";
import { useToast } from "@/components/ui/toast";
import { useSchedule, type Person } from "./store";

/**
 * Inline patient combobox: type to search by name, clinic number or phone; arrow keys + Enter to
 * pick. "Register new" opens a mini form (doc §5E: register a patient while booking) with a
 * duplicate check against the registry — a match is offered, never merged automatically.
 */
export function PatientPicker({
  value,
  onChange,
  id,
  invalid,
  describedBy,
  allowRegister = true,
  label = "Patient",
}: {
  value: string | null;
  onChange: (id: string | null) => void;
  id?: string;
  invalid?: boolean;
  describedBy?: string;
  allowRegister?: boolean;
  label?: string;
}) {
  const { person, allPeople, registerPatient } = useSchedule();
  const { toast } = useToast();
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [registering, setRegistering] = useState(false);

  const selected = value ? person(value) : undefined;

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    const digits = q.replace(/\D/g, "");
    const people = allPeople();
    const hits = q
      ? people.filter((p) => p.name.toLowerCase().includes(q) || p.clinicNo.toLowerCase().includes(q) || (digits.length >= 3 && p.phone.replace(/\D/g, "").includes(digits)))
      : people;
    return hits.slice(0, 5);
  }, [query, allPeople]);

  const optionCount = results.length + (allowRegister ? 1 : 0);

  const pick = (p: Person) => {
    onChange(p.id);
    setQuery("");
    setActive(0);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => (i + 1) % Math.max(1, optionCount));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => (i - 1 + optionCount) % Math.max(1, optionCount));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (active < results.length) pick(results[active]);
      else if (allowRegister) setRegistering(true);
    } else if (e.key === "Escape" && query) {
      e.stopPropagation();
      setQuery("");
    }
  };

  if (selected) {
    return (
      <div className="flex items-center gap-3 rounded-inner bg-sunken p-2 pr-3">
        <Avatar src={selected.avatar} name={selected.name} size="md" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-ink">{selected.name}</p>
          <p className="truncate text-xs text-muted">
            <span className="font-mono">{selected.clinicNo}</span>
            {selected.age ? ` · ${selected.age} y` : ""}
            {selected.sex ? ` · ${selected.sex}` : ""}
            {selected.local ? " · registered in this session" : ""}
          </p>
        </div>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            onChange(null);
            requestAnimationFrame(() => inputRef.current?.focus());
          }}
        >
          Change
        </Button>
      </div>
    );
  }

  if (registering) {
    return (
      <RegisterForm
        initialName={query}
        onCancel={() => setRegistering(false)}
        onUseExisting={(p) => {
          setRegistering(false);
          pick(p);
        }}
        onRegister={(input) => {
          const p = registerPatient(input);
          setRegistering(false);
          pick(p);
          toast({ title: `${p.name} registered · ${p.clinicNo}`, description: "Consent recorded. Complete date of birth, address and emergency contact at the desk.", tone: "success" });
        }}
      />
    );
  }

  const activeId = active < results.length ? `${listId}-${results[active]?.id}` : allowRegister ? `${listId}-register` : undefined;

  return (
    <div className="flex flex-col gap-2">
      <div className="relative flex h-10 items-center">
        <MagnifyingGlass size={18} className="pointer-events-none absolute left-4 text-muted" aria-hidden="true" />
        <input
          ref={inputRef}
          id={id}
          role="combobox"
          aria-label={label}
          aria-expanded="true"
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={activeId}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          autoComplete="off"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(0);
          }}
          onKeyDown={onKeyDown}
          placeholder="Search by name, clinic number or phone"
          className="h-full w-full rounded-full bg-surface pl-11 pr-4 text-sm text-ink shadow-[inset_0_0_0_1px_var(--color-line)] outline-none transition-shadow placeholder:text-faint hover:shadow-[inset_0_0_0_1px_var(--color-line-strong)] focus:shadow-[inset_0_0_0_2px_var(--color-primary)] aria-[invalid=true]:shadow-[inset_0_0_0_1.5px_var(--color-danger)]"
        />
      </div>
      <ul id={listId} role="listbox" aria-label="Matching patients" className="flex flex-col gap-1 rounded-inner bg-sunken p-1">
        {results.map((p, i) => (
          <li
            key={p.id}
            id={`${listId}-${p.id}`}
            role="option"
            aria-selected={i === active}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => pick(p)}
            onMouseEnter={() => setActive(i)}
            className={cn("flex cursor-pointer items-center gap-3 rounded-[12px] px-2 py-1.5 transition-colors", i === active ? "bg-surface" : "hover:bg-surface/60")}
          >
            <Avatar src={p.avatar} name={p.name} size="sm" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm text-ink">{p.name}</span>
              <span className="block truncate text-xs text-muted">
                <span className="font-mono">{p.clinicNo}</span>
                {p.age ? ` · ${p.age} y` : ""} · {p.phone}
              </span>
            </span>
            {p.local ? <span className="text-xs text-muted">New</span> : null}
          </li>
        ))}
        {results.length === 0 ? <li className="px-3 py-2 text-sm text-muted">No patient matches “{query}”.</li> : null}
        {allowRegister ? (
          <li
            id={`${listId}-register`}
            role="option"
            aria-selected={active === results.length}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => setRegistering(true)}
            onMouseEnter={() => setActive(results.length)}
            className={cn("flex cursor-pointer items-center gap-3 rounded-[12px] px-2 py-1.5 text-sm transition-colors", active === results.length ? "bg-surface" : "hover:bg-surface/60")}
          >
            <span className="flex size-8 items-center justify-center rounded-full bg-charcoal text-white">
              <UserPlus size={16} aria-hidden="true" />
            </span>
            <span className="text-ink">{query.trim() ? <>Register “{query.trim()}” as a new patient</> : "Register a new patient"}</span>
          </li>
        ) : null}
      </ul>
    </div>
  );
}

function RegisterForm({
  initialName,
  onCancel,
  onRegister,
  onUseExisting,
}: {
  initialName: string;
  onCancel: () => void;
  onRegister: (input: { name: string; phone: string; age: number | null; sex: string | null }) => void;
  onUseExisting: (p: Person) => void;
}) {
  const { allPeople } = useSchedule();
  const { user } = useRole();
  const [name, setName] = useState(initialName.trim());
  const [phone, setPhone] = useState("");
  const [age, setAge] = useState("");
  const [sex, setSex] = useState<string>("");
  const [consent, setConsent] = useState(false);
  const [errors, setErrors] = useState<{ name?: string; phone?: string; age?: string; consent?: string }>({});

  const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();
  // Duplicate check by phone first (spec F2): the registry shows masked numbers ("+91 98•• ••• 214"),
  // so the visible digits are compared. A match is shown before saving and never merged here.
  const digits = phone.replace(/\D/g, "").replace(/^91(?=\d{10}$)/, "");
  const byPhone =
    digits.length === 10
      ? allPeople().find((p) => {
          const m = p.phone.match(/\+91\s*(\d{2})\D+(\d{3})\s*$/);
          return !!m && m[1] === digits.slice(0, 2) && m[2] === digits.slice(7);
        })
      : undefined;
  const byName = name.trim().length > 3 ? allPeople().find((p) => norm(p.name) === norm(name)) : undefined;
  const duplicate = byPhone ?? byName;

  const submit = () => {
    const next: typeof errors = {};
    if (name.trim().split(/\s+/).length < 2) next.name = "Enter first and last name.";
    const digits = phone.replace(/\D/g, "").replace(/^91(?=\d{10}$)/, "");
    if (digits.length !== 10) next.phone = "Enter a 10-digit mobile number.";
    const ageNum = age ? Number(age) : null;
    if (ageNum !== null && (!Number.isInteger(ageNum) || ageNum < 0 || ageNum > 120)) next.age = "Age must be between 0 and 120.";
    if (!consent) next.consent = "Record the patient's consent to create a record.";
    setErrors(next);
    if (Object.keys(next).length) return;
    const masked = `+91 ${digits.slice(0, 2)}•• ••• ${digits.slice(7)}`;
    onRegister({ name: name.trim().replace(/\s+/g, " "), phone: masked, age: ageNum, sex: sex || null });
  };

  return (
    <div className="rounded-inner bg-sunken p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium text-ink">Register a new patient</p>
        <Link href="/patients?new=1" className="text-xs text-ink underline decoration-line-strong underline-offset-4 hover:decoration-ink">
          Full registration form
        </Link>
      </div>
      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Full name" error={errors.name}>
          {(p) => <Input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Ritu Menon" autoComplete="off" {...p} />}
        </Field>
        <Field label="Mobile number" error={errors.phone}>
          {(p) => <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="98765 43210" inputMode="tel" autoComplete="off" {...p} />}
        </Field>
        <Field label="Age" optional error={errors.age}>
          {(p) => <Input value={age} onChange={(e) => setAge(e.target.value.replace(/[^\d]/g, ""))} inputMode="numeric" placeholder="Years" {...p} />}
        </Field>
        <Field label="Sex" optional>
          {({ id }) => (
            <Select
              id={id}
              value={sex}
              onValueChange={setSex}
              placeholder="Not stated"
              options={[
                { value: "Female", label: "Female" },
                { value: "Male", label: "Male" },
                { value: "Other", label: "Other / prefer to self-describe" },
              ]}
            />
          )}
        </Field>
      </div>
      {duplicate ? (
        <div role="status" className="mt-4 flex flex-wrap items-center gap-3 rounded-[12px] bg-warning-soft px-3 py-2 text-sm text-warning">
          <Warning size={18} aria-hidden="true" className="shrink-0" />
          <span className="min-w-0 flex-1">
            Possible existing record{duplicate === byPhone ? " with the same mobile" : ""}: <span className="font-medium">{duplicate.name}</span> (<span className="font-mono">{duplicate.clinicNo}</span>). Admin reviews and merges duplicates — never automatically.
          </span>
          <Button size="sm" variant="secondary" onClick={() => onUseExisting(duplicate)}>
            Use existing record
          </Button>
        </div>
      ) : null}
      <label className="mt-4 flex items-start gap-3 rounded-[12px] bg-surface p-3 text-sm">
        <Checkbox checked={consent} onCheckedChange={(v) => setConsent(v === true)} className="mt-0.5" aria-invalid={errors.consent ? true : undefined} />
        <span className="min-w-0">
          <span className="block text-ink">The patient consents to the clinic keeping this record (DPDP)</span>
          <span className={cn("block text-xs", errors.consent ? "text-danger" : "text-muted")}>{errors.consent ?? `Recorded by ${user.name} today.`}</span>
        </span>
      </label>
      <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
        <Button size="sm" variant="ghost" onClick={onCancel}>
          Back to search
        </Button>
        <Button size="sm" variant="dark" onClick={submit} leading={<UserPlus />}>
          Register &amp; select
        </Button>
      </div>
    </div>
  );
}

"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, ModalContent } from "@/components/ui/dialog";
import { Checkbox, Field, Input, Select } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { DemoNote } from "../ui";
import { TODAY_KEY, addDays } from "../time";
import { SCOPE_LABEL, addCaregiver, removeCaregiver, type Scope } from "./data";

const RELATIONS = ["Parent", "Spouse or partner", "Child", "Sibling", "Friend", "Other"].map((r) => ({ value: r, label: r }));
const DURATIONS = [
  { value: "90", label: "3 months" },
  { value: "180", label: "6 months" },
  { value: "365", label: "1 year" },
  { value: "none", label: "Until I remove it" },
];

type Errors = Partial<Record<"name" | "relation" | "phone" | "scopes" | "agree", string>>;

/** Indian mobile: 10 digits starting 6–9, with or without +91. */
const normalisePhone = (v: string) => v.replace(/[\s-]/g, "").replace(/^(\+91|0091|91(?=\d{10}$))/, "");

/**
 * Give someone scoped access. They only see the parts ticked here; the invite is not sent in
 * the demo and the person is listed as "Invited · not sent".
 */
export function CaregiverModal({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [relation, setRelation] = useState<string | undefined>(undefined);
  const [phone, setPhone] = useState("");
  const [scopes, setScopes] = useState<Scope[]>(["appointments"]);
  const [duration, setDuration] = useState("180");
  const [agree, setAgree] = useState(false);
  const [errors, setErrors] = useState<Errors>({});

  const toggle = (s: Scope, on: boolean) => setScopes((cur) => (on ? [...cur, s] : cur.filter((x) => x !== s)));

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const digits = normalisePhone(phone);
    const next: Errors = {};
    if (name.trim().length < 2) next.name = "Enter their name";
    if (!relation) next.relation = "Choose how you know them";
    if (!/^[6-9]\d{9}$/.test(digits)) next.phone = "Enter a 10-digit Indian mobile number";
    if (!scopes.length) next.scopes = "Choose at least one thing they can see";
    if (!agree) next.agree = "Please confirm you want to share this";
    setErrors(next);
    if (Object.keys(next).length || !relation) return;
    const cg = addCaregiver({
      name: name.trim(),
      relation,
      phone: `+91 ${digits.slice(0, 2)}•• ••• ${digits.slice(7)}`,
      scopes,
      until: duration === "none" ? null : `${addDays(TODAY_KEY, Number(duration))}T23:59:00+05:30`,
    });
    onOpenChange(false);
    toast({
      title: `${cg.name} added · invite not sent`,
      description: "Saved in this browser session. In the live app they confirm it's them before seeing anything.",
      action: { label: "Undo", onClick: () => removeCaregiver(cg.id) },
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <ModalContent
        size="md"
        title="Add someone who helps with your care"
        description="They see and act for you only in the parts you tick. Your consent is recorded, and you can change or remove access at any time."
        footer={
          <>
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button variant="dark" type="submit" form="caregiver-form">
              Add and invite
            </Button>
          </>
        }
      >
        <form id="caregiver-form" onSubmit={submit} noValidate className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Their name" error={errors.name}>
              {(f) => <Input {...f} value={name} maxLength={60} onChange={(e) => setName(e.target.value)} placeholder="For example: Riya Malhotra" />}
            </Field>
            <Field label="Relationship" error={errors.relation}>
              {(f) => <Select id={f.id} aria-invalid={f["aria-invalid"]} aria-describedby={f["aria-describedby"]} value={relation} onValueChange={setRelation} placeholder="Choose" options={RELATIONS} />}
            </Field>
          </div>
          <Field label="Their mobile number" error={errors.phone} hint="They confirm it's them when they first sign in">
            {(f) => <Input {...f} type="tel" inputMode="tel" value={phone} maxLength={16} onChange={(e) => setPhone(e.target.value.replace(/[^\d+\s-]/g, ""))} placeholder="+91 98765 43210" />}
          </Field>

          <fieldset className="flex flex-col gap-2" aria-describedby={errors.scopes ? "cg-scopes-err" : undefined}>
            <legend className="mb-2 text-sm text-ink">What they can see and do</legend>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {(Object.keys(SCOPE_LABEL) as Scope[]).map((s) => (
                <label key={s} className="flex cursor-pointer items-start gap-3 rounded-[12px] bg-sunken p-3 hover:bg-sunken-2">
                  <Checkbox checked={scopes.includes(s)} onCheckedChange={(v) => toggle(s, v === true)} className="mt-0.5" aria-label={SCOPE_LABEL[s].label} />
                  <span className="min-w-0">
                    <span className="block text-sm text-ink">{SCOPE_LABEL[s].label}</span>
                    <span className="block text-xs text-muted">{SCOPE_LABEL[s].detail}</span>
                  </span>
                </label>
              ))}
            </div>
            {errors.scopes ? (
              <p id="cg-scopes-err" className="text-xs text-danger">
                {errors.scopes}
              </p>
            ) : null}
          </fieldset>

          <Field label="Access ends">
            {(f) => <Select id={f.id} value={duration} onValueChange={setDuration} options={DURATIONS} />}
          </Field>

          <label className="flex cursor-pointer items-start gap-3">
            <Checkbox checked={agree} onCheckedChange={(v) => setAgree(v === true)} className="mt-0.5" aria-invalid={errors.agree ? true : undefined} aria-label="I consent to this person seeing and acting for me in these parts of my care" />
            <span className="text-sm text-ink-2">
              I consent to this person seeing and acting for me in these parts of my care.
              {errors.agree ? <span className="mt-1 block text-xs text-danger">{errors.agree}</span> : null}
            </span>
          </label>

          <DemoNote>Demo: nobody is contacted — the invite is listed as “not sent”.</DemoNote>
        </form>
      </ModalContent>
    </Dialog>
  );
}

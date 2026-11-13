"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/misc";
import { useToast } from "@/components/ui/toast";
import { primeFromSignup } from "@/features/onboarding/model";
import { PasswordInput } from "./password-input";
import { PasswordStrength } from "./password-strength";
import { emailError, mobileError, passwordError, passwordStrength, requiredError } from "./validation";
import { focusFirstInvalid } from "./form-bits";

type Key = "name" | "email" | "phone" | "clinic" | "password" | "terms";

/**
 * Create a clinic workspace. No account is created: the details seed the onboarding wizard in
 * this browser session (clinic name, owner) and the toast says exactly that.
 */
export function SignupForm() {
  const router = useRouter();
  const { toast } = useToast();
  const formRef = useRef<HTMLFormElement>(null);
  const timer = useRef<number | null>(null);

  const [values, setValues] = useState({ name: "", email: "", phone: "", clinic: "", password: "" });
  const [terms, setTerms] = useState(false);
  const [touched, setTouched] = useState<Partial<Record<Key, boolean>>>({});
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => () => {
    if (timer.current) window.clearTimeout(timer.current);
  }, []);

  const errors: Record<Key, string | undefined> = {
    name: requiredError(values.name, "Enter your full name."),
    email: emailError(values.email),
    phone: mobileError(values.phone),
    clinic: requiredError(values.clinic, "Enter your clinic's name."),
    password: passwordError(values.password),
    terms: terms ? undefined : "Tick this box to continue.",
  };
  const show = (k: Key) => (submitted || touched[k] ? errors[k] : undefined);
  const set = (k: keyof typeof values) => (e: React.ChangeEvent<HTMLInputElement>) => setValues((v) => ({ ...v, [k]: e.target.value }));
  const blur = (k: Key) => () => setTouched((t) => ({ ...t, [k]: true }));
  const strength = passwordStrength(values.password);

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (saving) return;
    setSubmitted(true);
    if (Object.values(errors).some(Boolean)) {
      focusFirstInvalid(formRef.current);
      return;
    }
    setSaving(true);
    const stored = primeFromSignup({ name: values.name.trim(), email: values.email.trim(), clinicName: values.clinic.trim() });
    timer.current = window.setTimeout(() => {
      router.push("/onboarding");
      toast({
        title: "No account was created",
        description: stored
          ? "Your details are kept in this browser session to start setup. Nothing was sent to a server."
          : "Browser storage is blocked, so setup starts empty. Nothing was sent to a server.",
        tone: stored ? "neutral" : "warning",
      });
    }, 800);
  };

  return (
    <div>
      <PageHeader title="Create your clinic workspace" description="Two minutes here, then you'll set up services, team and hours." />

      <form ref={formRef} noValidate onSubmit={onSubmit} className="mt-8 flex flex-col gap-4" aria-label="Create workspace">
        <Field label="Full name" error={show("name")}>
          {(p) => <Input {...p} name="name" autoComplete="name" value={values.name} onChange={set("name")} onBlur={blur("name")} placeholder="Dr. Ananya Rao" data-testid="signup-name" />}
        </Field>
        <Field label="Work email" error={show("email")}>
          {(p) => (
            <Input {...p} type="email" name="email" autoComplete="email" inputMode="email" value={values.email} onChange={set("email")} onBlur={blur("email")} placeholder="name@clinic.in" data-testid="signup-email" />
          )}
        </Field>
        <Field label="Mobile number" error={show("phone")}>
          {(p) => (
            <div className="relative">
              <span className="pointer-events-none absolute inset-y-0 left-4 flex items-center gap-3 text-sm text-ink-2" aria-hidden="true">
                +91
                <span className="h-4 w-px bg-line-strong" />
              </span>
              <Input
                {...p}
                type="tel"
                name="phone"
                autoComplete="tel-national"
                inputMode="tel"
                value={values.phone}
                onChange={set("phone")}
                onBlur={blur("phone")}
                placeholder="98765 43210"
                aria-label="Mobile number, India (+91)"
                className="pl-[60px] tabular"
                data-testid="signup-phone"
              />
            </div>
          )}
        </Field>
        <Field label="Clinic name" error={show("clinic")}>
          {(p) => <Input {...p} name="organization" autoComplete="organization" value={values.clinic} onChange={set("clinic")} onBlur={blur("clinic")} placeholder="Prana Integrative Clinic" data-testid="signup-clinic" />}
        </Field>
        <Field label="Password" error={show("password")}>
          {(p) => (
            <PasswordInput
              {...p}
              aria-describedby={[p["aria-describedby"], "signup-strength"].filter(Boolean).join(" ")}
              name="new-password"
              autoComplete="new-password"
              value={values.password}
              onChange={set("password")}
              onBlur={blur("password")}
              data-testid="signup-password"
            />
          )}
        </Field>
        <PasswordStrength id="signup-strength" strength={strength} className="-mt-1" />

        <div className="mt-2 flex flex-col gap-2">
          <label htmlFor="signup-terms" className="flex cursor-pointer items-start gap-3 text-sm text-ink-2">
            <Checkbox
              id="signup-terms"
              checked={terms}
              onCheckedChange={(v) => setTerms(v === true)}
              aria-invalid={show("terms") ? true : undefined}
              aria-describedby={show("terms") ? "signup-terms-error" : undefined}
              className="mt-0.5"
              data-testid="signup-terms"
            />
            <span>I understand this is a prototype: no account is created, and I won&apos;t enter real patient data.</span>
          </label>
          {show("terms") ? (
            <p id="signup-terms-error" className="pl-8 text-xs text-danger">
              {show("terms")}
            </p>
          ) : null}
        </div>

        <Button type="submit" variant="primary" size="lg" loading={saving} className="mt-2 w-full" data-testid="signup-submit">
          {saving ? "Saving details…" : "Continue to setup"}
        </Button>
      </form>
    </div>
  );
}

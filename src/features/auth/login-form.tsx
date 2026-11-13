"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { GoogleLogo, UserSwitch, WindowsLogo } from "@phosphor-icons/react";
import type { Role } from "@/data/types";
import { ROLE_ORDER } from "@/data/staff";
import { COOKIE_ROLE, setCookie } from "@/lib/cookies";
import { Button } from "@/components/ui/button";
import { Group, Inset } from "@/components/ui/card";
import { Checkbox, Field, Input } from "@/components/ui/input";
import { Segmented } from "@/components/ui/segmented";
import { Avatar } from "@/components/ui/avatar";
import { useToast } from "@/components/ui/toast";
import { PasswordInput } from "./password-input";
import { DEMO_PASSWORD, demoIdentity } from "./demo-identity";
import { emailError, joinList } from "./validation";
import { AuthDivider, focusFirstInvalid } from "./form-bits";

const REMEMBER_KEY = "cl_remember_email";

type Status = "idle" | "saving";

/**
 * Sign-in. There is no backend: the form validates locally, optionally remembers the email in
 * this browser, sets the demo role cookie when a demo account was picked, then opens the plan
 * chooser — and says plainly that no account was checked.
 */
export function LoginForm() {
  const router = useRouter();
  const { toast } = useToast();
  const formRef = useRef<HTMLFormElement>(null);
  const timer = useRef<number | null>(null);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);
  const [demoRole, setDemoRole] = useState<Role | null>(null);
  const [touched, setTouched] = useState<{ email?: boolean; password?: boolean }>({});
  const [submitted, setSubmitted] = useState(false);
  const [status, setStatus] = useState<Status>("idle");

  // Per-viewer convenience only: a remembered email lives in this browser's storage.
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(REMEMBER_KEY);
      if (saved) {
        setEmail(saved);
        setRemember(true);
      }
    } catch {
      /* storage blocked (private window) — the form simply starts empty */
    }
    return () => {
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, []);

  const errors = {
    email: emailError(email),
    password: password ? undefined : "Enter your password.",
  };
  const show = (k: keyof typeof errors) => (submitted || touched[k] ? errors[k] : undefined);

  const pickDemo = (role: Role) => {
    const id = demoIdentity(role);
    setDemoRole(role);
    setEmail(id.email);
    setPassword(DEMO_PASSWORD);
    setTouched({});
  };

  const sso = (provider: string) =>
    toast({
      title: "Single sign-on isn't connected in this prototype",
      description: `${provider} sign-in needs an identity provider. Use email, or pick a demo account.`,
      tone: "warning",
    });

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (status === "saving") return;
    setSubmitted(true);
    if (errors.email || errors.password) {
      focusFirstInvalid(formRef.current);
      return;
    }
    setStatus("saving");
    try {
      if (remember) window.localStorage.setItem(REMEMBER_KEY, email.trim());
      else window.localStorage.removeItem(REMEMBER_KEY);
    } catch {
      /* not critical: remembering is a convenience */
    }
    if (demoRole) setCookie(COOKIE_ROLE, demoRole);
    timer.current = window.setTimeout(() => {
      router.push("/demo");
      toast({
        title: "Demo sign-in — no account was checked",
        description: demoRole
          ? `Opening as ${demoIdentity(demoRole).label.toLowerCase()}. Choose a plan to continue.`
          : "Any email works in this prototype. Choose a plan to continue.",
      });
    }, 700);
  };

  const identity = demoRole ? demoIdentity(demoRole) : null;

  return (
    <div>
      {/* Sized to fit the whole sign-in, demo accounts included, in one laptop screen. */}
      <h1 className="text-[40px] font-light leading-[1.05] tracking-[-0.028em] text-ink short:text-[32px]">Welcome back</h1>
      <p className="mt-2 text-sm text-muted">Sign in to your clinic workspace.</p>

      <form ref={formRef} noValidate onSubmit={onSubmit} className="mt-6 flex flex-col gap-3 short:mt-4 short:gap-2" aria-label="Sign in">
        <Field label="Email" error={show("email")}>
          {(p) => (
            <Input
              {...p}
              type="email"
              name="email"
              autoComplete="email"
              inputMode="email"
              placeholder="name@clinic.in"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (identity && e.target.value !== identity.email) setDemoRole(null);
              }}
              onBlur={() => setTouched((t) => ({ ...t, email: true }))}
              data-testid="login-email"
            />
          )}
        </Field>
        <Field label="Password" error={show("password")}>
          {(p) => (
            <PasswordInput
              {...p}
              name="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onBlur={() => setTouched((t) => ({ ...t, password: true }))}
              data-testid="login-password"
            />
          )}
        </Field>
        <div className="flex items-center justify-between gap-4">
          <label htmlFor="remember-device" className="flex cursor-pointer items-center gap-2 text-sm text-ink-2">
            <Checkbox id="remember-device" checked={remember} onCheckedChange={(v) => setRemember(v === true)} data-testid="remember-device" />
            Remember this device
          </label>
          <Link href="/forgot-password" className="rounded-full text-sm text-ink underline-offset-4 hover:underline">
            Forgot password?
          </Link>
        </div>
        <Button type="submit" variant="primary" size="lg" loading={status === "saving"} className="mt-1 w-full" data-testid="login-submit">
          {status === "saving" ? "Signing in…" : "Sign in"}
        </Button>
      </form>

      <AuthDivider className="my-4 short:my-3">or continue with</AuthDivider>
      <div className="grid grid-cols-2 gap-2">
        <Button variant="secondary" leading={<GoogleLogo weight="bold" />} aria-label="Continue with Google" onClick={() => sso("Google")} data-testid="sso-google">
          Google
        </Button>
        <Button variant="secondary" leading={<WindowsLogo />} aria-label="Continue with Microsoft" onClick={() => sso("Microsoft")} data-testid="sso-microsoft">
          Microsoft
        </Button>
      </div>

      {/* One compact card: its header row becomes the picked person, so picking never adds height. */}
      <Group className="mt-6 short:mt-4">
        <Inset className="flex flex-col gap-3 p-3 short:gap-2">
          <div className="flex min-h-9 items-center gap-3" aria-live="polite">
            {identity ? (
              <>
                <Avatar src={identity.avatar} name={identity.name} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-ink">{identity.name}</p>
                  <p className="truncate text-xs text-muted">
                    {identity.label} workspace · in {joinList(identity.plans)}
                  </p>
                </div>
              </>
            ) : (
              <>
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-sunken text-ink-2 [&_svg]:size-4" aria-hidden="true">
                  <UserSwitch />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-ink">Demo accounts</p>
                  <p className="truncate text-xs text-muted">Fills the form with a synthetic person</p>
                </div>
              </>
            )}
          </div>
          <Segmented<Role | "none">
            size="sm"
            ariaLabel="Demo account role"
            value={demoRole ?? "none"}
            onChange={(v) => v !== "none" && pickDemo(v)}
            items={ROLE_ORDER.map((r) => ({ value: r, label: demoIdentity(r).label }))}
            className="flex-wrap"
          />
        </Inset>
      </Group>
    </div>
  );
}

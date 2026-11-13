"use client";

import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { ArrowLeft, EnvelopeSimple } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/misc";
import { spring } from "@/lib/motion";
import { emailError } from "./validation";
import { focusFirstInvalid } from "./form-bits";

type Status = "idle" | "saving" | "done";

const swap = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8, transition: { duration: 0.14 } },
  transition: spring,
};

/** Password reset request. The prototype has no mail server, and the success panel says so. */
export function ForgotPasswordForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const doneRef = useRef<HTMLDivElement>(null);
  const timer = useRef<number | null>(null);
  const [email, setEmail] = useState("");
  const [touched, setTouched] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [status, setStatus] = useState<Status>("idle");
  const [requestedFor, setRequestedFor] = useState("");

  useEffect(() => () => {
    if (timer.current) window.clearTimeout(timer.current);
  }, []);

  const error = emailError(email);
  const shown = submitted || touched ? error : undefined;

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (status === "saving") return;
    setSubmitted(true);
    if (error) {
      focusFirstInvalid(formRef.current);
      return;
    }
    setStatus("saving");
    timer.current = window.setTimeout(() => {
      setRequestedFor(email.trim());
      setStatus("done");
    }, 700);
  };

  const reset = () => {
    setStatus("idle");
    setSubmitted(false);
    setTouched(false);
    setEmail("");
  };

  return (
    <AnimatePresence mode="wait" initial={false}>
      {status !== "done" ? (
        <motion.div key="form" {...swap}>
          <PageHeader title="Reset your password" description="Enter the email you sign in with, and we'll show you the next step." />
          <form ref={formRef} noValidate onSubmit={onSubmit} className="mt-8 flex flex-col gap-4" aria-label="Request a password reset">
            <Field label="Email" error={shown}>
              {(p) => (
                <Input
                  {...p}
                  type="email"
                  name="email"
                  autoComplete="email"
                  inputMode="email"
                  placeholder="name@clinic.in"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onBlur={() => setTouched(true)}
                  data-testid="forgot-email"
                />
              )}
            </Field>
            <Button type="submit" variant="primary" size="lg" loading={status === "saving"} className="mt-2 w-full" data-testid="forgot-submit">
              {status === "saving" ? "Requesting…" : "Request reset link"}
            </Button>
          </form>
          <BackToSignIn />
        </motion.div>
      ) : (
        <motion.div
          key="done"
          ref={doneRef}
          {...swap}
          onAnimationComplete={() => {
            const h = doneRef.current?.querySelector("h1");
            if (h && document.activeElement !== h) {
              h.setAttribute("tabindex", "-1");
              h.focus({ preventScroll: true });
            }
          }}
        >
          <span className="flex size-12 items-center justify-center rounded-full bg-surface text-ink shadow-[inset_0_0_0_1px_var(--color-line)]">
            <EnvelopeSimple size={20} aria-hidden="true" />
          </span>
          <PageHeader className="mt-6 [&_h1]:outline-none" title="No email was sent" />
          <div className="mt-4 flex flex-col gap-3 text-sm text-ink-2" role="status">
            <p>
              This prototype has no mail server, so nothing went to <span className="break-words text-ink">{requestedFor}</span>.
            </p>
            <p className="text-muted">In a real deployment, a single-use reset link would be emailed to that address. Your password here is never checked, so you can sign in with any password.</p>
          </div>
          <div className="mt-8 flex flex-wrap gap-2">
            <Button asChild variant="dark" size="lg">
              <Link href="/login" data-testid="forgot-back">
                Back to sign in
              </Link>
            </Button>
            <Button variant="ghost" size="lg" onClick={reset} data-testid="forgot-reset">
              Use a different email
            </Button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function BackToSignIn() {
  return (
    <Link href="/login" className="mt-6 inline-flex items-center gap-2 rounded-full text-sm text-ink-2 hover:text-ink">
      <ArrowLeft size={16} aria-hidden="true" />
      Back to sign in
    </Link>
  );
}

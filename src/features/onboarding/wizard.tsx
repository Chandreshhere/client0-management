"use client";

import { useRouter } from "next/navigation";
import { AnimatePresence, motion, type Variants } from "motion/react";
import { useLenis } from "lenis/react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { ArrowLeft, ArrowRight, CheckCircle, WarningCircle } from "@phosphor-icons/react";
import { planById } from "@/data/plans";
import { Logo } from "@/components/shell/logo";
import { Button } from "@/components/ui/button";
import { DemoFlag, PageHeader, Skeleton } from "@/components/ui/misc";
import { useToast } from "@/components/ui/toast";
import { COOKIE_PLAN, COOKIE_ROLE, setCookie } from "@/lib/cookies";
import { pluralize } from "@/lib/format";
import { spring } from "@/lib/motion";
import { focusFirstInvalid } from "@/features/auth/form-bits";
import { LAST_STEP, STEPS, VALIDATORS, formatDays, freshProgress, loadProgress, saveProgress, seatLimit, type OnboardingData, type Progress } from "./model";
import { MobileProgress, StepRail, type StepState } from "./step-rail";
import { ClinicStep } from "./steps/clinic-step";
import { PlanStep } from "./steps/plan-step";
import { ServicesStep } from "./steps/services-step";
import { TeamStep } from "./steps/team-step";
import { HoursStep } from "./steps/hours-step";
import { ReviewStep } from "./steps/review-step";

const HINTS = ["Name, city, specialities", "Pricing and users", "Consultation types and fees", "Invites and workspaces", "Days, times and lunch", "Check and finish"];

const slide: Variants = {
  enter: (dir: number) => ({ opacity: 0, x: dir * 48 }),
  center: { opacity: 1, x: 0 },
  exit: (dir: number) => ({ opacity: 0, x: dir * -32, transition: { duration: 0.14 } }),
};

/**
 * Multi-step clinic setup. Everything lives in this browser session (sessionStorage); finishing
 * sets the demo plan + role cookies and opens the workspace. Steps slide with springs in the
 * direction of travel (opacity-only under reduced motion via the global MotionConfig).
 */
export function OnboardingWizard() {
  const router = useRouter();
  const lenis = useLenis();
  const { toast } = useToast();
  const [progress, setProgress] = useState<Progress | null>(null);
  const [saved, setSaved] = useState<boolean | null>(null);
  const [dir, setDir] = useState(1);
  const [attempted, setAttempted] = useState<boolean[]>(() => STEPS.map(() => false));
  const [fromReview, setFromReview] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const focusHeading = useRef(false);
  const timer = useRef<number | null>(null);

  // Restore after mount (sessionStorage is client-only); render a skeleton until then.
  useEffect(() => {
    setProgress(loadProgress() ?? freshProgress());
    return () => {
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, []);

  useEffect(() => {
    if (progress) setSaved(saveProgress(progress));
  }, [progress]);

  if (!progress) return <WizardSkeleton />;

  const { step, reached, data } = progress;
  const stepErrors = VALIDATORS.map((v) => v(data));
  const hasErrors = (i: number) => Object.keys(stepErrors[i]).length > 0;
  const plan = planById(data.plan.id);

  const update = (fn: (d: OnboardingData) => OnboardingData) => setProgress((p) => (p ? { ...p, data: fn(p.data) } : p));

  const goTo = (target: number, opts?: { fromReview?: boolean }) => {
    if (target === step) return;
    setDir(target > step ? 1 : -1);
    setFromReview(Boolean(opts?.fromReview));
    focusHeading.current = true;
    setProgress((p) => (p ? { ...p, step: target, reached: Math.max(p.reached, target) } : p));
    if (lenis) lenis.scrollTo(0, { duration: 0.6 });
    else window.scrollTo({ top: 0 });
  };

  const next = () => {
    if (hasErrors(step)) {
      setAttempted((a) => a.map((v, i) => (i === step ? true : v)));
      focusFirstInvalid(panelRef.current);
      return;
    }
    goTo(fromReview ? LAST_STEP : step + 1);
  };

  const finish = () => {
    if (finishing) return;
    const firstBad = stepErrors.findIndex((e) => Object.keys(e).length > 0);
    if (firstBad !== -1) {
      setAttempted((a) => a.map((v, i) => (i === firstBad ? true : v)));
      goTo(firstBad, { fromReview: true });
      toast({ title: `${STEPS[firstBad].label} needs attention`, description: "Fix the highlighted fields, then return to review.", tone: "warning" });
      return;
    }
    setFinishing(true);
    setCookie(COOKIE_PLAN, plan.id);
    setCookie(COOKIE_ROLE, plan.roles[0]);
    timer.current = window.setTimeout(() => {
      router.push("/dashboard");
      toast({
        title: "Workspace set up locally for this demo",
        description: `${plan.name} plan · ${pluralize(data.services.length, "service")}. Nothing was charged, sent or stored on a server.`,
        tone: "success",
      });
    }, 900);
  };

  const saveAndExit = () => {
    const ok = saveProgress(progress);
    router.push("/dashboard");
    toast({
      title: ok ? "Setup saved in this browser session" : "Setup progress couldn't be saved",
      description: ok ? "Open /onboarding again in this tab to pick up where you left off." : "Browser storage is blocked, so progress is lost when you leave.",
      tone: ok ? "neutral" : "warning",
    });
  };

  const states: StepState[] = STEPS.map((_, i) => {
    if (i === step) return "current";
    if (i > reached) return "upcoming";
    if (i === LAST_STEP) return "available";
    return hasErrors(i) ? "attention" : "complete";
  });

  const summaries = STEPS.map((_, i) => {
    if (i > reached) return HINTS[i];
    switch (i) {
      case 0:
        return data.clinic.name.trim() ? [data.clinic.name.trim(), data.clinic.city].filter(Boolean).join(" · ") : HINTS[0];
      case 1:
        return `${plan.name} · ${plan.pricing.kind === "flat" ? "flat fee" : pluralize(data.plan.users, "user")}`;
      case 2:
        return data.services.length ? pluralize(data.services.length, "service") : HINTS[2];
      case 3:
        return plan.pricing.kind === "flat" ? "1 practitioner workspace" : `${1 + data.invites.length} of ${seatLimit(data)} seats`;
      case 4:
        return data.hours.length > 1 ? `${data.hours.length} branches` : `${formatDays(data.hours[0].days)} · ${data.hours[0].open}–${data.hours[0].close}`;
      default:
        return HINTS[i];
    }
  });

  const shown = attempted[step] ? stepErrors[step] : {};
  const props = { data, update, errors: shown, goTo };
  const body: Record<number, ReactNode> = {
    0: <ClinicStep {...props} />,
    1: <PlanStep {...props} />,
    2: <ServicesStep {...props} />,
    3: <TeamStep {...props} />,
    4: <HoursStep {...props} />,
    5: <ReviewStep {...props} stepErrors={stepErrors} />,
  };

  const saveNote =
    saved === false ? (
      <span className="inline-flex items-center gap-1.5 text-warning">
        <WarningCircle size={14} aria-hidden="true" />
        Not saved — browser storage is off
      </span>
    ) : (
      <span className="inline-flex items-center gap-1.5">
        <CheckCircle size={14} aria-hidden="true" />
        Saved in this browser session
      </span>
    );

  return (
    <div className="min-h-dvh">
      <header className="mx-auto flex h-[72px] max-w-[1280px] items-center justify-between gap-4 px-4 sm:px-6">
        <Logo href="/" />
        <div className="flex items-center gap-3">
          <DemoFlag className="hidden sm:inline-flex" />
          <Button variant="secondary" onClick={saveAndExit} data-testid="save-exit">
            Save &amp; exit
          </Button>
        </div>
      </header>

      <main id="main" className="mx-auto grid max-w-[1280px] gap-6 px-4 pb-16 pt-2 sm:px-6 lg:grid-cols-[288px_minmax(0,1fr)] lg:gap-8 lg:pt-6">
        <aside className="hidden lg:block">
          <div className="sticky top-6">
            <StepRail step={step} reached={reached} states={states} summaries={summaries} onSelect={(i) => goTo(i)} footer={saveNote} />
          </div>
        </aside>
        <MobileProgress step={step} states={states} />

        <div ref={panelRef} className="min-w-0">
          <AnimatePresence mode="wait" initial={false} custom={dir}>
            <motion.section key={step} custom={dir} variants={slide} initial="enter" animate="center" exit="exit" transition={spring} aria-label={STEPS[step].title}>
              <StepHeader index={step} focusRef={focusHeading} fromReview={fromReview} />
              <div className="mt-8">{body[step]}</div>
            </motion.section>
          </AnimatePresence>

          <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
            {step > 0 ? (
              <Button variant="ghost" size="lg" leading={<ArrowLeft />} onClick={() => goTo(step - 1)} className="w-full sm:w-auto" data-testid="wizard-back">
                Back
              </Button>
            ) : (
              <span className="hidden sm:block" />
            )}
            <div className="flex flex-col-reverse items-stretch gap-3 sm:flex-row sm:items-center">
              <span className="text-center text-xs text-muted lg:hidden">{saveNote}</span>
              {step < LAST_STEP ? (
                <Button variant="dark" size="lg" trailing={<ArrowRight />} onClick={next} className="w-full sm:w-auto" data-testid="wizard-next">
                  {fromReview ? "Save and review" : `Continue to ${STEPS[step + 1].label.toLowerCase()}`}
                </Button>
              ) : (
                <Button variant="primary" size="lg" loading={finishing} onClick={finish} className="w-full sm:w-auto" data-testid="finish-setup">
                  {finishing ? "Setting up…" : "Finish setup"}
                </Button>
              )}
            </div>
          </div>
          {step === LAST_STEP ? (
            <p className="mt-4 text-xs text-muted sm:text-right">Finishing saves this setup in this browser and opens your workspace. Nothing is charged, sent or created on a server.</p>
          ) : null}
        </div>
      </main>
    </div>
  );
}

/** Page title for the step (the page's single h1). Focus moves here after navigating steps. */
function StepHeader({ index, focusRef, fromReview }: { index: number; focusRef: { current: boolean }; fromReview: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!focusRef.current) return;
    focusRef.current = false;
    const h = ref.current?.querySelector("h1");
    if (h) {
      h.setAttribute("tabindex", "-1");
      h.focus({ preventScroll: true });
    }
  }, [focusRef]);
  const s = STEPS[index];
  return (
    // the heading is a programmatic focus target (tabindex -1), not a control: no focus ring
    <div ref={ref} className="[&_h1]:outline-none">
      <PageHeader eyebrow={fromReview && index < LAST_STEP ? `Editing from review · step ${index + 1} of ${STEPS.length}` : `Step ${index + 1} of ${STEPS.length}`} title={s.title} description={s.description} />
    </div>
  );
}

function WizardSkeleton() {
  return (
    <div className="min-h-dvh" aria-busy="true" aria-label="Loading setup">
      <div className="mx-auto flex h-[72px] max-w-[1280px] items-center justify-between px-4 sm:px-6">
        <Logo href="/" />
        <Skeleton className="h-10 w-28 rounded-full" />
      </div>
      <div className="mx-auto grid max-w-[1280px] gap-8 px-4 pt-6 sm:px-6 lg:grid-cols-[288px_minmax(0,1fr)]">
        <Skeleton className="hidden h-[480px] rounded-card lg:block" />
        <div className="flex max-w-[880px] flex-col gap-4">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-12 w-80 max-w-full" />
          <Skeleton className="mt-6 h-[320px] rounded-card" />
        </div>
      </div>
    </div>
  );
}

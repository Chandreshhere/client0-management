"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { LayoutGroup, motion } from "motion/react";
import { ArrowCounterClockwise, ArrowLeft, CaretDown, Check, CheckCircle, CircleNotch, Eye, LockSimple, PaperPlaneTilt, Stack, Warning } from "@phosphor-icons/react";
import { PLAN_STATUS_LABEL } from "@/data/programs";
import { patientById } from "@/data/patients";
import { DEMO_USER, staffById } from "@/data/staff";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/cn";
import { snappy } from "@/lib/motion";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Dialog, ModalContent } from "@/components/ui/dialog";
import { Dropdown, DropdownContent, DropdownItem, DropdownLabel, DropdownRadioGroup, DropdownRadioItem, DropdownSeparator, DropdownTrigger } from "@/components/ui/dropdown";
import { IconButton } from "@/components/ui/icon-button";
import { Field, Textarea } from "@/components/ui/input";
import { EmptyState, PageHeader } from "@/components/ui/misc";
import { Segmented } from "@/components/ui/segmented";
import { StatusBadge } from "@/components/ui/status";
import { useToast } from "@/components/ui/toast";
import { useRole } from "@/components/shell/role-context";
import { SectionLabel } from "@/components/viz/cards";
import { GUIDANCE, ROUTINES, SLOTS, SLOT_LABEL, TEMPLATES, type FoodLog, type SlotId, type TemplateDef } from "./data";
import { PLAN_TONE, altFromFood, diffSlots, followedVersion, itemFromFood, kcal, newId, nowIso, totals, type PlanItem, type PlanRecord } from "./model";
import { planActions, useNutrition } from "./store";
import { FoodPicker, type PickerTarget } from "./food-picker";
import { MealSlot } from "./meal-slot";
import { GuidanceCard, RoutinePanel, VersionHistory } from "./builder-rail";
import { LogsTile, MacroTiles, PlanOrganCard } from "./viz";

/**
 * /nutrition/builder — structured meal-plan builder (doc §2C): meal slots with household portions,
 * reviewed alternatives, routine-aware timings, doctor-guidance acknowledgement, live totals,
 * version history and the Draft → In review → Published flow. Everything stays in this session.
 */
export function MealPlanBuilder({ planId }: { planId: string }) {
  const state = useNutrition();
  const plan = state.plans[planId];
  const plans = useMemo(() => state.order.map((id) => state.plans[id]).filter(Boolean), [state.order, state.plans]);
  const logs = useMemo(() => Object.values(state.logs), [state.logs]);
  if (!plan) {
    return (
      <EmptyState
        className="min-h-[60vh]"
        icon={<Stack />}
        title="This plan isn't in this session"
        description="Plans created in the demo live only in this browser session. Pick a plan from the list to keep working."
        action={<Button asChild variant="dark"><Link href="/nutrition">All plans</Link></Button>}
      />
    );
  }
  return <Builder key={plan.id} plan={plan} plans={plans} logs={logs} />;
}

type SaveState = "idle" | "saving" | "saved";

function Builder({ plan, plans, logs }: { plan: PlanRecord; plans: PlanRecord[]; logs: FoodLog[] }) {
  const router = useRouter();
  const { toast } = useToast();
  const { role, user, has } = useRole();
  const patient = patientById(plan.patientId);
  const routine = ROUTINES[plan.patientId];
  const guidance = GUIDANCE[plan.patientId];
  const doctor = guidance ? staffById(guidance.by) : undefined;
  const first = patient?.name.split(" ")[0] ?? "the patient";

  const isNutritionist = role === "nutritionist";
  const canEdit = isNutritionist && (plan.status === "draft" || plan.status === "in-review");

  const [dayType, setDayType] = useState<"home" | "office">("home");
  const [picker, setPicker] = useState<PickerTarget | null>(null);
  const [autoEditId, setAutoEditId] = useState<string | null>(null);
  const [publishOpen, setPublishOpen] = useState(false);
  const [templateAsk, setTemplateAsk] = useState<TemplateDef | null>(null);
  const [save, setSave] = useState<SaveState>("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const touch = () => {
    setSave("saving");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setSave("saved"), 450);
  };

  const mutateSlot = (slot: SlotId, fn: (items: PlanItem[]) => PlanItem[]) => {
    planActions.updateSlots(plan.id, (s) => ({ ...s, [slot]: fn(s[slot]) }), nowIso());
    touch();
  };

  const sum = useMemo(() => totals(plan.slots), [plan.slots]);
  const targets = guidance?.targets ?? { kcal: plan.calories, protein: 60, fibre: 25 };
  const sessionChanges = useMemo(() => diffSlots(plan.baseline, plan.slots), [plan.baseline, plan.slots]);
  const currentEntry = plan.history.find((v) => v.version === plan.version);
  const follows = followedVersion(plan);

  const acked = !guidance || plan.ack?.guidanceVersion === guidance.version;
  const pendingSlots = plan.templateReview ? SLOTS.filter((s) => !plan.templateReview?.[s.id]) : [];
  const allItems = SLOTS.flatMap((s) => plan.slots[s.id]);
  const missingValues = allItems.filter((i) => i.kcal <= 0);

  const blockers: { id: string; text: string; href?: string }[] = [];
  if (!acked && guidance) blockers.push({ id: "ack", text: `Acknowledge ${doctor?.name ?? "the doctor"}'s guidance ${guidance.version}`, href: "#doctor-guidance" });
  if (pendingSlots.length) blockers.push({ id: "tpl", text: `Review ${pendingSlots.length} template slot${pendingSlots.length === 1 ? "" : "s"} for ${first}` });
  if (missingValues.length) blockers.push({ id: "vals", text: `Enter values for ${missingValues.length} custom item${missingValues.length === 1 ? "" : "s"}` });
  if (allItems.length === 0) blockers.push({ id: "empty", text: "Add at least one food" });

  const removeItem = (slot: SlotId, item: PlanItem, index: number) => {
    mutateSlot(slot, (items) => items.filter((i) => i.id !== item.id));
    toast({
      title: `Removed ${item.name}`,
      description: `${SLOT_LABEL[slot]} · saved in this browser session`,
      action: {
        label: "Undo",
        onClick: () =>
          mutateSlot(slot, (items) => {
            const next = [...items];
            next.splice(Math.min(index, next.length), 0, item);
            return next;
          }),
      },
    });
  };

  const applyTemplate = (t: TemplateDef) => {
    const prevSlots = plan.slots;
    const prevReview = plan.templateReview;
    planActions.applyTemplate(plan.id, t.id);
    setTemplateAsk(null);
    touch();
    toast({
      title: `Started from “${t.name}”`,
      description: `All six slots now need individual review for ${first} before publishing.`,
      tone: "warning",
      action: { label: "Undo", onClick: () => planActions.restore(plan.id, prevSlots, prevReview) },
    });
  };

  const actions: ReactNode = !isNutritionist ? (
    <StatusBadge tone="neutral" dot={false}>
      <Eye size={14} aria-hidden="true" /> View only
    </StatusBadge>
  ) : plan.status === "draft" ? (
    <Button
      variant="dark"
      leading={<PaperPlaneTilt />}
      onClick={() => {
        planActions.submitForReview(plan.id, user.id, nowIso());
        toast({ title: `v${plan.version} moved to In review`, description: "Saved in this browser session." });
      }}
    >
      Submit for review
    </Button>
  ) : plan.status === "in-review" ? (
    <>
      <Button
        variant="ghost"
        leading={<ArrowCounterClockwise />}
        onClick={() => {
          planActions.returnToDraft(plan.id, user.id, nowIso());
          toast({ title: `v${plan.version} returned to Draft`, description: "Saved in this browser session." });
        }}
      >
        Return to draft
      </Button>
      <Button variant="primary" leading={<CheckCircle />} disabled={blockers.length > 0} onClick={() => setPublishOpen(true)}>
        Publish v{plan.version}
      </Button>
    </>
  ) : (
    <Button
      variant="dark"
      onClick={() => {
        planActions.newVersion(plan.id, user.id, nowIso());
        toast({ title: `v${plan.version + 1} draft started`, description: follows ? `${first} keeps following v${follows} until you publish.` : "Saved in this browser session." });
      }}
    >
      Start v{plan.version + 1}
    </Button>
  );

  return (
    <div className="@container flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <IconButton asChild label="All nutrition plans" tooltip="bottom">
            <Link href="/nutrition">
              <ArrowLeft />
            </Link>
          </IconButton>
          <PatientSwitcher plan={plan} plans={plans} onSwitch={(id) => router.push(`/nutrition/builder?plan=${id}`)} />
        </div>
        <div className="flex items-center gap-2">
          <SaveIndicator state={save} canEdit={canEdit} />
          <Dropdown>
            <DropdownTrigger asChild>
              <Button variant="secondary" leading={<Stack />} trailing={<CaretDown size={14} />} disabled={!canEdit}>
                <span className="hidden sm:inline">Start from template</span>
                <span className="sm:hidden">Template</span>
              </Button>
            </DropdownTrigger>
            <DropdownContent className="w-[320px]">
              <DropdownLabel>Reusable templates — every slot then needs individual review</DropdownLabel>
              {TEMPLATES.map((t) => (
                <DropdownItem key={t.id} description={`${t.preference} · ${t.description}`} onSelect={() => setTemplateAsk(t)}>
                  {t.name}
                </DropdownItem>
              ))}
            </DropdownContent>
          </Dropdown>
        </div>
      </div>

      <PageHeader
        eyebrow={
          <span className="flex flex-wrap items-center gap-2">
            Meal plan builder
            <span className="font-mono text-xs text-ink-2">v{plan.version}</span>
            <StatusBadge tone={PLAN_TONE[plan.status]}>{PLAN_STATUS_LABEL[plan.status]}</StatusBadge>
          </span>
        }
        title={plan.title}
        description={`For ${patient?.name ?? "patient"} · ${plan.preference} · ${kcal(targets.kcal)} kcal target${doctor ? ` from ${doctor.name}'s guidance` : ""}. ${follows ? `${first} currently follows v${follows}.` : `${first} has no published plan yet.`}`}
      />

      <div className="flex flex-col gap-2">
        <StatusFlow status={plan.status} actions={actions} />
        {isNutritionist && plan.status === "in-review" && blockers.length ? (
          <div role="status" className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-inner bg-warning-soft px-4 py-3 text-sm text-warning">
            <Warning size={16} className="shrink-0" aria-hidden="true" />
            <span>To publish:</span>
            {blockers.map((b, i) => (
              <span key={b.id} className="text-ink">
                {b.href ? (
                  <a href={b.href} className="underline decoration-warning/40 underline-offset-4 hover:decoration-warning">{b.text}</a>
                ) : (
                  b.text
                )}
                {i < blockers.length - 1 ? <span className="text-warning"> ·</span> : null}
              </span>
            ))}
          </div>
        ) : null}
        <ReadOnlyNote plan={plan} isNutritionist={isNutritionist} first={first} follows={follows} />
      </div>

      <div className="grid grid-cols-1 gap-6 @[1040px]:grid-cols-[minmax(0,1fr)_minmax(320px,360px)]">
        <div className="flex min-w-0 flex-col gap-4">
          <section aria-label="Plan day against targets">
            <SectionLabel actions={<span className="text-xs text-muted tabular">{sum.items} items · 6 slots</span>}>Day vs targets</SectionLabel>
            <div className="scrollbar-none -mx-4 flex snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto px-4 @[640px]:mx-0 @[640px]:grid @[640px]:grid-cols-3 @[640px]:overflow-visible @[640px]:px-0">
              <MacroTiles slots={plan.slots} targets={targets} tileClassName="w-[78%] shrink-0 snap-start @[640px]:w-auto" />
            </div>
            <p className="mt-2 text-xs text-muted">
              Targets from {doctor ? `${doctor.name}'s guidance ${guidance?.version}` : "the plan"} · bars show each meal slot (EM early morning → D dinner) · synthetic reference values per household portion.
            </p>
          </section>
          <div className="flex flex-wrap items-center justify-between gap-3">
            {routine?.officeDays ? (
              <Segmented
                ariaLabel="Day type"
                size="sm"
                variant="tray"
                value={dayType}
                onChange={setDayType}
                items={[
                  { value: "home", label: "Home day" },
                  { value: "office", label: `Office day · ${routine.officeDays}` },
                ]}
              />
            ) : (
              <span className="text-sm text-muted">Same timings every day</span>
            )}
            <p className="text-sm text-muted">Timings follow {first}&apos;s {dayType === "office" ? "office" : "home"} days</p>
          </div>

          {SLOTS.map((s) => (
            <MealSlot
              key={s.id}
              slot={{ id: s.id, label: s.label, time: dayType === "office" ? s.office : s.home, packed: dayType === "office" && s.packable }}
              items={plan.slots[s.id]}
              editable={canEdit}
              pendingReview={!!plan.templateReview && !plan.templateReview[s.id]}
              patientFirstName={first}
              autoEditId={autoEditId}
              onAutoEditDone={() => setAutoEditId(null)}
              onAdd={() => setPicker({ slot: s.id, mode: "item" })}
              onAddAlternative={(item) => setPicker({ slot: s.id, mode: "alternative", itemId: item.id, itemName: item.name })}
              onChange={(next) => mutateSlot(s.id, (items) => items.map((i) => (i.id === next.id ? next : i)))}
              onRemove={(item, index) => removeItem(s.id, item, index)}
              onMarkReviewed={() => {
                planActions.markSlotReviewed(plan.id, s.id);
                touch();
              }}
            />
          ))}
        </div>

        <aside aria-label="Plan context" className="flex min-w-0 flex-col gap-4">
          <PlanOrganCard patientId={plan.patientId} header={<p className="mb-2 text-sm text-ink">What this plan addresses</p>} />
          <LogsTile logs={logs} patientId={plan.patientId} />
          {patient ? <RoutinePanel patient={patient} routine={routine} /> : null}
          <GuidanceCard
            guidance={guidance}
            plan={plan}
            editable={canEdit}
            onAck={(checked) => {
              if (!guidance) return;
              if (checked) planActions.acknowledge(plan.id, guidance.version, user.id, nowIso());
              else planActions.clearAck(plan.id);
              touch();
            }}
          />
          <VersionHistory plan={plan} sessionChanges={sessionChanges} />
        </aside>
      </div>

      <FoodPicker
        target={picker}
        preference={plan.preference}
        onClose={() => setPicker(null)}
        onPickFood={(food, reason) => {
          if (!picker) return;
          if (picker.mode === "item") {
            mutateSlot(picker.slot, (items) => [...items, itemFromFood(food, newId("item"))]);
          } else {
            const target = picker;
            mutateSlot(target.slot, (items) =>
              items.map((i) => (i.id === target.itemId ? { ...i, alternatives: [...i.alternatives, altFromFood(food, newId("alt"), reason, "")] } : i)),
            );
          }
          setPicker(null);
        }}
        onPickCustom={(name) => {
          if (!picker) return;
          const id = newId("item");
          mutateSlot(picker.slot, (items) => [...items, { id, foodId: null, name, portion: "1 portion", kcal: 0, protein: 0, fibre: 0, note: "", alternatives: [] }]);
          setAutoEditId(id);
          setPicker(null);
        }}
      />

      <Dialog open={!!templateAsk} onOpenChange={(o) => !o && setTemplateAsk(null)}>
        {templateAsk ? (
          <ModalContent
            size="sm"
            title={`Start from “${templateAsk.name}”?`}
            description={`This replaces all six slots of v${plan.version}. Each slot is then marked for individual review — a template is never published as-is.`}
            footer={
              <>
                <Button variant="ghost" onClick={() => setTemplateAsk(null)}>Cancel</Button>
                <Button variant="dark" onClick={() => applyTemplate(templateAsk)}>Replace slots</Button>
              </>
            }
          >
            <p className="text-sm text-ink-2">
              {templateAsk.description}. Suits: {templateAsk.preference}.
              {templateAsk.preference !== plan.preference ? (
                <span className="mt-3 flex items-start gap-2 rounded-inner bg-warning-soft p-3 text-xs text-warning">
                  <Warning size={14} className="mt-px shrink-0" aria-hidden="true" />
                  {first}&apos;s recorded preference is {plan.preference}. Check every item after applying.
                </span>
              ) : null}
            </p>
          </ModalContent>
        ) : null}
      </Dialog>

      <PublishDialog
        open={publishOpen}
        onOpenChange={setPublishOpen}
        plan={plan}
        patientName={patient?.name ?? "the patient"}
        first={first}
        follows={follows}
        changes={[...(currentEntry?.changes ?? []), ...sessionChanges]}
        defaultWhy={currentEntry?.why ?? ""}
        hasPortal={has("portal")}
        onPublish={(why) => {
          planActions.publish(plan.id, user.id, nowIso(), why, [...(currentEntry?.changes ?? []), ...sessionChanges]);
          setPublishOpen(false);
          toast({
            title: "Published in this demo session",
            description: `${first} now follows v${plan.version}. Nothing was sent to the patient — this prototype has no backend.`,
            tone: "success",
          });
        }}
      />
    </div>
  );
}

function PatientSwitcher({ plan, plans, onSwitch }: { plan: PlanRecord; plans: PlanRecord[]; onSwitch: (id: string) => void }) {
  const patient = patientById(plan.patientId);
  return (
    <Dropdown>
      <DropdownTrigger asChild>
        <button
          type="button"
          aria-label={`Patient: ${patient?.name}. Switch patient`}
          className="flex min-w-0 items-center gap-3 rounded-full bg-sunken py-1 pl-1 pr-4 text-left transition-colors hover:bg-sunken-2 data-[state=open]:bg-sunken-2"
        >
          <Avatar src={patient?.avatar} name={patient?.name ?? "Patient"} size="md" />
          <span className="min-w-0">
            <span className="block truncate text-sm text-ink">{patient?.name}</span>
            <span className="block max-w-[44vw] truncate text-xs text-muted sm:max-w-[320px]">{patient?.age} · {patient?.primaryConcern}</span>
          </span>
          <CaretDown size={16} className="shrink-0 text-muted" aria-hidden="true" />
        </button>
      </DropdownTrigger>
      <DropdownContent align="start" className="w-[340px]">
        <DropdownLabel>Switch patient · edits stay in this session</DropdownLabel>
        <DropdownRadioGroup value={plan.id} onValueChange={onSwitch}>
          {plans.map((p) => (
            <DropdownRadioItem key={p.id} value={p.id} description={`${p.title} · v${p.version} · ${PLAN_STATUS_LABEL[p.status]}`}>
              {patientById(p.patientId)?.name ?? "Patient"}
            </DropdownRadioItem>
          ))}
        </DropdownRadioGroup>
        <DropdownSeparator />
        <DropdownItem asChild icon={<ArrowLeft />}>
          <Link href="/nutrition">All plans</Link>
        </DropdownItem>
      </DropdownContent>
    </Dropdown>
  );
}

function SaveIndicator({ state, canEdit }: { state: SaveState; canEdit: boolean }) {
  if (!canEdit) {
    return (
      <span className="hidden items-center gap-1.5 text-xs text-muted sm:flex">
        <LockSimple size={14} aria-hidden="true" /> Locked
      </span>
    );
  }
  return (
    <span className="hidden items-center gap-1.5 text-xs text-muted sm:flex" aria-live="polite">
      {state === "saving" ? (
        <>
          <CircleNotch size={14} className="animate-spin" aria-hidden="true" /> Saving…
        </>
      ) : state === "saved" ? (
        <>
          <Check size={14} className="text-success" aria-hidden="true" /> Saved in this browser session
        </>
      ) : (
        "Draft · changes save in this browser session"
      )}
    </span>
  );
}

const STEPS = [
  { id: "draft", label: "Draft" },
  { id: "in-review", label: "In review" },
  { id: "published", label: "Published" },
] as const;

function StatusFlow({ status, actions }: { status: PlanRecord["status"]; actions: ReactNode }) {
  const idx = status === "superseded" ? 3 : STEPS.findIndex((s) => s.id === status);
  return (
    <div className="flex flex-col gap-2 rounded-card bg-surface p-2 sm:flex-row sm:items-center sm:justify-between">
      <LayoutGroup id="plan-status-flow">
        <ol aria-label="Plan status" className="scrollbar-none flex items-center gap-1 overflow-x-auto">
          {STEPS.map((s, i) => {
            const active = i === idx;
            const done = i < idx;
            return (
              <li key={s.id} className="flex shrink-0 items-center gap-1">
                {i > 0 ? <span className={cn("h-px w-3 sm:w-8", done || active ? "bg-charcoal" : "bg-line-strong")} aria-hidden="true" /> : null}
                <span
                  aria-current={active ? "step" : undefined}
                  className={cn(
                    "relative inline-flex h-10 items-center rounded-full px-3 text-sm transition-colors duration-200 sm:px-4",
                    active ? "text-white" : done ? "text-ink" : "text-muted shadow-[inset_0_0_0_1px_var(--color-line)]",
                  )}
                >
                  {active ? <motion.span layoutId="plan-status-pill" transition={snappy} className="absolute inset-0 rounded-full bg-charcoal" /> : null}
                  <span className="relative z-[1] flex items-center gap-2">
                    {done || (active && s.id === "published") ? <Check size={16} aria-hidden="true" /> : <span className="hidden font-mono text-[11px] opacity-70 sm:inline">{i + 1}</span>}
                    {s.label}
                    {done ? <span className="sr-only">(done)</span> : null}
                  </span>
                </span>
              </li>
            );
          })}
          {status === "superseded" ? (
            <li className="flex shrink-0 items-center gap-1">
              <span className="h-px w-3 bg-charcoal sm:w-8" aria-hidden="true" />
              <span aria-current="step" className="inline-flex h-10 items-center rounded-full bg-sunken px-4 text-sm text-ink-2">Superseded</span>
            </li>
          ) : null}
        </ol>
      </LayoutGroup>
      <div className="flex flex-wrap items-center gap-2 px-2 pb-1 sm:justify-end sm:p-0 sm:pr-1">{actions}</div>
    </div>
  );
}

function ReadOnlyNote({ plan, isNutritionist, first, follows }: { plan: PlanRecord; isNutritionist: boolean; first: string; follows: number | null }) {
  let text: string | null = null;
  if (!isNutritionist) text = `View only — meal plans are edited and published by nutritionists. Switch the demo role to Nutritionist (${staffById(DEMO_USER.nutritionist.personId)?.name}) to edit.`;
  else if (plan.status === "published") text = `v${plan.version} is published and locked. Start v${plan.version + 1} to make changes — ${first} keeps following v${follows ?? plan.version} until the new version is published.`;
  else if (plan.status === "superseded") text = `Superseded on ${formatDate(plan.updatedAt, { day: "numeric", month: "short" })}. Start a new version if ${first} needs a current plan in Carelane.`;
  if (!text) return null;
  return (
    <p className="flex items-start gap-2 rounded-inner bg-sunken px-4 py-3 text-sm text-ink-2">
      <LockSimple size={16} className="mt-0.5 shrink-0 text-muted" aria-hidden="true" />
      {text}
    </p>
  );
}

function PublishDialog({
  open,
  onOpenChange,
  plan,
  patientName,
  first,
  follows,
  changes,
  defaultWhy,
  hasPortal,
  onPublish,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  plan: PlanRecord;
  patientName: string;
  first: string;
  follows: number | null;
  changes: string[];
  defaultWhy: string;
  hasPortal: boolean;
  onPublish: (why: string) => void;
}) {
  const [why, setWhy] = useState(defaultWhy);
  const [tried, setTried] = useState(false);
  const error = tried && !why.trim() ? "Say why this version changed — it is shown in the version history." : null;
  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v);
        if (v) {
          setWhy(defaultWhy);
          setTried(false);
        }
      }}
    >
      <ModalContent
        title={`Publish v${plan.version} for ${patientName}?`}
        description={follows ? `v${follows} becomes superseded and ${first} follows v${plan.version} from today.` : `This becomes the first version ${first} can see.`}
        footer={
          <>
            <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button
              variant="primary"
              leading={<CheckCircle />}
              onClick={() => {
                setTried(true);
                if (!why.trim()) return;
                onPublish(why.trim());
              }}
            >
              Publish v{plan.version}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <Field label="Why this version" error={error}>
            {(a) => <Textarea {...a} value={why} onChange={(e) => setWhy(e.target.value)} rows={3} />}
          </Field>
          <div>
            <p className="text-sm text-ink">What changed</p>
            {changes.length ? (
              <ul className="mt-2 flex flex-col gap-1 rounded-inner bg-canvas p-4">
                {changes.map((c) => (
                  <li key={c} className="flex gap-2 text-sm text-ink-2">
                    <span className={cn("w-3 shrink-0 text-center font-mono", c.startsWith("+") ? "text-success" : c.startsWith("−") ? "text-danger" : "text-muted")}>{c[0]}</span>
                    {c.slice(2)}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-muted">No item changes recorded for this version.</p>
            )}
          </div>
          <p className="flex items-start gap-2 rounded-inner bg-warning-soft p-4 text-xs text-warning">
            <Warning size={16} className="mt-px shrink-0" aria-hidden="true" />
            {hasPortal
              ? "In a live system the patient app would show this version. In this prototype nothing is sent — publishing is recorded in this browser session only."
              : "The patient portal is a Clinic-plan feature, so share the printed plan in clinic. In this prototype nothing is sent — publishing is recorded in this browser session only."}
          </p>
        </div>
      </ModalContent>
    </Dialog>
  );
}

"use client";

import { AnimatePresence, motion } from "motion/react";
import { useId, useState } from "react";
import { Bell, ChatCircleDots, CheckCircle, FloppyDisk, ShieldCheck, Translate, UserPlus, UsersThree, X } from "@phosphor-icons/react";
import { cn } from "@/lib/cn";
import { spring } from "@/lib/motion";
import { formatTime, pluralize } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Dialog, ModalContent } from "@/components/ui/dialog";
import { Field, Input, Select, Switch } from "@/components/ui/input";
import { Segmented } from "@/components/ui/segmented";
import { StatusBadge } from "@/components/ui/status";
import { useToast } from "@/components/ui/toast";
import { ChipGroup } from "@/components/viz/cards";
import { DemoNote, Panel, PortalHeader, Reveal } from "../ui";
import { usePortalStore } from "../store";
import { ME } from "../record";
import { UPCOMING } from "../appointments/data";
import { NOW_MS, dayLabel, istIso, istMinutes, longDate, addDays } from "../time";
import {
  CHANNEL_LABEL,
  CONSENT_INFO,
  LANGUAGES,
  LEAD_LABEL,
  LEAD_MIN,
  SCOPE_LABEL,
  TOPICS,
  prefsStore,
  removeCaregiver,
  restoreCaregiver,
  savePrefs,
  type Caregiver,
  type Channel,
  type ConsentId,
  type Lead,
  type Prefs,
} from "./data";
import { CaregiverModal } from "./caregiver-modal";

const same = (a: Prefs, b: Prefs) => JSON.stringify(a) === JSON.stringify(b);
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/**
 * /portal/preferences — communication channels per topic, reminder timing (previewed on the
 * patient's real upcoming visits), language, consents with dates and scoped caregiver access.
 * "Save changes" stores everything in this browser session (Saved locally).
 */
export function PreferencesView() {
  const { toast } = useToast();
  const state = usePortalStore(prefsStore);
  const [draft, setDraft] = useState<Prefs | null>(null);
  const prefs = draft ?? state.saved;
  const dirty = draft !== null && !same(draft, state.saved);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [caregiverOpen, setCaregiverOpen] = useState({ open: false, nonce: 0 });
  const [confirm, setConfirm] = useState<{ kind: "consent"; id: ConsentId } | { kind: "caregiver"; cg: Caregiver } | null>(null);

  const change = (fn: (p: Prefs) => Prefs) => setDraft((d) => fn(d ?? state.saved));
  const emailOk = !prefs.email || EMAIL_RE.test(prefs.email);

  const save = () => {
    if (!emailOk) {
      setEmailError("Check the email address — or leave it empty");
      return;
    }
    if (!draft) return;
    // channels that need an email are dropped if the address was cleared
    const clean: Prefs = prefs.email ? draft : { ...draft, channels: Object.fromEntries(Object.entries(draft.channels).map(([k, v]) => [k, v.filter((c) => c !== "email")])) as Prefs["channels"] };
    savePrefs(clean);
    setDraft(null);
    toast({ tone: "success", title: "Saved locally", description: "Kept in this browser session — the clinic's records weren't changed." });
  };

  const setConsent = (id: ConsentId, given: boolean) => change((p) => ({ ...p, consents: { ...p.consents, [id]: { given, at: new Date(NOW_MS).toISOString() } } }));

  return (
    <div className="flex flex-col gap-8 pb-16">
      <PortalHeader
        title="Preferences"
        description="How the clinic contacts you, who else can see your care, and what you've agreed to."
        actions={
          <>
            <span className="text-xs text-muted" aria-live="polite">
              {dirty ? "Unsaved changes" : state.savedAt ? `Saved locally · ${formatTime(state.savedAt)}` : "Nothing changed yet"}
            </span>
            <Button variant="primary" leading={<FloppyDisk />} disabled={!dirty} onClick={save}>
              Save changes
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        <Reveal index={0}>
          <Panel icon={<ChatCircleDots />} title="How we contact you" subtitle="Choose channels for each kind of message" className="h-full">
            <div className="grid grid-cols-1 gap-4 rounded-inner bg-surface p-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <span className="text-sm text-ink">Mobile</span>
                <span className="flex h-10 items-center rounded-control bg-sunken px-4 text-sm text-ink-2 tabular">{ME.phone}</span>
                <span className="text-xs text-muted">To change it, ask the front desk — we verify new numbers.</span>
              </div>
              <Field label="Email" optional error={emailError ?? undefined} hint={prefs.email ? undefined : "Add one to get receipts and plan updates by email"}>
                {(f) => (
                  <Input
                    {...f}
                    type="email"
                    autoComplete="email"
                    value={prefs.email}
                    onChange={(e) => {
                      setEmailError(null);
                      change((p) => ({ ...p, email: e.target.value.trim() }));
                    }}
                    onBlur={() => setEmailError(prefs.email && !EMAIL_RE.test(prefs.email) ? "Check the email address — or leave it empty" : null)}
                    placeholder="name@example.com"
                  />
                )}
              </Field>
            </div>
            <ul className="flex flex-col rounded-inner bg-surface px-4">
              {TOPICS.map((t, i) => {
                const options = t.allowed.filter((c) => c !== "email" || (prefs.email && emailOk));
                const value = prefs.channels[t.id].filter((c) => options.includes(c));
                return (
                  <li key={t.id} className={cn("flex flex-col gap-3 py-4 md:flex-row md:items-center md:justify-between", i > 0 && "border-t border-line")}>
                    <span className="min-w-0">
                      <span className="block text-sm text-ink">{t.label}</span>
                      <span className="block text-xs text-muted">{t.detail}</span>
                    </span>
                    <ChipGroup<Channel>
                      ariaLabel={`Channels for ${t.label.toLowerCase()}`}
                      variant="dot"
                      value={value}
                      onChange={(v) => change((p) => ({ ...p, channels: { ...p.channels, [t.id]: v } }))}
                      options={options.map((c) => ({ value: c, label: CHANNEL_LABEL[c] }))}
                      className="shrink-0"
                    />
                  </li>
                );
              })}
            </ul>
            <DemoNote className="px-2 pb-2">Results themselves are never sent by message — only a note that something is ready in your portal.</DemoNote>
          </Panel>
        </Reveal>

        <Reveal index={1}>
          <RemindersPanel prefs={prefs} onChange={change} />
        </Reveal>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Reveal index={2}>
          <Panel
            icon={<UsersThree />}
            title="People who help with your care"
            subtitle={`${pluralize(state.caregivers.length, "person", "people")} with access`}
            action={
              <Button size="sm" variant="dark" leading={<UserPlus />} onClick={() => setCaregiverOpen((c) => ({ open: true, nonce: c.nonce + 1 }))}>
                Add
              </Button>
            }
            className="h-full"
          >
            {state.caregivers.length ? (
              <ul className="flex flex-col gap-2">
                <AnimatePresence initial={false}>
                  {state.caregivers.map((c) => (
                    <motion.li key={c.id} layout initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, transition: { duration: 0.12 } }} transition={spring} className="flex flex-col gap-3 rounded-inner bg-surface p-4">
                      <div className="flex items-start justify-between gap-3">
                        <span className="min-w-0">
                          <span className="block text-sm text-ink">
                            {c.name} <span className="text-muted">· {c.relation}</span>
                          </span>
                          <span className="block text-xs text-muted">
                            {c.phone} · since {longDate(c.since)}
                            {c.until ? ` · until ${longDate(c.until)}` : " · until you remove it"}
                          </span>
                          {c.reason ? <span className="mt-1 block text-xs text-ink-2">{c.reason}</span> : null}
                        </span>
                        {c.status === "invited" ? <StatusBadge tone="warning">Invited · not sent</StatusBadge> : <StatusBadge tone="success">Active</StatusBadge>}
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        {(Object.keys(SCOPE_LABEL) as (keyof typeof SCOPE_LABEL)[]).map((s) => {
                          const on = c.scopes.includes(s);
                          return (
                            <span key={s} className={cn("inline-flex h-7 items-center gap-1.5 rounded-full px-3 text-xs", on ? "bg-sunken text-ink" : "text-faint line-through")}>
                              {on ? <CheckCircle size={14} weight="fill" className="text-success" aria-hidden="true" /> : <X size={14} aria-hidden="true" />}
                              {SCOPE_LABEL[s].label}
                              <span className="sr-only">{on ? " — can see" : " — can't see"}</span>
                            </span>
                          );
                        })}
                        <Button size="sm" variant="ghost" className="ml-auto" onClick={() => setConfirm({ kind: "caregiver", cg: c })}>
                          Remove access
                        </Button>
                      </div>
                    </motion.li>
                  ))}
                </AnimatePresence>
              </ul>
            ) : (
              <p className="rounded-inner bg-surface p-4 text-sm text-muted">Nobody else can see your care. Add a family member or friend to share appointments or your plan.</p>
            )}
            <div className="rounded-inner bg-surface p-4">
              <p className="text-sm text-ink">What they can never do</p>
              <ul className="mt-2 flex list-disc flex-col gap-1 pl-5 text-xs text-ink-2 marker:text-faint">
                <li>See anything you haven&apos;t ticked — consultation notes stay between you and your clinicians</li>
                <li>Message the clinic as you, or change your plan or bookings</li>
                <li>Keep access after the end date you chose</li>
              </ul>
            </div>
          </Panel>
        </Reveal>

        <Reveal index={3}>
          <Panel icon={<ShieldCheck />} title="Consents" subtitle="What you've agreed to, and when" className="h-full">
            <ul className="flex flex-col rounded-inner bg-surface px-4">
              {(Object.keys(CONSENT_INFO) as ConsentId[]).map((id, i) => {
                const info = CONSENT_INFO[id];
                const c = prefs.consents[id];
                const changed = c.given !== state.saved.consents[id].given;
                const locked = !!info.locked || id === "abha";
                return (
                  <li key={id} className={cn("flex items-start gap-4 py-4", i > 0 && "border-t border-line")}>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm text-ink">{info.label}</span>
                      <span className="block text-xs text-muted">{info.detail}</span>
                      <span className="mt-1 block text-xs text-ink-2">
                        {changed
                          ? `${c.given ? "Given" : "Withdrawn"} just now · not saved yet`
                          : c.at
                            ? `${c.given ? "Given" : "Withdrawn"} ${longDate(c.at)} · ${info.source}`
                            : c.given
                              ? `${id === "abha" ? "Linked" : "Given"} · date not recorded`
                              : "Not given"}
                      </span>
                      {locked && info.locked ? <span className="mt-1 block text-[11px] text-muted">{info.locked}</span> : null}
                      {id === "abha" ? <span className="mt-1 block text-[11px] text-muted">Linking and unlinking happens in your ABHA app.</span> : null}
                    </span>
                    <Switch
                      checked={c.given}
                      disabled={locked}
                      aria-label={info.label}
                      onCheckedChange={(v) => {
                        if (!v && info.withdrawWarning) setConfirm({ kind: "consent", id });
                        else setConsent(id, v);
                      }}
                      className="mt-1"
                    />
                  </li>
                );
              })}
            </ul>
          </Panel>
        </Reveal>
      </div>

      <Reveal index={4}>
        <Panel icon={<Translate />} title="Language & reading" subtitle="For messages, reminders and printed plans">
          <div className="grid grid-cols-1 gap-4 rounded-inner bg-surface p-4 md:grid-cols-2">
            <Field label="Language" hint="This demo portal itself stays in English.">
              {(f) => <Select id={f.id} value={prefs.language} onValueChange={(v) => change((p) => ({ ...p, language: v }))} options={LANGUAGES} />}
            </Field>
            <div className="flex items-start justify-between gap-4">
              <span>
                <span className="block text-sm text-ink">Larger text on printed plans</span>
                <span className="block text-xs text-muted">Meal and exercise sheets printed at reception use 14 pt type</span>
              </span>
              <Switch checked={prefs.largeText} onCheckedChange={(v) => change((p) => ({ ...p, largeText: v }))} aria-label="Larger text on printed plans" className="mt-1" />
            </div>
          </div>
        </Panel>
      </Reveal>

      <AnimatePresence>
        {dirty ? (
          <motion.div
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            transition={spring}
            className="fixed inset-x-4 bottom-4 z-40 mx-auto flex max-w-[560px] items-center gap-3 rounded-full bg-charcoal p-2 pl-6 text-white shadow-pop"
            role="region"
            aria-label="Unsaved changes"
          >
            <span className="min-w-0 flex-1 truncate text-sm">You have unsaved changes</span>
            <Button size="sm" variant="glass" onClick={() => setDraft(null)}>
              Discard
            </Button>
            <Button size="sm" variant="primary" onClick={save}>
              Save changes
            </Button>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <CaregiverModal key={`cg-${caregiverOpen.nonce}`} open={caregiverOpen.open} onOpenChange={(o) => setCaregiverOpen((c) => ({ ...c, open: o }))} />

      <Dialog open={confirm !== null} onOpenChange={(o) => !o && setConfirm(null)}>
        {confirm ? (
          <ModalContent
            size="sm"
            title={confirm.kind === "consent" ? `Withdraw “${CONSENT_INFO[confirm.id].label}”?` : `Remove ${confirm.cg.name}'s access?`}
            description={confirm.kind === "consent" ? CONSENT_INFO[confirm.id].withdrawWarning : "They'll stop seeing your care straight away. You can add them again later."}
            footer={
              <>
                <Button variant="secondary" onClick={() => setConfirm(null)}>
                  Keep
                </Button>
                <Button
                  variant="danger"
                  onClick={() => {
                    if (confirm.kind === "consent") setConsent(confirm.id, false);
                    else {
                      const cg = confirm.cg;
                      removeCaregiver(cg.id);
                      toast({ title: `${cg.name}'s access removed`, description: "Saved in this browser session.", action: { label: "Undo", onClick: () => restoreCaregiver(cg) } });
                    }
                    setConfirm(null);
                  }}
                >
                  {confirm.kind === "consent" ? "Withdraw" : "Remove access"}
                </Button>
              </>
            }
          >
            <DemoNote>{confirm.kind === "consent" ? "Takes effect when you save. In the live portal the clinic confirms within 7 days." : "Demo — nobody is notified."}</DemoNote>
          </ModalContent>
        ) : null}
      </Dialog>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------
// Reminders: timing previewed on the patient's own upcoming visits
// ---------------------------------------------------------------------------------------------

const QUIET_FROM = 21 * 60;
const QUIET_TO = 7 * 60;

/** Reminder times for one visit under the chosen settings (quiet hours move them to 20:30 the evening before). */
function remindersFor(start: string, prefs: Prefs) {
  const out: { at: string; why: string; moved?: boolean }[] = [];
  const lead = new Date(Date.parse(start) - LEAD_MIN[prefs.lead] * 60_000).toISOString();
  const shift = (iso: string) => {
    const m = istMinutes(iso);
    if (!prefs.quiet || (m < QUIET_FROM && m >= QUIET_TO)) return { at: iso, moved: false };
    const day = new Date(Date.parse(iso) + 330 * 60_000).toISOString().slice(0, 10);
    return { at: istIso(m >= QUIET_FROM ? day : addDays(day, -1), "20:30"), moved: true };
  };
  const l = shift(lead);
  out.push({ at: l.at, why: LEAD_LABEL[prefs.lead], moved: l.moved });
  if (prefs.morningOf) {
    const day = new Date(Date.parse(start) + 330 * 60_000).toISOString().slice(0, 10);
    const morning = istIso(day, "07:00");
    if (Date.parse(morning) < Date.parse(start) && Math.abs(Date.parse(morning) - Date.parse(l.at)) > 30 * 60_000) out.push({ at: morning, why: "Morning of the visit" });
  }
  return out.sort((a, b) => a.at.localeCompare(b.at));
}

function RemindersPanel({ prefs, onChange }: { prefs: Prefs; onChange: (fn: (p: Prefs) => Prefs) => void }) {
  const id = useId();
  const visits = UPCOMING.filter((a) => Date.parse(a.start) > NOW_MS).sort((a, b) => a.start.localeCompare(b.start)).slice(0, 3);
  const channels = prefs.channels.reminders.map((c) => CHANNEL_LABEL[c]).join(" + ");
  return (
    <Panel icon={<Bell />} title="Reminders" subtitle={channels ? `By ${channels}` : "Reminders are off — no channel chosen"} className="h-full">
      <div className="flex flex-col gap-4 rounded-inner bg-surface p-4">
        <div className="-mx-1 overflow-x-auto px-1 pb-1 scrollbar-none">
          <Segmented<Lead> ariaLabel="Remind me" value={prefs.lead} onChange={(v) => onChange((p) => ({ ...p, lead: v }))} variant="tray" size="sm" items={(Object.keys(LEAD_LABEL) as Lead[]).map((l) => ({ value: l, label: LEAD_LABEL[l] }))} />
        </div>
        <label className="flex items-start justify-between gap-4">
          <span>
            <span className="block text-sm text-ink">Also on the morning of the visit</span>
            <span className="block text-xs text-muted">At 07:00, with directions</span>
          </span>
          <Switch checked={prefs.morningOf} onCheckedChange={(v) => onChange((p) => ({ ...p, morningOf: v }))} aria-label="Also remind me on the morning of the visit" className="mt-1" />
        </label>
        <label className="flex items-start justify-between gap-4">
          <span>
            <span className="block text-sm text-ink">Quiet hours 21:00–07:00</span>
            <span className="block text-xs text-muted">Reminders due overnight arrive at 20:30 the evening before</span>
          </span>
          <Switch checked={prefs.quiet} onCheckedChange={(v) => onChange((p) => ({ ...p, quiet: v }))} aria-label="Quiet hours from 21:00 to 07:00" className="mt-1" />
        </label>
      </div>

      <section aria-labelledby={id} className="rounded-inner bg-surface p-4">
        <h3 id={id} className="text-sm text-ink">
          With these settings, for your next visits
        </h3>
        <ul className="mt-3 flex flex-col gap-4">
          {visits.map((v) => {
            const rs = remindersFor(v.start, prefs);
            const startMs = Date.parse(v.start);
            const span = 26 * 60 * 60_000;
            return (
              <li key={v.id} className="flex flex-col gap-2">
                <span className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="min-w-0 truncate text-ink">{v.service}</span>
                  <span className="shrink-0 text-xs text-muted tabular">
                    {dayLabel(v.start)} · {formatTime(v.start)}
                  </span>
                </span>
                <div className="relative h-6" role="img" aria-label={`Reminders for ${v.service}: ${rs.map((r) => `${dayLabel(r.at)} ${formatTime(r.at)} (${r.why})`).join(", ")}`}>
                  <span className="absolute inset-x-0 top-1/2 h-px bg-line" aria-hidden="true" />
                  {rs.map((r) => {
                    const pct = Math.max(0, Math.min(100, 100 - ((startMs - Date.parse(r.at)) / span) * 100));
                    return <span key={r.at} className={cn("absolute top-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full", Date.parse(r.at) < NOW_MS ? "bg-faint" : "bg-ink-2")} style={{ left: `${pct}%` }} aria-hidden="true" />;
                  })}
                  <span className="absolute right-0 top-1/2 size-3 -translate-y-1/2 translate-x-1/2 rounded-full bg-charcoal shadow-[0_0_0_2px_var(--color-surface)]" aria-hidden="true" />
                </div>
                <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
                  {rs.map((r) => (
                    <li key={r.at}>
                      <span className="text-ink-2 tabular">
                        {dayLabel(r.at)} {formatTime(r.at)}
                      </span>{" "}
                      · {r.why}
                      {r.moved ? " (moved for quiet hours)" : ""}
                      {Date.parse(r.at) < NOW_MS ? " · already passed" : ""}
                    </li>
                  ))}
                </ul>
              </li>
            );
          })}
        </ul>
        <p className="mt-4 text-[11px] text-muted">Line = the 26 hours before each visit; dots = reminders, the dark end dot = the visit.</p>
      </section>
    </Panel>
  );
}

"use client";

import { useEffect, useLayoutEffect, useRef, useState, type ComponentProps } from "react";
import { ArrowsLeftRight, CalendarCheck, CalendarPlus, CaretDown, CheckCircle, CloudCheck, Info, LockSimple, NotePencil, PaperPlaneTilt, PencilSimple, Plus, Trash, WarningCircle } from "@phosphor-icons/react";
import type { Patient } from "@/data/types";
import { staffById } from "@/data/staff";
import { usePlan, useRole } from "@/components/shell/role-context";
import { LockBadge, priceLine } from "@/components/shell/plan-switcher";
import { Button, Spinner } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/input";
import { StatusBadge } from "@/components/ui/status";
import { Tip } from "@/components/ui/tooltip";
import { useToast } from "@/components/ui/toast";
import { Dropdown, DropdownContent, DropdownItem, DropdownLabel, DropdownRadioGroup, DropdownRadioItem, DropdownSeparator, DropdownTrigger } from "@/components/ui/dropdown";
import { formatDate, formatTime } from "@/lib/format";
import { cn } from "@/lib/cn";
import { NOTE_SECTIONS, type SectionKey } from "../data";
import { useRecord } from "../store";
import { isFeaturedPatient } from "../record-model";
import { appointmentText, changesSentence, problemsSentence, readingsSentence } from "./notes-data";
import { InstructionsDialog, ReferralDialog, ReviewDialog } from "./note-dialogs";
import type { LocalReferral, NextReview, SaveState, useDraftBook } from "./use-drafts";

type DraftsApi = ReturnType<typeof useDraftBook>;
type Dialogs = null | "referral" | "review" | "instructions";

const DISCIPLINE: Record<LocalReferral["to"], string> = { nutrition: "Nutrition", movement: "Movement", medical: "Medical" };

/** Right side of the split view: today's structured note. */
export function NoteEditor({ patient, api, focusToken }: { patient: Patient; api: DraftsApi; focusToken: number }) {
  const { user } = useRole();
  const { has } = usePlan();
  const { toast } = useToast();
  const readings = useRecord((s) => s.readings);
  const d = api.active;
  const ready = d.status === "ready";
  const [errors, setErrors] = useState<Partial<Record<SectionKey, string>>>({});
  const [dialog, setDialog] = useState<Dialogs>(null);
  const fields = useRef<Partial<Record<SectionKey, HTMLTextAreaElement | null>>>({});

  useEffect(() => {
    if (focusToken > 0) fields.current.history?.focus();
  }, [focusToken]);

  useEffect(() => setErrors({}), [d.id]);

  const setSection = (k: SectionKey, v: string) => {
    api.updateActive((x) => ({ ...x, sections: { ...x.sections, [k]: v } }), "debounced");
    if (errors[k]) setErrors((e) => ({ ...e, [k]: undefined }));
  };

  // Inserts quote this patient's own record (with provenance); hidden when there is nothing to quote.
  const changes = changesSentence(patient);
  const latest = readingsSentence(patient.id, readings);
  const problems = problemsSentence(patient.id);
  const inserts: Partial<Record<SectionKey, { label: string; text: () => string }>> = {
    ...(changes ? { history: { label: patient.lastVisit || isFeaturedPatient(patient.id) ? "Changes since last visit" : "Changes since registration", text: () => changes } } : {}),
    ...(latest ? { findings: { label: "Latest readings", text: () => latest } } : {}),
    ...(problems ? { assessment: { label: "Active problems", text: () => problems } } : {}),
  };

  const insert = (k: SectionKey, line: string) => {
    const cur = d.sections[k].trim();
    setSection(k, cur ? `${cur}\n${line}` : line);
    requestAnimationFrame(() => fields.current[k]?.focus());
  };

  const markReady = () => {
    const errs: Partial<Record<SectionKey, string>> = {};
    if (!d.sections.history.trim()) errs.history = "Add the history before marking the note ready.";
    if (!d.sections.assessment.trim()) errs.assessment = "Add your assessment before marking the note ready.";
    if (!d.sections.followUp.trim()) errs.followUp = "Add a follow-up plan — or write “No follow-up needed”.";
    setErrors(errs);
    const first = NOTE_SECTIONS.find((s) => errs[s.key]);
    if (first) {
      fields.current[first.key]?.focus();
      return;
    }
    api.updateActive((x) => ({ ...x, status: "ready" }));
    toast({ title: "Marked ready to sign", description: "Still an unsigned draft. Signing needs a verified clinician identity, which this prototype doesn't have." });
  };

  const discard = () => {
    const removed = api.discard(d.id);
    toast({ title: "Draft discarded", description: "Removed from this browser.", action: removed ? { label: "Undo", onClick: () => api.restore(removed) } : undefined });
  };

  const createReferral = (r: LocalReferral) => {
    api.updateActive((x) => ({ ...x, referrals: [...x.referrals, r] }));
    toast({ title: `Referral to ${staffById(r.toId)?.name ?? "the team"} recorded`, description: "Saved with this draft in this browser — the recipient wasn't notified. In production it starts at “Requested”.", tone: "success" });
  };

  const schedule = (r: NextReview) => {
    const line = `${r.kind} on ${formatDate(r.date, { weekday: "short", day: "numeric", month: "short" })} at ${r.time} with ${staffById(r.withId)?.name ?? "the doctor"} (requested).`;
    api.updateActive((x) => ({ ...x, nextReview: r, sections: { ...x.sections, followUp: x.sections.followUp.trim() ? `${x.sections.followUp.trim()}\n${line}` : line } }));
    toast({ title: "Review request saved locally", description: "Not booked — front desk confirms the slot. Added to this note's follow-up.", tone: "success" });
  };

  const publish = (text: string) => {
    api.updateActive((x) => ({ ...x, instructions: { text, at: new Date().toISOString(), by: user.name } }));
    toast({ title: "Instructions marked as published", description: "Recorded in this browser session. The patient portal isn't connected in this prototype, so nothing was sent.", tone: "success" });
  };

  const instructionsSeed = d.instructions?.text ?? [d.sections.advice.trim(), d.sections.followUp.trim()].filter(Boolean).join("\n\n");
  const author = staffById(d.authorId)?.name ?? user.name;

  return (
    <Card padded={false} role="region" className="@container flex min-w-0 flex-col" aria-label="Consultation note">
      <header className="flex flex-col gap-3 px-6 pt-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            {ready ? <StatusBadge tone="info">Ready to sign · unsigned</StatusBadge> : <StatusBadge tone="draft">Draft</StatusBadge>}
            <AutosavePill save={api.save} />
          </div>
          <DraftsMenu api={api} onDiscard={discard} />
        </div>
        <label className="sr-only" htmlFor={`title-${d.id}`}>
          Note title
        </label>
        <TitleField id={`title-${d.id}`} value={d.title} readOnly={ready} onChange={(v) => api.updateActive((x) => ({ ...x, title: v }), "debounced")} />
        <p className="text-xs text-muted">
          {appointmentText(d.appointment, author)} · note by {author}
        </p>
      </header>

      <div className="mt-6 flex flex-col gap-5 px-6">
        {NOTE_SECTIONS.map((s) => {
          const ins = inserts[s.key];
          const errId = `${d.id}-${s.key}-error`;
          return (
            <div key={`${d.id}-${s.key}`}>
              <div className="mb-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                <label htmlFor={`${d.id}-${s.key}`} className="text-sm text-ink">
                  {s.label} <span className="text-xs text-muted">· {s.hint}</span>
                </label>
                {ins && !ready ? (
                  <button type="button" onClick={() => insert(s.key, ins.text())} className="-ml-2.5 inline-flex h-7 items-center gap-1 rounded-full px-2.5 text-xs text-ink-2 transition-colors hover:bg-sunken @[560px]:-mr-2.5 @[560px]:ml-0">
                    <Plus size={12} aria-hidden="true" />
                    {ins.label}
                  </button>
                ) : null}
              </div>
              <AutoTextarea
                id={`${d.id}-${s.key}`}
                textareaRef={(el) => {
                  fields.current[s.key] = el;
                }}
                value={d.sections[s.key]}
                readOnly={ready}
                onChange={(e) => setSection(s.key, e.target.value)}
                placeholder={s.placeholder}
                aria-invalid={errors[s.key] ? true : undefined}
                aria-describedby={errors[s.key] ? errId : undefined}
                className={cn(ready && "bg-canvas text-ink-2 shadow-none")}
              />
              {errors[s.key] ? (
                <p id={errId} className="mt-1.5 text-xs text-danger">
                  {errors[s.key]}
                </p>
              ) : null}
            </div>
          );
        })}
      </div>

      <section aria-label="From this consultation" className="mx-6 mt-6 rounded-inner bg-canvas p-4">
        <p className="text-xs text-muted">From this consultation</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {has("referrals") ? (
            <Button variant="secondary" size="sm" leading={<ArrowsLeftRight />} onClick={() => setDialog("referral")}>
              Create referral
            </Button>
          ) : (
            <Tip label={`Referrals are on the Team plan · ${priceLine("team")}`}>
              <span tabIndex={0} className="inline-flex rounded-full">
                <Button variant="secondary" size="sm" disabled leading={<ArrowsLeftRight />} trailing={<LockBadge />}>
                  Create referral
                </Button>
              </span>
            </Tip>
          )}
          <Button variant="secondary" size="sm" leading={<CalendarPlus />} onClick={() => setDialog("review")}>
            Schedule next review
          </Button>
          <Button variant="secondary" size="sm" leading={<PaperPlaneTilt />} trailing={has("portal") ? undefined : <LockBadge />} onClick={() => setDialog("instructions")}>
            {d.instructions ? "Update patient instructions" : "Publish patient instructions"}
          </Button>
        </div>
        {d.referrals.length || d.nextReview || d.instructions ? (
          <ul className="mt-4 flex flex-col gap-2">
            {d.referrals.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-2 text-xs text-ink-2">
                <ArrowsLeftRight size={14} className="text-muted" aria-hidden="true" />
                Referral to {staffById(r.toId)?.name} · {DISCIPLINE[r.to]}
                {r.priority !== "normal" ? ` · ${r.priority}` : ""}
                <StatusBadge tone="neutral">Requested · not sent</StatusBadge>
              </li>
            ))}
            {d.nextReview ? (
              <li className="flex flex-wrap items-center gap-2 text-xs text-ink-2">
                <CalendarCheck size={14} className="text-muted" aria-hidden="true" />
                {d.nextReview.kind} · {formatDate(d.nextReview.date, { weekday: "short", day: "numeric", month: "short" })}, {d.nextReview.time} with {staffById(d.nextReview.withId)?.name}
                <StatusBadge tone="warning">Requested · not booked</StatusBadge>
              </li>
            ) : null}
            {d.instructions ? (
              <li className="flex flex-wrap items-center gap-2 text-xs text-ink-2">
                <PaperPlaneTilt size={14} className="text-muted" aria-hidden="true" />
                Patient instructions published in this session
                <StatusBadge tone="info">Released · local only</StatusBadge>
              </li>
            ) : null}
          </ul>
        ) : (
          <p className="mt-3 text-xs text-muted">Referrals, review requests and patient instructions made here stay attached to this draft.</p>
        )}
      </section>

      <footer className="mt-6 flex flex-col gap-4 border-t border-line px-6 py-5 @[620px]:flex-row @[620px]:items-center @[620px]:justify-between">
        <p className="flex max-w-[52ch] items-start gap-2 text-xs text-muted">
          <Info size={16} className="mt-px shrink-0" aria-hidden="true" />
          Signing needs a verified clinician identity, which this prototype doesn&apos;t have — so notes stay unsigned drafts, stored only in this browser.
        </p>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Tip label="Needs a verified clinician identity (e-sign) — not available in this prototype">
            <span tabIndex={0} className="inline-flex rounded-full">
              <Button variant="secondary" disabled leading={<LockSimple />}>
                Sign note
              </Button>
            </span>
          </Tip>
          {ready ? (
            <Button variant="secondary" leading={<PencilSimple />} onClick={() => api.updateActive((x) => ({ ...x, status: "draft" }))}>
              Edit again
            </Button>
          ) : (
            <Button variant="primary" leading={<CheckCircle />} onClick={markReady}>
              Mark ready to sign
            </Button>
          )}
        </div>
      </footer>

      <ReferralDialog open={dialog === "referral"} onOpenChange={(o) => setDialog(o ? "referral" : null)} patient={patient} authorId={user.id} suggestedReason={d.sections.assessment.trim()} onCreate={createReferral} />
      <ReviewDialog
        open={dialog === "review"}
        onOpenChange={(o) => setDialog(o ? "review" : null)}
        patient={patient}
        defaultWith={patient.careTeam.doctor ?? user.id}
        defaultDate={isFeaturedPatient(patient.id) ? "2026-12-04" : "2026-11-27"}
        programme={!!patient.program}
        onSchedule={schedule}
      />
      <InstructionsDialog open={dialog === "instructions"} onOpenChange={(o) => setDialog(o ? "instructions" : null)} patient={patient} initialText={instructionsSeed} published={!!d.instructions} onPublish={publish} />
    </Card>
  );
}

function AutosavePill({ save }: { save: SaveState }) {
  const conf = {
    idle: { icon: <CloudCheck size={14} aria-hidden="true" />, text: "Autosaves as you type", cls: "bg-sunken text-ink-2" },
    saving: { icon: <Spinner className="size-3.5" />, text: "Saving…", cls: "bg-sunken text-ink-2" },
    saved: { icon: <CloudCheck size={14} aria-hidden="true" />, text: "Saved locally", cls: "bg-success-soft text-success" },
    failed: { icon: <WarningCircle size={14} aria-hidden="true" />, text: "Not saved — browser storage is blocked", cls: "bg-danger-soft text-danger" },
  }[save.kind];
  return (
    <span role="status" aria-live="polite" className={cn("inline-flex h-6 items-center gap-1.5 rounded-full px-2.5 text-xs font-medium transition-colors duration-300", conf.cls)}>
      {conf.icon}
      {conf.text}
    </span>
  );
}

function DraftsMenu({ api, onDiscard }: { api: DraftsApi; onDiscard: () => void }) {
  const n = api.book.drafts.length;
  return (
    <Dropdown>
      <DropdownTrigger asChild>
        <Button variant="ghost" size="sm" trailing={<CaretDown />}>
          {n > 1 ? `Drafts · ${n}` : "Draft options"}
        </Button>
      </DropdownTrigger>
      <DropdownContent className="w-[300px]">
        <DropdownLabel>Your unsigned drafts</DropdownLabel>
        <DropdownRadioGroup value={api.book.activeId} onValueChange={api.select}>
          {api.book.drafts.map((x) => (
            <DropdownRadioItem key={x.id} value={x.id} description={x.status === "ready" ? "Ready to sign · unsigned" : x.appointment ? `Today ${formatTime(x.appointment.at)} · ${x.appointment.room}` : "No linked appointment"}>
              {x.title || "Untitled note"}
            </DropdownRadioItem>
          ))}
        </DropdownRadioGroup>
        <DropdownSeparator />
        <DropdownItem icon={<NotePencil />} onSelect={api.openBlank}>
          New blank note
        </DropdownItem>
        <DropdownItem icon={<Trash />} tone="danger" onSelect={onDiscard}>
          Discard this draft
        </DropdownItem>
      </DropdownContent>
    </Dropdown>
  );
}

/** Note title: one logical line (Enter is ignored) that wraps instead of clipping on phones. */
function TitleField({ id, value, readOnly, onChange }: { id: string; value: string; readOnly: boolean; onChange: (v: string) => void }) {
  const ref = useRef<HTMLTextAreaElement | null>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);
  return (
    <textarea
      ref={ref}
      id={id}
      rows={1}
      value={value}
      readOnly={readOnly}
      onChange={(e) => onChange(e.target.value.replace(/\s*\n\s*/g, " "))}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.preventDefault();
      }}
      className="-mx-2 block w-[calc(100%+16px)] resize-none overflow-hidden rounded-[12px] bg-transparent px-2 py-1 text-[22px] font-light leading-tight tracking-[-0.015em] text-ink outline-none transition-colors placeholder:text-faint hover:bg-canvas focus:bg-canvas read-only:hover:bg-transparent @[560px]:text-[26px]"
    />
  );
}

/** Textarea that grows with its content (no inner scrollbar while writing). */
function AutoTextarea({ value, textareaRef, className, ...props }: ComponentProps<"textarea"> & { textareaRef: (el: HTMLTextAreaElement | null) => void }) {
  const local = useRef<HTMLTextAreaElement | null>(null);
  useLayoutEffect(() => {
    const el = local.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight + 2}px`;
  }, [value]);
  return (
    <Textarea
      ref={(el) => {
        local.current = el;
        textareaRef(el);
      }}
      value={value}
      rows={2}
      className={cn("min-h-[72px] resize-none overflow-hidden", className)}
      {...props}
    />
  );
}

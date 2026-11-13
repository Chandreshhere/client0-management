"use client";

import { AnimatePresence, motion } from "motion/react";
import { forwardRef, useState, type FormEvent, type ReactNode } from "react";
import { ClipboardText, Eye, PencilSimpleLine, Trash } from "@phosphor-icons/react";
import { cn } from "@/lib/cn";
import { spring } from "@/lib/motion";
import { formatTime } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Field, Select, Textarea } from "@/components/ui/input";
import { IconButton } from "@/components/ui/icon-button";
import { StatusBadge } from "@/components/ui/status";
import { useToast } from "@/components/ui/toast";
import { DemoNote } from "../ui";
import { RELEASED_PAST, ME } from "../record";
import { TODAY_KEY, dayLabel, longDate, shortDate } from "../time";
import { addRequest, withdrawRequest, type AccessRequest, type RequestKind } from "./store";

const KINDS: { value: RequestKind; label: string; detail: string; icon: ReactNode }[] = [
  { value: "copy", label: "A copy of my records", detail: "Everything released to you, as one file", icon: <ClipboardText size={18} /> },
  { value: "correction", label: "Correct something", detail: "A detail in a released record is wrong", icon: <PencilSimpleLine size={18} /> },
  { value: "access-log", label: "Who viewed my record", detail: "Everyone who opened it in the last 12 months", icon: <Eye size={18} /> },
];

export const KIND_LABEL: Record<RequestKind, string> = { copy: "Copy of my records", correction: "Correction", "access-log": "Access history" };

/** Released clinical records the patient can point at (newest first; their own logs excluded). */
const RECORD_OPTIONS = RELEASED_PAST.filter((e) => e.state !== "self-reported")
  .sort((a, b) => b.date.localeCompare(a.date))
  .map((e) => ({ value: e.id, label: `${e.title} · ${e.date.slice(0, 4) === TODAY_KEY.slice(0, 4) ? shortDate(e.date) : longDate(`${e.date}T12:00:00+05:30`)}` }));

const DELIVERY = [
  { value: "portal", label: "Download here in the portal" },
  { value: "reception", label: "Collect a printed copy at reception" },
  { value: "abha", label: ME.abhaLinked ? "Send to my linked ABHA account" : "ABHA (not linked)" },
];

type Errors = Partial<Record<"record" | "detail", string>>;

/**
 * Record access / correction request. Saved in this browser session and listed as "not sent" —
 * the demo never contacts the clinic's records team.
 */
export const AccessRequestCard = forwardRef<HTMLElement, { requests: AccessRequest[]; preselect: { recordId: string; nonce: number } | null }>(function AccessRequestCard({ requests, preselect }, ref) {
  return (
    <section ref={ref} id="access" aria-labelledby="access-title" className="flex scroll-mt-24 flex-col gap-2 rounded-card bg-sunken p-2">
      <div className="flex items-center gap-3 p-2">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-surface text-ink" aria-hidden="true">
          <ClipboardText size={18} />
        </span>
        <div className="min-w-0">
          <h2 id="access-title" className="truncate text-sm font-medium text-ink">
            Your records, your rights
          </h2>
          <p className="truncate text-xs text-muted">Ask for a copy, a correction or who has viewed your record</p>
        </div>
      </div>
      <RequestForm key={preselect?.nonce ?? 0} preselect={preselect?.recordId} />
      {requests.length ? (
        <div className="rounded-inner bg-surface p-4">
          <h3 className="text-sm text-ink">Your requests</h3>
          <ul className="mt-2 flex flex-col divide-y divide-line">
            <AnimatePresence initial={false}>
              {requests.map((r) => (
                <motion.li key={r.id} layout initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, transition: { duration: 0.12 } }} transition={spring} className="flex flex-wrap items-center gap-x-3 gap-y-2 py-3">
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm text-ink">
                      {KIND_LABEL[r.kind]}
                      {r.recordTitle ? ` · ${r.recordTitle}` : ""}
                    </span>
                    <span className="block text-xs text-muted">
                      {dayLabel(r.at)} {formatTime(r.at)}
                      {r.delivery ? ` · ${DELIVERY.find((d) => d.value === r.delivery)?.label.toLowerCase()}` : ""}
                      {r.detail ? ` · “${r.detail}”` : ""}
                    </span>
                  </span>
                  <StatusBadge tone="warning">Not sent · demo</StatusBadge>
                  <IconButton label={`Withdraw ${KIND_LABEL[r.kind].toLowerCase()} request`} variant="ghost" size="sm" onClick={() => withdrawRequest(r.id)}>
                    <Trash size={16} />
                  </IconButton>
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        </div>
      ) : null}
    </section>
  );
});

function RequestForm({ preselect }: { preselect?: string }) {
  const { toast } = useToast();
  const [kind, setKind] = useState<RequestKind>(preselect ? "correction" : "copy");
  const [recordId, setRecordId] = useState<string | undefined>(preselect);
  const [detail, setDetail] = useState("");
  const [delivery, setDelivery] = useState("portal");
  const [errors, setErrors] = useState<Errors>({});

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const next: Errors = {};
    if (kind === "correction") {
      if (!recordId) next.record = "Choose the record that needs correcting";
      if (detail.trim().length < 10) next.detail = "Tell us what's wrong and what it should say (at least 10 characters)";
    }
    setErrors(next);
    if (Object.keys(next).length) return;
    const title = RECORD_OPTIONS.find((o) => o.value === recordId)?.label;
    addRequest({
      kind,
      recordId: kind === "correction" ? recordId : undefined,
      recordTitle: kind === "correction" ? title : undefined,
      detail: kind === "correction" ? detail.trim() : undefined,
      delivery: kind === "copy" ? delivery : undefined,
    });
    toast({ title: `${KIND_LABEL[kind]} request saved`, description: "Demo — nothing was sent. In the live portal the records team confirms within 7 working days." });
    setDetail("");
    setErrors({});
  };

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4 rounded-inner bg-surface p-4">
      <div role="radiogroup" aria-label="What would you like?" className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        {KINDS.map((k) => {
          const on = kind === k.value;
          return (
            <button
              key={k.value}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => {
                setKind(k.value);
                setErrors({});
              }}
              className={cn(
                "flex flex-col items-start gap-1 rounded-[12px] p-3 text-left transition-[background-color,box-shadow] duration-200",
                on ? "bg-surface shadow-[inset_0_0_0_2px_var(--color-charcoal)]" : "bg-sunken hover:bg-sunken-2",
              )}
            >
              <span className="text-ink-2" aria-hidden="true">
                {k.icon}
              </span>
              <span className="text-sm text-ink">{k.label}</span>
              <span className="text-xs text-muted">{k.detail}</span>
            </button>
          );
        })}
      </div>

      {kind === "copy" ? (
        <Field label="How would you like it?">
          {(f) => <Select id={f.id} value={delivery} onValueChange={setDelivery} options={DELIVERY} />}
        </Field>
      ) : kind === "correction" ? (
        <>
          <Field label="Which record?" error={errors.record}>
            {(f) => <Select id={f.id} aria-invalid={f["aria-invalid"]} aria-describedby={f["aria-describedby"]} value={recordId} onValueChange={setRecordId} placeholder="Choose a record" options={RECORD_OPTIONS} />}
          </Field>
          <Field label="What's wrong, and what should it say?" error={errors.detail} hint={`${detail.length} / 400`}>
            {(f) => <Textarea {...f} value={detail} maxLength={400} onChange={(e) => setDetail(e.target.value)} placeholder="For example: I walk 25 minutes a day, not 35." />}
          </Field>
          <DemoNote>Clinicians never overwrite a signed record — a correction is added as a dated, signed addendum.</DemoNote>
        </>
      ) : (
        <DemoNote>The list shows who opened your record and when, by role (doctor, nutritionist, yoga instructor, front desk).</DemoNote>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-muted">Saved in this browser session — the demo doesn&apos;t contact the clinic.</p>
        <Button type="submit" variant="dark">
          Send request
        </Button>
      </div>
    </form>
  );
}

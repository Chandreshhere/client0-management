"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ChatCircleText, EnvelopeSimple, FileText, LockSimple, NotePencil, Printer, WhatsappLogo } from "@phosphor-icons/react";
import type { Patient } from "@/data/types";
import { BRANCHES, staffById } from "@/data/staff";
import { PATIENTS } from "@/data/patients";
import { INVOICES } from "@/data/records";
import { WEEK_APPOINTMENTS } from "@/data/appointments";
import { cn } from "@/lib/cn";
import { formatDate, formatINR, formatTime } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Group, GroupHeader } from "@/components/ui/card";
import { Field, Select, Textarea } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/misc";
import { Segmented } from "@/components/ui/segmented";
import { StatusBadge } from "@/components/ui/status";
import { useToast } from "@/components/ui/toast";
import { usePlan, useRole } from "@/components/shell/role-context";
import { AddOnBadge, AddOnNotice } from "@/components/shell/plan-switcher";
import { InfoNote, ReadOnlyBanner } from "./ui";
import { NOW_ISO, whenInline } from "./time";
import { TEMPLATE_STATUS_LABEL, settingsAccess, smsSegments, type Template, type TemplateChannel } from "./data";
import { revertTemplate, saveTemplate, useClinic, useTemplates } from "./store";

const CHANNEL_ICON: Record<TemplateChannel, ReactNode> = {
  SMS: <ChatCircleText />,
  WhatsApp: <WhatsappLogo />,
  Email: <EnvelopeSimple />,
  Print: <Printer />,
  Note: <NotePencil />,
};

const VARIABLES = [
  "patient.firstName", "patient.name", "appointment.service", "appointment.date", "appointment.time", "appointment.clinician", "appointment.room",
  "branch.name", "clinic.name", "clinic.shortName", "clinic.phone", "clinic.legal", "clinic.receiptNote", "invoice.number", "invoice.balance",
  "payment.amount", "payment.method", "payment.date", "payment.confirmation", "programme.name", "link.intake", "today", "clinician.name",
] as const;
type VarKey = (typeof VARIABLES)[number];

/** Patients with something to preview: an upcoming booking, an invoice or a programme. */
const SAMPLE_PATIENTS = PATIENTS.filter((p) => p.nextAppointment || INVOICES.some((i) => i.patientId === p.id) || p.program);

function sampleValues(p: Patient, clinic: ReturnType<typeof useClinic>): Partial<Record<VarKey, string>> {
  const next = WEEK_APPOINTMENTS.filter((a) => a.patientId === p.id && a.status === "booked" && Date.parse(a.start) >= Date.parse(NOW_ISO)).sort((a, b) => Date.parse(a.start) - Date.parse(b.start))[0];
  const clinician = next ? staffById(next.staffId) : undefined;
  const branch = BRANCHES.find((b) => (next ? b.rooms.includes(next.room) : b.id === p.branch));
  const open = INVOICES.filter((i) => i.patientId === p.id && i.total - i.paid > 0).sort((a, b) => Date.parse(b.issuedAt) - Date.parse(a.issuedAt))[0];
  const paid = INVOICES.flatMap((i) => (i.patientId === p.id ? (i.payments ?? []).map((pay) => ({ ...pay, inv: i })) : [])).filter((x) => x.confirmed && x.amount > 0).sort((a, b) => Date.parse(b.at) - Date.parse(a.at))[0];
  const doctor = staffById(p.careTeam.doctor);
  const v: Partial<Record<VarKey, string>> = {
    "patient.firstName": p.name.split(" ")[0],
    "patient.name": p.name,
    "branch.name": branch?.name,
    "clinic.name": clinic.name,
    "clinic.shortName": clinic.shortName,
    "clinic.phone": clinic.phone,
    "clinic.legal": clinic.legal,
    "clinic.receiptNote": clinic.receiptNote,
    "programme.name": p.program ?? undefined,
    "link.intake": `${clinic.email.split("@")[1] ?? "clinic.example"}/intake/••••`,
    today: formatDate(NOW_ISO),
    "clinician.name": doctor?.name,
  };
  if (next) {
    v["appointment.service"] = next.service;
    v["appointment.date"] = formatDate(next.start, { weekday: "short", day: "numeric", month: "short" });
    v["appointment.time"] = formatTime(next.start);
    v["appointment.clinician"] = clinician?.name;
    v["appointment.room"] = next.room;
  }
  if (open) {
    v["invoice.number"] = open.number;
    v["invoice.balance"] = formatINR(open.total - open.paid);
  } else if (paid) v["invoice.number"] = paid.inv.number;
  if (paid) {
    v["payment.amount"] = formatINR(paid.amount);
    v["payment.method"] = paid.method;
    v["payment.date"] = formatDate(paid.at);
    v["payment.confirmation"] = paid.method === "Cash" ? "counted at the desk" : paid.method === "Bank transfer" ? "confirmed by the bank" : `${paid.method} reference recorded at the desk`;
  }
  return v;
}

/** Split a body into text, resolved variables, unknown/missing variables and clinician placeholders. */
type Part = { kind: "text" | "var" | "missing" | "unknown" | "slot"; text: string };
function renderParts(body: string, values: Partial<Record<VarKey, string>>): Part[] {
  const out: Part[] = [];
  const re = /\{\{\s*([\w.]+)\s*\}\}|\[([^\]]+)\]/g;
  let last = 0;
  for (let m = re.exec(body); m; m = re.exec(body)) {
    if (m.index > last) out.push({ kind: "text", text: body.slice(last, m.index) });
    if (m[1]) {
      const key = m[1] as VarKey;
      if (!(VARIABLES as readonly string[]).includes(key)) out.push({ kind: "unknown", text: `{{${m[1]}}}` });
      else if (values[key]) out.push({ kind: "var", text: values[key]! });
      else out.push({ kind: "missing", text: key.split(".").pop() ?? key });
    } else out.push({ kind: "slot", text: m[2] });
    last = m.index + m[0].length;
  }
  if (last < body.length) out.push({ kind: "text", text: body.slice(last) });
  return out;
}

/** The text as it would be sent: values filled, missing/clinician slots left in brackets. */
const toPlain = (parts: Part[]) => parts.map((p) => (p.kind === "var" || p.kind === "text" || p.kind === "unknown" ? p.text : `[${p.text}]`)).join("");

const unknownVars = (body: string) => [...body.matchAll(/\{\{\s*([\w.]+)\s*\}\}/g)].map((m) => m[1]).filter((k) => !(VARIABLES as readonly string[]).includes(k));

/** WhatsApp and SMS sending is the messaging add-on: those templates are shown as such, never as sending. */
const isMessage = (t: Template) => t.channel === "SMS" || t.channel === "WhatsApp";

export function TemplatesView() {
  const { role, user } = useRole();
  const { plan, has } = usePlan();
  const { toast } = useToast();
  const all = useTemplates();
  const templates = useMemo(() => all.filter((t) => !t.needs || has(t.needs)), [all, has]);
  const clinic = useClinic();
  const access = settingsAccess(role, plan);
  const owner = access.canEditClinic;
  const ownerLabel = access.ownerLabel;
  const clinicalEditor = role === "doctor";
  const [id, setId] = useState(templates[0]?.id ?? "");
  const [mode, setMode] = useState<"preview" | "edit">("preview");
  const [patientId, setPatientId] = useState("p-kabir");
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const area = useRef<HTMLTextAreaElement>(null);

  const t = templates.find((x) => x.id === id) ?? templates[0];
  const canEdit = !!t && (t.clinical ? owner || clinicalEditor : owner);
  const patient = PATIENTS.find((p) => p.id === patientId) ?? PATIENTS[0];
  const values = useMemo(() => sampleValues(patient, clinic), [patient, clinic]);
  const body = mode === "edit" ? draft : t?.body ?? "";
  const parts = useMemo(() => renderParts(body, values), [body, values]);
  const rendered = toPlain(parts);
  const sms = t && isMessage(t) ? smsSegments(rendered) : null;

  useEffect(() => {
    if (t) setDraft(t.body);
    setError(null);
  }, [t]);

  if (!t) return null;

  function insert(v: VarKey) {
    const el = area.current;
    const token = `{{${v}}}`;
    if (!el) return setDraft((d) => d + token);
    const start = el.selectionStart ?? draft.length;
    const end = el.selectionEnd ?? draft.length;
    const next = draft.slice(0, start) + token + draft.slice(end);
    setDraft(next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + token.length, start + token.length);
    });
  }

  function save() {
    if (!t) return;
    const text = draft.trim();
    if (!text) return setError("A template can't be empty.");
    const unknown = unknownVars(text);
    if (unknown.length) return setError(`${unknown.map((u) => `{{${u}}}`).join(", ")} ${unknown.length === 1 ? "isn't a field" : "aren't fields"} Carelane can fill. Use the buttons below to insert one.`);
    if (t.channel === "SMS" && smsSegments(toPlain(renderParts(text, values))).segments > 3) return setError("This would send as more than 3 text messages. Shorten it.");
    const pending = t.clinical && role !== "doctor";
    const prev = t;
    saveTemplate({ ...t, body: text }, user.id, pending);
    setMode("preview");
    toast({
      tone: pending ? "warning" : "success",
      title: pending ? "Saved — awaiting clinical review" : "Template saved locally",
      description: pending ? "Clinical wording is approved by the clinical lead (Dr. Ananya Rao) before it's used. Saved in this browser session; nothing was sent." : "Saved in this browser session. No messages are sent from this prototype.",
      action: { label: "Undo", onClick: () => revertTemplate(t.id, prev, user.id) },
    });
  }

  return (
    <div className="flex flex-col gap-6 lg:gap-8">
      <PageHeader eyebrow="Settings" title="Templates" description="Forms, letters and note structures the team reuses. Previews fill in from a real patient's record; nothing is sent or printed from this prototype." />
      {!owner && !clinicalEditor ? <ReadOnlyBanner>Templates are edited by administrators; clinical templates are approved by the clinical lead.</ReadOnlyBanner> : null}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,340px)_minmax(0,1fr)]">
        <Group className="flex flex-col self-start">
          <GroupHeader icon={<FileText />} title={`${templates.length} templates`} subtitle={`${templates.filter((x) => x.clinical).length} clinical · ${templates.filter((x) => x.status === "awaiting-review").length} awaiting review`} />
          <ul className="flex flex-col gap-1.5" role="listbox" aria-label="Templates">
            {templates.map((x) => {
              const on = x.id === t.id;
              return (
                <li key={x.id} role="option" aria-selected={on}>
                  <button
                    type="button"
                    onClick={() => {
                      setId(x.id);
                      setMode("preview");
                    }}
                    className={cn("flex w-full items-start gap-3 rounded-inner p-3 text-left transition-[background-color,box-shadow] duration-200", on ? "bg-surface shadow-[0_8px_24px_-12px_rgb(33_38_34/0.25)]" : "hover:bg-surface/70")}
                  >
                    <span className={cn("mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full [&_svg]:size-4", on ? "bg-charcoal text-white" : "bg-surface text-ink-2")} aria-hidden="true">
                      {CHANNEL_ICON[x.channel]}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center justify-between gap-2">
                        <span className="min-w-0 truncate text-sm text-ink">{x.name}</span>
                        {isMessage(x) ? <AddOnBadge addOn="messaging" /> : null}
                      </span>
                      <span className="block truncate text-xs text-muted">
                        {x.channel} · {x.purpose}
                      </span>
                      {x.status !== "published" ? <StatusBadge tone="warning" className="mt-1.5">{TEMPLATE_STATUS_LABEL[x.status]}</StatusBadge> : null}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </Group>

        <section aria-labelledby="tpl-title" className="flex min-w-0 flex-col gap-5 rounded-card bg-surface p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 id="tpl-title" className="text-title font-normal text-ink">
                  {t.name}
                </h2>
                <StatusBadge tone={t.status === "published" ? "success" : "warning"}>{TEMPLATE_STATUS_LABEL[t.status]}</StatusBadge>
                {t.clinical ? <StatusBadge tone="neutral" dot={false}>Clinical</StatusBadge> : null}
              </div>
              <p className="mt-1 text-sm text-muted">
                {t.channel} · {t.purpose} · owner: {t.owner} · edited {whenInline(t.editedAt)} by {staffById(t.editedBy)?.name ?? "the team"}
              </p>
            </div>
            {canEdit ? (
              <Segmented
                ariaLabel="Template view"
                size="sm"
                variant="tray"
                value={mode}
                onChange={setMode}
                items={[
                  { value: "preview", label: "Preview" },
                  { value: "edit", label: "Edit" },
                ]}
              />
            ) : (
              // One option isn't a choice: say what this is instead of showing a one-tab tab bar.
              <p className="flex h-8 items-center gap-1.5 text-xs text-muted">
                <LockSimple size={14} aria-hidden="true" />
                Preview only · edited by {t.clinical ? "the clinical lead" : ownerLabel}
              </p>
            )}
          </div>

          {isMessage(t) ? (
            <AddOnNotice addOn="messaging">
              Sending this by {t.channel} needs the WhatsApp / SMS add-on. Without it, nothing is sent — the wording is kept ready for when it&apos;s switched on.
            </AddOnNotice>
          ) : null}

          <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,300px)]">
            <div className="flex min-w-0 flex-col gap-4">
              {mode === "edit" ? (
                <>
                  <Field label="Wording" error={error ?? undefined} hint={t.clinical && role !== "doctor" ? "Clinical wording — your edit waits for the clinical lead before it's used." : "Use {{fields}} for details Carelane fills in, and [brackets] for what a person writes."}>
                    {(a) => (
                      <Textarea
                        {...a}
                        ref={area}
                        value={draft}
                        onChange={(e) => {
                          setDraft(e.target.value);
                          setError(null);
                        }}
                        className="min-h-[220px] font-mono text-[13px]"
                      />
                    )}
                  </Field>
                  <div>
                    <p className="mb-2 text-xs text-muted">Insert a field</p>
                    <div className="flex flex-wrap gap-1.5">
                      {VARIABLES.map((v) => (
                        <button key={v} type="button" onClick={() => insert(v)} className="h-7 rounded-full bg-sunken px-2.5 font-mono text-[11px] text-ink-2 transition-colors hover:bg-sunken-2">
                          {v}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button variant="ghost" onClick={() => { setDraft(t.body); setMode("preview"); setError(null); }}>
                      Cancel
                    </Button>
                    <Button variant="dark" onClick={save} disabled={draft.trim() === t.body}>
                      {t.clinical && role !== "doctor" ? "Send for clinical review" : "Save template"}
                    </Button>
                  </div>
                </>
              ) : (
                <Preview t={t} parts={parts} />
              )}
              {/* Under the message it counts (and the editor): keeps this column level with the details beside it. */}
              {sms ? (
                <div className="rounded-inner bg-sunken p-4">
                  <p className="text-xs text-muted">If sent as a text</p>
                  <p className="mt-1 text-[22px] font-light leading-none text-ink">
                    {sms.segments} {sms.segments === 1 ? "message" : "messages"}
                  </p>
                  <div className="mt-3 flex h-1.5 gap-0.5" aria-hidden="true">
                    {Array.from({ length: Math.max(3, sms.segments) }, (_, i) => (
                      <span key={i} className={cn("flex-1 rounded-full", i < sms.segments ? (sms.segments > 3 ? "bg-danger" : "bg-charcoal") : "bg-sunken-2")} />
                    ))}
                  </div>
                  <p className="mt-2 text-xs text-muted">
                    {sms.len} characters · {sms.gsm ? "plain text (160 per message)" : "Unicode — a ₹, dash or emoji drops the limit to 70 per message"}
                  </p>
                </div>
              ) : null}
            </div>

            <aside className="flex flex-col gap-4" aria-label="Preview details">
              <Field label="Preview with" hint={t.clinical ? "Clinical slots stay blank — a clinician fills them in." : "Fields fill from this patient's record."}>
                {(a) => (
                  <Select
                    id={a.id}
                    ariaLabel="Preview patient"
                    value={patientId}
                    onValueChange={setPatientId}
                    options={SAMPLE_PATIENTS.map((p) => ({ value: p.id, label: p.name, description: p.nextAppointment ? `next ${formatDate(p.nextAppointment, { day: "numeric", month: "short" })}` : p.program ?? "invoice on file" }))}
                  />
                )}
              </Field>
              <div className="rounded-inner bg-sunken p-4">
                <p className="text-xs text-muted">Fields in this template</p>
                <ul className="mt-2 flex flex-col gap-1.5 text-xs">
                  {parts.filter((p) => p.kind !== "text").length === 0 ? <li className="text-muted">No fields — the text is fixed.</li> : null}
                  {parts
                    .filter((p) => p.kind !== "text")
                    .map((p, i) => (
                      <li key={`${p.kind}-${i}`} className="flex items-center justify-between gap-2">
                        <span className={cn("truncate", p.kind === "var" ? "text-ink-2" : p.kind === "slot" ? "text-muted" : "text-warning")}>{p.kind === "var" ? p.text : p.kind === "slot" ? `[${p.text}]` : p.text}</span>
                        <span className="shrink-0 text-muted">{p.kind === "var" ? "from record" : p.kind === "slot" ? "clinician writes" : p.kind === "missing" ? "not on record" : "unknown field"}</span>
                      </li>
                    ))}
                </ul>
              </div>
              <InfoNote>Nothing is sent or printed from this prototype. Edits are saved in this browser session and written to the activity log.</InfoNote>
            </aside>
          </div>
        </section>
      </div>
    </div>
  );
}

function Preview({ t, parts }: { t: Template; parts: Part[] }) {
  const chat = t.channel === "SMS" || t.channel === "WhatsApp";
  const content = parts.map((p, i) =>
    p.kind === "text" ? (
      <span key={i}>{p.text}</span>
    ) : p.kind === "var" ? (
      <mark key={i} className="rounded-[4px] bg-primary-soft px-0.5 text-primary-ink">
        {p.text}
      </mark>
    ) : p.kind === "slot" ? (
      <span key={i} className="rounded-[4px] px-1 text-muted shadow-[inset_0_0_0_1px_var(--color-line-strong)] [border-style:dashed]">
        {p.text}
      </span>
    ) : (
      <span key={i} className="rounded-[4px] bg-warning-soft px-1 text-warning">
        {p.kind === "missing" ? `no ${p.text} on record` : p.text}
      </span>
    ),
  );
  if (chat) {
    return (
      <div className="flex flex-col gap-2 rounded-inner bg-sunken p-4 sm:p-6">
        <p className="text-xs text-muted">{t.channel} · to the patient&apos;s registered number</p>
        <div className="max-w-[420px] whitespace-pre-wrap rounded-[20px] rounded-bl-[6px] bg-surface p-4 text-sm leading-relaxed text-ink shadow-[inset_0_0_0_1px_var(--color-line)]">{content}</div>
        <p className="text-[11px] text-muted">Highlighted = filled from the record · amber = missing on this record</p>
      </div>
    );
  }
  return (
    <div className="rounded-inner bg-sunken p-4 sm:p-6">
      <div className="mx-auto max-w-[520px] whitespace-pre-wrap rounded-[16px] bg-surface p-6 text-sm leading-relaxed text-ink shadow-[0_16px_40px_-24px_rgb(33_38_34/0.35)]">{content}</div>
      <p className="mt-3 text-center text-[11px] text-muted">{t.channel === "Note" ? "Note structure — dashed slots are written by the clinician" : "Print layout · dashed slots are written by hand or by a clinician"}</p>
    </div>
  );
}

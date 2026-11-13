"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowSquareOut, ChatCircleText, CheckCircle, Archive, LockSimple, ShieldCheck, UserSwitch, WarningCircle, ListPlus } from "@phosphor-icons/react";
import type { Icon } from "@phosphor-icons/react";
import { staffById } from "@/data/staff";
import { patientById } from "@/data/patients";
import { DOC_STATUS_LABEL } from "@/data/records";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/cn";
import { Dialog, SheetContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/input";
import { StatusBadge } from "@/components/ui/status";
import { useToast } from "@/components/ui/toast";
import { useRole } from "@/components/shell/role-context";
import { createTask } from "@/features/tasks/store";
import { staffOptions } from "@/features/tasks/people";
import { RedactedLines } from "@/features/tasks/ui";
import { NOW_ISO, TODAY_KEY, addDays, isoAt, shortDay, stamp } from "@/features/tasks/time";
import { DOC_CONTENT, OUTCOME_HINT, OUTCOME_LABEL, type ReviewOutcome } from "./data";
import { SOURCE_ICON, docDue, docStatusTone, reportDateText, reportLag, uploadedText } from "./doc-meta";
import { outcomeTone } from "./doc-table";
import { canReview, contentAccess, displayTitle, patchDocument, useDocuments, type CareDocument } from "./store";

const OUTCOME_ICON: Record<ReviewOutcome, Icon> = { normal: CheckCircle, "follow-up": ListPlus, discuss: ChatCircleText };

/** Document drawer: dates, content (only for people allowed to read it), review outcome and filing. */
export function ReviewSheet({ docId, onClose, onIdentify }: { docId: string | null; onClose: () => void; onIdentify: (d: CareDocument) => void }) {
  const [shownId, setShownId] = useState<string | null>(docId);
  if (docId && docId !== shownId) setShownId(docId);
  const docs = useDocuments();
  const doc = docs.find((d) => d.id === (docId ?? shownId)) ?? null;
  return (
    <Dialog open={!!docId} onOpenChange={(o) => !o && onClose()}>
      {doc ? <SheetBody key={doc.id} doc={doc} onClose={onClose} onIdentify={onIdentify} /> : null}
    </Dialog>
  );
}

function SheetBody({ doc, onClose, onIdentify }: { doc: CareDocument; onClose: () => void; onIdentify: (d: CareDocument) => void }) {
  const { role, user } = useRole();
  const { toast } = useToast();
  const router = useRouter();
  const access = contentAccess(doc, role, user.id);
  const reviewer = staffById(doc.reviewerId ?? undefined);
  const patient = patientById(doc.patientId);
  const lag = reportLag(doc);
  const due = docDue(doc);
  const content = DOC_CONTENT[doc.id];
  const SourceIcon = SOURCE_ICON[doc.source];
  const mayReview = doc.status === "awaiting-review" && canReview(doc, role, user.id);

  const [outcome, setOutcome] = useState<ReviewOutcome | null>(null);
  const [comment, setComment] = useState("");
  const [makeTask, setMakeTask] = useState(true);
  const [taskTitle, setTaskTitle] = useState("");
  const [taskOwner, setTaskOwner] = useState(user.id);
  const [taskDue, setTaskDue] = useState(addDays(TODAY_KEY, 3));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!outcome) return;
    setMakeTask(outcome === "follow-up");
    setTaskTitle(outcome === "discuss" ? `Discuss ${doc.title.toLowerCase()} with ${patient?.name.split(" ")[0] ?? "the patient"}` : `Follow up: ${doc.title}`);
    setTaskOwner(outcome === "follow-up" && patient?.careTeam.coordinator ? patient.careTeam.coordinator : user.id);
  }, [outcome, doc.title, patient, user.id]);

  const saveReview = () => {
    if (!outcome) {
      setError("Choose an outcome.");
      return;
    }
    if (makeTask && outcome !== "normal" && !taskTitle.trim()) {
      setError("Give the follow-up task a title.");
      return;
    }
    let taskId: string | undefined;
    let taskNote = "";
    if (makeTask && outcome !== "normal") {
      const t = createTask(
        {
          title: taskTitle.trim(),
          patientId: doc.patientId ?? undefined,
          ownerId: taskOwner,
          due: isoAt(taskDue, "18:00"),
          priority: outcome === "follow-up" ? "high" : "normal",
          source: `Report review · ${doc.title}`,
          discipline: "medical",
          notes: comment.trim() || undefined,
        },
        user.id,
      );
      taskId = t.id;
      taskNote = ` Follow-up task created for ${taskOwner === user.id ? "you" : staffById(taskOwner)?.name} — due ${shortDay(isoAt(taskDue, "18:00"))}.`;
    }
    patchDocument(doc.id, { status: "reviewed", review: { outcome, by: user.id, at: NOW_ISO, comment: comment.trim() || undefined, taskId } });
    toast({
      title: `Reviewed · ${OUTCOME_LABEL[outcome]}`,
      description: `Recorded in this browser session.${taskNote} Nothing was released to the patient.`,
      tone: "success",
      action: taskId ? { label: "Open tasks", onClick: () => router.push("/tasks") } : undefined,
    });
    onClose();
  };

  const fileDoc = () => {
    patchDocument(doc.id, { status: "filed" });
    toast({ title: "Filed to the record", description: `${patient?.name ?? "Patient"}'s record · saved in this browser session.` });
    onClose();
  };

  const hasActions =
    (!!patient && role !== "patient") ||
    (doc.status === "unclassified" && role !== "patient") ||
    (doc.status === "awaiting-review" && !mayReview && role === "doctor") ||
    mayReview ||
    (doc.status === "reviewed" && role !== "patient");

  const takeOver = () => {
    patchDocument(doc.id, { reviewerId: user.id });
    toast({ title: "Reassigned to you", description: `${reviewer?.name ?? "The previous reviewer"} wasn't notified — saved in this browser session.` });
  };

  return (
    <SheetContent
      title={displayTitle(doc, access)}
      description={`${doc.type}${patient ? ` · ${patient.name}` : " · patient not identified"}`}
      footer={
        hasActions ? (
        <>
          {patient && role !== "patient" ? (
            <Button asChild variant="secondary">
              <Link href={`/patients/${patient.id}`}>
                Patient record <ArrowSquareOut />
              </Link>
            </Button>
          ) : null}
          {doc.status === "unclassified" && role !== "patient" ? (
            <Button variant="dark" onClick={() => onIdentify(doc)}>
              Identify patient
            </Button>
          ) : null}
          {doc.status === "awaiting-review" && !mayReview && role === "doctor" ? (
            <Button variant="secondary" leading={<UserSwitch />} onClick={takeOver}>
              Reassign to me
            </Button>
          ) : null}
          {mayReview ? (
            <Button variant="primary" leading={<CheckCircle />} onClick={saveReview}>
              Save review
            </Button>
          ) : null}
          {doc.status === "reviewed" && role !== "patient" ? (
            <Button variant="dark" leading={<Archive />} onClick={fileDoc}>
              File to record
            </Button>
          ) : null}
        </>
        ) : undefined
      }
    >
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge tone={docStatusTone(doc.status)}>{DOC_STATUS_LABEL[doc.status]}</StatusBadge>
        {doc.sensitivity === "restricted" ? (
          <StatusBadge tone="dark" dot={false}>
            <LockSimple size={12} aria-hidden="true" /> Restricted
          </StatusBadge>
        ) : null}
        {doc.status === "awaiting-review" ? <span className={cn("text-xs tabular", due.tone === "danger" ? "text-danger" : "text-muted")}>Review {due.text.toLowerCase()}</span> : null}
      </div>

      <dl className="mt-6 grid grid-cols-2 gap-x-4 gap-y-4 rounded-inner bg-canvas p-4 text-sm">
        <div>
          <dt className="text-xs text-muted">Report date</dt>
          <dd className="mt-0.5 text-ink tabular">{reportDateText(doc.reportDate)}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted">Uploaded to Carelane</dt>
          <dd className="mt-0.5 text-ink tabular">{uploadedText(doc.uploadedAt)}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted">Source</dt>
          <dd className="mt-0.5 inline-flex items-center gap-1.5 text-ink">
            <SourceIcon size={14} aria-hidden="true" />
            {doc.source}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted">Reviewer</dt>
          <dd className="mt-0.5 text-ink">{reviewer ? `${reviewer.name}${doc.reviewerId === user.id ? " (you)" : ""}` : "Unassigned"}</dd>
        </div>
        <div className="col-span-2">
          <dt className="text-xs text-muted">Uploaded by</dt>
          <dd className="mt-0.5 text-ink-2">
            {doc.uploadedBy} · {doc.pages} {doc.pages === 1 ? "page" : "pages"}
            {doc.fileName ? <span className="font-mono text-xs"> · {doc.fileName}</span> : null}
          </dd>
        </div>
      </dl>
      {lag ? (
        <p className="mt-2 flex items-start gap-1.5 text-xs text-warning">
          <WarningCircle size={14} className="mt-px shrink-0" aria-hidden="true" />
          Reported {lag.label} — an older report, not a new result.
        </p>
      ) : null}

      <section className="mt-6">
        <h3 className="text-xs text-muted">Content</h3>
        {access === "full" ? (
          <div className="mt-2">
            <p className="text-sm leading-relaxed text-ink">{content?.summary ?? "No transcription available — open the original file."}</p>
            {content?.values?.length ? (
              <table className="mt-3 w-full text-sm">
                <caption className="sr-only">Reported values</caption>
                <thead>
                  <tr className="text-left text-xs text-muted">
                    <th scope="col" className="pb-2 font-normal">Test</th>
                    <th scope="col" className="pb-2 text-right font-normal">Result</th>
                    <th scope="col" className="pb-2 pl-4 text-right font-normal">Reference</th>
                  </tr>
                </thead>
                <tbody>
                  {content.values.map((v) => (
                    <tr key={v.label} className="border-t border-line">
                      <td className="py-2 text-ink-2">{v.label}</td>
                      <td className="py-2 text-right tabular">
                        {v.value} <span className="text-xs text-muted">{v.unit}</span>
                        {v.flag ? <span className={cn("ml-2 rounded-full px-1.5 text-[11px]", v.flag === "high" ? "bg-danger-soft text-danger" : "bg-warning-soft text-warning")}>{v.flag === "high" ? "High" : "Low"}</span> : null}
                      </td>
                      <td className="py-2 pl-4 text-right text-xs text-muted tabular">{v.ref}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : null}
            <p className="mt-2 text-[11px] text-muted">Transcribed for this demo — verify against the original document.</p>
          </div>
        ) : (
          <div className="mt-2 rounded-inner bg-canvas p-4">
            <p className="flex items-center gap-2 text-sm text-ink">
              {access === "restricted" ? <LockSimple size={16} aria-hidden="true" /> : <ShieldCheck size={16} className="text-success" aria-hidden="true" />}
              {access === "restricted" ? "Restricted — content hidden" : "Content hidden for your role"}
            </p>
            <p className="mt-1 text-xs text-muted">
              {access === "restricted"
                ? `Only the assigned clinician${reviewer ? ` (${reviewer.name})` : ""} can open this document.`
                : "You can route and file this document; clinical content opens for the patient's care team."}
            </p>
            <RedactedLines lines={6} className="mt-4" />
          </div>
        )}
      </section>

      {doc.review && role === "patient" ? (
        <p className="mt-6 rounded-inner bg-canvas p-4 text-sm text-ink-2">
          Reviewed by {staffById(doc.review.by)?.name ?? "your care team"} on {formatDate(doc.review.at, { day: "numeric", month: "short" })}. Your care team will share anything you need to know — review notes aren&apos;t released automatically.
        </p>
      ) : doc.review ? (
        <section className="mt-6 rounded-inner bg-canvas p-4">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge tone={outcomeTone(doc.review.outcome)}>{OUTCOME_LABEL[doc.review.outcome]}</StatusBadge>
            <span className="text-xs text-muted">
              {staffById(doc.review.by)?.name ?? "Reviewer"} · {stamp(doc.review.at)}
            </span>
          </div>
          {doc.review.comment && access === "full" ? <p className="mt-2 text-sm text-ink-2">{doc.review.comment}</p> : null}
          {doc.review.taskId ? <p className="mt-2 text-xs text-muted">A follow-up task was created from this review.</p> : null}
        </section>
      ) : null}

      {doc.status === "awaiting-review" && role !== "patient" ? (
        mayReview ? (
          <section className="mt-8">
            <h3 className="text-sm text-ink" id="outcome-label">
              Review outcome
            </h3>
            <div role="radiogroup" aria-labelledby="outcome-label" className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
              {(Object.keys(OUTCOME_LABEL) as ReviewOutcome[]).map((o) => {
                const OIcon = OUTCOME_ICON[o];
                const active = outcome === o;
                return (
                  <button
                    key={o}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => {
                      setOutcome(o);
                      setError(null);
                    }}
                    className={cn(
                      "flex flex-col items-start gap-2 rounded-inner p-3 text-left transition-[background-color,color,box-shadow] duration-200",
                      active ? "bg-charcoal text-white" : "bg-surface text-ink shadow-[inset_0_0_0_1px_var(--color-line)] hover:shadow-[inset_0_0_0_1px_var(--color-line-strong)]",
                    )}
                  >
                    <OIcon size={18} aria-hidden="true" />
                    <span className="text-sm">{OUTCOME_LABEL[o]}</span>
                    <span className={cn("text-[11px] leading-snug", active ? "text-white/70" : "text-muted")}>{OUTCOME_HINT[o]}</span>
                  </button>
                );
              })}
            </div>
            {error ? <p className="mt-2 text-xs text-danger">{error}</p> : null}
            <Field label="Comment" optional className="mt-4">
              {(p) => <Textarea {...p} value={comment} onChange={(e) => setComment(e.target.value)} placeholder="What you concluded, and what should happen next." className="min-h-20" />}
            </Field>
            {outcome && outcome !== "normal" ? (
              <div className="mt-4 rounded-inner bg-canvas p-4">
                <label className="flex items-center gap-3 text-sm text-ink">
                  <Checkbox checked={makeTask} onCheckedChange={(c) => setMakeTask(c === true)} aria-label="Create a follow-up task" />
                  Create a follow-up task
                </label>
                {makeTask ? (
                  <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <Field label="Task" className="sm:col-span-2">
                      {(p) => <Input {...p} value={taskTitle} onChange={(e) => setTaskTitle(e.target.value)} className="bg-surface" />}
                    </Field>
                    <Field label="Owner">
                      {(p) => <Select {...p} value={taskOwner} onValueChange={setTaskOwner} options={staffOptions().map((o) => (o.value === user.id ? { ...o, label: `${o.label} (you)` } : o))} />}
                    </Field>
                    <Field label="Due">
                      {(p) => <Input {...p} type="date" min={TODAY_KEY} value={taskDue} onChange={(e) => setTaskDue(e.target.value)} className="bg-surface" />}
                    </Field>
                  </div>
                ) : null}
              </div>
            ) : null}
            <p className="mt-4 text-xs text-muted">Saving records your outcome in this browser session. It doesn&apos;t release anything to the patient.</p>
          </section>
        ) : (
          <p className="mt-8 rounded-inner bg-canvas p-4 text-sm text-ink-2">
            {reviewer ? `Assigned to ${reviewer.name}` : "No reviewer assigned"} — only the assigned reviewer records the outcome.
            {role === "doctor" ? " You can reassign it to yourself." : ""}
          </p>
        )
      ) : null}

      {role === "patient" && doc.status === "awaiting-review" ? (
        <p className="mt-8 rounded-inner bg-canvas p-4 text-sm text-ink-2">
          Waiting for {reviewer?.name ?? "your doctor"} to review it. You&apos;ll see the outcome here once it&apos;s released.
        </p>
      ) : null}

      <p className="mt-8 text-[11px] text-muted">Report dated {formatDate(`${doc.reportDate}T12:00:00+05:30`, { day: "numeric", month: "long", year: "numeric" })}; entered {stamp(doc.uploadedAt)}.</p>
    </SheetContent>
  );
}

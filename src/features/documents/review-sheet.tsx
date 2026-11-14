"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowSquareOut, CheckCircle, Archive, LockSimple, ShieldCheck, UserSwitch, WarningCircle } from "@phosphor-icons/react";
import { staffById } from "@/data/staff";
import { patientById } from "@/data/patients";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/cn";
import { Dialog, SheetContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input, Textarea } from "@/components/ui/input";
import { StatusBadge } from "@/components/ui/status";
import { useToast } from "@/components/ui/toast";
import { useRole } from "@/components/shell/role-context";
import { createTask } from "@/features/tasks/store";
import { RedactedLines } from "@/features/tasks/ui";
import { NOW_ISO, TODAY_KEY, addDays, isoAt, shortDay, stamp } from "@/features/tasks/time";
import { DOC_CONTENT, OUTCOME_LABEL } from "./data";
import { SOURCE_ICON, docDue, docStatusTone, reportDateText, reportLag, uploadedText } from "./doc-meta";
import { outcomeTone } from "./doc-table";
import { ARCHIVE_ROLES, MATCH_ROLES, archiveDocument, canReview, contentAccess, displayTitle, patchDocument, restoreDocument, statusText, useDocuments, type CareDocument } from "./store";
import { ValueTrends } from "./value-trends";

/** Document drawer: dates, content (only for people allowed to read it), the doctor's review, archiving. */
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
  const live = !doc.archived;
  const mayReview = live && doc.status === "awaiting-review" && canReview(doc, role, user.id);
  const mayMatch = live && doc.status === "unclassified" && MATCH_ROLES.includes(role);
  const mayArchive = ARCHIVE_ROLES.includes(role);

  const [comment, setComment] = useState("");
  const [makeTask, setMakeTask] = useState(false);
  const [taskTitle, setTaskTitle] = useState(`Follow up: ${doc.title}`);
  const [taskDue, setTaskDue] = useState(addDays(TODAY_KEY, 3));
  const [error, setError] = useState<string | null>(null);

  const markReviewed = () => {
    if (makeTask && !taskTitle.trim()) {
      setError("Give the follow-up task a title.");
      return;
    }
    let taskId: string | undefined;
    if (makeTask) {
      taskId = createTask(
        {
          title: taskTitle.trim(),
          patientId: doc.patientId ?? undefined,
          ownerId: user.id,
          due: isoAt(taskDue, "18:00"),
          priority: "high",
          source: `Report review · ${doc.title}`,
          discipline: "medical",
          notes: comment.trim() || undefined,
        },
        user.id,
      ).id;
    }
    patchDocument(doc.id, { status: "reviewed", review: { outcome: makeTask ? "follow-up" : "normal", by: user.id, at: NOW_ISO, comment: comment.trim() || undefined, taskId } });
    toast({
      title: "Marked reviewed",
      description: `It leaves your pending list and stays on ${patient?.name.split(" ")[0] ?? "the patient"}'s timeline.${taskId ? ` Follow-up task due ${shortDay(isoAt(taskDue, "18:00"))}.` : ""} Saved in this browser session — nothing was released to the patient.`,
      tone: "success",
      action: taskId ? { label: "Open tasks", onClick: () => router.push("/tasks") } : undefined,
    });
    onClose();
  };

  const takeOver = () => {
    patchDocument(doc.id, { reviewerId: user.id });
    toast({ title: "Reassigned to you", description: `${reviewer?.name ?? "The previous reviewer"} wasn't notified — saved in this browser session.` });
  };

  const archive = () => {
    archiveDocument(doc, user.id);
    toast({ title: "Archived", description: "Kept, not deleted — restore it from Archived. Recorded in the activity log.", action: { label: "Undo", onClick: () => restoreDocument(doc, user.id) } });
    onClose();
  };

  const hasActions = (!!patient && role !== "patient") || mayMatch || (live && doc.status === "awaiting-review" && !mayReview && role === "doctor") || mayReview;

  return (
    <SheetContent
      title={displayTitle(doc, access)}
      description={`${doc.type}${patient ? ` · ${patient.name}` : " · patient not matched"}`}
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
            {mayMatch ? (
              <Button variant="dark" onClick={() => onIdentify(doc)}>
                {doc.patientId ? "Confirm & file" : "Match patient"}
              </Button>
            ) : null}
            {live && doc.status === "awaiting-review" && !mayReview && role === "doctor" ? (
              <Button variant="secondary" leading={<UserSwitch />} onClick={takeOver}>
                Reassign to me
              </Button>
            ) : null}
            {mayReview ? (
              <Button variant="primary" leading={<CheckCircle />} onClick={markReviewed}>
                Mark reviewed
              </Button>
            ) : null}
          </>
        ) : undefined
      }
    >
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge tone={doc.archived ? "neutral" : docStatusTone(doc.status)}>{statusText(doc)}</StatusBadge>
        {doc.sensitivity === "restricted" ? (
          <StatusBadge tone="dark" dot={false}>
            <LockSimple size={12} aria-hidden="true" /> Restricted
          </StatusBadge>
        ) : null}
        {live && doc.status === "awaiting-review" ? <span className={cn("text-xs tabular", due.tone === "danger" ? "text-danger" : "text-muted")}>Review {due.text.toLowerCase()}</span> : null}
      </div>

      {doc.archived ? (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-inner bg-canvas p-4">
          <p className="text-sm text-ink-2">
            Archived by {staffById(doc.archived.by)?.name ?? "staff"} · {stamp(doc.archived.at)}
          </p>
          {mayArchive ? (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                restoreDocument(doc, user.id);
                toast({ title: "Restored", description: "Back in its queue. Recorded in the activity log." });
              }}
            >
              Restore
            </Button>
          ) : null}
        </div>
      ) : null}

      <dl className="mt-6 grid grid-cols-2 gap-x-4 gap-y-4 rounded-inner bg-canvas p-4 text-sm">
        <div>
          <dt className="text-xs text-muted">Date issued</dt>
          <dd className="mt-0.5 text-ink tabular">{reportDateText(doc.reportDate)}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted">Uploaded</dt>
          <dd className="mt-0.5 text-ink tabular">{uploadedText(doc.uploadedAt)}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted">Uploaded by</dt>
          <dd className="mt-0.5 inline-flex items-center gap-1.5 text-ink">
            <SourceIcon size={14} aria-hidden="true" />
            {doc.source === "Patient upload" ? `${doc.uploadedBy} · patient app` : doc.uploadedBy}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted">Reviewer</dt>
          <dd className="mt-0.5 text-ink">{reviewer ? `${reviewer.name}${doc.reviewerId === user.id ? " (you)" : ""}` : doc.status === "filed" ? "No review needed" : "Not assigned"}</dd>
        </div>
        <div className="col-span-2">
          <dt className="text-xs text-muted">File</dt>
          <dd className="mt-0.5 text-ink-2">
            {doc.type} · {doc.pages} {doc.pages === 1 ? "page" : "pages"}
            {doc.fileName ? <span className="font-mono text-xs"> · {doc.fileName}</span> : null}
          </dd>
        </div>
      </dl>
      {lag ? (
        <p className="mt-2 flex items-start gap-1.5 text-xs text-warning">
          <WarningCircle size={14} className="mt-px shrink-0" aria-hidden="true" />
          Issued {lag.label} — an older report, not a new result.
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
            {content?.values?.length ? <ValueTrends doc={doc} values={content.values} role={role} /> : null}
          </div>
        ) : (
          <div className="mt-2 rounded-inner bg-canvas p-4">
            <p className="flex items-center gap-2 text-sm text-ink">
              {access === "restricted" ? <LockSimple size={16} aria-hidden="true" /> : <ShieldCheck size={16} className="text-success" aria-hidden="true" />}
              {access === "restricted" ? "Restricted — content hidden" : "File name and type only"}
            </p>
            <p className="mt-1 text-xs text-muted">
              {access === "restricted"
                ? `Only the assigned clinician${reviewer ? ` (${reviewer.name})` : ""} can open this document.`
                : "Clinical content opens for the patient's care team."}
            </p>
            <RedactedLines lines={6} className="mt-4" />
          </div>
        )}
      </section>

      {doc.review && role === "patient" ? (
        <p className="mt-6 rounded-inner bg-canvas p-4 text-sm text-ink-2">
          Reviewed by {staffById(doc.review.by)?.name ?? "your doctor"} on {formatDate(doc.review.at, { day: "numeric", month: "short" })}. Your care team will share anything you need to know — review notes aren&apos;t released automatically.
        </p>
      ) : doc.review ? (
        <section className="mt-6 rounded-inner bg-canvas p-4">
          <div className="flex flex-wrap items-center gap-2">
            {access === "full" ? <StatusBadge tone={outcomeTone(doc.review.outcome)}>{OUTCOME_LABEL[doc.review.outcome]}</StatusBadge> : <StatusBadge tone="success">Reviewed</StatusBadge>}
            <span className="text-xs text-muted">
              {staffById(doc.review.by)?.name ?? "Reviewer"} · {stamp(doc.review.at)}
            </span>
          </div>
          {doc.review.comment && access === "full" ? <p className="mt-2 text-sm text-ink-2">{doc.review.comment}</p> : null}
          {doc.review.taskId && access === "full" ? <p className="mt-2 text-xs text-muted">A follow-up task was created from this review.</p> : null}
        </section>
      ) : null}

      {live && doc.status === "awaiting-review" && role !== "patient" ? (
        mayReview ? (
          <section className="mt-8">
            <h3 className="text-sm text-ink">Your review</h3>
            <Field label="Comment" optional className="mt-3">
              {(p) => <Textarea {...p} value={comment} onChange={(e) => setComment(e.target.value)} placeholder="What you concluded, if anything needs saying." className="min-h-20" />}
            </Field>
            <div className="mt-4 rounded-inner bg-canvas p-4">
              <label className="flex items-center gap-3 text-sm text-ink">
                <Checkbox checked={makeTask} onCheckedChange={(c) => setMakeTask(c === true)} aria-label="Add a follow-up task for me" />
                Add a follow-up task for me
              </label>
              {makeTask ? (
                <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_160px]">
                  <Field label="Task">
                    {(p) => (
                      <Input
                        {...p}
                        value={taskTitle}
                        onChange={(e) => {
                          setTaskTitle(e.target.value);
                          setError(null);
                        }}
                        className="bg-surface"
                      />
                    )}
                  </Field>
                  <Field label="Due">
                    {(p) => <Input {...p} type="date" min={TODAY_KEY} value={taskDue} onChange={(e) => setTaskDue(e.target.value)} className="bg-surface" />}
                  </Field>
                </div>
              ) : null}
              {error ? <p className="mt-2 text-xs text-danger">{error}</p> : null}
            </div>
            <p className="mt-4 text-xs text-muted">Marking it reviewed doesn&apos;t release anything to the patient.</p>
          </section>
        ) : (
          <p className="mt-8 rounded-inner bg-canvas p-4 text-sm text-ink-2">
            {reviewer ? `Assigned to ${reviewer.name}` : "No reviewer assigned"} — only the assigned doctor marks it reviewed.
            {role === "doctor" ? " You can reassign it to yourself." : ""}
          </p>
        )
      ) : null}

      {role === "patient" && doc.status === "awaiting-review" ? (
        <p className="mt-8 rounded-inner bg-canvas p-4 text-sm text-ink-2">
          Waiting for {reviewer?.name ?? "your doctor"} to review it. You&apos;ll see when it&apos;s reviewed here.
        </p>
      ) : null}

      <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
        <p className="text-[11px] text-muted">
          Issued {formatDate(`${doc.reportDate}T12:00:00+05:30`, { day: "numeric", month: "long", year: "numeric" })}; uploaded {stamp(doc.uploadedAt)}.
        </p>
        {mayArchive && live ? (
          <Button size="sm" variant="ghost" leading={<Archive />} onClick={archive}>
            Archive
          </Button>
        ) : null}
      </div>
    </SheetContent>
  );
}

"use client";

import { IdentificationCard, LockSimple } from "@phosphor-icons/react";
import type { DocStatus, Role } from "@/data/types";
import { staffById } from "@/data/staff";
import { cn } from "@/lib/cn";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status";
import { DOC_STATUS_LABEL } from "@/data/records";
import { PersonInline } from "@/features/tasks/ui";
import { OrganTag } from "@/features/tasks/organ-glyph";
import { OUTCOME_LABEL, type ReviewOutcome } from "./data";
import { SOURCE_ICON, TYPE_ICON, docDue, docStatusTone, reportDateText, reportLag, uploadedText } from "./doc-meta";
import { canReview, contentAccess, displayTitle, type CareDocument } from "./store";

const SOURCE_SHORT: Record<CareDocument["source"], string> = {
  "Patient upload": "Patient",
  "Front desk scan": "Front desk",
  "Lab partner": "Lab partner",
  "Email import": "Email",
  "Staff upload": "Staff",
};

export const outcomeTone = (o: ReviewOutcome) => ({ normal: "success", "follow-up": "warning", discuss: "info" } as const)[o];

/**
 * The intake & review table. Report date and upload date are separate columns — an old report
 * uploaded today must never read as a new result. Below md the rows become stacked cards.
 */
export function DocTable({
  docs,
  tab,
  role,
  userId,
  flashId,
  onOpen,
  onIdentify,
}: {
  docs: CareDocument[];
  tab: DocStatus | "mine";
  role: Role;
  userId: string;
  flashId: string | null;
  onOpen: (d: CareDocument) => void;
  onIdentify: (d: CareDocument) => void;
}) {
  const isPatient = role === "patient";
  const showOutcome = tab === "reviewed" || tab === "filed";

  return (
    <>
      {/* md+: table */}
      <div className="scrollbar-thin relative hidden overflow-x-auto rounded-card bg-surface md:block">
        <table className="w-full min-w-[960px] text-sm">
          <caption className="sr-only">Documents — {tab === "mine" ? "your documents" : DOC_STATUS_LABEL[tab]}</caption>
          <thead>
            <tr className="text-left text-xs text-muted">
              <th scope="col" className="py-4 pl-6 pr-2 font-normal">Document</th>
              {!isPatient ? <th scope="col" className="px-2 py-4 font-normal">Patient</th> : null}
              <th scope="col" className="px-2 py-4 font-normal">Report date</th>
              <th scope="col" className="px-2 py-4 font-normal">Uploaded</th>
              <th scope="col" className="px-2 py-4 font-normal">Source</th>
              <th scope="col" className="px-2 py-4 font-normal">Reviewer</th>
              <th scope="col" className="px-2 py-4 font-normal">{isPatient ? "Status" : showOutcome ? "Outcome" : "Due"}</th>
              <th scope="col" className="py-4 pl-2 pr-6 text-right font-normal">
                <span className="sr-only">Action</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {docs.map((d) => {
              const access = contentAccess(d, role, userId);
              const TypeIcon = access === "restricted" ? LockSimple : TYPE_ICON[d.type];
              const SourceIcon = SOURCE_ICON[d.source];
              const lag = reportLag(d);
              const due = docDue(d);
              const reviewer = staffById(d.reviewerId ?? undefined);
              return (
                <tr key={d.id} data-doc-id={d.id} className={cn("border-t border-line align-top transition-colors duration-700", flashId === d.id ? "bg-primary-soft" : "hover:bg-canvas/70")}>
                  <td className="py-4 pl-6 pr-2">
                    <div className="flex min-w-[190px] max-w-[260px] items-start gap-3">
                      <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-full", access === "restricted" ? "bg-charcoal text-white" : "bg-sunken text-ink-2")}>
                        <TypeIcon size={16} aria-hidden="true" />
                      </span>
                      <div className="min-w-0">
                        <button type="button" onClick={() => onOpen(d)} className="text-left text-sm text-ink underline-offset-2 hover:underline">
                          {displayTitle(d, access)}
                        </button>
                        <p className="mt-0.5 text-xs text-muted">
                          {d.type} · {d.pages} {d.pages === 1 ? "page" : "pages"}
                          {d.local ? " · added this session" : ""}
                        </p>
                      </div>
                    </div>
                  </td>
                  {!isPatient ? (
                    <td className="px-2 py-4">
                      {d.patientId ? (
                        <span className="flex max-w-[160px] flex-col items-start gap-1.5">
                          <PersonInline id={d.patientId} link className="max-w-full text-sm" />
                          {access === "restricted" ? null : <OrganTag patientId={d.patientId} className="max-w-full" />}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-sm text-warning">
                          <IdentificationCard size={16} aria-hidden="true" />
                          Not identified
                        </span>
                      )}
                    </td>
                  ) : null}
                  <td className="px-2 py-4">
                    <span className="whitespace-nowrap text-ink tabular">{reportDateText(d.reportDate)}</span>
                    {lag ? <span className="mt-1 flex w-max rounded-full bg-warning-soft px-2 py-0.5 text-[11px] text-warning">{lag.label}</span> : null}
                  </td>
                  <td className="px-2 py-4">
                    <span className="whitespace-nowrap text-ink tabular">{uploadedText(d.uploadedAt)}</span>
                    <span className="mt-0.5 block max-w-[140px] truncate text-xs text-muted" title={d.uploadedBy}>by {d.uploadedBy}</span>
                  </td>
                  <td className="px-2 py-4">
                    <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-ink-2" title={d.source}>
                      <SourceIcon size={16} className="text-muted" aria-hidden="true" />
                      {SOURCE_SHORT[d.source]}
                    </span>
                  </td>
                  <td className="px-2 py-4">
                    {reviewer ? (
                      <span className="flex items-start gap-2 text-ink-2">
                        <Avatar src={reviewer.avatar} name={reviewer.name} size="xs" />
                        <span className="min-w-0">
                          <span className="block max-w-[130px] truncate">{reviewer.name}</span>
                          {d.reviewerId === userId ? <span className="block text-xs text-muted">You</span> : null}
                        </span>
                      </span>
                    ) : (
                      <span className="text-muted">Unassigned</span>
                    )}
                  </td>
                  <td className="px-2 py-4">
                    {isPatient ? (
                      <StatusBadge tone={docStatusTone(d.status)}>{DOC_STATUS_LABEL[d.status]}</StatusBadge>
                    ) : showOutcome && d.review ? (
                      <StatusBadge tone={outcomeTone(d.review.outcome)}>{OUTCOME_LABEL[d.review.outcome]}</StatusBadge>
                    ) : (
                      <span className={cn("whitespace-nowrap tabular", due.tone === "danger" ? "text-danger" : due.tone === "ink" ? "text-ink" : "text-muted")}>{due.text}</span>
                    )}
                  </td>
                  <td className="py-4 pl-2 pr-6 text-right">
                    <RowAction doc={d} role={role} userId={userId} onOpen={onOpen} onIdentify={onIdentify} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* < md: stacked cards */}
      <ul className="flex flex-col gap-2 md:hidden">
        {docs.map((d) => {
          const access = contentAccess(d, role, userId);
          const TypeIcon = access === "restricted" ? LockSimple : TYPE_ICON[d.type];
          const lag = reportLag(d);
          const due = docDue(d);
          const reviewer = staffById(d.reviewerId ?? undefined);
          return (
            <li key={d.id} data-doc-id={d.id} className={cn("rounded-card p-4 transition-colors duration-700", flashId === d.id ? "bg-primary-soft" : "bg-surface")}>
              <div className="flex items-start gap-3">
                <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-full", access === "restricted" ? "bg-charcoal text-white" : "bg-sunken text-ink-2")}>
                  <TypeIcon size={16} aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                  <button type="button" onClick={() => onOpen(d)} className="text-left text-sm text-ink">
                    {displayTitle(d, access)}
                  </button>
                  <p className="text-xs text-muted">
                    {d.type} · {d.source}
                  </p>
                </div>
                {isPatient ? <StatusBadge tone={docStatusTone(d.status)}>{DOC_STATUS_LABEL[d.status]}</StatusBadge> : null}
              </div>
              {!isPatient ? (
                <div className="mt-3 text-sm">
                  {d.patientId ? (
                    <span className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                      <PersonInline id={d.patientId} link className="min-w-0" />
                      {access === "restricted" ? null : <OrganTag patientId={d.patientId} />}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 text-warning">
                      <IdentificationCard size={16} aria-hidden="true" />
                      Not identified
                    </span>
                  )}
                </div>
              ) : null}
              <dl className="mt-3 grid grid-cols-2 gap-2 rounded-inner bg-canvas p-3 text-xs">
                <div>
                  <dt className="text-muted">Report date</dt>
                  <dd className="mt-0.5 text-ink tabular">{reportDateText(d.reportDate)}</dd>
                  {lag ? <dd className="mt-1 text-[11px] text-warning">{lag.label}</dd> : null}
                </div>
                <div>
                  <dt className="text-muted">Uploaded</dt>
                  <dd className="mt-0.5 text-ink tabular">{uploadedText(d.uploadedAt)}</dd>
                </div>
                <div>
                  <dt className="text-muted">Reviewer</dt>
                  <dd className="mt-0.5 truncate text-ink">{reviewer?.name ?? "Unassigned"}</dd>
                </div>
                <div>
                  <dt className="text-muted">{isPatient ? "Review" : d.review ? "Outcome" : "Due"}</dt>
                  <dd className={cn("mt-0.5", d.review ? "text-ink" : due.tone === "danger" && !isPatient ? "text-danger" : "text-ink")}>
                    {isPatient ? (d.review ? "Reviewed" : "Not yet reviewed") : d.review ? OUTCOME_LABEL[d.review.outcome] : due.text}
                  </dd>
                </div>
              </dl>
              <div className="mt-3 flex justify-end">
                <RowAction doc={d} role={role} userId={userId} onOpen={onOpen} onIdentify={onIdentify} />
              </div>
            </li>
          );
        })}
      </ul>
    </>
  );
}

function RowAction({ doc, role, userId, onOpen, onIdentify }: { doc: CareDocument; role: Role; userId: string; onOpen: (d: CareDocument) => void; onIdentify: (d: CareDocument) => void }) {
  if (doc.status === "unclassified" && role !== "patient") {
    return (
      <Button size="sm" variant="dark" onClick={() => onIdentify(doc)}>
        Identify patient
      </Button>
    );
  }
  if (doc.status === "awaiting-review" && canReview(doc, role, userId)) {
    return (
      <Button size="sm" variant="dark" onClick={() => onOpen(doc)}>
        Review
      </Button>
    );
  }
  return (
    <Button size="sm" variant="secondary" onClick={() => onOpen(doc)}>
      Open
    </Button>
  );
}

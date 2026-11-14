import { Check, Minus, PuzzlePiece } from "@phosphor-icons/react/ssr";
import { PLANS, type PlanId } from "@/data/plans";
import { cn } from "@/lib/cn";

/**
 * "Documents by plan" (spec): every clinical document is in Core; Clinic adds financial documents;
 * Pro adds documents shared with and created by the patient. Records shared via ABDM are an add-on
 * on any plan. Desktop: one table; phones: one row per document with the three plan marks inline.
 */
type Mark = boolean | "add-on";

export interface PlanDocument {
  name: string;
  detail?: string;
  /** first plan that includes it (and every plan above), or "add-on" */
  from: PlanId | "add-on";
  by: string;
  notes: string;
}

export const DOCUMENTS_BY_PLAN: PlanDocument[] = [
  { name: "Registration and intake form", from: "core", by: "Admin / Reception; patient in Pro", notes: "Patient fills it in the app in Pro" },
  { name: "DPDP consent record", from: "core", by: "Admin / Reception", notes: "Required; never behind a higher plan" },
  { name: "Uploaded reports", detail: "Lab, imaging, discharge summary, outside prescription", from: "core", by: "Any uploader", notes: "Date issued, date uploaded, source, reviewer" },
  { name: "Consultation note + addenda", from: "core", by: "Doctor", notes: "Can't be edited after signing" },
  { name: "Prescription / visit summary", from: "core", by: "Doctor", notes: "Printable on letterhead" },
  { name: "Nutrition plan (versioned PDF)", from: "core", by: "Nutritionist", notes: "Printed or shared as a PDF in Core and Clinic" },
  { name: "Nutrition assessment", from: "core", by: "Nutritionist", notes: "" },
  { name: "Yoga precautions sheet", from: "core", by: "Doctor", notes: "Instructor view; acknowledgement recorded" },
  { name: "Session and attendance record", from: "core", by: "Instructor", notes: "" },
  { name: "Full patient record export", from: "core", by: "Admin", notes: "PDF" },
  { name: "Appointment confirmation", from: "clinic", by: "System", notes: "Sent by WhatsApp/SMS only with the add-on" },
  { name: "Invoice and receipt", from: "clinic", by: "Reception", notes: "GST-ready" },
  { name: "Package statement", from: "clinic", by: "System", notes: "Sessions used and remaining, expiry" },
  { name: "Records released to the patient", from: "pro", by: "Doctor, Nutritionist", notes: "Release is a separate step from signing" },
  { name: "Patient-uploaded documents", from: "pro", by: "Patient", notes: "Intake queue: matched and reviewed before use" },
  { name: "Food logs, home readings", from: "pro", by: "Patient", notes: "Self-reported until reviewed" },
  { name: "Programme completion summary", from: "pro", by: "Care team", notes: "" },
  { name: "Records shared via ABDM", from: "add-on", by: "System", notes: "Consent-based sharing via ABHA" },
];

export const DOCUMENT_RULES = [
  "Every document carries its type, patient, date issued, date uploaded, who uploaded it and its review status.",
  "A report uploaded today with an older date issued is never shown as a new result. Timelines sort by date issued.",
  "Clinical documents are visible to the patient's care team. Admin and reception see the file name and type only.",
  "Documents are never deleted, only archived — and archiving is recorded in the activity log.",
  "Anything the patient entered is labelled self-reported until a practitioner reviews it.",
  "Nothing shows as signed, paid or sent unless it actually happened.",
];

const markFor = (d: PlanDocument, plan: PlanId): Mark => {
  if (d.from === "add-on") return "add-on";
  return PLANS.findIndex((p) => p.id === plan) >= PLANS.findIndex((p) => p.id === d.from);
};

function DocMark({ mark }: { mark: Mark }) {
  if (mark === "add-on")
    return (
      <span className="inline-flex h-6 items-center gap-1 rounded-full bg-sunken px-2 text-[11px] text-ink-2">
        <PuzzlePiece size={12} aria-hidden="true" />
        Add-on
      </span>
    );
  return mark ? (
    <>
      <Check size={18} weight="bold" aria-hidden="true" className="text-ink" />
      <span className="sr-only">Included</span>
    </>
  ) : (
    <>
      <Minus size={18} aria-hidden="true" className="text-faint" />
      <span className="sr-only">Not included</span>
    </>
  );
}

export function DocumentsByPlan({ className }: { className?: string }) {
  return (
    <div className={className}>
      {/* ≥ md: table */}
      <div className="hidden rounded-card bg-surface px-2 pb-2 md:block">
        <table className="w-full border-separate border-spacing-0 text-left text-sm">
          <caption className="sr-only">Documents included in each Carelane plan, who creates them, and notes</caption>
          <thead>
            <tr>
              <th scope="col" className="px-4 pb-4 pt-6 text-xs font-normal text-muted">
                Document
              </th>
              {PLANS.map((p) => (
                <th key={p.id} scope="col" className="w-[9%] px-2 pb-4 pt-6 text-center text-xs font-normal text-ink">
                  {p.name}
                </th>
              ))}
              <th scope="col" className="w-[20%] px-4 pb-4 pt-6 text-xs font-normal text-muted">
                Created by
              </th>
              <th scope="col" className="w-[28%] px-4 pb-4 pt-6 text-xs font-normal text-muted">
                Notes
              </th>
            </tr>
          </thead>
          <tbody>
            {DOCUMENTS_BY_PLAN.map((d) => (
              <tr key={d.name} className="group/row">
                <th scope="row" className="rounded-l-inner px-4 py-3 font-normal transition-colors group-hover/row:bg-canvas">
                  <span className="block text-ink">{d.name}</span>
                  {d.detail ? <span className="block text-xs text-muted">{d.detail}</span> : null}
                </th>
                {PLANS.map((p) => (
                  <td key={p.id} className="px-2 py-3 text-center transition-colors group-hover/row:bg-canvas">
                    <span className="inline-flex justify-center">
                      <DocMark mark={markFor(d, p.id)} />
                    </span>
                  </td>
                ))}
                <td className="px-4 py-3 text-ink-2 transition-colors group-hover/row:bg-canvas">{d.by}</td>
                <td className="rounded-r-inner px-4 py-3 text-muted transition-colors group-hover/row:bg-canvas">{d.notes || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* < md: one row per document */}
      <ul className="flex flex-col gap-2 md:hidden" aria-label="Documents by plan">
        {DOCUMENTS_BY_PLAN.map((d) => (
          <li key={d.name} className="rounded-card bg-surface p-4">
            <p className="text-sm text-ink">{d.name}</p>
            {d.detail ? <p className="text-xs text-muted">{d.detail}</p> : null}
            <ul className="mt-3 grid grid-cols-3 gap-2" aria-label={`${d.name} by plan`}>
              {PLANS.map((p) => {
                const mark = markFor(d, p.id);
                return (
                  <li key={p.id} className={cn("flex h-9 items-center justify-between gap-2 rounded-inner px-3 text-xs", mark === true ? "bg-sunken text-ink" : "text-muted shadow-[inset_0_0_0_1px_var(--color-line)]")}>
                    {p.name}
                    {mark === "add-on" ? (
                      <PuzzlePiece size={14} aria-label="Add-on" />
                    ) : (
                      <span className="inline-flex">
                        <DocMark mark={mark} />
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
            <p className="mt-3 text-xs text-muted">
              <span className="text-ink-2">{d.by}</span>
              {d.notes ? ` · ${d.notes}` : ""}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}

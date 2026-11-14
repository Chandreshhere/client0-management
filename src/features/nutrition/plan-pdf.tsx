"use client";

import { useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { FilePdf, Printer } from "@phosphor-icons/react";
import { PLAN_STATUS_LABEL } from "@/data/programs";
import { clinicNumber, patientById } from "@/data/patients";
import { CLINIC, staffById } from "@/data/staff";
import { formatDate } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Dialog, ModalContent } from "@/components/ui/dialog";
import { AddOnNotice } from "@/components/shell/plan-switcher";
import { useRole } from "@/components/shell/role-context";
import { GUIDANCE, SLOTS } from "./data";
import { followedVersion, kcal, type PlanRecord } from "./model";

/**
 * "Plan PDF" (spec F6): the plan as the patient gets it — printed, or saved as a PDF from the
 * browser's print dialog. Available on every plan; in Core and Clinic it is how the patient gets
 * the plan (no patient app). Sending it by WhatsApp/SMS is the messaging add-on, shown as such.
 */
export function PlanPdfButton({ plan, size = "md", variant = "secondary", label = "Plan PDF" }: { plan: PlanRecord; size?: "sm" | "md"; variant?: "secondary" | "ghost" | "dark"; label?: string }) {
  return (
    <PlanPdfDialog plan={plan}>
      {(open) => (
        <Button size={size} variant={variant} leading={<FilePdf />} onClick={open}>
          {label}
        </Button>
      )}
    </PlanPdfDialog>
  );
}


export function PlanPdfDialog({ plan, children }: { plan: PlanRecord; children: (open: () => void) => ReactNode }) {
  const [open, setOpen] = useState(false);
  const { has } = useRole();
  const patient = patientById(plan.patientId);
  const published = plan.status === "published";
  const follows = followedVersion(plan);
  return (
    <>
      {children(() => setOpen(true))}
      <Dialog open={open} onOpenChange={setOpen}>
        {open ? (
          <ModalContent
            size="lg"
            title="Plan PDF"
            description={`${patient?.name ?? "Patient"} · v${plan.version} · ${published ? "the version the patient follows" : `${PLAN_STATUS_LABEL[plan.status]} — ${follows ? `the patient follows v${follows}` : "not yet published"}`}`}
            footer={
              <>
                <Button variant="ghost" onClick={() => setOpen(false)}>
                  Close
                </Button>
                <Button variant="primary" leading={<Printer />} onClick={() => window.print()}>
                  Print or save as PDF
                </Button>
              </>
            }
          >
            <div className="flex flex-col gap-4">
              <div className="rounded-inner bg-canvas p-2">
                <PlanSheet plan={plan} />
              </div>
              <AddOnNotice addOn="messaging">
                Send the plan to the patient on WhatsApp or SMS with the WhatsApp / SMS add-on. On this plan, print it or save the PDF{has("release") ? ", or release it to the patient app" : ""}.
              </AddOnNotice>
            </div>
            {/* Print copy: the only thing on the page while printing. */}
            {createPortal(
              <div id="plan-print-root" className="hidden print:block">
                <style>{`@media print { body > *:not(#plan-print-root) { display: none !important; } #plan-print-root { display: block !important; } @page { margin: 16mm; } }`}</style>
                <PlanSheet plan={plan} print />
              </div>,
              document.body,
            )}
          </ModalContent>
        ) : null}
      </Dialog>
    </>
  );
}

function PlanSheet({ plan, print = false }: { plan: PlanRecord; print?: boolean }) {
  const patient = patientById(plan.patientId);
  const author = staffById(plan.authorId);
  const guidance = GUIDANCE[plan.patientId];
  const targets = guidance?.targets ?? { kcal: plan.calories, protein: 60, fibre: 25 };
  const published = plan.status === "published";
  return (
    <article className={print ? "bg-white text-black" : "rounded-inner bg-surface p-6"} aria-label="Plan PDF preview">
      <header className="flex flex-wrap items-start justify-between gap-4 border-b border-line pb-4">
        <div className="min-w-0">
          <p className="text-xs text-muted">{CLINIC.name}</p>
          <h3 className="mt-1 text-xl font-light tracking-[-0.01em] text-ink">Nutrition plan</h3>
        </div>
        <div className="text-right text-xs text-muted">
          <p className="font-mono">{clinicNumber(plan.patientId)}</p>
          <p className="mt-1">{formatDate(plan.updatedAt, { day: "numeric", month: "short", year: "numeric" })}</p>
        </div>
      </header>
      <div className="mt-4 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
        <p className="text-sm text-ink">
          {patient?.name} <span className="text-muted">· {patient?.age} · {plan.preference}</span>
        </p>
        <p className="text-xs text-ink-2">
          {plan.title} · v{plan.version}
          {published ? "" : ` · ${PLAN_STATUS_LABEL[plan.status]}`}
        </p>
      </div>
      {!published ? <p className="mt-2 text-xs text-warning">Not yet published — check with the nutritionist before giving this version to the patient.</p> : null}
      <p className="mt-3 text-xs text-ink-2 tabular">
        Daily targets: {kcal(targets.kcal)} kcal · protein {targets.protein} g · fibre {targets.fibre} g
      </p>
      <ol className="mt-4 flex flex-col">
        {SLOTS.map((s) => {
          const items = plan.slots[s.id];
          return (
            <li key={s.id} className="grid grid-cols-[96px_minmax(0,1fr)] gap-3 border-t border-line py-3 sm:grid-cols-[136px_minmax(0,1fr)]">
              <div>
                <p className="text-sm text-ink">{s.label}</p>
                <p className="text-xs text-muted tabular">{s.home}</p>
              </div>
              {items.length ? (
                <ul className="flex min-w-0 flex-col gap-1.5">
                  {items.map((it) => (
                    <li key={it.id} className="text-sm text-ink-2">
                      <span className="text-ink">{it.name}</span> — {it.portion}
                      {it.alternatives.length ? <span className="block text-xs text-muted">or {it.alternatives.map((a) => `${a.name} (${a.portion})`).join(", or ")}</span> : null}
                      {it.note ? <span className="block text-xs text-muted">{it.note}</span> : null}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted">—</p>
              )}
            </li>
          );
        })}
      </ol>
      <footer className="mt-2 border-t border-line pt-3 text-xs text-muted">
        Prepared by {author?.name ?? "your nutritionist"} · {author?.title ?? "Nutritionist"}. Questions about this plan? Call the clinic.
      </footer>
    </article>
  );
}

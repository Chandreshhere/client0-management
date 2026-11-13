"use client";

import { useEffect, useState } from "react";
import { HandCoins, ShieldWarning } from "@phosphor-icons/react";
import { patientById } from "@/data/patients";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, ModalContent } from "@/components/ui/dialog";
import { Checkbox, Field, Input } from "@/components/ui/input";
import { Segmented } from "@/components/ui/segmented";
import { useToast } from "@/components/ui/toast";
import { useRole } from "@/components/shell/role-context";
import { InfoNote } from "@/features/settings/ui";
import { RECORDABLE_METHODS } from "./data";
import { METHOD_ICON, money } from "./meta";
import { recordPayment, undoPayment, type InvoiceView } from "./store";

type Method = (typeof RECORDABLE_METHODS)[number];
type Errors = Partial<Record<"amount" | "proof", string>>;

/**
 * Manual payment entry. Saved in this browser session only and labelled "Recorded manually —
 * gateway confirmation not connected" wherever it shows; never presented as a gateway success.
 */
export function RecordPaymentModal({ invoice, onClose, onRecorded }: { invoice: InvoiceView | null; onClose: () => void; onRecorded: (invoiceId: string) => void }) {
  const { toast } = useToast();
  const { user } = useRole();
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<Method>("UPI");
  const [reference, setReference] = useState("");
  const [proof, setProof] = useState(false);
  const [errors, setErrors] = useState<Errors>({});

  useEffect(() => {
    if (!invoice) return;
    setAmount(String(invoice.balance));
    setMethod(invoice.method && invoice.method !== "Package credit" ? invoice.method : "UPI");
    setReference("");
    setProof(false);
    setErrors({});
  }, [invoice]);

  const failed = invoice?.display === "failed";
  const p = invoice ? patientById(invoice.patientId) : undefined;

  function validate(): Errors {
    const e: Errors = {};
    const raw = amount.trim();
    const n = Number(raw);
    if (!raw) e.amount = "Enter the amount received.";
    else if (!/^\d+$/.test(raw)) e.amount = "Use whole rupees, digits only.";
    else if (n <= 0) e.amount = "The amount must be more than ₹0.";
    else if (invoice && n > invoice.balance) e.amount = `That's more than the balance due (${money(invoice.balance)}).`;
    if (failed && !proof) e.proof = "Confirm you've seen proof of payment before recording it.";
    return e;
  }

  function submit() {
    if (!invoice) return;
    const e = validate();
    setErrors(e);
    if (Object.keys(e).length) return;
    const n = Number(amount.trim());
    const id = recordPayment({ invoiceId: invoice.id, amount: n, method, reference, byId: user.id });
    onRecorded(invoice.id);
    toast({
      tone: "success",
      title: "Payment recorded manually",
      description: `${money(n)} by ${method} on ${invoice.number}. ${method === "Cash" ? "Saved in this browser session only." : "Gateway confirmation isn't connected, so it shows as “Recorded manually”. Saved in this browser session only."}`,
      action: { label: "Undo", onClick: () => undoPayment(id, user.id) },
    });
    onClose();
  }

  return (
    <Dialog open={!!invoice} onOpenChange={(o) => (!o ? onClose() : undefined)}>
      {invoice ? (
        <ModalContent
          size="md"
          title="Record payment"
          description={
            <>
              <span className="font-mono">{invoice.number}</span> · {p?.name ?? "Unknown patient"} · balance due {money(invoice.balance)}
            </>
          }
          footer={
            <>
              <DialogClose asChild>
                <Button variant="ghost">Cancel</Button>
              </DialogClose>
              <Button variant="primary" leading={<HandCoins />} onClick={submit}>
                Record {/^\d+$/.test(amount.trim()) && Number(amount) > 0 ? money(Number(amount)) : "payment"}
              </Button>
            </>
          }
        >
          <form
            className="flex flex-col gap-5"
            onSubmit={(ev) => {
              ev.preventDefault();
              submit();
            }}
            noValidate
          >
            {failed ? (
              <InfoNote tone="danger" icon={<ShieldWarning />}>
                The UPI request for this invoice was never confirmed by the gateway. Only record a payment if you have proof — a bank statement entry or UTR. A screenshot or browser redirect is not proof of payment.
              </InfoNote>
            ) : null}

            <Field label="Amount received" error={errors.amount} hint={`Balance due ${money(invoice.balance)}${invoice.paidNow > 0 ? ` · ${money(invoice.paidNow)} already paid` : ""}`}>
              {(a) => (
                <div className="relative">
                  <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-sm text-muted" aria-hidden="true">
                    ₹
                  </span>
                  <Input
                    {...a}
                    inputMode="numeric"
                    autoComplete="off"
                    className="pl-8 tabular"
                    value={amount}
                    onChange={(ev) => {
                      setAmount(ev.target.value);
                      if (errors.amount) setErrors((x) => ({ ...x, amount: undefined }));
                    }}
                  />
                </div>
              )}
            </Field>
            {invoice.balance > 0 && Number(amount) !== invoice.balance ? (
              <button type="button" onClick={() => setAmount(String(invoice.balance))} className="-mt-3 w-max text-xs text-ink underline underline-offset-2">
                Use the full balance ({money(invoice.balance)})
              </button>
            ) : null}

            <div className="flex flex-col gap-2">
              <span className="text-sm text-ink" id="pay-method-label">
                Method
              </span>
              <div className="scrollbar-none -mx-1 overflow-x-auto px-1 py-1">
                <Segmented
                  ariaLabel="Payment method"
                  variant="tray"
                  size="sm"
                  className="w-max"
                  value={method}
                  onChange={setMethod}
                  items={RECORDABLE_METHODS.map((m) => ({ value: m, label: m, icon: METHOD_ICON[m] }))}
                />
              </div>
            </div>

            {method !== "Cash" ? (
              <Field label={method === "Card" ? "Terminal approval code" : method === "UPI" ? "UPI reference (UTR)" : "Bank reference"} optional hint="Copy it from the terminal slip or the patient's payment app. It helps reconciliation later.">
                {(a) => <Input {...a} className="font-mono" autoComplete="off" placeholder={method === "Card" ? "AUTH 000000" : method === "UPI" ? "UTR 000000 000000" : "NEFT ref"} value={reference} onChange={(ev) => setReference(ev.target.value)} />}
              </Field>
            ) : null}

            {failed ? (
              <div className="flex flex-col gap-2">
                <label className="flex items-start gap-3 text-sm text-ink">
                  <Checkbox
                    checked={proof}
                    onCheckedChange={(v) => {
                      setProof(v === true);
                      if (errors.proof) setErrors((x) => ({ ...x, proof: undefined }));
                    }}
                    aria-invalid={errors.proof ? true : undefined}
                    aria-describedby={errors.proof ? "proof-error" : undefined}
                    className="mt-0.5"
                  />
                  I&apos;ve seen proof of this payment (bank statement entry or UTR).
                </label>
                {errors.proof ? (
                  <p id="proof-error" className="text-xs text-danger">
                    {errors.proof}
                  </p>
                ) : null}
              </div>
            ) : null}

            <InfoNote>
              {method === "Cash"
                ? "Recorded manually at the desk. It's saved in this browser session only — nothing is sent to an accounting system."
                : "Recorded manually — gateway confirmation not connected. The invoice shows “Recorded manually” rather than “Paid”, and nothing is sent anywhere. Saved in this browser session only."}
            </InfoNote>
            <button type="submit" className="sr-only" tabIndex={-1}>
              Record payment
            </button>
          </form>
        </ModalContent>
      ) : null}
    </Dialog>
  );
}

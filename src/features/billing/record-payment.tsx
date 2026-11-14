"use client";

import { useEffect, useState } from "react";
import { HandCoins } from "@phosphor-icons/react";
import { patientById } from "@/data/patients";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, ModalContent } from "@/components/ui/dialog";
import { Field, Input } from "@/components/ui/input";
import { Segmented } from "@/components/ui/segmented";
import { useToast } from "@/components/ui/toast";
import { useRole } from "@/components/shell/role-context";
import { AddOnNotice } from "@/components/shell/plan-switcher";
import { RECORDABLE_METHODS } from "./data";
import { METHOD_ICON, money } from "./meta";
import { recordPayment, undoPayment, type InvoiceView } from "./store";

type Method = (typeof RECORDABLE_METHODS)[number];
type Errors = Partial<Record<"amount", string>>;

/**
 * Record a payment taken at the desk: cash, UPI or card, with an optional reference. The invoice
 * counts as paid only once payments covering it are recorded. Online payments and confirmed UPI are
 * the payment-gateway add-on, never simulated here. Saved in this browser session only.
 */
export function RecordPaymentModal({ invoice, onClose, onRecorded }: { invoice: InvoiceView | null; onClose: () => void; onRecorded: (invoiceId: string) => void }) {
  const { toast } = useToast();
  const { user } = useRole();
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<Method>("Cash");
  const [reference, setReference] = useState("");
  const [errors, setErrors] = useState<Errors>({});

  useEffect(() => {
    if (!invoice) return;
    setAmount(String(invoice.balance));
    setMethod("Cash");
    setReference("");
    setErrors({});
  }, [invoice]);

  const p = invoice ? patientById(invoice.patientId) : undefined;

  function validate(): Errors {
    const e: Errors = {};
    const raw = amount.trim();
    const n = Number(raw);
    if (!raw) e.amount = "Enter the amount received.";
    else if (!/^\d+$/.test(raw)) e.amount = "Use whole rupees, digits only.";
    else if (n <= 0) e.amount = "The amount must be more than ₹0.";
    else if (invoice && n > invoice.balance) e.amount = `That's more than the balance due (${money(invoice.balance)}).`;
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
    const left = invoice.balance - n;
    toast({
      tone: "success",
      title: left > 0 ? `${money(n)} recorded · ${money(left)} still due` : `${money(n)} recorded · ${invoice.number} paid`,
      description: `${method} payment recorded by you. Saved in this browser session only — no receipt was sent.`,
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
              <Field
                label={method === "Card" ? "Terminal approval code" : "UPI reference (UTR)"}
                optional
                hint={method === "UPI" ? "Check the payment in the clinic's UPI app before recording it — a screenshot from the patient is not proof." : "Copy it from the terminal slip. It helps reconciliation later."}
              >
                {(a) => <Input {...a} className="font-mono" autoComplete="off" placeholder={method === "Card" ? "AUTH 000000" : "UTR 000000 000000"} value={reference} onChange={(ev) => setReference(ev.target.value)} />}
              </Field>
            ) : null}

            {method === "UPI" ? (
              <AddOnNotice addOn="payments">Online payments and UPI confirmed automatically by a payment gateway. Without it, record UPI payments here once you&apos;ve seen them arrive.</AddOnNotice>
            ) : null}
            <button type="submit" className="sr-only" tabIndex={-1}>
              Record payment
            </button>
          </form>
        </ModalContent>
      ) : null}
    </Dialog>
  );
}

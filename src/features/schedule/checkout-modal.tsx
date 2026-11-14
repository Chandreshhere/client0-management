"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowCounterClockwise, CalendarPlus, CheckCircle, CurrencyInr } from "@phosphor-icons/react";
import { staffById } from "@/data/staff";
import { formatINR } from "@/lib/format";
import { AddOnBadge } from "@/components/shell/plan-switcher";
import { useRole } from "@/components/shell/role-context";
import { Button } from "@/components/ui/button";
import { Dialog, ModalContent } from "@/components/ui/dialog";
import { Field, Input } from "@/components/ui/input";
import { Segmented } from "@/components/ui/segmented";
import { StatusBadge } from "@/components/ui/status";
import { useToast } from "@/components/ui/toast";
import { useServices } from "@/features/settings/store";
import { serviceFor } from "@/features/settings/data";
import { scheduleAccess, serviceText } from "./access";
import { NOW_ISO } from "./data";
import { hhmm, minOf, type Booking } from "./engine";
import { useSchedule } from "./store";

type Method = NonNullable<Booking["payment"]>["method"];

/**
 * Checkout (spec F11): the fee from the service list, a payment recorded by hand (cash, UPI or
 * card), and the next visit — then the visit is closed. A visit is never shown as paid until a
 * payment is recorded; confirmed UPI and online payments are the payment-gateway add-on.
 */
export function CheckoutModal({ bookingId, onClose }: { bookingId: string | null; onClose: () => void }) {
  const { bookings } = useSchedule();
  const booking = bookingId ? bookings.find((b) => b.id === bookingId) : undefined;
  return (
    <Dialog open={!!booking} onOpenChange={(o) => !o && onClose()}>
      {booking ? <CheckoutForm key={booking.id} booking={booking} onClose={onClose} /> : null}
    </Dialog>
  );
}

function CheckoutForm({ booking: b, onClose }: { booking: Booking; onClose: () => void }) {
  const { person, patchBooking, restoreBooking } = useSchedule();
  const { user, role } = useRole();
  const clinical = scheduleAccess(role).clinical;
  const { toast } = useToast();
  const services = useServices();
  const fee = serviceFor(b.service, services.filter((s) => !s.archived));
  const credit = fee?.billing === "programme-credit";
  const due = fee && !credit ? fee.price : 0;
  const [method, setMethod] = useState<Method>("Cash");
  const [amount, setAmount] = useState(due ? String(due) : "");
  const [reference, setReference] = useState("");
  const [errors, setErrors] = useState<{ amount?: string; reference?: string }>({});
  const who = person(b.patientId);
  const staff = staffById(b.staffId);
  const token = b.token ?? hhmm(minOf(b.start));
  const paid = b.payment;

  const record = () => {
    const n = Number(amount.replace(/[^\d.]/g, ""));
    const next: typeof errors = {};
    if (!n || n <= 0) next.amount = "Enter the amount received.";
    if (method !== "Cash" && !reference.trim()) next.reference = method === "UPI" ? "Enter the UPI reference from the patient's phone." : "Enter the approval code from the card slip.";
    setErrors(next);
    if (next.amount || next.reference) return;
    const prev = patchBooking(
      b.id,
      { payment: { method, amount: n, reference: reference.trim() || undefined, at: NOW_ISO, by: user.name } },
      `Recorded a ${method === "Cash" ? "cash" : method} payment of ${formatINR(n)} at checkout`,
      "payment",
    );
    toast({ title: `${formatINR(n)} recorded · ${method}`, description: "Recorded with the visit and in the activity log.", tone: "success", action: prev ? { label: "Undo", onClick: () => restoreBooking(prev) } : undefined });
  };

  const close = () => {
    const prev = patchBooking(b.id, { status: "completed", doneAt: NOW_ISO }, paid ? "Closed the visit at checkout" : "Closed the visit at checkout — no payment recorded");
    onClose();
    toast({
      title: `${token} done`,
      description: paid ? `${formatINR(paid.amount)} paid by ${paid.method}.` : due ? `No payment recorded — ${formatINR(due)} stays due.` : "Visit closed.",
      tone: paid || !due ? "success" : "warning",
      action: prev ? { label: "Undo", onClick: () => restoreBooking(prev) } : undefined,
    });
  };

  return (
    <ModalContent
      size="md"
      title={`Checkout · ${token}`}
      description={`${who?.name ?? "Patient"} · ${serviceText(b.service, clinical)} with ${staff?.name ?? "practitioner"}`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Not yet
          </Button>
          <Button variant="primary" leading={<CheckCircle />} onClick={close}>
            Close visit
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-2 rounded-card bg-sunken p-2">
        <section aria-labelledby="co-fee" className="flex items-start justify-between gap-4 rounded-inner bg-surface p-4">
          <div className="min-w-0">
            <h3 id="co-fee" className="text-xs text-muted">
              Charge
            </h3>
            <p className="mt-1 text-sm text-ink">{fee ? fee.name : "Not in the service list"}</p>
            <p className="text-xs text-muted">{credit ? "Covered by a session package — one credit is used when attendance is marked" : fee ? "From Services & fees" : "Add the fee in Services & fees, or invoice it in Billing"}</p>
          </div>
          <p className="shrink-0 font-mono text-base text-ink tabular">{credit ? "₹0" : fee ? formatINR(fee.price) : "—"}</p>
        </section>

        <section aria-labelledby="co-pay" className="flex flex-col gap-4 rounded-inner bg-surface p-4">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h3 id="co-pay" className="text-xs text-muted">
                Payment
              </h3>
              <p className="mt-1 text-sm text-ink">{paid ? `${formatINR(paid.amount)} by ${paid.method}` : "Not recorded"}</p>
              <p className="text-xs text-muted">
                {paid ? `Recorded by ${paid.by} at ${hhmm(minOf(paid.at))}${paid.reference ? ` · ref ${paid.reference}` : ""}` : "A visit shows as paid only once the payment is recorded here."}
              </p>
            </div>
            {paid ? (
              <StatusBadge tone="success">Paid</StatusBadge>
            ) : (
              <StatusBadge tone={due ? "warning" : "neutral"}>{due ? "Due" : "Nothing due"}</StatusBadge>
            )}
          </div>
          {paid ? (
            <Button
              size="sm"
              variant="ghost"
              leading={<ArrowCounterClockwise />}
              className="self-start"
              onClick={() => patchBooking(b.id, { payment: undefined }, `Removed the ${paid.method} payment of ${formatINR(paid.amount)} recorded in error`, "payment")}
            >
              Recorded in error — remove
            </Button>
          ) : (
            <>
              <Segmented
                ariaLabel="Payment method"
                variant="tray"
                size="sm"
                value={method}
                onChange={(m) => {
                  setMethod(m);
                  setErrors({});
                }}
                items={[
                  { value: "Cash", label: "Cash" },
                  { value: "UPI", label: "UPI" },
                  { value: "Card", label: "Card" },
                ]}
                className="self-start"
              />
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Amount received" error={errors.amount}>
                  {(p) => (
                    <div className="relative">
                      <CurrencyInr size={16} className="pointer-events-none absolute inset-y-0 left-4 my-auto text-muted" aria-hidden="true" />
                      <Input inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" className="pl-10 tabular" {...p} />
                    </div>
                  )}
                </Field>
                {method !== "Cash" ? (
                  <Field label={method === "UPI" ? "UPI reference" : "Approval code"} error={errors.reference}>
                    {(p) => <Input value={reference} onChange={(e) => setReference(e.target.value)} placeholder={method === "UPI" ? "12-digit UTR" : "From the card slip"} className="font-mono" {...p} />}
                  </Field>
                ) : null}
              </div>
              {method === "UPI" ? (
                <p className="flex flex-wrap items-center gap-2 text-xs text-muted">
                  Check the payment on the patient&apos;s phone before recording it. Automatic UPI confirmation needs the payment gateway.
                  <AddOnBadge addOn="payments" />
                </p>
              ) : null}
              <Button size="sm" variant="secondary" className="self-start" onClick={record}>
                Record payment
              </Button>
            </>
          )}
        </section>

        <section aria-labelledby="co-next" className="flex flex-wrap items-center justify-between gap-4 rounded-inner bg-surface p-4">
          <div className="min-w-0">
            <h3 id="co-next" className="text-xs text-muted">
              Next visit
            </h3>
            <p className="mt-1 text-sm text-ink">Book before they leave</p>
          </div>
          <Button asChild size="sm" variant="secondary" leading={<CalendarPlus />}>
            <Link href={`/schedule?new=1&patient=${b.patientId}&staff=${b.staffId}`} onClick={onClose}>
              Book next visit
            </Link>
          </Button>
        </section>
      </div>
    </ModalContent>
  );
}

/** "Paid ₹900 · UPI" / "Payment not recorded" for queue cards and visit details. */
export function PaymentLine({ booking }: { booking: Booking }) {
  if (booking.payment)
    return <StatusBadge tone="success">Paid {formatINR(booking.payment.amount)} · {booking.payment.method}</StatusBadge>;
  return <StatusBadge tone="neutral">Payment not recorded</StatusBadge>;
}

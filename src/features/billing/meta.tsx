"use client";

import type { ReactNode } from "react";
import { Bank, CreditCard, Money, Package, QrCode } from "@phosphor-icons/react";
import { formatINR } from "@/lib/format";
import type { PayMethod } from "./data";

/** Rupees with a true minus sign for refunds: −₹1,600. */
export const money = (n: number) => (n < 0 ? `−${formatINR(-n)}` : formatINR(n));

export const METHOD_ICON: Record<PayMethod, ReactNode> = {
  UPI: <QrCode />,
  Card: <CreditCard />,
  Cash: <Money />,
  "Bank transfer": <Bank />,
  "Package credit": <Package />,
};

export function MethodLabel({ method, className }: { method: PayMethod | null; className?: string }) {
  if (!method) return <span className={className ?? "text-sm text-muted"}>Not paid yet</span>;
  return (
    <span className={className ?? "inline-flex items-center gap-1.5 whitespace-nowrap text-sm text-ink-2"}>
      <span className="text-muted [&_svg]:size-4" aria-hidden="true">
        {METHOD_ICON[method]}
      </span>
      {method}
    </span>
  );
}

/** "Cardiology review +2 more" */
export function itemsSummary(items: { label: string }[]) {
  if (items.length === 0) return "No items";
  return items.length === 1 ? items[0].label : `${items[0].label} +${items.length - 1} more`;
}

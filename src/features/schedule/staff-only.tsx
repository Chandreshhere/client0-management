"use client";

import Link from "next/link";
import { CalendarBlank } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";

/** Shown when the patient workspace opens a front-desk page directly. */
export function StaffOnly({ title }: { title: string }) {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-[560px] flex-col items-center justify-center text-center">
      <span className="flex size-16 items-center justify-center rounded-full bg-sunken text-ink">
        <CalendarBlank size={26} aria-hidden="true" />
      </span>
      <p className="mt-6 text-sm text-muted">Clinic team only</p>
      <h1 className="mt-2 text-[36px] font-light leading-[1.05] tracking-[-0.028em] text-ink">{title}</h1>
      <p className="mt-3 max-w-[48ch] text-sm text-muted">
        This page shows other patients&apos; bookings, so it isn&apos;t part of the patient portal. Your own appointments — and requests to book, move or cancel them — live in your portal.
      </p>
      <Button asChild variant="primary" className="mt-8">
        <Link href="/portal/appointments">Go to my appointments</Link>
      </Button>
    </div>
  );
}

"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { CalendarPlus, ChatCircleDots } from "@phosphor-icons/react";
import { formatTime, pluralize } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import type { PortalAppt } from "./data";
import { PAST, REQUESTED, UPCOMING, buildIcs } from "./data";
import { apptStore, clearChange, withdrawRequest } from "./store";
import { AppointmentList, type ApptActions } from "./appointment-list";
import { BookModal } from "./book-modal";
import { CancelModal, RescheduleModal } from "./change-modals";
import { DetailsSheet } from "./details-sheet";
import { NextAppointmentCard } from "./next-card";
import { BookWidget, CareTeamList, VisitMonths } from "./overview";
import { PortalHeader, Reveal, downloadFile } from "../ui";
import { usePortalStore } from "../store";
import { NOW_MS, TODAY_KEY, untilLabel } from "../time";

type Overlay = { appt: PortalAppt | null; open: boolean; nonce: number };
const closed: Overlay = { appt: null, open: false, nonce: 0 };

const serviceFor = (a: PortalAppt) =>
  a.discipline === "nutrition" ? "nutrition" : a.discipline === "movement" ? "yoga" : a.service.toLowerCase().includes("heart") ? "heart-review" : "consult";

export function AppointmentsView() {
  const { toast } = useToast();
  const state = usePortalStore(apptStore);
  const [book, setBook] = useState<{ open: boolean; serviceId?: string; staffId?: string; day?: string; slot?: string; nonce: number }>({ open: false, nonce: 0 });
  const [month, setMonth] = useState<string>("");
  const [person, setPerson] = useState<string | undefined>(undefined);
  const [resched, setResched] = useState<Overlay>(closed);
  const [cancel, setCancel] = useState<Overlay>(closed);
  const [detail, setDetail] = useState<Overlay>(closed);

  const upcoming = [...UPCOMING].sort((a, b) => a.start.localeCompare(b.start));
  const waiting = [...state.requests, ...REQUESTED].sort((a, b) => a.start.localeCompare(b.start));
  const next = upcoming.find((a) => Date.parse(a.start) > NOW_MS) ?? null;
  const laterToday = next ? upcoming.filter((a) => a.id !== next.id && a.start.slice(0, 10) === TODAY_KEY && Date.parse(a.start) > Date.parse(next.start)) : [];
  const todayCount = upcoming.filter((a) => a.start.slice(0, 10) === TODAY_KEY).length;

  const openBook = (serviceId?: string, staffId?: string, day?: string, slot?: string) => setBook((b) => ({ open: true, serviceId, staffId, day, slot, nonce: b.nonce + 1 }));
  const everything = [...PAST, ...upcoming, ...waiting];
  const monthLabel = month ? new Intl.DateTimeFormat("en-IN", { month: "long", year: "numeric", timeZone: "Asia/Kolkata" }).format(new Date(`${month}-15T12:00:00+05:30`)) : undefined;
  const open = (set: typeof setResched) => (a: PortalAppt) => {
    setDetail((d) => ({ ...d, open: false }));
    set((o) => ({ appt: a, open: true, nonce: o.nonce + 1 }));
  };

  const actions: ApptActions = {
    details: (a) => setDetail((o) => ({ appt: a, open: true, nonce: o.nonce + 1 })),
    reschedule: open(setResched),
    cancel: open(setCancel),
    calendar: (a) => {
      const ok = downloadFile(`${a.service.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.ics`, buildIcs(a), "text/calendar");
      toast(ok ? { title: "Calendar file created", description: "Made in your browser — nothing was sent." } : { tone: "warning", title: "Couldn't create the calendar file" });
    },
    withdrawChange: (a) => {
      clearChange(a.id);
      toast({ title: "Request withdrawn", description: `${a.service} stays as booked.` });
    },
    withdrawRequest: (a) => {
      withdrawRequest(a.id);
      toast({ title: "Request withdrawn", description: "Removed from this browser session." });
    },
    bookAgain: (a) => {
      setDetail((d) => ({ ...d, open: false }));
      openBook(serviceFor(a));
    },
  };

  return (
    <div className="flex flex-col gap-6">
      <Suspense fallback={null}>
        <BookParam onBook={() => openBook()} />
      </Suspense>

      <PortalHeader
        title="Appointments"
        description={
          next
            ? `${pluralize(todayCount, "visit")} today · next is ${next.service.split(" · ")[0]} at ${formatTime(next.start)}, ${untilLabel(next.start)}.`
            : "No more visits today."
        }
        actions={
          <>
            <Button variant="dark" onClick={() => openBook()} leading={<CalendarPlus />}>
              Book or request
            </Button>
            <Button asChild variant="secondary">
              <Link href="/messages?new=1">
                <ChatCircleDots />
                Message the clinic
              </Link>
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <Reveal index={0}>
          {next ? (
            <NextAppointmentCard
              appt={next}
              change={state.changes[next.id]}
              prepare={state.prepare}
              later={laterToday}
              onReschedule={() => actions.reschedule(next)}
              onCancel={() => actions.cancel(next)}
              onDetails={actions.details}
            />
          ) : null}
        </Reveal>
        <Reveal index={1}>
          <BookWidget onBook={openBook} />
        </Reveal>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
        {/* Both filters (person, month) form a short rail beside the long list; it rides along (sticky)
            instead of leaving a blank column under it. */}
        <Reveal index={2} className="flex min-w-0 flex-col gap-6 xl:sticky xl:top-20 xl:self-start">
          <CareTeamList appts={everything} selected={person} onSelect={setPerson} />
          <VisitMonths appts={everything} active={month} onSelect={(k) => setMonth((m) => (m === k ? "" : k))} />
        </Reveal>
        <Reveal index={3} className="min-w-0">
          <AppointmentList
            upcoming={upcoming}
            waiting={waiting}
            past={PAST}
            changes={state.changes}
            actions={actions}
            filter={{ month: month || undefined, monthLabel, staffId: person }}
            onClearFilter={() => {
              setMonth("");
              setPerson(undefined);
            }}
          />
        </Reveal>
      </div>

      <BookModal key={`book-${book.nonce}`} open={book.open} initialServiceId={book.serviceId} initialStaffId={book.staffId} initialDay={book.day} initialSlot={book.slot} onOpenChange={(o) => setBook((b) => ({ ...b, open: o }))} />
      <RescheduleModal key={`resched-${resched.nonce}`} appt={resched.appt} open={resched.open} onOpenChange={(o) => setResched((r) => ({ ...r, open: o }))} />
      <CancelModal
        key={`cancel-${cancel.nonce}`}
        appt={cancel.appt}
        open={cancel.open}
        onOpenChange={(o) => setCancel((c) => ({ ...c, open: o }))}
        onRescheduleInstead={(a) => {
          setCancel((c) => ({ ...c, open: false }));
          actions.reschedule(a);
        }}
      />
      <DetailsSheet
        key={`detail-${detail.nonce}`}
        appt={detail.appt}
        change={detail.appt ? state.changes[detail.appt.id] : undefined}
        open={detail.open}
        onOpenChange={(o) => setDetail((d) => ({ ...d, open: o }))}
        actions={actions}
      />
    </div>
  );
}

/** `/portal/appointments?book=1` opens the booking flow (then tidies the URL). */
function BookParam({ onBook }: { onBook: () => void }) {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const handled = useRef(false);
  useEffect(() => {
    if (handled.current || params.get("book") !== "1") return;
    handled.current = true;
    onBook();
    router.replace(pathname, { scroll: false });
  }, [params, onBook, router, pathname]);
  return null;
}

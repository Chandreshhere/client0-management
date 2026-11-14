"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { CalendarBlank, CalendarPlus, EyeSlash, Info, Warning } from "@phosphor-icons/react";
import { DISCIPLINE_LABEL } from "@/data/appointments";
import { ChipGroup } from "@/components/viz/cards";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, SheetContent } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/input";
import { EmptyState, PageHeader } from "@/components/ui/misc";
import { Segmented } from "@/components/ui/segmented";
import { useToast } from "@/components/ui/toast";
import { useRole } from "@/components/shell/role-context";
import { spring } from "@/lib/motion";
import { DAY_END, DAY_START, DIARY_FROM, DIARY_TO, LEAVE, LUNCH, NOW_ISO, NOW_MIN, PRACTITIONERS, TODAY_KEY } from "./data";
import { DiaryOverview, describeEvent } from "./diary-overview";
import { activeOnly, CARE_DISCIPLINES, hourDensity, type CareDiscipline } from "./insights";
import {
  addDays,
  dateOf,
  isActive,
  isSunday,
  longDay,
  minOf,
  nextFreeSlot,
  rangeLabel,
  shortDay,
  weekDays,
  weekRangeLabel,
  type Booking,
  type DiaryEvent,
} from "./engine";
import { scheduleAccess, serviceText } from "./access";
import { Agenda } from "./agenda";
import { CheckoutModal } from "./checkout-modal";
import { CancelModal, RescheduleModal } from "./booking-modals";
import { EventDetails, type EventAction } from "./event-details";
import { NewAppointmentModal, type BookingPrefill } from "./new-appointment-modal";
import { displayName, useSchedule } from "./store";
import { TimeGrid } from "./time-grid";
import { DateNav, PractitionerFilter, RoomFilter } from "./toolbar";
import { DisciplineLegend, HatchSwatch } from "./ui";
import { WeekBoard } from "./week-board";
import { WeekStrip } from "./week-strip";
import { StaffOnly } from "./staff-only";
import { scrollToElement } from "@/lib/scroll";

type View = "day" | "week";

const validDate = (v: string | null) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);
const parseTime = (v: string | null) => {
  const m = v?.match(/^(\d{1,2}):?(\d{2})$/);
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
};

export function ScheduleView() {
  const { role } = useRole();
  if (role === "patient") return <StaffOnly title="Clinic diary" />;
  return <Diary />;
}

function Diary() {
  const sp = useSearchParams();
  const router = useRouter();
  const { user, role, has } = useRole();
  const access = scheduleAccess(role);
  const multiBranch = has("branches");
  const { toast } = useToast();
  const { events, doubleIds, recentIds, privacy, setPrivacy, person, checkIn, patchBooking, restoreBooking, occupants, classSeats } = useSchedule();

  const [date, setDate] = useState(() => validDate(sp.get("date")) ?? TODAY_KEY);
  const [view, setView] = useState<View>(() => (sp.get("view") === "week" ? "week" : "day"));
  const [staffSel, setStaffSel] = useState<string[] | null>(null);
  /** disciplines shown (all three by default; a chip turned off hides that discipline) */
  const [disc, setDisc] = useState<CareDiscipline[]>([...CARE_DISCIPLINES]);
  const [roomSel, setRoomSel] = useState<string[]>([]);
  const [hideEmpty, setHideEmpty] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sheetId, setSheetId] = useState<string | null>(null);
  const [rescheduleId, setRescheduleId] = useState<string | null>(null);
  const [cancelId, setCancelId] = useState<string | null>(null);
  const [checkoutId, setCheckoutId] = useState<string | null>(null);
  const [newOpen, setNewOpen] = useState(false);
  const [newSession, setNewSession] = useState(0);
  const [prefill, setPrefill] = useState<BookingPrefill>({});
  const [scrollTo, setScrollTo] = useState<{ min: number; n: number; lead?: number } | null>(null);
  const scrollSeq = useRef(0);

  const allowed = PRACTITIONERS;
  const selfId = PRACTITIONERS.some((p) => p.id === user.id) ? user.id : undefined;

  // ---------------------------------------------------------------- new appointment (?new=1)
  const openNew = useCallback((pf: BookingPrefill) => {
    setSelectedId(null);
    setSheetId(null);
    setPrefill(pf);
    setNewSession((n) => n + 1);
    setNewOpen(true);
  }, []);

  const wantsNew = sp.get("new") === "1" && access.canBook;
  useEffect(() => {
    if (!wantsNew) return;
    const pf: BookingPrefill = {};
    const pid = sp.get("patient");
    const sid = sp.get("staff");
    const d = validDate(sp.get("date"));
    const t = parseTime(sp.get("time"));
    if (pid) pf.patientId = pid;
    if (sid) pf.staffId = sid;
    if (d) pf.date = d;
    if (t !== null) pf.start = t;
    openNew(pf);
    // Only react to the flag turning on.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wantsNew]);

  const closeNew = useCallback(() => {
    setNewOpen(false);
    if (typeof window !== "undefined" && new URLSearchParams(window.location.search).get("new")) {
      const params = new URLSearchParams(window.location.search);
      ["new", "patient", "staff", "time"].forEach((k) => params.delete(k));
      const qs = params.toString();
      window.history.replaceState(null, "", qs ? `?${qs}` : window.location.pathname);
    }
  }, []);

  // Follow ?date= when another page links here (e.g. "View in calendar" from the waitlist).
  const urlDate = validDate(sp.get("date"));
  useEffect(() => {
    if (urlDate) setDate(urlDate);
  }, [urlDate]);

  // ?focus=<booking id>: land on that booking (day view, scrolled to it, details open).
  const focusId = sp.get("focus");
  useEffect(() => {
    if (!focusId) return;
    const ev = events.find((e) => e.id === focusId);
    if (!ev) return;
    setView("day");
    setDate(ev.date);
    setScrollTo({ min: ev.start, n: ++scrollSeq.current });
    setSelectedId(ev.id);
    // Only when the requested booking changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusId]);

  // ---------------------------------------------------------------- derived diary
  const days = useMemo(() => (view === "week" ? weekDays(date) : [date]), [view, date]);
  const pool = useMemo(
    () =>
      allowed
        .filter((s) => (staffSel === null || staffSel.includes(s.id)) && (disc as string[]).includes(s.discipline))
        .sort((a, b) => (a.id === user.id ? -1 : b.id === user.id ? 1 : 0)),
    [allowed, staffSel, disc, user.id],
  );
  const inScope = useCallback(
    (e: DiaryEvent, ids: Set<string>) => ids.has(e.staffId) && (disc as string[]).includes(e.discipline) && (roomSel.length === 0 || roomSel.includes(e.room)),
    [disc, roomSel],
  );
  const visible = useMemo(() => {
    const ids = new Set(pool.map((s) => s.id));
    return events.filter((e) => days.includes(e.date) && inScope(e, ids));
  }, [events, days, pool, inScope]);

  // Week strip: the same filters, across the whole Mon–Sat week of the selected date.
  const stripDays = useMemo(() => weekDays(date), [date]);
  const strip = useMemo(() => {
    const ids = new Set(pool.map((s) => s.id));
    const evs = events.filter((e) => stripDays.includes(e.date) && inScope(e, ids));
    const firstHour = Math.floor(Math.min(DAY_START, ...evs.map((e) => e.start)) / 60);
    const lastHour = Math.ceil(DAY_END / 60) - 1;
    const counts = Object.fromEntries(stripDays.map((d) => [d, activeOnly(evs.filter((e) => e.date === d)).length]));
    return { counts, density: hourDensity(evs, stripDays, firstHour, lastHour), firstHour };
  }, [events, stripDays, pool, inScope]);

  // Chip counts: active bookings per discipline for the period, under the practitioner and room filters.
  const chipCounts = useMemo(() => {
    const ids = new Set(allowed.filter((s) => staffSel === null || staffSel.includes(s.id)).map((s) => s.id));
    const evs = activeOnly(events.filter((e) => days.includes(e.date) && ids.has(e.staffId) && (roomSel.length === 0 || roomSel.includes(e.room))));
    return Object.fromEntries(CARE_DISCIPLINES.map((d) => [d, evs.filter((e) => e.discipline === d).length])) as Record<CareDiscipline, number>;
  }, [events, days, allowed, staffSel, roomSel]);

  const columns = useMemo(
    () =>
      pool
        .map((s) => {
          const evs = visible.filter((e) => e.staffId === s.id && e.date === date);
          const leave = LEAVE[s.id] && date < LEAVE[s.id].until ? LEAVE[s.id].label : undefined;
          return { staff: s, events: evs, you: s.id === user.id, leave, count: evs.filter((e) => !e.booking || isActive(e.booking)).length };
        })
        .filter((c) => !hideEmpty || c.events.length > 0 || c.you),
    [pool, visible, date, user.id, hideEmpty],
  );

  const range = useMemo(() => {
    const evs = columns.flatMap((c) => c.events);
    return {
      start: Math.min(DAY_START, ...evs.map((e) => Math.floor(e.start / 30) * 30)),
      end: Math.max(DAY_END, ...evs.map((e) => Math.ceil(e.end / 30) * 30)),
    };
  }, [columns]);

  const weekRows = useMemo(
    () =>
      pool
        .map((s) => ({
          staff: s,
          you: s.id === user.id,
          leaveUntil: LEAVE[s.id]?.until,
          byDay: Object.fromEntries(days.map((d) => [d, visible.filter((e) => e.staffId === s.id && e.date === d)])),
        }))
        .filter((r) => !hideEmpty || r.you || days.some((d) => r.byDay[d].length > 0)),
    [pool, days, visible, user.id, hideEmpty],
  );

  const dayEvents = useMemo(() => visible.filter((e) => e.date === date), [visible, date]);
  const doubleInView = useMemo(() => visible.filter((e) => doubleIds.has(e.id)).length, [visible, doubleIds]);
  const filtersActive = staffSel !== null || disc.length < CARE_DISCIPLINES.length || roomSel.length > 0;
  const clearFilters = useCallback(() => {
    setStaffSel(null);
    setDisc([...CARE_DISCIPLINES]);
    setRoomSel([]);
  }, []);

  const nameOf = useCallback((ev: DiaryEvent) => (ev.cls ? ev.cls.title : displayName(person(ev.booking?.patientId ?? "")?.name ?? "Unknown patient", privacy)), [person, privacy]);
  const subOf = useCallback(
    (ev: DiaryEvent) => {
      if (ev.cls) return `${ev.cls.enrolled.filter((e) => e.attendance !== "cancelled").length} of ${ev.cls.capacity} enrolled`;
      return privacy || !ev.booking ? undefined : serviceText(ev.booking.service, access.clinical);
    },
    [privacy, access.clinical],
  );

  // ---------------------------------------------------------------- actions
  const act = useCallback(
    (ev: DiaryEvent, a: EventAction) => {
      const b = ev.booking;
      if (!b) return;
      const name = displayName(person(b.patientId)?.name ?? "Patient", privacy);
      const undo = (prev: Booking | undefined) => (prev ? { label: "Undo", onClick: () => restoreBooking(prev) } : undefined);
      switch (a) {
        case "check-in": {
          const prev = { ...b };
          const token = checkIn(b.id, has("queue"));
          toast({
            title: `${name} checked in${token ? ` · token ${token}` : ""}`,
            description: "Added to Arrived on the check-in board.",
            tone: "success",
            action: undo(prev),
          });
          break;
        }
        case "start": {
          const prev = patchBooking(b.id, { status: "in-session", calledAt: NOW_ISO });
          toast({ title: b.staffId === user.id ? `Session started · ${name}` : `${name} sent in`, description: `With ${PRACTITIONERS.find((p) => p.id === b.staffId)?.name ?? "the practitioner"} · ${b.room}.`, tone: "success", action: undo(prev) });
          break;
        }
        case "checkout": {
          const prev = patchBooking(b.id, { status: "checkout" });
          toast({ title: `${name} sent to checkout`, description: "Reception records the payment and books the next visit.", action: undo(prev) });
          break;
        }
        case "pay":
          setSelectedId(null);
          setSheetId(null);
          setCheckoutId(b.id);
          break;
        case "no-show": {
          const early = b.status === "arrived" || b.status === "waiting";
          const prev = patchBooking(b.id, early ? { status: "no-show", cancelReason: "Left without being seen" } : { status: "no-show", cancelReason: "Did not attend" }, early ? "Left without being seen" : "Marked as no-show");
          setSelectedId(null);
          setSheetId(null);
          toast({ title: `${name} marked as ${early ? "left without being seen" : "no-show"}`, description: "Added to the visit history and the activity log. Rebook from the visit.", tone: "warning", action: undo(prev) });
          break;
        }
        case "reschedule":
          setSelectedId(null);
          setSheetId(null);
          setRescheduleId(b.id);
          break;
        case "cancel":
          setSelectedId(null);
          setSheetId(null);
          setCancelId(b.id);
          break;
        case "rebook":
        case "follow-up":
          openNew({ patientId: b.patientId, staffId: b.staffId });
          break;
      }
    },
    [person, privacy, restoreBooking, checkIn, has, toast, patchBooking, openNew, user.id],
  );

  const renderDetails = useCallback((ev: DiaryEvent) => <EventDetails ev={ev} onAction={(a) => act(ev, a)} />, [act]);

  const onSlot = useCallback((staffId: string, min: number) => openNew({ staffId, date, start: min }), [openNew, date]);
  const onCell = useCallback(
    (staffId: string, d: string) => {
      const s = PRACTITIONERS.find((p) => p.id === staffId);
      const free = nextFreeSlot({ staffId, room: s?.room ?? "Consult 1", date: d, start: d === TODAY_KEY ? NOW_MIN : 9 * 60, duration: 30 }, occupants, { maxDays: 0 });
      openNew({ staffId, date: d, start: free?.start });
    },
    [openNew, occupants],
  );

  // Overview interactions: jump the diary to an hour, open a day, book a practitioner's next free slot.
  const gridRef = useRef<HTMLDivElement>(null);
  const reveal = useCallback(
    (el: HTMLElement | null, offset: number) => {
      scrollToElement(el, -offset);
    },
    [],
  );
  const jumpTo = useCallback(
    (min: number) => {
      if (window.matchMedia("(min-width: 768px)").matches) {
        setScrollTo({ min, n: ++scrollSeq.current, lead: 15 });
        reveal(gridRef.current, -24);
      } else {
        const groups = [...document.querySelectorAll<HTMLElement>("[data-agenda-time]")];
        reveal(groups.find((g) => Number(g.dataset.agendaTime) >= min) ?? groups[groups.length - 1] ?? null, -96);
      }
    },
    [reveal],
  );
  const openDay = useCallback((d: string) => {
    setSelectedId(null);
    setView("day");
    setDate(d);
  }, []);
  const bookAt = useCallback((staffId: string, d: string, start: number, serviceId?: string) => openNew({ staffId, date: d, start, serviceId }), [openNew]);
  const describe = useCallback((ev: DiaryEvent) => describeEvent(ev, nameOf(ev), classSeats), [nameOf, classSeats]);

  const onBooked = (created: Booking[]) => {
    closeNew();
    const first = created[0];
    if (!first) return;
    setDate(dateOf(first.start));
    if (staffSel && !staffSel.includes(first.staffId)) setStaffSel([...staffSel, first.staffId]);
    if (!(disc as string[]).includes(first.discipline)) setDisc([...CARE_DISCIPLINES]);
    if (roomSel.length && !roomSel.includes(first.room)) setRoomSel([]);
    setScrollTo({ min: minOf(first.start), n: ++scrollSeq.current });
  };

  const step = useCallback(
    (n: -1 | 1) => {
      setSelectedId(null);
      setDate((d) => {
        if (view === "week") return addDays(d, 7 * n);
        let next = addDays(d, n);
        if (isSunday(next)) next = addDays(next, n);
        return next;
      });
    },
    [view],
  );
  const goToday = useCallback(() => {
    setSelectedId(null);
    setDate(TODAY_KEY);
  }, []);

  // Keyboard: ← / → step, T for today (ignored while typing or inside menus and dialogs).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return;
      const t = e.target as HTMLElement | null;
      if (t?.closest("input,textarea,select,[contenteditable='true'],[role='dialog'],[role='menu'],[role='listbox'],[role='radiogroup'],[data-schedule-grid]")) return;
      if (document.body.hasAttribute("data-scroll-locked")) return;
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        step(-1);
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        step(1);
      } else if (e.key === "t" || e.key === "T") {
        goToday();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [step, goToday]);

  // ---------------------------------------------------------------- header copy
  const isTodayView = view === "day" ? date === TODAY_KEY : days.includes(TODAY_KEY);
  const active = (view === "day" ? dayEvents : visible).filter((e) => e.booking && isActive(e.booking) && !e.cls);
  const classes = (view === "day" ? dayEvents : visible).filter((e) => e.cls).length;
  const cancelled = (view === "day" ? dayEvents : visible).filter((e) => e.booking?.status === "cancelled").length;
  const noShows = (view === "day" ? dayEvents : visible).filter((e) => e.booking?.status === "no-show").length;
  const inClinic = view === "day" && date === TODAY_KEY ? dayEvents.filter((e) => e.booking && ["arrived", "waiting", "in-session", "checkout"].includes(e.booking.status)).length : 0;
  const summary = [
    `${active.length} ${active.length === 1 ? "appointment" : "appointments"}`,
    classes ? `${classes} ${classes === 1 ? "class" : "classes"}` : null,
    inClinic ? `${inClinic} in clinic now` : null,
    cancelled ? `${cancelled} cancelled` : null,
    noShows ? `${noShows} no-show${noShows === 1 ? "" : "s"}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const outsideDiary = days.every((d) => d < DIARY_FROM || d > DIARY_TO);
  const eyebrow = isTodayView ? (view === "day" ? "Schedule · Today, 09:40 IST" : "Schedule · This week") : view === "day" ? `Schedule · ${relDay(date)}` : "Schedule";

  const sheetEv = sheetId ? events.find((e) => e.id === sheetId) : undefined;
  const selectedVisible = selectedId && visible.some((e) => e.id === selectedId) ? selectedId : null;

  const empty = (
    <EmptyState
      icon={<CalendarBlank />}
      title={
        isSunday(date) && view === "day"
          ? "The clinic is closed on Sundays"
          : disc.length === 0
            ? "Every discipline is switched off"
            : filtersActive && events.some((e) => days.includes(e.date))
              ? "No appointments match these filters"
              : outsideDiary
                ? "No bookings in the demo diary for this day"
                : "Nothing booked yet"
      }
      description={outsideDiary ? `The synthetic diary covers ${shortDay(DIARY_FROM)} – ${shortDay(DIARY_TO)}. New bookings you make here appear on any date.` : undefined}
      action={
        <div className="flex flex-wrap justify-center gap-2">
          {filtersActive ? (
            <Button size="sm" variant="secondary" onClick={clearFilters}>
              {disc.length === 0 ? "Show all disciplines" : "Clear filters"}
            </Button>
          ) : null}
          {hideEmpty && !isSunday(date) ? (
            <Button size="sm" variant="secondary" onClick={() => setHideEmpty(false)}>
              Show empty diaries
            </Button>
          ) : null}
          {date !== TODAY_KEY ? (
            <Button size="sm" variant="ghost" onClick={goToday}>
              Back to today
            </Button>
          ) : null}
        </div>
      }
    />
  );

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow={eyebrow}
        title={view === "day" ? longDay(date) : weekRangeLabel(days)}
        description={summary}
        actions={
          <>
            <label className="inline-flex h-10 cursor-pointer items-center gap-3 rounded-full bg-surface pl-4 pr-2 text-sm text-ink shadow-[inset_0_0_0_1px_var(--color-line)]">
              <EyeSlash size={18} className="text-ink-2" aria-hidden="true" />
              <span>Privacy mode</span>
              <Switch checked={privacy} onCheckedChange={setPrivacy} aria-label="Privacy mode: show initials and hide services" />
            </label>
            {access.canBook ? (
              <Button variant="primary" leading={<CalendarPlus />} onClick={() => openNew({ date: date >= TODAY_KEY ? date : TODAY_KEY })}>
                New appointment
              </Button>
            ) : null}
          </>
        }
      />

      <div className="flex flex-col gap-4">
        {/* when: step, today, the week strip (one pill per day) and the view */}
        <div className="flex flex-wrap items-center gap-2">
          <DateNav onStep={step} onToday={goToday} isToday={date === TODAY_KEY} unit={view} />
          <WeekStrip
            className="order-last w-full md:order-none md:w-auto md:min-w-[600px] md:flex-1"
            days={stripDays}
            selected={date}
            view={view}
            counts={strip.counts}
            density={strip.density}
            firstHour={strip.firstHour}
            onPick={openDay}
          />
          <Segmented
            ariaLabel="Calendar view"
            variant="tray"
            className="ml-auto hidden md:flex"
            value={view}
            onChange={(v) => {
              setSelectedId(null);
              setView(v);
            }}
            items={[
              { value: "day", label: "Day" },
              { value: "week", label: "Week" },
            ]}
          />
        </div>

        {/* who and where: one filter row that scopes the strip, the overview and the diary */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="scrollbar-none -mx-1 max-w-full overflow-x-auto px-1 py-0.5">
            <ChipGroup
              ariaLabel="Disciplines shown"
              className="flex-nowrap rounded-full bg-surface p-1"
              value={disc}
              onChange={(v) => setDisc(CARE_DISCIPLINES.filter((d) => v.includes(d)))}
              options={CARE_DISCIPLINES.map((d) => ({ value: d, label: DISCIPLINE_LABEL[d], count: chipCounts[d] }))}
            />
          </div>
          <PractitionerFilter all={PRACTITIONERS} allowedIds={allowed.map((s) => s.id)} selected={staffSel} onChange={setStaffSel} selfId={selfId} hideEmpty={hideEmpty} onHideEmpty={setHideEmpty} />
          <RoomFilter selected={roomSel} onChange={setRoomSel} multiBranch={multiBranch} />
          {filtersActive ? (
            <Button size="sm" variant="ghost" onClick={clearFilters}>
              Clear
            </Button>
          ) : null}
          <DisciplineLegend className="ml-auto hidden 2xl:flex" />
        </div>

        <DiaryOverview
          view={view}
          date={date}
          days={days}
          events={visible}
          pool={pool}
          occupants={occupants}
          classSeats={classSeats}
          range={range}
          describe={describe}
          onJump={jumpTo}
          onOpenDay={openDay}
          onBook={access.canBook ? bookAt : undefined}
        />

        <AnimatePresence initial={false}>
          {privacy ? (
            <motion.p
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={spring}
              className="flex items-center gap-2 overflow-hidden text-xs text-muted"
            >
              <EyeSlash size={14} aria-hidden="true" />
              Privacy mode: names show as initials and services are hidden — safe for screens visitors can see.
            </motion.p>
          ) : null}
        </AnimatePresence>

        {/* mobile: agenda */}
        <div className="md:hidden">
          <Agenda date={date} events={dayEvents} nameOf={nameOf} subOf={subOf} onOpen={setSheetId} empty={empty} />
        </div>

        {/* desktop: grid */}
        <Card ref={gridRef} padded={false} data-schedule-grid className="hidden scroll-mt-6 p-2 md:block">
          {view === "day" ? (
            columns.length ? (
              <TimeGrid
                date={date}
                columns={columns}
                range={range}
                selectedId={selectedVisible}
                recentIds={recentIds}
                doubleIds={doubleIds}
                onSlot={access.canBook ? onSlot : undefined}
                scrollTo={scrollTo}
                privacy={privacy}
                nameOf={nameOf}
                onOpenChange={setSelectedId}
                renderDetails={renderDetails}
              />
            ) : (
              empty
            )
          ) : weekRows.length ? (
            <WeekBoard days={days} rows={weekRows} selectedId={selectedVisible} recentIds={recentIds} doubleIds={doubleIds} onCell={access.canBook ? onCell : undefined} onOpenChange={setSelectedId} renderDetails={renderDetails} nameOf={nameOf} />
          ) : (
            empty
          )}
        </Card>

        <div className="hidden flex-wrap items-center gap-x-6 gap-y-2 text-xs text-muted md:flex">
          <span className="inline-flex items-center gap-1.5">
            <Info size={14} aria-hidden="true" />
            {access.canBook
              ? view === "day"
                ? "Click an empty slot to book it · click a booking for details and actions."
                : "Click a day cell to book · click a booking for details."
              : "Click a booking for details · Reception books and changes appointments."}
          </span>
          {view === "day" ? (
            <span className="inline-flex items-center gap-1.5">
              <HatchSwatch />
              Hatched: off duty (staff profile hours), lunch {rangeLabel(LUNCH.start, LUNCH.end)} or leave
            </span>
          ) : null}
          {doubleInView ? (
            <span className="inline-flex items-center gap-1.5">
              <Warning size={14} className="text-warning" aria-hidden="true" />
              {doubleInView} {doubleInView === 1 ? "booking overlaps" : "bookings overlap"} another for the same practitioner — walk-ins are squeezed in at the current time; new bookings are checked for clashes.
            </span>
          ) : null}
        </div>
      </div>

      <CheckoutModal bookingId={checkoutId} onClose={() => setCheckoutId(null)} />

      <NewAppointmentModal open={newOpen} session={newSession} prefill={prefill} onOpenChange={(o) => (o ? setNewOpen(true) : closeNew())} onBooked={onBooked} />

      <RescheduleModal
        bookingId={rescheduleId}
        onClose={() => setRescheduleId(null)}
        onDone={(next, prev) => {
          setRescheduleId(null);
          const d = dateOf(next.start);
          const t = minOf(next.start);
          toast({
            title: `Moved to ${shortDay(d)}, ${rangeLabel(t, t + next.durationMin)}`,
            description: "Added to the booking history. Let the patient know by phone.",
            tone: "success",
            action: d !== date ? { label: `Go to ${shortDay(d)}`, onClick: () => setDate(d) } : { label: "Undo", onClick: () => restoreBooking(prev) },
          });
          if (d === date) setScrollTo({ min: t, n: ++scrollSeq.current });
        }}
      />

      <CancelModal
        bookingId={cancelId}
        onClose={() => setCancelId(null)}
        onDone={(prev, offer) => {
          setCancelId(null);
          toast({
            title: "Appointment cancelled",
            description: offer ? "Reason kept in the booking history. Offer the freed slot from the waitlist." : "Reason kept in the booking history.",
            tone: "warning",
            action: offer ? { label: "Open waitlist", onClick: () => router.push("/schedule/waitlist") } : { label: "Undo", onClick: () => restoreBooking(prev) },
          });
        }}
      />

      <Dialog open={!!sheetEv} onOpenChange={(o) => !o && setSheetId(null)}>
        {sheetEv ? (
          <SheetContent title={sheetEv.cls ? "Class" : "Appointment"} description={`${shortDay(sheetEv.date)} · ${rangeLabel(sheetEv.start, sheetEv.end)}`}>
            <EventDetails ev={sheetEv} onAction={(a) => act(sheetEv, a)} className="p-0" />
          </SheetContent>
        ) : null}
      </Dialog>
    </div>
  );
}

function relDay(date: string) {
  const diff = Math.round((Date.UTC(+date.slice(0, 4), +date.slice(5, 7) - 1, +date.slice(8, 10)) - Date.UTC(2026, 10, 13)) / 86_400_000);
  if (diff === 1) return "Tomorrow";
  if (diff === -1) return "Yesterday";
  return diff > 0 ? `In ${diff} days` : `${-diff} days ago`;
}

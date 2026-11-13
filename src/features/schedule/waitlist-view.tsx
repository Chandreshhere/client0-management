"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { ArrowUpRight, CalendarBlank, CalendarCheck, CalendarPlus, Clock, DotsThree, HourglassMedium, ListPlus, Trash, Warning, X } from "@phosphor-icons/react";
import { CLASSES } from "@/data/programs";
import { DISCIPLINE_LABEL } from "@/data/appointments";
import { staffById } from "@/data/staff";
import { formatDate, relativeTime } from "@/lib/format";
import { spring } from "@/lib/motion";
import { cn } from "@/lib/cn";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dropdown, DropdownContent, DropdownItem, DropdownSeparator, DropdownTrigger } from "@/components/ui/dropdown";
import { IconButton } from "@/components/ui/icon-button";
import { Select } from "@/components/ui/input";
import { EmptyState, PageHeader, Stat } from "@/components/ui/misc";
import { StatusBadge, priorityTone } from "@/components/ui/status";
import { useToast } from "@/components/ui/toast";
import { useRole } from "@/components/shell/role-context";
import { ChipGroup, PeopleList } from "@/components/viz/cards";
import { DIARY_TO, LEAVE, PRIORITY_LABEL, PRIORITY_RANK, serviceById } from "./data";
import { dateOf, findConflicts, hhmm, isoAt, minOf, shortDay } from "./engine";
import { CARE_DISCIPLINES, type CareDiscipline } from "./insights";
import { StaffOnly } from "./staff-only";
import { useSchedule, type WaitEntry, type WaitOffer } from "./store";
import { DisciplineDot } from "./ui";
import { AddWaitlistModal, OfferSlotModal } from "./waitlist-modals";
import { offerable, waitMatch, type WaitMatch } from "./waitlist-insights";

type Sort = "priority" | "oldest" | "newest";

export function WaitlistView() {
  const { role } = useRole();
  if (role === "patient") return <StaffOnly title="Waitlist" />;
  return <Waitlist />;
}

const offerLabel = (o: WaitOffer) => {
  if (o.kind === "class") {
    const c = CLASSES.find((x) => x.id === o.classId);
    return c ? `${c.title} · ${shortDay(dateOf(c.start))}, ${hhmm(minOf(c.start))}` : "Class place";
  }
  return `${shortDay(o.date)}, ${hhmm(o.start)} · ${staffById(o.staffId)?.name}`;
};

/** Who a request is waiting for: one named practitioner, or "any <discipline> practitioner". */
const requestedKey = (w: WaitEntry) => (w.staffIds.length === 1 ? w.staffIds[0] : `any-${w.discipline}`);

function Waitlist() {
  const router = useRouter();
  const { toast } = useToast();
  const { waitlist, person, patchWaitlist, removeWaitlist, restoreWaitlist, addBookings, occupants, takeClassSeat, classSeats } = useSchedule();
  const [disc, setDisc] = useState<CareDiscipline[]>([...CARE_DISCIPLINES]);
  const [who, setWho] = useState<string | null>(null);
  const [sort, setSort] = useState<Sort>("priority");
  const [offerFor, setOfferFor] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [addSession, setAddSession] = useState(0);

  const open = useMemo(() => waitlist.filter((w) => w.status !== "booked"), [waitlist]);
  const matches = useMemo(() => new Map(waitlist.map((w) => [w.id, waitMatch(w, occupants, classSeats)])), [waitlist, occupants, classSeats]);

  const counts = useMemo(() => Object.fromEntries(CARE_DISCIPLINES.map((d) => [d, open.filter((w) => w.discipline === d).length])) as Record<CareDiscipline, number>, [open]);

  // Requested practitioners (ref 5 list): open requests per practitioner, the busiest first.
  const people = useMemo(() => {
    const by = new Map<string, number>();
    for (const w of open) by.set(requestedKey(w), (by.get(requestedKey(w)) ?? 0) + 1);
    return [...by.entries()]
      .map(([key, count]) => {
        const s = staffById(key);
        if (s) return { id: key, name: s.name, avatar: s.avatar, role: LEAVE[s.id] ? LEAVE[s.id].label : s.title.split(" ·")[0], count };
        const d = key.replace("any-", "") as CareDiscipline;
        return { id: key, name: `Any ${DISCIPLINE_LABEL[d].toLowerCase()} practitioner`, avatar: null, role: "No preference", count };
      })
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  }, [open]);

  const rows = useMemo(() => {
    const xs = waitlist.filter((w) => (disc as string[]).includes(w.discipline) && (!who || requestedKey(w) === who));
    const statusRank = { offered: 0, waiting: 1, booked: 2 } as const;
    return [...xs].sort((a, b) => {
      if (a.status !== b.status && (a.status === "booked" || b.status === "booked")) return statusRank[a.status] - statusRank[b.status];
      if (sort === "priority") return PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] || a.addedAt.localeCompare(b.addedAt);
      if (sort === "oldest") return a.addedAt.localeCompare(b.addedAt);
      return b.addedAt.localeCompare(a.addedAt);
    });
  }, [waitlist, disc, who, sort]);

  const high = open.filter((w) => w.priority === "high" || w.priority === "urgent").length;
  const offered = open.filter((w) => w.status === "offered").length;
  const oldest = [...open].sort((a, b) => a.addedAt.localeCompare(b.addedAt))[0];
  const canOffer = open.filter((w) => w.status === "waiting" && offerable(matches.get(w.id)!));
  const onLeaveCover = open.filter((w) => matches.get(w.id)?.kind === "leave");
  const leaveLabels = [...new Set(onLeaveCover.flatMap((w) => w.staffIds.filter((id) => LEAVE[id]).map((id) => `${staffById(id)?.name} · back ${LEAVE[id].label.replace(/^On leave until /, "")}`)))];
  const entryForOffer = offerFor ? waitlist.find((w) => w.id === offerFor) ?? null : null;
  const filtered = disc.length < CARE_DISCIPLINES.length || who !== null;

  const recordOffer = (entry: WaitEntry, offer: WaitOffer) => {
    patchWaitlist(entry.id, { status: "offered", offer });
    setOfferFor(null);
    toast({
      title: `Offer recorded for ${person(entry.patientId)?.name ?? "patient"}`,
      description: `${offerLabel(offer)}. Nobody was contacted — messaging isn't connected. Mark their reply here.`,
      tone: "success",
    });
  };

  const accept = (entry: WaitEntry) => {
    const o = entry.offer;
    if (!o) return;
    const name = person(entry.patientId)?.name ?? "Patient";
    if (o.kind === "class") {
      takeClassSeat(o.classId);
      patchWaitlist(entry.id, { status: "booked" });
      toast({ title: `Place held for ${name}`, description: `${offerLabel(o)}. Recorded locally — the roster itself is managed in Classes.`, tone: "success" });
      return;
    }
    const staff = staffById(o.staffId);
    const clash = findConflicts({ staffId: o.staffId, room: o.room, date: o.date, start: o.start, duration: o.duration }, occupants);
    if (clash.length) {
      patchWaitlist(entry.id, { status: "waiting", offer: undefined });
      toast({ title: "That slot has been taken since the offer", description: "Back to waiting — offer another slot.", tone: "danger" });
      return;
    }
    const svc = serviceById(entry.serviceId);
    const [b] = addBookings([
      {
        patientId: entry.patientId,
        staffId: o.staffId,
        service: svc?.label ?? entry.want,
        discipline: svc?.discipline ?? entry.discipline,
        start: isoAt(o.date, o.start),
        durationMin: o.duration,
        room: o.room,
        status: "booked",
        kind: svc?.kind ?? "follow-up",
        formsComplete: person(entry.patientId)?.intakeComplete ?? false,
        notes: "Booked from the waitlist",
      },
    ]);
    patchWaitlist(entry.id, { status: "booked", bookedId: b.id });
    toast({
      title: `Booked · ${shortDay(o.date)}, ${hhmm(o.start)}`,
      description: `${name} with ${staff?.name}. Added to the calendar in this browser session — no confirmation was sent.`,
      tone: "success",
      action: { label: "View in calendar", onClick: () => router.push(`/schedule?date=${o.date}&focus=${b.id}`) },
    });
  };

  const decline = (entry: WaitEntry) => {
    patchWaitlist(entry.id, { status: "waiting", offer: undefined });
    toast({ title: "Marked as declined", description: `${person(entry.patientId)?.name ?? "They"} stay on the waitlist.` });
  };

  const remove = (entry: WaitEntry) => {
    const removed = removeWaitlist(entry.id);
    if (!removed) return;
    toast({
      title: `${person(entry.patientId)?.name ?? "Entry"} removed from the waitlist`,
      description: "Recorded in this browser session.",
      action: { label: "Undo", onClick: () => restoreWaitlist(removed.entry, removed.index) },
    });
  };

  const openAdd = () => {
    setAddSession((n) => n + 1);
    setAddOpen(true);
  };

  const clear = () => {
    setDisc([...CARE_DISCIPLINES]);
    setWho(null);
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Front desk · Scheduling"
        title="Waitlist"
        description="Patients who want an earlier or specific slot. Free slots are matched against the diary up to the end of the demo week — offers are recorded here and nobody is contacted automatically."
        actions={
          <Button variant="primary" leading={<ListPlus />} onClick={openAdd}>
            Add to waitlist
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat
          label="Waiting"
          value={open.length}
          icon={<HourglassMedium />}
          context={`${high} high priority${offered ? ` · ${offered} offered, awaiting reply` : ""}`}
        />
        <Stat
          label="Longest on the list"
          value={oldest ? relativeTime(oldest.addedAt).replace(" ago", "") : "—"}
          icon={<Clock />}
          context={oldest ? `${person(oldest.patientId)?.name ?? "Patient"} · ${oldest.want}` : "Nobody waiting"}
        />
        <Stat
          tone="dark"
          label={`Slots to offer by ${shortDay(DIARY_TO).replace(/ \w+$/, "")}`}
          value={canOffer.length}
          icon={<CalendarCheck />}
          context={
            canOffer.length
              ? canOffer
                  .map((w) => {
                    const m = matches.get(w.id)!;
                    const n = m.kind === "slots" ? m.count : m.kind === "class" ? m.free : 0;
                    return `${person(w.patientId)?.name ?? "Patient"} (${n})`;
                  })
                  .join(", ")
              : "No request has a matching free slot this week"
          }
        />
        <Stat
          label="Waiting on leave cover"
          value={onLeaveCover.length}
          icon={<Warning />}
          context={onLeaveCover.length ? leaveLabels.join("; ") : "No request is blocked by leave"}
        />
      </div>

      {/* one filter row: discipline chips and sort */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="scrollbar-none -mx-1 max-w-full overflow-x-auto px-1 py-0.5" data-lenis-prevent>
          <ChipGroup
            ariaLabel="Disciplines shown"
            className="flex-nowrap rounded-full bg-surface p-1"
            value={disc}
            onChange={(v) => setDisc(CARE_DISCIPLINES.filter((d) => v.includes(d)))}
            options={CARE_DISCIPLINES.map((d) => ({ value: d, label: DISCIPLINE_LABEL[d], count: counts[d] }))}
          />
        </div>
        {filtered ? (
          <Button size="sm" variant="ghost" onClick={clear}>
            Clear
          </Button>
        ) : null}
        <div className="ml-auto flex items-center gap-2">
          <span className="text-xs text-muted" id="wl-sort">
            Sort
          </span>
          <Select
            size="sm"
            ariaLabel="Sort waitlist"
            value={sort}
            onValueChange={(v) => setSort(v as Sort)}
            className="w-[168px]"
            options={[
              { value: "priority", label: "Priority" },
              { value: "oldest", label: "Longest waiting" },
              { value: "newest", label: "Recently added" },
            ]}
          />
        </div>
      </div>

      {/* ref 5: who the open requests are waiting for, with counts — also a filter for the table */}
      <section aria-labelledby="wl-people" className="flex flex-col gap-2 rounded-card bg-surface p-2">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-2 pt-2">
          <h2 id="wl-people" className="text-sm text-ink">
            Requested practitioners <span className="text-muted">· open requests each</span>
          </h2>
          <p className="text-xs text-muted">{who ? "Showing one practitioner's requests — select them again to show everyone." : "Select someone to see only their requests."}</p>
        </div>
        {people.length ? (
          <PeopleList className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4" people={people} selected={who ?? undefined} onSelect={(id) => setWho((cur) => (cur === id ? null : id))} />
        ) : (
          <p className="px-2 pb-2 text-xs text-muted">No open requests.</p>
        )}
      </section>

      <div className="flex flex-col gap-4">
        <Card padded={false} className="min-w-0 overflow-hidden">
          {rows.length === 0 ? (
            <EmptyState
              icon={<HourglassMedium />}
              title={disc.length === 0 ? "Every discipline is switched off" : filtered ? "No requests match these filters" : "Nobody is on the waitlist"}
              description={filtered ? undefined : "Add patients who want an earlier or specific slot — you can offer freed slots from here."}
              action={
                filtered ? (
                  <Button size="sm" variant="secondary" onClick={clear}>
                    Show all requests
                  </Button>
                ) : (
                  <Button size="sm" variant="secondary" leading={<ListPlus />} onClick={openAdd}>
                    Add to waitlist
                  </Button>
                )
              }
            />
          ) : (
            <>
              {/* desktop table */}
              <div className="relative hidden overflow-x-auto md:block" data-lenis-prevent>
                <table className="w-full min-w-[880px] text-left text-sm">
                  <caption className="sr-only">Waitlist</caption>
                  <thead>
                    <tr className="text-xs text-muted">
                      <th scope="col" className="py-4 pl-6 pr-3 font-normal">Patient</th>
                      <th scope="col" className="px-3 py-4 font-normal">Request</th>
                      <th scope="col" className="px-3 py-4 font-normal">Priority</th>
                      <th scope="col" className="px-3 py-4 font-normal">On list</th>
                      <th scope="col" className="px-3 py-4 font-normal">Free by {shortDay(DIARY_TO).replace(/ \w+$/, "")}</th>
                      <th scope="col" className="px-3 py-4 font-normal">Status</th>
                      <th scope="col" className="py-4 pl-3 pr-6 text-right font-normal">
                        <span className="sr-only">Actions</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    <AnimatePresence initial={false}>
                      {rows.map((w) => (
                        <motion.tr
                          key={w.id}
                          layout="position"
                          initial={{ opacity: 0, y: -6 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, transition: { duration: 0.15 } }}
                          transition={spring}
                          className={cn("border-t border-line align-middle transition-opacity", w.status === "booked" && "opacity-60")}
                        >
                          <td className="py-4 pl-6 pr-3">
                            <PatientCell w={w} />
                          </td>
                          <td className="max-w-[280px] px-3 py-4">
                            <WantCell w={w} />
                          </td>
                          <td className="px-3 py-4">
                            <StatusBadge tone={priorityTone(w.priority)}>{PRIORITY_LABEL[w.priority]}</StatusBadge>
                          </td>
                          <td className="whitespace-nowrap px-3 py-4">
                            <span className="block text-ink-2">{relativeTime(w.addedAt).replace(" ago", "")}</span>
                            <span className="block text-xs text-muted">since {formatDate(w.addedAt, { day: "numeric", month: "short" })}</span>
                          </td>
                          <td className="max-w-[220px] px-3 py-4">
                            <MatchCell m={matches.get(w.id)!} discipline={w.discipline} />
                          </td>
                          <td className="px-3 py-4">
                            <StatusCell w={w} />
                          </td>
                          <td className="py-4 pl-3 pr-6">
                            <RowActions w={w} emphasise={offerable(matches.get(w.id)!)} onOffer={() => setOfferFor(w.id)} onAccept={() => accept(w)} onDecline={() => decline(w)} onRemove={() => remove(w)} />
                          </td>
                        </motion.tr>
                      ))}
                    </AnimatePresence>
                  </tbody>
                </table>
              </div>

              {/* mobile cards */}
              <ul className="flex flex-col md:hidden">
                {rows.map((w) => (
                  <li key={w.id} className="flex flex-col gap-3 border-t border-line p-4 first:border-t-0">
                    <div className="flex items-start justify-between gap-2">
                      <PatientCell w={w} />
                      <StatusBadge tone={priorityTone(w.priority)}>{PRIORITY_LABEL[w.priority]}</StatusBadge>
                    </div>
                    <WantCell w={w} />
                    <div className="rounded-inner bg-sunken px-3 py-2">
                      <MatchCell m={matches.get(w.id)!} discipline={w.discipline} />
                    </div>
                    <p className="text-xs text-muted">On the list {relativeTime(w.addedAt).replace(" ago", "")} · since {formatDate(w.addedAt, { day: "numeric", month: "short" })}</p>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <StatusCell w={w} />
                      <RowActions w={w} emphasise={offerable(matches.get(w.id)!)} onOffer={() => setOfferFor(w.id)} onAccept={() => accept(w)} onDecline={() => decline(w)} onRemove={() => remove(w)} />
                    </div>
                  </li>
                ))}
              </ul>
            </>
          )}
        </Card>
      </div>

      <p className="text-xs text-muted">
        &ldquo;Free by {shortDay(DIARY_TO)}&rdquo; counts 30-minute steps where the requested practitioner and their room are both free inside their working hours and the patient&apos;s preferred times — the same list the Offer dialog shows. Changes here are kept in this browser session only.
      </p>

      <OfferSlotModal entry={entryForOffer} onClose={() => setOfferFor(null)} onOffer={recordOffer} />
      <AddWaitlistModal
        open={addOpen}
        session={addSession}
        onOpenChange={setAddOpen}
        onAdded={(e) => {
          setAddOpen(false);
          clear();
          toast({ title: `${person(e.patientId)?.name ?? "Patient"} added to the waitlist`, description: "Saved in this browser session only.", tone: "success" });
        }}
      />
    </div>
  );
}

function PatientCell({ w }: { w: WaitEntry }) {
  const { person } = useSchedule();
  const p = person(w.patientId);
  return (
    <span className="flex min-w-0 items-center gap-3">
      <Avatar src={p?.avatar} name={p?.name ?? "Patient"} size="md" />
      <span className="min-w-0">
        <span className="block truncate text-sm text-ink">{p?.name ?? "Unknown patient"}</span>
        <span className="block truncate font-mono text-xs text-muted">{p?.clinicNo}</span>
      </span>
    </span>
  );
}

function WantCell({ w }: { w: WaitEntry }) {
  const staff = w.staffIds.length === 1 ? staffById(w.staffIds[0]) : undefined;
  const cls = w.classId ? CLASSES.find((c) => c.id === w.classId) : undefined;
  return (
    <span className="flex min-w-0 flex-col">
      <span className="flex items-center gap-2 text-ink">
        <DisciplineDot discipline={w.discipline} />
        <span className="truncate">{w.want}</span>
      </span>
      <span className="truncate pl-4 text-xs text-muted">
        {cls ? `${cls.title} · ${shortDay(dateOf(cls.start))}, ${hhmm(minOf(cls.start))}` : staff ? staff.name : `Any ${DISCIPLINE_LABEL[w.discipline].toLowerCase()} practitioner`}
        {w.note ? ` · ${w.note}` : ""}
      </span>
      <span className="truncate pl-4 text-xs text-muted">Prefers {w.preferred.charAt(0).toLowerCase() + w.preferred.slice(1)}</span>
    </span>
  );
}

/** What the diary can offer this request before the demo week ends (text first; the icon only repeats it). */
function MatchCell({ m, discipline }: { m: WaitMatch; discipline: WaitEntry["discipline"] }) {
  if (m.kind === "closed") return <span className="text-xs text-muted">—</span>;
  if (m.kind === "slots") {
    return m.count > 0 && m.next ? (
      <span className="flex items-start gap-2">
        <CalendarCheck size={16} className="mt-0.5 shrink-0 text-ink" aria-hidden="true" />
        <span className="min-w-0">
          <span className="block text-ink">
            {m.count} matching {m.count === 1 ? "slot" : "slots"}
          </span>
          <span className="block truncate text-xs text-muted">
            next {shortDay(m.next.date)} · {hhmm(m.next.start)}
          </span>
        </span>
      </span>
    ) : (
      <span className="flex items-start gap-2 text-muted">
        <Clock size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
        <span className="text-xs">No slot matches their times this week</span>
      </span>
    );
  }
  if (m.kind === "leave") {
    return (
      <span className="flex items-start gap-2">
        <Warning size={16} className="mt-0.5 shrink-0 text-warning" aria-hidden="true" />
        <span className="min-w-0">
          <span className="block text-warning">On leave until {m.until}</span>
          <span className="block text-xs text-muted">{m.anyCount ? `${m.anyCount} with another ${DISCIPLINE_LABEL[discipline].toLowerCase()} practitioner` : "No other practitioner matches their times"}</span>
        </span>
      </span>
    );
  }
  return m.free > 0 ? (
    <span className="flex items-start gap-2">
      <CalendarCheck size={16} className="mt-0.5 shrink-0 text-ink" aria-hidden="true" />
      <span className="block text-ink">
        {m.free} {m.free === 1 ? "place" : "places"} left in {m.title}
      </span>
    </span>
  ) : (
    <span className="flex items-start gap-2">
      <Clock size={16} className="mt-0.5 shrink-0 text-muted" aria-hidden="true" />
      <span className="min-w-0">
        <span className="block text-ink-2">Class full · {m.capacity} of {m.capacity}</span>
        <span className="block text-xs text-muted">{m.others ? `${m.others} other ${m.others === 1 ? "class has" : "classes have"} places` : "No other class has places"}</span>
      </span>
    </span>
  );
}

function StatusCell({ w }: { w: WaitEntry }) {
  if (w.status === "booked") {
    return (
      <span className="flex flex-col items-start gap-1">
        <StatusBadge tone="success">Booked</StatusBadge>
        {w.offer ? <span className="text-xs text-muted">{offerLabel(w.offer)}</span> : null}
      </span>
    );
  }
  if (w.status === "offered" && w.offer) {
    return (
      <span className="flex flex-col items-start gap-1">
        <StatusBadge tone="info">Offered · awaiting reply</StatusBadge>
        <span className="text-xs text-muted">{offerLabel(w.offer)}</span>
      </span>
    );
  }
  return <StatusBadge tone="neutral">Waiting</StatusBadge>;
}

function RowActions({ w, emphasise, onOffer, onAccept, onDecline, onRemove }: { w: WaitEntry; emphasise: boolean; onOffer: () => void; onAccept: () => void; onDecline: () => void; onRemove: () => void }) {
  const p = useSchedule().person(w.patientId);
  return (
    <span className="flex items-center justify-end gap-2">
      {w.status === "waiting" ? (
        <Button size="sm" variant={emphasise ? "dark" : "secondary"} leading={<CalendarPlus />} onClick={onOffer}>
          Offer slot
        </Button>
      ) : w.status === "offered" ? (
        <>
          <Button size="sm" variant="dark" leading={<CalendarCheck />} onClick={onAccept}>
            Accepted — book
          </Button>
          <IconButton size="sm" variant="soft" label="Mark as declined" tooltip onClick={onDecline}>
            <X />
          </IconButton>
        </>
      ) : w.offer?.kind === "slot" ? (
        <Button asChild size="sm" variant="ghost" leading={<CalendarBlank />}>
          <Link href={`/schedule?date=${w.offer.date}${w.bookedId ? `&focus=${w.bookedId}` : ""}`}>View</Link>
        </Button>
      ) : null}
      <Dropdown>
        <DropdownTrigger asChild>
          <IconButton size="sm" variant="soft" label={`More actions for ${p?.name ?? "entry"}`}>
            <DotsThree weight="bold" />
          </IconButton>
        </DropdownTrigger>
        <DropdownContent className="w-[220px]">
          {w.status === "offered" ? (
            <DropdownItem icon={<CalendarPlus />} onSelect={onOffer}>
              Offer a different slot
            </DropdownItem>
          ) : null}
          {p && !p.local ? (
            <DropdownItem asChild icon={<ArrowUpRight />}>
              <Link href={`/patients/${p.id}`}>Open patient record</Link>
            </DropdownItem>
          ) : null}
          <DropdownSeparator />
          <DropdownItem icon={<Trash />} tone="danger" onSelect={onRemove}>
            Remove from waitlist
          </DropdownItem>
        </DropdownContent>
      </Dropdown>
    </span>
  );
}

"use client";

import { Clock, ChatsCircle } from "@phosphor-icons/react";
import { staffById } from "@/data/staff";
import { patientById } from "@/data/patients";
import { formatDate, formatTime } from "@/lib/format";
import { cn } from "@/lib/cn";
import { Avatar } from "@/components/ui/avatar";
import { SearchInput } from "@/components/ui/input";
import { Segmented } from "@/components/ui/segmented";
import { TODAY_KEY, dayKey, dayName } from "@/features/tasks/time";
import { personById } from "@/features/tasks/people";
import type { ThreadView } from "./store";

export type ThreadFilter = "all" | "patient" | "care-team";

/** "You" · "Dr. Rao" · "Kavya" — compact author names for previews. */
export function shortName(id: string, viewerId: string) {
  if (id === viewerId) return "You";
  const name = personById(id)?.name ?? "";
  if (name.startsWith("Dr. ")) return `Dr. ${name.split(" ").slice(-1)[0]}`;
  return name.split(" ")[0];
}

export const listTime = (iso: string) => (dayKey(iso) === TODAY_KEY ? formatTime(iso) : dayName(iso) === "Yesterday" ? "Yesterday" : formatDate(iso, { day: "numeric", month: "short" }));

/** Left pane: search, channel filter, threads with unread dots and expected-response notes. */
export function ThreadList({
  threads,
  counts,
  selectedId,
  defaultId,
  onSelect,
  query,
  onQuery,
  filter,
  onFilter,
  viewerId,
  isPatient,
  className,
}: {
  threads: ThreadView[];
  counts: Record<ThreadFilter, number>;
  selectedId: string | null;
  /** shown as open on wide screens when nothing was picked yet */
  defaultId?: string | null;
  onSelect: (id: string) => void;
  query: string;
  onQuery: (q: string) => void;
  filter: ThreadFilter;
  onFilter: (f: ThreadFilter) => void;
  viewerId: string;
  isPatient: boolean;
  className?: string;
}) {
  return (
    <section aria-label="Conversations" className={cn("flex min-h-0 flex-col rounded-card bg-sunken p-2", className)}>
      <div className="flex flex-col gap-2 p-2">
        <SearchInput placeholder={isPatient ? "Search your messages" : "Search people, subjects, messages"} aria-label="Search conversations" value={query} onChange={(e) => onQuery(e.target.value)} />
        {!isPatient ? (
          <div className="scrollbar-none -mx-1 overflow-x-auto px-1">
            <Segmented
              ariaLabel="Conversation type"
              size="sm"
              value={filter}
              onChange={onFilter}
              className="w-max"
              items={[
                { value: "all", label: "All", count: counts.all },
                { value: "patient", label: "Patients", count: counts.patient },
                { value: "care-team", label: "Care team", count: counts["care-team"] },
              ]}
            />
          </div>
        ) : null}
      </div>
      <ul className="scrollbar-thin flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto md:pb-1">
        {threads.map((t) => (
          <li key={t.id}>
            <ThreadRow thread={t} selected={t.id === selectedId} implicit={!selectedId && t.id === defaultId} onSelect={() => onSelect(t.id)} viewerId={viewerId} isPatient={isPatient} />
          </li>
        ))}
        {threads.length === 0 ? (
          <li className="flex flex-col items-center gap-2 px-4 py-10 text-center">
            <span className="flex size-10 items-center justify-center rounded-full bg-surface text-muted">
              <ChatsCircle size={18} />
            </span>
            <p className="text-sm text-ink">No conversations match</p>
            <p className="text-xs text-muted">Try another name or clear the search.</p>
          </li>
        ) : null}
      </ul>
    </section>
  );
}

function ThreadRow({ thread, selected, implicit, onSelect, viewerId, isPatient }: { thread: ThreadView; selected: boolean; implicit: boolean; onSelect: () => void; viewerId: string; isPatient: boolean }) {
  const last = thread.messages[thread.messages.length - 1];
  const lastAuthor = last ? shortName(last.authorId, viewerId) : "";
  const patient = patientById(thread.patientId);
  const staff = thread.participants.filter((id) => id.startsWith("s-")).map((id) => staffById(id)).filter((s) => !!s);
  const unread = thread.unreadCount > 0;
  const awaitingReply = !isPatient && thread.channel === "patient" && last && last.authorId === thread.patientId;

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-current={selected ? "true" : undefined}
      className={cn(
        "relative flex w-full items-start gap-3 rounded-inner p-3 text-left transition-[background-color,box-shadow] duration-200",
        selected ? "bg-surface" : implicit ? "hover:bg-surface/60 md:bg-surface" : "hover:bg-surface/60",
      )}
    >
      <span className="relative shrink-0">
        {isPatient || thread.channel === "care-team" || !patient ? (
          <span className="relative flex">
            <Avatar src={staff[0]?.avatar} name={staff[0]?.name ?? thread.subject} size="md" />
            {staff[1] ? <Avatar src={staff[1].avatar} name={staff[1].name} size="xs" ring className="absolute -bottom-1 -right-1" /> : null}
          </span>
        ) : (
          <Avatar src={patient.avatar} name={patient.name} size="md" />
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline gap-2">
          <span className={cn("min-w-0 flex-1 truncate text-sm", unread ? "font-medium text-ink" : "text-ink")}>{thread.subject}</span>
          <span className={cn("shrink-0 text-[11px] tabular", unread ? "text-primary-ink" : "text-muted")}>{listTime(thread.lastAt)}</span>
        </span>
        <span className="mt-0.5 block truncate text-xs text-muted">
          {lastAuthor ? <span className="text-ink-2">{lastAuthor}: </span> : null}
          {thread.lastMessage}
        </span>
        <span className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted">
          {!isPatient ? (
            <span className={cn("inline-flex h-5 items-center rounded-full px-2", thread.channel === "patient" ? "bg-canvas text-ink-2" : "bg-charcoal text-white")}>
              {thread.channel === "patient" ? (patient ? patient.name.split(" ")[0] : "Patient") : "Care team"}
            </span>
          ) : null}
          <span className="inline-flex items-center gap-1">
            <Clock size={12} aria-hidden="true" />
            {thread.expectedResponse}
          </span>
          {awaitingReply ? <span className="inline-flex h-5 items-center rounded-full bg-warning-soft px-2 text-warning">Awaiting reply</span> : null}
        </span>
      </span>
      {unread ? (
        <span className="mt-1 flex size-5 shrink-0 items-center justify-center rounded-full bg-primary text-[11px] text-white tabular">
          {thread.unreadCount}
          <span className="sr-only"> unread</span>
        </span>
      ) : null}
    </button>
  );
}

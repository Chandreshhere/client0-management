"use client";

import { Eye, EyeSlash } from "@phosphor-icons/react";
import { EVENT_TYPE_LABEL, RECORD_STATE_LABEL, type CareEvent } from "@/data/featured";
import { Avatar } from "@/components/ui/avatar";
import { StatusBadge, recordTone } from "@/components/ui/status";
import { cn } from "@/lib/cn";
import { formatDate, formatTime } from "@/lib/format";
import { EVENT_ICON, authorAvatar, authorName, entryGap } from "./care-map-model";

/**
 * Selected care event: what happened, when it happened, when it was entered (kept apart — doc
 * §5C), who entered it, its state and whether it was released to the patient.
 * Type budget: 12 / 14 / 16px · 400 / 500.
 */
export function EventDetail({ event, className, framed = true }: { event: CareEvent; className?: string; framed?: boolean }) {
  const Icon = EVENT_ICON[event.type];
  const avatar = authorAvatar(event.authorId);
  return (
    <div className={cn(framed && "rounded-card bg-surface p-4", className)}>
      <div className="flex items-center justify-between gap-2">
        <span aria-hidden="true" className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary-ink">
          <Icon size={16} />
        </span>
        <StatusBadge tone={recordTone(event.state)}>{RECORD_STATE_LABEL[event.state]}</StatusBadge>
      </div>
      <p className="mt-3 text-xs text-muted">{EVENT_TYPE_LABEL[event.type]}</p>
      <p className="mt-1 text-base leading-snug text-ink">{event.title}</p>

      <ol className="relative mt-3 flex flex-col gap-2" aria-label="Event and entry dates">
        <span aria-hidden="true" className="absolute bottom-[10px] left-[3px] top-[10px] w-px bg-line-strong" />
        <li className="relative flex items-baseline gap-3 pl-4 text-sm">
          <span aria-hidden="true" className="absolute left-0 top-[7px] size-[7px] rounded-full bg-primary" />
          <span className="w-16 shrink-0 text-xs text-muted">Happened</span>
          <span className="text-ink tabular">{formatDate(event.date)}</span>
        </li>
        <li className="relative flex items-baseline gap-3 pl-4 text-sm">
          <span aria-hidden="true" className="absolute left-0 top-[7px] size-[7px] rounded-full bg-surface shadow-[inset_0_0_0_1.5px_var(--color-primary)]" />
          <span className="w-16 shrink-0 text-xs text-muted">Entered</span>
          <span className="text-ink tabular">
            {formatDate(event.enteredAt)} · {formatTime(event.enteredAt)}
          </span>
        </li>
      </ol>
      <p className="mt-2 text-xs text-muted">{entryGap(event)}</p>

      {event.values?.length ? (
        <ul className="mt-3 flex flex-wrap gap-1.5" aria-label="Values">
          {event.values.map((v) => (
            <li key={v.label} className="inline-flex h-6 items-center gap-1 rounded-full bg-sunken px-2.5 text-xs text-ink-2 tabular">
              {v.label} {v.value}
              {v.unit ? ` ${v.unit}` : ""}
              {v.flag ? <span className={v.flag === "high" ? "text-danger" : "text-warning"}>{v.flag === "high" ? " ↑" : " ↓"}</span> : null}
              {v.flag ? <span className="sr-only">{v.flag === "high" ? "above range" : "below range"}</span> : null}
            </li>
          ))}
        </ul>
      ) : null}

      <div className="mt-3 flex items-center gap-2 text-xs text-muted">
        <Avatar src={avatar} name={authorName(event.authorId)} size="xs" />
        <span className="min-w-0 truncate">
          <span className="text-ink-2">{authorName(event.authorId)}</span> · {event.authorRole}
        </span>
      </div>
      <p className="mt-2 flex items-center gap-1.5 text-xs text-muted">
        {event.released ? <Eye size={14} aria-hidden="true" /> : <EyeSlash size={14} aria-hidden="true" />}
        {event.released ? "Released to the patient portal" : "Not released to the patient yet"}
      </p>
    </div>
  );
}

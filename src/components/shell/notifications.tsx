"use client";

import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { useMemo, useState } from "react";
import { Bell, ChatCircleDots, ArrowsLeftRight, FileMagnifyingGlass, WarningOctagon, ShieldWarning, CalendarX, ClipboardText } from "@phosphor-icons/react";
import type { NotificationKind } from "@/data/types";
import { NOTIFICATIONS } from "@/data/care";
import { relativeTime } from "@/lib/format";
import { cn } from "@/lib/cn";
import { Popover, PopoverContent, PopoverTrigger, PopoverClose } from "@/components/ui/popover";
import { Segmented } from "@/components/ui/segmented";
import { EmptyState } from "@/components/ui/misc";
import { pop } from "@/lib/motion";
import { useRole } from "./role-context";

const ICON: Record<NotificationKind, React.ReactNode> = {
  "report-review": <FileMagnifyingGlass size={18} />,
  "referral-pending": <ArrowsLeftRight size={18} />,
  "guidance-changed": <ShieldWarning size={18} />,
  "missed-follow-up": <CalendarX size={18} />,
  "payment-failed": <WarningOctagon size={18} />,
  message: <ChatCircleDots size={18} />,
  "intake-missing": <ClipboardText size={18} />,
};

/** Action-first notifications (doc §5G): only events that need someone to do something. */
export function Notifications() {
  const { role } = useRole();
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const [tab, setTab] = useState<"action" | "all">("action");

  const mine = useMemo(() => NOTIFICATIONS.filter((n) => n.roles.includes(role)).sort((a, b) => b.at.localeCompare(a.at)), [role]);
  const isRead = (id: string, read: boolean) => read || readIds.has(id);
  const unread = mine.filter((n) => !isRead(n.id, n.read)).length;
  const list = tab === "action" ? mine.filter((n) => !isRead(n.id, n.read)) : mine;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={unread ? `Notifications, ${unread} need action` : "Notifications"}
          className="relative flex size-10 shrink-0 items-center justify-center rounded-full bg-surface text-ink shadow-[inset_0_0_0_1px_var(--color-line)] transition-colors hover:bg-canvas data-[state=open]:bg-charcoal data-[state=open]:text-white"
        >
          <Bell size={18} />
          <AnimatePresence>
            {unread ? (
              <motion.span
                key={unread}
                initial={{ scale: 0.4 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0 }}
                transition={pop}
                className="absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-primary px-1 text-[10px] font-medium text-white ring-2 ring-canvas tabular"
              >
                {unread}
              </motion.span>
            ) : null}
          </AnimatePresence>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[min(420px,calc(100vw-32px))] p-0">
        <div className="flex items-center justify-between gap-2 px-5 pb-3 pt-5">
          <h2 className="text-base font-normal">Notifications</h2>
          <button
            type="button"
            disabled={!unread}
            onClick={() => setReadIds(new Set(mine.map((n) => n.id)))}
            className="rounded-full px-3 py-1.5 text-xs text-primary transition-colors hover:bg-primary-soft disabled:text-faint disabled:hover:bg-transparent"
          >
            Mark all as read
          </button>
        </div>
        <div className="px-5 pb-3">
          <Segmented
            ariaLabel="Filter notifications"
            size="sm"
            variant="tray"
            value={tab}
            onChange={setTab}
            items={[
              { value: "action", label: "Needs action", count: unread },
              { value: "all", label: "All" },
            ]}
          />
        </div>
        <div className="scrollbar-thin max-h-[420px] overflow-y-auto px-2 pb-2 overscroll-contain">
          {list.length === 0 ? (
            <EmptyState icon={<Bell />} title="You're all caught up" description="New reports, referrals and guidance changes that need you will appear here." />
          ) : (
            <ul>
              {list.map((n) => {
                const read = isRead(n.id, n.read);
                return (
                  <li key={n.id} className={cn("flex gap-3 rounded-[18px] p-3 transition-colors hover:bg-canvas", !read && "bg-primary-soft/40")}>
                    <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-full", read ? "bg-sunken text-muted" : "bg-primary text-white")}>{ICON[n.kind]}</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-ink">{n.title}</p>
                      <p className="mt-0.5 text-xs text-muted">{n.body}</p>
                      <div className="mt-2 flex items-center gap-3">
                        <PopoverClose asChild>
                          <Link
                            href={n.href}
                            onClick={() => setReadIds((s) => new Set(s).add(n.id))}
                            className="rounded-full bg-charcoal px-3 py-1 text-xs text-white transition-colors hover:bg-ink-2"
                          >
                            {n.actionLabel}
                          </Link>
                        </PopoverClose>
                        <span className="text-xs text-faint">{relativeTime(n.at)}</span>
                      </div>
                    </div>
                    {!read ? <span className="mt-1 size-2 shrink-0 rounded-full bg-primary" aria-label="Unread" /> : null}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

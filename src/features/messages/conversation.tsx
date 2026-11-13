"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowUpRight, ChatCircleDots, Clock, CloudSlash, Copy, DotsThree, EnvelopeSimple, IdentificationCard, ListPlus, PaperPlaneRight, Siren } from "@phosphor-icons/react";
import { staffById } from "@/data/staff";
import { patientById } from "@/data/patients";
import { formatDate, formatTime } from "@/lib/format";
import { cn } from "@/lib/cn";
import { pop } from "@/lib/motion";
import { Avatar, AvatarStack } from "@/components/ui/avatar";
import { IconButton } from "@/components/ui/icon-button";
import { Textarea } from "@/components/ui/input";
import { Kbd } from "@/components/ui/misc";
import { Tip } from "@/components/ui/tooltip";
import { Dropdown, DropdownContent, DropdownItem, DropdownTrigger } from "@/components/ui/dropdown";
import { OrganImage } from "@/components/viz/organ";
import { personById } from "@/features/tasks/people";
import { patientOrgan } from "@/features/tasks/organ-glyph";
import { dayKey, dayName } from "@/features/tasks/time";
import { RESPONSE_COPY, type ChatMessage } from "./data";
import type { ThreadView } from "./store";

type Block = { kind: "day"; key: string; label: string } | { kind: "group"; key: string; authorId: string; messages: ChatMessage[] };

function toBlocks(messages: ChatMessage[]): Block[] {
  const out: Block[] = [];
  let day = "";
  let group: Extract<Block, { kind: "group" }> | null = null;
  for (const m of messages) {
    const d = dayKey(m.at);
    if (d !== day) {
      const name = dayName(m.at);
      out.push({ kind: "day", key: `day-${d}`, label: name === "Today" || name === "Yesterday" ? name : formatDate(m.at, { weekday: "long", day: "numeric", month: "long" }) });
      day = d;
      group = null;
    }
    const prev = group?.messages[group.messages.length - 1];
    if (group && prev && group.authorId === m.authorId && new Date(m.at).getTime() - new Date(prev.at).getTime() <= 15 * 60_000) {
      group.messages.push(m);
    } else {
      group = { kind: "group", key: m.id, authorId: m.authorId, messages: [m] };
      out.push(group);
    }
  }
  return out;
}

/** Right pane: one conversation. Messages written here are saved locally and never "delivered". */
export function Conversation({
  thread,
  viewerId,
  isPatient,
  onBack,
  onSend,
  onTurnIntoTask,
  onCopy,
  onMarkUnread,
  onShowContext,
  className,
}: {
  thread: ThreadView;
  viewerId: string;
  isPatient: boolean;
  onBack: () => void;
  onSend: (body: string) => void;
  onTurnIntoTask: (m: ChatMessage) => void;
  onCopy: (m: ChatMessage) => void;
  onMarkUnread: () => void;
  /** opens the patient-context drawer (below xl, where the context column is hidden) */
  onShowContext?: () => void;
  className?: string;
}) {
  const blocks = useMemo(() => toBlocks(thread.messages), [thread.messages]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const lastThread = useRef<string | null>(null);
  const count = thread.messages.length;
  const patient = patientById(thread.patientId);
  const people = thread.participants.map((id) => personById(id)).filter((p) => !!p);
  const others = people.filter((p) => p.id !== viewerId);
  const organ = patientOrgan(thread.patientId);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const jump = lastThread.current !== thread.id;
    lastThread.current = thread.id;
    el.scrollTo({ top: el.scrollHeight, behavior: jump ? "auto" : "smooth" });
  }, [thread.id, count]);

  const banner = isPatient
    ? `${RESPONSE_COPY[thread.expectedResponse] ?? thread.expectedResponse} For urgent symptoms, call the clinic. In an emergency, call 112.`
    : thread.channel === "patient"
      ? `Patient thread · ${thread.expectedResponse.toLowerCase()} — ${patient?.name.split(" ")[0] ?? "the patient"} sees this response time in the portal.`
      : `${RESPONSE_COPY[thread.expectedResponse] ?? thread.expectedResponse} Not visible to the patient.`;

  return (
    <section aria-label={`Conversation: ${thread.subject}`} className={cn("flex min-h-0 flex-col rounded-card bg-surface", className)}>
      <header className="flex items-center gap-3 px-4 pb-3 pt-4 md:px-6 md:pt-5">
        <IconButton label="Back to conversations" variant="soft" className="md:hidden" onClick={onBack}>
          <ArrowLeft />
        </IconButton>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-lg font-normal tracking-[-0.01em] text-ink">{thread.subject}</h2>
          <p className="truncate text-xs text-muted">
            {thread.channel === "care-team" ? "Care team · " : ""}
            {others.map((p) => p.name).join(", ")}
          </p>
        </div>
        <span className="hidden lg:block">
          <AvatarStack people={people.map((p) => ({ name: p.name, avatar: p.avatar }))} max={3} size="sm" />
        </span>
        {onShowContext ? (
          <Tip label="Patient context">
            <button
              type="button"
              onClick={onShowContext}
              aria-label={`Show context for ${patient?.name ?? "this patient"}`}
              className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-surface text-ink shadow-[inset_0_0_0_1px_var(--color-line)] transition-[box-shadow,transform] duration-200 hover:shadow-[inset_0_0_0_1px_var(--color-line-strong)] active:scale-95 xl:hidden"
            >
              {organ ? <OrganImage kind={organ.organ} className="size-[124%] max-w-none" /> : <IdentificationCard size={18} />}
            </button>
          </Tip>
        ) : null}
        {thread.patientId && !isPatient ? (
          <Tip label="Open patient record">
            <Link
              href={`/patients/${thread.patientId}`}
              aria-label={`Open ${patient?.name ?? "patient"}'s record`}
              className="flex size-10 shrink-0 items-center justify-center rounded-full bg-surface text-ink shadow-[inset_0_0_0_1px_var(--color-line)] transition-[background-color,box-shadow,transform] hover:bg-canvas hover:shadow-[inset_0_0_0_1px_var(--color-line-strong)] active:scale-95"
            >
              <ArrowUpRight size={18} />
            </Link>
          </Tip>
        ) : null}
        <Dropdown>
          <DropdownTrigger asChild>
            <button type="button" aria-label="Conversation actions" className="flex size-10 shrink-0 items-center justify-center rounded-full text-ink-2 transition-colors hover:bg-sunken data-[state=open]:bg-sunken">
              <DotsThree size={20} weight="bold" />
            </button>
          </DropdownTrigger>
          <DropdownContent className="w-[260px]">
            <DropdownItem icon={<EnvelopeSimple />} onSelect={onMarkUnread}>
              Mark as unread
            </DropdownItem>
            {!isPatient && thread.messages.length ? (
              <DropdownItem icon={<ListPlus />} onSelect={() => onTurnIntoTask(thread.messages[thread.messages.length - 1])} description="Creates a task from the latest message">
                Turn latest into task
              </DropdownItem>
            ) : null}
          </DropdownContent>
        </Dropdown>
      </header>

      <div className="mx-4 flex items-start gap-2 rounded-inner bg-canvas px-4 py-3 text-xs leading-relaxed text-ink-2 md:mx-6">
        {isPatient ? <Siren size={16} className="mt-px shrink-0 text-muted" aria-hidden="true" /> : <Clock size={16} className="mt-px shrink-0 text-muted" aria-hidden="true" />}
        <p>{banner}</p>
      </div>

      <div ref={scrollRef} role="log" aria-live="polite" aria-label="Messages" className="scrollbar-thin min-h-0 flex-1 overflow-y-auto px-4 py-4 md:px-6">
        {blocks.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
            <ChatCircleDots size={24} className="text-muted" aria-hidden="true" />
            <p className="text-sm text-muted">No messages yet.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {blocks.map((b) =>
              b.kind === "day" ? (
                <div key={b.key} className="flex items-center gap-3 py-1" role="separator" aria-label={b.label}>
                  <span className="h-px flex-1 bg-line" aria-hidden="true" />
                  <span className="rounded-full bg-canvas px-3 py-1 text-[11px] text-muted">{b.label}</span>
                  <span className="h-px flex-1 bg-line" aria-hidden="true" />
                </div>
              ) : (
                <MessageGroup key={b.key} authorId={b.authorId} messages={b.messages} mine={b.authorId === viewerId} canTask={!isPatient} onTurnIntoTask={onTurnIntoTask} onCopy={onCopy} />
              ),
            )}
          </div>
        )}
      </div>

      <Composer key={thread.id} onSend={onSend} placeholder={isPatient ? "Write to your care team…" : thread.channel === "patient" ? `Reply to ${patient?.name.split(" ")[0] ?? "the patient"}…` : "Message the care team…"} />
    </section>
  );
}

function MessageGroup({
  authorId,
  messages,
  mine,
  canTask,
  onTurnIntoTask,
  onCopy,
}: {
  authorId: string;
  messages: ChatMessage[];
  mine: boolean;
  canTask: boolean;
  onTurnIntoTask: (m: ChatMessage) => void;
  onCopy: (m: ChatMessage) => void;
}) {
  const author = personById(authorId);
  const staff = staffById(authorId);
  const last = messages[messages.length - 1];
  const local = messages.some((m) => m.local);
  return (
    <div className={cn("flex items-end gap-2", mine ? "justify-end" : "justify-start")}>
      {!mine ? <Avatar src={author?.avatar} name={author?.name ?? "Unknown"} size="sm" className="mb-5" /> : null}
      <div className={cn("flex min-w-0 max-w-[min(560px,86%)] flex-col gap-1", mine ? "items-end" : "items-start")}>
        {!mine ? (
          <p className="px-1 text-[11px] text-muted">
            <span className="text-ink-2">{author?.name ?? "Unknown"}</span> · {staff ? staff.title.split(" · ")[0] : "Patient"}
          </p>
        ) : null}
        {messages.map((m, i) => (
          <Bubble key={m.id} message={m} mine={mine} tail={i === messages.length - 1} canTask={canTask} onTurnIntoTask={onTurnIntoTask} onCopy={onCopy} />
        ))}
        <p className="flex items-center gap-1.5 px-1 text-[11px] text-muted tabular">
          {formatTime(last.at)}
          {local ? (
            <span className="inline-flex items-center gap-1 text-warning">
              · <CloudSlash size={12} aria-hidden="true" /> Demo · not delivered
            </span>
          ) : null}
        </p>
      </div>
    </div>
  );
}

function Bubble({ message, mine, tail, canTask, onTurnIntoTask, onCopy }: { message: ChatMessage; mine: boolean; tail: boolean; canTask: boolean; onTurnIntoTask: (m: ChatMessage) => void; onCopy: (m: ChatMessage) => void }) {
  const actions = (
    <Dropdown>
      <DropdownTrigger asChild>
        <button
          type="button"
          aria-label="Message actions"
          className="flex size-8 shrink-0 items-center justify-center rounded-full text-muted opacity-0 transition-[opacity,background-color] duration-150 hover:bg-sunken hover:text-ink focus-visible:opacity-100 group-hover/msg:opacity-100 data-[state=open]:bg-sunken data-[state=open]:opacity-100 [@media(hover:none)]:opacity-100"
        >
          <DotsThree size={18} weight="bold" />
        </button>
      </DropdownTrigger>
      <DropdownContent align={mine ? "end" : "start"} className="w-[240px]">
        {canTask ? (
          <DropdownItem icon={<ListPlus />} onSelect={() => onTurnIntoTask(message)} description="Assigned to you · due tomorrow">
            Turn into task
          </DropdownItem>
        ) : null}
        <DropdownItem icon={<Copy />} onSelect={() => onCopy(message)}>
          Copy text
        </DropdownItem>
      </DropdownContent>
    </Dropdown>
  );
  return (
    <div className={cn("group/msg flex max-w-full items-center gap-1", mine ? "flex-row" : "flex-row-reverse")}>
      {actions}
      <motion.div
        initial={message.local ? { opacity: 0, y: 12, scale: 0.96 } : false}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={pop}
        style={{ transformOrigin: mine ? "100% 100%" : "0% 100%" }}
        className={cn(
          "min-w-0 whitespace-pre-wrap break-words rounded-inner px-4 py-2.5 text-sm leading-relaxed",
          mine ? "bg-charcoal text-white" : "bg-sunken text-ink",
          tail && (mine ? "rounded-br-md" : "rounded-bl-md"),
        )}
      >
        {message.body}
      </motion.div>
    </div>
  );
}

function Composer({ onSend, placeholder }: { onSend: (body: string) => void; placeholder: string }) {
  const [text, setText] = useState("");
  const ref = useRef<HTMLTextAreaElement>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [text]);

  const submit = () => {
    const body = text.trim();
    if (!body) return;
    onSend(body);
    setText("");
    ref.current?.focus();
  };

  return (
    <form
      className="px-3 pb-3 pt-1 md:px-4 md:pb-4"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <div className="flex items-end gap-2 rounded-inner bg-canvas p-2 transition-shadow duration-150 focus-within:shadow-[inset_0_0_0_2px_var(--color-primary)]">
        <label htmlFor="composer" className="sr-only">
          Message
        </label>
        <Textarea
          ref={ref}
          id="composer"
          rows={1}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              submit();
            }
          }}
          placeholder={placeholder}
          className="max-h-40 min-h-10 resize-none bg-transparent px-3 py-2 shadow-none hover:shadow-none focus:shadow-none"
        />
        <IconButton type="submit" variant="primary" label="Send message" disabled={!text.trim()}>
          <PaperPlaneRight weight="fill" />
        </IconButton>
      </div>
      <p className="mt-2 hidden px-2 text-[11px] leading-6 text-muted sm:block">
        <Kbd>Enter</Kbd> to send · <Kbd>Shift</Kbd>+<Kbd>Enter</Kbd> new line · saved in this browser only — not delivered
      </p>
    </form>
  );
}

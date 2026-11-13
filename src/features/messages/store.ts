import { useMemo } from "react";
import type { MessageThread, Role } from "@/data/types";
import { THREADS } from "@/data/records";
import { createSessionStore, localId, useSessionStore } from "@/features/tasks/session-store";
import { NOW_ISO, byTime } from "@/features/tasks/time";
import { MESSAGES, type ChatMessage } from "./data";

/**
 * Threads and messages = fixtures + whatever was written in this browser session.
 * Messages written here are never "delivered" — there is no messaging integration.
 */
export interface ThreadView extends MessageThread {
  messages: ChatMessage[];
  unreadCount: number;
  local?: boolean;
}

interface MessageState {
  threads: MessageThread[];
  messages: ChatMessage[];
  read: Record<string, boolean>;
}

const SEED: MessageState = { threads: [], messages: [], read: {} };
export const messageStore = createSessionStore<MessageState>("carelane.care.messages.v1", SEED);

/** Threads visible to this person (patients only see their own patient-channel threads). */
export function useThreads(role: Role, userId: string): ThreadView[] {
  const s = useSessionStore(messageStore);
  return useMemo(() => {
    const localIds = new Set(s.threads.map((t) => t.id));
    const all = [...s.threads, ...THREADS];
    const visible = role === "patient" ? all.filter((t) => t.channel === "patient" && t.participants.includes(userId)) : all;
    return visible
      .map((t) => {
        const messages = [...MESSAGES.filter((m) => m.threadId === t.id), ...s.messages.filter((m) => m.threadId === t.id)].sort((a, b) => byTime(a.at, b.at));
        const last = messages[messages.length - 1];
        const read = s.read[t.id];
        // Fixture unread counts are staff-facing; a patient has unread mail when the team spoke last.
        const baseUnread = role === "patient" ? (last && last.authorId !== userId ? 1 : 0) : last && last.authorId === userId ? 0 : t.unread;
        return {
          ...t,
          messages,
          lastMessage: last?.body ?? t.lastMessage,
          lastAt: last?.at ?? t.lastAt,
          unreadCount: read === true ? 0 : read === false ? Math.max(1, baseUnread) : baseUnread,
          local: localIds.has(t.id),
        };
      })
      .sort((a, b) => byTime(b.lastAt, a.lastAt));
  }, [s, role, userId]);
}

export function markRead(threadId: string, read = true) {
  const current = messageStore.get().read[threadId];
  if (current === read) return;
  messageStore.update((s) => ({ ...s, read: { ...s.read, [threadId]: read } }));
}

export function sendMessage(threadId: string, authorId: string, body: string): ChatMessage {
  const msg: ChatMessage = { id: localId("msg"), threadId, authorId, body, at: NOW_ISO, local: true };
  messageStore.update((s) => ({ ...s, messages: [...s.messages, msg], read: { ...s.read, [threadId]: true } }));
  return msg;
}

export function createThread(input: Omit<MessageThread, "id" | "lastMessage" | "lastAt" | "unread">, authorId: string, body: string): MessageThread {
  const thread: MessageThread = { ...input, id: localId("thread"), lastMessage: body, lastAt: NOW_ISO, unread: 0 };
  const msg: ChatMessage = { id: localId("msg"), threadId: thread.id, authorId, body, at: NOW_ISO, local: true };
  messageStore.update((s) => ({ ...s, threads: [thread, ...s.threads], messages: [...s.messages, msg], read: { ...s.read, [thread.id]: true } }));
  return thread;
}

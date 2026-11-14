"use client";

import { useRouter } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { NotePencil } from "@phosphor-icons/react";
import { patientById } from "@/data/patients";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/button";
import { Dialog, SheetContent } from "@/components/ui/dialog";
import { PageHeader } from "@/components/ui/misc";
import { useToast } from "@/components/ui/toast";
import { useRole } from "@/components/shell/role-context";
import { createTask } from "@/features/tasks/store";
import { personById } from "@/features/tasks/people";
import { TODAY_KEY, addDays, isoAt } from "@/features/tasks/time";
import { QueryFlag, useClearQuery } from "@/features/tasks/ui";
import type { ChatMessage } from "./data";
import { markRead, sendMessage, useThreads, type ThreadView } from "./store";
import { ThreadList, type ThreadFilter } from "./thread-list";
import { Conversation } from "./conversation";
import { NewMessageModal } from "./new-message-modal";
import { PatientContext } from "./patient-context";

const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);

/** /messages — secure messaging with visible response times; honest "not delivered" states. */
export function MessagesView() {
  const { role, user } = useRole();
  const { toast } = useToast();
  const router = useRouter();
  const isPatient = role === "patient";
  const threads = useThreads(role, user.id);
  const [filter, setFilter] = useState<ThreadFilter>("all");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mobileView, setMobileView] = useState<"list" | "thread">("list");
  const [newOpen, setNewOpen] = useState(false);
  const [contextOpen, setContextOpen] = useState(false);
  const clearNew = useClearQuery("new");

  const q = query.trim().toLowerCase();
  const visible = useMemo(
    () =>
      threads.filter((t) => {
        if (!isPatient && filter !== "all" && t.channel !== filter) return false;
        if (!q) return true;
        const names = t.participants.map((id) => personById(id)?.name ?? "").join(" ");
        const hay = `${t.subject} ${patientById(t.patientId)?.name ?? ""} ${names} ${t.messages.map((m) => m.body).join(" ")}`.toLowerCase();
        return hay.includes(q);
      }),
    [threads, filter, q, isPatient],
  );
  const counts = {
    all: threads.length,
    patient: threads.filter((t) => t.channel === "patient").length,
    "care-team": threads.filter((t) => t.channel === "care-team").length,
  };

  const activeId = selectedId && threads.some((t) => t.id === selectedId) ? selectedId : (visible[0]?.id ?? null);
  const active = threads.find((t) => t.id === activeId) ?? null;

  // Opening a thread marks it read (on small screens only once it is actually shown).
  useEffect(() => {
    if (!activeId) return;
    if (selectedId === activeId || window.matchMedia("(min-width: 768px)").matches) markRead(activeId);
  }, [activeId, selectedId]);

  const select = (id: string) => {
    setSelectedId(id);
    setMobileView("thread");
    markRead(id);
  };

  const send = (t: ThreadView, body: string) => {
    sendMessage(t.id, user.id, body);
    toast({ title: "Saved — not delivered", description: "Kept in this browser session. There's no messaging integration in this prototype, so nobody received it.", tone: "warning" });
  };

  const turnIntoTask = (t: ThreadView, m: ChatMessage) => {
    const author = personById(m.authorId)?.name ?? "someone";
    createTask(
      {
        title: `Follow up: ${clip(m.body, 72)}`,
        patientId: t.patientId ?? undefined,
        ownerId: user.id,
        due: isoAt(addDays(TODAY_KEY, 1), "18:00"),
        priority: "normal",
        source: `Message from ${author} · ${t.subject}`,
        notes: m.body,
      },
      user.id,
    );
    toast({
      title: "Task created from message",
      description: "Assigned to you · due tomorrow 18:00. Saved in this browser session.",
      tone: "success",
      action: { label: "Open tasks", onClick: () => router.push("/tasks") },
    });
  };

  const copy = (m: ChatMessage) => {
    navigator.clipboard
      .writeText(m.body)
      .then(() => toast({ title: "Copied to clipboard" }))
      .catch(() => toast({ title: "Couldn't copy", description: "The browser blocked clipboard access — select the text instead.", tone: "warning" }));
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Messages"
        description={isPatient ? "Write to your care team. Replies usually arrive within 1 working day — this isn't for emergencies." : "Patient and care-team conversations, each with the response time the patient was promised."}
        className={cn(mobileView === "thread" && "max-md:sr-only")}
        actions={
          <Button variant="dark" leading={<NotePencil />} onClick={() => setNewOpen(true)}>
            New message
          </Button>
        }
      />

      <div
        className={cn(
          // fills the window down to a 24px margin (the page heading above is ~158px; main's 64px
          // bottom padding is pulled back to 16px so the page itself never scrolls)
          "grid min-h-0 grid-cols-1 gap-4 md:-mb-12 md:h-[calc(100dvh-182px)] md:min-h-[540px] md:grid-cols-[minmax(280px,340px)_minmax(0,1fr)]",
          isPatient ? "xl:grid-cols-[380px_minmax(0,1fr)]" : "xl:grid-cols-[320px_minmax(0,1fr)_288px]",
        )}
      >
        <ThreadList
          threads={visible}
          counts={counts}
          selectedId={selectedId}
          defaultId={activeId}
          onSelect={select}
          query={query}
          onQuery={setQuery}
          filter={filter}
          onFilter={setFilter}
          viewerId={user.id}
          isPatient={isPatient}
          className={cn(mobileView === "thread" && "max-md:hidden")}
        />
        {active ? (
          <Conversation
            thread={active}
            viewerId={user.id}
            isPatient={isPatient}
            onBack={() => setMobileView("list")}
            onSend={(body) => send(active, body)}
            onTurnIntoTask={(m) => turnIntoTask(active, m)}
            onCopy={copy}
            onMarkUnread={() => {
              markRead(active.id, false);
              setMobileView("list");
              toast({ title: "Marked as unread" });
            }}
            onShowContext={!isPatient && active.patientId ? () => setContextOpen(true) : undefined}
            className={cn("max-md:h-[calc(100dvh-104px)]", mobileView === "list" && "max-md:hidden")}
          />
        ) : (
          <div className={cn("hidden items-center justify-center rounded-card bg-surface p-6 text-sm text-muted md:flex")}>Select a conversation</div>
        )}
        {!isPatient && active ? <PatientContext key={active.id} thread={active} role={role} className="hidden xl:flex" /> : null}
      </div>

      {!isPatient && active?.patientId ? (
        <Dialog open={contextOpen} onOpenChange={setContextOpen}>
          <SheetContent title="Patient context" description={`${patientById(active.patientId)?.name ?? "Patient"} · from their record and this week's diary`}>
            <PatientContext thread={active} role={role} />
          </SheetContent>
        </Dialog>
      ) : null}

      <NewMessageModal
        open={newOpen}
        onOpenChange={(o) => {
          setNewOpen(o);
          if (!o) clearNew();
        }}
        onCreated={(t) => {
          setFilter("all");
          setQuery("");
          select(t.id);
        }}
      />
      <Suspense fallback={null}>
        <QueryFlag name="new" onMatch={() => setNewOpen(true)} />
      </Suspense>
    </div>
  );
}

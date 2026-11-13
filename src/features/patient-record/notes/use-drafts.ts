import { useCallback, useEffect, useRef, useState } from "react";
import { NOTE_SECTIONS, type SectionKey } from "../data";
import { localId } from "../store";
import type { DraftSeed } from "./notes-data";

/**
 * Consultation-note drafts for one patient, autosaved to localStorage (this browser only).
 * Typing saves after a short pause ("Saving…" → "Saved locally"); structural changes save at
 * once. If storage is blocked the state says so ("Not saved") instead of pretending.
 */

export type DraftStatus = "draft" | "ready";
export type ReferralTarget = "nutrition" | "movement" | "medical";

export interface LocalReferral {
  id: string;
  to: ReferralTarget;
  toId: string;
  reason: string;
  priority: "normal" | "high" | "urgent";
  dueBy: string;
  at: string;
}

export interface NextReview {
  date: string;
  time: string;
  withId: string;
  kind: string;
  at: string;
}

export interface PublishedInstructions {
  text: string;
  at: string;
  by: string;
}

export interface NoteDraft {
  id: string;
  title: string;
  authorId: string;
  createdAt: string;
  updatedAt: string;
  status: DraftStatus;
  /** today's visit this note belongs to (`withId` = the clinician the visit is booked with) */
  appointment: { at: string; room: string; withId?: string } | null;
  sections: Record<SectionKey, string>;
  referrals: LocalReferral[];
  nextReview: NextReview | null;
  instructions: PublishedInstructions | null;
}

export interface DraftBook {
  drafts: NoteDraft[];
  activeId: string;
}

export type SaveState = { kind: "idle" } | { kind: "saving" } | { kind: "saved" } | { kind: "failed" };

export const BLANK_TITLE = "New consultation note";
const emptySections = (): Record<SectionKey, string> => ({ history: "", findings: "", assessment: "", advice: "", followUp: "" });
const key = (patientId: string) => `carelane.notes.v1.${patientId}`;
const nowIso = () => new Date().toISOString();

function seedBook(authorId: string, seed: DraftSeed): DraftBook {
  const draft: NoteDraft = {
    id: seed.id,
    title: seed.title,
    authorId,
    createdAt: seed.createdAt,
    updatedAt: seed.createdAt,
    status: "draft",
    appointment: seed.appointment,
    sections: { ...seed.sections },
    referrals: [],
    nextReview: null,
    instructions: null,
  };
  return { drafts: [draft], activeId: draft.id };
}

function isDraft(v: unknown): v is NoteDraft {
  if (!v || typeof v !== "object") return false;
  const d = v as Partial<NoteDraft>;
  return typeof d.id === "string" && typeof d.title === "string" && !!d.sections && NOTE_SECTIONS.every((s) => typeof d.sections?.[s.key] === "string") && Array.isArray(d.referrals);
}

function readBook(patientId: string): DraftBook | null {
  try {
    const raw = window.localStorage.getItem(key(patientId));
    if (!raw) return null;
    const v = JSON.parse(raw) as Partial<DraftBook>;
    const drafts = Array.isArray(v.drafts) ? v.drafts.filter(isDraft) : [];
    if (!drafts.length) return null;
    const activeId = drafts.some((d) => d.id === v.activeId) ? (v.activeId as string) : drafts[0].id;
    return { drafts, activeId };
  } catch {
    return null;
  }
}

function writeBook(patientId: string, book: DraftBook): boolean {
  try {
    window.localStorage.setItem(key(patientId), JSON.stringify(book));
    return true;
  } catch {
    return false;
  }
}

export const isBlank = (d: NoteDraft) =>
  d.title === BLANK_TITLE && NOTE_SECTIONS.every((s) => !d.sections[s.key].trim()) && !d.referrals.length && !d.nextReview && !d.instructions;

export function useDraftBook(patientId: string, authorId: string, seed: DraftSeed) {
  const [book, setBook] = useState<DraftBook>(() => seedBook(authorId, seed));
  const [hydrated, setHydrated] = useState(false);
  const [save, setSave] = useState<SaveState>({ kind: "idle" });
  const pending = useRef<"debounced" | "now" | null>(null);

  useEffect(() => {
    const stored = readBook(patientId);
    if (stored) {
      setBook(stored);
      setSave({ kind: "saved" });
    }
    setHydrated(true);
  }, [patientId]);

  useEffect(() => {
    if (!hydrated || !pending.current) return;
    const write = () => {
      pending.current = null;
      setSave(writeBook(patientId, book) ? { kind: "saved" } : { kind: "failed" });
    };
    if (pending.current === "now") {
      write();
      return;
    }
    setSave({ kind: "saving" });
    const t = window.setTimeout(write, 900);
    return () => window.clearTimeout(t);
  }, [book, hydrated, patientId]);

  /** Apply a change to the book. Typing uses "debounced"; everything else saves immediately. */
  const change = useCallback((fn: (b: DraftBook) => DraftBook, mode: "debounced" | "now" = "now") => {
    pending.current = pending.current === "now" ? "now" : mode;
    setBook(fn);
  }, []);

  const active = book.drafts.find((d) => d.id === book.activeId) ?? book.drafts[0];

  const updateActive = useCallback(
    (fn: (d: NoteDraft) => NoteDraft, mode: "debounced" | "now" = "now") =>
      change((b) => ({ ...b, drafts: b.drafts.map((d) => (d.id === b.activeId ? { ...fn(d), updatedAt: nowIso() } : d)) }), mode),
    [change],
  );

  /** Open a blank note — reusing an untouched blank one so repeated "?new=1" visits don't pile up. */
  const openBlank = useCallback(() => {
    change((b) => {
      const blank = b.drafts.find(isBlank);
      if (blank) return { ...b, activeId: blank.id };
      const d: NoteDraft = {
        id: localId("draft"),
        title: BLANK_TITLE,
        authorId,
        createdAt: nowIso(),
        updatedAt: nowIso(),
        status: "draft",
        // a new note belongs to today's visit when there is one
        appointment: seed.appointment,
        sections: emptySections(),
        referrals: [],
        nextReview: null,
        instructions: null,
      };
      return { drafts: [d, ...b.drafts], activeId: d.id };
    });
  }, [change, authorId, seed.appointment]);

  const select = useCallback((id: string) => change((b) => ({ ...b, activeId: id })), [change]);

  /** Remove a draft; returns the removed draft so the caller can offer "Undo". */
  const discard = useCallback(
    (id: string) => {
      const removed = book.drafts.find((d) => d.id === id) ?? null;
      change((b) => {
        const rest = b.drafts.filter((d) => d.id !== id);
        if (!rest.length) {
          const fresh = seedBook(authorId, seed).drafts[0];
          const blank = { ...fresh, id: localId("draft"), title: BLANK_TITLE, sections: emptySections(), appointment: null };
          return { drafts: [blank], activeId: blank.id };
        }
        return { drafts: rest, activeId: b.activeId === id ? rest[0].id : b.activeId };
      });
      return removed;
    },
    [book.drafts, change, authorId, seed],
  );

  /** Undo a discard; untouched blank drafts (e.g. the one created to replace it) are dropped. */
  const restore = useCallback((d: NoteDraft) => change((b) => ({ drafts: [d, ...b.drafts.filter((x) => x.id !== d.id && !isBlank(x))], activeId: d.id })), [change]);

  return { book, active, hydrated, save, updateActive, openBlank, select, discard, restore };
}

"use client";

import { useMemo, useState } from "react";
import { ClipboardText, Info } from "@phosphor-icons/react";
import { patientById } from "@/data/patients";
import { staffById } from "@/data/staff";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/cn";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, Group, GroupHeader, Inset } from "@/components/ui/card";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/input";
import { Pill } from "@/components/ui/pill";
import { Segmented } from "@/components/ui/segmented";
import { useToast } from "@/components/ui/toast";
import { useRole } from "@/components/shell/role-context";
import { ADHERENCE_FOCUS, BARRIERS, DEFAULT_FOCUS, type AdherenceReview, type FoodLog } from "./data";
import { newId, nowIso } from "./model";
import { reviewActions } from "./store";

/**
 * Adherence review (doc §2C): what the patient followed, barriers, agreed changes and the next
 * review — deliberately no single score. Saved in this browser session only.
 */
type Channel = "clinic" | "phone" | "message";
const CHANNEL_LABEL: Record<Channel, string> = { clinic: "In clinic", phone: "Phone call", message: "Message" };
const CHANNEL_SHORT: Record<Channel, string> = { clinic: "Clinic", phone: "Phone", message: "Message" };

export function AdherenceForm({
  patientId,
  patientOptions,
  onPatientChange,
  logs,
  reviews,
  canReview,
}: {
  patientId: string;
  patientOptions: { value: string; label: string }[];
  onPatientChange: (id: string) => void;
  logs: FoodLog[];
  reviews: AdherenceReview[];
  canReview: boolean;
}) {
  return (
    <div id="adherence-review" className="flex scroll-mt-28 flex-col gap-4">
      <AdherenceFormBody key={patientId} patientId={patientId} patientOptions={patientOptions} onPatientChange={onPatientChange} logs={logs} reviews={reviews} canReview={canReview} />
      <PastReviews patientId={patientId} reviews={reviews} />
    </div>
  );
}

function AdherenceFormBody({
  patientId,
  patientOptions,
  onPatientChange,
  logs,
  reviews,
  canReview,
}: {
  patientId: string;
  patientOptions: { value: string; label: string }[];
  onPatientChange: (id: string) => void;
  logs: FoodLog[];
  reviews: AdherenceReview[];
  canReview: boolean;
}) {
  const { toast } = useToast();
  const { user } = useRole();
  const patient = patientById(patientId);
  const first = patient?.name.split(" ")[0] ?? "the patient";
  const focus = ADHERENCE_FOCUS[patientId] ?? DEFAULT_FOCUS;
  const last = reviews.find((r) => r.patientId === patientId);
  const since = last?.at ?? "2026-11-06T00:00:00+05:30";

  const evidence = useMemo(() => {
    const own = logs.filter((l) => l.patientId === patientId && l.eatenAt >= since);
    return { count: own.length, photos: own.filter((l) => l.photo).length, skipped: own.filter((l) => l.match === "skipped").length };
  }, [logs, patientId, since]);

  const [followed, setFollowed] = useState<string[]>([]);
  const [barriers, setBarriers] = useState<string[]>([]);
  const [otherBarrier, setOtherBarrier] = useState("");
  const [notes, setNotes] = useState("");
  const [changes, setChanges] = useState("");
  const [channel, setChannel] = useState<Channel>("clinic");
  const [next, setNext] = useState("2026-11-20");
  const [tried, setTried] = useState(false);

  const errors = {
    changes: changes.trim().length < 8 ? "Record what you agreed with the patient (or that nothing changes, and why)." : null,
    next: !next ? "Pick the next review date" : next <= "2026-11-13" ? "Next review must be after today (13 Nov)" : null,
  };

  const toggle = (list: string[], set: (v: string[]) => void, v: string) => set(list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  const save = () => {
    setTried(true);
    if (errors.changes || errors.next) return;
    const allBarriers = otherBarrier.trim() ? [...barriers, otherBarrier.trim()] : barriers;
    reviewActions.save({
      id: newId("rv"),
      patientId,
      by: user.id,
      at: nowIso(),
      followed,
      barriers: allBarriers,
      notes: notes.trim(),
      changes: `${changes.trim()} (agreed ${CHANNEL_LABEL[channel].toLowerCase()})`,
      nextReview: next,
      source: `${evidence.count} self-reported entries${evidence.photos ? ` (${evidence.photos} with photos)` : ""}`,
    });
    toast({ title: `Adherence review saved for ${first}`, description: "Saved in this browser session — not added to the shared record or sent to the patient.", tone: "success" });
    setFollowed([]);
    setBarriers([]);
    setOtherBarrier("");
    setNotes("");
    setChanges("");
    setTried(false);
  };

  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-normal tracking-[-0.01em] text-ink">Adherence review</h2>
          <p className="mt-1 text-xs text-muted">Since {formatDate(since, { day: "numeric", month: "short" })} · {evidence.count} self-reported entries · {evidence.photos} with photos</p>
        </div>
        <ClipboardText size={20} className="shrink-0 text-ink-2" aria-hidden="true" />
      </div>

      <div className="mt-4 flex flex-col gap-4">
        <Field label="Patient">{(a) => <Select id={a.id} value={patientId} onValueChange={onPatientChange} options={patientOptions} />}</Field>

        <p className="flex items-start gap-2 rounded-inner bg-canvas p-3 text-xs text-ink-2">
          <Info size={16} className="mt-px shrink-0 text-muted" aria-hidden="true" />
          No single adherence score — note what {first} followed, what got in the way and what you agreed.
        </p>

        <fieldset disabled={!canReview} className="flex flex-col gap-2">
          <legend className="mb-2 text-sm text-ink">What was followed</legend>
          {focus.map((f) => {
            const id = `fol-${f.replace(/\W+/g, "-")}`;
            return (
              <label key={f} htmlFor={id} className="flex cursor-pointer items-center gap-3 rounded-[12px] px-2 py-1.5 text-sm text-ink-2 hover:bg-canvas">
                <Checkbox id={id} checked={followed.includes(f)} onCheckedChange={() => toggle(followed, setFollowed, f)} />
                {f}
              </label>
            );
          })}
        </fieldset>

        <Field label="Notes on what happened" optional>
          {(a) => <Textarea {...a} value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} disabled={!canReview} placeholder={evidence.skipped ? `${evidence.skipped} skipped meal${evidence.skipped === 1 ? "" : "s"} logged — context?` : "Context from the logs or the call"} />}
        </Field>

        <fieldset disabled={!canReview}>
          <legend className="mb-2 text-sm text-ink">Barriers encountered</legend>
          <div className="flex flex-wrap gap-1.5">
            {BARRIERS.map((b) => {
              const on = barriers.includes(b);
              return (
                <button
                  key={b}
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggle(barriers, setBarriers, b)}
                  className={cn(
                    "inline-flex h-8 items-center rounded-full px-3 text-xs transition-colors duration-200 disabled:opacity-50",
                    on ? "bg-charcoal text-white" : "text-ink-2 shadow-[inset_0_0_0_1px_var(--color-line)] hover:bg-canvas",
                  )}
                >
                  {b}
                </button>
              );
            })}
          </div>
          <Input aria-label="Other barrier" className="mt-2" value={otherBarrier} onChange={(e) => setOtherBarrier(e.target.value)} placeholder="Other barrier (optional)" />
        </fieldset>

        <Field label="Agreed changes" error={tried ? errors.changes : null}>
          {(a) => <Textarea {...a} value={changes} onChange={(e) => setChanges(e.target.value)} rows={3} disabled={!canReview} placeholder="e.g. Soak chilla batter the night before office days; keep roasted chana at the desk." />}
        </Field>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <span className="text-sm text-ink" id="agreed-via">Agreed via</span>
            <Segmented ariaLabel="Agreed via" size="sm" variant="tray" className="self-start" value={channel} onChange={setChannel} items={(Object.keys(CHANNEL_SHORT) as Channel[]).map((c) => ({ value: c, label: CHANNEL_SHORT[c] }))} />
          </div>
          <Field label="Next review" error={tried ? errors.next : null}>
            {(a) => <Input {...a} type="date" min="2026-11-14" value={next} onChange={(e) => setNext(e.target.value)} disabled={!canReview} className="tabular" />}
          </Field>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
          <p className="text-xs text-muted">{canReview ? "Saved in this browser session" : "Only the patient's nutritionist records adherence reviews"}</p>
          <Button variant="primary" onClick={save} disabled={!canReview}>Save review</Button>
        </div>
      </div>
    </Card>
  );
}

function PastReviews({ patientId, reviews }: { patientId: string; reviews: AdherenceReview[] }) {
  const own = reviews.filter((r) => r.patientId === patientId);
  const first = patientById(patientId)?.name.split(" ")[0] ?? "this patient";
  return (
    <Group>
      <GroupHeader icon={<ClipboardText />} title="Previous reviews" subtitle={own.length ? `${own.length} for ${first}` : `None yet for ${first}`} />
      {own.length ? (
        <ul className="flex flex-col gap-2">
          {own.map((r) => {
            const by = staffById(r.by);
            return (
              <li key={r.id}>
                <Inset>
                  <div className="flex items-center gap-2">
                    <Avatar src={by?.avatar} name={by?.name ?? "Staff"} size="xs" />
                    <span className="text-xs text-ink-2">{by?.name}</span>
                    <span className="ml-auto text-xs text-muted">{formatDate(r.at, { day: "numeric", month: "short" })}</span>
                  </div>
                  {r.followed.length ? (
                    <div className="mt-3">
                      <p className="text-xs text-muted">Followed</p>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {r.followed.map((f) => <Pill key={f} size="sm" tone="neutral">{f}</Pill>)}
                      </div>
                    </div>
                  ) : null}
                  {r.barriers.length ? (
                    <div className="mt-3">
                      <p className="text-xs text-muted">Barriers</p>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {r.barriers.map((b) => <Pill key={b} size="sm" tone="outline">{b}</Pill>)}
                      </div>
                    </div>
                  ) : null}
                  {r.notes ? <p className="mt-3 text-sm text-ink-2">{r.notes}</p> : null}
                  <p className="mt-3 text-xs text-muted">Agreed changes</p>
                  <p className="mt-0.5 text-sm text-ink">{r.changes}</p>
                  <p className="mt-3 text-xs text-muted">
                    Next review {formatDate(`${r.nextReview}T00:00:00+05:30`, { day: "numeric", month: "short" })} · source: {r.source}
                  </p>
                </Inset>
              </li>
            );
          })}
        </ul>
      ) : (
        <Inset>
          <p className="text-sm text-muted">The first review you save appears here.</p>
        </Inset>
      )}
    </Group>
  );
}

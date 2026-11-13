"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowUpRight, ChatCircleText, Check, CheckCircle, Flag, ForkKnife, ListPlus, Quotes, ArrowCounterClockwise, Moon } from "@phosphor-icons/react";
import { NUTRITION_PLANS } from "@/data/programs";
import { PATIENTS, patientById } from "@/data/patients";
import { staffById } from "@/data/staff";
import { TODAY, formatDate, formatTime } from "@/lib/format";
import { cn } from "@/lib/cn";
import { spring } from "@/lib/motion";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Group, GroupHeader, Inset } from "@/components/ui/card";
import { Dropdown, DropdownContent, DropdownItem, DropdownLabel, DropdownTrigger } from "@/components/ui/dropdown";
import { Select, Textarea } from "@/components/ui/input";
import { EmptyState, PageHeader } from "@/components/ui/misc";
import { Segmented } from "@/components/ui/segmented";
import { StatusBadge, type Tone } from "@/components/ui/status";
import { useToast } from "@/components/ui/toast";
import { useRole } from "@/components/shell/role-context";
import { FLAG_REASONS, LOG_MATCH_LABEL, SLOT_LABEL, type FoodLog, type LogMatch } from "./data";
import { followedVersion, newId, nowIso, stamp } from "./model";
import { logActions, taskActions, useNutrition } from "./store";
import { Plate } from "./plate";
import { SelfReported } from "./ui";
import { AdherenceForm } from "./adherence-form";
import { LogTrend } from "./log-trend";

/** /nutrition/logs — self-reported food logs with reviewer actions and the adherence review (doc §2C). */

type StatusFilter = "new" | "flagged" | "reviewed" | "all";
const MATCH_TONE: Record<LogMatch, Tone> = { "as-planned": "success", partly: "warning", different: "neutral", skipped: "danger" };

export function FoodLogs() {
  const { role, user, has } = useRole();
  const { toast } = useToast();
  const state = useNutrition();
  const canReview = role === "nutritionist";

  const myPatients = useMemo(() => new Set(PATIENTS.filter((p) => p.careTeam.nutritionist === user.id).map((p) => p.id)), [user.id]);
  const [scope, setScope] = useState<string>(canReview && myPatients.size ? "mine" : "all");
  const [status, setStatus] = useState<StatusFilter>("new");
  const [formPatient, setFormPatient] = useState<string>("p-aditi");

  const allLogs = useMemo(() => Object.values(state.logs).sort((a, b) => b.eatenAt.localeCompare(a.eatenAt)), [state.logs]);
  const inScope = useMemo(
    () => allLogs.filter((l) => (scope === "all" ? true : scope === "mine" ? myPatients.has(l.patientId) : l.patientId === scope)),
    [allLogs, scope, myPatients],
  );
  const counts = useMemo(() => {
    const c = { new: 0, flagged: 0, reviewed: 0, all: inScope.length };
    for (const l of inScope) c[l.status] += 1;
    return c;
  }, [inScope]);
  const shown = status === "all" ? inScope : inScope.filter((l) => l.status === status);

  const days = useMemo(() => {
    const groups = new Map<string, FoodLog[]>();
    for (const l of shown) {
      const key = l.eatenAt.slice(0, 10);
      groups.set(key, [...(groups.get(key) ?? []), l]);
    }
    return [...groups.entries()];
  }, [shown]);

  // Patients whose logging we follow: anyone on a published plan version, plus anyone who has logged.
  const tracked = useMemo(() => {
    const ids = new Set<string>();
    for (const p of Object.values(state.plans)) if (followedVersion(p) !== null) ids.add(p.patientId);
    for (const l of allLogs) ids.add(l.patientId);
    return [...ids];
  }, [state.plans, allLogs]);
  /** the caseload the trend shows while one patient is picked */
  const baseScope = scope === "all" || !myPatients.size || !(scope === "mine" || myPatients.has(scope)) ? "all" : "mine";
  const trendIds = tracked.filter((id) => baseScope === "all" || myPatients.has(id));
  const scopeOptions = [
    ...(myPatients.size ? [{ value: "mine", label: canReview ? "My patients" : "Meera's caseload" }] : []),
    { value: "all", label: "All patients" },
    ...tracked.map((id) => ({ value: id, label: patientById(id)?.name ?? id })),
  ];
  const formOptions = Array.from(new Set(NUTRITION_PLANS.map((p) => p.patientId))).map((id) => ({ value: id, label: patientById(id)?.name ?? id }));

  // Published plans with no self-reported entry in 14 days → follow up (doc §2C: follow-up scheduling).
  const quiet = useMemo(() => {
    const cutoff = new Date(TODAY.getTime() - 14 * 86_400_000).toISOString();
    return NUTRITION_PLANS.filter((p) => p.status === "published" && (scope === "all" || scope !== "mine" || myPatients.has(p.patientId)))
      .filter((p) => !allLogs.some((l) => l.patientId === p.patientId && l.eatenAt >= cutoff));
  }, [allLogs, scope, myPatients]);

  return (
    <div className="@container flex flex-col gap-8">
      <PageHeader
        title="Food logs"
        description="Text and photo entries from patients. Everything here stays labelled self-reported — reviewing a log records that you saw it, it doesn't verify it."
        actions={
          <Button asChild variant="secondary" trailing={<ArrowUpRight />}>
            <Link href="/nutrition/builder">Plan builder</Link>
          </Button>
        }
      />

      <LogTrend
        patientIds={trendIds}
        logs={allLogs}
        selected={scope !== "all" && scope !== "mine" ? scope : null}
        onPick={(id) => {
          if (scope === id) {
            setScope(baseScope);
            return;
          }
          setScope(id);
          setFormPatient(id);
        }}
      />

      <div className="grid grid-cols-1 gap-6 @[1080px]:grid-cols-[minmax(0,1fr)_minmax(340px,392px)]">
        <section aria-label="Food log entries" className="flex min-w-0 flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="scrollbar-none -mx-1 min-w-0 overflow-x-auto px-1">
              <Segmented
                ariaLabel="Review status"
                size="sm"
                value={status}
                onChange={setStatus}
                items={[
                  { value: "new", label: "Needs review", count: counts.new },
                  { value: "flagged", label: "Flagged", count: counts.flagged },
                  { value: "reviewed", label: "Reviewed", count: counts.reviewed },
                  { value: "all", label: "All", count: counts.all },
                ]}
              />
            </div>
            <Select ariaLabel="Patients" size="sm" value={scope} onValueChange={setScope} options={scopeOptions} className="w-auto min-w-[168px]" />
          </div>

          {days.length === 0 ? (
            <div className="rounded-card bg-surface">
              <EmptyState
                icon={<CheckCircle />}
                title={status === "new" ? "All caught up" : "Nothing here"}
                description={status === "new" ? "Every self-reported entry in this view has been reviewed." : "No entries match this filter."}
                action={status !== "all" ? <Button size="sm" variant="secondary" onClick={() => setStatus("all")}>Show all entries</Button> : null}
              />
            </div>
          ) : (
            days.map(([day, logs]) => (
              <div key={day} className="flex flex-col gap-3">
                <h2 className="px-2 text-sm text-muted">
                  {day === "2026-11-13" ? "Today · " : day === "2026-11-12" ? "Yesterday · " : ""}
                  {formatDate(`${day}T12:00:00+05:30`, { weekday: "long", day: "numeric", month: "short" })}
                </h2>
                <ul className="flex flex-col gap-3">
                  <AnimatePresence initial={false}>
                    {logs.map((log) => (
                      <motion.li key={log.id} layout="position" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.98, transition: { duration: 0.14 } }} transition={spring}>
                        <LogCard
                          log={log}
                          canReview={canReview}
                          onReviewAdherence={() => {
                            setFormPatient(log.patientId);
                            const el = document.getElementById("adherence-review");
                            const r = el?.getBoundingClientRect();
                            if (el && r && (r.top > window.innerHeight || r.bottom < 0)) el.scrollIntoView({ behavior: "smooth", block: "start" });
                          }}
                          onReviewed={() => {
                            logActions.markReviewed(log.id, user.id, nowIso());
                            toast({
                              title: "Marked reviewed",
                              description: "Still self-reported — reviewing records that you saw it. Saved in this browser session.",
                              tone: "success",
                              action: { label: "Undo", onClick: () => logActions.reopen(log.id) },
                            });
                          }}
                          onFlag={(reason) => {
                            logActions.flag(log.id, reason, user.id, nowIso());
                            toast({ title: `Flagged: ${reason}`, description: "Visible to the care team in this browser session only.", tone: "warning" });
                          }}
                          onUnflag={() => logActions.unflag(log.id)}
                          onComment={(text) => {
                            logActions.comment(log.id, { id: newId("c"), by: user.id, at: nowIso(), text });
                            toast({ title: "Comment saved", description: "Kept with the log in this session. The patient isn't notified — messaging isn't connected in this demo." });
                          }}
                        />
                      </motion.li>
                    ))}
                  </AnimatePresence>
                </ul>
              </div>
            ))
          )}
        </section>

        <aside aria-label="Adherence" className="flex min-w-0 flex-col gap-4">
          <AdherenceForm patientId={formPatient} patientOptions={formOptions} onPatientChange={setFormPatient} logs={allLogs} reviews={state.reviews} canReview={canReview} />
          <Group>
            <GroupHeader icon={<Moon />} title="Quiet patients" subtitle="Published plan, no entries in 14 days" />
            {quiet.length ? (
              <ul className="flex flex-col gap-2">
                {quiet.map((p) => {
                  const patient = patientById(p.patientId);
                  const owner = staffById(p.authorId);
                  const done = state.tasks.some((t) => t.patientId === p.patientId);
                  return (
                    <li key={p.id}>
                      <Inset className="flex flex-col gap-3">
                        <div className="flex items-center gap-3">
                          <Avatar src={patient?.avatar} name={patient?.name ?? "Patient"} size="md" />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm text-ink">{patient?.name}</p>
                            <p className="truncate text-xs text-muted">{p.adherenceNote}</p>
                          </div>
                        </div>
                        {done ? (
                          <p className="flex items-center gap-1.5 text-xs text-success"><Check size={14} aria-hidden="true" /> Follow-up task created for {owner?.name}</p>
                        ) : (
                          <Button
                            size="sm"
                            variant="secondary"
                            leading={<ListPlus />}
                            className="self-start"
                            disabled={!canReview}
                            onClick={() => {
                              taskActions.add({ id: newId("task"), title: `Check in about food logs — ${patient?.name}`, patientId: p.patientId, ownerId: p.authorId, createdBy: user.id, at: nowIso() });
                              toast({ title: `Task created for ${owner?.name}`, description: has("messages") ? "Recorded in this browser session. No message was sent to the patient." : "Recorded in this browser session only.", tone: "success" });
                            }}
                          >
                            Create follow-up task
                          </Button>
                        )}
                      </Inset>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <Inset>
                <p className="text-sm text-muted">Everyone in this view has logged in the last 14 days.</p>
              </Inset>
            )}
          </Group>
        </aside>
      </div>
    </div>
  );
}

function LogCard({
  log,
  canReview,
  onReviewed,
  onFlag,
  onUnflag,
  onComment,
  onReviewAdherence,
}: {
  log: FoodLog;
  canReview: boolean;
  onReviewed: () => void;
  onFlag: (reason: string) => void;
  onUnflag: () => void;
  onComment: (text: string) => void;
  onReviewAdherence: () => void;
}) {
  const patient = patientById(log.patientId);
  const [composer, setComposer] = useState(false);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const reviewer = log.reviewedBy ? staffById(log.reviewedBy.by) : undefined;

  return (
    <article aria-label={`${patient?.name} · ${SLOT_LABEL[log.slot]}`} className="grid grid-cols-1 gap-2 rounded-card bg-surface p-2 sm:grid-cols-[minmax(0,200px)_minmax(0,1fr)]">
      <div className={cn("relative overflow-hidden rounded-inner bg-canvas sm:aspect-auto sm:min-h-[150px]", log.photo ? "aspect-[4/3]" : "h-16 sm:h-auto")}>
        {log.photo ? (
          <>
            <Plate spec={log.photo} seed={log.id} className="absolute inset-0 h-full" />
            <span className="absolute bottom-2 left-2 rounded-full bg-charcoal/75 px-2 py-0.5 text-[11px] text-white">Illustrative render of photo</span>
          </>
        ) : (
          <div className="flex h-full items-center justify-center gap-3 p-4 text-center sm:flex-col sm:gap-2">
            <span className="flex size-10 items-center justify-center rounded-full bg-surface text-muted">
              <Quotes size={18} aria-hidden="true" />
            </span>
            <span className="text-xs text-muted">Text entry · no photo</span>
          </div>
        )}
      </div>

      <div className="flex min-w-0 flex-col gap-3 p-2">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <Avatar src={patient?.avatar} name={patient?.name ?? "Patient"} size="sm" />
          <div className="min-w-[180px] flex-1">
            <p className="truncate text-sm text-ink">
              <Link href={`/patients/${log.patientId}`} className="hover:underline hover:underline-offset-4">{patient?.name}</Link>
            </p>
            <p className="text-xs text-muted tabular">
              {SLOT_LABEL[log.slot]} · eaten {formatTime(log.eatenAt)} · logged {formatTime(log.loggedAt)}
            </p>
          </div>
          <SelfReported />
          {log.status === "reviewed" ? (
            <StatusBadge tone="success">Reviewed</StatusBadge>
          ) : log.status === "flagged" ? (
            <StatusBadge tone="danger">Flagged</StatusBadge>
          ) : (
            <StatusBadge tone="warning">Needs review</StatusBadge>
          )}
        </div>

        <p className="text-[15px] leading-relaxed text-ink">“{log.text}”</p>

        <div className="flex flex-wrap items-center gap-2 rounded-[12px] bg-canvas px-3 py-2 text-xs text-ink-2">
          <span className="font-mono text-[11px] text-muted">Plan v{log.planVersion}</span>
          <span className="min-w-0 flex-1">{log.planned}</span>
          <StatusBadge tone={MATCH_TONE[log.match]}>{LOG_MATCH_LABEL[log.match]}</StatusBadge>
        </div>

        {log.flag ? (
          <p className="flex flex-wrap items-center gap-2 text-xs text-danger">
            <Flag size={14} aria-hidden="true" />
            {log.flag.reason} · {staffById(log.flag.by)?.name} · {stamp(log.flag.at)}
            {canReview ? (
              <button type="button" onClick={onUnflag} className="rounded-full px-2 py-0.5 text-ink-2 underline underline-offset-4 hover:text-ink">
                Remove flag
              </button>
            ) : null}
          </p>
        ) : null}

        {log.comments.length ? (
          <ul className="flex flex-col gap-2" aria-label="Comments">
            {log.comments.map((c) => {
              const by = staffById(c.by);
              return (
                <li key={c.id} className="flex gap-2">
                  <Avatar src={by?.avatar} name={by?.name ?? "Staff"} size="xs" />
                  <div className="min-w-0">
                    <p className="text-xs text-muted">{by?.name} · {stamp(c.at)}</p>
                    <p className="text-sm text-ink-2">{c.text}</p>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : null}

        <AnimatePresence initial={false}>
          {composer ? (
            <motion.form
              key="composer"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={spring}
              className="overflow-hidden"
              onSubmit={(e) => {
                e.preventDefault();
                if (!text.trim()) {
                  setError("Write a comment first");
                  return;
                }
                onComment(text.trim());
                setText("");
                setError(null);
                setComposer(false);
              }}
            >
              <label htmlFor={`cm-${log.id}`} className="sr-only">Comment on this log</label>
              <Textarea id={`cm-${log.id}`} value={text} onChange={(e) => setText(e.target.value)} rows={2} autoFocus aria-invalid={error ? true : undefined} aria-describedby={error ? `cm-${log.id}-err` : undefined} placeholder="Note for the care team (the patient isn't notified in this demo)" />
              {error ? <p id={`cm-${log.id}-err`} className="mt-1 text-xs text-danger">{error}</p> : null}
              <div className="mt-2 flex justify-end gap-2">
                <Button type="button" size="sm" variant="ghost" onClick={() => { setComposer(false); setError(null); }}>Cancel</Button>
                <Button type="submit" size="sm" variant="dark">Save comment</Button>
              </div>
            </motion.form>
          ) : null}
        </AnimatePresence>

        <div className="mt-auto flex flex-wrap items-center gap-2">
          {log.status === "reviewed" ? (
            <span className="flex items-center gap-1.5 text-xs text-muted">
              <CheckCircle size={16} className="text-success" aria-hidden="true" />
              Reviewed by {reviewer?.name ?? "—"} · {log.reviewedBy ? stamp(log.reviewedBy.at) : ""}
            </span>
          ) : (
            <Button size="sm" variant="dark" leading={<Check />} onClick={onReviewed} disabled={!canReview}>Mark reviewed</Button>
          )}
          <Button size="sm" variant="secondary" leading={<ChatCircleText />} onClick={() => setComposer((v) => !v)} disabled={!canReview} aria-expanded={composer}>
            Comment
          </Button>
          {log.status !== "flagged" ? (
            <Dropdown>
              <DropdownTrigger asChild>
                <Button size="sm" variant="ghost" leading={<Flag />} disabled={!canReview}>Flag</Button>
              </DropdownTrigger>
              <DropdownContent align="start" className="w-[260px]">
                <DropdownLabel>Flag for follow-up</DropdownLabel>
                {FLAG_REASONS.map((r) => (
                  <DropdownItem key={r} onSelect={() => onFlag(r)}>{r}</DropdownItem>
                ))}
              </DropdownContent>
            </Dropdown>
          ) : null}
          <span className="flex-1" />
          <button type="button" onClick={onReviewAdherence} className={cn("inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-xs text-ink-2 transition-colors hover:bg-canvas hover:text-ink")}>
            <ForkKnife size={14} aria-hidden="true" />
            Review adherence
          </button>
          {log.status === "reviewed" && canReview ? (
            <button type="button" onClick={() => logActions.reopen(log.id)} className="inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-xs text-muted transition-colors hover:bg-canvas hover:text-ink">
              <ArrowCounterClockwise size={14} aria-hidden="true" />
              Reopen
            </button>
          ) : null}
        </div>
      </div>
    </article>
  );
}

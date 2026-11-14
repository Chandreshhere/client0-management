"use client";

import Link from "next/link";
import { useId, useState } from "react";
import { ClockCounterClockwise, CopySimple, FileText, IdentificationCard, UserPlus, UserSwitch } from "@phosphor-icons/react";
import { cn } from "@/lib/cn";
import { formatDate, formatTime, pluralize } from "@/lib/format";
import { useRole } from "@/components/shell/role-context";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status";
import { useToast } from "@/components/ui/toast";
import { STAFF, staffById } from "@/data/staff";
import { PATIENTS, clinicNumber } from "@/data/patients";
import { TASKS } from "@/data/care";
import { DOCUMENTS } from "@/data/records";
import type { Patient } from "@/data/types";
import { ACCESS_REVIEWS, NOW_LABEL, daysSince, profileHref, shortDate, whenLabel } from "./data";
import { DashGrid, DashboardHeader, FocalCard, FocalHead, FocalInset, FocalStat, ItemCard, Panel, PanelEmpty, Rail, Reveal } from "./ui";

/**
 * Admin home — "What needs a decision from me?"
 * Possible duplicates, documents not matched to a patient, staff changes and access to review.
 * Routing and identity only: no diagnoses, organs or case-mix (spec rule 3). Appointment volumes
 * and case-mix are Pro analytics; the activity log is one click away.
 */

const duplicates = PATIENTS.filter((p) => p.tags.includes("Possible duplicate"))
  .map((candidate) => ({ candidate, match: PATIENTS.find((p) => p.id !== candidate.id && p.phone === candidate.phone) }))
  .filter((d): d is { candidate: Patient; match: Patient } => !!d.match);
const unmatched = DOCUMENTS.filter((d) => d.patientId === null);
const onLeave = STAFF.filter((s) => s.status === "on-leave");
const reassignTask = (staffName: string) => TASKS.find((t) => /reassign/i.test(t.title) && t.title.includes(staffName) && t.status !== "done");

export function AdminHome() {
  const { has } = useRole();
  const access = ACCESS_REVIEWS.filter((a) => !a.needs || has(a.needs));
  const total = duplicates.length + unmatched.length + onLeave.length + access.length;

  return (
    <div className="flex flex-col gap-6">
      <DashboardHeader
        summary={`${pluralize(duplicates.length, "possible duplicate")} · ${pluralize(unmatched.length, "document")} not matched · ${pluralize(onLeave.length, "staff change")} · ${pluralize(access.length, "access review")}`}
        actions={
          <>
            <Button asChild variant="dark">
              <Link href="/patients?new=1">
                <UserPlus />
                Register patient
              </Link>
            </Button>
            <Button asChild variant="secondary">
              <Link href="/settings/audit">
                <ClockCounterClockwise />
                Activity log
              </Link>
            </Button>
          </>
        }
      />

      <DashGrid>
        <Reveal index={0} className="lg:col-span-2">
          <DuplicatesCard total={total} />
        </Reveal>

        <Rail index={1} className="xl:row-span-2">
          <Panel icon={<FileText />} title="Documents not matched" subtitle={unmatched.length ? `${pluralize(unmatched.length, "upload")} without a patient` : "Every upload is matched"} href="/documents" actionLabel="Open documents">
            {unmatched.length === 0 ? (
              <PanelEmpty icon={<FileText />} title="Nothing to match" />
            ) : (
              unmatched.map((d) => (
                <ItemCard
                  key={d.id}
                  href="/documents"
                  name={d.title.replace(/\s*—\s*patient not matched$/i, "")}
                  lines={[`${d.type} · ${pluralize(d.pages, "page")}`, `Added ${whenLabel(d.uploadedAt).replace(/^Today/, "today")}`]}
                  badge={<StatusBadge tone="warning">Not matched</StatusBadge>}
                  ariaLabel={`${d.title}, ${d.type}, not matched to a patient — open documents`}
                />
              ))
            )}
          </Panel>

          <Panel icon={<UserSwitch />} title="Staff changes" subtitle={onLeave.length ? `${pluralize(onLeave.length, "person", "people")} away` : "No changes"} href="/team" actionLabel="Open team">
            {onLeave.length === 0 ? (
              <PanelEmpty icon={<UserSwitch />} title="No staff changes" />
            ) : (
              onLeave.map((s) => {
                const patients = PATIENTS.filter((p) => p.careTeam.doctor === s.id && p.status !== "completed").length;
                const task = reassignTask(s.name);
                return (
                  <ItemCard
                    key={s.id}
                    href="/team"
                    avatar={{ src: s.avatar, name: s.name }}
                    name={s.name}
                    lines={[s.workingHours, `${pluralize(patients, "patient")} need a cover doctor${task ? ` · reassign by ${shortDate(task.due)}` : ""}`]}
                    badge={<StatusBadge tone={task?.status === "in-progress" ? "info" : "warning"}>{task?.status === "in-progress" ? "Reassigning" : "To reassign"}</StatusBadge>}
                  />
                );
              })
            )}
          </Panel>
        </Rail>

        <Reveal index={2} className="lg:col-span-2">
          <Panel icon={<IdentificationCard />} title="Access to review" subtitle={access.length ? `${pluralize(access.length, "grant")} to confirm` : "Nothing to review"} href="/settings/access" actionLabel="Open access rules" className="h-full">
            {access.length === 0 ? (
              <PanelEmpty icon={<IdentificationCard />} title="No access to review" />
            ) : (
              <div className={cn("grid grid-cols-1 gap-2", access.length > 1 && "md:grid-cols-2")}>
                {access.map((a) => {
                  const s = staffById(a.staffId);
                  const days = -daysSince(a.due);
                  return (
                    <ItemCard
                      key={a.id}
                      href="/settings/access"
                      avatar={{ src: s?.avatar, name: s?.name ?? "" }}
                      name={s?.name}
                      lines={[a.title, a.detail]}
                      badge={<StatusBadge tone={days <= 7 ? "warning" : "neutral"}>{days <= 0 ? "Due today" : `In ${pluralize(days, "day")}`}</StatusBadge>}
                      className="h-full"
                    />
                  );
                })}
              </div>
            )}
          </Panel>
        </Reveal>
      </DashGrid>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------
// Focal: possible duplicates — identity fields side by side, decided by a person, never merged automatically
// ---------------------------------------------------------------------------------------------

type Decision = { kind: "separate" | "merge"; at: string };

function DuplicatesCard({ total }: { total: number }) {
  const id = useId();
  const { toast } = useToast();
  const [decisions, setDecisions] = useState<Record<string, Decision>>({});
  const open = duplicates.filter((d) => !decisions[d.candidate.id]).length;

  const decide = (key: string, kind: Decision["kind"], names: [string, string]) => {
    setDecisions((s) => ({ ...s, [key]: { kind, at: NOW_LABEL } }));
    toast({
      tone: "success",
      title: kind === "separate" ? "Kept as separate patients" : "Merge recorded",
      description: kind === "separate" ? `${names[0]} and ${names[1]} stay separate. Recorded in this browser session.` : `Both originals stay in the activity log. Recorded in this browser session — no records were changed.`,
      action: { label: "Undo", onClick: () => setDecisions((s) => Object.fromEntries(Object.entries(s).filter(([k]) => k !== key))) },
    });
  };

  return (
    <FocalCard labelledBy={id} className="h-full">
      <FocalHead
        id={id}
        label="Possible duplicates"
        title={open ? `${pluralize(open, "registration")} may match an existing patient` : "No duplicates waiting"}
        meta="Found by phone number at registration. Records never merge automatically — you decide."
        aside={<FocalStat value={total - (duplicates.length - open)} caption="decisions waiting" />}
      />
      {duplicates.map(({ candidate, match }) => {
        const rows: { label: string; a: string; b: string; mono?: boolean }[] = [
          { label: "Age · sex", a: `${candidate.age} · ${candidate.sex}`, b: `${match.age} · ${match.sex}` },
          { label: "Phone", a: candidate.phone, b: match.phone, mono: true },
          { label: "Area", a: candidate.area, b: match.area },
          { label: "Clinic ID", a: clinicNumber(candidate.id), b: clinicNumber(match.id), mono: true },
          { label: "Registered", a: `${formatDate(candidate.registeredAt, { day: "numeric", month: "short" })}, ${formatTime(candidate.registeredAt)}`, b: formatDate(match.registeredAt) },
        ];
        const same = rows.filter((r) => r.a === r.b).length;
        const d = decisions[candidate.id];
        return (
          <div key={candidate.id} className="flex flex-col gap-2">
            <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
              {(["a", "b"] as const).map((side) => {
                const p = side === "a" ? candidate : match;
                return (
                  <FocalInset key={side}>
                    <p className="text-xs text-muted">{side === "a" ? "New registration" : "Existing record"}</p>
                    <Link href={profileHref(p.id)} className="mt-2 flex items-center gap-3 underline-offset-4 hover:underline">
                      <Avatar src={p.avatar} name={p.name} size="md" />
                      <span className="truncate text-sm text-ink">{p.name}</span>
                    </Link>
                    <dl className="mt-3 flex flex-col gap-1.5">
                      {rows.map((r) => (
                        <div key={r.label} className="flex items-center justify-between gap-3 text-xs">
                          <dt className="text-muted">{r.label}</dt>
                          <dd className={cn("flex min-w-0 items-center gap-2 text-ink", r.mono && "font-mono")}>
                            <span className="truncate">{side === "a" ? r.a : r.b}</span>
                            {r.a === r.b ? (
                              <StatusBadge tone="warning" dot={false} className="h-5 px-2 font-sans text-[11px]">
                                Same
                              </StatusBadge>
                            ) : null}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  </FocalInset>
                );
              })}
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 p-4 pt-2">
              <p className="text-xs text-white/90">
                {same} of {rows.length} fields match{d ? ` · ${d.kind === "separate" ? "kept separate" : "merge recorded"} at ${d.at}` : " · different names, so possibly a shared family phone"}
              </p>
              {d ? (
                <StatusBadge tone="success">{d.kind === "separate" ? "Kept separate" : "Merged"}</StatusBadge>
              ) : (
                <div className="flex flex-wrap gap-2">
                  <Button variant="secondary" className="shadow-none" onClick={() => decide(candidate.id, "separate", [candidate.name, match.name])}>
                    Keep separate
                  </Button>
                  <Button variant="glass" onClick={() => decide(candidate.id, "merge", [candidate.name, match.name])}>
                    <CopySimple />
                    Same person — merge
                  </Button>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </FocalCard>
  );
}

"use client";

import Link from "next/link";
import { Fragment, useMemo, useState } from "react";
import { ArrowCounterClockwise, ArrowUpRight, CheckCircle, ClockCounterClockwise, Lock, LockSimple, ProhibitInset, ShieldCheck, Warning } from "@phosphor-icons/react";
import type { Role } from "@/data/types";
import { DEMO_USER, STAFF, staffById } from "@/data/staff";
import { PATIENTS } from "@/data/patients";
import { cn } from "@/lib/cn";
import { formatDate, pluralize } from "@/lib/format";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/misc";
import { Segmented } from "@/components/ui/segmented";
import { StatusBadge } from "@/components/ui/status";
import { Tip } from "@/components/ui/tooltip";
import { useToast } from "@/components/ui/toast";
import { useRole } from "@/components/shell/role-context";
import { ROLE_LABEL, ReadOnlyBanner, TableCard } from "./ui";
import { ACCESS_REVIEWS, LEVEL_LABEL, MATRIX_ROLES, PERMISSIONS, PERMISSION_GROUPS, type Grant, type Level } from "./permissions";
import { daysAgo } from "./time";
import { useAuditEvents } from "./audit";
import { decideReview, undoReview, useSettingsState } from "./store";

/**
 * Settings → Access (doc §2A, §7): the role × permission matrix (read-only, deny by default),
 * and the access review — who can see which patients, with flagged items to confirm or revoke.
 * Decisions are recorded locally and in the audit log; no real permission changes.
 */

function Glyph({ level, locked }: { level: Level; locked?: boolean }) {
  if (locked) return <LockSimple size={14} className="shrink-0 text-ink-2" aria-hidden="true" />;
  const common = "inline-block size-3 shrink-0 rounded-full";
  if (level === "full") return <span className={cn(common, "bg-charcoal")} aria-hidden="true" />;
  if (level === "scoped") return <span className={cn(common, "bg-[linear-gradient(90deg,var(--color-charcoal)_50%,transparent_50%)] shadow-[inset_0_0_0_1.5px_var(--color-charcoal)]")} aria-hidden="true" />;
  if (level === "meta") return <span className={cn(common, "shadow-[inset_0_0_0_1.5px_var(--color-ink-2)]")} aria-hidden="true" />;
  return <span className="inline-block h-0.5 w-3 shrink-0 rounded-full bg-line-strong" aria-hidden="true" />;
}

function Cell({ grant }: { grant: Grant }) {
  const text = grant.locked ? grant.scope ?? "Can't self-grant" : grant.scope ?? LEVEL_LABEL[grant.level];
  const body = (
    <span className={cn("inline-flex max-w-full items-start gap-2 text-left", grant.level === "none" && !grant.locked ? "text-faint" : "text-ink-2")}>
      <span className="mt-[3px]">
        <Glyph level={grant.level} locked={grant.locked} />
      </span>
      <span className="min-w-0 text-xs leading-snug">{grant.level === "none" && !grant.locked ? "No access" : text}</span>
    </span>
  );
  const why = grant.why ?? (grant.level === "none" ? "Refused — not granted to this role (deny by default)." : `${LEVEL_LABEL[grant.level]}${grant.scope ? ` · ${grant.scope}` : ""}`);
  return (
    <Tip label={<span className="block max-w-[260px]">{why}</span>}>
      <span tabIndex={0} className="block rounded-[8px] outline-none focus-visible:outline-2 focus-visible:outline-primary" aria-label={`${LEVEL_LABEL[grant.level]}${grant.scope ? `, ${grant.scope}` : ""}. ${why}`}>
        {body}
      </span>
    </Tip>
  );
}

const ROLE_COUNT = (r: Role) => (r === "patient" ? PATIENTS.length : STAFF.filter((s) => s.role === r).length);

export function AccessView() {
  const { role, user } = useRole();
  const { toast } = useToast();
  const audit = useAuditEvents();
  const state = useSettingsState();
  const [filter, setFilter] = useState<"review" | "all">("review");
  const isAdmin = role === "admin";

  const cells = PERMISSIONS.length * MATRIX_ROLES.length;
  const refused = PERMISSIONS.reduce((s, p) => s + MATRIX_ROLES.filter((r) => p.grants[r].level === "none").length, 0);
  const clinicalRows = PERMISSIONS.filter((p) => p.clinical);
  const adminContent = clinicalRows.filter((p) => p.grants.admin.level === "full" || p.grants.admin.level === "scoped").length;
  const adminRouting = clinicalRows.filter((p) => p.grants.admin.level === "meta").length;
  const accessEvents = audit.filter((e) => e.category === "access" && daysAgo(e.at) <= 30);

  const reviews = useMemo(
    () =>
      ACCESS_REVIEWS.map((r) => ({ r, s: staffById(r.staffId)!, decision: state.reviews[r.id] ?? null }))
        .filter((x) => !!x.s)
        .sort((a, b) => Number(!!b.r.flag && !b.decision) - Number(!!a.r.flag && !a.decision) || b.r.patientCount - a.r.patientCount),
    [state.reviews],
  );
  const open = reviews.filter((x) => x.r.flag && !x.decision);
  const shown = filter === "review" ? reviews.filter((x) => x.r.flag) : reviews;
  const maxPatients = PATIENTS.length;

  return (
    <div className="flex flex-col gap-6 lg:gap-8">
      <PageHeader
        eyebrow="Settings"
        title="Access"
        description="What each role can open, and a review of who can see which patients. This mirrors the product's rules; real enforcement happens on the server for every request."
      />
      {!isAdmin ? <ReadOnlyBanner>You can see what every role can open. Access reviews and changes are made by administrators, with clinical access approved by the clinical lead.</ReadOnlyBanner> : null}

      <ul className="grid grid-cols-1 gap-4 md:grid-cols-3" aria-label="Access principles">
        <li className="flex flex-col gap-4 rounded-card bg-surface p-6">
          <span className="flex size-10 items-center justify-center rounded-full bg-sunken text-ink-2" aria-hidden="true">
            <ProhibitInset size={18} />
          </span>
          <div>
            <h2 className="text-sm text-ink">Deny by default</h2>
            <p className="mt-1 text-sm text-muted">A role sees only what the matrix grants. Anything not listed is refused.</p>
          </div>
          <p className="mt-auto text-xs text-muted">
            <span className="text-[22px] font-light text-ink tabular">{refused}</span> of {cells} role × permission cells are refused
          </p>
        </li>
        <li className="flex flex-col gap-4 rounded-card bg-surface p-6">
          <span className="flex size-10 items-center justify-center rounded-full bg-sunken text-ink-2" aria-hidden="true">
            <Lock size={18} />
          </span>
          <div>
            <h2 className="text-sm text-ink">Admins can&apos;t grant themselves clinical access</h2>
            <p className="mt-1 text-sm text-muted">Administration never includes clinical content. The clinical lead approves clinical access — never for themselves.</p>
          </div>
          <p className="mt-auto text-xs text-muted">
            <span className="text-[22px] font-light text-ink tabular">{adminContent}</span> of {clinicalRows.length} clinical sections open to administrators · {adminRouting} routing-only
          </p>
        </li>
        <li className="flex flex-col gap-4 rounded-card bg-surface p-6">
          <span className="flex size-10 items-center justify-center rounded-full bg-sunken text-ink-2" aria-hidden="true">
            <ClockCounterClockwise size={18} />
          </span>
          <div>
            <h2 className="text-sm text-ink">Every change is logged</h2>
            <p className="mt-1 text-sm text-muted">Grants, cover, record opens and exports go to the audit log. Entries can&apos;t be edited or deleted.</p>
          </div>
          <p className="mt-auto flex items-baseline justify-between gap-2 text-xs text-muted">
            <span>
              <span className="text-[22px] font-light text-ink tabular">{accessEvents.length}</span> access events in the last 30 days
            </span>
            {isAdmin ? (
              <Link href="/settings/audit" className="inline-flex items-center gap-1 text-ink underline-offset-2 hover:underline">
                Audit log <ArrowUpRight size={12} aria-hidden="true" />
              </Link>
            ) : null}
          </p>
        </li>
      </ul>

      <section aria-labelledby="matrix-title" className="flex flex-col gap-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 id="matrix-title" className="text-lg font-normal tracking-[-0.01em] text-ink">
              Role permissions
            </h2>
            <p className="mt-1 text-sm text-muted">Read-only. Hover or focus a cell for the reason. Your role&apos;s column is shaded.</p>
          </div>
          <ul className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted" aria-label="Legend">
            {(["full", "scoped", "meta", "none"] as Level[]).map((l) => (
              <li key={l} className="flex items-center gap-2">
                <Glyph level={l} />
                {LEVEL_LABEL[l]}
              </li>
            ))}
            <li className="flex items-center gap-2">
              <Glyph level="none" locked />
              Locked — can&apos;t be self-granted
            </li>
          </ul>
        </div>
        <TableCard minWidth={1120}>
          <table className="w-full table-fixed text-sm">
            <caption className="sr-only">Permissions by role</caption>
            <colgroup>
              <col className="w-[220px]" />
              {MATRIX_ROLES.map((r) => (
                <col key={r} />
              ))}
            </colgroup>
            <thead>
              <tr className="text-left align-bottom">
                <th scope="col" className="sticky left-0 z-[1] bg-surface py-4 pl-6 pr-3 text-xs font-normal text-muted">
                  Permission
                </th>
                {MATRIX_ROLES.map((r) => (
                  <th key={r} scope="col" className={cn("px-3 py-4 font-normal", r === role && "bg-sunken/70")}>
                    <span className="block text-sm text-ink">{ROLE_LABEL(r)}</span>
                    <span className="block text-xs text-muted">
                      {r === "patient" ? pluralize(ROLE_COUNT(r), "patient") : pluralize(ROLE_COUNT(r), "person", "people")}
                      {r === role ? " · you" : ""}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {PERMISSION_GROUPS.map((g) => (
                <Fragment key={g}>
                  <tr className="border-t border-line bg-canvas/60">
                    <th scope="colgroup" colSpan={MATRIX_ROLES.length + 1} className="sticky left-0 py-2 pl-6 text-left text-xs font-normal text-muted">
                      {g}
                      {g === "Patient record" ? " · clinical content marked" : ""}
                    </th>
                  </tr>
                  {PERMISSIONS.filter((p) => p.group === g).map((p) => (
                    <tr key={p.id} className="border-t border-line align-top">
                      <th scope="row" className="sticky left-0 z-[1] bg-surface py-3 pl-6 pr-3 text-left font-normal">
                        <span className="flex items-center gap-2 text-sm text-ink">
                          {p.label}
                          {p.clinical ? <span className="rounded-full bg-sunken px-1.5 text-[11px] text-ink-2">clinical</span> : null}
                        </span>
                        <span className="mt-0.5 block text-xs text-muted">{p.description}</span>
                      </th>
                      {MATRIX_ROLES.map((r) => (
                        <td key={r} className={cn("px-3 py-3", r === role && "bg-sunken/70")}>
                          <Cell grant={p.grants[r]} />
                        </td>
                      ))}
                    </tr>
                  ))}
                </Fragment>
              ))}
            </tbody>
          </table>
        </TableCard>
      </section>

      <section aria-labelledby="review-title" className="flex flex-col gap-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 id="review-title" className="text-lg font-normal tracking-[-0.01em] text-ink">
              Access review
            </h2>
            <p className="mt-1 text-sm text-muted">
              Who can see which patients · last full review {formatDate("2026-10-01", { day: "numeric", month: "short" })} · {open.length ? `${pluralize(open.length, "item")} to decide` : "nothing left to decide"}
            </p>
          </div>
          <Segmented
            ariaLabel="Show"
            size="sm"
            variant="tray"
            value={filter}
            onChange={setFilter}
            items={[
              { value: "review", label: "Flagged", count: reviews.filter((x) => x.r.flag).length },
              { value: "all", label: "Everyone", count: reviews.length },
            ]}
          />
        </div>

        <ul className="flex flex-col gap-2">
          {shown.map(({ r, s, decision }) => {
            const pct = Math.round((r.patientCount / maxPatients) * 100);
            const flagged = !!r.flag && !decision;
            return (
              <li key={r.id} className="rounded-card bg-surface p-2">
                <div className="grid grid-cols-1 items-center gap-x-6 gap-y-3 p-3 md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)_auto]">
                  <div className="flex min-w-0 items-center gap-3">
                    <Avatar src={s.avatar} name={s.name} size="md" />
                    <div className="min-w-0">
                      <p className="truncate text-sm text-ink">{s.name}</p>
                      <p className="truncate text-xs text-muted">
                        {ROLE_LABEL(s.role)} · {r.patientScope}
                      </p>
                    </div>
                  </div>
                  <div className="min-w-0">
                    <div className="mb-1.5 flex items-baseline justify-between gap-3 text-xs">
                      <span className="text-muted">Patients visible</span>
                      <span className="text-ink tabular">
                        {r.patientCount} of {maxPatients}
                      </span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-sunken" role="meter" aria-label={`${s.name} can see ${r.patientCount} of ${maxPatients} patients`} aria-valuemin={0} aria-valuemax={maxPatients} aria-valuenow={r.patientCount}>
                      <div className={cn("h-full rounded-full", flagged ? "bg-warning" : "bg-charcoal")} style={{ width: `${pct}%` }} />
                    </div>
                    <p className="mt-1.5 truncate text-xs text-muted">{r.sections.join(" · ")}</p>
                  </div>
                  <div className="flex items-center gap-2 md:justify-end">
                    {decision ? (
                      <StatusBadge tone={decision.action === "confirmed" ? "success" : "warning"}>{decision.action === "confirmed" ? "Confirmed today" : "Change recorded"}</StatusBadge>
                    ) : r.flag ? (
                      <StatusBadge tone="warning">Needs a decision</StatusBadge>
                    ) : (
                      <span className="text-xs text-muted">Reviewed {formatDate(r.lastReviewed, { day: "numeric", month: "short" })}</span>
                    )}
                    {isAdmin && !r.flag && !decision ? (
                      <Button
                        size="sm"
                        variant="secondary"
                        leading={<CheckCircle />}
                        onClick={() => {
                          decideReview(r.id, "confirmed", user.id, "Confirmed", s.name);
                          toast({ tone: "success", title: `Access confirmed for ${s.name}`, description: "Recorded in this browser session and the audit log.", action: { label: "Undo", onClick: () => undoReview(r.id, user.id, s.name) } });
                        }}
                      >
                        Confirm
                      </Button>
                    ) : null}
                    {isAdmin && decision ? (
                      <Button size="sm" variant="ghost" leading={<ArrowCounterClockwise />} onClick={() => undoReview(r.id, user.id, s.name)}>
                        Undo
                      </Button>
                    ) : null}
                  </div>
                </div>
                {r.flag && !decision ? (
                  <div className="flex flex-col gap-3 rounded-inner bg-warning-soft/70 p-4 md:flex-row md:items-center">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-surface text-warning" aria-hidden="true">
                      <Warning size={18} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-ink">{r.flag.title}</p>
                      <p className="mt-0.5 text-xs text-ink-2">{r.flag.detail}</p>
                    </div>
                    {isAdmin ? (
                      <div className="flex flex-wrap gap-2">
                        <Button
                          size="sm"
                          variant="dark"
                          onClick={() => {
                            decideReview(r.id, "revoked", user.id, r.flag!.revokeLabel, s.name);
                            toast({ tone: "warning", title: r.flag!.revokeResult, description: "Recorded in this browser session — no real permission changed.", action: { label: "Undo", onClick: () => undoReview(r.id, user.id, s.name) } });
                          }}
                        >
                          {r.flag.revokeLabel}
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          leading={<ShieldCheck />}
                          onClick={() => {
                            decideReview(r.id, "confirmed", user.id, "Kept as is", s.name);
                            toast({ title: `Kept ${s.name}'s access as it is`, description: "Recorded in this browser session and the audit log.", action: { label: "Undo", onClick: () => undoReview(r.id, user.id, s.name) } });
                          }}
                        >
                          Keep as is
                        </Button>
                      </div>
                    ) : null}
                  </div>
                ) : decision && r.flag ? (
                  <p className="rounded-inner bg-sunken px-4 py-3 text-xs text-ink-2">
                    {decision.action === "revoked" ? r.flag.revokeResult : "Kept as it is"} · by {staffById(decision.by)?.name ?? DEMO_USER.admin.label} in this session
                  </p>
                ) : null}
              </li>
            );
          })}
        </ul>
        <p className="text-xs text-muted">Patient counts come from care teams and branch registrations in the shared registry. Decisions are saved in this browser session and written to the audit log.</p>
      </section>
    </div>
  );
}

"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowUpRight, LockSimple, ProhibitInset, UserCircleCheck } from "@phosphor-icons/react";
import { BRANCHES, staffById } from "@/data/staff";
import { patientById } from "@/data/patients";
import { APPOINTMENT_STATUS_LABEL } from "@/data/appointments";
import { cn } from "@/lib/cn";
import { formatTime, pluralize } from "@/lib/format";
import { AvatarStack } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, SheetContent } from "@/components/ui/dialog";
import { Select } from "@/components/ui/input";
import { StatusBadge, appointmentTone } from "@/components/ui/status";
import { useToast } from "@/components/ui/toast";
import { usePlan, useRole } from "@/components/shell/role-context";
import { OrganImage } from "@/components/viz/organ";
import { DisciplineTag, InfoNote, ROLE_LABEL } from "@/features/settings/ui";
import { DayTrack, DayTrackScale } from "@/features/settings/viz";
import { LEVEL_LABEL, permissionsFor } from "@/features/settings/permissions";
import { NOW_MIN, hhmm } from "@/features/settings/time";
import { LEAVE, breaksToday, careTeamOf, caseloadByOrgan, durationText, hoursToday, isClinician, nowState, spanText, todayBlocks, todayLoad, usualWeek, type StaffRole } from "./data";
import { CLINICAL_ROLES, setDeactivated, setRole, useTeamState } from "./store";

const ROLE_OPTIONS: StaffRole[] = ["doctor", "nutritionist", "yoga", "frontdesk", "coordinator", "admin"];

export function StaffSheet({ staffId, onClose, canManage }: { staffId: string | null; onClose: () => void; canManage: boolean }) {
  const s = staffById(staffId ?? undefined);
  return (
    <Dialog open={!!s} onOpenChange={(o) => (!o ? onClose() : undefined)}>
      {s ? <SheetBody key={s.id} staffId={s.id} canManage={canManage} /> : null}
    </Dialog>
  );
}

function SheetBody({ staffId, canManage }: { staffId: string; canManage: boolean }) {
  const s = staffById(staffId)!;
  const { toast } = useToast();
  const { user } = useRole();
  const { plan, has } = usePlan();
  const state = useTeamState();
  const deactivated = !!state.deactivated[s.id];
  const request = state.roles[s.id] ?? null;
  const now = nowState(s, deactivated);
  const self = s.id === user.id;
  const [role, setRoleDraft] = useState<StaffRole>(request?.role ?? s.role);
  const [confirmOff, setConfirmOff] = useState(false);
  useEffect(() => setRoleDraft(request?.role ?? s.role), [request, s.role]);

  const h = hoursToday(s);
  const load = todayLoad(s.id);
  const team = careTeamOf(s.id);
  const organs = caseloadByOrgan(team);
  const grants = permissionsFor(s.role);
  const leave = LEAVE[s.id];
  const allowedRoles = ROLE_OPTIONS.filter((r) => plan === "clinic" || r === "doctor" || r === "nutritionist" || r === "yoga" || r === "frontdesk");

  function applyRole() {
    if (role === (request?.role ?? s.role)) return;
    const revert = request?.role ?? null;
    const label = ROLE_LABEL(role);
    if (role === s.role) setRole(s.id, null, user.id);
    else setRole(s.id, role, user.id, label);
    const pending = role !== s.role && CLINICAL_ROLES.includes(role);
    toast({
      tone: pending ? "warning" : "success",
      title: pending ? "Sent for clinical approval" : role === s.role ? "Role change withdrawn" : `Role changed to ${label}`,
      description: pending
        ? `A clinical role grants clinical access, so Dr. Ananya Rao (clinical lead) must approve it. Nothing changes until then — recorded in this browser session only.`
        : "Saved in this browser session only. No sign-in or permission actually changed.",
      action: { label: "Undo", onClick: () => setRole(s.id, revert, user.id) },
    });
  }

  return (
    <SheetContent
      title={s.name}
      description={`${s.title} · ${BRANCHES.find((b) => b.id === s.branch)?.name}${s.room ? ` · ${s.room}` : ""}`}
      headerExtra={<StatusBadge tone={now.tone} className="mt-1 hidden sm:inline-flex">{now.label}</StatusBadge>}
      footer={
        <DialogClose asChild>
          <Button variant="secondary">Close</Button>
        </DialogClose>
      }
    >
      <div className="flex flex-col gap-6">
        <StatusBadge tone={now.tone} className="w-max sm:hidden">
          {now.label}
        </StatusBadge>

        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 rounded-inner bg-sunken p-4 text-sm">
          <div>
            <dt className="text-xs text-muted">Workspace</dt>
            <dd className="mt-0.5"><DisciplineTag discipline={s.discipline} label={ROLE_LABEL(s.role)} className="text-sm" /></dd>
          </div>
          <div>
            <dt className="text-xs text-muted">Usual hours</dt>
            <dd className="mt-0.5 text-ink tabular">{leave?.usualHours.replace(" – ", "–") ?? s.workingHours.replace(" – ", "–")}</dd>
          </div>
          <div className="col-span-2">
            <dt className="text-xs text-muted">Email</dt>
            <dd className="mt-0.5 truncate text-ink">{s.email}</dd>
          </div>
        </dl>

        {/* Today */}
        <section aria-labelledby="sh-today">
          <div className="flex items-baseline justify-between gap-3">
            <h3 id="sh-today" className="text-xs text-muted">Today</h3>
            <span className="text-xs text-muted">{h ? `${spanText(h)}${isClinician(s) ? ` · ${pluralize(load.count, "appointment")} · ${durationText(load.minutes)} booked` : ""}` : s.workingHours}</span>
          </div>
          {h ? (
            <div className="mt-3 flex flex-col gap-1.5">
              <DayTrack window={h} blocks={todayBlocks(s.id)} breaks={breaksToday(s)} now={NOW_MIN} label={`${s.name} today: ${spanText(h)}`} height="h-4" />
              <DayTrackScale />
              <p className="text-[11px] text-muted">White = working hours · charcoal = booked · hatched = break · line = now ({hhmm(NOW_MIN)})</p>
            </div>
          ) : null}
          {load.all.length ? (
            <ul className="mt-3 flex flex-col divide-y divide-line rounded-inner bg-surface shadow-[inset_0_0_0_1px_var(--color-line)]">
              {load.all.map((a) => (
                <li key={a.id} className="flex items-center gap-3 px-3 py-2.5">
                  <span className="w-12 shrink-0 font-mono text-xs text-ink-2">{formatTime(a.start)}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm text-ink">{a.service}</span>
                    <span className="block truncate text-xs text-muted">{patientById(a.patientId)?.name} · {a.room} · {a.durationMin} min</span>
                  </span>
                  <StatusBadge tone={appointmentTone(a.status)}>{APPOINTMENT_STATUS_LABEL[a.status]}</StatusBadge>
                </li>
              ))}
            </ul>
          ) : isClinician(s) && h ? (
            <p className="mt-3 rounded-inner bg-sunken p-3 text-sm text-muted">Nothing in the diary today.</p>
          ) : null}
        </section>

        {/* Usual week */}
        <section aria-labelledby="sh-week">
          <h3 id="sh-week" className="text-xs text-muted">Usual week</h3>
          <ul className="mt-3 flex flex-col gap-2">
            {usualWeek(s).map((d) => (
              <li key={d.day} className="grid grid-cols-[36px_minmax(0,1fr)_88px] items-center gap-3 text-xs">
                <span className="text-ink-2">{d.day}</span>
                <DayTrack window={d.hours} label={`${d.day}: ${d.hours ? spanText(d.hours) : "off"}`} height="h-2" />
                <span className="text-right text-muted tabular">{d.hours ? spanText(d.hours) : "Off"}</span>
              </li>
            ))}
          </ul>
          {leave ? <p className="mt-2 text-xs text-muted">Away {leave.from.slice(8)}–{leave.until.slice(8)} Nov ({leave.reason.toLowerCase()}); this is the pattern she returns to.</p> : null}
        </section>

        {/* Care team */}
        {team.length ? (
          <section aria-labelledby="sh-team">
            <div className="flex items-center justify-between gap-3">
              <h3 id="sh-team" className="text-xs text-muted">Care team · {pluralize(team.length, "patient")}</h3>
              <AvatarStack people={team.map((p) => ({ name: p.name, avatar: p.avatar }))} max={5} size="xs" />
            </div>
            <ul className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
              {organs.map((g) => (
                <li key={g.organ} className="flex flex-col items-center gap-1 rounded-[12px] bg-sunken px-1 pb-2 pt-1 text-center" title={`${g.system}: ${g.patients.map((p) => p.name).join(", ")}`}>
                  <OrganImage kind={g.organ} className="size-11" />
                  <span className="text-[11px] leading-tight text-ink-2">{g.label}</span>
                  <span className="text-xs text-ink tabular">{g.patients.length}</span>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-[11px] text-muted">Grouped by each patient&apos;s primary body system from their record.</p>
          </section>
        ) : null}

        {/* Access */}
        <section aria-labelledby="sh-access">
          <div className="flex items-center justify-between gap-3">
            <h3 id="sh-access" className="text-xs text-muted">What this role can open</h3>
            {has("access") ? (
              <Link href="/settings/access" className="inline-flex items-center gap-1 text-xs text-ink underline-offset-2 hover:underline">
                Access matrix <ArrowUpRight size={12} aria-hidden="true" />
              </Link>
            ) : null}
          </div>
          <ul className="mt-3 flex flex-col gap-1.5">
            {grants.map(({ row, grant }) => (
              <li key={row.id} className="flex items-center justify-between gap-3 text-sm">
                <span className="truncate text-ink-2">{row.label}</span>
                <span className="shrink-0 text-xs text-muted">{grant.scope ?? LEVEL_LABEL[grant.level]}</span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[11px] text-muted">Everything else is refused — access is deny-by-default.</p>
        </section>

        {/* Admin actions */}
        {canManage ? (
          <section aria-labelledby="sh-manage" className="flex flex-col gap-3 rounded-inner bg-sunken p-4">
            <h3 id="sh-manage" className="text-xs text-muted">Manage account</h3>
            {self ? (
              <InfoNote icon={<LockSimple />}>This is your account. Another administrator has to change your role or deactivate you — and no administrator can grant themselves clinical access.</InfoNote>
            ) : (
              <>
                <div className="flex flex-wrap items-end gap-2">
                  <div className="min-w-[200px] flex-1">
                    <Select
                      ariaLabel="Workspace role"
                      value={role}
                      onValueChange={(v) => setRoleDraft(v as StaffRole)}
                      disabled={deactivated}
                      options={allowedRoles.map((r) => ({ value: r, label: ROLE_LABEL(r), description: CLINICAL_ROLES.includes(r) && r !== s.role ? "Needs clinical lead approval" : r === s.role ? "Current role" : undefined }))}
                    />
                  </div>
                  <Button variant="dark" onClick={applyRole} disabled={deactivated || role === (request?.role ?? s.role)}>
                    Apply
                  </Button>
                </div>
                {request ? (
                  <p className={cn("text-xs", request.pending ? "text-warning" : "text-muted")}>
                    {request.pending ? `Change to ${ROLE_LABEL(request.role)} is waiting for Dr. Ananya Rao (clinical lead).` : `Changed to ${ROLE_LABEL(request.role)} in this session.`}
                  </p>
                ) : null}
                {confirmOff ? (
                  <div className="flex flex-col gap-2 rounded-[12px] bg-surface p-3">
                    <p className="text-sm text-ink">Deactivate {s.name}?</p>
                    <p className="text-xs text-muted">Sign-in is blocked and their seat frees up. Their records, authored notes and audit history stay.{team.length ? ` Their ${pluralize(team.length, "care-team patient")} need cover first.` : ""}</p>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="danger"
                        leading={<ProhibitInset />}
                        onClick={() => {
                          setDeactivated(s.id, true, user.id);
                          setConfirmOff(false);
                          toast({ tone: "warning", title: `${s.name} deactivated in this session`, description: "No real account changed — this prototype has no identity provider.", action: { label: "Undo", onClick: () => setDeactivated(s.id, false, user.id) } });
                        }}
                      >
                        Deactivate
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setConfirmOff(false)}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : deactivated ? (
                  <Button variant="secondary" className="w-max" leading={<UserCircleCheck />} onClick={() => setDeactivated(s.id, false, user.id)}>
                    Reactivate account
                  </Button>
                ) : (
                  <Button variant="ghost" className="w-max text-danger" leading={<ProhibitInset />} onClick={() => setConfirmOff(true)}>
                    Deactivate account
                  </Button>
                )}
              </>
            )}
          </section>
        ) : null}
      </div>
    </SheetContent>
  );
}

"use client";

import type { ReactNode } from "react";
import { Buildings, Clock, ClipboardText, Package, PencilSimple, UsersThree } from "@phosphor-icons/react";
import { DEMO_USER } from "@/data/staff";
import { Card } from "@/components/ui/card";
import { IconButton } from "@/components/ui/icon-button";
import { StatusBadge } from "@/components/ui/status";
import { formatINR, pluralize } from "@/lib/format";
import { SPECIALITIES, formatDays, planCosts, seatLimit, specialityLabel, type Errors } from "../model";
import { Facts, type StepProps } from "../controls";

function ReviewCard({
  title,
  icon,
  step,
  issues,
  onEdit,
  children,
  className,
}: {
  title: string;
  icon: ReactNode;
  step: number;
  issues: number;
  onEdit: (step: number) => void;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Card className={className}>
      <div className="flex items-center gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-sunken text-ink [&_svg]:size-[18px]" aria-hidden="true">
          {icon}
        </span>
        <h2 className="min-w-0 flex-1 truncate text-lg font-normal tracking-[-0.01em] text-ink">{title}</h2>
        {issues ? <StatusBadge tone="warning">Needs attention</StatusBadge> : null}
        <IconButton label={`Edit ${title.toLowerCase()}`} tooltip="left" variant="soft" onClick={() => onEdit(step)} data-testid={`edit-${step}`}>
          <PencilSimple />
        </IconButton>
      </div>
      <div className="mt-6">{children}</div>
    </Card>
  );
}

export function ReviewStep({ data, goTo, stepErrors }: StepProps & { stepErrors: Errors[] }) {
  const { plan, monthly, setup, firstYear } = planCosts(data);
  const perUser = plan.pricing.kind === "per-user";
  const edit = (step: number) => goTo(step, { fromReview: true });
  const issues = (i: number) => Object.keys(stepErrors[i] ?? {}).length;

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <ReviewCard title="Clinic" icon={<Buildings />} step={0} issues={issues(0)} onEdit={edit}>
        <Facts
          rows={[
            { label: "Name", value: data.clinic.name.trim() || <span className="text-muted">Not set</span> },
            { label: "City", value: data.clinic.city || <span className="text-muted">Not set</span> },
            { label: "Branches", value: data.clinic.branches },
            {
              label: "Specialities",
              value: data.clinic.specialities.length ? (
                <span className="flex flex-wrap gap-x-3 gap-y-1">
                  {SPECIALITIES.filter((s) => data.clinic.specialities.includes(s.id)).map((s) => (
                    <span key={s.id} className="inline-flex items-center gap-1.5">
                      <span className="size-2 rounded-full" style={{ backgroundColor: s.color }} aria-hidden="true" />
                      {s.label}
                    </span>
                  ))}
                </span>
              ) : (
                <span className="text-muted">None picked</span>
              ),
            },
          ]}
        />
      </ReviewCard>

      <ReviewCard title="Plan" icon={<Package />} step={1} issues={issues(1)} onEdit={edit}>
        <Facts
          rows={[
            { label: "Plan", value: `${plan.name} · ${perUser ? pluralize(data.plan.users, "user") : "1 practitioner workspace"}` },
            { label: "Monthly", value: monthly === null ? <span className="text-warning">Adjust users</span> : <span className="tabular">{formatINR(monthly)}</span> },
            { label: "Setup", value: <span className="tabular">{formatINR(setup)} one-time</span> },
          ]}
        />
        <div className="mt-4 flex items-end justify-between gap-4 rounded-inner bg-canvas p-4">
          <span className="text-sm text-ink">
            First-year total
            <span className="block text-xs text-muted">Estimate · nothing is charged</span>
          </span>
          <span className="text-[26px] font-light leading-none tracking-[-0.01em] tabular text-ink">{firstYear === null ? "—" : formatINR(firstYear)}</span>
        </div>
      </ReviewCard>

      <ReviewCard title="Services" icon={<ClipboardText />} step={2} issues={issues(2)} onEdit={edit}>
        {data.services.length ? (
          <ul className="flex flex-col gap-2 text-sm">
            {data.services.map((s) => (
              <li key={s.id} className="flex items-baseline gap-3">
                <span className="size-2 shrink-0 translate-y-[-1px] rounded-full" style={{ backgroundColor: SPECIALITIES.find((x) => x.id === s.speciality)?.color }} aria-hidden="true" />
                <span className="min-w-0 flex-1 truncate text-ink">
                  {s.name.trim() || <span className="text-muted">Unnamed service</span>}
                  <span className="sr-only"> ({specialityLabel(s.speciality)})</span>
                </span>
                <span className="shrink-0 text-xs text-muted tabular">{s.duration} min</span>
                <span className="w-[72px] shrink-0 text-right tabular text-ink">{/^\d+$/.test(s.fee.trim()) ? formatINR(Number(s.fee)) : "—"}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted">No services yet.</p>
        )}
      </ReviewCard>

      <ReviewCard title="Team" icon={<UsersThree />} step={3} issues={issues(3)} onEdit={edit}>
        <ul className="flex flex-col gap-2 text-sm">
          <li className="flex items-baseline justify-between gap-3">
            <span className="min-w-0 truncate text-ink">{data.owner.name.trim() || "You"}</span>
            <span className="shrink-0 text-xs text-muted">Owner · {DEMO_USER[plan.roles[0]].label}</span>
          </li>
          {data.invites.map((inv) => (
            <li key={inv.id} className="flex items-baseline justify-between gap-3">
              <span className="min-w-0 truncate text-ink">{inv.name.trim() || <span className="text-muted">Unnamed teammate</span>}</span>
              <span className="shrink-0 text-xs text-muted">{inv.role ? DEMO_USER[inv.role].label : "No workspace"}</span>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-xs text-muted">
          {perUser ? `${1 + data.invites.length} of ${seatLimit(data)} seats assigned · no invitations are sent` : "Starter is a 1 practitioner workspace"}
        </p>
      </ReviewCard>

      <ReviewCard title="Hours" icon={<Clock />} step={4} issues={issues(4)} onEdit={edit} className="md:col-span-2">
        <ul className="grid gap-4 text-sm sm:grid-cols-2">
          {data.hours.map((b) => (
            <li key={b.id} className="rounded-inner bg-canvas p-4">
              <p className="text-ink">{b.name.trim() || "Unnamed branch"}</p>
              <p className="mt-1 text-ink-2">
                {formatDays(b.days)} · <span className="tabular">{b.open}–{b.close}</span>
              </p>
              <p className="mt-1 text-xs text-muted">{b.lunch ? `Lunch ${b.lunchStart}–${b.lunchEnd}` : "No lunch break"}</p>
            </li>
          ))}
        </ul>
      </ReviewCard>
    </div>
  );
}

"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { DotsThree, Export, LockSimple, MagnifyingGlass, UploadSimple, UserPlus } from "@phosphor-icons/react";
import type { BranchId, Patient, PatientStatus } from "@/data/types";
import { PATIENTS, PATIENT_STATUS_LABEL } from "@/data/patients";
import { STAFF } from "@/data/staff";
import { minPlanFor } from "@/data/plans";
import { pluralize } from "@/lib/format";
import { useRole } from "@/components/shell/role-context";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import { Dropdown, DropdownContent, DropdownItem, DropdownLabel, DropdownTrigger } from "@/components/ui/dropdown";
import { EmptyState, PageHeader } from "@/components/ui/misc";
import { useToast } from "@/components/ui/toast";
import {
  BILLING_ROLES,
  CARE_ROLES,
  EMPTY_FILTERS,
  FLAG_LABEL,
  FLAG_ORDER,
  NONE,
  PAGE_SIZE,
  activeFilterCount,
  branchLabel,
  buildRows,
  inScope,
  matchesQuery,
  passesFilters,
  sortRows,
  type Filters,
  type RegistryPatient,
  type Row,
  type Scope,
  type SortKey,
} from "./data";
import { usePatientsSession, withSessionCareTeam } from "./session-store";
import { ActiveFilters, RegistryToolbar, type Facet, type FacetKey, type RegistryView } from "./registry-toolbar";
import { RegistryTable } from "./registry-table";
import { RegistryCards } from "./registry-cards";
import { RegistryBrowse } from "./browse";
import { Pager } from "./registry-bits";
import { BulkBar } from "./bulk-bar";
import { AssignCareTeamModal, type AssignTarget } from "./assign-care-team";
import { RegisterPatientModal, registrationToast, type Registration } from "./register-patient";
import { LocalPatientSheet } from "./local-patient-sheet";

const EXPORT_TOAST = { title: "Export not available", description: "Exports are permission-checked server-side — not available in this prototype.", tone: "warning" as const };

/** /patients — the shared patient registry (doc §2A, §5). */
export function PatientRegistry({ initialView = "table" }: { initialView?: RegistryView }) {
  const { role } = useRole();
  if (role === "patient") return <StaffOnly />;
  return <Registry initialView={initialView} />;
}

function Registry({ initialView }: { initialView: RegistryView }) {
  const router = useRouter();
  const { role, user, has } = useRole();
  const { toast } = useToast();
  const { session, addPatient, removePatient, setCareTeams } = usePatientsSession();

  const [query, setQuery] = useState("");
  const [scope, setScope] = useState<Scope>("all");
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [sort, setSort] = useState<SortKey>("name");
  const [view, setView] = useState<RegistryView>(initialView);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [registerOpen, setRegisterOpen] = useState(false);
  const [assign, setAssign] = useState<AssignTarget | null>(null);
  const [localId, setLocalId] = useState<string | null>(null);
  const [highlight, setHighlight] = useState<string | null>(null);

  const showBalance = BILLING_ROLES.includes(role);
  const canAssign = has("multi-role");

  const patients = useMemo<RegistryPatient[]>(() => [...PATIENTS, ...session.added].map((p) => withSessionCareTeam(p, session)), [session]);
  const rows = useMemo(() => buildRows(patients, session.visits), [patients, session.visits]);
  const ctx = useMemo(() => ({ role, userId: user.id }), [role, user.id]);
  const scoped = useMemo(() => rows.filter((r) => inScope(r, scope, ctx)), [rows, scope, ctx]);
  const results = useMemo(() => sortRows(scoped.filter((r) => matchesQuery(r.patient, query) && passesFilters(r, filters)), sort), [scoped, query, filters, sort]);

  const pageCount = Math.max(1, Math.ceil(results.length / PAGE_SIZE));
  const current = Math.min(page, pageCount);
  const pageRows = results.slice((current - 1) * PAGE_SIZE, (current - 1) * PAGE_SIZE + PAGE_SIZE);

  // Any change to what's listed resets paging and selection.
  const refine = useCallback(<T,>(set: (v: T) => void) => (v: T) => {
    set(v);
    setPage(1);
    setSelected(new Set());
  }, []);

  // Fade the highlight on a newly registered row.
  useEffect(() => {
    if (!highlight) return;
    const t = window.setTimeout(() => setHighlight(null), 2600);
    return () => window.clearTimeout(t);
  }, [highlight]);

  // ---------- facets (counts within the current saved view)
  const facets = useMemo<Facet[]>(() => {
    const count = (fn: (r: Row) => boolean) => scoped.filter(fn).length;
    const programmes = [...new Set(patients.map((p) => p.program).filter((p): p is string => !!p))].sort();
    const careStaff = STAFF.filter((s) => CARE_ROLES.includes(s.role));
    const roleGroup: Record<string, string> = { doctor: "Doctors", nutritionist: "Nutritionists", yoga: "Yoga instructors", coordinator: "Coordinators" };
    return [
      {
        key: "status",
        label: "Status",
        options: (["active", "onboarding", "needs-attention", "completed"] as PatientStatus[]).map((s) => ({ value: s, label: PATIENT_STATUS_LABEL[s], count: count((r) => r.patient.status === s) })),
      },
      {
        key: "programme",
        label: "Programme",
        options: [
          ...programmes.map((p) => ({ value: p, label: p, count: count((r) => r.patient.program === p) })),
          { value: NONE, label: "No programme", count: count((r) => !r.patient.program), group: " " },
        ],
      },
      {
        key: "team",
        label: "Care team",
        options: [
          ...careStaff.map((s) => ({
            value: s.id,
            label: s.id === user.id ? `${s.name} (you)` : s.name,
            description: s.status === "on-leave" ? s.workingHours : undefined,
            count: count((r) => r.team.includes(s.id)),
            group: roleGroup[s.role],
          })),
          { value: NONE, label: "No care team yet", count: count((r) => r.team.length === 0), group: "Unassigned" },
        ],
      },
      {
        key: "branch",
        label: "Branch",
        locked: has("branches") ? undefined : `Multi-branch is on the ${minPlanFor("branches").name} plan`,
        options: (["indiranagar", "hsr"] as BranchId[]).map((b) => ({ value: b, label: branchLabel(b), count: count((r) => r.patient.branch === b) })),
      },
      {
        key: "flags",
        label: "Flags",
        options: FLAG_ORDER.filter((f) => f !== "balance" || showBalance).map((f) => ({ value: f, label: FLAG_LABEL[f], count: count((r) => r.flags.includes(f)) })),
      },
    ];
  }, [scoped, patients, has, showBalance, user.id]);

  const chips = useMemo(
    () =>
      facets.flatMap((f) =>
        (filters[f.key] as string[]).map((value) => ({
          key: f.key,
          value,
          label: `${f.label}: ${f.options.find((o) => o.value === value)?.label.replace(" (you)", "") ?? value}`,
        })),
      ),
    [facets, filters],
  );

  const scopes = useMemo(() => {
    const n = (s: Scope) => rows.filter((r) => inScope(r, s, ctx)).length;
    return [
      { value: "all" as const, label: "All patients", count: n("all") },
      { value: "mine" as const, label: CARE_ROLES.includes(role) ? "My patients" : "Today's patients", count: n("mine") },
      { value: "attention" as const, label: "Needs attention", count: n("attention") },
      { value: "new" as const, label: "New this week", count: n("new") },
    ];
  }, [rows, ctx, role]);

  // ---------- handlers
  const setFacet = (key: FacetKey, values: string[]) => refine<Filters>(setFilters)({ ...filters, [key]: values } as Filters);
  const clearAll = () => {
    setQuery("");
    setFilters(EMPTY_FILTERS);
    setScope("all");
    setPage(1);
    setSelected(new Set());
  };

  const toggle = (id: string) =>
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const togglePage = (on: boolean) =>
    setSelected((s) => {
      const next = new Set(s);
      for (const r of pageRows) {
        if (on) next.add(r.patient.id);
        else next.delete(r.patient.id);
      }
      return next;
    });

  const open = (p: RegistryPatient) => (p.local ? setLocalId(p.id) : router.push(`/patients/${p.id}`));
  const openAssign = (id: string) => {
    if (!canAssign) {
      toast({ title: "Care teams need the Team plan", description: `Assigning nutrition and yoga staff is part of the ${minPlanFor("multi-role").name} plan.`, tone: "neutral" });
      return;
    }
    setAssign({ mode: "team", id });
  };

  const openRegister = useCallback(() => setRegisterOpen(true), []);

  // Keep the layout in the URL (?view=browse) so a reload or a shared link reopens it.
  const changeView = (v: RegistryView) => {
    setView(v);
    const url = new URL(window.location.href);
    if (v === "table") url.searchParams.delete("view");
    else url.searchParams.set("view", v);
    window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
  };
  const onRegisterOpenChange = (o: boolean) => {
    setRegisterOpen(o);
    // Drop ?new=1 so a reload doesn't reopen the form. Native replaceState syncs with
    // useSearchParams without a server round trip.
    if (!o && new URLSearchParams(window.location.search).get("new") === "1") {
      const url = new URL(window.location.href);
      url.searchParams.delete("new");
      window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
    }
  };

  const onRegistered = (r: Registration) => {
    addPatient(r.patient, r.visit);
    onRegisterOpenChange(false);
    setQuery("");
    setFilters(EMPTY_FILTERS);
    setScope("new");
    setSort("name");
    setPage(1);
    setSelected(new Set());
    setHighlight(r.patient.id);
    toast({ ...registrationToast(r), action: { label: "Open", onClick: () => setLocalId(r.patient.id) } });
  };

  const localPatient = localId ? patients.find((p) => p.id === localId && p.local) ?? null : null;
  const localVisit = localPatient ? session.visits.find((v) => v.patientId === localPatient.id) ?? null : null;

  const total = patients.length;
  const filtered = query.trim() !== "" || activeFilterCount(filters) > 0;
  const caption = `Patients — ${pluralize(results.length, "result")}, page ${current} of ${pageCount}`;

  return (
    <div className="@container flex flex-col gap-6 pb-24">
      <Suspense fallback={null}>
        <NewPatientParam onOpen={openRegister} />
        <ViewParam onView={setView} />
      </Suspense>

      <PageHeader
        title={
          <span className="inline-flex items-start gap-3">
            Patients
            <span className="mt-1 inline-flex h-8 items-center rounded-full px-3 text-sm font-normal tracking-normal text-muted shadow-[inset_0_0_0_1px_var(--color-line-strong)] tabular md:mt-2">
              {total}
            </span>
          </span>
        }
        description="One shared record for medical, nutrition and movement care."
        actions={
          <>
            <Dropdown>
              <DropdownTrigger asChild>
                <IconButton label="More registry actions" variant="white" className="data-[state=open]:bg-canvas">
                  <DotsThree weight="bold" />
                </IconButton>
              </DropdownTrigger>
              <DropdownContent className="w-[300px]">
                <DropdownLabel>Registry</DropdownLabel>
                <DropdownItem disabled icon={<UploadSimple />} description="Validated server-side with duplicate review — not in this prototype">
                  Import patient list
                </DropdownItem>
                <DropdownItem icon={<Export />} onSelect={() => toast(EXPORT_TOAST)} description="Only permitted fields are exported">
                  Export this view
                </DropdownItem>
              </DropdownContent>
            </Dropdown>
            <Button variant="primary" leading={<UserPlus />} onClick={openRegister}>
              Register patient
            </Button>
          </>
        }
      />

      <RegistryToolbar
        scope={scope}
        onScope={refine(setScope)}
        scopes={scopes}
        view={view}
        onView={changeView}
        query={query}
        onQuery={refine(setQuery)}
        facets={facets}
        filters={filters}
        onFilter={setFacet}
        sort={sort}
        onSort={refine(setSort)}
      />

      <ActiveFilters
        chips={chips}
        onRemove={(key, value) => setFacet(key, (filters[key] as string[]).filter((v) => v !== value))}
        onClear={() => {
          setFilters(EMPTY_FILTERS);
          setQuery("");
          setPage(1);
          setSelected(new Set());
        }}
      >
        {filtered ? (
          <p className="mr-1 text-sm text-muted" aria-live="polite">
            <span className="tabular text-ink">{results.length}</span> of {scoped.length} {query.trim() ? <>for “{query.trim()}”</> : null}
          </p>
        ) : null}
      </ActiveFilters>

      {results.length === 0 ? (
        <div className="rounded-card bg-surface">
          <EmptyState
            icon={<MagnifyingGlass />}
            title={filtered ? "No patients match these filters" : "No patients in this view yet"}
            description={
              filtered
                ? "Try a different spelling, the clinic number (e.g. PR-01047), or fewer filters."
                : scope === "mine"
                  ? CARE_ROLES.includes(role)
                    ? "You're not on any care team yet. Care teams are assigned from a patient's record."
                    : "Nobody is booked today."
                  : "Patients registered this week appear here."
            }
            action={
              <div className="flex flex-wrap justify-center gap-2">
                {filtered || scope !== "all" ? (
                  <Button variant="dark" onClick={clearAll}>
                    {filtered ? "Clear filters" : "Show all patients"}
                  </Button>
                ) : null}
                <Button variant="secondary" leading={<UserPlus />} onClick={openRegister}>
                  Register patient
                </Button>
              </div>
            }
          />
        </div>
      ) : view === "browse" ? (
        <RegistryBrowse
          rows={results}
          sort={sort}
          sessionVisits={session.visits}
          highlight={highlight}
          showBalance={showBalance}
          onAssign={openAssign}
          onOpenLocal={setLocalId}
        />
      ) : (
        <>
          {view === "table" ? (
            <div className="hidden overflow-hidden rounded-card bg-surface @[880px]:block">
              <RegistryTable
                rows={pageRows}
                selected={selected}
                onToggle={toggle}
                onTogglePage={togglePage}
                onOpen={open}
                onAssign={openAssign}
                onOpenLocal={setLocalId}
                showBalance={showBalance}
                highlight={highlight}
                caption={caption}
              />
              <Pager page={current} pageCount={pageCount} total={results.length} pageSize={PAGE_SIZE} onPage={setPage} className="px-5 py-3 shadow-[inset_0_1px_0_var(--color-line)]" />
            </div>
          ) : null}
          <div className={view === "table" ? "@[880px]:hidden" : undefined}>
            <RegistryCards rows={pageRows} selected={selected} onToggle={toggle} onOpen={open} onAssign={openAssign} onOpenLocal={setLocalId} showBalance={showBalance} highlight={highlight} />
            <Pager page={current} pageCount={pageCount} total={results.length} pageSize={PAGE_SIZE} onPage={setPage} className="mt-4 px-1" />
          </div>
        </>
      )}

      <BulkBar
        count={view === "browse" ? 0 : selected.size}
        onAssign={() => setAssign({ mode: "coordinator", ids: [...selected] })}
        assignLocked={has("coordinator") ? undefined : `Coordinators are on the ${minPlanFor("coordinator").name} plan`}
        onExport={() => toast(EXPORT_TOAST)}
        onClear={() => setSelected(new Set())}
      />

      <RegisterPatientModal
        open={registerOpen}
        onOpenChange={onRegisterOpenChange}
        pool={patients}
        localPatients={session.added}
        sessionVisits={session.visits}
        onRegistered={onRegistered}
        onOpenLocal={setLocalId}
      />

      <AssignCareTeamModal
        target={assign}
        patients={patients}
        onClose={() => setAssign(null)}
        onSave={(teams: Record<string, Patient["careTeam"]>, summary) => {
          setCareTeams(teams);
          setAssign(null);
          setSelected(new Set());
          toast({ ...summary, tone: "success" });
        }}
      />

      <LocalPatientSheet
        patient={localPatient}
        visit={localVisit}
        pool={patients}
        onOpenChange={(o) => !o && setLocalId(null)}
        onDiscard={(id) => {
          removePatient(id);
          setLocalId(null);
          toast({ title: "Registration discarded", description: "Removed from this browser session.", tone: "neutral" });
        }}
      />
    </div>
  );
}

/** Opens the register modal for /patients?new=1 (shell "+" menu, ⌘K action). */
function NewPatientParam({ onOpen }: { onOpen: () => void }) {
  const params = useSearchParams();
  const wantsNew = params.get("new") === "1";
  useEffect(() => {
    if (wantsNew) onOpen();
  }, [wantsNew, onOpen]);
  return null;
}

/** Follows `?view=` changes while the registry stays mounted (the first value comes from the server). */
function ViewParam({ onView }: { onView: (v: RegistryView) => void }) {
  const params = useSearchParams();
  const wanted = params.get("view");
  useEffect(() => {
    if (wanted === "browse" || wanted === "cards" || wanted === "table") onView(wanted);
  }, [wanted, onView]);
  return null;
}

/** Patients can't browse the registry — say so instead of showing other people's records. */
function StaffOnly() {
  return (
    <div className="mx-auto flex min-h-[56vh] max-w-[560px] flex-col items-center justify-center text-center">
      <span className="flex size-16 items-center justify-center rounded-full bg-charcoal text-white">
        <LockSimple size={26} />
      </span>
      <h1 className="mt-6 text-[36px] font-light leading-[1.05] tracking-[-0.028em] text-ink">Patient registry</h1>
      <p className="mt-3 max-w-[44ch] text-sm text-muted">
        The registry is a staff workspace. In the patient portal you see only your own record — in production the server refuses this page for patient accounts.
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        <Button asChild variant="dark">
          <Link href="/dashboard">Go to my home</Link>
        </Button>
        <Button asChild variant="secondary">
          <Link href="/help">How roles work</Link>
        </Button>
      </div>
    </div>
  );
}

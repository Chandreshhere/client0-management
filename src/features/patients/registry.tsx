"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { DotsThree, Export, LockSimple, MagnifyingGlass, UploadSimple, UserPlus } from "@phosphor-icons/react";
import type { BranchId, Patient, PatientStatus } from "@/data/types";
import { PATIENTS, PATIENT_STATUS_LABEL } from "@/data/patients";
import { STAFF } from "@/data/staff";
import { pluralize } from "@/lib/format";
import { logAudit } from "@/features/settings/audit";
import { useRole } from "@/components/shell/role-context";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import { Dropdown, DropdownContent, DropdownItem, DropdownLabel, DropdownTrigger } from "@/components/ui/dropdown";
import { EmptyState, PageHeader } from "@/components/ui/misc";
import { useToast } from "@/components/ui/toast";
import {
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
  clinicNoOf,
  matchesQuery,
  mineFirst,
  passesFilters,
  registryLens,
  sortRows,
  type Filters,
  type RegistryPatient,
  type Row,
  type Scope,
  type SortKey,
} from "./data";
import { usePatientsSession, withDuplicateDecision, withSessionCareTeam } from "./session-store";
import { MergeModal, type DuplicateChoice } from "./merge-modal";
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

/**
 * /patients — the shared patient registry (F1, F2). Clinical roles see concerns and care teams;
 * Admin and Reception see demographics and routing only. Search by clinic ID, phone or name, with
 * your own patients first.
 */
export function PatientRegistry({ initialView = "table" }: { initialView?: RegistryView }) {
  const { role } = useRole();
  if (role === "patient") return <StaffOnly />;
  return <Registry initialView={initialView} />;
}

function Registry({ initialView }: { initialView: RegistryView }) {
  const router = useRouter();
  const { role, user, has } = useRole();
  const { toast } = useToast();
  const { session, addPatient, removePatient, setCareTeams, decideDuplicates, undoDuplicates } = usePatientsSession();
  const lens = useMemo(() => registryLens(role, has), [role, has]);

  const [query, setQuery] = useState("");
  const [scope, setScope] = useState<Scope>("all");
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [sort, setSort] = useState<SortKey>("name");
  const [view, setViewState] = useState<RegistryView>(initialView);
  // Browse previews the organ-led clinical record — an optional doctor view; others get the table or cards.
  const setView = useCallback((v: RegistryView) => setViewState(v), []);
  const shownView: RegistryView = !lens.browse && view === "browse" ? "table" : view;
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [registerOpen, setRegisterOpen] = useState(false);
  const [assign, setAssign] = useState<AssignTarget | null>(null);
  const [localId, setLocalId] = useState<string | null>(null);
  const [highlight, setHighlight] = useState<string | null>(null);
  const [reviewId, setReviewId] = useState<string | null>(null);

  const showBalance = lens.showBalance;

  // Records an admin merged away stop appearing; ones kept separate lose the duplicate flag.
  const patients = useMemo<RegistryPatient[]>(
    () =>
      [...PATIENTS, ...session.added]
        .filter((p) => session.duplicates?.[p.id]?.outcome !== "merged")
        .map((p) => withDuplicateDecision(withSessionCareTeam(p, session), session)),
    [session],
  );
  const rows = useMemo(() => buildRows(patients, session.visits, { diary: lens.diary, coordinators: lens.coordinators }), [patients, session.visits, lens.diary, lens.coordinators]);
  const ctx = useMemo(() => ({ role, userId: user.id }), [role, user.id]);
  const scoped = useMemo(() => rows.filter((r) => inScope(r, scope, ctx)), [rows, scope, ctx]);
  const results = useMemo(() => {
    const sorted = sortRows(scoped.filter((r) => matchesQuery(r.patient, query, { clinical: lens.concern === "diagnosis" }) && passesFilters(r, filters)), sort);
    // F1: when searching, the patients you're assigned to come first.
    return query.trim() && CARE_ROLES.includes(role) ? mineFirst(sorted, user.id) : sorted;
  }, [scoped, query, filters, sort, lens.concern, role, user.id]);

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
    const careStaff = STAFF.filter((s) => (lens.clinical ? CARE_ROLES : ["doctor"]).includes(s.role) && (s.role !== "coordinator" || lens.coordinators));
    const roleGroup: Record<string, string> = { doctor: "Doctors", nutritionist: "Nutritionists", yoga: "Yoga instructors", coordinator: "Coordinators" };
    const flagOptions = FLAG_ORDER.filter((f) => {
      if (f === "balance") return showBalance;
      if (f === "allergies") return lens.concern === "diagnosis";
      if (f === "duplicate") return !lens.clinical;
      return true;
    }).map((f) => ({ value: f, label: FLAG_LABEL[f], count: count((r) => r.flags.includes(f)) }));
    const out: Facet[] = [];
    if (lens.clinical) {
      out.push({
        key: "status",
        label: "Status",
        options: (["active", "onboarding", "needs-attention", "completed"] as PatientStatus[]).map((s) => ({ value: s, label: s === "completed" && !lens.programmes ? "Care complete" : PATIENT_STATUS_LABEL[s], count: count((r) => r.patient.status === s) })),
      });
    }
    if (lens.clinical && lens.programmes) {
      out.push({
        key: "programme",
        label: "Programme",
        options: [
          ...programmes.map((p) => ({ value: p, label: p, count: count((r) => r.patient.program === p) })),
          { value: NONE, label: "No programme", count: count((r) => !r.patient.program), group: " " },
        ],
      });
    }
    out.push({
      key: "team",
      label: lens.clinical ? "Care team" : "Primary doctor",
      options: [
        ...careStaff.map((s) => ({
          value: s.id,
          label: s.id === user.id ? `${s.name} (you)` : s.name,
          description: s.status === "on-leave" ? s.workingHours : undefined,
          count: count((r) => (lens.clinical ? r.team.includes(s.id) : r.patient.careTeam.doctor === s.id)),
          group: lens.clinical ? roleGroup[s.role] : undefined,
        })),
        { value: NONE, label: lens.clinical ? "No care team yet" : "No doctor yet", count: count((r) => (lens.clinical ? r.team.length === 0 : !r.patient.careTeam.doctor)), group: "Unassigned" },
      ],
    });
    if (lens.branches) {
      out.push({
        key: "branch",
        label: "Branch",
        options: (["indiranagar", "hsr"] as BranchId[]).map((b) => ({ value: b, label: branchLabel(b), count: count((r) => r.patient.branch === b) })),
      });
    }
    out.push({ key: "flags", label: "Flags", options: flagOptions });
    return out;
  }, [scoped, patients, lens, showBalance, user.id]);

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
    const n = (sc: Scope) => rows.filter((r) => inScope(r, sc, ctx)).length;
    const all = { value: "all" as const, label: "All patients", count: n("all") };
    const fresh = { value: "new" as const, label: "New this week", count: n("new") };
    if (CARE_ROLES.includes(role)) return [all, { value: "mine" as const, label: "My patients", count: n("mine") }, { value: "attention" as const, label: "Needs attention", count: n("attention") }, fresh];
    if (role === "admin") return [all, { value: "duplicates" as const, label: "Possible duplicates", count: n("duplicates") }, fresh];
    // Reception (Clinic+): who's in today.
    return [all, ...(lens.diary ? [{ value: "mine" as const, label: "Today's patients", count: n("mine") }] : []), fresh];
  }, [rows, ctx, role, lens.diary]);

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
    if (lens.canAssignTeam) setAssign({ mode: "team", id });
  };

  const canRegister = lens.canRegister;
  const openRegister = useCallback(() => {
    if (canRegister) setRegisterOpen(true);
  }, [canRegister]);

  // Admin decision on a possible duplicate — never automatic, always in the activity log.
  const onDuplicateDecision = (c: DuplicateChoice) => {
    setReviewId(null);
    if (c.outcome === "merged") {
      decideDuplicates({ [c.merge.id]: { outcome: "merged", into: c.keep.id, at: new Date().toISOString(), by: user.name }, [c.keep.id]: { outcome: "separate", at: new Date().toISOString(), by: user.name } });
      const auditId = logAudit({
        actorId: user.id,
        category: "record",
        action: `Merged duplicate record ${clinicNoOf(c.merge)} (${c.merge.name}) into ${clinicNoOf(c.keep)} (${c.keep.name})`,
        target: { kind: "patient", id: c.keep.id, label: c.keep.name },
        detail: "Reviewed by an admin — visits, documents and notes now sit on the kept record",
        scope: "metadata",
      });
      toast({
        title: `Merged into ${clinicNoOf(c.keep)}`,
        description: `${clinicNoOf(c.merge)} now points to ${c.keep.name}'s record. Recorded in the activity log.`,
        tone: "success",
        action: {
          label: "Undo",
          onClick: () => {
            undoDuplicates([c.merge.id, c.keep.id]);
            logAudit({ actorId: user.id, category: "record", action: `Undid the merge of ${clinicNoOf(c.merge)} into ${clinicNoOf(c.keep)}`, target: { kind: "patient", id: c.keep.id, label: c.keep.name }, detail: `Reverses ${auditId}`, scope: "metadata" });
          },
        },
      });
    } else {
      const people = patients.filter((p) => c.ids.includes(p.id));
      decideDuplicates(Object.fromEntries(c.ids.map((id) => [id, { outcome: "separate" as const, at: new Date().toISOString(), by: user.name }])));
      for (const p of people) {
        logAudit({ actorId: user.id, category: "record", action: `Reviewed a possible duplicate — kept ${p.name} (${clinicNoOf(p)}) as a separate patient`, target: { kind: "patient", id: p.id, label: p.name }, scope: "metadata" });
      }
      toast({
        title: "Kept as separate patients",
        description: "The duplicate flag is cleared. Recorded in the activity log.",
        tone: "success",
        action: { label: "Undo", onClick: () => undoDuplicates(c.ids) },
      });
    }
  };

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
    logAudit({
      actorId: user.id,
      category: "record",
      action: `Registered ${r.patient.name} (${clinicNoOf(r.patient)}) — DPDP consent recorded${r.flaggedDuplicate ? ", flagged as a possible duplicate for the admin" : ""}`,
      target: { kind: "patient", id: r.patient.id, label: r.patient.name },
      scope: "metadata",
    });
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
        {canRegister ? <NewPatientParam onOpen={openRegister} /> : null}
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
        description={lens.clinical ? "One shared record for medical, nutrition and movement care." : "Contact details and care teams. Clinical records stay with each patient's care team."}
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
            {canRegister ? (
              <Button variant="primary" leading={<UserPlus />} onClick={openRegister}>
                Register patient
              </Button>
            ) : null}
          </>
        }
      />

      <RegistryToolbar
        scope={scope}
        onScope={refine(setScope)}
        scopes={scopes}
        view={shownView}
        onView={changeView}
        browse={lens.browse}
        placeholder={lens.concern === "diagnosis" ? "Name, clinic ID, phone or concern" : "Name, clinic ID or phone"}
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
                ? "Try a different spelling, the clinic ID (e.g. PR-01047), the last three digits of the mobile, or fewer filters."
                : scope === "mine"
                  ? CARE_ROLES.includes(role)
                    ? "You're not on any care team yet. Care teams are assigned from a patient's record."
                    : "Nobody is booked today."
                  : scope === "duplicates"
                    ? "No possible duplicates to review."
                    : "Patients registered this week appear here."
            }
            action={
              <div className="flex flex-wrap justify-center gap-2">
                {filtered || scope !== "all" ? (
                  <Button variant="dark" onClick={clearAll}>
                    {filtered ? "Clear filters" : "Show all patients"}
                  </Button>
                ) : null}
                {canRegister ? (
                  <Button variant="secondary" leading={<UserPlus />} onClick={openRegister}>
                    Register patient
                  </Button>
                ) : null}
              </div>
            }
          />
        </div>
      ) : shownView === "browse" ? (
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
          {shownView === "table" ? (
            <div className="hidden overflow-hidden rounded-card bg-surface @[880px]:block">
              <RegistryTable
                rows={pageRows}
                selected={selected}
                onToggle={toggle}
                onTogglePage={togglePage}
                onOpen={open}
                onAssign={openAssign}
                onOpenLocal={setLocalId}
                onReview={setReviewId}
                lens={lens}
                highlight={highlight}
                caption={caption}
              />
              <Pager page={current} pageCount={pageCount} total={results.length} pageSize={PAGE_SIZE} onPage={setPage} className="px-5 py-3 shadow-[inset_0_1px_0_var(--color-line)]" />
            </div>
          ) : null}
          <div className={shownView === "table" ? "@[880px]:hidden" : undefined}>
            <RegistryCards rows={pageRows} selected={selected} onToggle={toggle} onOpen={open} onAssign={openAssign} onOpenLocal={setLocalId} onReview={setReviewId} lens={lens} highlight={highlight} />
            <Pager page={current} pageCount={pageCount} total={results.length} pageSize={PAGE_SIZE} onPage={setPage} className="mt-4 px-1" />
          </div>
        </>
      )}

      <BulkBar
        count={shownView === "browse" ? 0 : selected.size}
        onAssign={lens.coordinators && lens.canAssignTeam ? () => setAssign({ mode: "coordinator", ids: [...selected] }) : undefined}
        onExport={() => toast(EXPORT_TOAST)}
        onClear={() => setSelected(new Set())}
      />

      <MergeModal patient={reviewId ? (patients.find((p) => p.id === reviewId) ?? null) : null} pool={patients} onClose={() => setReviewId(null)} onDecide={onDuplicateDecision} />

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
          for (const id of Object.keys(teams)) {
            const p = patients.find((x) => x.id === id);
            if (p) logAudit({ actorId: user.id, category: "record", action: "Updated the care team", target: { kind: "patient", id, label: p.name }, detail: summary.title, scope: "metadata" });
          }
          toast({ ...summary, tone: "success" });
        }}
      />

      <LocalPatientSheet
        patient={localPatient}
        visit={localVisit}
        pool={patients}
        lens={lens}
        onReview={setReviewId}
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

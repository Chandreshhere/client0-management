"use client";

import { useEffect, useMemo, useState } from "react";
import { Archive, ArrowCounterClockwise, DotsThree, PencilSimple, Plus, Stethoscope } from "@phosphor-icons/react";
import { formatDate, formatINR, pluralize } from "@/lib/format";
import { cn } from "@/lib/cn";
import { SegmentedBar } from "@/components/charts/bar-chart";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input, SearchInput, Select, Switch } from "@/components/ui/input";
import { Dialog, DialogClose, ModalContent } from "@/components/ui/dialog";
import { Dropdown, DropdownContent, DropdownItem, DropdownTrigger } from "@/components/ui/dropdown";
import { EmptyState, PageHeader } from "@/components/ui/misc";
import { IconButton } from "@/components/ui/icon-button";
import { StatusBadge } from "@/components/ui/status";
import { useToast } from "@/components/ui/toast";
import { ChipGroup } from "@/components/viz/cards";
import { usePlan, useRole } from "@/components/shell/role-context";
import { DisciplineTag, InfoNote, ReadOnlyBanner, TableCard } from "./ui";
import { MeterRow } from "./viz";
import { ALL_ROOMS, BILLING_LABEL, CATEGORY_DISCIPLINE, CATEGORY_LABEL, DIARY_WEEK_LABEL, bookingsThisWeek, billedThisMonth, settingsAccess, type Service, type ServiceBilling, type ServiceCategory } from "./data";
import { revertService, upsertService, useServices } from "./store";

const CATEGORIES = Object.keys(CATEGORY_LABEL) as ServiceCategory[];
const CATEGORY_FILL: Record<ServiceCategory, string> = {
  consultations: "var(--color-medical)",
  nutrition: "var(--color-nutrition)",
  movement: "var(--color-movement)",
  diagnostics: "var(--color-ops)",
};

export function ServicesView() {
  const { role } = useRole();
  const { plan } = usePlan();
  const { toast } = useToast();
  const { user } = useRole();
  const access = settingsAccess(role, plan);
  const services = useServices();
  const [cats, setCats] = useState<ServiceCategory[]>([]);
  const [query, setQuery] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [editing, setEditing] = useState<Service | "new" | null>(null);

  const weekly = useMemo(() => bookingsThisWeek(services), [services]);
  const billed = useMemo(() => billedThisMonth(services), [services]);
  const active = services.filter((s) => !s.archived);
  const q = query.trim().toLowerCase();
  const shown = services
    .filter((s) => showArchived || !s.archived)
    .filter((s) => !cats.length || cats.includes(s.category))
    .filter((s) => !q || `${s.name} ${CATEGORY_LABEL[s.category]} ${s.rooms.join(" ")}`.toLowerCase().includes(q));
  const ranked = [...active].map((s) => ({ s, n: weekly.counts[s.id] ?? 0 })).filter((x) => x.n > 0).sort((a, b) => b.n - a.n);
  const maxN = Math.max(1, ...ranked.map((r) => r.n));
  const billedTotal = Object.values(billed).reduce((s, b) => s + b.amount, 0);

  if (role === "patient") {
    return (
      <div className="flex flex-col gap-6 lg:gap-8">
        <PageHeader title="Services" />
        <Card>
          <EmptyState icon={<Stethoscope />} title="Services are managed by the clinic" description="Ask the front desk about prices — your own invoices are in your portal." />
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 lg:gap-8">
      <PageHeader
        eyebrow="Settings"
        title="Services"
        description="What the clinic offers, how long it takes and what it costs. Prices match what invoices bill; booking counts come from this week's diary."
        actions={
          access.canEditServices ? (
            <Button variant="primary" leading={<Plus />} onClick={() => setEditing("new")}>
              Add service
            </Button>
          ) : undefined
        }
      />
      {!access.canEditServices ? <ReadOnlyBanner>The service catalogue is maintained by {access.ownerLabel}. You can see prices, lengths and how often each service is booked.</ReadOnlyBanner> : null}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
        <section aria-labelledby="sv-week" className="flex flex-col gap-4 rounded-card bg-surface p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 id="sv-week" className="text-lg font-normal tracking-[-0.01em] text-ink">
                Booked this week
              </h2>
              <p className="mt-1 text-xs text-muted">Diary appointments per service, cancellations excluded · {DIARY_WEEK_LABEL}</p>
            </div>
            <p className="text-right">
              <span className="block text-[32px] font-light leading-none tracking-[-0.02em] text-ink">{weekly.total}</span>
              <span className="mt-1 block text-xs text-muted">{weekly.unmatched ? `${weekly.unmatched} not matched to a service` : "every booking matched"}</span>
            </p>
          </div>
          <ul className="grid grid-cols-1 gap-x-8 gap-y-3 md:grid-cols-2">
            {ranked.map(({ s, n }) => (
              <li key={s.id}>
                <MeterRow
                  label={
                    <span className="flex items-center gap-2">
                      <span className="size-2 shrink-0 rounded-full" style={{ background: CATEGORY_FILL[s.category] }} aria-hidden="true" />
                      {s.name}
                    </span>
                  }
                  value={n}
                  max={maxN}
                  display={n}
                />
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="sv-mix" className="flex flex-col justify-between gap-6 rounded-card bg-surface p-6">
          <div>
            <h2 id="sv-mix" className="text-xs text-muted">Catalogue</h2>
            <p className="mt-2 text-[32px] font-light leading-none tracking-[-0.02em] text-ink">
              {active.length}
              <span className="ml-2 text-sm text-muted">active services{services.length - active.length ? ` · ${services.length - active.length} archived` : ""}</span>
            </p>
          </div>
          <SegmentedBar label="Active services by category" parts={CATEGORIES.map((c) => ({ label: CATEGORY_LABEL[c], value: active.filter((s) => s.category === c).length, color: CATEGORY_FILL[c] }))} />
          <div className="rounded-inner bg-sunken p-4">
            <p className="text-xs text-muted">Billed in November so far</p>
            <p className="mt-1 text-[22px] font-light leading-none text-ink">{formatINR(billedTotal)}</p>
            <p className="mt-1 text-xs text-muted">Invoice lines matched to these services · programme fees and balances excluded</p>
          </div>
        </section>
      </div>

      <section aria-labelledby="sv-list" className="flex flex-col gap-4">
        <h2 id="sv-list" className="sr-only">
          Service catalogue
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          <ChipGroup<ServiceCategory> ariaLabel="Category" value={cats} onChange={setCats} options={CATEGORIES.map((c) => ({ value: c, label: CATEGORY_LABEL[c], count: active.filter((s) => s.category === c).length }))} />
          <label className="ml-1 inline-flex items-center gap-2 text-sm text-ink-2">
            <Switch checked={showArchived} onCheckedChange={setShowArchived} aria-label="Show archived services" />
            Show archived
          </label>
          <SearchInput className="w-full sm:ml-auto sm:w-[260px]" placeholder="Search services or rooms" aria-label="Search services" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>

        {shown.length === 0 ? (
          <Card>
            <EmptyState icon={<Stethoscope />} title="No services match" description="Try another category or clear the search." action={<Button variant="secondary" onClick={() => { setCats([]); setQuery(""); }}>Clear filters</Button>} />
          </Card>
        ) : (
          <TableCard minWidth={980}>
            <table className="w-full text-sm">
              <caption className="sr-only">Service catalogue</caption>
              <thead>
                <tr className="text-left text-xs text-muted">
                  <th scope="col" className="py-4 pl-6 pr-2 font-normal">Service</th>
                  <th scope="col" className="px-2 py-4 font-normal">Category</th>
                  <th scope="col" className="px-2 py-4 text-right font-normal">Length</th>
                  <th scope="col" className="px-2 py-4 text-right font-normal">Price</th>
                  <th scope="col" className="w-[180px] px-2 py-4 font-normal">Booked this week</th>
                  <th scope="col" className="px-2 py-4 font-normal">Billed in Nov</th>
                  <th scope="col" className="px-2 py-4 font-normal">Status</th>
                  <th scope="col" className="py-4 pl-2 pr-6 text-right font-normal"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {shown.map((s) => {
                  const n = weekly.counts[s.id] ?? 0;
                  const b = billed[s.id];
                  return (
                    <tr key={s.id} className={cn("border-t border-line align-middle", s.archived && "opacity-60")}>
                      <td className="py-3 pl-6 pr-2">
                        <span className="block text-ink">{s.name}</span>
                        <span className="block text-xs text-muted">{BILLING_LABEL[s.billing]}{s.rooms.length ? ` · ${s.rooms.join(", ")}` : ""}</span>
                      </td>
                      <td className="px-2 py-3"><DisciplineTag discipline={CATEGORY_DISCIPLINE[s.category]} label={CATEGORY_LABEL[s.category]} /></td>
                      <td className="px-2 py-3 text-right text-ink-2 tabular">{s.durationMin} min</td>
                      <td className="px-2 py-3 text-right text-ink tabular">{s.billing === "programme-credit" ? <span className="text-xs text-muted">1 credit</span> : formatINR(s.price)}</td>
                      <td className="px-2 py-3">
                        <span className="flex items-center gap-2">
                          <span className="h-1.5 w-[96px] overflow-hidden rounded-full bg-sunken" aria-hidden="true">
                            <span className="block h-full rounded-full bg-charcoal" style={{ width: `${(n / maxN) * 100}%` }} />
                          </span>
                          <span className={cn("tabular", n ? "text-ink" : "text-muted")}>{n || "—"}</span>
                        </span>
                      </td>
                      <td className="px-2 py-3 text-ink-2">{b ? <span className="tabular">{pluralize(b.count, "line")} · {formatINR(b.amount)}<span className="block text-xs text-muted">last {formatDate(b.last, { day: "numeric", month: "short" })}</span></span> : <span className="text-muted">—</span>}</td>
                      <td className="px-2 py-3">{s.archived ? <StatusBadge tone="neutral">Archived</StatusBadge> : s.local ? <StatusBadge tone="info">Added this session</StatusBadge> : <StatusBadge tone="success">Bookable</StatusBadge>}</td>
                      <td className="py-3 pl-2 pr-6 text-right">
                        {access.canEditServices ? (
                          <Dropdown>
                            <DropdownTrigger asChild>
                              <IconButton label={`Actions for ${s.name}`} variant="ghost" size="sm">
                                <DotsThree size={20} weight="bold" />
                              </IconButton>
                            </DropdownTrigger>
                            <DropdownContent className="w-[240px]">
                              <DropdownItem icon={<PencilSimple />} onSelect={() => setEditing(s)}>
                                Edit
                              </DropdownItem>
                              <DropdownItem
                                icon={s.archived ? <ArrowCounterClockwise /> : <Archive />}
                                description={s.archived ? "Bookable again" : n ? `${pluralize(n, "booking")} this week keep it` : "Hidden from new bookings"}
                                onSelect={() => {
                                  const prev = s;
                                  upsertService({ ...s, archived: !s.archived }, user.id);
                                  toast({ title: s.archived ? `“${s.name}” restored` : `“${s.name}” archived`, description: "Saved in this browser session. Existing bookings and invoices are unchanged.", action: { label: "Undo", onClick: () => revertService(s.id, prev, user.id) } });
                                }}
                              >
                                {s.archived ? "Restore" : "Archive"}
                              </DropdownItem>
                            </DropdownContent>
                          </Dropdown>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </TableCard>
        )}
        <p className="text-xs text-muted">{pluralize(shown.length, "service")} shown · prices in INR · edits are saved in this browser session and written to the audit log.</p>
      </section>

      {access.canEditServices ? <ServiceModal editing={editing} services={services} onClose={() => setEditing(null)} /> : null}
    </div>
  );
}

type Errors = Partial<Record<"name" | "category" | "duration" | "price" | "rooms", string>>;

function ServiceModal({ editing, services, onClose }: { editing: Service | "new" | null; services: Service[]; onClose: () => void }) {
  const { toast } = useToast();
  const { user } = useRole();
  const isNew = editing === "new";
  const base = editing && editing !== "new" ? editing : null;
  const [name, setName] = useState("");
  const [category, setCategory] = useState<ServiceCategory | "">("");
  const [duration, setDuration] = useState("30");
  const [price, setPrice] = useState("");
  const [billing, setBilling] = useState<ServiceBilling>("per-visit");
  const [rooms, setRooms] = useState<string[]>([]);
  const [errors, setErrors] = useState<Errors>({});

  useEffect(() => {
    if (!editing) return;
    setName(base?.name ?? "");
    setCategory(base?.category ?? "");
    setDuration(String(base?.durationMin ?? 30));
    setPrice(base ? String(base.price) : "");
    setBilling(base?.billing ?? "per-visit");
    setRooms(base?.rooms ?? []);
    setErrors({});
  }, [editing, base]);

  function validate(): Errors {
    const e: Errors = {};
    const n = name.trim();
    if (n.length < 3) e.name = "Name the service (3 characters or more).";
    else if (services.some((s) => s.id !== base?.id && !s.archived && s.name.toLowerCase() === n.toLowerCase())) e.name = "An active service already has this name.";
    if (!category) e.category = "Choose a category.";
    const d = Number(duration);
    if (!/^\d+$/.test(duration.trim()) || d < 5 || d > 240) e.duration = "Between 5 and 240 minutes.";
    else if (d % 5) e.duration = "Use 5-minute steps so it fits the diary grid.";
    if (billing === "programme-credit") {
      if (price.trim() && Number(price) !== 0) e.price = "Programme sessions use a credit — leave the price at ₹0.";
    } else if (!/^\d+$/.test(price.trim())) e.price = "Whole rupees, digits only.";
    else if (Number(price) === 0) e.price = "A per-visit price can't be ₹0 — use a programme credit instead.";
    else if (Number(price) > 100000) e.price = "That's above ₹1,00,000 — check the amount.";
    if (billing !== "lab-partner" && category !== "diagnostics" && rooms.length === 0) e.rooms = "Pick at least one room where it can be booked.";
    return e;
  }

  function submit() {
    const e = validate();
    setErrors(e);
    if (Object.keys(e).length || !category) return;
    const saved = upsertService(
      { ...(base ?? { match: [] }), id: base?.id, name: name.trim(), category, durationMin: Number(duration), price: billing === "programme-credit" ? 0 : Number(price), billing, rooms, match: base?.match ?? [name.trim()] },
      user.id,
    );
    onClose();
    toast({
      tone: "success",
      title: isNew ? `“${saved.name}” added` : `“${saved.name}” updated`,
      description: "Saved in this browser session. Existing bookings and invoices keep their original price.",
      action: { label: "Undo", onClick: () => revertService(saved.id, base, user.id) },
    });
  }

  const roomsByBranch = ALL_ROOMS.reduce<Record<string, string[]>>((acc, r) => ({ ...acc, [r.branchName]: [...(acc[r.branchName] ?? []), r.room] }), {});

  return (
    <Dialog open={!!editing} onOpenChange={(o) => (!o ? onClose() : undefined)}>
      {editing ? (
        <ModalContent
          size="md"
          title={isNew ? "Add service" : `Edit ${base?.name}`}
          description={isNew ? "New services can be booked and billed from this browser session." : "Changes apply to new bookings and invoices only."}
          footer={
            <>
              <DialogClose asChild>
                <Button variant="ghost">Cancel</Button>
              </DialogClose>
              <Button variant="primary" onClick={submit}>
                {isNew ? "Add service" : "Save changes"}
              </Button>
            </>
          }
        >
          <form
            className="flex flex-col gap-5"
            noValidate
            onSubmit={(ev) => {
              ev.preventDefault();
              submit();
            }}
          >
            <Field label="Service name" error={errors.name}>
              {(a) => <Input {...a} value={name} onChange={(e) => { setName(e.target.value); setErrors((x) => ({ ...x, name: undefined })); }} placeholder="e.g. Sleep review" />}
            </Field>
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <Field label="Category" error={errors.category}>
                {(a) => (
                  <Select id={a.id} aria-invalid={a["aria-invalid"]} aria-describedby={a["aria-describedby"]} ariaLabel="Category" placeholder="Choose" value={category || undefined} onValueChange={(v) => { setCategory(v as ServiceCategory); setErrors((x) => ({ ...x, category: undefined, rooms: undefined })); }} options={CATEGORIES.map((c) => ({ value: c, label: CATEGORY_LABEL[c] }))} />
                )}
              </Field>
              <Field label="How it's paid">
                {(a) => (
                  <Select id={a.id} ariaLabel="How it's paid" value={billing} onValueChange={(v) => { setBilling(v as ServiceBilling); setErrors((x) => ({ ...x, price: undefined, rooms: undefined })); }} options={(Object.keys(BILLING_LABEL) as ServiceBilling[]).map((b) => ({ value: b, label: BILLING_LABEL[b] }))} />
                )}
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-5">
              <Field label="Length (minutes)" error={errors.duration}>
                {(a) => <Input {...a} inputMode="numeric" className="tabular" value={duration} onChange={(e) => { setDuration(e.target.value); setErrors((x) => ({ ...x, duration: undefined })); }} />}
              </Field>
              <Field label="Price (₹)" error={errors.price} hint={billing === "programme-credit" ? "Uses one session credit" : undefined}>
                {(a) => <Input {...a} inputMode="numeric" className="tabular" disabled={billing === "programme-credit"} value={billing === "programme-credit" ? "0" : price} onChange={(e) => { setPrice(e.target.value); setErrors((x) => ({ ...x, price: undefined })); }} placeholder="e.g. 900" />}
              </Field>
            </div>
            <fieldset className="flex flex-col gap-2" aria-describedby={errors.rooms ? "rooms-error" : undefined}>
              <legend className="mb-1 text-sm text-ink">Rooms</legend>
              {Object.entries(roomsByBranch).map(([branch, list]) => (
                <div key={branch} className="flex flex-col gap-1.5">
                  <span className="text-xs text-muted">{branch}</span>
                  <div className="flex flex-wrap gap-2">
                    {list.map((r) => {
                      const on = rooms.includes(r);
                      return (
                        <button
                          key={r}
                          type="button"
                          aria-pressed={on}
                          onClick={() => {
                            setRooms((x) => (on ? x.filter((y) => y !== r) : [...x, r]));
                            setErrors((x) => ({ ...x, rooms: undefined }));
                          }}
                          className={cn("inline-flex h-8 items-center rounded-full px-3 text-xs transition-colors duration-200", on ? "bg-charcoal text-white" : "bg-sunken text-ink-2 hover:bg-sunken-2")}
                        >
                          {r}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
              {errors.rooms ? (
                <p id="rooms-error" className="text-xs text-danger">
                  {errors.rooms}
                </p>
              ) : null}
            </fieldset>
            <InfoNote>Saved in this browser session only. Prices on invoices already issued never change.</InfoNote>
            <button type="submit" className="sr-only" tabIndex={-1}>
              Save
            </button>
          </form>
        </ModalContent>
      ) : null}
    </Dialog>
  );
}

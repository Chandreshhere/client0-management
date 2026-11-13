# Carelane — build guide for contributors (agents included)

Carelane is a **UI-only prototype** (no backend, synthetic data) of a multidisciplinary clinic
platform: doctors, nutritionists, yoga instructors, front desk, care coordinators, admins and
patients share **one patient record**. Product brief: `doc/explanantion.md` (read §2–§6).
Visual reference (match its language everywhere): `/private/tmp/claude-501/-Volumes-Moon-clinicmanagemeng/286cc13b-5bb9-4ead-9770-3296f07afd45/images/1.jpg`.
The finished reference clone lives at `/patients/p-kabir` — open it and match its look.

## 0. Ground rules

- **Only create/edit files you own** (your brief lists them). Never edit shared files
  (`src/components/**`, `src/data/**`, `src/lib/**`, `src/app/layout.tsx`, `src/app/globals.css`,
  `src/app/(workspace)/layout.tsx`, `src/features/patient/**`). If you need a shared change, write it
  in your final report under `sharedChangeRequests` and work around it locally.
- Feature-specific mock data goes in your own folder, e.g. `src/features/<area>/data.ts`.
  Reuse shared entities (patients, staff, appointments…) by importing them.
- The dev server is **already running at http://localhost:3000**. Do **not** start another one, do not
  run `next build`, do not kill processes, do not `npm install`.
- TypeScript strict. No `any`. Next.js 16 App Router: `params` is a Promise in pages
  (`const { id } = await params`). Pages can't export arbitrary names (only default + metadata etc.).
- Server components can't import functions from `"use client"` modules. Put interactive UI in a
  `"use client"` component under `src/features/<area>/` and keep `page.tsx` a thin server file that
  exports `metadata` and renders it.
- Phosphor icons: in client components import from `@phosphor-icons/react`; in **server** components
  import from `@phosphor-icons/react/ssr`.

## 1. Commands

```bash
# type-check (whole project; filter to your files — other agents are editing concurrently)
node node_modules/typescript/bin/tsc --noEmit --incremental false 2>&1 | grep -E "src/(app/\(workspace\)/YOURROUTE|features/YOURAREA)" ; echo done

# screenshot a route (local Chrome). Cookies select demo role/plan/sidebar.
BASE_URL=http://localhost:3000 node scripts/shot.mjs /dashboard /private/tmp/claude-501/-Volumes-Moon-clinicmanagemeng/286cc13b-5bb9-4ead-9770-3296f07afd45/scratchpad/shots/<name>.png \
  --w 1440 --h 900 --cookie cl_role=doctor --cookie cl_plan=clinic --wait 1500 [--full] [--click "<selector>"]
# mobile check
... --w 390 --h 844
```
The script prints HTTP status plus any `pageerror` / `console.error` — treat those as bugs.
Then **look at the PNG** (Read tool) and fix what you see. Repeat until clean. Save shots under
`.../scratchpad/shots/` (create it).

Cookies: `cl_role` ∈ admin|doctor|nutritionist|yoga|frontdesk|coordinator|patient ·
`cl_plan` ∈ starter|team|clinic · `cl_sidebar` ∈ expanded|collapsed.

## 2. Design language (constraints, not suggestions)

- **Grid** 8px. Spacing multiples of 8 (4 only where 8 overflows). Page sections gap 24–32.
- **Radii**: cards/panels 24px (`rounded-card`); nested surfaces 16px (`rounded-inner`) inside an
  8px inset; pills/buttons fully round; inputs 14px (`rounded-control`). inner = outer − inset.
- **Surfaces**: canvas `bg-canvas` (#F2F3F1) · white cards `bg-surface` · recessed grey groups
  `bg-sunken` holding white `Inset`s (the reference's grey containers) · charcoal (`bg-charcoal`)
  for selected pills and strong neutral actions · **cobalt `bg-primary` is the one accent per view**
  (one focal card or primary action — do not sprinkle it).
- **No borders at rest**: hairlines are `shadow-[inset_0_0_0_1px_var(--color-line)]` like the kit.
  No drop shadows on cards; `shadow-pop` only for floating overlays.
- **Type**: Geist (sans) only; Geist Mono only for machine-read strings (IDs, tokens, times in
  tables). Page H1 = `PageHeader` (light 300, 36→44px). Card titles 18–26px weight 400.
  Body 14px, meta 12px; never below 11px. Max 3 sizes & 3 weights per component. Hierarchy by
  size/colour first; weights 300/400/500 only (no 600/700).
- **Colour tokens**: `text-ink`, `text-ink-2`, `text-muted`, `text-faint` (decorative only),
  `bg-primary-soft`/`text-primary-ink`, status `success|warning|danger` (+`-soft`).
  Discipline categorical (fixed order, validated, always labelled in text):
  `--color-medical` (cobalt) · `--color-nutrition` (#119A69) · `--color-movement` (#E8622C) ·
  `--color-ops` (neutral). Use as small marks (dots, bars, icons), not large fills.
- **Motion**: springs from `@/lib/motion` (`spring`, `snappy`, `pop`) for motion components;
  CSS transitions use `[transition-timing-function:var(--ease-spring)]` or `var(--ease-out-quart)`.
  Never `transition: all`. Purposeful motion: tab indicators (`Segmented`/`PillNav` already slide),
  list reorders (`layout`), drawers. Reduced motion is handled globally (MotionConfig + CSS).
- **Scrolling is native** (no smooth-scroll library). Programmatic jumps use `src/lib/scroll.ts`
  (smooth, instant under reduced motion). Overlay scroll areas (menus, popovers, dialog bodies)
  carry `overscroll-contain`; in-page scrollers don't, so the page keeps scrolling past them.
- **Icons**: Phosphor only, `size={18|20}`, regular weight (fill for selected states).
- Look at the reference: big light headings, rounded white/grey cards, circular white icon
  buttons with ↗ arrows, outline "N instances" chips, charcoal selected pills.

## 3. Components (import paths)

- `@/components/ui/button` → `Button` (variant primary|dark|secondary|ghost|soft|danger|glass; size sm|md|lg; `leading`, `trailing`, `loading`, `asChild`)
- `@/components/ui/icon-button` → `IconButton` (`label` required; variant white|ghost|dark|primary|soft; `tooltip`)
- `@/components/ui/card` → `Card` (white p-6), `Group` (sunken p-2), `Inset` (white rounded-inner p-4), `GroupHeader` (icon · title/subtitle · ↗ link), `SectionTitle`
- `@/components/ui/misc` → `PageHeader` (the page H1), `EmptyState`, `Skeleton`, `Kbd`, `ProgressBar`, `ProgressRing`, `Stat` (KPI tile; tone surface|sunken|primary|dark), `DemoFlag`
- `@/components/ui/pill` → `Pill` (tone neutral|outline|primary|dark|white|instances|condition)
- `@/components/ui/status` → `StatusBadge` (tone neutral|info|success|warning|danger|dark|draft) + `appointmentTone`, `recordTone`, `priorityTone`, `invoiceTone`
- `@/components/ui/avatar` → `Avatar` (src,name,size xs..xl), `AvatarStack`
- `@/components/ui/dropdown` → `Dropdown`, `DropdownTrigger`, `DropdownContent`, `DropdownItem` (icon, description, shortcut, tone="danger"), `DropdownCheckboxItem`, `DropdownRadioGroup`/`DropdownRadioItem`, `DropdownLabel`, `DropdownSeparator`, `DropdownSub*`
- `@/components/ui/popover` → `Popover`, `PopoverTrigger`, `PopoverContent`, `PopoverClose`
- `@/components/ui/dialog` → `Dialog`, `DialogTrigger`, `DialogClose`, `ModalContent` (title, description, footer, size sm|md|lg|xl), `SheetContent` (side drawer; title, description, footer)
- `@/components/ui/input` → `Input`, `Textarea`, `SearchInput`, `Field` (render-prop gives id/aria), `Select` (options[]), `Switch`, `Checkbox`
- `@/components/ui/segmented` → `Segmented` (local view toggles, sliding charcoal pill; variant loose|tray), `PillNav` (route tabs)
- `@/components/ui/tooltip` → `Tip` (label, side, shortcut)
- `@/components/ui/toast` → `useToast().toast({ title, description, tone: neutral|success|warning|danger, action })`
- Charts `@/components/charts/*` → `LineChart` (series, band, hollow points = self-reported, crosshair tooltip, keyboard), `BarChart` (stacked columns, ≤24px bars), `SegmentedBar`, `Sparkline`, `VitalWave`, `Legend`.
  Chart rules: one y-axis, legend when ≥2 series, text never in series colour, provide a table
  view (`<details>` or toggle) for important charts.
- Shell hooks `@/components/shell/role-context` → `useRole()` (role, user, setRole, plan, has) and
  `usePlan()` (plan, setPlan, has, details). `@/components/shell/plan-switcher` → `LockedFeature`,
  `LockBadge`, `priceLine(planId)`.

## 4. Data (all synthetic; "today" = Fri 13 Nov 2026 09:40 IST → `TODAY` in `@/lib/format`)

- `@/data/types` — all domain types.
- `@/data/staff` — `CLINIC`, `BRANCHES`, `STAFF`, `staffById`, `DEMO_USER[role]`, `ROLE_ORDER`.
- `@/data/patients` — `PATIENTS` (24), `patientById`, `clinicNumber(id)`, `PATIENT_STATUS_LABEL`, `FEATURED_PATIENT_ID` ("p-kabir").
  `allergies: null` = not recorded → never display as "no known allergies".
- `@/data/appointments` — `TODAY_APPOINTMENTS`, `WEEK_APPOINTMENTS` (Mon 9 – Sat 14 Nov), `WAITLIST`, `APPOINTMENT_STATUS_LABEL`, `DISCIPLINE_LABEL`.
- `@/data/care` — `TASKS`, `REFERRALS`, `REFERRAL_STAGES`, `REFERRAL_STAGE_LABEL`, `NOTIFICATIONS`.
- `@/data/programs` — `CLASSES` (yoga, with enrolment/attendance/precautions/clearance), `ATTENDANCE_LABEL`, `PACKAGES`, `NUTRITION_PLANS`, `PLAN_STATUS_LABEL`.
- `@/data/records` — `DOCUMENTS` (report date ≠ upload date), `DOC_STATUS_LABEL`, `THREADS`, `INVOICES`, `INVOICE_STATUS_LABEL`.
- `@/data/featured` — Kabir's full record: `BODY_SYSTEMS`, `CONDITIONS`, `CARE_EVENTS`, `CARE_PLAN`, `NOTES`, `LAB_PANELS`, `VITAL_SERIES`, `EVENT_TYPE_LABEL`, `RECORD_STATE_LABEL`.
- `@/data/plans` — `PLANS` (starter ₹20,000 setup + ₹2,000/month flat · team ₹60,000 + ₹2,000/user/month, 1–5 users · clinic ₹60,000 + ₹1,800/user/month, 5–10 users), `FEATURES`, `FEATURE_GROUPS`, `planHas`, `minPlanFor`, `addedFeatures`, `monthlyCost`, `featureForPath`.
- `@/lib/format` — `formatINR`, `formatDate`, `formatTime`, `formatDayLabel`, `relativeTime`, `initials`, `pluralize`, `TODAY`.

## 5. Plans & roles

Route-level gating is automatic (AppShell renders `LockedFeature` for routes whose feature isn't in
the plan). Inside pages, **gate sub-features** with `const { has } = usePlan()`: e.g. a "Refer to
nutrition" button is shown disabled with `LockBadge` + tooltip "Available on Team plan" when
`!has("referrals")`. Roles available per plan: starter = doctor; team = doctor, nutritionist, yoga,
frontdesk; clinic = all seven. Pages should adapt to `useRole().role` where it matters
(e.g. "my tasks" default filter = current user).

## 6. Honest states (doc §5F) — mandatory

- Every visible control works or explains why not. Demo actions update **local state** and toast
  what actually happened ("Saved in this browser session", "Recorded locally — nothing was sent").
- Never show fake success for payments, message delivery, clinical signing or external sync.
  Use states: Draft · Saving · Saved · Awaiting review · Signed · Released · Failed · Needs attention.
- Patient-entered data is labelled **self-reported**. Report date is shown separately from upload date.
- Provide empty states, validation messages (inline, `Field error=`), and disabled states.

## 7. Accessibility & responsiveness

- One `<h1>` per page (`PageHeader`). Landmarks are provided by the shell (`main#main`).
- Icon-only buttons use `IconButton label=`; inputs use `Field`; tables use `<th scope>`.
- Keyboard: everything reachable; Radix handles menus/dialogs. Visible focus is global.
- Check 1440×900 **and** 390×844. No horizontal page scroll on mobile: tables become stacked cards
  or live in an `overflow-x-auto` wrapper.

## 8. Query-param entry points (the shell links to these — support them)

`/schedule?new=1` (new appointment modal) · `/patients?new=1` (register patient) ·
`/tasks?new=1` (new task) · `/documents?upload=1` (upload document) ·
`/messages?new=1` (new message) · `/patients/p-kabir/notes?new=1` (new consultation note).
Use `useSearchParams()` inside a component wrapped in `<Suspense>`.

## 9. Definition of done (per page)

1. Renders at 1440×900 and 390×844 with no console errors; screenshots reviewed.
2. Matches the reference language (sections 2–3); uses kit components, not ad-hoc look-alikes.
3. All controls work with mock data; dropdowns/filters/sorts/modals/drawers functional.
4. Role- and plan-aware where relevant; honest states; empty states.
5. Type-check clean for your files.

---

## 10. Meaningful data — non-negotiable (added after user review)

The user's rule: **"We need everything meaningful. We don't need just random things."**

- Every number, percentage, bubble, line, dot, organ and chart must be **computed from the shared
  data** and its meaning must be **stated in the UI** (label, legend, or tooltip): e.g.
  "Share of care activity · last 12 months · 27 of 41 events".
- **Never hard-code a heart.** The organ shown for a patient comes from their conditions:
  `primaryOrgan(patient)` / `record.systems[i].organ` (see §11). A COPD patient shows lungs,
  CKD shows kidneys, NAFLD shows the liver, anaemia shows blood cells, PCOS/pregnancy the uterus,
  back pain the spine, knee OA / RA the knee joint, IBS the stomach, hypothyroidism the thyroid,
  diabetes/obesity the pancreas. Clinic-level visuals (no single patient) use the organs of the
  patients they summarise (e.g. a carousel of the conditions seen today), or no organ at all.
- Lines connect things **only** when the data says they are related: condition → its events
  (timeline threads), or documented `links` between events (journey: ordered / reviewed in /
  led to / referred / revised / follow-up). Never chain events just because they are adjacent.
- No copied reference numbers ("47 Final diastolic dimension", "98 ECG"), no filler density, no
  placeholder percentages. If data doesn't exist, show an honest empty state.
- Images must match their data: scan thumbnails (`ScanThumb`) only for imaging events; lab
  values show their own trend (`measureHistory` + `Sparkline`), not a scan picture.
- Add a short legend wherever marks could be ambiguous (see the timeline legend on the
  overview).

## 11. Anatomy, records and insights APIs

- `@/data/anatomy` — `OrganKind` (heart, brain, lungs, kidney, liver, cells, thyroid, pancreas,
  spine, uterus, gut, knee), `SystemKey`, `SYSTEM_INFO`, `ORGAN_LABEL`, `classifyCondition(name)`,
  `patientSystems(patient)`, `organForSystem(key, conditions)`, `primaryOrgan(patient)`.
- `@/data/record` — `getRecord(patientId)` → `{ systems, conditions, events, years, carePlan }`
  for **every** patient (Kabir hand-written; others derived from their conditions + shared
  appointments/documents/referrals/plans/classes, with condition-specific monitoring such as
  HbA1c, TSH, eGFR, INR, GAD-7, pain scores, anchored to values in their notes).
  `hasRecord(id)`, `ALL_RECORD_PATIENTS`. Events carry `links` (documented relationships).
- `@/data/insights` — `systemShares(record)`, `eventsByType(record, year)`,
  `monthlyDensity(record)`, `careTeamActivity(record)`, `latestMeasurements(record, systemId?)`,
  `measureHistory(record, label)`, `upcoming(record)`.
- Organ visuals: `OrganImage` (static WebP in `/public/organs/<kind>-color|grey.webp`,
  rendered from the same shader), `OrganCanvas` (live WebGL, morphs between organs; use at most
  one per view), `OrganHero` (+ hotspots tied to the patient's conditions), `OrganCarousel`.

## 12. Rich visual kit (references 2–6) — `@/components/viz/*`

User references (view them): `.../images/2.jpg` (Med.+ dark list, body-condition % cards,
connected visit cards, CT grid, year scrubber), `3.jpg` (Overview Conditions: 3D organ hero,
heart-condition tiles, schedule card, body-condition carousel), `4.jpg` (the original),
`5.jpg` (metro-map journey with filter chips, doctor list with counts, dark image stat cards,
minimap), `6.jpg` (organ centre, bubble chart, metric cards, bottom scrubber).
All in `/private/tmp/claude-501/-Volumes-Moon-clinicmanagemeng/286cc13b-5bb9-4ead-9770-3296f07afd45/images/`.

| Component | Use for |
|---|---|
| `organ.tsx` → `OrganHero`, `GlassCard`, `OrganCarousel`, `OrganImage` | patient-facing home/portal hero, condition pickers |
| `condition.tsx` → `BodyConditionCard`, `VitalTile`, `BarsSpark`, `EcgSpark`, `DotsSpark`, `WaveSpark`, `ValuePill`, `SparkValue` | condition/vital summaries (ref 2 & 3) |
| `bubble-chart.tsx` → `BubbleChart` | composition in a cobalt focal card (ref 6) |
| `timeline-scrubber.tsx` → `YearScrubber`, `MonthStrip` | time navigation (ref 2 & 6) |
| `flow-map.tsx` → `FlowMap`, `FlowPill` | journeys/flows with documented links, lanes (`rows`), months (`columns`) (ref 5) |
| `cards.tsx` → `ChipGroup`, `MediaStatCard`, `PeopleList`, `ScheduleCard`, `SectionLabel` | filters, imaging stats, team lists with counts, next check-up |

The live gallery is at **/kit** (pick a patient — everything recomputes). Patient journeys live at
**/patients/[id]/journey**. Every patient now has the full overview at **/patients/[id]**.
Dashboards and portals must use these patterns instead of plain tables-only layouts, while
keeping tables where scanning many rows is the task (queues, registries, invoices).

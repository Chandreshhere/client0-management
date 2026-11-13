# Carelane — clinic management platform (UI prototype)

A front-end prototype of **Carelane**, a multidisciplinary clinic platform where doctors,
nutritionists, yoga instructors, front desk, care coordinators, admins and patients share **one
patient record**. The visual language follows the supplied EHR dashboard references; the product
scope follows the internal product brief (kept out of this public repository).

> **Prototype only.** All people and records are synthetic. There is no backend, no
> authentication, no payments and no messaging integration. Demo actions change state in your
> browser session only, and the UI says so whenever it matters.

## Run it

```bash
npm install          # .npmrc sets bin-links=false (this drive is exFAT, which has no symlinks)
npm run dev          # http://localhost:3417
npm run typecheck
npm run build && npm start
```

Scripts call Next through `node node_modules/next/dist/bin/next …` because exFAT can't hold the
usual `node_modules/.bin` symlinks. On an APFS/ext4 disk you can delete `.npmrc` if you prefer.

## Where to start

| Link | What it shows |
|---|---|
| `/` | Landing page with pricing |
| `/demo` | **Share this link** — the 3 plans first; picking one opens the demo with only that plan's features |
| `/pricing` | Plans, user-count calculator, full feature comparison |
| `/login`, `/signup`, `/onboarding` | Auth screens and the setup wizard (no real accounts) |
| `/dashboard` | Role home (switch workspace from the avatar menu or ⌘K) |
| `/patients/p-kabir` | The reference-clone patient overview (3D organ, care map, timeline) |

Keyboard: `⌘K` / `Ctrl+K` search · `⌘B` collapse sidebar · `/` search.

## Plans (prices as specified)

| Plan | Setup | Monthly | Users | Workspaces |
|---|---|---|---|---|
| Starter | ₹20,000 | ₹2,000 flat | — | Doctor |
| Team | ₹60,000 | ₹2,000 per user | 1–5 | Doctor, nutritionist, yoga, front desk |
| Clinic | ₹60,000 | ₹1,800 per user | 5–10 | All seven, incl. coordinator, admin, patient portal |

The feature split lives in `src/data/plans.ts` (single source of truth for the pricing page, the
sidebar locks, the workspace switcher and route gating). Plan names are placeholders.

## Stack

Next.js 16 (App Router) · React 19 · TypeScript 5.9 · Tailwind CSS 4 · Motion (spring physics) ·
Lenis (smooth scroll) · Radix UI primitives · cmdk · Phosphor icons · Geist font.
Illustrated avatars: DiceBear "Notionists" by Zoish (CC0), generated once into
`public/avatars/` by `scripts/generate-avatars.mjs`.

## Structure

```
src/app/(marketing)     landing, pricing, demo chooser
src/app/(auth)          login, signup, forgot password      src/app/onboarding   setup wizard
src/app/(workspace)     signed-in app (sidebar + header shell, plan gating)
src/components/ui       design-system kit          src/components/charts   chart primitives
src/components/shell    sidebar, header, ⌘K, notifications, plan switcher
src/features/<area>     one folder per product area
src/data                synthetic fixtures + plan/feature matrix
docs/BUILD-GUIDE.md     design constraints and conventions
```

## Design tokens

Canvas `#F2F3F1`, surface `#FFFFFF`, cobalt `#075DFF` (one accent per view), ink `#212622`,
muted `#5F6760` (darkened from the brief's `#687069` for contrast on grey surfaces), 8px grid,
24px card radius with 16px nested radius. Discipline colours (validated categorical set):
medical `#075DFF`, nutrition `#119A69`, movement `#E8622C`.

## Honest-state rules

Signed notes are immutable (addenda only); patient release is separate from signing;
self-reported data is labelled; report date is kept separate from upload date; allergies that
were never recorded are never shown as "no known allergies"; payments, messages and signatures
never show a success that no integration confirmed.

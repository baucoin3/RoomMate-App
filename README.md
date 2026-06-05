# Roommate App

A household management app for roommates — shared bills, shopping lists, recipes, receipt scanning, and a household calendar.

## Stack

| Layer | Technology |
|-------|------------|
| Framework | Next.js 14 (App Router), React 18, TypeScript |
| Styling | Tailwind CSS |
| Database / Auth / Storage | Supabase (`@supabase/ssr`) |
| HTTP (client) | Axios via `lib/api/client.ts` |
| Receipt AI | Anthropic Claude (`@anthropic-ai/sdk`) |
| Email | Resend (guest invites, bill reminders) |

## Architecture

```
app/(pages)/     Server & client UI
app/api/         Thin route handlers (validate → auth → service → JSON)
components/      Shared UI
hooks/           Client-side data hooks (apiClient)
lib/
  config.ts      All env vars and app constants (only place that reads process.env)
  constants/     Route paths, HTTP status codes
  services/      Business logic & Supabase queries
  supabase/      Server, client, and admin Supabase clients
  types/         Shared domain types
locales/en.ts    All user-facing strings
```

**Data flow**

- **Server components** call `lib/services/*` directly — no HTTP to internal routes.
- **Client components & hooks** use `apiClient` — never `fetch()` for app APIs.
- **Route handlers** delegate to the service layer; they do not contain business logic.

**Supabase clients**

| Context | Import |
|---------|--------|
| Server components, routes, middleware | `@/lib/supabase/server` |
| Browser (auth session, storage uploads) | `@/lib/supabase/client` |
| Admin / cron / privileged ops (bypasses RLS) | `@/lib/supabase/admin` — server-only |

Schema, RLS policies, and table map: `.cursor/rules/database-schema.mdc`.

## Features

- **Auth** — Register, login, session-protected dashboard
- **Households** — Create or join via invite code; member nicknames and cover photo
- **Dashboard** — Calendar (events, meal logs, upcoming bills, receipts), recent activity, recipe shortcuts
- **Shopping** — Household and personal shopping lists with batch item updates
- **Recipes** — CRUD with ingredients, steps, tags, images; log meals to the calendar
- **Finances** — Expense categories with member/guest split rules, one-off expenses, balances, settle-up
- **Recurring bills** — Monthly recurring expenses, payer confirmation, payment reports, email reminders (cron)
- **Receipts** — Upload a photo, AI extraction via Claude, line-item review, convert to expenses
- **Item catalog** — Household item names and aliases for receipt matching; per-item split overrides
- **Guests** — Temporary guests and guest groups for expense splitting; email invites
- **Settings** — Members, finance configuration, catalog, guests (under Household nav)

## Environment variables

Create `.env.local` in the project root. All keys are read through `lib/config.ts`.

### Required

| Key | Purpose |
|-----|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key (browser-safe, RLS-enforced) |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key — **server only**; used for admin ops and cron |
| `ANTHROPIC_API_KEY` | Receipt image analysis |

### Optional

| Key | Purpose | Default |
|-----|---------|---------|
| `NEXT_PUBLIC_API_BASE_URL` | Base URL for client `apiClient` | `http://localhost:3000` |
| `RESEND_API_KEY` | Guest invite and bill-reminder emails | disabled if unset |
| `EMAIL_FROM_ADDRESS` | Sender address for transactional email | `splits@roommate-app.com` |
| `CRON_SECRET` | Authenticates `GET /api/cron/*` (e.g. bill reminders) | disabled if unset |

## Getting started

```bash
npm install
# Create .env.local with the keys listed above
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

```bash
npm run build    # production build
npm run lint     # ESLint
npm run test     # Vitest
```

Migrations live in `supabase/migrations/`. Apply them to your Supabase project before running against a fresh database.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm run start` | Serve production build |
| `npm run lint` | ESLint (Next.js config) |
| `npm run test` | Run Vitest tests |

# Roommate App — AI Coding Standards

This file defines the non-negotiable standards for all AI-assisted code in this project.
The same rules are enforced by `.cursor/rules/`. Both must stay in sync.

---

## Stack

- **Framework:** Next.js 14 App Router (TypeScript, strict mode)
- **Styling:** Tailwind CSS
- **Backend/Auth/DB:** Supabase (`@supabase/ssr`)
- **HTTP client:** Axios via `lib/api/client.ts`

---

## 1. No Hardcoded Text or Magic Values

| What | Where it lives |
|------|---------------|
| All user-facing strings | `locales/en.ts` |
| Route path strings | `lib/constants/routes.ts` |
| Env vars, URLs, limits, feature flags | `lib/config.ts` |
| Domain types | `lib/types/*.ts` |

Never read `process.env.*` outside `lib/config.ts`.
Never write a string literal in JSX or an API response body — use the locale file.

```ts
// ❌ return NextResponse.json({ error: 'Email required.' })
// ✅ return NextResponse.json({ error: AUTH.ERRORS.REQUIRED_FIELDS })
```

---

## 2. Modern JS/TS — No Legacy Patterns

- Prefer `.map()`, `.filter()`, `.reduce()`, `.find()`, `.some()` over `for` / `for...of` loops on arrays.
- Use optional chaining (`?.`), nullish coalescing (`??`), and destructuring.
- Use `as const` + derived union types instead of `enum`.
- Never use `any`. Use `unknown` and narrow, or write a type guard.

---

## 3. Error Handling

- Every API route handler must have a top-level `try/catch` that returns `{ error: string }` with an appropriate HTTP status.
- Client code must use `getErrorMessage(err)` from `lib/api/client.ts` — never access `err.message` directly.
- Never swallow errors silently (`catch {}`). At minimum, `console.error('[context]', err)`.
- Validate inputs at the top of every handler before touching the database.

HTTP status conventions:
- 400 — missing/invalid input
- 401 — unauthenticated
- 403 — forbidden
- 404 — not found
- 409 — conflict (duplicate)
- 500 — unexpected server error

---

## 4. Database (Supabase) Standards

**Full schema, RLS matrix, functions, storage, and code map:** `.cursor/rules/database-schema.mdc`.

### Never call the DB inside a loop

```ts
// ❌ BAD
for (const id of ids) {
  await supabase.from('items').update({ done: true }).eq('id', id)
}

// ✅ GOOD — single upsert
await supabase.from('items').upsert(ids.map((id) => ({ id, done: true })))
```

`Promise.all` over a dynamic list is also banned if it can be replaced by a batch query.

### Use joins, not multiple queries

```ts
// ❌ 2 queries
const { data: h } = await supabase.from('households').select('*').eq('id', id).single()
const { data: m } = await supabase.from('profiles').select('*').eq('household_id', id)

// ✅ 1 query
const { data } = await supabase
  .from('households')
  .select('id, name, profiles(id, email, display_name)')
  .eq('id', id)
  .single()
```

### Never use `select('*')` in production

Always list only the columns you need.

### Always check Supabase errors

```ts
const { data, error } = await supabase.from('...').select('...')
if (error) return NextResponse.json({ error: error.message }, { status: 400 })
```

### RLS on every public schema table

- Enable RLS on every table.
- Never use `raw_user_meta_data` in RLS policies (user-editable). Use `raw_app_meta_data` or a profiles table.
- Never expose the `service_role` key to any client.

### Supabase client usage

| Context | Import |
|---------|--------|
| Server components, route handlers, middleware | `@/lib/supabase/server` |
| Client components | `@/lib/supabase/client` |

---

## 5. TypeScript

- `strict: true` is mandatory — never disable it or cast errors away with `as any`.
- All domain types live in `lib/types/` and are imported everywhere (never redefined locally).
- Use generics on all axios calls: `apiClient.get<{ user: User }>('/api/...')`.
- Prefer `interface` for object shapes, `type` for unions and mapped types.

---

## 6. HTTP Calls — Never Use `fetch()`. Always Use `apiClient` or the Service Layer

This is the most commonly violated rule. Every HTTP call must go through the right layer.

| Context | Correct pattern | Banned |
|---------|-----------------|--------|
| **Client component** (browser) | `apiClient.get/post/…` from `lib/api/client.ts` | `fetch()`, `axios` imported directly |
| **Server component** | Import and call a function from `lib/services/` directly — **no HTTP at all** | `fetch('/api/…')`, `apiClient` |
| **Route handler** | Call `lib/services/` functions — handler is a thin controller only | `fetch()` for internal routes |

```ts
// ❌ BAD — fetch() in a server component calling its own API
const res = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/api/dashboard/${id}`)

// ❌ BAD — fetch() in a client component
const res = await fetch('/api/households')

// ✅ GOOD — server component calls service directly
import { getDashboardData } from '@/lib/services/dashboard'
const { data } = await getDashboardData(supabase, householdId, memberId)

// ✅ GOOD — client component uses apiClient
import { apiClient } from '@/lib/api/client'
const res = await apiClient.get<{ households: Household[] }>('/api/households')
```

**Rule:** `fetch()` must never appear in `app/(pages)/`, `components/`, or `hooks/` files. Any use of native `fetch()` for internal routes is a bug — fix it.

---

## 7. Icons — Inline SVG Only (No Tabler, No Icon Fonts)

**Do not use Tabler Icons** (`ti-*` classes, `@tabler/icons-webfont`, or Tabler CDN stylesheets). They are not loaded in this project and will render as empty elements.

Use **inline Heroicons-style SVG components** instead:

| Need | Where to get it |
|------|-----------------|
| Common UI icons (chevrons, plus, trash, search, etc.) | Import from `@/components/icons` |
| Nav sidebar icons | `lib/config/nav.tsx` (household shell only) |
| One-off icon used in a single file | Small local `function FooIcon({ className })` with an `<svg>` — same pattern as nav |

```tsx
// ❌ BAD — Tabler class with no font loaded
<i className="ti-plus text-sm" />

// ✅ GOOD — shared SVG component
import { PlusIcon } from '@/components/icons'
<PlusIcon className="h-4 w-4" />
```

When adding a new shared icon, add it to `components/icons/index.tsx` using `stroke="currentColor"`, `viewBox="0 0 24 24"`, and `aria-hidden` on the `<svg>`. Size with Tailwind `className` (`h-4 w-4`), not font-size.

---

## 8. React / Next.js Components

- Default to Server Components. Add `'use client'` only when browser APIs, event handlers, or state are required.
- Extract repeated `useState` + `useEffect` + `apiClient` patterns into custom hooks in `hooks/use*.ts`.
- Every data-fetching component must handle loading, error, and success states.
- Use `ROUTES` constants for all navigation — never hardcode path strings.

---

## 9. API Route Structure

```
1. Parse + validate input (return 400 early if invalid)
2. Auth check via supabase.auth.getUser() — not getSession()
3. DB queries (batched, with joins, explicit columns)
4. Return { data } or { error }
```

If a handler exceeds ~50 lines of logic, extract it into `lib/services/`.

---

## 10. Database Schema

**Supabase Project ID:** `inbexkcbkoilfpuwctkx` — **Authoritative reference:** [`.cursor/rules/database-schema.mdc`](.cursor/rules/database-schema.mdc) (tables, RLS policies, functions, storage, FK map, service ownership).

**Summary:** 24 `public` tables — **12 with RLS**, **12 without** (finances, recipes, shopping stacks). Domains beyond the original docs: guests/groups, recurring bills + payment reports, receipts + line items, meal logs, calendar events, recipe tags, household item catalog.

Do not duplicate the schema here; update `database-schema.mdc` when the database changes.

---

## 11. Project Structure

```
app/
  (pages)/      — page components
  api/          — thin route handler controllers only
components/     — shared UI components
  icons/        — shared inline SVG icon components (Heroicons outline style)
hooks/          — custom React hooks
lib/
  api/          — axios client + helpers
  config.ts     — ALL env vars and config constants
  constants/    — routes, status codes, etc.
  services/     — business logic extracted from route handlers
  supabase/     — Supabase client factories
  types/        — shared TypeScript types
locales/
  en.ts         — ALL user-facing strings
```

---

## 12. Plan Mode — Server Features & Production Readiness

When **planning** a new API route, `lib/services/` function, or other server-side feature, ask the user (use `AskQuestion` when possible) before locking the design:

- **RLS & auth:** Must this work under `createClient()` (anon + RLS) now, or is `createAdminClient()` acceptable temporarily?
- **Data integrity:** Need Postgres transactions, unique constraints, or idempotency keys (e.g. `recurring_payment_reports` per cycle)?
- **Batching:** Expected row counts; single insert/upsert vs chunks; no DB calls inside loops or unnecessary `Promise.all` round trips.
- **Partial failure:** Compensating deletes (e.g. household create rollback) vs leaving orphans; what the API returns on halfway failure.
- **Deduping:** Which unique indexes to upsert on; return 409 vs silent merge.
- **Validation:** Handler-only checks vs DB CHECK/FK; guest vs member payer rules.
- **Observability:** `console.error` context, cron/route secrets, email or storage side effects.
- **Scope:** MVP vs ship-blocking — migration, `locales/en.ts`, `lib/types/`, RLS policies.

Do not assume how many production-grade safeguards are needed until the user confirms them. 

---

## 13. Agentic Feature Development Workflow

This is the standard process for all new features and bug fixes in this project.

### Before writing any code

1. `git pull origin main` — always start from latest.
2. Confirm the branch name with the user before creating it. Suggest `feature/<kebab-case-description>` or `fix/<kebab-case-description>` based on the task.
3. `git checkout -b <confirmed-branch-name>`

### Context first, code second

4. Read `CLAUDE.md`, then read all files relevant to the task.
5. Output a brief plan: what you'll create, what you'll modify, which patterns you'll follow.
6. **Wait for user confirmation before writing any code.**

### Implement in phases

7. Work in this order, pausing after each phase to summarize what was written and ask "continue to next phase?":
   - **Phase 1 — Types & DB:** `lib/types/`, `locales/en.ts` additions, any schema/migration changes
   - **Phase 2 — Services:** `lib/services/` business logic
   - **Phase 3 — API routes:** thin controllers in `app/api/`
   - **Phase 4 — UI:** components, hooks, pages

### Self-review before handoff

8. Before presenting the final summary, run a self-review checklist against every rule in this file:
   - No `fetch()` in `app/(pages)/`, `components/`, or `hooks/`
   - No `select('*')` in Supabase queries
   - All user-facing strings in `locales/en.ts`
   - No DB calls inside loops
   - Every API route has a top-level `try/catch` with correct HTTP status
   - No `any` types; all domain types in `lib/types/`
   - Icons use inline SVG, not Tabler classes
   - `ROUTES` constants used for all navigation
   - Fix any violations found before proceeding.

### Final handoff

9. Present a human-readable summary: files added, files modified, new API routes, new locale keys, any schema changes needed.
10. **Wait for explicit user approval** ("approved", "lgtm", "ship it", etc.) before touching git.
11. On approval: `git add` → `git commit` (conventional commit message) → `git push origin <branch>`.
12. On rejection or "start over": `git checkout main` → `git branch -D <branch-name>` → inform the user the branch was cleaned up.

---

Coding standards in this file mirror `.cursor/rules/` — keep both in sync when rules change.

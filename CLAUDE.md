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

## 7. React / Next.js Components

- Default to Server Components. Add `'use client'` only when browser APIs, event handlers, or state are required.
- Extract repeated `useState` + `useEffect` + `apiClient` patterns into custom hooks in `hooks/use*.ts`.
- Every data-fetching component must handle loading, error, and success states.
- Use `ROUTES` constants for all navigation — never hardcode path strings.

---

## 8. API Route Structure

```
1. Parse + validate input (return 400 early if invalid)
2. Auth check via supabase.auth.getUser() — not getSession()
3. DB queries (batched, with joins, explicit columns)
4. Return { data } or { error }
```

If a handler exceeds ~50 lines of logic, extract it into `lib/services/`.

---

## 9. Database Schema

**Supabase Project ID:** `inbexkcbkoilfpuwctkx` — Full verbose schema lives in `.cursor/rules/database-schema.mdc`. Summary below.

### Enums
- `list_owner_type`: `'user' | 'household'`

### Tables & Purpose

| Table | RLS | Purpose |
|-------|-----|---------|
| `households` | ✅ | Top-level entity — name + invite_code |
| `household_members` | ✅ | Links `auth.users` → `households`; has `nickname`, `is_rent_owner` |
| `expense_categories` | ⚠️ | Per-household expense labels (e.g. "Groceries") |
| `category_splits` | ⚠️ | Default % split per category per member (0–100) |
| `expenses` | ⚠️ | A logged expense — `total_amount`, `paid_by_member_id`, optional `receipt_id` |
| `expense_splits` | ⚠️ | Per-member computed `calculated_amount` + `is_settled` for each expense |
| `shopping_lists` | ⚠️ | Named list owned by a user or household (`owner_type` enum) |
| `shopping_list_items` | ⚠️ | Line items with `quantity`, `unit`, `is_checked` |
| `recipes` | ⚠️ | Household recipes with `created_by`, `notes`, `image_url` |
| `recipe_ingredients` | ⚠️ | Ingredients: `name`, `quantity`, `unit` |
| `recipe_steps` | ⚠️ | Ordered instructions: `step_number`, `instruction` |
| `household_items` | ⚠️ | Reusable item catalog with optional `default_category_id` |

⚠️ = RLS not yet enabled — **must be added before shipping**.

### Key Relationships
- `household_members.user_id` → `auth.users.id`
- `household_members.household_id` → `households.id`
- `expense_splits` links `expenses` ↔ `household_members` (who owes what)
- `category_splits` links `expense_categories` ↔ `household_members` (default splits)
- `shopping_lists.owner_type` determines whether `user_id` or `household_id` is populated

---

## 10. Project Structure

```
app/
  (pages)/      — page components
  api/          — thin route handler controllers only
components/     — shared UI components
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

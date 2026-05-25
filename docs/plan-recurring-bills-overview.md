# Recurring Bills Overview Section — Cursor Implementation Plan

## Goal

Add a **Recurring Bills** section to the finances overview (`OverviewTab`), placed **between "You Owe" and "Recent Activity"**. This section shows **all active recurring bills at all times** (not gated by `alert_days_before`). Each bill card must show **per-person amounts and paid/unpaid status** from the viewer's perspective:

- If **you are the payer**: who owes you how much, and whether each person has paid.
- If **you are not the payer**: what you owe the payer, and optionally other members' status for transparency.

This is **Option B** — recurring bills stay separate from **Owed to You** / **You Owe**, which continue to show only unsettled `expense_splits` from logged expenses.

---

## Non-Goals (Do Not Break)

| Area | Rule |
|------|------|
| **Owed to You / You Owe** | Do not change query logic in `getOweSummary`. Confirmed recurring splits still appear there automatically via `expense_splits`. |
| **Settle API** (`POST /api/finances/settle`) | Keep existing `split_ids` batch settle. Recurring UI should call this with real `split_id`s when payer marks someone paid. |
| **Settings page** | `RecurringSection` on `/dashboard/[householdId]/settings` stays the **admin/setup** UI (create, edit, deactivate, delete). Do not remove or redesign it. |
| **Dashboard `RentStatusCard`** | Leave as-is for now. Rent may appear on dashboard AND in recurring overview — that is OK. |
| **`/api/finances/upcoming`** | Leave stub returning `[]`. Do not reintroduce UpcomingBills. |
| **Receipt / expense creation flows** | No changes unless required for migration backfill. |

---

## Current State (Read Before Coding)

1. **`getOweSummary`** — queries only unsettled `expense_splits` joined to `expenses`. Correct; leave it.
2. **`POST /api/finances/recurring/[id]/confirm`** — creates `expenses` + `expense_splits`. Payer split auto-`is_settled: true`. **Not wired to any UI.**
3. **`POST /api/finances/recurring/[id]/settle-member`** — settles one member on "latest expense matching description + payer". **Not wired to any UI.** Matching is fragile.
4. **`expenses` table has no `recurring_expense_id`** — confirmed bills are linked to templates only by description + payer (bug-prone).
5. **Confirm has no cycle guard** — calling confirm twice creates duplicate expenses.
6. **Locale strings already exist** under `FINANCES.OVERVIEW` for much of this UI: `CONFIRM_MONTH`, `ROOMMATE_OWES_YOU`, `MARK_PAID`, `SETTLED_BADGE`, `OPEN_BADGE`, `PAYER_PAYS`, etc. Reuse before adding new strings.

---

## Architecture Overview

```
OverviewTab
  ├── GET /api/finances/balances          → getOweSummary (unchanged)
  ├── GET /api/finances/activity          → getRecentActivity (unchanged)
  └── GET /api/finances/recurring/overview → getRecurringBillsOverview (NEW)

RecurringBillsSection (NEW client component)
  ├── POST /api/finances/recurring/[id]/confirm      (existing, hardened)
  └── POST /api/finances/settle                      (existing, via split_id)
      OR POST /api/finances/recurring/[id]/settle-member (existing, hardened)
```

---

## Step 1 — Database Migration

Add a foreign key so confirmed expenses link reliably to their recurring template.

**Migration:** add nullable column to `expenses`:

```sql
ALTER TABLE expenses
  ADD COLUMN IF NOT EXISTS recurring_expense_id uuid
  REFERENCES recurring_expenses(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_expenses_recurring_expense_id
  ON expenses(recurring_expense_id)
  WHERE recurring_expense_id IS NOT NULL;
```

Apply via Supabase migration (MCP or CLI). Do not use `service_role` on the client.

**Backfill (optional, best-effort):** for existing expenses that match `description + paid_by_member_id + household_id` to a recurring row, set `recurring_expense_id`. Skip if ambiguous (multiple recurring rows same description).

---

## Step 2 — Types (`lib/types/finances.ts`)

Add:

```ts
export type RecurringBillCycleStatus = 'not_logged' | 'logged'

export interface RecurringBillMemberStatus {
  member_id: string
  member_name: string
  share_amount: number
  is_payer: boolean
  is_viewer: boolean
  /** Only meaningful when cycle_status === 'logged' */
  is_settled: boolean | null
  /** Only when logged — use for settle button */
  split_id: string | null
}

export interface RecurringBillOverview {
  recurring_expense_id: string
  description: string
  category_name: string | null
  total_amount: number
  due_day_of_month: number
  alert_days_before: number
  is_active: boolean
  payer: HouseholdMemberSummary
  cycle_status: RecurringBillCycleStatus
  /** ISO date of the due date for the current billing cycle */
  cycle_due_date: string
  /** Present when cycle_status === 'logged' */
  cycle_expense_id: string | null
  /** Per-member rows for this cycle (exclude payer from "owes" rows if they auto-settled) */
  members: RecurringBillMemberStatus[]
  /** Convenience totals for the viewer */
  viewer_owes_amount: number
  viewer_is_payer: boolean
  viewer_collect_total: number
  viewer_collect_unsettled_total: number
}
```

Do **not** remove existing `RecurringExpense`, `OweSummary`, etc.

---

## Step 3 — Cycle Utility (`lib/utils/recurringCycle.ts`)

Extract pure date logic (no Supabase). Export:

```ts
/** Due date (ISO yyyy-mm-dd) for the billing cycle we are currently in. */
export function getCurrentCycleDueDate(dueDayOfMonth: number, today?: Date): string

/** Start/end ISO dates inclusive for matching an expense to this cycle. */
export function getCurrentCycleDateRange(dueDayOfMonth: number, today?: Date): { start: string; end: string }
```

**Cycle rules (document in code comment):**

- Clamp `dueDayOfMonth` to valid day for each month (e.g. 31 → last day of February).
- The **current cycle** is anchored to the **most recent due date that has occurred or is today** within the rolling month window:
  - If `today >= due_day` (in current calendar month): cycle due = this month's due day.
  - Else: cycle due = last month's due day.
- An expense belongs to the cycle if `expense.date` is between `cycle_start` and `cycle_end` where:
  - `cycle_start` = day after previous cycle's due date (or same month due date if simpler MVP: same calendar month as `cycle_due_date`).

**MVP simplification (acceptable):** match expenses where `recurring_expense_id` matches AND `expense.date` is in the **same calendar month and year** as `cycle_due_date`. Document this in the util. Upgrade later if needed.

Add unit tests for `getCurrentCycleDueDate` edge cases (due on 1st, due on 31st, February).

---

## Step 4 — Service Function (`lib/services/finances.ts`)

### 4a — New `getRecurringBillsOverview`

```ts
export async function getRecurringBillsOverview(
  supabase: SupabaseClient,
  householdId: string,
  currentMemberId: string,
): Promise<{ data: RecurringBillOverview[] | null; error: string | null }>
```

**Single batched read strategy (no DB in loops):**

1. Fetch all **active** recurring expenses for household (reuse join shape from `getRecurringExpensesForHousehold`, filter `is_active = true`).
2. Collect recurring IDs; fetch matching expenses in **one query**:
   ```ts
   .from('expenses')
   .select(`
     id,
     recurring_expense_id,
     date,
     expense_splits (
       id,
       household_member_id,
       calculated_amount,
       is_settled,
       member:household_members ( id, nickname )
     )
   `)
   .eq('household_id', householdId)
   .in('recurring_expense_id', recurringIds)
   ```
3. In memory, for each recurring bill:
   - Compute `cycle_due_date` via util.
   - Find cycle expense: matching `recurring_expense_id` + date in cycle range/month.
   - If **no expense**: `cycle_status = 'not_logged'`, build `members` from `recurring_expense_splits` with `is_settled: null`, `split_id: null`.
   - If **expense exists**: `cycle_status = 'logged'`, map `expense_splits` to members (use split amounts; fall back to recurring template for members missing from splits).
4. Compute viewer totals:
   - `viewer_is_payer` = `paid_by_member_id === currentMemberId`
   - `viewer_owes_amount` = viewer's share if not payer and not settled
   - `viewer_collect_unsettled_total` = sum of unsettled non-payer splits when viewer is payer

Return sorted by `cycle_due_date` ascending, then description.

### 4b — Harden `confirm` route logic (extract to service)

Create `confirmRecurringExpenseForCycle` in `lib/services/finances.ts`:

- Load recurring + splits; verify active + household membership.
- Compute current cycle date range.
- **Guard:** if expense already exists for this `recurring_expense_id` in current cycle → return **409** with locale error `ALREADY_CONFIRMED_THIS_CYCLE`.
- Insert expense with:
  - `recurring_expense_id: recurring.id`
  - `date: cycle_due_date` (NOT `today` — use cycle due date for consistent matching)
  - splits same as current confirm route (payer auto-settled)
- Return `{ expense_id }`.

Update `app/api/finances/recurring/[id]/confirm/route.ts` to call this service (thin controller).

### 4c — Harden settle-member (extract to service)

Create `settleRecurringMemberForCycle` in service:

- Verify caller is payer.
- Find cycle expense by `recurring_expense_id` + cycle range (NOT description match).
- Update `expense_splits.is_settled = true` for `member_id` on that expense.
- Return success.

Update `app/api/finances/recurring/[id]/settle-member/route.ts` to call service.

**Prefer settle via `split_id` in UI when available** — call existing `/api/finances/settle` with `[split_id]` (already secure). Use settle-member only as fallback or remove from UI if split_id is always present when logged.

---

## Step 5 — New API Route

**`app/api/finances/recurring/overview/route.ts`**

```ts
GET ?householdId=
→ auth + getMemberIdForUser
→ getRecurringBillsOverview(supabase, householdId, memberId)
→ { data: RecurringBillOverview[] }
```

Follow existing route patterns: try/catch, `getUser()`, locale errors, 400/401/403/500.

---

## Step 6 — New Component

**`app/(pages)/dashboard/[householdId]/finances/components/overview/RecurringBillsSection.tsx`**

Props:

```ts
interface RecurringBillsSectionProps {
  bills: RecurringBillOverview[]
  householdId: string
  onChanged: () => void  // refetch overview + balances
}
```

**Per bill card:**

Header:
- Description, total `$`, category badge (optional)
- Due: reuse `FINANCES.SETTINGS.DUE_ON(day)` or overview equivalent
- Payer: `FINANCES.OVERVIEW.PAYER_PAYS(name)`
- Cycle badge: "Not logged this month" vs "Logged" (`OPEN_BADGE` / custom)

Member rows (map `bill.members`, skip payer row in "owes you" list OR show payer as "Paid" always when logged):

| Viewer role | Row copy (use existing locale helpers where possible) |
|-------------|------------------------------------------------------|
| Payer | `ROOMMATE_OWES_YOU(name, amount)` + Settled/Open badge + **Mark paid** button |
| Non-payer, row is viewer | `YOU_OWE_PERSON(payer)` or amount in red + badge (no settle button) |
| Non-payer, row is other | Optional: third-party owes payer (reuse `HOUSEHOLD_DASHBOARD.RENT.THIRD_PARTY_OWES` if imported, or add `FINANCES.OVERVIEW` equivalent) |

Actions:
- **`cycle_status === 'not_logged'`** → show **Confirm for this month** button (`CONFIRM_MONTH`) → `POST /api/finances/recurring/[id]/confirm` → `onChanged()`
- **`cycle_status === 'logged'` && viewer is payer && member not settled** → **Mark paid** → `POST /api/finances/settle` with `{ split_ids: [split_id], household_id }` → `onChanged()`

Loading/disabled states per action (`CONFIRMING`, `MARKING_PAID`). Errors via `getErrorMessage`.

Empty state: no active recurring bills → short message + link text to settings (`ROUTES.HOUSEHOLD_SETTINGS(householdId)`) — add locale string `NO_RECURRING_BILLS` + `GO_TO_SETTINGS`.

**Visual style:** match `OwedToYouSection` / `YouOweSection` — `rounded-2xl bg-[#1c1c24]`, same spacing, section grouping.

---

## Step 7 — Update `OverviewTab.tsx`

1. Add state: `recurringBills: RecurringBillOverview[]`
2. Extend `fetchAll` Promise.all with:
   ```ts
   apiClient.get<{ data: RecurringBillOverview[] }>(
     `/api/finances/recurring/overview?householdId=${householdId}`
   )
   ```
3. Insert section **after You Owe, before Recent Activity**:

```tsx
<div className="flex flex-col gap-3">
  <SectionHeader title={FINANCES.OVERVIEW.RECURRING_BILLS_TITLE} />
  <RecurringBillsSection
    bills={recurringBills}
    householdId={householdId}
    onChanged={fetchAll}
  />
</div>
```

4. `onChanged` must refetch **balances + recurring overview** (and optionally activity) so Owed to You stays in sync after confirm/settle.

Do **not** remove or reorder existing Owed to You / You Owe sections.

---

## Step 8 — Locale Strings (`locales/en.ts`)

Add under `FINANCES.OVERVIEW` (only what is missing):

```ts
RECURRING_BILLS_TITLE: 'Recurring Bills',
NOT_LOGGED_THIS_CYCLE: 'Not logged this cycle',
LOGGED_THIS_CYCLE: 'Logged this cycle',
ALREADY_CONFIRMED: 'This bill is already logged for the current cycle.',
NO_RECURRING_BILLS: 'No recurring bills set up yet.',
GO_TO_SETTINGS: 'Set up in Settings',
MEMBER_HAS_PAID: (name: string) => `${name} has paid`,
YOU_HAVE_PAID: 'You have paid',
```

Add under `FINANCES.ERRORS`:

```ts
ALREADY_CONFIRMED_THIS_CYCLE: 'This recurring bill is already logged for the current billing cycle.',
```

Reuse existing: `CONFIRM_MONTH`, `CONFIRMING`, `MARK_PAID`, `MARKING_PAID`, `SETTLED_BADGE`, `OPEN_BADGE`, `ROOMMATE_OWES_YOU`, `YOU_OWE_PERSON`, `PAYER_PAYS`.

---

## Step 9 — Confirm Route Update Checklist

In `confirm/route.ts` after service extraction:

- Set `recurring_expense_id` on insert.
- Use `cycle_due_date` for expense `date`.
- Return 409 if cycle expense already exists.
- Use `recurring_expense_splits.amount` when present (not only percentage recalc) for `calculated_amount`.

---

## Step 10 — Testing Checklist (Manual)

Run through each scenario on a household with 3 members:

### Setup unchanged
- [ ] Settings → create recurring rent, 3-way split, you as payer — still works
- [ ] Edit / deactivate / delete recurring in settings — still works

### Overview — not logged
- [ ] Recurring bill appears in overview **regardless of date** (ignore `alert_days_before` for visibility)
- [ ] Shows each roommate's expected share
- [ ] You see what others owe you (payer view) or what you owe (non-payer view)
- [ ] Owed to You / You Owe **empty** until confirm (no fake debt)

### Confirm
- [ ] Confirm creates expense; bill shows "Logged"
- [ ] Payer auto-marked paid; others Open
- [ ] Unsettled splits appear in **Owed to You** (payer) / **You Owe** (debtors)
- [ ] Confirm again → 409, no duplicate expense

### Settle
- [ ] Payer marks one roommate paid → that row Settled in recurring card
- [ ] Same person disappears from Owed to You for that split
- [ ] Other roommate still Open in both places
- [ ] Non-payer cannot mark others paid (403)

### Edge cases
- [ ] Due day 31 in February — cycle util doesn't crash
- [ ] Inactive recurring bill hidden from overview but still in settings
- [ ] Grocery expense (non-recurring) unaffected in Owed to You / You Owe
- [ ] Dashboard rent card still loads (no regression)

### Regression
- [ ] `npm run build` passes
- [ ] No `fetch()` in components
- [ ] No hardcoded user-facing strings in JSX
- [ ] No `select('*')` in new queries

---

## Implementation Order (Follow Sequentially)

1. Migration: `expenses.recurring_expense_id`
2. `lib/utils/recurringCycle.ts` + tests
3. Types in `lib/types/finances.ts`
4. Service: `getRecurringBillsOverview` + `confirmRecurringExpenseForCycle` + `settleRecurringMemberForCycle`
5. Harden confirm + settle-member routes (use services)
6. New `GET /api/finances/recurring/overview`
7. `RecurringBillsSection.tsx`
8. Wire `OverviewTab.tsx`
9. Locale strings
10. Manual testing checklist

---

## Constraints & Standards (Mandatory)

- **All strings** → `locales/en.ts`
- **Client HTTP** → `apiClient` only (no `fetch()`)
- **Route handlers** → thin; logic in `lib/services/`
- **No DB in loops** — batch queries + in-memory join
- **No `select('*')`** — explicit columns
- **Auth** → `getUser()` not `getSession()`
- **Errors** → `{ error: string }` / `{ data: T }`; client uses `getErrorMessage`
- **TypeScript strict** — no `any`; types from `lib/types/finances.ts`
- **Minimal diff** — do not refactor unrelated finances code

---

## Cursor Prompt (Paste This To Execute)

```
Implement the Recurring Bills overview section per docs/plan-recurring-bills-overview.md.

Follow the plan step-by-step in order. Do not change getOweSummary, OwedToYouSection, YouOweSection query logic, or Settings RecurringSection behavior except shared types/utils.

Key requirements:
- New section between You Owe and Recent Activity showing ALL active recurring bills always
- Per bill: per-member shares, paid/unpaid status, viewer-aware copy
- Confirm logs the current cycle expense (with recurring_expense_id, cycle due date, duplicate guard)
- Payer can mark individual members paid via existing settle API using split_id
- After confirm/settle, refetch balances so Owed to You / You Owe stay in sync

Apply the Supabase migration for expenses.recurring_expense_id first. Run build and fix any type errors. Complete the manual testing checklist before finishing.
```

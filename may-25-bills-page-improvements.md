# Finances Page Overhaul — Owed To You / You Owe

## Goal

Replace the current `BalanceCard` (category-aggregated) and `UpcomingBills` sections on the finances overview page with two new per-expense sections: **Owed to You** and **You Owe**. Keep `RecentActivity` at the bottom as-is.

---

## What to Remove

- Delete `app/(pages)/dashboard/[householdId]/finances/components/overview/BalanceCard.tsx`
- Delete `app/(pages)/dashboard/[householdId]/finances/components/overview/UpcomingBills.tsx`
- Remove the `UpcomingBills` import, state, and section from `OverviewTab.tsx`
- Remove the `upcoming` API call (`/api/finances/upcoming`) from `OverviewTab.tsx`
- Remove `getUpcomingBills` from `lib/services/finances.ts`
- Remove the `UpcomingBill` and `RoommateShare` types from `lib/types/finances.ts`
- Remove the `BalanceSummary` and `BalanceEntry` types from `lib/types/finances.ts`
- The `app/api/finances/upcoming/route.ts` can stay for now but is no longer called

---

## Step 1 — Update Types (`lib/types/finances.ts`)

Add these new types (keep `HouseholdMemberSummary`, `ActivityItem`, `RecurringExpense`, `ExpenseCategory`, `CategorySplit`, `RecurringExpenseSplit`):

```ts
export interface OweReceipt {
  id: string
  merchant_name: string | null
  receipt_date: string | null
}

export interface OweItem {
  split_id: string                     // expense_splits.id — used for settling
  expense_id: string
  description: string                  // expenses.description
  date: string                         // expenses.date
  amount: number                       // expense_splits.calculated_amount
  debtor?: HouseholdMemberSummary      // populated in owed_to_you items
  creditor?: HouseholdMemberSummary    // populated in you_owe items
  receipt: OweReceipt | null
}

export interface OweSummary {
  owed_to_you: OweItem[]
  you_owe: OweItem[]
}
```

---

## Step 2 — New Service Function (`lib/services/finances.ts`)

Replace `getBalanceSummary` with `getOweSummary`. This uses two separate Supabase queries (not Promise.all — they have independent filters). Both queries must use `!inner` joins so filters on nested tables apply correctly.

### Query A — Owed to You (expenses current member paid, others haven't settled)

```ts
supabase
  .from('expense_splits')
  .select(`
    id,
    household_member_id,
    calculated_amount,
    expenses!inner (
      id,
      description,
      date,
      receipt_id,
      receipts ( id, merchant_name, receipt_date )
    ),
    debtor:household_members!household_member_id ( id, nickname )
  `)
  .eq('expenses.household_id', householdId)
  .eq('expenses.paid_by_member_id', currentMemberId)
  .neq('household_member_id', currentMemberId)
  .eq('is_settled', false)
  .order('expenses.date', { ascending: false })
```

### Query B — You Owe (expenses others paid, current member hasn't settled)

```ts
supabase
  .from('expense_splits')
  .select(`
    id,
    household_member_id,
    calculated_amount,
    expenses!inner (
      id,
      description,
      date,
      receipt_id,
      paid_by_member_id,
      receipts ( id, merchant_name, receipt_date ),
      creditor:household_members!paid_by_member_id ( id, nickname )
    )
  `)
  .eq('expenses.household_id', householdId)
  .eq('household_member_id', currentMemberId)
  .neq('expenses.paid_by_member_id', currentMemberId)
  .eq('is_settled', false)
  .order('expenses.date', { ascending: false })
```

Map each query result into `OweItem[]`. For Query B, the creditor info lives inside the nested `expenses` row. Sort both arrays by `date` descending.

---

## Step 3 — Update Balances API Route (`app/api/finances/balances/route.ts`)

Replace the call to `getBalanceSummary` with `getOweSummary`. The route shape stays the same — return `{ data: OweSummary }`. No other changes to the route.

---

## Step 4 — Update Settle API Route (`app/api/finances/settle/route.ts`)

**Replace the current category-based settle logic** with split-ID-based settling.

New request body:
```ts
{
  split_ids: string[]   // one or more expense_splits.id values to settle
  household_id: string
}
```

Security: before settling, verify that for each `split_id`, the corresponding `expenses.paid_by_member_id` equals the current user's `memberId`. If any split fails this check, return 403. This ensures only the person who paid can mark debts as settled.

Settle logic (single batch update — no loop):
```ts
supabase
  .from('expense_splits')
  .update({ is_settled: true })
  .in('id', split_ids)
  .eq('is_settled', false)
```

Add locale strings in `locales/en.ts` under `FINANCES.ERRORS` for any new error cases (e.g. `SPLIT_IDS_REQUIRED`, `NOT_YOUR_EXPENSE`).

---

## Step 5 — New Components

### `OwedToYouSection.tsx`

`app/(pages)/dashboard/[householdId]/finances/components/overview/OwedToYouSection.tsx`

Props:
```ts
interface OwedToYouSectionProps {
  items: OweItem[]
  householdId: string
  onSettled: () => void
}
```

Behavior:
- Group `items` by `debtor.id` using `.reduce()` — do NOT render flat
- For each group (one person):
  - Header row: avatar initial + debtor nickname on the left, total owed by this person (`sum of amounts`) in green on the right
  - Below header: one row per `OweItem` showing:
    - Expense description. If `receipt` is non-null, show `receipt.merchant_name` if set, otherwise fall back to `expenses.description`
    - Date formatted as "Month Day" (e.g. "May 12")
    - Amount in green
    - "Settle" button — calls the settle API with `[item.split_id]`
  - Footer row for the group: "Clear All" button — calls the settle API with all `split_id`s for this person
- While settling a split, disable its button (show a loading state)
- Error display per group if settle fails

Show a "All settled up" empty state if `items.length === 0`.

### `YouOweSection.tsx`

`app/(pages)/dashboard/[householdId]/finances/components/overview/YouOweSection.tsx`

Props:
```ts
interface YouOweSectionProps {
  items: OweItem[]
}
```

Behavior:
- Group `items` by `creditor.id`
- For each group (one person):
  - Header row: avatar initial + creditor nickname on the left, total you owe this person in red on the right
  - Below header: one row per `OweItem` showing:
    - Expense description (same receipt fallback logic as above)
    - Date formatted as "Month Day"
    - Amount in red
    - No settle button — you cannot settle what you owe; the payer settles it
  - Footer row: per-person total (no action)
- Empty state: "You don't owe anyone" if `items.length === 0`

---

## Step 6 — Update `OverviewTab.tsx`

Replace the current data fetching and rendering:

1. Remove `upcoming` state and its API call
2. Remove `BalanceSummary` type import — import `OweSummary` instead
3. Change the `/api/finances/balances` response type to `{ data: OweSummary }`
4. Remove `<BalanceCard>` and `<UpcomingBills>` — replace with:

```tsx
{/* Owed to You */}
<div className="flex flex-col gap-3">
  <SectionHeader title={FINANCES.OVERVIEW.OWED_TO_YOU_TITLE} />
  <OwedToYouSection
    items={oweSummary?.owed_to_you ?? []}
    householdId={householdId}
    onSettled={fetchAll}
  />
</div>

{/* You Owe */}
<div className="flex flex-col gap-3">
  <SectionHeader title={FINANCES.OVERVIEW.YOU_OWE_TITLE} />
  <YouOweSection items={oweSummary?.you_owe ?? []} />
</div>

{/* Recent Activity */}
<div className="flex flex-col gap-3">
  <SectionHeader title={FINANCES.OVERVIEW.ACTIVITY_TITLE} />
  <RecentActivity items={activity} />
</div>
```

---

## Step 7 — Locale Strings (`locales/en.ts`)

Add under `FINANCES.OVERVIEW`:
```ts
OWED_TO_YOU_TITLE: 'Owed to You',
YOU_OWE_TITLE: 'You Owe',
ALL_SETTLED_OWED: 'No one owes you anything right now.',
ALL_SETTLED_OWE: "You don't owe anyone right now.",
SETTLE: 'Settle',
CLEAR_ALL: 'Clear All',
SETTLING: 'Settling…',
```

Add under `FINANCES.ERRORS`:
```ts
SPLIT_IDS_REQUIRED: 'split_ids is required and must be a non-empty array.',
NOT_YOUR_EXPENSE: 'You can only settle expenses you paid for.',
```

---

## Constraints & Standards

- Follow CLAUDE.md rules throughout: all strings via `locales/en.ts`, no `fetch()` in components (use `apiClient`), no `select('*')`, batch DB updates not loops, error check every Supabase call
- Both new components are `'use client'` — they handle button state
- The settle API must be a POST with auth check via `supabase.auth.getUser()` and membership check via `getMemberIdForUser` before touching the DB
- Do not call the DB inside any loop — use `.in()` for batch operations
- TypeScript strict mode: no `any`, all types from `lib/types/finances.ts`

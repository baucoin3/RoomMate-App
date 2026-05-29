# May 28 Fix Plan

## Overview

Five focused areas: membership guard gaps, login route hardening, debug code removal, mock data removal, and guest email query efficiency.

---

## 1. Add Missing Membership Checks

Three places lack a household membership guard after authentication.

### 1a. `app/api/household-items/route.ts` — GET handler

Currently only calls `getUser()`. Any authenticated user can search any household's item catalog by passing an arbitrary `householdId`.

**Fix:** Add `getMemberIdForUser` check after auth, before the query. Match the pattern used in the POST handler in the same file and every other household-items route.

```ts
// After getUser() succeeds, before querying:
const memberId = await getMemberIdForUser(supabase, householdId, user.id)
if (!memberId) {
  return NextResponse.json({ error: FINANCES.ERRORS.FORBIDDEN }, { status: 403 })
}
```

---

### 1b. `app/api/shopping-lists/route.ts` — POST handler

Creates a shopping list for a `household_id` without verifying the user is a member of that household.

**Fix:** Add a membership check (same `getMemberIdForUser` pattern) after auth, before the insert.

---

### 1c. `app/(pages)/dashboard/[householdId]/layout.tsx` — Layout shell

Fetches and renders the household name in the nav shell for any `householdId` without verifying the user belongs there. An authenticated user browsing to another household's URL sees that household's name.

**Fix:** After `getUser()`, query `household_members` for membership. Redirect to `ROUTES.DASHBOARD` if not a member.

```ts
const { data: membership } = await supabase
  .from('household_members')
  .select('id')
  .eq('household_id', params.householdId)
  .eq('user_id', user.id)
  .maybeSingle()

if (!membership) redirect(ROUTES.DASHBOARD)
```

---

## 2. Harden `app/api/auth/login/route.ts`

Two issues in the same file.

**Fix A — Add try/catch:** The handler has no try/catch. A malformed JSON body makes `request.json()` throw, resulting in an unhandled crash. Wrap the whole handler body in try/catch returning `ERRORS.INTERNAL` at 500, matching every other route.

**Fix B — Use locale string:** Line 8 has a hardcoded `'Email and password are required.'` instead of `AUTH.ERRORS.REQUIRED_FIELDS`.

Final shape should match `app/api/auth/register/route.ts` structurally.

---

## 3. Remove Debug Console Logs

### `lib/services/receipts.ts` — lines 37, 56–63

Three `console.log` calls log the full Anthropic API input (including image URL) and the complete AI response on every receipt scan. Remove all three. The surrounding `console.error` in the catch block is intentional and stays.

### `components/recipes/RecipeForm.tsx` — lines 189–191

Three debug logs inside `uploadImage` for the Supabase storage URL. Remove all three.

### `components/receipts/ScanReceiptWizard.tsx` — lines 480–481

```ts
console.log(err)
console.log('dogs')
```

Both are forgotten debug lines. Remove both. If error logging is needed here, replace with `console.error('[ScanReceiptWizard]', err)`.

---

## 4. Remove Mock Dashboard Data

### `app/(pages)/dashboard/[householdId]/page.tsx` — line 48–49

```ts
const data = dashboardResult.data ?? MOCK_DASHBOARD_DATA   // ← remove fallback
// const data = MOCK_DASHBOARD_DATA                         // ← remove commented line
```

When a user isn't a member (or data fails to load), they currently see fabricated data for "Ben", "Sarah", and "Alex". Replace with a proper error/empty state.

**Fix:** If `dashboardResult.data` is null, render a simple error message (reuse the pattern from the finances/receipts pages — a `rounded-2xl bg-red-500/10` card with the error text). Remove the `MOCK_DASHBOARD_DATA` import.

**Then delete `lib/mock/dashboard.ts`** — it will have no remaining imports.

---

## 5. Optimize Guest Email Query

**File:** `lib/services/guestEmails.ts`

Current flow makes **3 sequential DB queries**:
1. Fetch expense with payer member + splits
2. Fetch payer email from `profiles` table (table not in schema — silently returns null)
3. Fetch household name

**Fix:** Reduce to **2 queries** (one is unavoidable for payer email via admin):

**Query 1** — join everything needed in one shot:
```ts
supabase
  .from('expenses')
  .select(
    'id, total_amount, date, description, paid_by_member_id, paid_by_guest_id, ' +
    'payer_member:household_members!paid_by_member_id(nickname, user_id), ' +
    'payer_guest:household_guests!paid_by_guest_id(name, email), ' +
    'household:households!household_id(name), ' +
    'expense_splits(calculated_amount, guest_id, household_guests(name, email))'
  )
  .eq('id', expenseId)
  .single()
```

This eliminates the separate `households` query entirely.

**Query 2** — payer email (only if payer is a household member, not a guest):

Replace the broken `profiles` table query with the admin client:
```ts
const adminClient = createAdminClient()
const { data: { user } } = await adminClient.auth.admin.getUserById(payerMember.user_id)
payerEmail = user?.email ?? ''
```

---

## 6. Remove Dead Locale Keys

### `locales/en.ts` — `RECIPES.NEW` deprecated form keys

Only `RECIPES.NEW.PAGE_TITLE` and `RECIPES.NEW.PAGE_SUBTITLE` are still referenced (in `RecipeForm.tsx:378-379`) — those stay.

The following keys inside `RECIPES.NEW` are never referenced and should be deleted:
- `NAME_LABEL`, `NAME_PLACEHOLDER`
- `CATEGORY_LABEL`, `CATEGORY_PLACEHOLDER`
- `DESCRIPTION_LABEL`, `DESCRIPTION_OPTIONAL`, `DESCRIPTION_PLACEHOLDER`
- `INGREDIENTS_HEADING`, `INGREDIENT_NAME_PLACEHOLDER`, `INGREDIENT_QTY_PLACEHOLDER`
- `ADD_INGREDIENT`, `STEPS_HEADING`, `STEP_PLACEHOLDER`, `ADD_STEP`
- `CANCEL`, `SAVE`, `SAVING`
- `ERROR_TITLE_REQUIRED`, `ERROR_INGREDIENT_REQUIRED`, `ERROR_INGREDIENT_AMOUNT_REQUIRED`, `ERROR_STEP_REQUIRED`, `ERROR_SAVE_FAILED`

---

## Execution Order

1. Login route (isolated, zero risk)
2. Remove debug logs (isolated, zero risk)
3. Membership checks — household-items GET, shopping-lists POST, layout
4. Mock data removal + delete `lib/mock/dashboard.ts`
5. Guest email query rewrite
6. Dead locale key cleanup

---

## Verification

| Change | How to verify |
|--------|--------------|
| Login try/catch | POST `/api/auth/login` with body `not-json` → expect `500 + ERRORS.INTERNAL`, not a crash page |
| Login locale | POST with empty body → response error matches `AUTH.ERRORS.REQUIRED_FIELDS` |
| household-items membership | GET `/api/household-items?householdId=<other>` as wrong user → 403 |
| shopping-lists membership | POST `/api/shopping-lists` with `household_id=<other>` → 403 |
| Layout guard | Visit `/dashboard/<household-you-don't-belong-to>` → redirects to `/dashboard` |
| No debug logs | Scan receipt → no Anthropic payload in server logs; upload recipe image → no URL logs |
| No mock data | Break `getDashboardData` (pass bad ID) → error card shown, not fake names |
| Guest emails | Save receipt with guest split → check email received; server logs show 2 DB queries not 3 |

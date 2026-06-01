# Receipt Save — New Household Items Dedup & Idempotency — Cursor Implementation Plan

## Goal

Harden **`saveReceipt`** so messy client payloads for `new_household_items` never fail on `household_items_household_id_name_key` when:

- The same canonical name appears **multiple times in one request** (e.g. three receipt lines all saved as `"candy"`).
- The name **already exists** in `household_items` for that household (retry, partial failure, or user created it earlier).

After this work, receipt save should:

1. **Dedupe in-memory** by normalized name before any insert.
2. **Insert only names that do not already exist** in the DB (single batch insert).
3. **Attach all `initial_aliases`** from collapsed duplicates to the one resolved item id (inserted or pre-existing).
4. **Preserve “last wins”** for `default_category_id`, `split_overrides`, and `item_group` when duplicates disagree.

The receipt / expense / split flow must continue unchanged aside from this household-item prelude.

---

## Non-Goals (Do Not Break or Expand Scope)

| Area | Rule |
|------|------|
| **Receipt wizard UX** | No required wizard changes in v1. Optional client-side dedupe is nice-to-have, not required for this plan. |
| **`alias_inserts` batch** | Already upserts on `(household_id, alias_text)`. Only touch if a clear duplicate-row bug appears; not the primary failure mode. |
| **Household items settings CRUD** | `createHouseholdItem`, settings pages — unchanged unless reusing a shared helper. |
| **DB schema** | No migration unless product explicitly wants case-insensitive unique names. Work within existing `UNIQUE (household_id, name)`. |
| **Expense split math** | `computeAggregateSplits` and payload `splits` — unchanged. |
| **RLS / auth on receipts route** | Keep existing `getUser()` + household membership checks. |

---

## Current State (Read Before Coding)

### Failure path today

```
POST /api/receipts
  → saveReceipt (lib/services/receipts.ts)
      → maps new_household_items 1:1 → insert(itemRows)   // ❌ no dedupe
      → maps aliases by array index i                     // ❌ breaks if deduped
      → insert receipt, line items, expense, splits
```

### Client payload construction

`ScanReceiptWizard.handleSave` builds:

```ts
configsToSave
  .filter(shouldCreateHouseholdItemOnSave)  // item mode + saveAsHouseholdItem + no householdItemId
  .map(...)                                 // one row per line — duplicates allowed
```

`shouldCreateHouseholdItemOnSave` (`lib/utils/receiptLineItems.ts`): true when `setupMode === 'item'`, `saveAsHouseholdItem`, and `householdItemId === null`.

### DB constraint

- `household_items_household_id_name_key` → unique `(household_id, name)` (exact string; case-sensitive unless DB uses citext — assume **case-sensitive**).
- Matching elsewhere uses `normalizeReceiptText` (`lib/utils/itemMatching.ts`) for fuzzy/alias logic — **dedupe key should align with that**, but **stored `name` should remain the trimmed display string from the winning row**.

### Known gap (fix in this plan)

`saveReceipt` currently **drops `item_group`** on insert even though the client sends it. Include `item_group` when implementing the new helper.

### Existing utilities to reuse

| Utility | Location | Use |
|---------|----------|-----|
| `normalizeReceiptText` | `lib/utils/itemMatching.ts` | Dedupe key + existing-item lookup |
| `upsertAliasesBatch` | `lib/services/householdItems.ts` | Alias writes after resolve (already idempotent on `alias_text`) |

---

## Failure Modes This Plan Must Handle

| Input | Expected behavior |
|-------|-------------------|
| `[{name:"candy"}, {name:"candy"}, {name:"chips"}]` | One insert for `candy`, one for `chips`; merged aliases for `candy`. |
| `[{name:"candy"}, ...]` but `candy` already in DB | Skip insert for `candy`; use existing `id`; still upsert aliases. |
| `[{name:"Candy"}, {name:"candy"}]` | Treat as one item (same normalized key); last display name wins (`"candy"` if last). |
| `[{name:"  candy  "}]` | Trim before insert; dedupe key from normalized form. |
| `[{name:""}]` or whitespace-only | Drop from insert list; do not call DB. |
| Different `split_overrides` on duplicate names | Last row in array wins (documented). |
| Retry same save after partial failure | Existing names must not 409/unique-error. |

---

## Architecture Overview

```
saveReceipt
  └── resolveNewHouseholdItemsForReceipt(supabase, householdId, items)   // NEW
        ├── normalize + dedupe in memory (last wins, merge aliases)
        ├── SELECT existing household_items for household (batch)
        ├── partition → toInsert | existingMatches
        ├── INSERT toInsert (single batch)
        └── return Map<normalizedName, { id, name }>

  └── upsertAliasesBatch for all initial_aliases keyed by resolved id
  └── (unchanged) receipt → line items → expense → splits → alias_inserts
```

All new logic lives in **`lib/services/householdItems.ts`** (or `lib/utils/householdItemDedup.ts` + thin service wrapper). **`saveReceipt`** only orchestrates.

---

## Step 1 — Types

**File:** `lib/types/receipts.ts` (or `lib/types/householdItems.ts` if shared)

Add an internal shape for the dedupe pipeline (can be `type`, not exported from barrel if only used in services):

```ts
export type NewHouseholdItemInput = NonNullable<SaveReceiptPayload['new_household_items']>[number]

export interface ResolvedHouseholdItem {
  /** Trimmed display name stored in DB (last wins among duplicates) */
  name: string
  default_category_id: string | null
  split_overrides: { member_id: string; percentage: number }[] | null
  item_group: string | null
  initial_aliases: string[]
  /** normalizeReceiptText(name) — lookup key only */
  normalizedName: string
}
```

No API response shape changes.

---

## Step 2 — Pure dedupe helper (unit-tested)

**File:** `lib/utils/householdItemDedup.ts` (NEW)

```ts
export function dedupeNewHouseholdItems(
  items: NewHouseholdItemInput[],
): ResolvedHouseholdItem[]
```

**Rules (implement exactly):**

1. Skip items where `name.trim()` is empty.
2. `normalizedName = normalizeReceiptText(name.trim())` — if empty after normalize, skip.
3. Iterate in **array order** (stable). For each item:
   - If `normalizedName` not seen: push new `ResolvedHouseholdItem` with trimmed `name`, fields from item, `initial_aliases` from `item.initial_aliases ?? []` (dedupe aliases with `Set` + trim, preserve first-seen display order).
   - If seen: **overwrite** `default_category_id`, `split_overrides`, `item_group`, and `name` (trimmed) from current row; **append** new aliases into the set (union).
4. `item_group`: `item.item_group?.trim() || null` (match client).

**Do not** hit the database in this function.

**Tests:** `lib/utils/householdItemDedup.test.ts`

| Case | Assert |
|------|--------|
| 3× `candy` with different aliases | 1 row; aliases union |
| `Candy` then `candy` | 1 row; name is `candy` if last |
| Empty name | filtered out |
| Last row has `split_overrides` | final row’s overrides kept |

---

## Step 3 — Service: resolve + insert + map ids

**File:** `lib/services/householdItems.ts`

Add:

```ts
export async function resolveNewHouseholdItemsForReceipt(
  supabase: SupabaseClient,
  householdId: string,
  items: NewHouseholdItemInput[],
): Promise<{
  data: Array<{ id: string; normalizedName: string; name: string; initial_aliases: string[] }> | null
  error: string | null
}>
```

**Algorithm:**

1. `const deduped = dedupeNewHouseholdItems(items)` — if empty, return `{ data: [], error: null }`.
2. **Fetch existing items** for household in **one query**:
   - `.from('household_items').select('id, name').eq('household_id', householdId)`
   - Build `Map<string, { id, name }>` keyed by `normalizeReceiptText(row.name)`.
3. Partition `deduped`:
   - **existing** → push `{ id, normalizedName, name: dbName, initial_aliases }` (use DB `name` for display consistency).
   - **toInsert** → rows for batch insert: `{ household_id, name, default_category_id, split_overrides, item_group }`.
4. If `toInsert.length > 0`, single `.insert(toInsert).select('id, name')`.
   - On unique violation (race: another request inserted same name): **fallback** — re-run step 2 select for conflicting normalized names only, or select all household items again once (keep simple: one refetch of `id, name` for household and merge). Document in code comment.
5. Merge inserted + existing into return array with `initial_aliases` from deduped resolved rows.

**Constraints:**

- No DB calls inside `.map()` over items.
- No `select('*')`.
- Trim `name` on insert (same as `createHouseholdItem`).

---

## Step 4 — Wire `saveReceipt`

**File:** `lib/services/receipts.ts`

Replace the block at lines ~95–121 with:

```ts
if (payload.new_household_items?.length) {
  const { data: resolved, error: itemError } = await resolveNewHouseholdItemsForReceipt(
    supabase,
    payload.household_id,
    payload.new_household_items,
  )
  if (itemError) return { data: null, error: itemError }

  const aliasesToInsert = (resolved ?? []).flatMap((item) =>
    item.initial_aliases.map((display_text) => ({
      household_item_id: item.id,
      display_text,
    })),
  )
  if (aliasesToInsert.length > 0) {
    const { error: aliasError } = await upsertAliasesBatch(supabase, payload.household_id, aliasesToInsert)
    if (aliasError) console.error('[saveReceipt] initial alias insert failed', aliasError)
  }
}
```

Remove index-based pairing with raw `payload.new_household_items[i]`.

---

## Step 5 — Optional client dedupe (low priority)

**File:** `components/receipts/ScanReceiptWizard.tsx`

After building `newHouseholdItems`, optionally call the same `dedupeNewHouseholdItems` (import from utils) before POST to shrink payload. **Not required** if server is correct; do only if trivial re-export.

---

## Step 6 — Locale / errors

No new user-facing strings required if unique violations are handled silently via refetch.

If you surface a hard failure, add to `locales/en.ts` under `RECEIPTS.ERRORS` (e.g. `HOUSEHOLD_ITEM_SAVE_FAILED`) — prefer handling races without exposing raw Postgres messages.

---

## Manual Testing Checklist

- [ ] New household: receipt with 3 lines → same resolved name `"candy"`, all `saveAsHouseholdItem` → save succeeds; one `household_items` row for `candy`.
- [ ] Aliases from all three lines appear on that item (receipt descriptions + AI candidates).
- [ ] Same receipt with `"chips"` twice → one chips row.
- [ ] Household already has `candy` → save again with new receipt mapping lines to `candy` → no unique error; aliases upserted.
- [ ] `Candy` / `candy` in one payload → one row (verify which casing is stored = last line).
- [ ] Receipt without any `new_household_items` → unchanged behavior.
- [ ] Lines linked to existing `householdItemId` still use `alias_inserts` path only (no duplicate create).
- [ ] Full save still creates receipt, expense, splits.

---

## Implementation Order (Follow Sequentially)

1. `lib/utils/householdItemDedup.ts` + unit tests
2. `resolveNewHouseholdItemsForReceipt` in `lib/services/householdItems.ts`
3. Refactor `saveReceipt` to use resolver + alias flatMap
4. Run tests: `npm test -- householdItemDedup` (or project test command)
5. Manual testing checklist

---

## Constraints & Standards (Mandatory)

- **All strings** → `locales/en.ts` (only if adding new errors)
- **Route handlers** → thin; logic in `lib/services/`
- **No DB in loops** — one select for existing items, one insert batch, optional one refetch on conflict
- **No `select('*')`**
- **No `fetch()`** in components for this work
- **TypeScript strict** — no `any`
- **Minimal diff** — do not refactor unrelated receipt wizard UI

---

## Edge Cases & Decisions (Locked)

| Question | Decision |
|----------|----------|
| Dedupe key | `normalizeReceiptText(trim(name))` |
| Which row wins metadata | **Last** in `new_household_items` array order |
| Aliases on dedupe | **Union** all `initial_aliases` + line descriptions from merged rows |
| Item already in DB | Skip insert; use existing `id`; still upsert aliases |
| Update existing item splits/category from receipt save | **No** — only set fields on **insert**. Do not PATCH existing rows during receipt save (avoids overwriting catalog). |
| `item_group` on insert | Include (fix current omission) |
| Case `Candy` vs existing `candy` | Normalized match treats as existing; no second insert |

---

## Cursor Prompt (Paste This To Execute)

```
Implement server-side hardening for messy new_household_items on receipt save per docs/plan-receipt-new-household-items-dedup.md.

Follow the plan step-by-step in order. Do not change receipt split math, getOweSummary, or unrelated flows.

Key requirements:
- Add dedupeNewHouseholdItems (pure, tested): normalize with normalizeReceiptText, last-wins metadata, union initial_aliases
- Add resolveNewHouseholdItemsForReceipt: batch-select existing items by household, insert only missing names (include item_group), handle unique races with a refetch fallback
- Refactor saveReceipt to use the resolver and attach aliases by resolved id (not raw payload index)
- Do not PATCH existing household_items during receipt save

Run unit tests for dedupe helper and complete the manual testing checklist.
```

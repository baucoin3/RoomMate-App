# Implementation Prompt — Alias dedupe by `alias_text` (receipt save fix)

Copy everything below the line into Cursor Agent to implement. Do not change receipt split math, expense flows, or household item name dedupe behavior unless listed here.

---

## Problem

`upsertAliasesBatch` sends multiple rows with the same `(household_id, alias_text)` in **one** Postgres upsert (after `normalizeReceiptText`). Postgres errors:

`ON CONFLICT DO UPDATE command cannot affect row a second time`

`saveReceipt` logs the error and continues → receipt saves, `household_items` row exists, **zero** `household_item_aliases`.

**Root cause:** Client dedupes aliases by display string (`Set` on trimmed text), but DB unique key is **normalized** `alias_text`. Example: `"KOZEL BEER +"` and `"Kozel Beer"` → both `"kozel beer"`.

**Already working:** `dedupeNewHouseholdItems` collapses duplicate item **names** (e.g. 7 lines → one `"alcohol"` item). Do not break this.

---

## Goals

1. **In-request dedupe:** At most one row per `(household_id, alias_text)` per upsert batch.
2. **Skip unchanged DB rows:** Do not include aliases that already exist with the **same** `household_item_id` (avoid useless writes; still allow upsert when re-linking to a different item).
3. **No silent failures:** Alias errors must fail `saveReceipt` (return error to client).
4. **Single choke point:** Fix in `upsertAliasesBatch` so receipt save, batch API, and future callers are safe.
5. **Do not break:** `resolveNewHouseholdItemsForReceipt`, item matching (`normalizeReceiptText` in `itemMatching.ts`), `upsertAlias` single-row API, RLS, unique constraint `(household_id, alias_text)`.

---

## Non-goals

- Wizard UX (“apply to all lines”).
- DB migrations.
- Wiring `rememberAlias` (optional follow-up).
- Changing when aliases are collected in `ScanReceiptWizard` (server fix is sufficient).

---

## Design (locked)

| Rule | Choice |
|------|--------|
| Dedupe key | `normalizeReceiptText(trim(display_text))` per `household_id` |
| Duplicate in same batch | Keep **first** `display_text`; **last** `household_item_id` if same `alias_text` maps to different items |
| Empty after normalize | Drop row |
| Already in DB, same `household_item_id` | **Skip** (no upsert row) |
| Already in DB, different `household_item_id` | **Include** in upsert (preserve current ON CONFLICT update behavior) |
| `mergeAliases` in `householdItemDedup.ts` | Dedupe by **normalized** key (not case-sensitive display `Set`) |
| Alias failure in `saveReceipt` | `return { data: null, error: RECEIPTS.ERRORS.ALIAS_SAVE_FAILED }` before continuing to receipt insert when possible |

---

## Step 1 — Pure helper + tests

**File:** `lib/utils/aliasDedup.ts` (new)

```ts
export type AliasUpsertInput = {
  household_item_id: string
  display_text: string
}

export type AliasUpsertRow = {
  household_id: string
  household_item_id: string
  alias_text: string
  display_text: string
}

/** Collapse in-request duplicates by normalized alias_text. */
export function dedupeAliasRowsInBatch(
  householdId: string,
  aliases: AliasUpsertInput[],
): AliasUpsertRow[]

/** Remove rows that already exist in DB with same item id (optional filter input). */
export function filterAliasesAlreadyLinked(
  rows: AliasUpsertRow[],
  existing: Array<{ alias_text: string; household_item_id: string }>,
): AliasUpsertRow[]
```

**Tests:** `lib/utils/aliasDedup.test.ts`

- `["KOZEL BEER +", "Kozel Beer"]` → 1 row, `alias_text === "kozel beer"`
- 7 distinct LCBO descriptions → 7 rows
- Same `alias_text`, different `household_item_id` in batch → 1 row, last item id wins
- `filterAliasesAlreadyLinked`: existing `(kozel beer, item-A)` + row for `(kozel beer, item-A)` → filtered out; same alias + `item-B` → kept

---

## Step 2 — Fix `mergeAliases` in `householdItemDedup.ts`

Replace case-sensitive `seen.has(trimmed)` with normalized key via `normalizeReceiptText`. Keep **first** display string per normalized key.

Add test in `householdItemDedup.test.ts`:

- `initial_aliases: ['CANDY BAR', 'candy bar']` → merged length 1

---

## Step 3 — Harden `upsertAliasesBatch`

**File:** `lib/services/householdItems.ts`

```ts
export async function upsertAliasesBatch(
  supabase,
  householdId,
  aliases: Array<{ household_item_id: string; display_text: string }>,
): Promise<{ error: string | null }>
```

Algorithm:

1. `const deduped = dedupeAliasRowsInBatch(householdId, aliases)`
2. If `deduped.length === 0` → return `{ error: null }`
3. **Optional existing check (required per user request):**
   - `const keys = deduped.map(r => r.alias_text)`
   - `.from('household_item_aliases').select('alias_text, household_item_id').eq('household_id', householdId).in('alias_text', keys)`
   - `const toUpsert = filterAliasesAlreadyLinked(deduped, existing ?? [])`
4. If `toUpsert.length === 0` → return `{ error: null }`
5. `.upsert(toUpsert, { onConflict: 'household_id,alias_text' })`
6. Return `{ error: error?.message ?? null }`

Do **not** change `upsertAlias` (single row) except optionally call shared normalize/dedupe internally if trivial.

---

## Step 4 — Unify + fail in `saveReceipt`

**File:** `lib/services/receipts.ts`

1. After `resolveNewHouseholdItemsForReceipt`, **do not** call `upsertAliasesBatch` immediately.
2. Build `allAliasInputs: AliasUpsertInput[]`:
   - From resolved items: `initial_aliases` → `{ household_item_id: item.id, display_text }`
   - From `payload.alias_inserts` (append as-is)
3. If `allAliasInputs.length > 0`:
   - `const { error } = await upsertAliasesBatch(supabase, payload.household_id, allAliasInputs)`
   - If `error` → `return { data: null, error: RECEIPTS.ERRORS.ALIAS_SAVE_FAILED }`
4. Remove the second `alias_inserts` upsert at end of function (merged into step 3).
5. Then insert receipt / line items / expense / splits (unchanged).

**Locale:** `locales/en.ts` → `RECEIPTS.ERRORS.ALIAS_SAVE_FAILED: 'Failed to save item aliases. Please try again.'`

---

## Step 5 — Verification

Run:

```bash
npm test -- aliasDedup householdItemDedup
```

**Manual:**

1. LCBO receipt, 7 lines, all new item `alcohol` → 1 `household_items` row, 7 `household_item_aliases` rows.
2. Save again with lines linked to existing `alcohol` → no duplicate errors; new receipt descriptions added as aliases.
3. Confirm failed alias save shows error in UI (not silent success).

---

## Files touched (expected)

| File | Change |
|------|--------|
| `lib/utils/aliasDedup.ts` | New |
| `lib/utils/aliasDedup.test.ts` | New |
| `lib/utils/householdItemDedup.ts` | `mergeAliases` normalized dedupe |
| `lib/utils/householdItemDedup.test.ts` | One test |
| `lib/services/householdItems.ts` | `upsertAliasesBatch` |
| `lib/services/receipts.ts` | Single alias batch + fail on error |
| `locales/en.ts` | `ALIAS_SAVE_FAILED` |

**Do not modify** unless tests fail: `ScanReceiptWizard`, `shouldUpsertAliasesOnSave`, `resolveNewHouseholdItemsForReceipt`, `itemMatching.ts`.

---

## Regression checklist

- [ ] `POST /api/household-items/aliases/batch` still works
- [ ] `POST /api/household-items/[id]/aliases` single alias still works
- [ ] Receipt with no item-mode lines → no alias calls, save OK
- [ ] Receipt with only `alias_inserts` (existing items) → aliases saved
- [ ] Receipt with only `new_household_items` → item + aliases saved
- [ ] Mixed new + existing same name → one item, all aliases on correct id

---

Implement in order Steps 1 → 5. Keep diffs minimal. No `fetch()` in components. All user-facing errors from `locales/en.ts`.

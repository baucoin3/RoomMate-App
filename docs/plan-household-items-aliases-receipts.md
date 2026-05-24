# Plan: Merge household items + item rules, receipt aliases, AI suggestions

Use this document as a Cursor Plan prompt or implementation spec. It consolidates the receipt matching problem, target architecture, schema, APIs, UI, and phased rollout for the Roommate App.

---

## Project constraints (must follow)

- **Stack:** Next.js 14 App Router, TypeScript strict, Supabase, Tailwind
- **Strings:** All user-facing copy in `locales/en.ts` — never inline in JSX/API
- **Config:** Env vars, prompts, limits in `lib/config.ts`
- **Routes:** Path constants in `lib/constants/routes.ts`
- **HTTP:** Client → `apiClient` from `lib/api/client.ts`; server components → `lib/services/` directly; route handlers → thin controllers calling services
- **Banned:** `fetch()` in `app/(pages)/`, `components/`, `hooks/`
- **DB:** Batch writes, explicit column `select()`, check errors, enable RLS on new tables
- **Reference:** `.cursor/rules/`, `CLAUDE.md`, `.cursor/rules/database-schema.mdc`

**Supabase project ID:** `inbexkcbkoilfpuwctkx`

---

## Problem statement

Receipt line text is often **register/SKU text** (e.g. `SPEARMINT PEPPERMINT EXCEL NOT GUM`) while the household catalog uses **human names** (e.g. `Gum`). Exact string matching fails constantly.

Today the app has **two separate catalogs** that should be one:

| Table | Used where | Fields | Matching today |
|-------|------------|--------|----------------|
| `household_items` | Receipt wizard, shopping autocomplete, save receipt | `id`, `household_id`, `name`, `default_category_id`, `image_url` | Exact case-insensitive `name` only |
| `household_item_rules` | Finances → Settings → Item rules | `id`, `household_id`, `name`, `category_id`, `item_group`, `split_overrides` | **Not used by receipts** |

Receipt save flow (unchanged conceptually): **1 receipt → 1 `expenses` row → N `expense_splits` rows**. Line items live in `receipt_line_items` for detail; splits are **aggregated** across lines in the client (`computeAggregateSplits`), not per-line in DB.

---

## Current code references

### Receipt matching (exact name only)

**File:** `components/receipts/ScanReceiptWizard.tsx`

```ts
function matchLineItems(lineItems, householdItems, categories): LineItemConfig[] {
  // householdItems.find(hi => hi.name.toLowerCase() === item.description.toLowerCase())
  // configured: true only if exact match
}
```

### Receipt page data load

**File:** `app/(pages)/dashboard/[householdId]/receipts/new/page.tsx`

- Loads `getCategoriesForHousehold` + `household_items` (id, name, default_category_id)
- Does **not** load `household_item_rules`

### Save receipt (DB order)

**File:** `lib/services/receipts.ts` → `saveReceipt()`

1. Optional insert `household_items` from `new_household_items`
2. Insert `receipts`
3. Insert `receipt_line_items` (raw `description`, `amount`, `quantity`)
4. Insert **one** `expenses` row (`receipt_id`, `total_amount`, `category_id`, `paid_by_member_id`, …)
5. Insert `expense_splits` (one row per member, aggregated percentages/amounts)

### Item setup modal

**File:** `components/receipts/ItemSetupModal.tsx`

- Per-line: category select, custom split toggle, "Save as household item" checkbox
- Known item badge when `matchedHouseholdItemId !== null`
- Does not pick from catalog list; does not save aliases

### AI analyze (today)

**Files:** `lib/config.ts` (`RECEIPT_ANALYSIS_SYSTEM_PROMPT`), `lib/services/receipts.ts` (`analyzeReceipt`), `app/api/receipts/analyze/route.ts`

Per line item today:

```json
{ "description": string, "amount": number, "quantity": number }
```

Optional receipt-level: `suggested_category_name` (from household category list).

Current token limit: `RECEIPT_ANALYSIS_MAX_TOKENS: 512` — **too small for the extended output format; must be raised in Phase 3.**

### Item rules API (settings only)

- `GET/POST /api/finances/item-rules`
- `PATCH/DELETE /api/finances/item-rules/[id]`
- `GET /api/finances/item-rules/groups`
- **Service:** `getItemRulesForHousehold` in `lib/services/finances.ts`
- **UI:** `app/(pages)/dashboard/[householdId]/finances/components/settings/ItemRulesSection.tsx`

### Shopping (uses household_items only)

**File:** `app/api/household-items/route.ts` — `ilike('name', '%q%')`, limit 4. This is a **search endpoint**, not a list endpoint. The receipt wizard and shopping both share this route. See API design section for how to handle the conflict.

### Types

- `lib/types/receipts.ts` — `LineItemConfig`, `HouseholdItemSummary`, `SaveReceiptPayload`
- `lib/types/finances.ts` — `HouseholdItemRule`

### Locales (extend these)

**File:** `locales/en.ts` — `RECEIPTS.ITEM_SETUP.*`, `FINANCES.*` for item rules section

---

## Goals

1. **Single catalog** — merge `household_item_rules` into `household_items` (rules win on conflict during migration).
2. **Aliases start empty** — new item has canonical `name` only; no SKU pre-seeding.
3. **Aliases grow on confirm** — when user maps receipt line → item in modal, optionally save normalized receipt text as alias.
4. **Match pipeline** — exact name → exact alias → fuzzy suggestions (v1: suggest only, no auto-apply) → AI hints (ephemeral until confirm).
5. **AI enrichment** — per-line `normalized_name`, category guess, `match_candidates` with confidence; UI clearly labeled as AI.
6. **Compact UI** — combobox + small AI chip row + one "remember" checkbox; avoid duplicate category controls when item selected.
7. **No regressions** — receipt save, balances, shopping autocomplete, settings CRUD.

---

## Non-goals (v1)

- Per-store aliases
- Vector/embedding search
- Auto-apply fuzzy/AI matches without user tap
- Pre-generating thousands of aliases from AI
- One expense per line item (still one aggregated expense per receipt)
- Alias cap per item — do not add this; it adds complexity with no user-facing benefit at current scale
- **Do not modify the "Save as household item" checkbox in `ItemSetupModal.tsx`** — leave this section exactly as it is; it is separate from the new alias "remember" feature
- Inline item creation from the combobox — do not add a "+ Create new item" footer action to the combobox; item creation stays in Finances Settings only

---

## Target data model

### Extend `household_items` (canonical table)

Add columns migrated from rules:

| Column | Type | Notes |
|--------|------|--------|
| `item_group` | text, nullable | e.g. "produce", "snacks" |
| `split_overrides` | jsonb, nullable | `[{ "member_id": uuid, "percentage": number }]` — same shape as current rules |

Keep existing:

- `id`, `household_id`, `name`, `default_category_id`, `image_url`

### New table: `household_item_aliases`

| Column | Type | Notes |
|--------|------|--------|
| `id` | uuid PK | `gen_random_uuid()` |
| `household_item_id` | uuid FK → `household_items.id` ON DELETE CASCADE | |
| `household_id` | uuid FK | denormalized for RLS/queries |
| `alias_text` | text NOT NULL | **normalized** for matching (see normalization spec below) |
| `display_text` | text NOT NULL | original receipt string shown in Settings aliases list — must not be null |
| `created_at` | timestamptz | `now()` |

> `source` column is **omitted in v1**. All persisted aliases come from user confirm only. Add `source` in a future migration if AI-persisted aliases are ever needed.

**Unique constraint:** `(household_id, alias_text)` — one receipt string maps to one item per household.

**RLS:** household members can CRUD aliases for their household (mirror `household_members` membership check). Any member can delete any alias in the household (not restricted to creator).

### Migration script (outline)

1. `ALTER TABLE household_items` — add `item_group text`, `split_overrides jsonb`.
2. For each row in `household_item_rules`:
   - If no `household_items` row with the same `household_id` + `name` (case-insensitive): insert as new `household_items` row, mapping `category_id` → `default_category_id`.
   - If a collision exists (same `household_id` + `name`): update the existing row — set `default_category_id = rule.category_id`, `split_overrides = rule.split_overrides`, `item_group = rule.item_group`. **Preserve** the existing `image_url`. Do not overwrite with null.
3. Create `household_item_aliases` + indexes + RLS.
4. After code deploy and smoke test: drop `household_item_rules` (or keep as read-only view temporarily).

**Before running the migration:** verify `household_item_rules.split_overrides` JSONB shape matches `[{ "member_id": uuid, "percentage": number }]` in your actual data. If the shape differs, normalize it in the migration SQL before inserting.

---

## Alias lifecycle

```
Create item "Gum" in Settings     →  aliases: []
First receipt: SPEARMINT... GUM   →  user picks Gum, checks "Remember"  →  alias row added at receipt Save
Second receipt: same text         →  exact alias match  →  auto-configured (configured: true)
```

**Normalization function** — pure function, lives in `lib/utils/itemMatching.ts` (importable by both client and server):

```ts
export function normalizeReceiptText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[''`]/g, '')          // remove apostrophes/backticks (O'REILLY → oreilly)
    .replace(/[-–—]/g, ' ')         // hyphens/dashes become spaces (MULTI-GRAIN → multi grain)
    .replace(/[^a-z0-9 ]/g, '')     // strip all remaining punctuation
    .replace(/\s+/g, ' ')           // collapse whitespace
    .trim()
}
```

This spec is exact — implement it verbatim so stored `alias_text` and runtime normalization always agree. Do not deviate without updating all stored aliases.

**Alias queuing:** aliases are queued in component state as the user progresses through the modal. They are **not** saved per-item on Next. The entire batch is flushed in a single API call when the receipt is saved (`POST /api/receipts`). Do not flush on modal Done — flush on receipt Save only.

---

## Matching service

**New file:** `lib/utils/itemMatching.ts`

> **Location is `lib/utils/`, not `lib/services/`.** These are pure functions with no Supabase dependency. `lib/services/` is server-only context in this codebase. `ScanReceiptWizard.tsx` is a client component and must be able to import these functions safely.

```ts
export type MatchType = 'exact_name' | 'alias' | 'fuzzy' | 'none'

export interface MatchResult {
  matchType: MatchType
  itemId: string | null
  confidence: number // 0–1
  candidates: Array<{
    itemId: string
    name: string
    reason: string
    confidence: number
  }>
}

export function normalizeReceiptText(text: string): string { ... }

export function matchLineToHouseholdItem(
  rawDescription: string,
  items: HouseholdItemWithAliases[],
  options?: { minFuzzyScore?: number },
): MatchResult
```

**Match order:**

1. Normalized canonical `household_items.name` === normalized raw → `exact_name`, confidence 1.0
2. Normalized `alias_text` === normalized raw → `alias`, confidence 1.0
3. Token overlap fuzzy (e.g. receipt token `gum` in name or alias) → candidates only, cap confidence ≤ 0.85
4. Else → `none`

**Auto-configure policy (v1):**

- `configured: true` automatically only for `exact_name` and `alias` — and only when `householdItemId` is set
- `fuzzy` and `ai` pre-fill UI but user must tap Next (unless they accept pre-selected suggestion)

**Update `withConfiguredFlags` in `lib/utils/receiptLineItems.ts`:** the current logic sets `configured` based on split validity only. It must also require `householdItemId !== null`. An item with valid splits but no household item mapping must not be `configured: true`.

Replace inline `matchLineItems` logic in `ScanReceiptWizard.tsx` with calls to this utility.

---

## AI analyze extension

### Prompt change (`lib/config.ts`)

Extend `RECEIPT_ANALYSIS_SYSTEM_PROMPT` line_items shape:

```json
{
  "description": "string (verbatim from receipt)",
  "amount": number,
  "quantity": number,
  "normalized_name": "string (short household-friendly name, e.g. gum)",
  "suggested_category_name": "string (from provided category list)",
  "match_candidates": [
    { "name": "string (canonical catalog name)", "confidence": 0.0-1.0 }
  ]
}
```

**Raise token limit:** update `RECEIPT_ANALYSIS_MAX_TOKENS` from 512 to **1800**. The extended output format (normalized_name + match_candidates per line) will exceed 512 tokens on any receipt with 10+ items, causing truncated JSON that fails to parse entirely. 1800 gives adequate headroom for a 25-item receipt.

**Dynamic appendix at analyze time** (in `analyzeReceipt` or route):

- Pass household category names (existing pattern)
- Pass canonical item names for match_candidates — **priority order for truncation:** most recently created items first (order by `created_at DESC`), then alphabetical for the remainder. Cap at 80 names. Do not include alias text in the prompt — canonical names only.

**Rules for model:**

- `description` must stay verbatim from receipt
- `normalized_name` is best-effort household vocabulary
- `match_candidates` max 3, only from provided catalog names
- Do not invent catalog items not in the list

**Client-side candidate validation (required):** After receiving AI analysis, before populating `LineItemConfig.aiCandidates`, filter `match_candidates` to only include entries whose `name` exactly matches a `HouseholdItem.name` in the loaded catalog. Discard any candidate name that doesn't exist in the client's item list. This prevents hallucinated names from appearing as tappable chips in the UI.

### Types (`lib/types/receipts.ts`)

Extend analysis line item and `LineItemConfig`:

```ts
// On analysis line item
normalized_name?: string | null
suggested_category_name?: string | null
match_candidates?: Array<{ name: string; confidence: number }>

// On LineItemConfig
// Rename existing matchedHouseholdItemId → householdItemId everywhere
// (ScanReceiptWizard.tsx, ItemSetupModal.tsx, saveReceipt(), SaveReceiptPayload)
householdItemId: string | null
resolvedItemName: string | null
matchSource: 'catalog' | 'alias' | 'ai' | 'fuzzy' | 'manual' | null
rememberAlias: boolean
aiNormalizedName?: string | null
aiSuggestedCategoryName?: string | null
aiCandidates?: Array<{ name: string; confidence: number }>
```

> **`matchedHouseholdItemId` rename:** this field exists in `LineItemConfig`, `ItemSetupModal`, `ScanReceiptWizard`, and `saveReceipt`. Rename to `householdItemId` across all of them atomically. Do not leave both fields coexisting.

**AI data is ephemeral** until user confirms mapping + "remember" checkbox → then queue for batch alias upsert at receipt Save.

---

## API design

### Household items — search vs list split

`app/api/household-items/route.ts` currently serves **two callers with different needs:**
- Shopping autocomplete: needs `?q=` search, limit 4, fast, no aliases
- Receipt wizard: needs full list with aliases for matching

**Solution:** keep `GET /api/household-items` as the search endpoint for shopping (existing `?q=` + limit 4 behavior). Add a separate `GET /api/household-items/list` route that returns all items with nested aliases for the receipt wizard and settings. Do not change the search route's response shape — this would break shopping autocomplete.

### Consolidated household items routes

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/household-items?q=&householdId=` | Search items by name (shopping autocomplete — unchanged) |
| GET | `/api/household-items/list?householdId=` | Full list with nested aliases (receipt wizard + settings) |
| POST | `/api/household-items` | Create item (name, default_category_id, item_group, split_overrides) |
| PATCH | `/api/household-items/[id]` | Update item |
| DELETE | `/api/household-items/[id]` | Delete item (cascade aliases) |
| POST | `/api/household-items/[id]/aliases` | Body: `{ display_text }` — server normalizes + upserts single alias (settings UI) |
| POST | `/api/household-items/aliases/batch` | Body: `{ aliases: [{ household_item_id, display_text }] }` — batch flush at receipt save |

Deprecate after cutover:

- `/api/finances/item-rules/*`

### Analyze route

**File:** `app/api/receipts/analyze/route.ts`

- Accept `household_id` in body (already may have it)
- Server loads catalog via `getHouseholdItemsForHousehold` — canonical names only, ordered by `created_at DESC`, capped at 80
- Return extended line items in `{ data: ReceiptAnalysis }`

### Receipt save payload

**Extend** `SaveReceiptPayload` in `lib/types/receipts.ts`:

```ts
alias_inserts?: Array<{ household_item_id: string; display_text: string }>
// Keep new_household_items — the "Save as household item" checkbox flow is unchanged
```

**`saveReceipt` service:** batch upsert aliases after expense_splits insert (single upsert call, not a loop). If the alias upsert fails, log the error but do not fail the whole receipt save — the expense data is already committed and is more important.

---

## New / updated services

| File | Responsibility |
|------|----------------|
| `lib/services/householdItems.ts` | CRUD items + aliases, `getHouseholdItemsForHousehold`, `upsertAliasesBatch` |
| `lib/utils/itemMatching.ts` | `normalizeReceiptText`, `matchLineToHouseholdItem` — **utils, not services** |
| `lib/services/receipts.ts` | Extended analyze + save with aliases |
| `lib/services/finances.ts` | Remove or redirect `getItemRulesForHousehold` → household items |

---

## UI specification

### ItemSetupModal (primary change)

**Header:** unchanged — raw receipt description (truncated), amount, item N of M.

**Section 1 — Match to household item (required)**

- Searchable combobox over canonical names + alias `display_text`
- Pre-selection from match pipeline:
  - Badge: `Catalog` | `Saved alias` | `Suggested` | `AI`
- **AI row** (only if AI returned candidates and no exact match):
  - Small label + icon: "AI suggestion" (`text-xs text-white/40`)
  - Up to 3 tappable chips: `Gum · Snacks · 82%`
  - Tapping applies selection; does **not** save alias until remember checkbox + receipt Save
- **No inline item creation from this combobox.** Item creation happens in Finances → Settings only.

**Section 2 — Category & splits**

- If item selected: show derived category + split preview (read-only by default)
- Collapsed "Override category" for edge cases
- If no item: show existing category dropdown + split editor (current behavior)

**Section 3 — Save as household item**

- **Do not change this section.** Leave the "Save as household item" checkbox exactly as it is today. This is a separate feature from aliases and must not be merged with, removed, or replaced by the remember alias checkbox.

**Section 4 — Remember receipt text**

- Checkbox default **ON** when:
  - User changed selection from AI/fuzzy/manual, OR
  - Line was unmatched at start
- Label: `Remember "{truncated raw}" as {canonical name}"`
- On Next: queue alias in component state only — do not flush to DB yet
- Alias batch is flushed to DB when the full receipt is saved, not on modal close

**Footer:** Next / Done — disabled until `householdItemId` is set.

### ScanReceiptWizard step 3 list

Per-line compact status:

| Status | Meaning |
|--------|---------|
| `Matched` | exact name or alias |
| `AI` | AI pre-fill, needs review |
| `Setup` | unmatched |

### Finances Settings (ItemRulesSection)

Rename section copy to "Household items" (locale only). This is a **full data source swap** from `household_item_rules` to `household_items` — not just a label change. The CRUD calls must be updated to hit the new household-items routes.

- Same fields: name, group, category, split overrides
- Collapsible "Receipt aliases" per item — list `display_text`, delete button, max-height scroll

> **Phase 1 temporary regression:** during Phase 1, the settings list will be read-only while CRUD is wired to the new endpoint but create/edit/delete have not been implemented yet. This is expected. Do not ship Phase 1 to production users until Phase 2 restores full CRUD.

### Locales to add (`locales/en.ts`)

Under `RECEIPTS.ITEM_SETUP`:

- `MATCH_ITEM_LABEL`, `MATCH_ITEM_PLACEHOLDER`, `AI_SUGGESTION_LABEL`
- `MATCH_BADGE_CATALOG`, `MATCH_BADGE_ALIAS`, `MATCH_BADGE_SUGGESTED`, `MATCH_BADGE_AI`
- `REMEMBER_ALIAS_LABEL`, `REMEMBER_ALIAS_LABEL_FN(raw, canonical)`
- `STATUS_MATCHED`, `STATUS_AI`, `STATUS_SETUP`

Under `FINANCES` settings:

- `HOUSEHOLD_ITEMS_TITLE`, `ALIASES_SECTION`, `DELETE_ALIAS`, etc.

---

## Type consolidation

**New file:** `lib/types/householdItems.ts`

```ts
export interface HouseholdItem {
  id: string
  household_id: string
  name: string
  default_category_id: string | null
  item_group: string | null
  split_overrides: { member_id: string; percentage: number }[] | null
  image_url?: string | null
  aliases?: HouseholdItemAlias[]
}

export interface HouseholdItemAlias {
  id: string
  household_item_id: string
  alias_text: string
  display_text: string  // NOT null — always required for display in Settings
}
```

> `source` is omitted from `HouseholdItemAlias` in v1 — the DB column does not exist yet. Do not add a `source` field to the type or the table. If AI-persisted aliases are added in a future version, add the column via migration then.

Deprecate `HouseholdItemRule` after migration (re-export alias type if needed during transition).

Update `LineItemConfig` in `lib/types/receipts.ts` per AI section above.

---

## Implementation phases

### Phase 1 — Schema + migration + read path

- [ ] Verify `household_item_rules.split_overrides` JSON shape in real data before writing migration SQL
- [ ] Supabase migration: extend `household_items`, create `household_item_aliases`, migrate rules data per conflict rules above
- [ ] `lib/services/householdItems.ts` + `lib/types/householdItems.ts`
- [ ] Add `GET /api/household-items/list` route (full list with aliases)
- [ ] Update `receipts/new/page.tsx` to load items via the new list route
- [ ] Update `ItemRulesSection` to use new list route (read-only OK for now — CRUD still hits old routes temporarily)
- [ ] Update `database-schema.mdc`

**Verify:** settings list works; receipt wizard receives merged list with aliases; no CRUD or AI changes yet. Do not deploy Phase 1 alone to production — ship Phase 1 + Phase 2 together to avoid leaving settings in a read-only state.

### Phase 2 — Matching + modal picker + alias API

- [ ] `lib/utils/itemMatching.ts` — `normalizeReceiptText` + `matchLineToHouseholdItem`
- [ ] Update `withConfiguredFlags` in `lib/utils/receiptLineItems.ts` to require `householdItemId !== null`
- [ ] Rename `matchedHouseholdItemId` → `householdItemId` everywhere atomically (types, wizard, modal, save service)
- [ ] Refactor `matchLineItems` in `ScanReceiptWizard.tsx` to use `matchLineToHouseholdItem` from utils
- [ ] Add `POST /api/household-items/[id]/aliases` route (single alias — for settings UI delete/add)
- [ ] Add `POST /api/household-items/aliases/batch` route (batch flush — called by receipt save)
- [ ] `upsertAliasesBatch` in `lib/services/householdItems.ts`
- [ ] ItemSetupModal: add combobox (Section 1) + remember alias checkbox (Section 4) — do not touch Section 3 (Save as household item)
- [ ] Extend `SaveReceiptPayload` with `alias_inserts`
- [ ] Update `saveReceipt` to call batch alias upsert after expense_splits (non-blocking on failure)
- [ ] Update settings CRUD (create/edit/delete items) to hit new household-items routes — restores full settings CRUD
- [ ] Update aliases collapsible in `ItemRulesSection`

**Verify:** second scan with same receipt text auto-matches via alias; alias row in DB; settings CRUD works; shopping autocomplete unaffected.

### Phase 3 — AI prompt + suggestion UI

- [ ] Raise `RECEIPT_ANALYSIS_MAX_TOKENS` from 512 to 1800 in `lib/config.ts`
- [ ] Extend `RECEIPT_ANALYSIS_SYSTEM_PROMPT` with `normalized_name` + `match_candidates` output spec
- [ ] Update `analyzeReceipt` to accept and pass item catalog (canonical names, created_at DESC order, cap 80)
- [ ] Update analyze route to load catalog from `getHouseholdItemsForHousehold` before calling `analyzeReceipt`
- [ ] Map AI fields into `LineItemConfig` — apply client-side candidate validation (filter against loaded catalog) before populating `aiCandidates`
- [ ] AI chips in modal (Section 1 AI row)

**Verify:** AI labeled; candidates only show items that exist in catalog; alias not saved without remember + receipt Save.

### Phase 4 — Cleanup

- [ ] Remove `/api/finances/item-rules/**` routes
- [ ] Remove `getItemRulesForHousehold` from `lib/services/finances.ts` (or leave stub redirecting to householdItems service during a brief transition)
- [ ] Verify shopping autocomplete still hits the original search route and is unaffected by any changes
- [ ] Remove dead types: `HouseholdItemRule` from `lib/types/finances.ts`
- [ ] Remove any remaining references to `saveAsHouseholdItem` if they were part of old item-rules flow (not the modal checkbox — leave that)

---

## Testing checklist

- [ ] Existing `household_items` rows still exact-match by name after migration
- [ ] Migrated rules visible in settings with category + splits; image_url preserved on collision rows
- [ ] New item has zero aliases until first receipt mapping
- [ ] Remember checkbox queues alias; alias is flushed only at receipt Save (not on modal Next/Done)
- [ ] Repeat receipt scan with same raw text auto-configures via alias match
- [ ] AI suggestion visible, labeled, tappable; no alias without confirm + receipt Save
- [ ] AI chip names are all valid catalog items — no hallucinated names shown
- [ ] "Save as household item" checkbox still works exactly as before (no regression)
- [ ] Receipt save: 1 `receipts`, N `receipt_line_items`, 1 `expenses`, M `expense_splits`, optional alias upsert
- [ ] Receipt save succeeds even if alias upsert fails (non-blocking)
- [ ] Finances balances + recent activity show receipt expense
- [ ] Shopping autocomplete still returns items (search route unchanged)
- [ ] Settings CRUD (create/edit/delete items + delete alias) fully functional after Phase 2
- [ ] An item with valid splits but no `householdItemId` is NOT `configured: true`
- [ ] No hardcoded strings; no `fetch()` in components
- [ ] RLS blocks non-members from reading or writing aliases

---

## File checklist

| Action | Path |
|--------|------|
| Migration SQL | `supabase/migrations/XXXX_household_items_merge.sql` |
| New | `lib/services/householdItems.ts` |
| New | `lib/utils/itemMatching.ts` |
| New | `lib/types/householdItems.ts` |
| Edit | `lib/utils/receiptLineItems.ts` — update `withConfiguredFlags` to require `householdItemId` |
| Edit | `lib/services/receipts.ts` |
| Edit | `lib/services/finances.ts` |
| Edit | `lib/config.ts` — raise `RECEIPT_ANALYSIS_MAX_TOKENS` to 1800 |
| Edit | `lib/types/receipts.ts` — rename `matchedHouseholdItemId` → `householdItemId`, add new fields |
| Edit | `lib/types/finances.ts` — deprecate `HouseholdItemRule` |
| Edit | `components/receipts/ScanReceiptWizard.tsx` |
| Edit | `components/receipts/ItemSetupModal.tsx` |
| Edit | `app/(pages)/dashboard/[householdId]/receipts/new/page.tsx` |
| Edit | `app/(pages)/dashboard/[householdId]/finances/components/settings/ItemRulesSection.tsx` |
| Edit | `app/api/receipts/analyze/route.ts` |
| Edit | `app/api/receipts/route.ts` |
| Edit | `app/api/household-items/route.ts` — ensure existing search behavior is untouched |
| Add | `app/api/household-items/list/route.ts` — full list with aliases |
| Add | `app/api/household-items/[id]/route.ts` — PATCH + DELETE |
| Add | `app/api/household-items/[id]/aliases/route.ts` — POST single alias |
| Add | `app/api/household-items/aliases/batch/route.ts` — POST batch alias flush |
| Remove/deprecate | `app/api/finances/item-rules/**` |
| Edit | `locales/en.ts` |
| Edit | `.cursor/rules/database-schema.mdc` |

---

## Receipt → finances flow (reference)

```
Scan wizard Step 1: image → Storage (receipts bucket)
Step 2: POST /api/receipts/analyze → Claude JSON (no DB)
Step 3: matchLineItems + ItemSetupModal → LineItemConfig[]
Save: POST /api/receipts → saveReceipt():
  household_items (optional new — "Save as household item" checkbox, unchanged)
  receipts
  receipt_line_items (raw descriptions)
  expenses (ONE row, receipt total)
  expense_splits (aggregated per member)
  household_item_aliases (NEW batch upsert — non-blocking on failure)

Finances Overview:
  Balances ← expense_splits (unsettled)     ← receipt expenses INCLUDED
  Upcoming Bills ← recurring_expenses only  ← receipt expenses NOT included
  Recent Activity ← expenses + splits       ← receipt expenses INCLUDED

Receipts ledger page ← receipts + category from linked expense (no per-member splits)
```

---

## Cursor Plan one-liner

> Implement `docs/plan-household-items-aliases-receipts.md`. Follow project rules in CLAUDE.md. Do not skip migration or RLS. Keep UI compact per spec. Do not run supabase commands — produce a SQL file for manual execution in the Supabase dashboard.

---

*Last updated: 2026-05-24 — revised after full review: fixed token limit, itemMatching location (utils not services), shopping route conflict, batch alias route, precise normalization spec, migration conflict rules, `withConfiguredFlags` update, `display_text` NOT NULL, `source` column deferred to v2, "Save as household item" preserved, inline item creation removed from combobox, alias flush timing clarified to receipt Save only.*

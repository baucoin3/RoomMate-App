# Plan: Remove Catalog from AI Prompt — Probable Names + In-App Matching

## Problem

The current receipt analysis flow sends up to 80 `household_items` names to Claude so it can return `match_candidates` pointing back to exact catalog names. This is bad design:

1. Input tokens grow with every new household item (up to the 80-item cap).
2. The 80-item cap silently drops older items — matching gets worse as the catalog grows, not better.
3. Claude is doing live fuzzy matching work that the `household_item_aliases` table already exists to do persistently.
4. The catalog names add cost on every scan, even after aliases have learned the exact mapping.

## Goal

- Claude returns **3–5 probable common household names** per line item (e.g. "EXCEL SPEARMINT" → `["gum", "chewing gum", "mint gum"]`).
- Categories stay in the prompt — cheap (≤20 names), genuinely useful for category suggestion.
- In-app matching tries each probable name **case-insensitively** against `household_items.name`.
- A match pre-fills the item in the UI with `matchSource = 'ai'` (user still confirms).
- Non-matching probable names are shown as un-clickable hint chips so the user knows what to create/search.
- Once the user confirms, the alias is saved. Future scans of the same receipt text auto-match via the alias table — no AI involvement needed.

## Match Priority Order (unchanged in spirit)

1. **exact_name** — `normalizeReceiptText(description)` === `normalizeReceiptText(item.name)` → `matchSource = 'catalog'`, auto-confirmed.
2. **alias** — normalized description found in `household_item_aliases.alias_text` → `matchSource = 'alias'`, auto-confirmed.
3. **ai** (NEW) — one of Claude's `probable_names` matches a `household_items.name` case-insensitively → `matchSource = 'ai'`, pre-filled but user must confirm.
4. **fuzzy** — local token overlap score ≥ 0.3 → `matchSource = 'fuzzy'`, pre-filled, user must confirm.
5. **none** — no match → blank, user types/creates.

---

## Files Changed

### 1. `lib/config.ts`

**Remove:**
- `RECEIPT_AI_CATALOG_ITEM_CAP` constant
- `RECEIPT_CATALOG_WITH_OPTIONS` function
- `RECEIPT_CATALOG_NONE` string

**Update `RECEIPT_ANALYSIS_SYSTEM_PROMPT`:**

Replace the `match_candidates` instruction with `probable_names`. The new shape per line item:

```
"probable_names": string[]   // 3–5 short household-friendly names, generic to specific
                              // e.g. ["gum", "chewing gum", "spearmint gum", "Excel gum"]
```

Remove the sentence: _"match_candidates max 3, only from provided catalog names — do not invent catalog items not in the list."_

Add instead: _"For each line item, return `probable_names`: an array of 3–5 short, common household names for the item, from most generic to most specific (e.g. [\"gum\", \"chewing gum\", \"spearmint gum\"]). These are used to match against the household's item catalog — prefer simple, lowercase, common vocabulary."_

---

### 2. `lib/types/receipts.ts`

**`ReceiptAnalysisLineItem`:** Remove `match_candidates`, add `probable_names`:
```ts
// Before
match_candidates?: Array<{ name: string; confidence: number }>

// After
probable_names?: string[]
```

**`LineItemConfig`:** Change `aiCandidates` type:
```ts
// Before
aiCandidates?: Array<{ name: string; confidence: number }>

// After
aiCandidates?: string[]
```

**`MatchSource`:** No change — `'catalog' | 'alias' | 'ai' | 'fuzzy' | 'manual' | null` all remain valid.

---

### 3. `lib/services/receipts.ts` — `analyzeReceipt()`

**Remove** the `catalogItemNames` parameter and all catalog-related logic:

```ts
// Before
export async function analyzeReceipt(
  imageUrl: string,
  categoryNames: string[],
  catalogItemNames: string[] = [],
): Promise<AnalyzeReceiptResult>

// After
export async function analyzeReceipt(
  imageUrl: string,
  categoryNames: string[],
): Promise<AnalyzeReceiptResult>
```

Remove:
```ts
const catalogInstruction = catalogItemNames.length > 0
  ? RECEIPT_CATALOG_WITH_OPTIONS(catalogItemNames)
  : RECEIPT_CATALOG_NONE
```

Update system prompt construction:
```ts
// Before
system: `${RECEIPT_ANALYSIS_SYSTEM_PROMPT} ${categoryInstruction} ${catalogInstruction}`

// After
system: `${RECEIPT_ANALYSIS_SYSTEM_PROMPT} ${categoryInstruction}`
```

---

### 4. `app/api/receipts/analyze/route.ts`

Remove the `getHouseholdItemCatalogNames` import and its DB call. Simplify from `Promise.all` of two queries to a single categories query:

```ts
// Before
const [{ data: categories, error: catError }, { data: catalogNames, error: catalogError }] =
  await Promise.all([
    supabase.from('expense_categories').select('id, name').eq('household_id', household_id),
    getHouseholdItemCatalogNames(supabase, household_id),
  ])
if (catalogError) { ... }
const { data, notReceipt } = await analyzeReceipt(image_url, categoryNames, catalogNames ?? [])

// After
const { data: categories, error: catError } = await supabase
  .from('expense_categories')
  .select('id, name')
  .eq('household_id', household_id)
const { data, notReceipt } = await analyzeReceipt(image_url, categoryNames)
```

---

### 5. `lib/services/householdItems.ts`

**Remove** `getHouseholdItemCatalogNames()` entirely — it is no longer called anywhere.

Also remove the `RECEIPT_AI_CATALOG_ITEM_CAP` import from `lib/config`.

---

### 6. `components/receipts/ScanReceiptWizard.tsx`

#### Remove `filterAiCandidates()`

This function filtered Claude's catalog-matched candidates to only include names that exist in `householdItems`. It's no longer needed because the matching now happens in `matchLineItems`.

#### Update `matchLineItems()`

**Remove** the `filterAiCandidates` call.

**Add** in-app probable name matching between the alias check and the fuzzy fallback:

```ts
// NEW: match Claude's probable_names case-insensitively against household item names
const probableNames = item.probable_names ?? []
const aiMatchedItem = probableNames.reduce<HouseholdItem | null>((found, name) => {
  if (found) return found
  return householdItems.find(
    (i) => i.name.toLowerCase() === name.toLowerCase()
  ) ?? null
}, null)

if (match.matchType === 'exact_name') {
  matchSource = 'catalog'
  resolvedItemName = householdItems.find((i) => i.id === match.itemId)?.name ?? null
  configured = true
} else if (match.matchType === 'alias') {
  matchSource = 'alias'
  resolvedItemName = householdItems.find((i) => i.id === match.itemId)?.name ?? null
  configured = true
} else if (aiMatchedItem) {
  householdItemId = aiMatchedItem.id
  matchSource = 'ai'
  resolvedItemName = aiMatchedItem.name
  // configured stays false — user must confirm
} else if (match.matchType === 'fuzzy' && match.candidates.length > 0) {
  householdItemId = match.candidates[0].itemId
  matchSource = 'fuzzy'
  resolvedItemName = match.candidates[0].name
  // configured stays false
}
```

Store all `probable_names` in `aiCandidates` (the full list, not just the matched one — the UI uses them as hints):

```ts
// Before
aiCandidates,   // was filterAiCandidates(item.match_candidates, householdItems)

// After
aiCandidates: probableNames,  // string[] from Claude
```

---

### 7. `components/receipts/ItemSetupModal.tsx`

**Update `showAiRow`** — no logic change needed; the condition already hides it for `'catalog'` and `'alias'` matches. It still correctly shows when `matchSource === 'ai'` (so user can pick a different candidate) or `null` (so user sees hints).

**Update the AI chip rendering** — `aiCandidates` is now `string[]`, not `{name, confidence}[]`. For each name:
- If it matches a household item (case-insensitive) → clickable chip, calls `selectHouseholdItem(item, 'ai')`
- If no match → un-clickable grey chip (pre-fills the search input with that name so user can search/create)

```tsx
// Before
{(current.aiCandidates ?? []).map((candidate) => {
  const item = householdItems.find((i) => i.name === candidate.name)
  if (!item) return null
  return (
    <button key={candidate.name} onClick={() => selectHouseholdItem(item, 'ai')} ...>
      {RECEIPTS.ITEM_SETUP.AI_CHIP(candidate.name, candidate.confidence)}
    </button>
  )
})}

// After
{(current.aiCandidates ?? []).map((name) => {
  const item = householdItems.find((i) => i.name.toLowerCase() === name.toLowerCase())
  if (item) {
    return (
      <button key={name} type="button" onClick={() => selectHouseholdItem(item, 'ai')} ...>
        {name}
      </button>
    )
  }
  return (
    <button
      key={name}
      type="button"
      onClick={() => { setItemSearch(name); setShowItemDropdown(true) }}
      className="... opacity-60 cursor-default ..."  // visually distinct — hint, not a match
    >
      {name}
    </button>
  )
})}
```

The un-clickable chips pre-fill the search box — user can then see "gum" in the search, find their "Gum" item (or create it if it doesn't exist yet).

---

### 8. `locales/en.ts`

**Update `AI_CHIP`** — remove the confidence parameter (no confidence scores in the new output):

```ts
// Before
AI_CHIP: (name: string, confidence: number) => `${name} · ${Math.round(confidence * 100)}%`

// After
AI_CHIP: (name: string) => name
```

Since the chip text is now just the name, the function becomes a passthrough — you may choose to inline the name directly in the JSX instead and remove `AI_CHIP` entirely. Either is fine.

---

## What Does NOT Change

- `matchLineToHouseholdItem()` in `lib/utils/itemMatching.ts` — untouched.
- Alias save logic in `saveReceipt()` — untouched.
- `rememberAlias` behavior — `matchSource === 'ai'` still triggers rememberAlias.
- The `'catalog'` match source — still used for local exact-name matches (description === item name).
- All split logic, category logic, wizard steps — untouched.
- The `showAiRow` visibility condition — no change needed.
- `ScanReceiptWizard` props — `householdItems` is still passed in and used.

---

## Token Cost Comparison

| Scenario | Before | After |
|---|---|---|
| 5 categories, 10 items | ~120 extra tokens | ~60 tokens (categories only) |
| 5 categories, 80 items | ~600 extra tokens | ~60 tokens |
| 5 categories, 200 items | ~600 tokens (capped, matches degrade) | ~60 tokens |

---

## Cold Start Behaviour (New Household)

First scan: alias table is empty, no AI catalog match possible. Claude returns `probable_names`. If any match a household item name → pre-fill. If not → hint chips show the name so user knows to create "Gum". User confirms → alias saved. Second scan of same item → alias match (auto, no prompt).

This is slightly more work on the first scan per item but strictly better from the second scan onward.

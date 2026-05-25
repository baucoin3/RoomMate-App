# Item Setup Modal — Redesign Plan
**Date:** May 25, 2025  
**Branch target:** `Update-prompt-to-be-simple`  
**Files in scope:** `components/receipts/ItemSetupModal.tsx`, `components/receipts/ScanReceiptWizard.tsx`, `lib/utils/receiptLineItems.ts`, `lib/types/receipts.ts`, `locales/en.ts`, `app/api/receipts/route.ts` (or wherever receipts POST is handled), `lib/services/receipts.ts`

---

## Analysis of request (point form)

- **Household item match = smart dropdown**, pre-filtered by any word found in any AI candidate name; user can still type to override filter; dropdown always has an "Add as new item" option at bottom when typed text has no exact match
- **AI suggestion chips** should be bold/bright (full violet, not faded); clicking any chip — matched or not — does something useful: matched item → select it; unmatched → prefill search box + activate "save as new item" mode
- **Two-tab layout per item** — mutually exclusive: "By Household Item" vs "By Category" — because a split is logically either tied to an item or to a category, not both; if set up by item the category is already known (from `item.default_category_id`)
- **"Save as household item" toggle** moves inside the "By Household Item" tab (directly below match+chips), not buried at the bottom under categories
- **When creating a new household item**, all `aiCandidates` for that line item are saved as aliases on that new item (so future receipts auto-match); the configured split (custom overrides or category default) is passed as `split_overrides` on the new item
- **Remove "AI" status pill** from step-3 line item cards — it conveys no useful information; items with `matchSource === 'ai'` or `aiCandidates.length > 0` should show "Setup" (amber) instead, same as other unconfigured items

---

## Detailed change plan

### Change 1 — Remove "AI" pill from step-3 line item cards

**Problem:** `getLineItemStatus` returns `'ai'` for any item where `matchSource === 'ai' || matchSource === 'fuzzy' || aiCandidates.length > 0`, which renders a purple "AI" badge on the card in `ScanReceiptWizard` step 3. This is noise — the user doesn't need to know the match method on the card.

**Files:**
- `lib/utils/receiptLineItems.ts`
- `lib/utils/receiptLineItems.ts` → `lineItemStatusPillClass`
- `locales/en.ts` → `RECEIPTS.ITEM_SETUP.STATUS_AI` (can be removed or repurposed)

**Changes:**
1. In `getLineItemStatus`: remove the `'ai'` / `'fuzzy'` branch — fall through to existing `matched` or `setup` logic based on whether the item has a valid split assignment
2. Remove the `case 'ai':` from `lineItemStatusLabel` and `lineItemStatusPillClass`
3. Remove `STATUS_AI` from locales (or keep for now and just stop using it — cleanup later)
4. The `'ai'` type can be removed from `LineItemStatus` union once unused
5. In `ItemSetupModal` header: `MATCH_BADGE_AI` badge (the small "AI" chip next to the "Match to household item" label) — remove it. The `matchBadgeLabel` function can return `null` for `'ai'` source, so no badge renders.

---

### Change 2 — Two-tab layout: "By Household Item" vs "By Category"

**Problem:** The current modal branches on `isKnownItem` (already matched) vs not, mixing "category override" into the known-item flow. The user wants an explicit choice: configure this line item by household item OR by category — not both simultaneously.

**Files:**
- `lib/types/receipts.ts` — add `setupMode` field to `LineItemConfig`
- `components/receipts/ItemSetupModal.tsx` — replace isKnownItem branching with tab UI
- `components/receipts/ScanReceiptWizard.tsx` — seed `setupMode` when building initial configs in `matchLineItems`

**Type change (`lib/types/receipts.ts`):**
```ts
export type SetupMode = 'item' | 'category'

export interface LineItemConfig {
  // ... existing fields
  setupMode: SetupMode   // add this
}
```

**Seeding logic in `ScanReceiptWizard.matchLineItems`:**
- If `matchSource === 'catalog' || matchSource === 'alias'` → `setupMode: 'item'`
- If `aiCandidates.length > 0 || matchSource === 'ai' || matchSource === 'fuzzy'` → `setupMode: 'item'` (AI is trying to link to an item)
- If no match at all and no AI candidates → `setupMode: 'category'`

**Tab UI in `ItemSetupModal`:**
- Two pill-style tabs at the top of the content area: `By Household Item` | `By Category`
- Switching tabs via `updateCurrent({ setupMode: 'item' | 'category' })` — also resets conflicting state:
  - Switch to 'item': clear `categoryId` (item's default_category_id will be used), clear `useCustomSplit`
  - Switch to 'category': clear `householdItemId`, `resolvedItemName`, `matchSource`

**"By Household Item" tab content (in order):**
1. Match dropdown (see Change 3)
2. AI chips row (see Change 4)
3. "Save as household item" toggle (see Change 5) — only shown when no `householdItemId`
4. If `householdItemId` set: split preview (derived from item's category/overrides) — read-only, no override needed here
5. Remember alias checkbox (existing)

**"By Category" tab content (in order):**
1. Category selector + add new category inline
2. Split preview with custom-split toggle + SplitEditor (existing logic, unchanged)

**Validation:** 
- `hasValidSplitAssignment` already handles both paths correctly — no changes needed there
- `currentValid` in modal: remove the `householdItemId !== null` requirement — for category tab, valid = has a category with valid splits OR useCustomSplit with valid splits OR equal split (memberCount > 0). For item tab, keep requiring `householdItemId`.

---

### Change 3 — Household item dropdown pre-filtered by AI words

**Problem:** Currently `filteredItems` filters by `itemSearch` text only. When `aiCandidates` exist, the dropdown should surface relevant items even before the user types anything.

**Files:**
- `components/receipts/ItemSetupModal.tsx` — update `filteredItems` useMemo

**Logic:**
```ts
const filteredItems = useMemo(() => {
  const q = itemSearch.trim().toLowerCase()

  // If user has typed something, use normal search
  if (q) {
    return householdItems.filter((item) => {
      if (item.name.toLowerCase().includes(q)) return true
      return (item.aliases ?? []).some((a) => a.display_text.toLowerCase().includes(q))
    })
  }

  // No search text — if AI candidates exist, pre-filter by any word from any candidate
  const aiWords = (current.aiCandidates ?? [])
    .flatMap((name) => name.toLowerCase().split(/\s+/))
    .filter(Boolean)

  if (aiWords.length > 0) {
    const wordMatches = householdItems.filter((item) =>
      aiWords.some((word) => item.name.toLowerCase().includes(word))
    )
    // Return word-matched items first, then the rest
    const rest = householdItems.filter((item) => !wordMatches.includes(item))
    return [...wordMatches, ...rest]
  }

  return householdItems
}, [householdItems, itemSearch, current.aiCandidates])
```

**"Add as new item" option at bottom of dropdown:**
- When dropdown is open and `itemSearch.trim()` has text that doesn't exactly match any item name, render a final `<li>` option: `+ Add "${itemSearch}" as new item`
- Clicking it: set `resolvedItemName = itemSearch`, `saveAsHouseholdItem = true`, close dropdown, stay in 'item' tab
- This gives the user a fast path to create a new item without leaving the tab

---

### Change 4 — AI chip visual overhaul + click behavior

**Problem:** Chips are dim and low-contrast. Unmatched chips are faded and `cursor-default` (doing nothing useful). Both should be bold and actionable.

**Files:**
- `components/receipts/ItemSetupModal.tsx` — chip rendering in `showAiRow` section

**Visual:**
- All chips: `border border-violet-400 bg-violet-500/20 text-violet-100 font-semibold hover:bg-violet-500/35 transition-colors`
- Matched chips (item exists in catalog): add a subtle checkmark icon or keep as-is but same styling
- No more `opacity-60 cursor-default` for unmatched chips

**Click behavior for unmatched chip (item NOT in householdItems):**
```ts
onClick={() => {
  setItemSearch(name)
  updateCurrent({
    resolvedItemName: name,
    saveAsHouseholdItem: true,
    householdItemId: null,
    matchSource: 'ai',
  })
  setShowItemDropdown(true)  // open dropdown so user can also pick existing
}}
```
This prefills the search with the AI name AND flags save-as-new-item, but still lets the dropdown open in case there's a close match they want to pick instead.

**Click behavior for matched chip (item exists):**
- Same as today: `selectHouseholdItem(item, 'ai')` — no change needed

---

### Change 5 — Move "Save as household item" toggle + wire up split_overrides and aliases

**Problem A — Placement:** Toggle is at the bottom of the modal, below all the category/split stuff. It logically belongs in the "By Household Item" tab, right after the match section.

**Problem B — Split not passed through:** When `saveAsHouseholdItem = true`, `handleSave` in `ScanReceiptWizard` builds `new_household_items` as `{ name, default_category_id }` — no `split_overrides`. The household item is created with no split config, defeating the purpose.

**Problem C — AI aliases not attached:** AI candidates (`aiCandidates`) are never saved as aliases on the new item. Future receipts won't benefit from the AI suggestions.

**Files:**
- `components/receipts/ItemSetupModal.tsx` — move toggle into "By Household Item" tab
- `lib/types/receipts.ts` — extend `SaveReceiptPayload.new_household_items`
- `components/receipts/ScanReceiptWizard.tsx` — update `handleSave` to pass `split_overrides` and `initial_aliases`
- `app/api/receipts/route.ts` (POST handler) — handle `initial_aliases` when creating new household items
- `lib/services/receipts.ts` (if creation is delegated there) — create aliases in same transaction/batch

**Type change (`lib/types/receipts.ts`):**
```ts
// in SaveReceiptPayload
new_household_items?: Array<{
  name: string
  default_category_id: string | null
  split_overrides?: { member_id: string; percentage: number }[] | null
  initial_aliases?: string[]   // raw receipt text + aiCandidates
}>
```

**`handleSave` in ScanReceiptWizard:**
```ts
const newHouseholdItems = configsToSave
  .filter((c) => c.saveAsHouseholdItem && !c.householdItemId)
  .map((c) => ({
    name: c.resolvedItemName ?? c.description,
    default_category_id: c.categoryId,
    split_overrides: c.useCustomSplit && c.customSplits.length > 0
      ? c.customSplits.map((s) => ({ member_id: s.household_member_id, percentage: s.percentage }))
      : null,
    initial_aliases: [
      // Always include the raw receipt description
      c.description,
      // Include all AI candidates (deduplicated, excluding the canonical name itself)
      ...(c.aiCandidates ?? []).filter(
        (a) => a.toLowerCase() !== (c.resolvedItemName ?? c.description).toLowerCase()
      ),
    ].filter(Boolean),
  }))
```

**API / service layer:**
- After creating each new household item (via `createHouseholdItem`), batch-insert its `initial_aliases` into `household_item_aliases` table using the new item's `id`
- Can reuse existing `/api/household-items/aliases/batch` route pattern or do it inline in the receipts POST service
- Keep within a single try/catch; alias creation failure should not fail the whole save (log and continue)

---

### Change 6 — "Save as household item" toggle UX in item tab

**Placement (inside "By Household Item" tab):**
- Shown only when: `setupMode === 'item'` AND `householdItemId === null` (no existing item matched)
- Position: directly below the search input + AI chips, before the split preview
- When checked: `saveAsHouseholdItem = true` — split below it shows what split will be saved to the new item (preview + optional custom override via toggle)
- When `householdItemId !== null`: show "Already in catalog" note (existing behavior, moved into item tab)

---

## Summary of file changes

| File | Changes |
|------|---------|
| `lib/types/receipts.ts` | Add `setupMode: SetupMode` to `LineItemConfig`; extend `new_household_items` in `SaveReceiptPayload` with `split_overrides` and `initial_aliases` |
| `lib/utils/receiptLineItems.ts` | Remove `'ai'` status from `getLineItemStatus`; remove `case 'ai'` from `lineItemStatusLabel` and `lineItemStatusPillClass`; remove from `LineItemStatus` union |
| `locales/en.ts` | Remove `STATUS_AI`, `MATCH_BADGE_AI`; add strings for tab labels and "Add as new item" dropdown option |
| `components/receipts/ItemSetupModal.tsx` | Two-tab layout; smart dropdown; bold AI chips + new click behavior; move "Save as household item" into item tab; remove AI match badge from header |
| `components/receipts/ScanReceiptWizard.tsx` | Seed `setupMode` in `matchLineItems`; update `handleSave` to include `split_overrides` and `initial_aliases` on new household items |
| `app/api/receipts/route.ts` (POST) | Handle `initial_aliases` on `new_household_items` — batch-insert aliases after item creation |
| `lib/services/receipts.ts` | If `saveReceipt` handles item creation, add alias batch creation there |

---

## Implementation order

1. **`lib/types/receipts.ts`** — type changes first (unblocks everything downstream)
2. **`lib/utils/receiptLineItems.ts`** — remove AI status (isolated, low risk)
3. **`locales/en.ts`** — add/remove strings
4. **`components/receipts/ScanReceiptWizard.tsx`** — seed `setupMode` in `matchLineItems` + update `handleSave`
5. **`components/receipts/ItemSetupModal.tsx`** — full UI rework (tabs, dropdown, chips, toggle placement)
6. **API / service layer** — alias batch creation on new household items


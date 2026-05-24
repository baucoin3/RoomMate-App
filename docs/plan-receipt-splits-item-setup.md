# Plan: Receipt splits UX + item setup fixes

Use this document as a **Cursor Plan** prompt for a focused implementation pass. It does **not** include alias matching, AI suggestions, or per-item API writes while scrolling (see `docs/plan-household-items-aliases-receipts.md` for that later work).

**Supabase project ID:** `inbexkcbkoilfpuwctkx`

---

## Product decisions (locked)

| Decision | Choice |
|----------|--------|
| Equal split with **no category** | **Allowed** — one-off receipt lines should not force category creation |
| Category on line items | **Optional** — user can add when they want; not required to save |
| Household catalog (`saveAsHouseholdItem`) | **Deferred to Save expense** — no `POST` per line while paging through items |
| Default category for new household items | Use line’s `categoryId` when present; `null` is OK if user didn’t pick one |
| Phase C (immediate DB on “save as item”) | **Out of scope** for this pass |

---

## Problem summary

1. **Stale React state** in `ItemSetupModal` — `handleFooterButton` / `handleClose` read `localConfigs` from closure; category and checkbox changes can be lost on Next/Done.
2. **`isLineItemConfigured` too strict** — equal split is shown in the modal but lines stay **Unassigned** without a category; Save expense is blocked (`SPLITS_REQUIRED`).
3. **Confusing copy** — “Save as household item” feels like it “assigns” the line; it only queues catalog insert on final save.
4. **Step 3 list lacks split detail** — users cannot see per-person amounts without opening Configure items.

---

## Project constraints (must follow)

- All user-facing strings → `locales/en.ts` (`RECEIPTS.*`)
- Client HTTP → `apiClient` only; no `fetch()` in `components/`
- Shared logic → `lib/utils/` (not duplicated in modal + wizard)
- Route handlers stay thin; receipt save logic stays in `lib/services/receipts.ts`
- Reference: `CLAUDE.md`, `.cursor/rules/`

---

## Target behavior

### “Configured” / save eligibility

A line item is **configured** when **any** of:

- `matchedHouseholdItemId !== null` (catalog / rule match), or
- `categoryId !== null`, or
- `useCustomSplit === true` and custom splits sum to 100% (±0.01), or
- **Default equal split** applies: `!useCustomSplit`, no category, no catalog match, and `allMembers.length > 0`

A line is **not** configured only when there are **no members** to split among (edge case — show error or block save with clear message).

### Step 3 line list

Each row shows:

- Description, amount (existing)
- Status pill (update labels — see locales)
- **New:** right-aligned sub-line under amount/status, e.g. `Alex $4.20 · Sam $3.80` (truncate if many members)

User can **Save expense** when all lines are configured (including implicit equal split).

### Item setup modal

- Fix state persistence on Next / Done / Close (functional updates).
- Keep **Save as household item** as a **local toggle** (checkbox or toggle button styling) — copy must say it applies when you **save the expense**, not immediately.
- Split preview unchanged in modal; status pill should reflect **Default split** when equal split applies.

### Save expense (unchanged batch model)

On `handleSave` in `ScanReceiptWizard.tsx`:

- `new_household_items` from lines where `saveAsHouseholdItem && !matchedHouseholdItemId`
- `default_category_id: c.categoryId` (may be `null`)
- `computeAggregateSplits` must use the **same** split resolver as the UI (shared helper)

**Improvement:** If `household_items` insert fails in `saveReceipt`, return error to client (do not only `console.error`).

---

## Implementation phases

### Phase 1 — Shared split resolver + configured rules

**New / updated file:** `lib/utils/receiptLineItems.ts`

Add types (or import from `lib/types/receipts.ts`):

```ts
export interface SplitResolverContext {
  categories: Array<{
    id: string
    splits: Array<{ household_member_id: string; percentage: number; nickname: string | null }>
  }>
  allMembers: Array<{ id: string; name: string }>
}

export function getEqualSplitPercentage(memberCount: number): number

export function getSplitsForLineItem(
  config: LineItemConfig,
  ctx: SplitResolverContext,
): LineItemSplitRow[]

export function usesDefaultEqualSplit(
  config: LineItemConfig,
  memberCount: number,
): boolean
```

**Update `isLineItemConfigured`:**

```ts
export function isLineItemConfigured(
  c: LineItemConfig,
  memberCount: number,
): boolean {
  if (c.matchedHouseholdItemId !== null) return true
  if (c.categoryId !== null) return true
  if (c.useCustomSplit) {
    const total = c.customSplits.reduce((sum, row) => sum + row.percentage, 0)
    return c.customSplits.length > 0 && Math.abs(total - 100) <= 0.01
  }
  return memberCount > 0 // implicit equal split
}
```

**Update `getLineItemStatus`:**

| Status | When |
|--------|------|
| `auto` | `matchedHouseholdItemId !== null` |
| `set_up` | configured and not `auto` |
| `unassigned` | `!isLineItemConfigured(c, memberCount)` |

Consider renaming locale **Unassigned** → **Needs setup** only when `memberCount === 0`; when members exist but no category, show **Default split** as a distinct visual (optional: add status `'default_split'` or reuse `set_up` with different label).

**Refactor `computeAggregateSplits` in `ScanReceiptWizard.tsx`** to call `getSplitsForLineItem` instead of inlined logic.

**Call sites to pass `memberCount` / `allMembers.length`:**

- `ScanReceiptWizard.tsx` — `unassignedCount`, `handleSave`, `matchLineItems` initial `configured` flags
- `ItemSetupModal.tsx` — dots, status pill, `persistCurrentItem`
- `withConfiguredFlags` — extend signature: `withConfiguredFlags(configs, memberCount)`

**Acceptance:**

- [ ] Line with no category, no custom split, 2+ members → configured → Save enabled
- [ ] Line with custom split at 99% → not configured
- [ ] Aggregate splits on save match preview on list

---

### Phase 2 — Fix `ItemSetupModal` stale state

**File:** `components/receipts/ItemSetupModal.tsx`

Replace closure-based reads in:

- `handleFooterButton`
- `handleClose`

**Pattern:**

```ts
function commitCurrentAndAdvance(action: 'next' | 'done' | 'close') {
  setLocalConfigs((prev) => {
    const updated = withConfiguredFlags(
      persistCurrentItemAtIndex(prev, idx),
      allMembers.length,
    )
    if (action === 'done' || action === 'close') {
      onSave(updated, idx)
    }
    return updated
  })
  if (action === 'next') navigateItem(idx + 1, 'forward')
}
```

Extract `persistCurrentItemAtIndex(configs, index)` so index is explicit (avoid relying on stale `idx` in async paths).

Ensure `navigateItem` still uses functional `setLocalConfigs((prev) => …)` before changing `idx`.

**Acceptance:**

- [ ] Select category → immediately tap Next → parent list shows category / Set up, not Unassigned
- [ ] Toggle “Save as household item” → Done → parent state retains flag
- [ ] Close (✕) persists current item same as Done

---

### Phase 3 — Step 3 split preview row

**File:** `components/receipts/ScanReceiptWizard.tsx` (line items block ~676–720)

Add helper (can live in `receiptLineItems.ts`):

```ts
export function formatLineItemSplitSummary(
  splits: LineItemSplitRow[],
  amount: number,
  maxMembers?: number, // default 3
): string
```

Example output: `Alex $4.20 · Sam $3.80` or `Alex $4.20 · +2 more`

**Layout:**

```
[✓] Description                    $12.34  [Default split]
    Category name (if any)         Alex $6.17 · Sam $6.17
```

- Sub-line: `text-xs text-white/40`, right-aligned, below amount + pill (flex-col on right column).
- If `usesDefaultEqualSplit`, optional muted prefix from locale: `(RECEIPTS.LABELS.DEFAULT_SPLIT_PREFIX)` — keep short.

**Locales** (`locales/en.ts`):

```ts
RECEIPTS: {
  LABELS: {
    LINE_ITEM_SPLIT_SUMMARY: ... // or formatter fn
  },
  ITEM_SETUP: {
    STATUS_DEFAULT_SPLIT: 'Default split',
    SAVE_AS_ITEM_HINT: 'Adds this item to your household catalog when you save the expense.',
    // clarify SAVE_AS_ITEM_LABEL if needed
  },
  ERRORS: {
    SPLITS_REQUIRED: 'All items need a valid split before saving.', // soften if needed
    NO_MEMBERS_FOR_SPLITS: 'Add household members with category splits before saving receipts.',
  },
}
```

**Acceptance:**

- [ ] Every line shows per-member dollar amounts without opening modal
- [ ] Equal-split lines show Default split (or Set up) and correct amounts
- [ ] Configure items hint count only includes truly unconfigured lines

---

### Phase 4 — UI copy + household item toggle (no new API)

**File:** `components/receipts/ItemSetupModal.tsx`

- Keep checkbox **or** restyle as toggle button — must remain **local state only**.
- Update hint: catalog write happens on **Save expense**, not on Next/Done.
- Disable toggle optional: only when `matchedHouseholdItemId` already set (already in catalog) — hide or show “Already in catalog”.

**File:** `lib/services/receipts.ts`

```ts
if (itemError) return { data: null, error: itemError.message } // fail save, don't swallow
```

**Acceptance:**

- [ ] User understands checkbox does not hit DB until Save expense
- [ ] Failed household_items insert blocks save with visible error

---

## Files to touch (checklist)

| File | Changes |
|------|---------|
| `lib/utils/receiptLineItems.ts` | Split resolver, configured rules, format helper, status |
| `lib/types/receipts.ts` | Only if new status union needed |
| `components/receipts/ScanReceiptWizard.tsx` | List UI, `computeAggregateSplits`, memberCount passed everywhere |
| `components/receipts/ItemSetupModal.tsx` | Stale state fix, pass memberCount to utils |
| `lib/services/receipts.ts` | Propagate household_items insert error |
| `locales/en.ts` | New/changed `RECEIPTS.*` strings |

**Do not create** in this pass:

- `POST /api/household-items` for per-line create
- `household_item_aliases` migration
- Changes to `docs/plan-household-items-aliases-receipts.md` scope

---

## Testing plan (manual)

1. **Happy path — no modal**
   - Scan receipt with 2+ members (categories optional).
   - Step 3: all lines show default split amounts.
   - Save expense succeeds without opening Configure items.

2. **Modal category**
   - Open Configure items → pick category → Next through all → Done.
   - List shows category name + correct split amounts.
   - Save succeeds.

3. **Stale state regression**
   - Pick category → tap Next within 100ms → line must stay configured on parent list.

4. **Custom split**
   - Enable custom split, set 50/50 → configured.
   - Set 40/50 → not configured, Save disabled.

5. **Household item deferred**
   - Check “Save as household item” on 2 lines → Save expense.
   - Verify 2 rows in `household_items` (Supabase dashboard).
   - Re-scan: exact name match → Auto status.

6. **No members edge**
   - Household with categories but empty `category_splits` / no members in `allMembers` — document expected behavior; show `NO_MEMBERS_FOR_SPLITS` if save blocked.

---

## Implementation order

```
Phase 1 (utils + configured rules + aggregate refactor)
    → Phase 2 (modal stale state)
    → Phase 3 (step 3 list split row)
    → Phase 4 (copy + saveReceipt error)
```

Run `tsc --noEmit` or project lint after Phase 1 — signature changes ripple to all call sites.

---

## Out of scope (explicit)

- Per-line `POST` while scrolling modal (Phase C from earlier discussion)
- Item combobox, aliases, AI match chips (`plan-household-items-aliases-receipts.md`)
- Changing expense model (still 1 expense per receipt, aggregated splits)
- RLS on `household_items` (existing tech debt)

---

## Cursor prompt (paste to start work)

```
Implement docs/plan-receipt-splits-item-setup.md Phases 1–4.

Decisions: allow equal splits without category; household items stay batch-inserted on Save expense only; fix ItemSetupModal stale state; add per-member split summary on Step 3 line list; surface household_items insert errors on save.

Follow CLAUDE.md: locales/en.ts for strings, no fetch in components, shared logic in lib/utils/receiptLineItems.ts.
```

# Plan: Receipt split editor fixes — reuse SplitEditor, validation, confirm toggle

Use this document as a **Cursor Plan** prompt for a focused implementation pass. It addresses bugs and UX gaps found after the initial receipt-splits work (`docs/plan-receipt-splits-item-setup.md` Phases 1–4, largely implemented).

**Supabase project ID:** `inbexkcbkoilfpuwctkx`

---

## Relationship to prior work

The following are **already done** — do not re-implement unless regressions are found:

| Done | Where |
|------|--------|
| Shared split resolver | `lib/utils/receiptLineItems.ts` — `getSplitsForLineItem`, `hasValidSplitAssignment`, `isLineItemConfirmed`, etc. |
| Stale modal state fix | `ItemSetupModal.tsx` — `commitCurrentAndAdvance`, functional `setLocalConfigs` |
| Step 3 per-member split lines | `ScanReceiptWizard.tsx` — `getLineItemSplitLines` on each card |
| Confirmation vs validity split | `configured` flag (user ack) vs `hasValidSplitAssignment` (math) |
| Save blocked until all confirmed | `unconfirmedCount > 0` disables Save |

This plan fixes what is **still broken** after that pass.

---

## Problem summary

1. **Custom split does not rebalance live** — `ItemSetupModal` reimplements percentage inputs with `draftPct` + `onBlur` commit. Changing one person to 60% does not update others or dollar totals until blur; even on blur, only that member updates (no rebalance). Finances settings use `SplitEditor` with live `balanceSplits()` on every keystroke.

2. **Split UI is duplicated** — `SplitEditor` is used in Categories, Recurring, and Item Rules settings. Receipt item setup has ~80 lines of bespoke inline inputs. Behavior diverges.

3. **Split preview disappears when a category is selected** — When `selectedCat.splits` is `[]`, `displaySplits` is empty. Common for categories never configured in Finances, and **always** for categories created inline from the receipt modal (POST name only, `splits: []`).

4. **`hasValidSplitAssignment` is too permissive** — `if (c.categoryId !== null) return true` treats any category as valid even with zero splits or splits that do not sum to 100%. Users can confirm and save with meaningless splits.

5. **`allMembers` is derived from category splits, not household members** — `ScanReceiptWizard` builds members from `categories.flatMap(c => c.splits)`. If no category has splits, `memberCount === 0` and equal-split fallback breaks.

6. **Line-item cards confirm only; no unconfirm** — `handleConfirmLineItem` always sets `configured: true`. Tapping an already-confirmed card should toggle back to unconfirmed.

---

## Product decisions (locked)

| Decision | Choice |
|----------|--------|
| Custom split editing UX | **Reuse `SplitEditor`** — live rebalance on change, same as Finances settings |
| Category with **no splits configured** | **Invalid** — show equal-split preview as a hint, status **Needs setup**, cannot confirm or save |
| Category with splits **not summing to 100%** | **Invalid** — same as above |
| No category, no custom split, 2+ members | **Valid** — implicit equal split (unchanged) |
| Inline “Add category” from receipt modal | Must **persist default equal splits** via `PUT .../splits` (same as Finances settings) |
| Household members source | **`household_members` table** — not inferred from `category_splits` |
| Line-item card tap | **Toggle** confirm / unconfirm when split is valid; unconfirm always allowed |
| Save expense | Blocked when any line is unconfirmed **or** has invalid split assignment |

---

## Project constraints (must follow)

- All user-facing strings → `locales/en.ts` (`RECEIPTS.*`, reuse `FINANCES.SPLIT_EDITOR.*` where applicable)
- Client HTTP → `apiClient` only; no `fetch()` in `components/`
- Shared logic → `lib/utils/` — no duplicated rebalance math
- Reference: `CLAUDE.md`, `.cursor/rules/`

---

## Target behavior

### Split preview (modal + step 3 list)

| Scenario | Preview shown | Valid? | Confirmable? |
|----------|---------------|--------|--------------|
| No category, no custom split, members exist | Equal split per member | ✅ | ✅ |
| Category with splits summing to 100% | Category splits | ✅ | ✅ |
| Category with empty or invalid splits | Equal split (hint) + warning copy | ❌ | ❌ |
| Custom split summing to 100% | Custom splits | ✅ | ✅ |
| Custom split not summing to 100% | Custom splits + red total | ❌ | ❌ |
| Catalog match (`matchedHouseholdItemId`) | Resolved via category or equal | ✅ if resolved splits valid | ✅ |

When category splits are missing/invalid, show locale string `RECEIPTS.ITEM_SETUP.NO_SPLITS` (already exists) under the split preview.

### Custom split in modal

- Toggle **Custom split** → render shared `SplitEditor` with `totalAmount={current.amount}` and `showAmountInputs={true}`.
- Percentage change → other members and `$` amounts update **immediately** (no blur-only commit).
- Remove `draftPct` state and inline percentage inputs entirely.

### Line-item cards (Step 3)

- First tap on valid line → `configured: true` (checkmark).
- Second tap on confirmed line → `configured: false` (empty circle).
- Tap on invalid line → no-op (keep `opacity-70`, `tabIndex={-1}`).
- Optional: long-press or separate edit affordance is **out of scope** — card tap toggles only.

### Save

- `handleSave` / Save button disabled when:
  - `unconfirmedCount > 0`, **or**
  - any line fails `hasValidSplitAssignment`, **or**
  - `memberCount === 0`
- Show `RECEIPTS.ERRORS.SPLITS_REQUIRED` when user attempts save with invalid splits.

---

## Implementation phases

### Phase 1 — Shared split utilities + move `SplitEditor`

**Goal:** One split editor component and one `buildDefaultSplits` helper used everywhere.

#### 1a. New file: `lib/utils/splits.ts`

```ts
export const SPLIT_TOTAL = 100

export function roundPercentage(value: number): number
export function splitsSumTo100(splits: Array<{ percentage: number }>): boolean
export function buildDefaultSplits(
  members: Array<{ id: string }>,
): Array<{ household_member_id: string; percentage: number }>
```

- Move rebalance logic from `SplitEditor.balanceSplits` into `lib/utils/splits.ts` as `rebalanceSplits(memberId, percentage, splits)` if useful for tests; otherwise keep rebalance inside `SplitEditor` only.
- `splitsSumTo100`: `Math.abs(sum - 100) <= 0.01`

#### 1b. Move `SplitEditor` to shared location

**From:** `app/(pages)/dashboard/[householdId]/finances/components/SplitEditor.tsx`  
**To:** `components/SplitEditor.tsx`

- Update imports in:
  - `CategoriesSection.tsx`
  - `RecurringSection.tsx`
  - `ItemRulesSection.tsx`
- Replace duplicated `buildDefaultSplits` in those three files with import from `lib/utils/splits.ts`.
- `SplitEditor` props unchanged: `members`, `value`, `onChange`, `totalAmount?`, `showAmountInputs?`.

**Acceptance:**

- [ ] Finances settings pages still compile and split editing works
- [ ] No duplicated `buildDefaultSplits` in settings components

---

### Phase 2 — Load household members on receipt page

**Goal:** `allMembers` always reflects `household_members`, independent of category split configuration.

#### 2a. `app/(pages)/dashboard/[householdId]/receipts/new/page.tsx`

Add query (parallel with existing loads):

```ts
supabase
  .from('household_members')
  .select('id, nickname')
  .eq('household_id', params.householdId)
```

Map to:

```ts
members: Array<{ id: string; name: string }>  // name = nickname ?? id slice
```

Pass `members` prop to `ScanReceiptWizard`.

#### 2b. `components/receipts/ScanReceiptWizard.tsx`

- Add `members: Array<{ id: string; name: string }>` to `Props`.
- Replace derived `allMembers` from categories with `members` prop.
- Keep `memberNicknames` / `memberCount` / `splitResolverCtx.allMembers` sourced from prop.

**Acceptance:**

- [ ] Receipt wizard works when all categories have empty splits
- [ ] Paid-by dropdown lists all household members
- [ ] Equal split preview shows all members

---

### Phase 3 — Fix split validation + display fallback

**Goal:** Category alone is not enough; splits must be real.

#### 3a. `lib/utils/receiptLineItems.ts`

Add helper:

```ts
export function categoryHasValidSplits(
  categoryId: string | null,
  ctx: SplitResolverContext,
): boolean {
  if (!categoryId) return false
  const cat = ctx.categories.find((c) => c.id === categoryId)
  if (!cat || cat.splits.length === 0) return false
  return splitsSumTo100(cat.splits)
}
```

**Update `hasValidSplitAssignment`:**

```ts
export function hasValidSplitAssignment(c: LineItemConfig, memberCount: number, ctx?: SplitResolverContext): boolean {
  if (memberCount === 0) return false

  if (c.matchedHouseholdItemId !== null) {
    // Valid if we can resolve splits (category splits or equal fallback)
    if (!ctx) return true // backward compat — prefer always passing ctx
    return getSplitsForLineItem(c, ctx).length > 0 && splitsSumTo100(getSplitsForLineItem(c, ctx))
  }

  if (c.useCustomSplit) {
    return c.customSplits.length > 0 && splitsSumTo100(c.customSplits)
  }

  if (c.categoryId !== null) {
    if (!ctx) return false
    return categoryHasValidSplits(c.categoryId, ctx)
  }

  // Implicit equal split (no category)
  return memberCount > 0
}
```

**Update `getSplitsForLineItem`** — when category selected but splits empty/invalid, **still return equal split for display** (so UI never goes blank):

```ts
if (config.categoryId) {
  const cat = ctx.categories.find((c) => c.id === config.categoryId)
  if (cat && cat.splits.length > 0 && splitsSumTo100(cat.splits)) {
    return cat.splits.map(...)
  }
  // fall through to equal split for display only
}
```

**Update all call sites** to pass `splitResolverCtx` into `hasValidSplitAssignment`:

- `ScanReceiptWizard.tsx`
- `ItemSetupModal.tsx` — pass `ctx` as prop from wizard

**Update `getLineItemStatus`:**

- Category selected but invalid splits → `'unassigned'` (or new `'needs_category_splits'` — optional; `'unassigned'` + pill copy is enough)

**Acceptance:**

- [ ] Select category with no splits → preview shows equal split + `NO_SPLITS` warning, status Needs setup
- [ ] Cannot confirm that line
- [ ] Save disabled until fixed (custom split or different category or configure splits in Finances)
- [ ] Category with valid 50/50 splits → preview shows 50/50, confirmable

---

### Phase 4 — Replace inline split UI with `SplitEditor` in modal

**Goal:** Live rebalance; delete duplicated code.

#### `components/receipts/ItemSetupModal.tsx`

**Add props:**

```ts
splitResolverCtx: SplitResolverContext
```

**Remove:**

- `draftPct` state and `useEffect` that clears it
- `handleSplitChange` (single-member update)
- Inline `<input>` percentage fields in split preview block

**When `current.useCustomSplit`:**

```tsx
<SplitEditor
  members={allMembers.map((m) => ({ id: m.id, nickname: m.name }))}
  value={current.customSplits.map((s) => ({
    household_member_id: s.household_member_id,
    percentage: s.percentage,
    amount: (s.percentage / 100) * current.amount,
  }))}
  onChange={(splits) =>
    updateCurrent({
      customSplits: splits.map((s) => ({
        household_member_id: s.household_member_id,
        nickname: allMembers.find((m) => m.id === s.household_member_id)?.name ?? '',
        percentage: s.percentage,
      })),
    })
  }
  totalAmount={current.amount}
  showAmountInputs
/>
```

**When not custom split:** keep read-only rows from `getSplitsForLineItem(current, splitResolverCtx)`.

**Toggle custom split on:** seed `customSplits` from `getSplitsForLineItem(current, splitResolverCtx)` (not stale `displaySplits` closure).

**Category change (`handleCategoryChange`):**

- Set `categoryId`, `useCustomSplit: false`
- Do **not** overwrite `customSplits` with empty array — or reset to `getSplitsForLineItem` result for when user toggles custom later

**Show warning** when `current.categoryId && !categoryHasValidSplits(...)`:

```tsx
<p className="text-xs text-amber-400">{RECEIPTS.ITEM_SETUP.NO_SPLITS}</p>
```

**Disable footer Next/Done** when current item fails `hasValidSplitAssignment(current, memberCount, splitResolverCtx)` — optional but recommended; at minimum show status pill as Needs setup.

**Acceptance:**

- [ ] Type 60 in one member's % → others rebalance immediately, totals update live
- [ ] Dollar amounts update live alongside percentages
- [ ] Custom split 40/50 → footer disabled or status shows invalid, cannot confirm

---

### Phase 5 — Fix inline category creation

**Goal:** Categories added from receipt modal get default splits like Finances settings.

#### `components/receipts/ItemSetupModal.tsx` — `handleAddCategory`

After `POST /api/finances/categories`:

```ts
const defaultSplits = buildDefaultSplits(allMembers)
await apiClient.put(`/api/finances/categories/${created.id}/splits`, { splits: defaultSplits })

const created: Category = {
  ...res.data.data,
  splits: defaultSplits.map((s) => ({
    household_member_id: s.household_member_id,
    percentage: s.percentage,
    nickname: allMembers.find((m) => m.id === s.household_member_id)?.name ?? null,
  })),
}
```

**Acceptance:**

- [ ] Add category from receipt modal → split preview immediately shows equal split for all members
- [ ] Line is valid and confirmable without opening Finances settings

---

### Phase 6 — Confirm / unconfirm toggle on Step 3 cards

#### `components/receipts/ScanReceiptWizard.tsx`

Replace `handleConfirmLineItem`:

```ts
function handleConfirmLineItem(index: number) {
  setLineItemConfigs((prev) =>
    prev.map((c, i) => {
      if (i !== index) return c
      if (c.configured) {
        return { ...c, configured: false }
      }
      return hasValidSplitAssignment(c, memberCount, splitResolverCtx)
        ? { ...c, configured: true }
        : c
    }),
  )
}
```

Update `aria-label` to reflect toggle: confirmed → "tap to unconfirm", unconfirmed → "tap to confirm split".

**Acceptance:**

- [ ] Tap unconfirmed valid line → checkmark
- [ ] Tap again → checkmark removed
- [ ] Tap invalid line → no change
- [ ] Save disabled when any line unconfirmed

---

## Files to touch (checklist)

| File | Changes |
|------|---------|
| `lib/utils/splits.ts` | **New** — `buildDefaultSplits`, `splitsSumTo100`, helpers |
| `lib/utils/receiptLineItems.ts` | Stricter validation, display fallback, `categoryHasValidSplits` |
| `components/SplitEditor.tsx` | **Move** from finances folder; import `buildDefaultSplits` from utils |
| `app/(pages)/dashboard/.../finances/components/settings/CategoriesSection.tsx` | Update import path; use shared `buildDefaultSplits` |
| `app/(pages)/dashboard/.../finances/components/settings/RecurringSection.tsx` | Same |
| `app/(pages)/dashboard/.../finances/components/settings/ItemRulesSection.tsx` | Same |
| `app/(pages)/dashboard/.../receipts/new/page.tsx` | Load `household_members`, pass `members` |
| `components/receipts/ScanReceiptWizard.tsx` | `members` prop, toggle confirm, pass ctx to validation |
| `components/receipts/ItemSetupModal.tsx` | `SplitEditor`, fix category create, remove draftPct, pass ctx |
| `locales/en.ts` | Optional: `RECEIPTS.LABELS.UNCONFIRM_HINT`, toggle aria strings |

**Delete after move:**

- `app/(pages)/dashboard/[householdId]/finances/components/SplitEditor.tsx` (only after all imports updated)

---

## Locales (`locales/en.ts`)

Add or confirm:

```ts
RECEIPTS: {
  LABELS: {
    TAP_TO_CONFIRM: 'Tap to confirm split',
    TAP_TO_UNCONFIRM: 'Tap to unconfirm',
  },
  ITEM_SETUP: {
    NO_SPLITS: 'No splits configured for this category.', // exists — use under preview
    INVALID_SPLITS: 'Splits must total 100% before you can continue.',
  },
  ERRORS: {
    SPLITS_REQUIRED: 'All items need a valid split before saving.', // exists
    NO_MEMBERS_FOR_SPLITS: 'Add household members before saving receipts.', // exists
  },
}
```

Reuse `FINANCES.SPLIT_EDITOR.*` inside `SplitEditor` — do not duplicate.

---

## Testing plan (manual)

1. **Live custom split rebalance**
   - Open Configure items → enable Custom split → set one member to 60%.
   - Others should immediately show 40% (split among remaining) and dollar amounts update without clicking away.

2. **Category with no splits**
   - In Finances, create category with name only (no splits saved) OR use existing empty category.
   - Assign to receipt line → preview shows equal split hint + `NO_SPLITS` warning; status Needs setup; cannot confirm; Save disabled.

3. **Inline category from receipt**
   - Add category from item modal → preview shows all members with equal %; line is confirmable.

4. **Household with no category splits at all**
   - Receipt wizard still lists all members; equal split works on uncategorized lines.

5. **Confirm toggle**
   - Tap line card → confirmed.
   - Tap again → unconfirmed.
   - Save disabled until all confirmed again.

6. **Valid category splits**
   - Category 60/40 → line shows 60/40, confirmable, save works.

7. **Regression — Finances settings**
   - Categories / Recurring / Item rules split editors still work after `SplitEditor` move.

8. **Custom split invalid total**
   - If user somehow leaves total ≠ 100% → cannot confirm, Save blocked.

---

## Implementation order

```
Phase 1 (shared utils + move SplitEditor)
    → Phase 2 (load household members)
    → Phase 3 (validation + display fallback)
    → Phase 4 (modal SplitEditor)
    → Phase 5 (inline category splits)
    → Phase 6 (confirm toggle)
```

Run `tsc --noEmit` after Phase 1 (import path ripple) and after Phase 3 (signature changes to `hasValidSplitAssignment`).

---

## Out of scope

- Alias matching, AI suggestions (`docs/plan-household-items-aliases-receipts.md`)
- Auto-fixing invalid category splits in Finances settings from receipt flow
- Per-line expense rows in DB (still aggregated splits on save)
- Opening item modal from card tap (card tap = confirm toggle only; Configure items button opens modal)

---

## Cursor prompt (paste to start work)

```
Implement docs/plan-receipt-split-editor-fixes.md Phases 1–6.

Fix receipt split UX: reuse shared SplitEditor with live rebalance in ItemSetupModal; load household_members for allMembers; tighten hasValidSplitAssignment so empty/invalid category splits are not valid; show equal-split preview fallback + NO_SPLITS warning when category splits missing; persist default splits when adding category from receipt modal; toggle confirm/unconfirm on Step 3 line-item cards.

Prior plan docs/plan-receipt-splits-item-setup.md Phases 1–4 are already implemented — do not regress confirmation flow, step 3 split lines, or stale modal state fixes.

Follow CLAUDE.md: locales/en.ts for strings, no fetch in components, shared logic in lib/utils/, move SplitEditor to components/SplitEditor.tsx.
```

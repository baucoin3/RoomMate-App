# Receipt Step 3 UX Updates — Implementation Plan

## Overview

Three focused changes to Step 3 of the receipt scanning wizard and the Configure Items
popup (ItemSetupModal). No changes to Steps 1 or 2.

---

## Change 1: Checkmark = "include in expense" + modal disabled state + button refactor

### Intent

The checkmark next to each line item represents whether that item will be included in
the saved expense. Unchecking removes it from the expense. This is already the mechanical
behavior — this change makes the UI reflect that intent clearly.

### Data model — `lib/types/receipts.ts`

Add `active: boolean` to `LineItemConfig`, defaulting to `true` for all items.

This cleanly separates two concepts that are currently conflated on `configured`:
- `active` — the user wants this item included in the expense
- `configured` — the item has a valid split assignment set up

### Step 3 line items list — `ScanReceiptWizard.tsx`

- `handleConfirmLineItem` toggles `active` instead of `configured`.
- Items with `active: false` render greyed out (reduced opacity, muted text/border colors).
  Clicking a greyed-out item re-enables it (toggles `active` back to `true`).
- Save payload filter changes from `filter((c) => c.configured)` to `filter((c) => c.active)`.

### "Configure items" button — `ScanReceiptWizard.tsx`

- Remove the `CONFIGURE_ITEMS_HINT` badge ("N items need confirmation") entirely. There is
  no longer a concept of "needing attention" — items are active by default and users configure
  them when they want. In the future, AI will assign categories automatically anyway.
- Replace the badge with a neutral count of active items only.
  - New locale string: `CONFIGURE_ITEMS_COUNT: (n: number) => \`\${n} item\${n === 1 ? '' : 's'}\``
  - Displayed as a small muted badge next to the button label.

### "Add all to expense list" button (formerly "Accept all as current") — `ScanReceiptWizard.tsx`

- Rename the button and its intent: it now means "set all items with valid split assignments
  to active: true."
- Updated locale string: `ADD_ALL_TO_EXPENSE` (replaces `ACCEPT_ALL_CURRENT`).
- Shrink from full-width to a compact right-aligned button (e.g., `self-end` or placed
  inline to the right of the line items label). It is a secondary action, not primary.
- `handleAcceptAllCurrent` (rename to `handleAddAllToExpense`) only acts on items where
  `active: true` is already set or where a valid split exists. Items explicitly set to
  `active: false` by the user are untouched.

### ItemSetupModal — `components/receipts/ItemSetupModal.tsx`

Inactive items (`active: false`) appear in the modal but in a fully disabled state:
- Item description, amount, and status pill are shown (dimmed).
- Category selector, split editor, custom split toggle, and save-as-household-item control
  are all hidden.
- A single "Add to expense list" button is shown in their place, which sets `active: true`
  and re-enables that item for full configuration.
- New locale string: `ADD_TO_EXPENSE_LIST: 'Add to expense list'`

Navigation behavior:
- Prev/next arrows and dot indicators still navigate to inactive items (no auto-skip).
- Dot indicators should visually distinguish inactive items from active ones — e.g., a
  dimmed/outlined dot rather than the current filled/check variants.

---

## Change 2: "Save as household item" — default on + better already-saved message

### Default value — `ScanReceiptWizard.tsx` → `matchLineItems`

For new items (not matched to a household item: `matchedHouseholdItemId === null`),
set `saveAsHouseholdItem: true` by default. Currently defaults to `false`.

Already-matched items (`matchedHouseholdItemId !== null`) are unaffected — they continue
to show the already-in-catalog message instead of the checkbox.

### Already-saved message — `locales/en.ts`

Update `RECEIPTS.ITEM_SETUP.ALREADY_IN_CATALOG` to read:
> "This item is already saved in your household catalog."

No logic changes needed — the `isKnownItem` branching already exists.

---

## Change 3: Percentages in split lines + no text cutoff

### Locale + util — `locales/en.ts` + `lib/utils/receiptLineItems.ts`

`LINE_ITEM_SPLIT_MEMBER` currently: `(name, amount) => \`\${name} $\${amount}\``

Update to include percentage:
```ts
LINE_ITEM_SPLIT_MEMBER: (name: string, amount: string, percentage: number) =>
  `\${name} \${percentage}% · $\${amount}`
```

Update `getLineItemSplitLines` in `lib/utils/receiptLineItems.ts` to pass `s.percentage`
(already available on `LineItemSplitRow`) into the locale function call.

### Layout fix — `ScanReceiptWizard.tsx`

Split lines currently use `whitespace-nowrap`, which prevents wrapping but causes overflow
when names are longer and percentages are added.

- Remove `whitespace-nowrap` from split line `<span>` elements.
- Increase the right-side column from `min-w-[120px]` to `min-w-[150px]` to give the
  additional percentage text room.
- Set the row alignment to `items-start` instead of `items-center` so that taller content
  on the right doesn't clip the description on the left.

---

## Files touched

| File | Changes |
|---|---|
| `lib/types/receipts.ts` | Add `active: boolean` to `LineItemConfig` |
| `lib/utils/receiptLineItems.ts` | Pass `percentage` into `getLineItemSplitLines` locale call |
| `locales/en.ts` | Update `LINE_ITEM_SPLIT_MEMBER`, add `CONFIGURE_ITEMS_COUNT`, add `ADD_TO_EXPENSE_LIST`, rename `ACCEPT_ALL_CURRENT` → `ADD_ALL_TO_EXPENSE`, update `ALREADY_IN_CATALOG` |
| `components/receipts/ScanReceiptWizard.tsx` | Toggle `active` on checkmark; update accept-all to add-all; resize button; update Configure Items badge; filter by `active` on save |
| `components/receipts/ItemSetupModal.tsx` | Show inactive items as disabled; "Add to expense list" button; default `saveAsHouseholdItem: true` |

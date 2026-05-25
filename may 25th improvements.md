# Implementation Plan — May 25th Improvements

## Issue 1 — Separate Settings Page ("Catalog & Bills")

**Problem**: Household Items and Recurring Bills are buried as a tab inside the Finances page. The `ROUTES.HOUSEHOLD_SETTINGS` and nav entry already exist but there is no page behind them — navigating to `/dashboard/[householdId]/settings` currently 404s.

**Page name**: **"Catalog & Bills"** — tells users exactly what's there: the item catalog (for receipt matching) and recurring bill setup.

**Files to change**:

1. **Create** `app/(pages)/dashboard/[householdId]/settings/page.tsx`
   - `'use client'` component
   - Fetch members, categories, household items, and recurring expenses via `apiClient` (same `useEffect` pattern as the existing `SettingsTab`)
   - Render three `AccordionSection`s: Recurring Bills → Categories → Household Items
   - Move `AccordionSection` helper into this file (or extract to a shared component)
   - Page header: `"Catalog & Bills"` string added to `locales/en.ts` as `SETTINGS.TITLE`

2. **Modify** `app/(pages)/dashboard/[householdId]/finances/page.tsx`
   - Remove the `Tab` type, `activeTab` state, tab bar UI, and `SettingsTab` import/render
   - Remove the `members` fetch (no longer needed once SettingsTab is gone)
   - Just render `<OverviewTab householdId={householdId} />` directly inside the wrapping div

3. **Delete** `app/(pages)/dashboard/[householdId]/finances/components/SettingsTab.tsx`
   - All three sections (Categories, Recurring Bills, Household Items) move to the new settings page

4. **Add to `locales/en.ts`** under a new `SETTINGS` key:
   ```ts
   SETTINGS: {
     TITLE: 'Catalog & Bills',
     SUBTITLE: 'Household item catalog, categories, and recurring bills',
   }
   ```

5. **No route or nav changes needed** — `ROUTES.HOUSEHOLD_SETTINGS` and the nav entry already point to the correct path.

---

## Issue 2 — Show Split Details on Household Items

**Problem**: When `split_overrides` is null, `ItemRow` renders `FINANCES.SETTINGS.USES_DEFAULT` (just the string "Uses default") with no actual numbers visible.

**File**: `app/(pages)/dashboard/[householdId]/finances/components/settings/ItemRulesSection.tsx`

**Change** in `ItemRow` (currently lines 311–317):

```tsx
// BEFORE: shows static text
: FINANCES.SETTINGS.USES_DEFAULT

// AFTER: look up the category's splits and show them
: (() => {
    const cat = localItem.default_category_id
      ? categories.find((c) => c.id === localItem.default_category_id)
      : null
    const catSplits = cat?.splits ?? []
    if (catSplits.length === 0) return FINANCES.SETTINGS.USES_DEFAULT
    return catSplits.map((s) => {
      const m = members.find((mb) => mb.id === s.household_member_id)
      return `${m?.nickname ?? s.household_member_id} ${s.percentage}%`
    }).join(' / ') + ` (${FINANCES.SETTINGS.VIA_CATEGORY(cat!.name)})`
  })()
```

**Add to `locales/en.ts`** inside `FINANCES.SETTINGS`:
```ts
VIA_CATEGORY: (name: string) => `${name} default`,
```

Result displays like: `"Alex 60% / Jordan 40% (Groceries default)"` — fully visible without opening the edit form.

---

## Issue 3 — Always Store Aliases (Capped at 5 per Item per Save)

**Problem**: Aliases are only stored when `rememberAlias === true`, which is `false` for `catalog` and `alias` matches. The receipt text is never stored for already-matched items in those cases.

**File**: `components/receipts/ScanReceiptWizard.tsx` (lines 478–483)

**Change in `handleSave()`**:

```ts
// BEFORE:
const aliasInserts = configsToSave
  .filter((c) => c.rememberAlias && c.householdItemId)
  .map((c) => ({
    household_item_id: c.householdItemId!,
    display_text: c.description,
  }))

// AFTER: always store for all matched items; collect description + AI candidates, cap at 5
const aliasInserts = configsToSave
  .filter((c) => c.householdItemId !== null)
  .flatMap((c) => {
    const allAliases = [c.description, ...(c.aiCandidates ?? [])]
    const deduplicated = [...new Set(allAliases.map((n) => n.trim()).filter(Boolean))]
    return deduplicated.slice(0, 5).map((alias) => ({
      household_item_id: c.householdItemId!,
      display_text: alias,
    }))
  })
```

**Also remove** the "Remember this receipt text" checkbox from `ItemSetupModal.tsx` (lines 720–745) since it no longer has any effect — aliases are always stored. The `rememberAlias` field can stay in the type without a UI control.

---

## Issue 4 — Correct Default Tab + Category Match Badge

**Problem A**: `setupMode` defaults to `'item'` whenever `probableNames.length > 0` even if no household item was actually matched. Items that only matched by category wrongly open on the item tab.

**Problem B**: When the category was AI-matched, no "Suggested" badge appears on the category tab — the user sees no indication the match happened automatically.

### Fix A — `ScanReceiptWizard.tsx` line 198

```ts
// BEFORE:
const setupMode = matchSource !== null || probableNames.length > 0 ? 'item' : 'category'

// AFTER: only default to 'item' when we actually matched a household item
const setupMode: 'item' | 'category' = householdItemId !== null ? 'item' : 'category'
```

### Fix B — Add `categoryAutoMatched` field

**`lib/types/receipts.ts`** — add to `LineItemConfig`:
```ts
categoryAutoMatched: boolean
```

**`ScanReceiptWizard.tsx`** in `matchLineItems()` — set after the category fallback block (after line 191):
```ts
const categoryAutoMatched =
  householdItemId === null &&
  itemDefaults.categoryId !== null &&
  item.suggested_category_name != null
```

Include `categoryAutoMatched` in the returned object.

**`ItemSetupModal.tsx`** — in the "By Category" tab section, beside the category label, add:
```tsx
{current.categoryAutoMatched && (
  <span className="text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full bg-white/8 text-white/50 border border-white/10">
    {RECEIPTS.ITEM_SETUP.MATCH_BADGE_SUGGESTED}
  </span>
)}
```

Reuses the existing `MATCH_BADGE_SUGGESTED` locale string ("Suggested"), consistent with the item tab badge style.

---

## Issue 5 — Remove Bell Icon; Mobile Profile Circle with Sign-Out

**File**: `components/household/HouseholdShell.tsx`

### Changes:

1. **Delete** the `BellIcon` function (lines 20–26) and its button (lines 169–174).

2. **Delete** the `DotsIcon` function (lines 28–34).

3. **Add** `mobileMenuRef`:
   ```ts
   const mobileMenuRef = useRef<HTMLDivElement>(null)
   ```

4. **Update** `handleClickOutside` to close menu if click is outside BOTH refs:
   ```ts
   if (
     !menuRef.current?.contains(event.target as Node) &&
     !mobileMenuRef.current?.contains(event.target as Node)
   ) {
     setMenuOpen(false)
   }
   ```

5. **Replace** the header right-side buttons section (currently lines 168–184) with a profile circle that opens a sign-out dropdown:
   ```tsx
   <div className="relative md:hidden" ref={mobileMenuRef}>
     <button
       onClick={() => setMenuOpen((prev) => !prev)}
       aria-label={NAV.PROFILE_ARIA}
       aria-expanded={menuOpen}
       aria-haspopup="menu"
       className="flex items-center justify-center w-8 h-8 rounded-full bg-indigo-500 text-white text-xs font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
     >
       {userInitial}
     </button>
     {menuOpen && (
       <div
         role="menu"
         className="absolute right-0 top-full mt-2 w-48 rounded-xl border border-white/10 bg-[#1c1c24] py-1 shadow-xl z-50"
       >
         <div className="border-b border-white/10 px-4 py-2">
           <p className="truncate text-xs font-medium text-white">{displayName}</p>
           {userName && (
             <p className="truncate text-xs text-white/50">{userEmail}</p>
           )}
         </div>
         {signOutError && (
           <p className="px-4 py-2 text-xs text-red-400">{signOutError}</p>
         )}
         <button
           role="menuitem"
           onClick={handleSignOut}
           disabled={signingOut}
           className="flex w-full items-center gap-2 px-4 py-2 text-sm text-white/70 hover:text-white hover:bg-white/5 transition-colors disabled:opacity-60"
         >
           {signingOut ? NAV.ACTIONS.SIGNING_OUT : NAV.ACTIONS.SIGN_OUT}
         </button>
       </div>
     )}
   </div>
   ```

The desktop sidebar avatar and its menu remain unchanged. Both share the same `menuOpen` state.

---

## Issue 6 — Configure Items Modal UX Fixes

### 6a — Item Search Dropdown Closes on Outside Click

**File**: `components/receipts/ItemSetupModal.tsx`

Add a ref and document click-outside listener:
```tsx
const searchContainerRef = useRef<HTMLDivElement>(null)

useEffect(() => {
  function handleOutside(e: MouseEvent) {
    if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
      setShowItemDropdown(false)
    }
  }
  document.addEventListener('mousedown', handleOutside)
  return () => document.removeEventListener('mousedown', handleOutside)
}, [])
```

Wrap the item search `<div className="relative">` (line 476) with `<div ref={searchContainerRef} className="relative">` and remove the `onBlur` handler from the input — the document listener replaces it.

### 6b — Tab Switching Does Not Clear Data

**File**: `components/receipts/ItemSetupModal.tsx`

```ts
// BEFORE:
function switchToItemTab() {
  updateCurrent({ setupMode: 'item', categoryId: null, useCustomSplit: false })
}
function switchToCategoryTab() {
  updateCurrent({ setupMode: 'category', householdItemId: null, resolvedItemName: null, matchSource: null })
  setItemSearch('')
}

// AFTER: only change the active tab, preserve all other state
function switchToItemTab() {
  updateCurrent({ setupMode: 'item' })
}
function switchToCategoryTab() {
  updateCurrent({ setupMode: 'category' })
}
```

`setupMode` controls which side is active for saving — no data needs to be cleared when switching.

### 6c — Group Field Auto-Fills with Item Name

**`lib/types/receipts.ts`** — add to `LineItemConfig`:
```ts
itemGroup: string
```

**`ScanReceiptWizard.tsx` `matchLineItems()`** — include in returned object:
```ts
itemGroup: resolvedItemName ?? item.description,
```

**`ItemSetupModal.tsx`** — when toggling "Save as household item", auto-fill group on first enable:
```tsx
onClick={() => {
  const enabling = !current.saveAsHouseholdItem
  updateCurrent({
    saveAsHouseholdItem: enabling,
    itemGroup: enabling && !current.itemGroup
      ? (current.resolvedItemName ?? current.description)
      : current.itemGroup,
  })
}}
```

Inside the `current.saveAsHouseholdItem` block (after the toggle, before the split preview), add a group input:
```tsx
<input
  type="text"
  value={current.itemGroup}
  onChange={(e) => updateCurrent({ itemGroup: e.target.value })}
  placeholder={RECEIPTS.ITEM_SETUP.GROUP_PLACEHOLDER}
  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-white placeholder-white/30 focus:outline-none focus:border-indigo-500 transition-colors"
/>
```

**`ScanReceiptWizard.tsx` `handleSave()`** — include `item_group` in `new_household_items`:
```ts
item_group: c.itemGroup?.trim() || null,
```

**`lib/types/receipts.ts`** — add to the new household item shape in `SaveReceiptPayload`:
```ts
item_group?: string | null
```

**Add to `locales/en.ts`** under `RECEIPTS.ITEM_SETUP`:
```ts
GROUP_PLACEHOLDER: 'Group (e.g. veggies)',
```

---

## Issue 7 — Rent Card Per-Roommate Wording

**Problem**: The rent card shows an aggregate "X of Y paid" with avatar dots. No per-member dollar amounts, no contextual "owes you" phrasing.

### Type changes — `lib/types/dashboard.ts`

```ts
export interface RentMember {
  memberId: string
  memberName: string
  hasPaid: boolean
  shareAmount: number      // their calculated share of rent
}

export interface RentStatus {
  expenseId: string
  description: string
  totalAmount: number
  dueDate: string
  daysUntilDue: number
  members: RentMember[]
  paidCount: number
  totalCount: number
  paidByMemberId: string   // who the rent expense was logged under
  currentMemberId: string  // the viewer — needed to frame wording correctly
}
```

### Service changes — `lib/services/dashboard.ts` `fetchRentStatus()`

Add `calculated_amount` and `paid_by_member_id` to the select:
```ts
const { data: expense, error } = await supabase
  .from('expenses')
  .select(`
    id,
    description,
    total_amount,
    date,
    paid_by_member_id,
    expense_splits (
      id,
      household_member_id,
      calculated_amount,
      is_settled,
      household_members ( id, nickname, user_id )
    ),
    expense_categories ( name )
  `)
```

Update member mapping to include `shareAmount`:
```ts
const members = splits.map((split) => ({
  memberId: split.household_member_id,
  memberName: split.household_members?.nickname ?? 'Unknown',
  hasPaid: split.is_settled,
  shareAmount: Number(split.calculated_amount ?? 0),
}))
```

Add to the returned object:
```ts
paidByMemberId: expense.paid_by_member_id,
currentMemberId,
```

### UI changes — `components/dashboard/RentStatusCard.tsx`

Replace the single member-avatar row with per-member rows. Wording per row:
- **Viewer paid rent** (`paidByMemberId === currentMemberId`): `"[Name] owes you $X"` or `"[Name] has paid"` if settled
- **Viewer did not pay, this row is the viewer**: `"You owe [Payer] $X"` or `"You have paid"` if settled
- **Other members when viewer didn't pay**: `"[Name] owes [Payer] $X"` or `"[Name] has paid"` if settled

**Add to `locales/en.ts`** under `HOUSEHOLD_DASHBOARD.RENT`:
```ts
OWES_YOU: (name: string, amount: string) => `${name} owes you $${amount}`,
OWES_YOU_PAID: (name: string) => `${name} has paid`,
YOU_OWE: (name: string, amount: string) => `You owe ${name} $${amount}`,
YOU_HAVE_PAID: 'You have paid',
THIRD_PARTY_OWES: (name: string, payer: string, amount: string) => `${name} owes ${payer} $${amount}`,
THIRD_PARTY_PAID: (name: string) => `${name} has paid`,
```

The card keeps the existing progress bar and days-until-due display. The member avatar dots section is replaced with a stacked list of per-member rows.

---

## Files Changed Summary

| File | Action | Issues |
|------|--------|--------|
| `app/(pages)/dashboard/[householdId]/settings/page.tsx` | **Create** | 1 |
| `app/(pages)/dashboard/[householdId]/finances/page.tsx` | Modify — remove tab UI | 1 |
| `app/(pages)/dashboard/[householdId]/finances/components/SettingsTab.tsx` | **Delete** | 1 |
| `app/(pages)/dashboard/[householdId]/finances/components/settings/ItemRulesSection.tsx` | Modify — split detail display | 2 |
| `lib/types/receipts.ts` | Add `categoryAutoMatched`, `itemGroup`, `item_group` in payload | 3, 4, 6c |
| `lib/types/dashboard.ts` | Add `shareAmount`, `paidByMemberId`, `currentMemberId` | 7 |
| `lib/services/dashboard.ts` | Add `calculated_amount`, `paid_by_member_id` to rent query | 7 |
| `components/receipts/ScanReceiptWizard.tsx` | Alias logic, setupMode fix, itemGroup | 3, 4, 6c |
| `components/receipts/ItemSetupModal.tsx` | Dropdown dismiss, tab switch, group field, category badge | 4, 6a, 6b, 6c |
| `components/household/HouseholdShell.tsx` | Remove bell, add mobile profile menu | 5 |
| `components/dashboard/RentStatusCard.tsx` | Per-member rows with wording | 7 |
| `locales/en.ts` | New strings for all issues | 1, 2, 6c, 7 |

All changes are additive or targeted replacements. No routes, no DB schema, and no existing type signatures are broken beyond the intentional extensions above.

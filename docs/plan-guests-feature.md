# Plan: Guests Feature

## Overview

Add a Guests system that allows household members to include non-app-users (friends, partners, cottage buddies) in receipt splits. Guests are managed entirely by the household — they never log in. After the expense is saved, guests with emails receive a notification telling them what they owe and who to pay. This new page can be under settings have a tab for household settings and giest sttings since we dont need more pages in the dashboard menu

---

## Core Concepts

### Guest Types

**Individual Guest**
- Has a name and optional email
- Optional `expires_at` date — if set, they are hidden from the UI after that date (soft expiry, not hard delete)
- Example: a partner who comes over often but doesn't use the app → no expiry
- Example: a friend visiting for one night → expires tomorrow

**Guest Group**
- A named collection of individual guests
- Has its own optional `expires_at`
- Example: "Cottage Weekend May 2026" — 4 friends, expires after the weekend
- Example: "Hockey Crew" — recurring group, no expiry

When a group is added to an expense, all guests in that group are added to the split automatically (user can deselect individuals).

### What Guests Are NOT

- They are not users of the app
- They do not have accounts or passwords
- They cannot log in
- The household manages them entirely on their behalf
- Their split data is owned by the household member who created the expense

---

## User Flows

### Flow 1: Guests Management Page

**Route:** `/dashboard/[householdId]/guests`

**Page sections:**

1. **Active Guests** — list of individual guests (not in a group, or shown alongside their group)
   - Name, email (if set), expiry badge (e.g. "Expires June 2" or "Permanent")
   - Actions: Edit, Delete, Add to group

2. **Guest Groups** — list of named groups
   - Group name, member count, expiry badge
   - Expandable to show members within
   - Actions: Edit group, Delete group, View members

3. **Add Guest / Add Group** — buttons at the top

**Add Guest modal fields:**
- Name (required)
- Email (optional — needed for notifications)
- Auto-expire after: None / Custom date
- Add to group: optional dropdown of existing groups

**Add Group modal fields:**
- Group name (required)
- Auto-expire after: None / Custom date (e.g. "end of the trip")
- Members: multi-select of existing guests OR inline "add new guest" within the group

---

### Flow 2: Adding Guests to a Receipt

This happens in `ScanReceiptWizard` after the photo is analyzed (currently Step 2 review), before the user gets to the item setup modal.

**New Step 3: "Who's splitting?" (Guest Selection)**

Between the current Step 2 (Review) and Step 3 (Item Setup), insert a lightweight new panel:

```
Step 1: Upload
Step 2: Review receipt
Step 3: Add guests  ← NEW
Step 4: Configure items & splits
```

Step 3 panel layout:
- Heading: "Anyone splitting this with you?"
- Subtext: "Add guests to include them in the split. They'll get an email with what they owe."
- Two buttons: "Add Individual Guest" | "Add a Group"
- Below: chips/pills showing currently added guests (with × to remove)
- "Skip" link to go straight to Step 4 without guests

**Add Guest inline (within wizard):**
- Tap "Add Individual Guest" → small inline form or bottom sheet:
  - Search existing guests by name (typeahead)
  - If no match → "Create new guest" option with name + optional email
  - Newly created guests are saved to the household guests table immediately on save (not on close)
- Tap "Add a Group" → select from existing groups, expands to show all members with individual checkboxes (user can deselect specific people in the group)

**Guest chips UI:**
- Each chip shows: avatar initial + name
- Chips are dismissible (×)
- Tapping a chip shows a tooltip with their email (if set)

---

### Flow 3: Splits with Guests

Once guests are added to the receipt, they appear in the split calculation alongside household members.

In `ItemSetupModal`:
- The member list in the split editor now includes both household members AND guests
- Visual distinction: household members shown with their usual avatar, guests shown with a "Guest" badge or different color
- The split percentage math is the same — guests are just additional participants

In the aggregate split summary (bottom of wizard):
- Guests appear in the "Who owes what" breakdown
- Household members see their own share only; guests' shares are shown separately as "Guest shares"

The `computeAggregateSplits` function needs to handle a unified list of participants (members + guests).

---

### Flow 4: Email Notification to Guests

After the expense is saved:
- For each guest with an email who has a non-zero split:
  - Send an email with:
    - Subject: "[Member name] split a receipt with you"
    - Body: merchant name, date, total, guest's share amount
    - Who to pay: the `paid_by` member's name + email
    - Itemized line: which specific items they're covering (if configured per item)
    - Footer: "This was sent on behalf of [Household name]. You don't need an account."

Email sent via a server-side Next.js API call to a transactional email provider (Resend is recommended — simple API, good deliverability, free tier).

Trigger: after `POST /api/receipts` saves successfully, the route handler calls `sendGuestSplitEmails(expenseId)` as a fire-and-forget (do not block the response on email delivery).

---

## Database Schema Changes

### New Tables

#### `household_guests`
```sql
CREATE TABLE household_guests (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id    uuid NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  name            text NOT NULL,
  email           text,                         -- nullable; needed for notifications
  expires_at      timestamptz,                  -- null = permanent (no auto-hide)
  created_by      uuid REFERENCES household_members(id) ON DELETE SET NULL,
  created_at      timestamptz DEFAULT now()
);

-- Index for household lookup (active guests)
CREATE INDEX idx_household_guests_household ON household_guests(household_id);
```

#### `household_guest_groups`
```sql
CREATE TABLE household_guest_groups (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id    uuid NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  name            text NOT NULL,
  expires_at      timestamptz,                  -- null = permanent
  created_by      uuid REFERENCES household_members(id) ON DELETE SET NULL,
  created_at      timestamptz DEFAULT now()
);
```

#### `household_guest_group_members`
```sql
CREATE TABLE household_guest_group_members (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id        uuid NOT NULL REFERENCES household_guest_groups(id) ON DELETE CASCADE,
  guest_id        uuid NOT NULL REFERENCES household_guests(id) ON DELETE CASCADE,
  UNIQUE(group_id, guest_id)
);
```

### Modified Tables

#### `expense_splits` — add guest support
```sql
-- Add nullable guest_id column alongside the existing household_member_id
ALTER TABLE expense_splits ADD COLUMN guest_id uuid REFERENCES household_guests(id) ON DELETE SET NULL;

-- Ensure exactly one of household_member_id or guest_id is set
ALTER TABLE expense_splits ADD CONSTRAINT expense_splits_participant_check
  CHECK (
    (household_member_id IS NOT NULL AND guest_id IS NULL) OR
    (household_member_id IS NULL AND guest_id IS NOT NULL)
  );
```

This is the cleanest approach — no new splits table needed, same aggregation logic works, just nullable FK fields with a check constraint.

### Expiry Strategy

**Lazy expiry (recommended):** Don't delete rows. Instead, filter in queries:
```sql
WHERE expires_at IS NULL OR expires_at > now()
```

This means:
- Guests who have "expired" still appear in historical expenses (so old splits remain accurate)
- They just don't show up in the "add to new receipt" dropdown
- Household members can manually delete guests if they want hard removal

This avoids cascading deletes breaking old expense_splits records.

---

## TypeScript Type Changes

### New Types (`lib/types/guests.ts`)

```typescript
export interface HouseholdGuest {
  id: string
  household_id: string
  name: string
  email: string | null
  expires_at: string | null
  created_by: string | null
  created_at: string
}

export interface HouseholdGuestGroup {
  id: string
  household_id: string
  name: string
  expires_at: string | null
  created_by: string | null
  created_at: string
  members?: HouseholdGuest[]  // joined when fetching group details
}

// Unified participant — used anywhere a split participant can be a member OR a guest
export interface SplitParticipant {
  id: string
  displayName: string
  type: 'member' | 'guest'
  email?: string | null
}
```

### Changes to Existing Types (`lib/types/receipts.ts`)

`LineItemSplitRow` currently has `household_member_id`. Needs to support guests:
```typescript
export interface LineItemSplitRow {
  participant_id: string          // was: household_member_id
  participant_type: 'member' | 'guest'
  displayName: string             // was: nickname
  percentage: number
}
```

`SaveReceiptPayload.splits` similarly:
```typescript
splits: Array<{
  household_member_id?: string    // set if type = 'member'
  guest_id?: string               // set if type = 'guest'
  percentage: number
  calculated_amount: number
}>
```

---

## Component Changes

### New Components

| Component | Path | Purpose |
|-----------|------|---------|
| `GuestsPage` | `app/(pages)/dashboard/[householdId]/guests/page.tsx` | Main guests management page |
| `GuestCard` | `components/guests/GuestCard.tsx` | Individual guest row/card |
| `GuestGroupCard` | `components/guests/GuestGroupCard.tsx` | Group card with expandable members |
| `AddGuestModal` | `components/guests/AddGuestModal.tsx` | Create/edit individual guest |
| `AddGroupModal` | `components/guests/AddGroupModal.tsx` | Create/edit group |
| `GuestStepPanel` | `components/receipts/GuestStepPanel.tsx` | New wizard step for adding guests |
| `GuestChip` | `components/receipts/GuestChip.tsx` | Dismissible guest pill in wizard |

### Modified Components

**`ScanReceiptWizard.tsx`**
- Add `selectedGuests: HouseholdGuest[]` to wizard state
- Insert new step 3 (GuestStepPanel) between review and item setup
- Pass `selectedGuests` into step 4 (item setup / split calculation)
- Include guest splits in `computeAggregateSplits`
- Include guest splits in `SaveReceiptPayload`

**`ItemSetupModal.tsx`**
- Accept `guests: HouseholdGuest[]` prop (guests selected in step 3)
- Merge members + guests into unified `SplitParticipant[]` list for the split editor
- Visual distinction: "Guest" badge on guest rows

**`SplitEditor.tsx`** (if it exists as a shared component)
- Accept `SplitParticipant[]` instead of just members
- Render member/guest differently (badge, icon)

---

## API Routes

### New Routes

| Method | Route | Purpose |
|--------|-------|---------|
| GET | `/api/guests` | List active guests for a household |
| POST | `/api/guests` | Create a new guest |
| PATCH | `/api/guests/[guestId]` | Update a guest (name, email, expiry) |
| DELETE | `/api/guests/[guestId]` | Hard delete a guest |
| GET | `/api/guests/groups` | List guest groups |
| POST | `/api/guests/groups` | Create a group |
| PATCH | `/api/guests/groups/[groupId]` | Update a group |
| DELETE | `/api/guests/groups/[groupId]` | Delete a group |
| POST | `/api/guests/groups/[groupId]/members` | Add a guest to a group |
| DELETE | `/api/guests/groups/[groupId]/members/[guestId]` | Remove a guest from a group |

### Modified Routes

**`POST /api/receipts`** — update to:
1. Accept `splits` with mixed `household_member_id` / `guest_id` entries
2. Insert all splits correctly (members to existing column, guests to new `guest_id` column)
3. After saving, fire-and-forget `sendGuestSplitEmails(expenseId, householdId)`

---

## Service Layer

### New Services (`lib/services/guests.ts`)

```typescript
getActiveGuests(supabase, householdId): Promise<HouseholdGuest[]>
createGuest(supabase, householdId, memberId, data): Promise<HouseholdGuest>
updateGuest(supabase, guestId, data): Promise<HouseholdGuest>
deleteGuest(supabase, guestId): Promise<void>

getGuestGroups(supabase, householdId): Promise<HouseholdGuestGroup[]>
createGuestGroup(supabase, householdId, memberId, data): Promise<HouseholdGuestGroup>
updateGuestGroup(supabase, groupId, data): Promise<HouseholdGuestGroup>
deleteGuestGroup(supabase, groupId): Promise<void>
addGuestToGroup(supabase, groupId, guestId): Promise<void>
removeGuestFromGroup(supabase, groupId, guestId): Promise<void>
```

### New Service (`lib/services/guestEmails.ts`)

```typescript
sendGuestSplitEmails(supabase, expenseId, householdId): Promise<void>
```

This fetches the expense, its guest splits (with guest emails), the paid_by member's name and email, then fires emails for each guest that has an email address. Uses Resend (or another transactional email provider configured in `lib/config.ts`).

---

## Navigation Changes

Add "Guests" to the household navigation (alongside Receipts, Finances, Shopping, Recipes).

- Nav label: `GUESTS.NAV_LABEL` → `"Guests"`
- Route: `ROUTES.HOUSEHOLD_GUESTS(householdId)` → `/dashboard/[householdId]/guests`
- Icon: a person-with-plus or people icon (consistent with the current icon set)

---

## Locales (`locales/en.ts`) — New Keys

```typescript
GUESTS: {
  NAV_LABEL: 'Guests',
  PAGE_TITLE: 'Guests',
  PAGE_SUBTITLE: 'Manage people who split with your household but don\'t use the app.',
  
  INDIVIDUAL: 'Individual Guest',
  GROUP: 'Guest Group',
  
  ACTIONS: {
    ADD_GUEST: 'Add Guest',
    ADD_GROUP: 'Add Group',
    EDIT: 'Edit',
    DELETE: 'Delete',
    SAVE: 'Save',
    CANCEL: 'Cancel',
  },
  
  LABELS: {
    NAME: 'Name',
    EMAIL: 'Email',
    EMAIL_OPTIONAL: 'Email (optional — used to notify them of splits)',
    EXPIRY: 'Auto-expire after',
    EXPIRY_NONE: 'Never',
    EXPIRY_CUSTOM: 'Choose a date',
    GROUP_NAME: 'Group name',
    GROUP_MEMBERS: 'Members',
    PERMANENT: 'Permanent',
    EXPIRES: 'Expires',
  },
  
  WIZARD_STEP: {
    TITLE: 'Anyone splitting this with you?',
    SUBTITLE: 'Add guests to include them in the split. They\'ll receive an email breakdown.',
    ADD_INDIVIDUAL: 'Add Individual',
    ADD_GROUP: 'Add Group',
    SKIP: 'Skip — household only',
    SEARCH_PLACEHOLDER: 'Search guests...',
    CREATE_NEW: 'Create new guest',
    SELECTED: 'Added to split',
  },
  
  SPLIT_LABEL: {
    GUEST_BADGE: 'Guest',
  },
  
  EMAIL: {
    SUBJECT: '{name} shared a receipt with you',
    HEADING: 'You\'ve been included in a split',
    BODY: '{payer} paid for {merchant} on {date}. Your share is {amount}.',
    PAY_TO: 'Pay {payer} at {email}',
    FOOTER: 'Sent on behalf of {household}. You don\'t need an account.',
  },
  
  ERRORS: {
    NAME_REQUIRED: 'Guest name is required.',
    GROUP_NAME_REQUIRED: 'Group name is required.',
    DELETE_FAILED: 'Failed to delete guest.',
    SAVE_FAILED: 'Failed to save guest.',
  },
}
```

---

## Config Changes (`lib/config.ts`)

```typescript
// Email provider
export const RESEND_API_KEY = process.env.RESEND_API_KEY ?? ''
export const EMAIL_FROM_ADDRESS = process.env.EMAIL_FROM_ADDRESS ?? 'splits@yourdomain.com'
```

---

## Routes Changes (`lib/constants/routes.ts`)

```typescript
HOUSEHOLD_GUESTS: (householdId: string) => `/dashboard/${householdId}/guests`,
```

---

## Implementation Order

### Phase 1 — Database & Types (no UI yet)
1. Write migration: create `household_guests`, `household_guest_groups`, `household_guest_group_members`
2. Write migration: alter `expense_splits` to add `guest_id` + check constraint
3. Create `lib/types/guests.ts` with `HouseholdGuest`, `HouseholdGuestGroup`, `SplitParticipant`
4. Update `lib/types/receipts.ts` to use `SplitParticipant` in split rows
5. Add RLS policies for new tables

### Phase 2 — Guests Management Page
1. Build `lib/services/guests.ts`
2. Build API routes for guests and groups
3. Build `GuestsPage`, `GuestCard`, `GuestGroupCard`, `AddGuestModal`, `AddGroupModal`
4. Wire to nav

### Phase 3 — Receipt Wizard Integration
1. Add `selectedGuests` state to `ScanReceiptWizard`
2. Build `GuestStepPanel` and `GuestChip`
3. Insert new step 3 into wizard
4. Update `ItemSetupModal` to accept and display guests in splits
5. Update `computeAggregateSplits` to handle unified `SplitParticipant[]`
6. Update `SaveReceiptPayload` and `POST /api/receipts` to handle guest splits

### Phase 4 — Email Notifications
1. Add Resend (or chosen provider) as a dependency
2. Build `lib/services/guestEmails.ts`
3. Wire `sendGuestSplitEmails` into the POST /api/receipts success handler (fire-and-forget)
4. Add email template (plain HTML, no heavy framework needed)
5. Add `RESEND_API_KEY` and `EMAIL_FROM_ADDRESS` to env and config

### Phase 5 — Polish & Edge Cases
- Expiry filtering: ensure guests with `expires_at < now()` are excluded from the "add to receipt" dropdown but still appear in historical expense views
- Handle guest deletion: if a guest has existing expense_splits, soft-delete only (set a `deleted_at` column) to preserve history
- Validate email format before saving
- Show email send status in the wizard confirmation (sent / not sent / no email on file)

---

## Open Questions

1. **Email provider:** Resend is recommended (simple, free tier up to 3k emails/month). Confirm before Phase 4.
2. **Notifications for past expenses:** Should members be able to re-send a guest notification for an old expense? (Nice-to-have, not MVP)
3. **Guest deduplication across households:** Guests are per-household. A person can appear as a guest in multiple households with no link between them. Is that fine? (Yes, guests are not users.)
4. **Item-level vs expense-level guest notification:** The email draft above sends the total share. Should it itemize per line item (e.g., "You had 2 beers: $12")? Only possible if items are configured per-person in the modal.
5. **Currency:** All amounts assumed to be in the same currency as the household's expense system. No multi-currency guest splits in MVP.

---

## Summary of Files Changed/Created

| File | Change Type | Notes |
|------|-------------|-------|
| `supabase/migrations/YYYYMMDD_guests.sql` | New | 4 table operations |
| `lib/types/guests.ts` | New | HouseholdGuest, HouseholdGuestGroup, SplitParticipant |
| `lib/types/receipts.ts` | Modified | SplitParticipant in LineItemSplitRow |
| `lib/constants/routes.ts` | Modified | HOUSEHOLD_GUESTS route |
| `lib/config.ts` | Modified | Email config vars |
| `locales/en.ts` | Modified | GUESTS namespace |
| `lib/services/guests.ts` | New | CRUD for guests + groups |
| `lib/services/guestEmails.ts` | New | Email notification logic |
| `app/api/guests/route.ts` | New | Individual guest endpoints |
| `app/api/guests/groups/route.ts` | New | Group endpoints |
| `app/(pages)/dashboard/[householdId]/guests/page.tsx` | New | Guests page |
| `components/guests/GuestCard.tsx` | New | |
| `components/guests/GuestGroupCard.tsx` | New | |
| `components/guests/AddGuestModal.tsx` | New | |
| `components/guests/AddGroupModal.tsx` | New | |
| `components/receipts/GuestStepPanel.tsx` | New | Wizard step 3 |
| `components/receipts/GuestChip.tsx` | New | |
| `components/receipts/ScanReceiptWizard.tsx` | Modified | Step count, selectedGuests state, aggregate split |
| `components/receipts/ItemSetupModal.tsx` | Modified | Accept + render guests in split editor |

-- Household guests: people who split expenses but don't have app accounts
CREATE TABLE household_guests (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id    uuid NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  name            text NOT NULL,
  email           text,
  expires_at      timestamptz,
  created_by      uuid REFERENCES household_members(id) ON DELETE SET NULL,
  created_at      timestamptz DEFAULT now()
);

CREATE INDEX idx_household_guests_household ON household_guests(household_id);

-- Named collections of guests (e.g. "Cottage Weekend May 2026")
CREATE TABLE household_guest_groups (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id    uuid NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  name            text NOT NULL,
  expires_at      timestamptz,
  created_by      uuid REFERENCES household_members(id) ON DELETE SET NULL,
  created_at      timestamptz DEFAULT now()
);

CREATE INDEX idx_household_guest_groups_household ON household_guest_groups(household_id);

-- Junction table linking guests to groups
CREATE TABLE household_guest_group_members (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id        uuid NOT NULL REFERENCES household_guest_groups(id) ON DELETE CASCADE,
  guest_id        uuid NOT NULL REFERENCES household_guests(id) ON DELETE CASCADE,
  UNIQUE(group_id, guest_id)
);

-- Add guest_id to expense_splits (alongside existing household_member_id)
ALTER TABLE expense_splits ADD COLUMN guest_id uuid REFERENCES household_guests(id) ON DELETE SET NULL;

-- Ensure exactly one of household_member_id or guest_id is set
ALTER TABLE expense_splits ADD CONSTRAINT expense_splits_participant_check
  CHECK (
    (household_member_id IS NOT NULL AND guest_id IS NULL) OR
    (household_member_id IS NULL AND guest_id IS NOT NULL)
  );

-- RLS for household_guests
ALTER TABLE household_guests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view household guests"
  ON household_guests FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM household_members hm
      WHERE hm.household_id = household_guests.household_id
        AND hm.user_id = auth.uid()
    )
  );

CREATE POLICY "Members can create household guests"
  ON household_guests FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM household_members hm
      WHERE hm.household_id = household_guests.household_id
        AND hm.user_id = auth.uid()
    )
  );

CREATE POLICY "Members can update household guests"
  ON household_guests FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM household_members hm
      WHERE hm.household_id = household_guests.household_id
        AND hm.user_id = auth.uid()
    )
  );

CREATE POLICY "Members can delete household guests"
  ON household_guests FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM household_members hm
      WHERE hm.household_id = household_guests.household_id
        AND hm.user_id = auth.uid()
    )
  );

-- RLS for household_guest_groups
ALTER TABLE household_guest_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view household guest groups"
  ON household_guest_groups FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM household_members hm
      WHERE hm.household_id = household_guest_groups.household_id
        AND hm.user_id = auth.uid()
    )
  );

CREATE POLICY "Members can create household guest groups"
  ON household_guest_groups FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM household_members hm
      WHERE hm.household_id = household_guest_groups.household_id
        AND hm.user_id = auth.uid()
    )
  );

CREATE POLICY "Members can update household guest groups"
  ON household_guest_groups FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM household_members hm
      WHERE hm.household_id = household_guest_groups.household_id
        AND hm.user_id = auth.uid()
    )
  );

CREATE POLICY "Members can delete household guest groups"
  ON household_guest_groups FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM household_members hm
      WHERE hm.household_id = household_guest_groups.household_id
        AND hm.user_id = auth.uid()
    )
  );

-- RLS for household_guest_group_members
ALTER TABLE household_guest_group_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can manage guest group members"
  ON household_guest_group_members FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM household_guest_groups hgg
      JOIN household_members hm ON hm.household_id = hgg.household_id
      WHERE hgg.id = household_guest_group_members.group_id
        AND hm.user_id = auth.uid()
    )
  );

-- Merge household_item_rules into household_items and add alias support.
-- Run manually in Supabase dashboard before deploying application code.

-- 1. Extend household_items
ALTER TABLE household_items
  ADD COLUMN IF NOT EXISTS item_group text,
  ADD COLUMN IF NOT EXISTS split_overrides jsonb,
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();

-- 2. Migrate household_item_rules → household_items (rules win on name collision)
DO $$
DECLARE
  rule_row RECORD;
  existing_id uuid;
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'household_item_rules'
  ) THEN
    FOR rule_row IN
      SELECT id, household_id, name, category_id, item_group, split_overrides
      FROM household_item_rules
    LOOP
      SELECT id INTO existing_id
      FROM household_items
      WHERE household_id = rule_row.household_id
        AND lower(name) = lower(rule_row.name)
      LIMIT 1;

      IF existing_id IS NULL THEN
        INSERT INTO household_items (
          household_id,
          name,
          default_category_id,
          item_group,
          split_overrides
        ) VALUES (
          rule_row.household_id,
          rule_row.name,
          rule_row.category_id,
          rule_row.item_group,
          rule_row.split_overrides
        );
      ELSE
        UPDATE household_items
        SET
          default_category_id = rule_row.category_id,
          item_group = rule_row.item_group,
          split_overrides = rule_row.split_overrides
        WHERE id = existing_id;
      END IF;
    END LOOP;
  END IF;
END $$;

-- 3. Create household_item_aliases
CREATE TABLE IF NOT EXISTS household_item_aliases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  household_item_id uuid NOT NULL REFERENCES household_items(id) ON DELETE CASCADE,
  household_id uuid NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  alias_text text NOT NULL,
  display_text text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (household_id, alias_text)
);

CREATE INDEX IF NOT EXISTS idx_household_item_aliases_item_id
  ON household_item_aliases(household_item_id);

CREATE INDEX IF NOT EXISTS idx_household_item_aliases_household_id
  ON household_item_aliases(household_id);

-- 4. RLS on household_item_aliases
ALTER TABLE household_item_aliases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "household members can select aliases"
  ON household_item_aliases FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM household_members hm
      WHERE hm.household_id = household_item_aliases.household_id
        AND hm.user_id = auth.uid()
    )
  );

CREATE POLICY "household members can insert aliases"
  ON household_item_aliases FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM household_members hm
      WHERE hm.household_id = household_item_aliases.household_id
        AND hm.user_id = auth.uid()
    )
  );

CREATE POLICY "household members can update aliases"
  ON household_item_aliases FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM household_members hm
      WHERE hm.household_id = household_item_aliases.household_id
        AND hm.user_id = auth.uid()
    )
  );

CREATE POLICY "household members can delete aliases"
  ON household_item_aliases FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM household_members hm
      WHERE hm.household_id = household_item_aliases.household_id
        AND hm.user_id = auth.uid()
    )
  );

-- 5. Drop legacy table after migration (optional — uncomment after smoke test)
-- DROP TABLE IF EXISTS household_item_rules;

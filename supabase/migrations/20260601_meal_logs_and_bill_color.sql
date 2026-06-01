-- ─── meal_logs table ─────────────────────────────────────────────────────────

CREATE TABLE meal_logs (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id          uuid NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  recipe_id             uuid NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  made_by_member_id     uuid NOT NULL REFERENCES household_members(id) ON DELETE CASCADE,
  made_at               date NOT NULL DEFAULT current_date,
  notes                 text,
  created_at            timestamptz DEFAULT now()
);

CREATE INDEX idx_meal_logs_household_date ON meal_logs(household_id, made_at DESC);
CREATE INDEX idx_meal_logs_recipe ON meal_logs(recipe_id);

ALTER TABLE meal_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view meal logs"
  ON meal_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM household_members hm
      WHERE hm.household_id = meal_logs.household_id
        AND hm.user_id = auth.uid()
    )
  );

CREATE POLICY "Members can insert meal logs"
  ON meal_logs FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM household_members hm
      WHERE hm.household_id = meal_logs.household_id
        AND hm.user_id = auth.uid()
    )
  );

CREATE POLICY "Members can delete their own meal logs"
  ON meal_logs FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM household_members hm
      WHERE hm.id = meal_logs.made_by_member_id
        AND hm.user_id = auth.uid()
    )
  );

-- ─── color column on recurring_expenses ──────────────────────────────────────

ALTER TABLE recurring_expenses ADD COLUMN color text DEFAULT '#ef4444';

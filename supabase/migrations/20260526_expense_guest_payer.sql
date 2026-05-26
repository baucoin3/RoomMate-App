-- Allow guest-only expense split rows (household_member_id was NOT NULL in base schema)
ALTER TABLE expense_splits ALTER COLUMN household_member_id DROP NOT NULL;

-- Guest payer support on expenses (exactly one of member or guest pays)
ALTER TABLE expenses ALTER COLUMN paid_by_member_id DROP NOT NULL;

ALTER TABLE expenses ADD COLUMN paid_by_guest_id uuid
  REFERENCES household_guests(id) ON DELETE SET NULL;

ALTER TABLE expenses ADD CONSTRAINT expenses_payer_check CHECK (
  (paid_by_member_id IS NOT NULL AND paid_by_guest_id IS NULL) OR
  (paid_by_member_id IS NULL AND paid_by_guest_id IS NOT NULL)
);

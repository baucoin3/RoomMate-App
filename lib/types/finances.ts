export interface HouseholdMemberSummary {
  id: string
  nickname: string
}

export interface CategorySplit {
  id: string
  category_id: string
  household_member_id: string
  percentage: number
  member?: HouseholdMemberSummary
}

export interface ExpenseCategory {
  id: string
  household_id: string
  name: string
  paid_by_member_id: string | null
  payer?: HouseholdMemberSummary
  splits?: CategorySplit[]
}

export interface RecurringExpenseSplit {
  id: string
  recurring_expense_id: string
  household_member_id: string
  percentage: number
  amount: number
  member?: HouseholdMemberSummary
}

export interface RecurringExpense {
  id: string
  household_id: string
  category_id: string | null
  category_name?: string
  description: string
  amount: number
  paid_by_member_id: string
  payer?: HouseholdMemberSummary
  due_day_of_month: number
  alert_days_before: number
  is_active: boolean
  splits: RecurringExpenseSplit[]
}

export interface BalanceEntry {
  to_member?: HouseholdMemberSummary
  from_member?: HouseholdMemberSummary
  category: { id: string; name: string }
  amount: number
  expense_count: number
}

export interface BalanceSummary {
  you_owe: BalanceEntry[]
  owed_to_you: BalanceEntry[]
}

export interface RoommateShare {
  member_id: string
  nickname: string
  amount: number
}

export interface UpcomingBill {
  recurring_expense_id: string
  description: string
  category_name: string
  due_date: string
  is_overdue: boolean
  days_until: number
  alert_days_before: number
  your_share: number
  payer: HouseholdMemberSummary
  you_are_payer: boolean
  /** Populated only when you_are_payer — one entry per non-payer roommate. */
  roommate_shares: RoommateShare[]
}

export interface ActivityItem {
  id: string
  date: string
  description: string
  category_name: string
  total_amount: number
  paid_by: HouseholdMemberSummary
  your_split: {
    calculated_amount: number
    is_settled: boolean
  } | null
  all_splits?: {
    member: HouseholdMemberSummary
    calculated_amount: number
    is_settled: boolean
  }[]
}

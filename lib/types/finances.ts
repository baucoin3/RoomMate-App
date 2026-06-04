export interface HouseholdMemberSummary {
  id: string
  nickname: string
}

export interface SplitParticipant {
  type: 'member' | 'guest'
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
  color: string
  splits: RecurringExpenseSplit[]
}

export interface OweReceipt {
  id: string
  merchant_name: string | null
  receipt_date: string | null
}

export interface OweItem {
  split_id: string
  expense_id: string
  description: string
  date: string
  amount: number
  debtor?: SplitParticipant
  creditor?: SplitParticipant
  receipt: OweReceipt | null
}

export interface OweSummary {
  owed_to_you: OweItem[]
  you_owe: OweItem[]
}

export interface SettledItem {
  split_id: string
  expense_id: string
  description: string
  date: string
  amount: number
  other_party: HouseholdMemberSummary
  you_paid: boolean
}

export interface ActivitySplitRow {
  participant: SplitParticipant
  calculated_amount: number
  is_settled: boolean
}

export interface ActivityItem {
  id: string
  date: string
  description: string
  category_name: string
  total_amount: number
  paid_by: SplitParticipant
  your_split: {
    calculated_amount: number
    is_settled: boolean
  } | null
  all_splits?: ActivitySplitRow[]
}

export type RecurringBillCycleStatus = 'not_logged' | 'logged'

export interface RecurringBillMemberStatus {
  member_id: string
  member_name: string
  share_amount: number
  is_payer: boolean
  is_viewer: boolean
  /** Only meaningful when cycle_status === 'logged' */
  is_settled: boolean | null
  /** Only when logged — use for settle button */
  split_id: string | null
  /** True if member has a row in recurring_payment_reports for the current cycle */
  self_reported: boolean
}

export interface RecurringBillOverview {
  recurring_expense_id: string
  description: string
  category_name: string | null
  total_amount: number
  due_day_of_month: number
  alert_days_before: number
  is_active: boolean
  payer: HouseholdMemberSummary
  cycle_status: RecurringBillCycleStatus
  /** ISO date of the due date for the current billing cycle */
  cycle_due_date: string
  /** Present when cycle_status === 'logged' */
  cycle_expense_id: string | null
  /** Per-member rows for this cycle */
  members: RecurringBillMemberStatus[]
  /** Convenience totals for the viewer */
  viewer_owes_amount: number
  viewer_is_payer: boolean
  viewer_collect_total: number
  viewer_collect_unsettled_total: number
}

/**
 * Dashboard domain types.
 * All three sections may be null/empty if no data exists yet.
 */

export interface RentMember {
  memberId: string
  memberName: string
  hasPaid: boolean
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
}

export interface Balance {
  memberId: string
  memberName: string
  /** Positive: they owe you. Negative: you owe them. */
  netAmount: number
}

export type ActivityItemType = 'expense' | 'shopping_item'

export interface ActivityItem {
  id: string
  type: ActivityItemType
  actorName: string
  description: string
  amount?: number
  createdAt: string
}

export interface DashboardData {
  rentStatus: RentStatus | null
  balances: Balance[]
  recentActivity: ActivityItem[]
}

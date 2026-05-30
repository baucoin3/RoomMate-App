export type ActivityItemType = 'expense' | 'shopping_item'

export interface ActivityItem {
  id: string
  type: ActivityItemType
  actorName: string
  description: string
  amount?: number
  createdAt: string
}

export interface RecurringBillAlert {
  id: string
  description: string
  totalAmount: number
  dueDayOfMonth: number
  /** Negative means overdue */
  daysUntilDue: number
  cycleDueDate: string
}

export interface GetStartedStatus {
  hasHouseholdName: boolean
  hasRecurringBills: boolean
  hasMultipleMembers: boolean
}

export interface DashboardData {
  getStarted: GetStartedStatus
  recurringAlerts: RecurringBillAlert[]
  recentActivity: ActivityItem[]
}

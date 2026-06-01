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

export interface CalendarMealLog {
  date: string
  recipe_name: string
  made_by_name: string
}

export interface CalendarBillDot {
  due_day: number
  description: string
  color: string
}

export interface CalendarData {
  meal_logs: CalendarMealLog[]
  bill_dots: CalendarBillDot[]
}

export interface DashboardData {
  getStarted: GetStartedStatus
  recurringAlerts: RecurringBillAlert[]
  recentActivity: ActivityItem[]
  calendar: CalendarData
}

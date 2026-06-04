export type ActivityItemType = 'expense' | 'shopping_item'

export interface ActivityItem {
  id: string
  type: ActivityItemType
  actorName: string
  description: string
  amount?: number
  createdAt: string
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

export interface CalendarReceiptDot {
  date: string
  merchant_name: string | null
}

export interface CalendarCustomEvent {
  id: string
  date: string
  title: string
  note: string | null
}

export interface CalendarData {
  meal_logs: CalendarMealLog[]
  bill_dots: CalendarBillDot[]
  receipt_dots: CalendarReceiptDot[]
  custom_events: CalendarCustomEvent[]
}

export interface DashboardData {
  getStarted: GetStartedStatus
  recentActivity: ActivityItem[]
  calendar: CalendarData
}

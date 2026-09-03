export type TaskCategory = 'fitness' | 'home' | 'work' | 'errands'
export type TaskScope = 'personal' | 'household'

export interface DailyTask {
  id: string
  householdId: string
  title: string
  category: TaskCategory
  timeOfDay: string | null  // "HH:MM:SS" or null if no time set
  logsToCalendar: boolean
  createdBy: string
  createdAt: string
  done: boolean             // derived: completion exists for current period
  scope: TaskScope
}

export interface DailyTaskCompletion {
  id: string
  taskId: string
  completedOn: string       // "YYYY-MM-DD"
  completedBy: string
}

export interface CreateDailyTaskPayload {
  title: string
  category: TaskCategory
  timeOfDay: string | null  // "HH:MM:SS" or null
  logsToCalendar: boolean
  scope: TaskScope
}

export interface NocturneCalendarEvent {
  time: string    // "6:30 PM" format, or "—" if no time
  title: string
  cat: TaskCategory
}

export type NocturneCalendarData = Record<string, NocturneCalendarEvent[]>

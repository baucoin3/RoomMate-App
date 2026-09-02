export type TaskCategory = 'fitness' | 'home' | 'work' | 'errands'

export interface DailyTask {
  id: string
  householdId: string
  title: string
  category: TaskCategory
  timeOfDay: string        // "HH:MM:SS"
  logsToCalendar: boolean
  createdBy: string
  createdAt: string
  done: boolean            // derived: completion exists for today
}

export interface DailyTaskCompletion {
  id: string
  taskId: string
  completedOn: string      // "YYYY-MM-DD"
  completedBy: string
}

export interface CreateDailyTaskPayload {
  title: string
  category: TaskCategory
  timeOfDay: string        // "HH:MM:SS"
  logsToCalendar: boolean
}

export interface NocturneCalendarEvent {
  time: string    // "6:30 PM" format, or "—" if no time
  title: string
  cat: TaskCategory
}

export type NocturneCalendarData = Record<string, NocturneCalendarEvent[]>

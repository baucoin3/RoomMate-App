export type TaskCategory = string
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
  done: boolean             // derived: completionCount >= targetCompletionsPerDay
  scope: TaskScope
  targetCompletionsPerDay: number  // how many times this task must be completed per day
  weeklyTarget: number             // how many days per week this task should be completed
  completionCount: number          // how many times completed today
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
  targetCompletionsPerDay: number
  weeklyTarget: number
}

export interface UpdateDailyTaskPayload {
  title?: string
  category?: TaskCategory
  timeOfDay?: string | null
  logsToCalendar?: boolean
  scope?: TaskScope
  targetCompletionsPerDay?: number
  weeklyTarget?: number
}

export interface NocturneCalendarEvent {
  time: string       // "6:30 PM" format, or "—" if no time
  title: string
  cat: TaskCategory
  type: 'task' | 'event' | 'meal'
  done?: boolean     // type='task' only — whether completed for this date
  taskId?: string    // type='task'
  eventId?: string   // type='event'
  mealLogId?: string // type='meal'
  completionCount?: number          // type='task' multi-tap: how many times done on this date
  targetCompletionsPerDay?: number  // type='task' multi-tap: required count for full done
}

export type NocturneCalendarData = Record<string, NocturneCalendarEvent[]>

export interface WeeklyRate {
  rate: number         // 0–100
  completedDays: number
}

export interface TaskStruggleStat {
  taskId: string
  title: string
  category: string
  daysCompleted: number   // 0–7 (last 7 days)
  isStruggling: boolean   // daysCompleted < task.weeklyTarget
}

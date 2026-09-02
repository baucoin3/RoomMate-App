import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  DailyTask,
  DailyTaskCompletion,
  CreateDailyTaskPayload,
  NocturneCalendarData,
  NocturneCalendarEvent,
  TaskCategory,
} from '@/lib/types/dailyTasks'

export function formatTimeOfDay(timeOfDay: string): string {
  const [hStr, mStr] = timeOfDay.split(':')
  const h = parseInt(hStr, 10)
  const m = parseInt(mStr, 10)
  const period = h < 12 ? 'AM' : 'PM'
  const h12 = h % 12 === 0 ? 12 : h % 12
  return `${h12}:${String(m).padStart(2, '0')} ${period}`
}

export function timeDisplayToMinutes(timeStr: string): number {
  const match = /^(\d+):(\d+)\s*(AM|PM)$/i.exec(timeStr.trim())
  if (!match) return 99999
  let h = parseInt(match[1], 10) % 12
  if (match[3].toUpperCase() === 'PM') h += 12
  return h * 60 + parseInt(match[2], 10)
}

export function timeDisplayToTimeOfDay(timeStr: string): string {
  const match = /^(\d+):(\d+)\s*(AM|PM)$/i.exec(timeStr.trim())
  if (!match) return '00:00:00'
  let h = parseInt(match[1], 10) % 12
  if (match[3].toUpperCase() === 'PM') h += 12
  const min = parseInt(match[2], 10)
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}:00`
}

export async function getDailyTasks(
  supabase: SupabaseClient,
  householdId: string,
): Promise<{ data: DailyTask[] | null; error: string | null }> {
  try {
    const today = new Date().toLocaleDateString('en-CA')

    const [tasksResult, completionsResult] = await Promise.all([
      supabase
        .from('daily_tasks')
        .select('id, household_id, title, category, time_of_day, logs_to_calendar, created_by, created_at')
        .eq('household_id', householdId)
        .order('time_of_day'),
      supabase
        .from('daily_task_completions')
        .select('task_id')
        .eq('completed_on', today),
    ])

    if (tasksResult.error) return { data: null, error: tasksResult.error.message }

    const completedTodayIds = new Set(
      (completionsResult.data ?? []).map((c) => c.task_id as string),
    )

    const tasks: DailyTask[] = (tasksResult.data ?? []).map((t) => ({
      id: t.id as string,
      householdId: t.household_id as string,
      title: t.title as string,
      category: t.category as TaskCategory,
      timeOfDay: t.time_of_day as string,
      logsToCalendar: t.logs_to_calendar as boolean,
      createdBy: t.created_by as string,
      createdAt: t.created_at as string,
      done: completedTodayIds.has(t.id as string),
    }))

    return { data: tasks, error: null }
  } catch (err) {
    console.error('[dailyTasks/getDailyTasks]', err)
    return { data: null, error: 'Failed to load daily tasks.' }
  }
}

export async function getStreak(
  supabase: SupabaseClient,
  householdId: string,
): Promise<number> {
  try {
    const { data: fitnessTasks } = await supabase
      .from('daily_tasks')
      .select('id')
      .eq('household_id', householdId)
      .eq('category', 'fitness')
      .eq('logs_to_calendar', true)

    if (!fitnessTasks?.length) return 0

    const taskIds = fitnessTasks.map((t) => t.id as string)

    const { data: completions } = await supabase
      .from('daily_task_completions')
      .select('completed_on')
      .in('task_id', taskIds)
      .order('completed_on', { ascending: false })

    if (!completions?.length) return 0

    const distinctDates = Array.from(
      new Set(completions.map((c) => c.completed_on as string)),
    ).sort().reverse()

    const today = new Date()
    today.setHours(0, 0, 0, 0)
    let streak = 0
    const expected = new Date(today)

    for (const dateStr of distinctDates) {
      const date = new Date(dateStr)
      date.setHours(0, 0, 0, 0)
      if (date.getTime() === expected.getTime()) {
        streak++
        expected.setDate(expected.getDate() - 1)
      } else if (date < expected) {
        break
      }
    }

    return streak
  } catch (err) {
    console.error('[dailyTasks/getStreak]', err)
    return 0
  }
}

export async function getStreakDays(
  supabase: SupabaseClient,
  householdId: string,
): Promise<boolean[]> {
  try {
    const { data: fitnessTasks } = await supabase
      .from('daily_tasks')
      .select('id')
      .eq('household_id', householdId)
      .eq('category', 'fitness')
      .eq('logs_to_calendar', true)

    if (!fitnessTasks?.length) return Array(7).fill(false)

    const taskIds = fitnessTasks.map((t) => t.id as string)
    const today = new Date()
    const sixDaysAgo = new Date(today)
    sixDaysAgo.setDate(sixDaysAgo.getDate() - 6)

    const { data: completions } = await supabase
      .from('daily_task_completions')
      .select('completed_on')
      .in('task_id', taskIds)
      .gte('completed_on', sixDaysAgo.toLocaleDateString('en-CA'))
      .lte('completed_on', today.toLocaleDateString('en-CA'))

    const completedDates = new Set(
      (completions ?? []).map((c) => c.completed_on as string),
    )

    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(today)
      d.setDate(d.getDate() - (6 - i))
      return completedDates.has(d.toLocaleDateString('en-CA'))
    })
  } catch (err) {
    console.error('[dailyTasks/getStreakDays]', err)
    return Array(7).fill(false)
  }
}

export async function createDailyTask(
  supabase: SupabaseClient,
  householdId: string,
  userId: string,
  payload: CreateDailyTaskPayload,
): Promise<{ data: DailyTask | null; error: string | null }> {
  try {
    const { data, error } = await supabase
      .from('daily_tasks')
      .insert({
        household_id: householdId,
        title: payload.title,
        category: payload.category,
        time_of_day: payload.timeOfDay,
        logs_to_calendar: payload.logsToCalendar,
        created_by: userId,
      })
      .select('id, household_id, title, category, time_of_day, logs_to_calendar, created_by, created_at')
      .single()

    if (error) return { data: null, error: error.message }

    return {
      data: {
        id: data.id as string,
        householdId: data.household_id as string,
        title: data.title as string,
        category: data.category as TaskCategory,
        timeOfDay: data.time_of_day as string,
        logsToCalendar: data.logs_to_calendar as boolean,
        createdBy: data.created_by as string,
        createdAt: data.created_at as string,
        done: false,
      },
      error: null,
    }
  } catch (err) {
    console.error('[dailyTasks/createDailyTask]', err)
    return { data: null, error: 'Failed to create task.' }
  }
}

export async function completeDailyTask(
  supabase: SupabaseClient,
  taskId: string,
  userId: string,
  date: string,
): Promise<{ data: DailyTaskCompletion | null; error: string | null }> {
  try {
    const { data, error } = await supabase
      .from('daily_task_completions')
      .upsert(
        { task_id: taskId, completed_on: date, completed_by: userId },
        { onConflict: 'task_id,completed_on' },
      )
      .select('id, task_id, completed_on, completed_by')
      .single()

    if (error) return { data: null, error: error.message }

    return {
      data: {
        id: data.id as string,
        taskId: data.task_id as string,
        completedOn: data.completed_on as string,
        completedBy: data.completed_by as string,
      },
      error: null,
    }
  } catch (err) {
    console.error('[dailyTasks/completeDailyTask]', err)
    return { data: null, error: 'Failed to complete task.' }
  }
}

export async function uncompleteDailyTask(
  supabase: SupabaseClient,
  taskId: string,
  userId: string,
  date: string,
): Promise<{ error: string | null }> {
  try {
    const { error } = await supabase
      .from('daily_task_completions')
      .delete()
      .eq('task_id', taskId)
      .eq('completed_by', userId)
      .eq('completed_on', date)

    if (error) return { error: error.message }
    return { error: null }
  } catch (err) {
    console.error('[dailyTasks/uncompleteDailyTask]', err)
    return { error: 'Failed to uncomplete task.' }
  }
}

type CompletionRow = {
  completed_on: string
  daily_tasks: {
    title: string
    category: string
    time_of_day: string
    logs_to_calendar: boolean
    household_id: string
  }
}

export async function getCalendarEventsForDateRange(
  supabase: SupabaseClient,
  householdId: string,
  startDate: string,
  endDate: string,
): Promise<{ data: NocturneCalendarData | null; error: string | null }> {
  try {
    const [eventsResult, completionsResult] = await Promise.all([
      supabase
        .from('household_events')
        .select('date, title')
        .eq('household_id', householdId)
        .gte('date', startDate)
        .lte('date', endDate)
        .order('date'),
      supabase
        .from('daily_task_completions')
        .select('completed_on, daily_tasks!inner(title, category, time_of_day, logs_to_calendar, household_id)')
        .eq('daily_tasks.household_id', householdId)
        .eq('daily_tasks.logs_to_calendar', true)
        .gte('completed_on', startDate)
        .lte('completed_on', endDate),
    ])

    const result: NocturneCalendarData = {}

    for (const ev of eventsResult.data ?? []) {
      const k = ev.date as string
      if (!result[k]) result[k] = []
      result[k].push({ time: '—', title: ev.title as string, cat: 'home' })
    }

    for (const comp of (completionsResult.data ?? []) as unknown as CompletionRow[]) {
      const k = comp.completed_on
      if (!result[k]) result[k] = []
      const ev: NocturneCalendarEvent = {
        time: formatTimeOfDay(comp.daily_tasks.time_of_day),
        title: comp.daily_tasks.title + ' — logged',
        cat: comp.daily_tasks.category as TaskCategory,
      }
      result[k].push(ev)
    }

    for (const k of Object.keys(result)) {
      result[k].sort((a, b) => {
        if (a.time === '—') return 1
        if (b.time === '—') return -1
        return timeDisplayToMinutes(a.time) - timeDisplayToMinutes(b.time)
      })
    }

    return { data: result, error: null }
  } catch (err) {
    console.error('[dailyTasks/getCalendarEventsForDateRange]', err)
    return { data: null, error: 'Failed to load calendar events.' }
  }
}

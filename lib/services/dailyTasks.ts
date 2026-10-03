import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  DailyTask,
  DailyTaskCompletion,
  CreateDailyTaskPayload,
  UpdateDailyTaskPayload,
  NocturneCalendarData,
  NocturneCalendarEvent,
  TaskCategory,
  TaskScope,
  WeeklyRate,
  TaskStruggleStat,
} from '@/lib/types/dailyTasks'
import { DAILY_TASKS } from '@/locales/en'

// The "day" resets at 9am, not midnight. Before 9am we're still in yesterday's period.
export function getCurrentPeriodDate(): string {
  const now = new Date()
  if (now.getHours() < 9) {
    const yesterday = new Date(now)
    yesterday.setDate(yesterday.getDate() - 1)
    return yesterday.toLocaleDateString('en-CA')
  }
  return now.toLocaleDateString('en-CA')
}

export function formatTimeOfDay(timeOfDay: string | null): string {
  if (!timeOfDay) return ''
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
  userId: string,
): Promise<{ data: DailyTask[] | null; error: string | null }> {
  try {
    const today = getCurrentPeriodDate()

    const tasksResult = await supabase
      .from('daily_tasks')
      .select('id, household_id, title, category, time_of_day, logs_to_calendar, created_by, created_at, scope, target_completions_per_day, weekly_target')
      .eq('household_id', householdId)
      .or(`scope.eq.household,and(scope.eq.personal,created_by.eq.${userId})`)
      .order('time_of_day', { ascending: true, nullsFirst: false })

    if (tasksResult.error) return { data: null, error: tasksResult.error.message }

    const taskIds = (tasksResult.data ?? []).map((t) => t.id as string)

    const completionsResult = taskIds.length > 0
      ? await supabase
          .from('daily_task_completions')
          .select('task_id')
          .in('task_id', taskIds)
          .eq('completed_on', today)
      : { data: [], error: null }

    // Count completions per task for today
    const completionCountMap = new Map<string, number>()
    for (const c of (completionsResult.data ?? [])) {
      const id = c.task_id as string
      completionCountMap.set(id, (completionCountMap.get(id) ?? 0) + 1)
    }

    const tasks: DailyTask[] = (tasksResult.data ?? []).map((t) => {
      const target = (t.target_completions_per_day as number) ?? 1
      const count = completionCountMap.get(t.id as string) ?? 0
      return {
        id: t.id as string,
        householdId: t.household_id as string,
        title: t.title as string,
        category: t.category as TaskCategory,
        timeOfDay: (t.time_of_day as string | null) ?? null,
        logsToCalendar: t.logs_to_calendar as boolean,
        createdBy: t.created_by as string,
        createdAt: t.created_at as string,
        done: count >= target,
        scope: (t.scope as TaskScope) ?? 'personal',
        targetCompletionsPerDay: target,
        weeklyTarget: (t.weekly_target as number) ?? 7,
        completionCount: count,
      }
    })

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
        time_of_day: payload.timeOfDay ?? null,
        logs_to_calendar: payload.logsToCalendar,
        created_by: userId,
        scope: payload.scope,
        target_completions_per_day: payload.targetCompletionsPerDay,
        weekly_target: payload.weeklyTarget,
      })
      .select('id, household_id, title, category, time_of_day, logs_to_calendar, created_by, created_at, scope, target_completions_per_day, weekly_target')
      .single()

    if (error) return { data: null, error: error.message }

    return {
      data: {
        id: data.id as string,
        householdId: data.household_id as string,
        title: data.title as string,
        category: data.category as TaskCategory,
        timeOfDay: (data.time_of_day as string | null) ?? null,
        logsToCalendar: data.logs_to_calendar as boolean,
        createdBy: data.created_by as string,
        createdAt: data.created_at as string,
        done: false,
        scope: (data.scope as TaskScope) ?? 'personal',
        targetCompletionsPerDay: (data.target_completions_per_day as number) ?? 1,
        weeklyTarget: (data.weekly_target as number) ?? 7,
        completionCount: 0,
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
): Promise<{ data: DailyTaskCompletion | null; isFullyDone: boolean; error: string | null }> {
  try {
    // Fetch target for this task
    const { data: taskRow, error: taskErr } = await supabase
      .from('daily_tasks')
      .select('target_completions_per_day')
      .eq('id', taskId)
      .single()

    if (taskErr) return { data: null, isFullyDone: false, error: taskErr.message }

    const target = (taskRow.target_completions_per_day as number) ?? 1

    // Count existing completions for this task today
    const { data: existing, error: countErr } = await supabase
      .from('daily_task_completions')
      .select('completion_index')
      .eq('task_id', taskId)
      .eq('completed_on', date)

    if (countErr) return { data: null, isFullyDone: false, error: countErr.message }

    const currentCount = (existing ?? []).length

    if (currentCount >= target) {
      return { data: null, isFullyDone: true, error: null }
    }

    const nextIndex = currentCount + 1

    const { data, error } = await supabase
      .from('daily_task_completions')
      .insert({ task_id: taskId, completed_on: date, completed_by: userId, completion_index: nextIndex })
      .select('id, task_id, completed_on, completed_by')
      .single()

    if (error) return { data: null, isFullyDone: false, error: error.message }

    const isFullyDone = nextIndex >= target

    return {
      data: {
        id: data.id as string,
        taskId: data.task_id as string,
        completedOn: data.completed_on as string,
        completedBy: data.completed_by as string,
      },
      isFullyDone,
      error: null,
    }
  } catch (err) {
    console.error('[dailyTasks/completeDailyTask]', err)
    return { data: null, isFullyDone: false, error: 'Failed to complete task.' }
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

export async function resetDailyTasksForToday(
  supabase: SupabaseClient,
  householdId: string,
  userId: string,
): Promise<{ error: string | null }> {
  try {
    const today = getCurrentPeriodDate()

    const [personalResult, householdResult] = await Promise.all([
      supabase
        .from('daily_tasks')
        .select('id')
        .eq('household_id', householdId)
        .eq('scope', 'personal')
        .eq('created_by', userId),
      supabase
        .from('daily_tasks')
        .select('id')
        .eq('household_id', householdId)
        .eq('scope', 'household'),
    ])

    const personalIds = (personalResult.data ?? []).map((t) => t.id as string)
    const householdIds = (householdResult.data ?? []).map((t) => t.id as string)

    if (personalIds.length > 0) {
      await supabase
        .from('daily_task_completions')
        .delete()
        .in('task_id', personalIds)
        .eq('completed_by', userId)
        .eq('completed_on', today)
    }

    if (householdIds.length > 0) {
      await supabase
        .from('daily_task_completions')
        .delete()
        .in('task_id', householdIds)
        .eq('completed_on', today)
    }
    return { error: null }
  } catch (err) {
    console.error('[dailyTasks/resetDailyTasksForToday]', err)
    return { error: 'Failed to reset daily tasks.' }
  }
}

export async function updateDailyTask(
  supabase: SupabaseClient,
  taskId: string,
  householdId: string,
  userId: string,
  payload: UpdateDailyTaskPayload,
): Promise<{ data: DailyTask | null; error: string | null }> {
  try {
    const updates: Record<string, unknown> = {}
    if (payload.title !== undefined) updates.title = payload.title
    if (payload.category !== undefined) updates.category = payload.category
    if (payload.timeOfDay !== undefined) updates.time_of_day = payload.timeOfDay
    if (payload.logsToCalendar !== undefined) updates.logs_to_calendar = payload.logsToCalendar
    if (payload.scope !== undefined) updates.scope = payload.scope
    if (payload.targetCompletionsPerDay !== undefined) updates.target_completions_per_day = payload.targetCompletionsPerDay
    if (payload.weeklyTarget !== undefined) updates.weekly_target = payload.weeklyTarget

    console.log(`\n\nIN UPDATE SETRVICE FUNC: updates = ${JSON.stringify(updates)}\n\n`);
    const { error: updateError } = await supabase
      .from('daily_tasks')
      .update(updates)
      .eq('id', taskId)
      .eq('household_id', householdId)

            console.log(`\nn\ From supa base update updateErrro = ${JSON.stringify(updateError)}`);

    if (updateError) return { data: null, error: updateError.message }

    
    const { data, error } = await supabase
      .from('daily_tasks')
      .select('id, household_id, title, category, time_of_day, logs_to_calendar, created_by, created_at, scope, target_completions_per_day, weekly_target')
      .eq('id', taskId)
      .eq('household_id', householdId)
      .single()

    
    if (error || !data) return { data: null, error: error?.message ?? 'Task not found.' }

    const today = getCurrentPeriodDate()
    const { data: comps } = await supabase
      .from('daily_task_completions')
      .select('id')
      .eq('task_id', taskId)
      .eq('completed_on', today)

    const target = (data.target_completions_per_day as number) ?? 1
    const count = (comps ?? []).length

    return {
      data: {
        id: data.id as string,
        householdId: data.household_id as string,
        title: data.title as string,
        category: data.category as TaskCategory,
        timeOfDay: (data.time_of_day as string | null) ?? null,
        logsToCalendar: data.logs_to_calendar as boolean,
        createdBy: data.created_by as string,
        createdAt: data.created_at as string,
        done: count >= target,
        scope: (data.scope as TaskScope) ?? 'personal',
        targetCompletionsPerDay: target,
        weeklyTarget: (data.weekly_target as number) ?? 7,
        completionCount: count,
      },
      error: null,
    }
  } catch (err) {
    console.error('[dailyTasks/updateDailyTask]', err)
    return { data: null, error: 'Failed to update task.' }
  }
}

export async function deleteDailyTask(
  supabase: SupabaseClient,
  taskId: string,
  householdId: string,
): Promise<{ error: string | null }> {
  try {
    // Completions are deleted via ON DELETE CASCADE if FK is set, otherwise delete manually
    await supabase.from('daily_task_completions').delete().eq('task_id', taskId)

    const { error } = await supabase
      .from('daily_tasks')
      .delete()
      .eq('id', taskId)
      .eq('household_id', householdId)

    if (error) return { error: error.message }
    return { error: null }
  } catch (err) {
    console.error('[dailyTasks/deleteDailyTask]', err)
    return { error: 'Failed to delete task.' }
  }
}

export async function getWeeklyCompletionRate(
  supabase: SupabaseClient,
  householdId: string,
  userId: string,
): Promise<WeeklyRate> {
  try {
    const today = new Date()
    const sixDaysAgo = new Date(today)
    sixDaysAgo.setDate(sixDaysAgo.getDate() - 6)
    const startDate = sixDaysAgo.toLocaleDateString('en-CA')
    const endDate = today.toLocaleDateString('en-CA')

    // Get all tasks visible to this user
    const { data: tasks } = await supabase
      .from('daily_tasks')
      .select('id')
      .eq('household_id', householdId)
      .or(`scope.eq.household,and(scope.eq.personal,created_by.eq.${userId})`)

    if (!tasks?.length) return { rate: 0, completedDays: 0 }

    const taskIds = tasks.map((t) => t.id as string)

    const { data: completions } = await supabase
      .from('daily_task_completions')
      .select('completed_on')
      .in('task_id', taskIds)
      .gte('completed_on', startDate)
      .lte('completed_on', endDate)

    const activeDays = new Set((completions ?? []).map((c) => c.completed_on as string))
    const completedDays = activeDays.size

    return {
      rate: Math.round((completedDays / 7) * 100),
      completedDays,
    }
  } catch (err) {
    console.error('[dailyTasks/getWeeklyCompletionRate]', err)
    return { rate: 0, completedDays: 0 }
  }
}

type TaskRow = {
  id: string
  title: string
  category: string
  time_of_day: string | null
  target_completions_per_day: number
}

type HouseholdEventRow = {
  id: string
  date: string
  title: string
  scope: string
  created_by_user_id: string | null
  completed: boolean | null
}

type MealLogCalRow = {
  id: string
  made_at: string
  recipes: { name: string } | null
}

export async function getCalendarEventsForDateRange(
  supabase: SupabaseClient,
  householdId: string,
  startDate: string,
  endDate: string,
  userId?: string,
): Promise<{ data: NocturneCalendarData | null; error: string | null }> {
  try {
    // Step 1: fetch all visible tasks for the household
    const scopeFilter = userId
      ? `scope.eq.household,and(scope.eq.personal,created_by.eq.${userId})`
      : 'scope.eq.household'

    const { data: taskRows, error: tasksError } = await supabase
      .from('daily_tasks')
      .select('id, title, category, time_of_day, target_completions_per_day')
      .eq('household_id', householdId)
      .or(scopeFilter)
      .order('time_of_day', { ascending: true, nullsFirst: false })

    if (tasksError) return { data: null, error: tasksError.message }

    const tasks = (taskRows ?? []) as unknown as TaskRow[]
    const taskIds = tasks.map((t) => t.id)

    // Step 2: fetch completions + household events + meal logs in parallel
    const [completionsResult, eventsResult, mealLogsResult] = await Promise.all([
      taskIds.length > 0
        ? supabase
            .from('daily_task_completions')
            .select('task_id, completed_on')
            .in('task_id', taskIds)
            .gte('completed_on', startDate)
            .lte('completed_on', endDate)
        : Promise.resolve({ data: [], error: null }),
      supabase
        .from('household_events')
        .select('id, date, title, scope, created_by_user_id, completed')
        .eq('household_id', householdId)
        .gte('date', startDate)
        .lte('date', endDate),
      supabase
        .from('meal_logs')
        .select('id, made_at, recipes(name)')
        .eq('household_id', householdId)
        .gte('made_at', startDate)
        .lte('made_at', endDate),
    ])

    if (eventsResult.error) return { data: null, error: eventsResult.error.message }

    // Build O(1) completion count lookup: "taskId::date" → count
    const completionCountMap = new Map<string, number>()
    for (const c of (completionsResult.data ?? [])) {
      const key = `${c.task_id as string}::${c.completed_on as string}`
      completionCountMap.set(key, (completionCountMap.get(key) ?? 0) + 1)
    }

    // Generate all dates in range
    const dates: string[] = []
    const cursor = new Date(startDate + 'T12:00:00')
    const rangeEnd = new Date(endDate + 'T12:00:00')
    while (cursor <= rangeEnd) {
      dates.push(cursor.toLocaleDateString('en-CA'))
      cursor.setDate(cursor.getDate() + 1)
    }

    const result: NocturneCalendarData = {}

    for (const date of dates) {
      // Tasks: all visible tasks shown on every day
      const taskEvents: NocturneCalendarEvent[] = tasks.map((t) => {
        const target = (t.target_completions_per_day as number) ?? 1
        const count = completionCountMap.get(`${t.id}::${date}`) ?? 0
        return {
          type: 'task' as const,
          time: t.time_of_day ? formatTimeOfDay(t.time_of_day) : '—',
          title: t.title,
          cat: t.category as TaskCategory,
          done: count >= target,
          taskId: t.id,
          completionCount: count,
          targetCompletionsPerDay: target,
        }
      })

      // Household events for this date
      const dayEvents: NocturneCalendarEvent[] = ((eventsResult.data ?? []) as unknown as HouseholdEventRow[])
        .filter((ev) => ev.date === date && !(ev.scope === 'personal' && ev.created_by_user_id !== userId))
        .map((ev) => ({ type: 'event' as const, time: '—', title: ev.title, cat: 'home' as TaskCategory, eventId: ev.id, done: ev.completed ?? false }))

      // Meal logs for this date
      const dayMeals: NocturneCalendarEvent[] = ((mealLogsResult.data ?? []) as unknown as MealLogCalRow[])
        .filter((ml) => ml.made_at === date)
        .map((ml) => ({
          type: 'meal' as const,
          time: '—',
          title: `${DAILY_TASKS.MEAL_CAL_PREFIX}${ml.recipes?.name ?? 'a meal'}`,
          cat: 'meals' as TaskCategory,
          done: true,
          mealLogId: ml.id,
        }))

      const combined = [...taskEvents, ...dayEvents, ...dayMeals]
      if (combined.length > 0) result[date] = combined
    }

    return { data: result, error: null }
  } catch (err) {
    console.error('[dailyTasks/getCalendarEventsForDateRange]', err)
    return { data: null, error: 'Failed to load calendar events.' }
  }
}

export async function getTaskStruggleStats(
  supabase: SupabaseClient,
  householdId: string,
  userId: string,
): Promise<{ data: TaskStruggleStat[] | null; error: string | null }> {
  try {
    const today = new Date()
    const sixDaysAgo = new Date(today)
    sixDaysAgo.setDate(sixDaysAgo.getDate() - 6)
    const startDate = sixDaysAgo.toLocaleDateString('en-CA')
    const endDate = today.toLocaleDateString('en-CA')

    const { data: taskRows, error: tasksError } = await supabase
      .from('daily_tasks')
      .select('id, title, category, weekly_target')
      .eq('household_id', householdId)
      .or(`scope.eq.household,and(scope.eq.personal,created_by.eq.${userId})`)

    if (tasksError) return { data: null, error: tasksError.message }
    if (!taskRows?.length) return { data: [], error: null }

    const taskIds = taskRows.map((t) => t.id as string)

    const { data: completions, error: compError } = await supabase
      .from('daily_task_completions')
      .select('task_id, completed_on')
      .in('task_id', taskIds)
      .gte('completed_on', startDate)
      .lte('completed_on', endDate)

    if (compError) return { data: null, error: compError.message }

    // Count distinct completed days per task
    const taskDayMap = new Map<string, Set<string>>()
    for (const t of taskRows) taskDayMap.set(t.id as string, new Set())
    for (const c of (completions ?? [])) {
      taskDayMap.get(c.task_id as string)?.add(c.completed_on as string)
    }

    const stats: TaskStruggleStat[] = taskRows
      .map((t) => {
        const daysCompleted = taskDayMap.get(t.id as string)?.size ?? 0
        const weeklyTarget = (t.weekly_target as number) ?? 7
        return {
          taskId: t.id as string,
          title: t.title as string,
          category: t.category as string,
          daysCompleted,
          isStruggling: daysCompleted < weeklyTarget,
        }
      })
      .sort((a, b) => a.daysCompleted - b.daysCompleted)

    return { data: stats, error: null }
  } catch (err) {
    console.error('[dailyTasks/getTaskStruggleStats]', err)
    return { data: null, error: 'Failed to load task struggle stats.' }
  }
}

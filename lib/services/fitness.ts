import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  FitnessRoutine,
  FitnessExercise,
  FitnessRoutineWithExercises,
  FitnessSession,
  FitnessSessionWithCompletions,
  FitnessSetCompletion,
  FitnessMetrics,
  ExerciseMetric,
  ProgressMetrics,
  ProgressStreaks,
  WeeklyBucket,
  SessionDayDetail,
  SessionSetDetail,
  CompletedSetRecord,
} from '@/lib/types/fitness'

export async function getRoutines(
  supabase: SupabaseClient,
  householdId: string,
  userId: string,
): Promise<FitnessRoutineWithExercises[]> {
  const { data, error } = await supabase
    .from('fitness_routines')
    .select('id, household_id, name, created_by, created_at, is_active, fitness_exercises(id, routine_id, name, sets, reps, weight, weight_unit, sort_order, created_at)')
    .eq('household_id', householdId)
    .eq('created_by', userId)
    .eq('is_active', true)
    .order('created_at', { ascending: true })

  if (error) throw new Error(error.message)
  return (data ?? []) as FitnessRoutineWithExercises[]
}

export async function createRoutine(
  supabase: SupabaseClient,
  householdId: string,
  userId: string,
  name: string,
): Promise<FitnessRoutine> {
  const { data, error } = await supabase
    .from('fitness_routines')
    .insert({ household_id: householdId, created_by: userId, name })
    .select('id, household_id, name, created_by, created_at, is_active')
    .single()

  if (error) throw new Error(error.message)
  return data as FitnessRoutine
}

export async function updateRoutine(
  supabase: SupabaseClient,
  routineId: string,
  userId: string,
  updates: { name?: string; is_active?: boolean },
): Promise<FitnessRoutine> {
  const { data, error } = await supabase
    .from('fitness_routines')
    .update(updates)
    .eq('id', routineId)
    .eq('created_by', userId)
    .select('id, household_id, name, created_by, created_at, is_active')
    .single()

  if (error) throw new Error(error.message)
  return data as FitnessRoutine
}

export async function deleteRoutine(
  supabase: SupabaseClient,
  routineId: string,
  userId: string,
): Promise<void> {
  const { error } = await supabase
    .from('fitness_routines')
    .update({ is_active: false })
    .eq('id', routineId)
    .eq('created_by', userId)

  if (error) throw new Error(error.message)
}

export async function createExercise(
  supabase: SupabaseClient,
  payload: Omit<FitnessExercise, 'id' | 'created_at'>,
): Promise<FitnessExercise> {
  const { data, error } = await supabase
    .from('fitness_exercises')
    .insert(payload)
    .select('id, routine_id, name, sets, reps, weight, weight_unit, sort_order, created_at')
    .single()

  if (error) throw new Error(error.message)
  return data as FitnessExercise
}

export async function updateExercise(
  supabase: SupabaseClient,
  exerciseId: string,
  updates: Partial<Pick<FitnessExercise, 'name' | 'sets' | 'reps' | 'weight' | 'weight_unit' | 'sort_order'>>,
): Promise<FitnessExercise> {
  const { data, error } = await supabase
    .from('fitness_exercises')
    .update(updates)
    .eq('id', exerciseId)
    .select('id, routine_id, name, sets, reps, weight, weight_unit, sort_order, created_at')
    .single()

  if (error) throw new Error(error.message)
  return data as FitnessExercise
}

export async function deleteExercise(
  supabase: SupabaseClient,
  exerciseId: string,
): Promise<void> {
  const { error } = await supabase
    .from('fitness_exercises')
    .delete()
    .eq('id', exerciseId)

  if (error) throw new Error(error.message)
}

export async function createSession(
  supabase: SupabaseClient,
  householdId: string,
  routineId: string,
  userId: string,
  sessionDate: string,
): Promise<FitnessSessionWithCompletions> {
  const { data, error } = await supabase
    .from('fitness_sessions')
    .insert({ household_id: householdId, routine_id: routineId, user_id: userId, session_date: sessionDate, started_at: new Date().toISOString() })
    .select('id, household_id, routine_id, user_id, session_date, started_at, completed_at')
    .single()

  if (error) throw new Error(error.message)
  const session = data as FitnessSession

  return { ...session, fitness_set_completions: [] }
}

export async function getActiveSession(
  supabase: SupabaseClient,
  userId: string,
): Promise<FitnessSessionWithCompletions | null> {
  const { data, error } = await supabase
    .from('fitness_sessions')
    .select('id, household_id, routine_id, user_id, session_date, started_at, completed_at')
    .eq('user_id', userId)
    .is('completed_at', null)
    .order('session_date', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!data) return null

  const session = data as FitnessSession
  const { data: completions, error: completionsError } = await supabase
    .from('fitness_set_completions')
    .select('id, session_id, exercise_id, set_number, actual_reps, actual_weight, completed_at')
    .eq('session_id', session.id)

  if (completionsError) throw new Error(completionsError.message)

  return { ...session, fitness_set_completions: (completions ?? []) as FitnessSetCompletion[] }
}

export async function autoCompleteStaleSession(
  supabase: SupabaseClient,
  userId: string,
): Promise<boolean> {
  // Use yesterday UTC as threshold — prevents marking today's local-date session
  // as stale when client timezone is behind UTC (e.g. EDT at 9 PM = UTC next day)
  const safeThreshold = new Date(Date.now() - 86400000).toISOString().slice(0, 10)

  const { data: stale, error: fetchError } = await supabase
    .from('fitness_sessions')
    .select('id, session_date')
    .eq('user_id', userId)
    .is('completed_at', null)
    .lt('session_date', safeThreshold)
    .limit(10)

  if (fetchError) throw new Error(fetchError.message)
  if (!stale || stale.length === 0) return false

  const staleIds = stale.map((s) => s.id as string)
  const { error: updateError } = await supabase
    .from('fitness_sessions')
    .update({ completed_at: new Date().toISOString() })
    .in('id', staleIds)

  if (updateError) throw new Error(updateError.message)
  return true
}

export async function completeSession(
  supabase: SupabaseClient,
  sessionId: string,
  userId: string,
): Promise<FitnessSession> {
  const { data, error } = await supabase
    .from('fitness_sessions')
    .update({ completed_at: new Date().toISOString() })
    .eq('id', sessionId)
    .eq('user_id', userId)
    .select('id, household_id, routine_id, user_id, session_date, started_at, completed_at')
    .single()

  if (error) throw new Error(error.message)
  return data as FitnessSession
}

export async function upsertSetCompletion(
  supabase: SupabaseClient,
  payload: Omit<FitnessSetCompletion, 'id' | 'completed_at'>,
): Promise<FitnessSetCompletion> {
  const { data, error } = await supabase
    .from('fitness_set_completions')
    .upsert(
      { ...payload, completed_at: new Date().toISOString() },
      { onConflict: 'session_id,exercise_id,set_number' },
    )
    .select('id, session_id, exercise_id, set_number, actual_reps, actual_weight, completed_at')
    .single()

  if (error) throw new Error(error.message)
  return data as FitnessSetCompletion
}

export async function getSessionDayDetail(
  supabase: SupabaseClient,
  sessionId: string,
  userId: string,
): Promise<SessionDayDetail> {
  const { data: session, error: sessionError } = await supabase
    .from('fitness_sessions')
    .select('id, household_id, routine_id, user_id, session_date, started_at, completed_at, fitness_routines(name)')
    .eq('id', sessionId)
    .eq('user_id', userId)
    .single()

  if (sessionError) throw new Error(sessionError.message)

  const sessionData = session as FitnessSession & { fitness_routines: { name: string }[] | null }
  const routineName = sessionData.fitness_routines?.[0]?.name ?? 'Unknown routine'

  const durationMinutes =
    sessionData.completed_at && sessionData.started_at
      ? Math.round(
          (new Date(sessionData.completed_at).getTime() - new Date(sessionData.started_at).getTime()) / 60000,
        )
      : null

  const { data: exercises, error: exercisesError } = await supabase
    .from('fitness_exercises')
    .select('id, name, sets, reps, weight, weight_unit, sort_order')
    .eq('routine_id', sessionData.routine_id)
    .order('sort_order', { ascending: true })

  if (exercisesError) throw new Error(exercisesError.message)

  const { data: completions, error: completionsError } = await supabase
    .from('fitness_set_completions')
    .select('exercise_id, set_number, actual_reps, actual_weight')
    .eq('session_id', sessionId)

  if (completionsError) throw new Error(completionsError.message)

  const completionsByExercise = new Map<string, CompletedSetRecord[]>()
  for (const c of completions ?? []) {
    const exId = c.exercise_id as string
    if (!completionsByExercise.has(exId)) completionsByExercise.set(exId, [])
    completionsByExercise.get(exId)!.push({
      set_number: c.set_number as number,
      actual_reps: c.actual_reps as number | null,
      actual_weight: c.actual_weight as number | null,
    })
  }

  const exerciseDetails: SessionSetDetail[] = (exercises ?? []).map((ex) => ({
    exercise_id: ex.id as string,
    exercise_name: ex.name as string,
    configured_sets: ex.sets as number,
    configured_reps: ex.reps as number,
    configured_weight: ex.weight as number | null,
    weight_unit: ex.weight_unit as 'lbs' | 'kg' | 'bodyweight',
    completed_sets: completionsByExercise.get(ex.id as string) ?? [],
  }))

  return {
    session: sessionData as unknown as FitnessSession,
    routine_name: routineName,
    duration_minutes: durationMinutes,
    exercises: exerciseDetails,
  }
}

// ── Legacy metrics (kept for backward compat during transition) ───────────────

export async function getMetrics(
  supabase: SupabaseClient,
  householdId: string,
  userId: string,
  year: number,
  month: number,
): Promise<FitnessMetrics> {
  const startDate = `${year}-${String(month).padStart(2, '0')}-01`
  const endMonth = month === 12 ? 1 : month + 1
  const endYear = month === 12 ? year + 1 : year
  const endDate = `${endYear}-${String(endMonth).padStart(2, '0')}-01`

  const { data: sessions, error: sessionsError } = await supabase
    .from('fitness_sessions')
    .select('id, session_date')
    .eq('household_id', householdId)
    .eq('user_id', userId)
    .gte('session_date', startDate)
    .lt('session_date', endDate)

  if (sessionsError) throw new Error(sessionsError.message)

  const sessionIds = (sessions ?? []).map((s) => s.id)
  const workoutDays = (sessions ?? []).map((s) => s.session_date as string)

  if (sessionIds.length === 0) {
    return { year, month, workout_days: [], total_sessions: 0, exercise_breakdown: [] }
  }

  const { data: completions, error: completionsError } = await supabase
    .from('fitness_set_completions')
    .select('exercise_id, actual_reps, actual_weight, session_id, fitness_exercises(name)')
    .in('session_id', sessionIds)

  if (completionsError) throw new Error(completionsError.message)

  const exerciseMap = new Map<string, { name: string; totalWeight: number; weightCount: number; totalReps: number; repsCount: number; sets: number }>()

  for (const row of completions ?? []) {
    const id = row.exercise_id as string
    const fitnessExercise = row.fitness_exercises as unknown as { name: string } | null
    const name = fitnessExercise?.name ?? id
    if (!exerciseMap.has(id)) {
      exerciseMap.set(id, { name, totalWeight: 0, weightCount: 0, totalReps: 0, repsCount: 0, sets: 0 })
    }
    const entry = exerciseMap.get(id)!
    entry.sets += 1
    if (row.actual_weight != null) {
      entry.totalWeight += row.actual_weight as number
      entry.weightCount += 1
    }
    if (row.actual_reps != null) {
      entry.totalReps += row.actual_reps as number
      entry.repsCount += 1
    }
  }

  const exercise_breakdown: ExerciseMetric[] = Array.from(exerciseMap.entries()).map(([exercise_id, e]) => ({
    exercise_id,
    exercise_name: e.name,
    avg_weight: e.weightCount > 0 ? Math.round((e.totalWeight / e.weightCount) * 10) / 10 : null,
    avg_reps: e.repsCount > 0 ? Math.round((e.totalReps / e.repsCount) * 10) / 10 : null,
    total_sets: e.sets,
  }))

  return {
    year,
    month,
    workout_days: workoutDays,
    total_sessions: sessionIds.length,
    exercise_breakdown,
  }
}

// ── New progress metrics ──────────────────────────────────────────────────────

export async function getProgressMetrics(
  supabase: SupabaseClient,
  householdId: string,
  userId: string,
  year: number,
  month: number,
): Promise<ProgressMetrics> {
  // Fetch last 12 weeks of sessions (always, regardless of month param)
  const twelveWeeksAgo = new Date()
  twelveWeeksAgo.setDate(twelveWeeksAgo.getDate() - 84)
  const twelveWeeksAgoStr = twelveWeeksAgo.toISOString().slice(0, 10)

  // Monthly window for calendar
  const startDate = `${year}-${String(month).padStart(2, '0')}-01`
  const endMonth = month === 12 ? 1 : month + 1
  const endYear = month === 12 ? year + 1 : year
  const endDate = `${endYear}-${String(endMonth).padStart(2, '0')}-01`

  // Fetch all sessions for last 12 weeks (for streaks + weekly buckets)
  const { data: allSessions, error: allSessionsError } = await supabase
    .from('fitness_sessions')
    .select('id, session_date, completed_at, routine_id')
    .eq('household_id', householdId)
    .eq('user_id', userId)
    .gte('session_date', twelveWeeksAgoStr)
    .order('session_date', { ascending: true })

  if (allSessionsError) throw new Error(allSessionsError.message)

  const sessions = allSessions ?? []
  const completedSessions = sessions.filter((s) => s.completed_at != null)
  const completedDates = new Set(completedSessions.map((s) => s.session_date as string))

  // Fetch monthly sessions for calendar
  const monthlySessions = sessions.filter(
    (s) => s.session_date >= startDate && s.session_date < endDate,
  )
  const workoutDays = monthlySessions
    .filter((s) => s.completed_at != null)
    .map((s) => s.session_date as string)
  const incompleteDays = monthlySessions
    .filter((s) => s.completed_at == null)
    .map((s) => s.session_date as string)

  // Compute streaks from all completed session dates (sorted)
  const allCompletedDatesSorted = Array.from(completedDates).sort()
  const streaks = computeStreaks(allCompletedDatesSorted)

  // Fetch weekly buckets
  const weeklyBuckets = await buildWeeklyBuckets(supabase, userId, sessions)

  return {
    streaks,
    weeklyBuckets,
    workoutDays,
    incompleteDays,
    year,
    month,
  }
}

function computeStreaks(sortedDates: string[]): ProgressStreaks {
  if (sortedDates.length === 0) {
    return { currentStreak: 0, longestStreak: 0, workoutsThisWeek: 0, totalSessions: sortedDates.length }
  }

  const today = new Date().toISOString().slice(0, 10)
  const dateSet = new Set(sortedDates)

  // Current streak: count backwards from today
  let currentStreak = 0
  const cursor = new Date()
  while (true) {
    const d = cursor.toISOString().slice(0, 10)
    if (dateSet.has(d)) {
      currentStreak++
      cursor.setDate(cursor.getDate() - 1)
    } else {
      // Allow gap of 1 day (today may not have workout yet)
      if (d === today) {
        cursor.setDate(cursor.getDate() - 1)
        const prev = cursor.toISOString().slice(0, 10)
        if (dateSet.has(prev)) {
          // yesterday worked out — streak continues
          continue
        }
      }
      break
    }
  }

  // Longest streak
  let longestStreak = 0
  let run = 1
  for (let i = 1; i < sortedDates.length; i++) {
    const prev = new Date(sortedDates[i - 1])
    const curr = new Date(sortedDates[i])
    const diffDays = Math.round((curr.getTime() - prev.getTime()) / 86400000)
    if (diffDays === 1) {
      run++
      longestStreak = Math.max(longestStreak, run)
    } else {
      run = 1
    }
  }
  longestStreak = Math.max(longestStreak, run)

  // Workouts this week (Mon–Sun)
  const todayDate = new Date()
  const dayOfWeek = todayDate.getDay() // 0 = Sun
  const monday = new Date(todayDate)
  monday.setDate(todayDate.getDate() - ((dayOfWeek + 6) % 7))
  monday.setHours(0, 0, 0, 0)
  const workoutsThisWeek = sortedDates.filter((d) => new Date(d) >= monday).length

  return {
    currentStreak,
    longestStreak,
    workoutsThisWeek,
    totalSessions: sortedDates.length,
  }
}

async function buildWeeklyBuckets(
  supabase: SupabaseClient,
  userId: string,
  sessions: Array<{ id: string; session_date: string; completed_at: string | null; routine_id: string }>,
): Promise<WeeklyBucket[]> {
  const completedSessions = sessions.filter((s) => s.completed_at != null)
  if (completedSessions.length === 0) return []

  const sessionIds = completedSessions.map((s) => s.id)
  const routineIds = Array.from(new Set(completedSessions.map((s) => s.routine_id)))

  // Fetch configured sets per routine (sum of exercises.sets per routine)
  const { data: exercises, error: exError } = await supabase
    .from('fitness_exercises')
    .select('routine_id, sets')
    .in('routine_id', routineIds)

  if (exError) throw new Error(exError.message)

  const configuredSetsPerRoutine = new Map<string, number>()
  for (const ex of exercises ?? []) {
    const rid = ex.routine_id as string
    configuredSetsPerRoutine.set(rid, (configuredSetsPerRoutine.get(rid) ?? 0) + (ex.sets as number))
  }

  // Fetch completed set counts per session
  const { data: completionCounts, error: ccError } = await supabase
    .from('fitness_set_completions')
    .select('session_id')
    .in('session_id', sessionIds)

  if (ccError) throw new Error(ccError.message)

  const completedSetsPerSession = new Map<string, number>()
  for (const c of completionCounts ?? []) {
    const sid = c.session_id as string
    completedSetsPerSession.set(sid, (completedSetsPerSession.get(sid) ?? 0) + 1)
  }

  // Build 12 weekly buckets (oldest first)
  const today = new Date()
  const buckets: WeeklyBucket[] = []

  for (let w = 11; w >= 0; w--) {
    const weekEnd = new Date(today)
    weekEnd.setDate(today.getDate() - w * 7)
    const weekStart = new Date(weekEnd)
    weekStart.setDate(weekEnd.getDate() - 6)

    const weekStartStr = weekStart.toISOString().slice(0, 10)
    const weekEndStr = weekEnd.toISOString().slice(0, 10)

    const weekSessions = completedSessions.filter(
      (s) => s.session_date >= weekStartStr && s.session_date <= weekEndStr,
    )

    const workoutDays = weekSessions.length
    const totalConfiguredSets = weekSessions.reduce(
      (sum, s) => sum + (configuredSetsPerRoutine.get(s.routine_id) ?? 0),
      0,
    )
    const completedSets = weekSessions.reduce(
      (sum, s) => sum + (completedSetsPerSession.get(s.id) ?? 0),
      0,
    )
    const compliancePct =
      totalConfiguredSets > 0 ? Math.round((completedSets / totalConfiguredSets) * 100) : 0

    const label = weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

    buckets.push({
      weekLabel: label,
      weekStart: weekStartStr,
      workoutDays,
      totalConfiguredSets,
      completedSets,
      compliancePct,
    })
  }

  return buckets
}

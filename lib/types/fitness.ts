export interface FitnessRoutine {
  id: string
  household_id: string
  name: string
  created_by: string
  created_at: string
  is_active: boolean
}

export interface FitnessExercise {
  id: string
  routine_id: string
  name: string
  sets: number
  reps: number
  weight: number | null
  weight_unit: 'lbs' | 'kg' | 'bodyweight'
  sort_order: number
  created_at: string
}

export interface FitnessSession {
  id: string
  household_id: string
  routine_id: string
  user_id: string
  session_date: string
  started_at: string
  completed_at: string | null
}

export interface FitnessSetCompletion {
  id: string
  session_id: string
  exercise_id: string
  set_number: number
  actual_reps: number | null
  actual_weight: number | null
  completed_at: string
}

export interface FitnessRoutineWithExercises extends FitnessRoutine {
  fitness_exercises: FitnessExercise[]
}

export interface FitnessSessionWithCompletions extends FitnessSession {
  fitness_set_completions: FitnessSetCompletion[]
}

export interface ExerciseMetric {
  exercise_id: string
  exercise_name: string
  avg_weight: number | null
  avg_reps: number | null
  total_sets: number
}

export interface FitnessMetrics {
  year: number
  month: number
  workout_days: string[]
  total_sessions: number
  exercise_breakdown: ExerciseMetric[]
}

// ── New types for overhaul ────────────────────────────────────────────────────

export type EffectStyle = 'arcade' | 'sleek' | 'energy' | 'neon'

export interface WeeklyBucket {
  weekLabel: string
  weekStart: string
  workoutDays: number
  totalConfiguredSets: number
  completedSets: number
  compliancePct: number
}

export interface ProgressStreaks {
  currentStreak: number
  longestStreak: number
  workoutsThisWeek: number
  totalSessions: number
}

export interface ProgressMetrics {
  streaks: ProgressStreaks
  weeklyBuckets: WeeklyBucket[]
  workoutDays: string[]
  incompleteDays: string[]
  year: number
  month: number
}

export interface CompletedSetRecord {
  set_number: number
  actual_reps: number | null
  actual_weight: number | null
}

export interface SessionSetDetail {
  exercise_id: string
  exercise_name: string
  configured_sets: number
  configured_reps: number
  configured_weight: number | null
  weight_unit: 'lbs' | 'kg' | 'bodyweight'
  completed_sets: CompletedSetRecord[]
}

export interface SessionDayDetail {
  session: FitnessSession
  routine_name: string
  duration_minutes: number | null
  exercises: SessionSetDetail[]
}

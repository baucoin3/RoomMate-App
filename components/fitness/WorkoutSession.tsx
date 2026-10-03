'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { apiClient } from '@/lib/api/client'
import { ROUTES } from '@/lib/constants/routes'
import { FITNESS } from '@/locales/en'
import { triggerEffect } from './ParticleEffect'
import WorkoutSetView from './WorkoutSetView'
import type {
  FitnessSessionWithCompletions,
  FitnessRoutineWithExercises,
  FitnessSetCompletion,
} from '@/lib/types/fitness'

interface WorkoutSessionProps {
  householdId: string
  userId: string
}

export default function WorkoutSession({ householdId }: WorkoutSessionProps) {
  const router = useRouter()

  const [session, setSession] = useState<FitnessSessionWithCompletions | null>(null)
  const [routine, setRoutine] = useState<FitnessRoutineWithExercises | null>(null)
  const [currentSet, setCurrentSet] = useState(1)
  const [elapsedMin, setElapsedMin] = useState(0)
  const [loading, setLoading] = useState(true)
  const [completing, setCompleting] = useState(false)
  const [setDoneAnim, setSetDoneAnim] = useState(false)
  const [transitioning, setTransitioning] = useState(false)
  const [incompleteWarning, setIncompleteWarning] = useState(false)
  const [pendingNextSet, setPendingNextSet] = useState(false)

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const startTimer = useCallback((startedAt: string) => {
    if (timerRef.current) clearInterval(timerRef.current)
    const update = () => {
      setElapsedMin(Math.floor((Date.now() - new Date(startedAt).getTime()) / 60000))
    }
    update()
    timerRef.current = setInterval(update, 60000)
  }, [])

  useEffect(() => {
    async function load() {
      try {
        const [sessionRes, routinesRes] = await Promise.all([
          apiClient.get<{ data: FitnessSessionWithCompletions | null }>(
            `/api/fitness/${householdId}/sessions`,
          ),
          apiClient.get<{ data: FitnessRoutineWithExercises[] }>(
            `/api/fitness/${householdId}/routines`,
          ),
        ])

        const activeSession = sessionRes.data.data
        if (!activeSession) {
          router.replace(ROUTES.HOUSEHOLD_FITNESS(householdId))
          return
        }

        const matchingRoutine = routinesRes.data.data.find(
          (r) => r.id === activeSession.routine_id,
        ) ?? null

        setSession(activeSession)
        setRoutine(matchingRoutine)
        startTimer(activeSession.started_at)

        // Determine furthest set already completed to resume from
        if (activeSession.fitness_set_completions.length > 0) {
          const maxSet = Math.max(...activeSession.fitness_set_completions.map((c) => c.set_number))
          const maxSets = matchingRoutine
            ? Math.max(...matchingRoutine.fitness_exercises.map((e) => e.sets), 1)
            : 1
          setCurrentSet(Math.min(maxSet, maxSets))
        }
      } catch {
        router.replace(ROUTES.HOUSEHOLD_FITNESS(householdId))
      } finally {
        setLoading(false)
      }
    }
    load()
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [householdId, router, startTimer])

  const maxSets = routine ? Math.max(...routine.fitness_exercises.map((e) => e.sets), 1) : 1

  const completionsForCurrentSet = session?.fitness_set_completions.filter(
    (c) => c.set_number === currentSet,
  ) ?? []

  const exercisesForCurrentSet = routine?.fitness_exercises.filter(
    (e) => e.sets >= currentSet,
  ) ?? []

  const completedExerciseIds = new Set(completionsForCurrentSet.map((c) => c.exercise_id))
  const allChecked =
    exercisesForCurrentSet.length > 0 &&
    exercisesForCurrentSet.every((e) => completedExerciseIds.has(e.id))

  async function handleCheck(
    exerciseId: string,
    setNumber: number,
    actualReps: number,
    actualWeight: number | null,
    originEl: HTMLElement | null,
  ) {
    if (!session) return
    try {
      const res = await apiClient.put<{ data: FitnessSetCompletion }>(
        `/api/fitness/${householdId}/set-completions`,
        { session_id: session.id, exercise_id: exerciseId, set_number: setNumber, actual_reps: actualReps, actual_weight: actualWeight },
      )
      const completion = res.data.data
      setSession((prev) => {
        if (!prev) return prev
        const without = prev.fitness_set_completions.filter(
          (c) => !(c.exercise_id === exerciseId && c.set_number === setNumber),
        )
        return { ...prev, fitness_set_completions: [...without, completion] }
      })
      triggerEffect(originEl)

      // Check if all exercises for this set are now done
      const newCompleted = new Set([...Array.from(completedExerciseIds), exerciseId])
      const allNowDone = exercisesForCurrentSet.every((e) => newCompleted.has(e.id))
      if (allNowDone) {
        setTimeout(() => triggerAllSetDone(), 300)
      }
    } catch {
      // silent — set stays unchecked
    }
  }

  async function handleUncheck(exerciseId: string, setNumber: number) {
    if (!session) return
    setSession((prev) => {
      if (!prev) return prev
      return {
        ...prev,
        fitness_set_completions: prev.fitness_set_completions.filter(
          (c) => !(c.exercise_id === exerciseId && c.set_number === setNumber),
        ),
      }
    })
  }

  function triggerAllSetDone() {
    setSetDoneAnim(true)
    setTimeout(() => {
      setSetDoneAnim(false)
      if (currentSet < maxSets) {
        advanceSet()
      }
    }, 2200)
  }

  function advanceSet() {
    setTransitioning(true)
    setTimeout(() => {
      setCurrentSet((prev) => Math.min(prev + 1, maxSets))
      setTransitioning(false)
    }, 350)
  }

  function handleNextSetClick() {
    const uncheckedCount = exercisesForCurrentSet.filter(
      (e) => !completedExerciseIds.has(e.id),
    ).length
    if (uncheckedCount > 0) {
      setPendingNextSet(true)
      setIncompleteWarning(true)
      return
    }
    if (currentSet < maxSets) advanceSet()
  }

  function confirmNextSet() {
    setIncompleteWarning(false)
    setPendingNextSet(false)
    if (currentSet < maxSets) advanceSet()
  }

  async function handleCompleteWorkout() {
    if (!session) return
    setCompleting(true)
    try {
      await apiClient.patch(
        `/api/fitness/${householdId}/sessions/${session.id}`,
        {},
      )
      router.push(ROUTES.HOUSEHOLD_FITNESS(householdId))
    } catch {
      setCompleting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0f0f14]">
        <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!session || !routine) return null

  const exercises = routine.fitness_exercises.slice().sort((a, b) => a.sort_order - b.sort_order)
  const completedThisSetExercises = exercises.filter(
    (e) => e.sets < currentSet,
  )

  return (
    <div className="min-h-screen bg-[#0f0f14] text-white flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 flex-shrink-0">
        <button
          onClick={() => router.push(ROUTES.HOUSEHOLD_FITNESS(householdId))}
          className="text-purple-400 hover:text-purple-300 transition-colors text-sm font-medium"
        >
          {FITNESS.BACK_TO_ROUTINES}
        </button>
        <span className="font-bold text-white truncate max-w-[40%] text-center text-sm">
          {routine.name}
        </span>
        <span className="text-purple-300 text-sm font-mono tabular-nums">
          {FITNESS.TIMER_ELAPSED(elapsedMin)}
        </span>
      </div>

      {/* Set counter */}
      <div className="px-4 pt-6 pb-2 text-center flex-shrink-0">
        <div className="inline-flex items-center gap-2 bg-white/5 rounded-2xl px-6 py-2">
          <span className="text-3xl font-black text-white tracking-tight">
            {FITNESS.SET_COUNTER(currentSet, maxSets)}
          </span>
        </div>
        <div className="flex justify-center gap-2 mt-3">
          {Array.from({ length: maxSets }).map((_, i) => (
            <div
              key={i}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                i + 1 < currentSet
                  ? 'w-6 bg-green-400'
                  : i + 1 === currentSet
                  ? 'w-8 bg-purple-400'
                  : 'w-4 bg-white/20'
              }`}
            />
          ))}
        </div>
      </div>

      {/* Exercise list */}
      <div
        className={`flex-1 overflow-y-auto px-4 py-2 transition-all duration-350 ${
          transitioning ? 'opacity-0 translate-x-4' : 'opacity-100 translate-x-0'
        }`}
        style={{ transform: transitioning ? 'translateX(16px)' : 'translateX(0)' }}
      >
        <WorkoutSetView
          exercises={exercisesForCurrentSet}
          completions={completionsForCurrentSet}
          currentSet={currentSet}
          householdId={householdId}
          onCheck={handleCheck}
          onUncheck={handleUncheck}
        />

        {/* Completed-this-set section */}
        {completedThisSetExercises.length > 0 && (
          <div className="mt-4">
            <p className="text-xs font-semibold text-white/30 uppercase tracking-widest mb-2 px-1">
              {FITNESS.COMPLETED_SECTION_LABEL}
            </p>
            <div className="flex flex-col gap-2">
              {completedThisSetExercises.map((ex) => (
                <div
                  key={ex.id}
                  className="flex items-center gap-3 bg-white/5 rounded-xl px-4 py-3 opacity-50"
                >
                  <div className="w-5 h-5 rounded-full bg-green-500/30 flex items-center justify-center flex-shrink-0">
                    <svg className="w-3 h-3 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <span className="text-sm text-white/60 line-through">{ex.name}</span>
                  <span className="ml-auto text-xs text-white/30">{ex.sets} sets done</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Footer actions */}
      <div className="px-4 pb-6 pt-3 flex flex-col gap-3 flex-shrink-0 border-t border-white/10">
        {currentSet < maxSets && (
          <button
            onClick={handleNextSetClick}
            className="w-full py-4 rounded-2xl font-bold text-base bg-purple-600 hover:bg-purple-500 active:scale-[0.98] transition-all text-white shadow-lg shadow-purple-900/40"
          >
            {FITNESS.ACTION_NEXT_SET} ({currentSet}/{maxSets})
          </button>
        )}
        <button
          onClick={handleCompleteWorkout}
          disabled={completing}
          className="w-full py-3 rounded-2xl font-semibold text-sm border border-white/20 text-white/70 hover:text-white hover:border-white/40 transition-all disabled:opacity-50"
        >
          {completing ? 'Completing…' : FITNESS.ACTION_COMPLETE_WORKOUT}
        </button>
      </div>

      {/* Set Done overlay */}
      {setDoneAnim && (
        <div className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none">
          <div className="animate-set-done text-center">
            <div className="text-5xl font-black text-white drop-shadow-[0_0_30px_rgba(168,85,247,0.8)] tracking-tight">
              {FITNESS.SET_DONE(currentSet)}
            </div>
            <div className="text-purple-300 text-lg font-semibold mt-2">Keep going!</div>
          </div>
        </div>
      )}

      {/* Incomplete set warning */}
      {incompleteWarning && (
        <div className="fixed inset-0 bg-black/60 flex items-end justify-center z-50 p-4">
          <div className="bg-[#1a1a24] rounded-2xl p-6 w-full max-w-sm border border-white/10">
            <p className="text-white font-semibold text-center mb-1">Heads up</p>
            <p className="text-white/60 text-sm text-center mb-5">
              {FITNESS.WARNING_INCOMPLETE_SET(
                exercisesForCurrentSet.filter((e) => !completedExerciseIds.has(e.id)).length,
              )}
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => { setIncompleteWarning(false); setPendingNextSet(false) }}
                className="flex-1 py-3 rounded-xl border border-white/20 text-white/70 text-sm font-medium"
              >
                {FITNESS.ACTION_CANCEL}
              </button>
              <button
                onClick={confirmNextSet}
                className="flex-1 py-3 rounded-xl bg-purple-600 text-white text-sm font-bold"
              >
                {FITNESS.WARNING_CONTINUE}
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx global>{`
        @keyframes setDone {
          0% { opacity: 0; transform: scale(0.6) translateY(20px); }
          30% { opacity: 1; transform: scale(1.08) translateY(0); }
          70% { opacity: 1; transform: scale(1) translateY(0); }
          100% { opacity: 0; transform: scale(0.9) translateY(-10px); }
        }
        .animate-set-done {
          animation: setDone 2.2s ease-in-out forwards;
        }
      `}</style>
    </div>
  )
}

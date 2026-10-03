'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { FITNESS } from '@/locales/en'
import { apiClient, getErrorMessage } from '@/lib/api/client'
import { PlusIcon, XMarkIcon } from '@/components/icons'
import RoutineEditor from './RoutineEditor'
import ProgressDashboard from './ProgressDashboard'
import type {
  FitnessRoutineWithExercises,
  FitnessSessionWithCompletions,
} from '@/lib/types/fitness'
import { ROUTES } from '@/lib/constants/routes'

interface FitnessClientProps {
  householdId: string
  userId: string
}

interface EditingRoutineState {
  routine: FitnessRoutineWithExercises
  openAddExercise: boolean
}

const CARD_GRADIENTS = [
  { from: 'from-purple-800/50', to: 'to-purple-900/30', border: 'border-purple-600/30', accent: '#a855f7', dot: 'bg-purple-400' },
  { from: 'from-blue-800/50', to: 'to-blue-900/30', border: 'border-blue-600/30', accent: '#60a5fa', dot: 'bg-blue-400' },
  { from: 'from-emerald-800/50', to: 'to-emerald-900/30', border: 'border-emerald-600/30', accent: '#34d399', dot: 'bg-emerald-400' },
  { from: 'from-orange-800/50', to: 'to-orange-900/30', border: 'border-orange-600/30', accent: '#fb923c', dot: 'bg-orange-400' },
  { from: 'from-pink-800/50', to: 'to-pink-900/30', border: 'border-pink-600/30', accent: '#f472b6', dot: 'bg-pink-400' },
]

function todayDate(): string {
  return new Date().toLocaleDateString('en-CA')
}

export default function FitnessClient({ householdId }: FitnessClientProps) {
  const router = useRouter()

  const [routines, setRoutines] = useState<FitnessRoutineWithExercises[]>([])
  const [activeSession, setActiveSession] = useState<FitnessSessionWithCompletions | null>(null)
  const [loading, setLoading] = useState(true)
  const [startingId, setStartingId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [staleAutocompleted, setStaleAutocompleted] = useState(false)
  const [newRoutineName, setNewRoutineName] = useState('')
  const [showNewRoutine, setShowNewRoutine] = useState(false)
  const [savingRoutine, setSavingRoutine] = useState(false)
  const [editingRoutine, setEditingRoutine] = useState<EditingRoutineState | null>(null)
  const [activeTab, setActiveTab] = useState<'routines' | 'progress'>('routines')

  const loadData = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [routinesRes, sessionRes] = await Promise.all([
        apiClient.get<{ data: FitnessRoutineWithExercises[] }>(
          `/api/fitness/${householdId}/routines`,
        ),
        apiClient.get<{ data: FitnessSessionWithCompletions | null; autoCompleted: boolean }>(
          `/api/fitness/${householdId}/sessions`,
        ),
      ])
      setRoutines(routinesRes.data.data)
      setActiveSession(sessionRes.data.data)
      if (sessionRes.data.autoCompleted) setStaleAutocompleted(true)
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [householdId])

  useEffect(() => {
    void loadData()
  }, [loadData])

  async function handleStartWorkout(routine: FitnessRoutineWithExercises) {
    setStartingId(routine.id)
    setError('')
    try {
      // Create/get today's session for this routine
      await apiClient.post(
        `/api/fitness/${householdId}/sessions`,
        { routine_id: routine.id, session_date: todayDate() },
      )
      router.push(ROUTES.HOUSEHOLD_FITNESS_WORKOUT(householdId))
    } catch (err) {
      setError(getErrorMessage(err))
      setStartingId(null)
    }
  }

  function handleContinueWorkout() {
    router.push(ROUTES.HOUSEHOLD_FITNESS_WORKOUT(householdId))
  }

  async function handleCreateRoutine() {
    if (!newRoutineName.trim()) return
    setSavingRoutine(true)
    setError('')
    try {
      const res = await apiClient.post<{ data: FitnessRoutineWithExercises }>(
        `/api/fitness/${householdId}/routines`,
        { name: newRoutineName.trim() },
      )
      const newRoutine: FitnessRoutineWithExercises = { ...res.data.data, fitness_exercises: [] }
      setRoutines((prev) => [...prev, newRoutine])
      setNewRoutineName('')
      setShowNewRoutine(false)
      setEditingRoutine({ routine: newRoutine, openAddExercise: true })
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setSavingRoutine(false)
    }
  }

  async function handleDeleteRoutine(routine: FitnessRoutineWithExercises) {
    if (!window.confirm(FITNESS.CONFIRM_DELETE_ROUTINE)) return
    setError('')
    try {
      await apiClient.delete(`/api/fitness/${householdId}/routines/${routine.id}`)
      setRoutines((prev) => prev.filter((r) => r.id !== routine.id))
    } catch (err) {
      setError(getErrorMessage(err))
    }
  }

  function handleRoutineUpdated(updated: FitnessRoutineWithExercises) {
    setRoutines((prev) => prev.map((r) => r.id === updated.id ? updated : r))
    setEditingRoutine((prev) => prev ? { ...prev, routine: updated } : null)
  }

  function handleRoutineDeleted(routineId: string) {
    setRoutines((prev) => prev.filter((r) => r.id !== routineId))
    setEditingRoutine(null)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="w-7 h-7 rounded-full border-2 border-purple-500 border-t-transparent animate-spin" />
      </div>
    )
  }

  const hasActiveSession = activeSession != null
  const activeRoutine = hasActiveSession
    ? routines.find((r) => r.id === activeSession.routine_id)
    : null

  return (
    <div className="max-w-2xl mx-auto pb-10 px-0">
      {/* Page header + tabs */}
      <div className="flex items-center justify-between mb-6 mt-2">
        <h1 className="text-xl font-bold text-white">{FITNESS.PAGE_TITLE}</h1>
        <div className="flex gap-1 rounded-xl p-1 bg-white/5">
          <button
            onClick={() => setActiveTab('routines')}
            className="px-4 py-1.5 rounded-lg text-xs font-semibold transition-colors"
            style={{
              background: activeTab === 'routines' ? 'rgba(145,132,217,0.22)' : 'transparent',
              color: activeTab === 'routines' ? '#9184d9' : '#75798c',
            }}
          >
            Routines
          </button>
          <button
            onClick={() => setActiveTab('progress')}
            className="px-4 py-1.5 rounded-lg text-xs font-semibold transition-colors"
            style={{
              background: activeTab === 'progress' ? 'rgba(145,132,217,0.22)' : 'transparent',
              color: activeTab === 'progress' ? '#9184d9' : '#75798c',
            }}
          >
            Progress
          </button>
        </div>
      </div>

      {/* Stale session autocompleted notice */}
      {staleAutocompleted && (
        <div className="mb-4 rounded-xl px-4 py-3 text-sm text-amber-300 bg-amber-500/10 border border-amber-500/20">
          {FITNESS.STALE_SESSION_AUTOCOMPLETED}
        </div>
      )}

      {error && (
        <div className="mb-4 rounded-xl px-4 py-3 text-sm text-red-400 bg-red-500/10 border border-red-500/20">
          {error}
        </div>
      )}

      {activeTab === 'progress' ? (
        <ProgressDashboard householdId={householdId} />
      ) : (
        <>
          {/* Active session banner */}
          {hasActiveSession && activeRoutine && (
            <div className="mb-5 rounded-2xl p-4 bg-purple-600/20 border border-purple-500/30 flex items-center justify-between gap-3">
              <div>
                <p className="text-xs text-purple-300/70 font-semibold uppercase tracking-wide mb-0.5">Active Workout</p>
                <p className="text-white font-bold">{activeRoutine.name}</p>
              </div>
              <button
                onClick={handleContinueWorkout}
                className="px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-sm transition-colors flex-shrink-0 shadow-lg shadow-purple-900/40"
              >
                {FITNESS.ACTION_CONTINUE_WORKOUT}
              </button>
            </div>
          )}

          {/* Routines section header */}
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-white/50 uppercase tracking-widest">
              {FITNESS.SECTION_ROUTINES}
            </h2>
            <button
              onClick={() => setShowNewRoutine(true)}
              className="flex items-center gap-1 text-xs font-semibold text-purple-400 hover:text-purple-300 transition-colors"
            >
              <PlusIcon className="h-3.5 w-3.5" />
              {FITNESS.ACTION_NEW_ROUTINE}
            </button>
          </div>

          {/* New routine input */}
          {showNewRoutine && (
            <div className="flex gap-2 mb-4">
              <input
                autoFocus
                value={newRoutineName}
                onChange={(e) => setNewRoutineName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') void handleCreateRoutine() }}
                placeholder={FITNESS.ROUTINE_NAME_PLACEHOLDER}
                className="flex-1 rounded-xl px-3 py-2.5 text-sm text-white bg-white/10 border border-white/10 focus:outline-none focus:ring-1 focus:ring-purple-500"
              />
              <button
                onClick={() => void handleCreateRoutine()}
                disabled={savingRoutine || !newRoutineName.trim()}
                className="px-4 py-2.5 rounded-xl text-sm font-semibold bg-purple-600/30 text-purple-300 disabled:opacity-40 transition-colors hover:bg-purple-600/50"
              >
                {FITNESS.ACTION_SAVE}
              </button>
              <button
                onClick={() => { setShowNewRoutine(false); setNewRoutineName('') }}
                className="px-3 py-2.5 rounded-xl text-sm text-white/40 hover:text-white/70 transition-colors"
              >
                {FITNESS.ACTION_CANCEL}
              </button>
            </div>
          )}

          {/* Empty state */}
          {routines.length === 0 && !showNewRoutine && (
            <div className="text-center py-16 text-white/30 text-sm">
              <div className="text-4xl mb-3">💪</div>
              {FITNESS.EMPTY_ROUTINES}
            </div>
          )}

          {/* Routine cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {routines.map((routine, i) => {
              const grad = CARD_GRADIENTS[i % CARD_GRADIENTS.length]
              const exerciseCount = routine.fitness_exercises.length
              const isActive = activeSession?.routine_id === routine.id
              const isStarting = startingId === routine.id

              return (
                <div
                  key={routine.id}
                  className={`bg-gradient-to-br ${grad.from} ${grad.to} rounded-2xl border ${grad.border} p-4 flex flex-col gap-3 transition-all duration-200`}
                >
                  {/* Card header */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <div className={`w-2 h-2 rounded-full ${grad.dot} flex-shrink-0`} />
                        <h3 className="font-bold text-white text-base leading-tight truncate">
                          {routine.name}
                        </h3>
                      </div>
                      <p className="text-xs text-white/40 ml-4">
                        {FITNESS.ROUTINE_CARD_EXERCISES(exerciseCount)}
                      </p>
                    </div>

                    {/* Edit / Delete actions */}
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button
                        onClick={() => setEditingRoutine({ routine, openAddExercise: false })}
                        aria-label={`Edit ${routine.name}`}
                        className="p-1.5 rounded-lg text-white/30 hover:text-white/70 hover:bg-white/10 transition-colors"
                      >
                        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                          <path d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => void handleDeleteRoutine(routine)}
                        aria-label={`Delete ${routine.name}`}
                        className="p-1.5 rounded-lg text-white/30 hover:text-red-400 hover:bg-white/10 transition-colors"
                      >
                        <XMarkIcon className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Exercise preview pills */}
                  {exerciseCount > 0 && (
                    <div className="flex flex-wrap gap-1.5 ml-4">
                      {routine.fitness_exercises.slice(0, 4).map((ex) => (
                        <span
                          key={ex.id}
                          className="text-xs px-2 py-0.5 rounded-full bg-white/10 text-white/50"
                        >
                          {ex.name}
                        </span>
                      ))}
                      {exerciseCount > 4 && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-white/10 text-white/30">
                          +{exerciseCount - 4}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Start / Continue button */}
                  <button
                    onClick={() => isActive ? handleContinueWorkout() : void handleStartWorkout(routine)}
                    disabled={isStarting || (hasActiveSession && !isActive)}
                    className={`mt-1 w-full py-2.5 rounded-xl font-bold text-sm transition-all active:scale-[0.98] disabled:opacity-40 ${
                      isActive
                        ? 'bg-purple-600 hover:bg-purple-500 text-white shadow-lg shadow-purple-900/30'
                        : 'bg-white/10 hover:bg-white/20 text-white'
                    }`}
                  >
                    {isStarting
                      ? 'Starting…'
                      : isActive
                      ? FITNESS.ACTION_CONTINUE_WORKOUT
                      : FITNESS.ACTION_START_WORKOUT}
                  </button>
                </div>
              )
            })}
          </div>
        </>
      )}

      {/* Routine editor modal */}
      {editingRoutine && (
        <RoutineEditor
          householdId={householdId}
          routine={editingRoutine.routine}
          openAddExercise={editingRoutine.openAddExercise}
          onClose={() => setEditingRoutine(null)}
          onUpdated={handleRoutineUpdated}
          onDeleted={handleRoutineDeleted}
        />
      )}
    </div>
  )
}

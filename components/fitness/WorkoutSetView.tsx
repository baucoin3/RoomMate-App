'use client'

import { useState, useRef } from 'react'
import type { FitnessExercise, FitnessSetCompletion } from '@/lib/types/fitness'

const CARD_GRADIENTS = [
  'from-purple-900/40 to-purple-800/20 border-purple-700/30',
  'from-blue-900/40 to-blue-800/20 border-blue-700/30',
  'from-emerald-900/40 to-emerald-800/20 border-emerald-700/30',
  'from-orange-900/40 to-orange-800/20 border-orange-700/30',
  'from-pink-900/40 to-pink-800/20 border-pink-700/30',
]

interface WorkoutSetViewProps {
  exercises: FitnessExercise[]
  completions: FitnessSetCompletion[]
  currentSet: number
  householdId: string
  onCheck: (
    exerciseId: string,
    setNumber: number,
    actualReps: number,
    actualWeight: number | null,
    originEl: HTMLElement | null,
  ) => Promise<void>
  onUncheck: (exerciseId: string, setNumber: number) => Promise<void>
}

interface ExerciseRowProps {
  exercise: FitnessExercise
  currentSet: number
  completion: FitnessSetCompletion | undefined
  gradient: string
  onCheck: WorkoutSetViewProps['onCheck']
  onUncheck: WorkoutSetViewProps['onUncheck']
}

function ExerciseRow({ exercise, currentSet, completion, gradient, onCheck, onUncheck }: ExerciseRowProps) {
  const [reps, setReps] = useState(String(completion?.actual_reps ?? exercise.reps))
  const [weight, setWeight] = useState(
    completion?.actual_weight != null
      ? String(completion.actual_weight)
      : exercise.weight != null
      ? String(exercise.weight)
      : '',
  )
  const [saving, setSaving] = useState(false)
  const checkBtnRef = useRef<HTMLButtonElement>(null)
  const isChecked = completion != null

  async function toggle() {
    if (saving) return
    setSaving(true)
    if (isChecked) {
      await onUncheck(exercise.id, currentSet)
    } else {
      const parsedReps = parseInt(reps, 10) || exercise.reps
      const parsedWeight =
        exercise.weight_unit !== 'bodyweight' && weight !== ''
          ? parseFloat(weight) || null
          : null
      await onCheck(exercise.id, currentSet, parsedReps, parsedWeight, checkBtnRef.current)
    }
    setSaving(false)
  }

  return (
    <div
      className={`bg-gradient-to-br ${gradient} rounded-2xl border p-4 transition-all duration-200 ${
        isChecked ? 'opacity-70' : 'opacity-100'
      }`}
    >
      <div className="flex items-start gap-3">
        {/* Check button */}
        <button
          ref={checkBtnRef}
          onClick={toggle}
          disabled={saving}
          className={`mt-0.5 w-7 h-7 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all duration-200 ${
            isChecked
              ? 'bg-green-500 border-green-500 scale-110'
              : 'border-white/40 hover:border-white/70 bg-transparent'
          }`}
        >
          {isChecked && (
            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          )}
        </button>

        <div className="flex-1 min-w-0">
          <p className={`font-bold text-base leading-tight ${isChecked ? 'line-through text-white/50' : 'text-white'}`}>
            {exercise.name}
          </p>

          {/* Reps + weight inputs */}
          {!isChecked && (
            <div className="flex items-center gap-3 mt-2 flex-wrap">
              <div className="flex items-center gap-1.5">
                <label className="text-xs text-white/40 uppercase tracking-wide">Reps</label>
                <input
                  type="number"
                  value={reps}
                  onChange={(e) => setReps(e.target.value)}
                  className="w-14 bg-black/30 border border-white/20 rounded-lg px-2 py-1 text-sm text-white text-center focus:outline-none focus:border-purple-400"
                  min={1}
                />
              </div>
              {exercise.weight_unit !== 'bodyweight' && (
                <div className="flex items-center gap-1.5">
                  <label className="text-xs text-white/40 uppercase tracking-wide">
                    {exercise.weight_unit}
                  </label>
                  <input
                    type="number"
                    value={weight}
                    onChange={(e) => setWeight(e.target.value)}
                    placeholder="0"
                    className="w-16 bg-black/30 border border-white/20 rounded-lg px-2 py-1 text-sm text-white text-center focus:outline-none focus:border-purple-400"
                    min={0}
                    step={2.5}
                  />
                </div>
              )}
              {exercise.weight_unit === 'bodyweight' && (
                <span className="text-xs text-white/30 uppercase tracking-wide">Bodyweight</span>
              )}
            </div>
          )}

          {/* Logged summary when checked */}
          {isChecked && completion && (
            <p className="text-xs text-green-400/70 mt-1">
              {completion.actual_reps ?? '?'} reps
              {completion.actual_weight != null
                ? ` @ ${completion.actual_weight} ${exercise.weight_unit}`
                : ''}
              {' '}· logged
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

export default function WorkoutSetView({
  exercises,
  completions,
  currentSet,
  onCheck,
  onUncheck,
}: WorkoutSetViewProps) {
  const completionMap = new Map(completions.map((c) => [c.exercise_id, c]))

  if (exercises.length === 0) {
    return (
      <div className="text-center py-8 text-white/40 text-sm">
        No exercises for this set.
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {exercises.map((ex, i) => (
        <ExerciseRow
          key={ex.id}
          exercise={ex}
          currentSet={currentSet}
          completion={completionMap.get(ex.id)}
          gradient={CARD_GRADIENTS[i % CARD_GRADIENTS.length]}
          onCheck={onCheck}
          onUncheck={onUncheck}
        />
      ))}
    </div>
  )
}

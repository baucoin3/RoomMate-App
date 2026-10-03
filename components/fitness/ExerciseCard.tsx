'use client'

import { useState } from 'react'
import { FITNESS } from '@/locales/en'
import { TrashIcon, PencilSquareIcon, CheckIcon } from '@/components/icons'
import type { FitnessExercise, FitnessSetCompletion } from '@/lib/types/fitness'

interface ExerciseCardProps {
  exercise: FitnessExercise
  completions: FitnessSetCompletion[]
  sessionId: string | null
  onSaveSet: (exerciseId: string, setNumber: number, reps: number | null, weight: number | null) => Promise<void>
  onDelete: (exerciseId: string) => void
  onEdit: (exercise: FitnessExercise) => void
}

export default function ExerciseCard({
  exercise,
  completions,
  sessionId,
  onSaveSet,
  onDelete,
  onEdit,
}: ExerciseCardProps) {
  const [saving, setSaving] = useState<number | null>(null)
  const [repsInput, setRepsInput] = useState<Record<number, string>>({})
  const [weightInput, setWeightInput] = useState<Record<number, string>>({})

  function getCompletion(setNumber: number): FitnessSetCompletion | undefined {
    return completions.find((c) => c.exercise_id === exercise.id && c.set_number === setNumber)
  }

  async function handleSaveSet(setNumber: number) {
    if (!sessionId) return
    setSaving(setNumber)
    const reps = repsInput[setNumber] !== undefined ? parseInt(repsInput[setNumber], 10) || null : null
    const weight = weightInput[setNumber] !== undefined ? parseFloat(weightInput[setNumber]) || null : null
    await onSaveSet(exercise.id, setNumber, reps, weight)
    setSaving(null)
  }

  const sets = Array.from({ length: exercise.sets }, (_, i) => i + 1)

  return (
    <div
      className="rounded-2xl p-4"
      style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(233,233,237,0.06)' }}
    >
      <div className="flex items-start justify-between gap-2 mb-3">
        <div>
          <p className="text-sm font-semibold text-white">{exercise.name}</p>
          <p className="text-xs mt-0.5" style={{ color: '#75798c' }}>
            {exercise.sets} × {exercise.reps}
            {exercise.weight != null && exercise.weight_unit !== 'bodyweight'
              ? ` @ ${exercise.weight}${exercise.weight_unit}`
              : exercise.weight_unit === 'bodyweight'
              ? ' (bodyweight)'
              : ''}
          </p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => onEdit(exercise)}
            aria-label={FITNESS.ACTION_EDIT}
            className="p-1.5 rounded-lg text-white/40 hover:text-white/70 hover:bg-white/5 transition-colors"
          >
            <PencilSquareIcon className="h-4 w-4" />
          </button>
          <button
            onClick={() => onDelete(exercise.id)}
            aria-label={FITNESS.ACTION_DELETE}
            className="p-1.5 rounded-lg text-white/40 hover:text-red-400 hover:bg-white/5 transition-colors"
          >
            <TrashIcon className="h-4 w-4" />
          </button>
        </div>
      </div>

      {sessionId && (
        <div className="flex flex-col gap-2">
          {sets.map((setNumber) => {
            const completion = getCompletion(setNumber)
            const done = !!completion
            return (
              <div
                key={setNumber}
                className="flex items-center gap-2 rounded-xl px-3 py-2"
                style={{
                  background: done ? 'rgba(145,132,217,0.1)' : 'rgba(255,255,255,0.03)',
                  border: `1px solid ${done ? 'rgba(145,132,217,0.25)' : 'rgba(233,233,237,0.06)'}`,
                }}
              >
                <span className="text-xs font-medium w-8 shrink-0" style={{ color: done ? '#9184d9' : '#75798c' }}>
                  Set {setNumber}
                </span>
                <input
                  type="number"
                  min={1}
                  placeholder={String(exercise.reps)}
                  defaultValue={completion?.actual_reps ?? undefined}
                  onChange={(e) => setRepsInput((prev) => ({ ...prev, [setNumber]: e.target.value }))}
                  className="w-16 rounded-lg px-2 py-1 text-xs text-white text-center focus:outline-none focus:ring-1 focus:ring-indigo-400"
                  style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(233,233,237,0.08)' }}
                  aria-label={`${FITNESS.LABEL_REPS} set ${setNumber}`}
                />
                <span className="text-xs" style={{ color: '#75798c' }}>reps</span>
                {exercise.weight_unit !== 'bodyweight' && (
                  <>
                    <input
                      type="number"
                      min={0}
                      step={0.5}
                      placeholder={exercise.weight != null ? String(exercise.weight) : '—'}
                      defaultValue={completion?.actual_weight ?? undefined}
                      onChange={(e) => setWeightInput((prev) => ({ ...prev, [setNumber]: e.target.value }))}
                      className="w-16 rounded-lg px-2 py-1 text-xs text-white text-center focus:outline-none focus:ring-1 focus:ring-indigo-400"
                      style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(233,233,237,0.08)' }}
                      aria-label={`${FITNESS.LABEL_WEIGHT} set ${setNumber}`}
                    />
                    <span className="text-xs" style={{ color: '#75798c' }}>{exercise.weight_unit}</span>
                  </>
                )}
                <button
                  onClick={() => void handleSaveSet(setNumber)}
                  disabled={saving === setNumber}
                  aria-label={`Log set ${setNumber}`}
                  className="ml-auto flex items-center justify-center w-7 h-7 rounded-full transition-colors disabled:opacity-50"
                  style={{
                    background: done ? 'rgba(145,132,217,0.2)' : 'rgba(255,255,255,0.06)',
                    color: done ? '#9184d9' : '#75798c',
                  }}
                >
                  <CheckIcon className="h-4 w-4" />
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

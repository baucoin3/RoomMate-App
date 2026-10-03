'use client'

import { useState, useEffect, useRef } from 'react'
import { FITNESS } from '@/locales/en'
import { PlusIcon, TrashIcon, XMarkIcon } from '@/components/icons'
import { apiClient, getErrorMessage } from '@/lib/api/client'
import type { FitnessExercise, FitnessRoutineWithExercises } from '@/lib/types/fitness'

interface RoutineEditorProps {
  householdId: string
  routine: FitnessRoutineWithExercises
  openAddExercise?: boolean
  onClose: () => void
  onUpdated: (routine: FitnessRoutineWithExercises) => void
  onDeleted: (routineId: string) => void
}

interface ExerciseFormState {
  name: string
  sets: string
  reps: string
  weight: string
  weight_unit: 'lbs' | 'kg' | 'bodyweight'
}

const defaultExerciseForm = (): ExerciseFormState => ({
  name: '',
  sets: '3',
  reps: '10',
  weight: '',
  weight_unit: 'lbs',
})

export default function RoutineEditor({
  householdId,
  routine,
  openAddExercise,
  onClose,
  onUpdated,
  onDeleted,
}: RoutineEditorProps) {
  const [routineName, setRoutineName] = useState(routine.name)
  const [exercises, setExercises] = useState<FitnessExercise[]>(routine.fitness_exercises)
  const [showAddExercise, setShowAddExercise] = useState(false)
  const [exerciseForm, setExerciseForm] = useState<ExerciseFormState>(defaultExerciseForm())
  const [editingExercise, setEditingExercise] = useState<FitnessExercise | null>(null)
  const [editForm, setEditForm] = useState<ExerciseFormState>(defaultExerciseForm())
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const scrollBottomRef = useRef<HTMLDivElement>(null)
  const addNameInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (openAddExercise) {
      setShowAddExercise(true)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (showAddExercise) {
      setTimeout(() => {
        addNameInputRef.current?.focus()
        scrollBottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
      }, 50)
    }
  }, [showAddExercise])

  async function handleRenameRoutine() {
    if (!routineName.trim() || routineName.trim() === routine.name) return
    setSaving(true)
    setError('')
    try {
      const res = await apiClient.patch<{ data: FitnessRoutineWithExercises }>(
        `/api/fitness/${householdId}/routines/${routine.id}`,
        { name: routineName.trim() },
      )
      onUpdated({ ...res.data.data, fitness_exercises: exercises })
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  async function handleAddExercise() {
    if (!exerciseForm.name.trim()) { setError(FITNESS.ERRORS.NAME_REQUIRED); return }
    const sets = parseInt(exerciseForm.sets, 10)
    const reps = parseInt(exerciseForm.reps, 10)
    if (sets < 1) { setError(FITNESS.ERRORS.SETS_INVALID); return }
    if (reps < 1) { setError(FITNESS.ERRORS.REPS_INVALID); return }
    setSaving(true)
    setError('')
    try {
      const res = await apiClient.post<{ data: FitnessExercise }>(
        `/api/fitness/${householdId}/exercises`,
        {
          routine_id: routine.id,
          name: exerciseForm.name.trim(),
          sets,
          reps,
          weight: exerciseForm.weight ? parseFloat(exerciseForm.weight) : null,
          weight_unit: exerciseForm.weight_unit,
          sort_order: exercises.length,
        },
      )
      const updated = [...exercises, res.data.data]
      setExercises(updated)
      onUpdated({ ...routine, name: routineName, fitness_exercises: updated })
      setExerciseForm(defaultExerciseForm())
      setShowAddExercise(false)
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  async function handleUpdateExercise() {
    if (!editingExercise) return
    if (!editForm.name.trim()) { setError(FITNESS.ERRORS.NAME_REQUIRED); return }
    const sets = parseInt(editForm.sets, 10)
    const reps = parseInt(editForm.reps, 10)
    if (sets < 1) { setError(FITNESS.ERRORS.SETS_INVALID); return }
    if (reps < 1) { setError(FITNESS.ERRORS.REPS_INVALID); return }
    setSaving(true)
    setError('')
    try {
      const res = await apiClient.patch<{ data: FitnessExercise }>(
        `/api/fitness/${householdId}/exercises/${editingExercise.id}`,
        {
          name: editForm.name.trim(),
          sets,
          reps,
          weight: editForm.weight ? parseFloat(editForm.weight) : null,
          weight_unit: editForm.weight_unit,
        },
      )
      const updated = exercises.map((e) => e.id === editingExercise.id ? res.data.data : e)
      setExercises(updated)
      onUpdated({ ...routine, name: routineName, fitness_exercises: updated })
      setEditingExercise(null)
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  async function handleDeleteExercise(exerciseId: string) {
    if (!window.confirm(FITNESS.CONFIRM_DELETE_EXERCISE)) return
    setSaving(true)
    setError('')
    try {
      await apiClient.delete(`/api/fitness/${householdId}/exercises/${exerciseId}`)
      const updated = exercises.filter((e) => e.id !== exerciseId)
      setExercises(updated)
      onUpdated({ ...routine, name: routineName, fitness_exercises: updated })
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  async function handleDeleteRoutine() {
    if (!window.confirm(FITNESS.CONFIRM_DELETE_ROUTINE)) return
    setSaving(true)
    setError('')
    try {
      await apiClient.delete(`/api/fitness/${householdId}/routines/${routine.id}`)
      onDeleted(routine.id)
    } catch (err) {
      setError(getErrorMessage(err))
      setSaving(false)
    }
  }

  function startEditExercise(exercise: FitnessExercise) {
    setEditingExercise(exercise)
    setShowAddExercise(false)
    setEditForm({
      name: exercise.name,
      sets: String(exercise.sets),
      reps: String(exercise.reps),
      weight: exercise.weight != null ? String(exercise.weight) : '',
      weight_unit: exercise.weight_unit,
    })
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.65)' }}
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-lg sm:rounded-2xl flex flex-col"
        style={{
          background: '#16161f',
          border: '1px solid rgba(233,233,237,0.08)',
          maxHeight: '90vh',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b shrink-0" style={{ borderColor: 'rgba(233,233,237,0.06)' }}>
          <h2 className="text-base font-semibold text-white">Edit Routine</h2>
          <button onClick={onClose} aria-label={FITNESS.ACTION_CANCEL} className="p-1.5 rounded-lg text-white/40 hover:text-white/70 transition-colors">
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 px-5 py-4 flex flex-col gap-5">
          {/* Routine name */}
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: '#75798c' }}>Routine name</label>
            <div className="flex gap-2">
              <input
                value={routineName}
                onChange={(e) => setRoutineName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') void handleRenameRoutine() }}
                className="flex-1 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-indigo-400"
                style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(233,233,237,0.08)' }}
              />
              <button
                onClick={() => void handleRenameRoutine()}
                disabled={saving || routineName.trim() === routine.name}
                className="px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors disabled:opacity-40"
                style={{ background: 'rgba(145,132,217,0.2)', color: '#9184d9' }}
              >
                {FITNESS.ACTION_SAVE}
              </button>
            </div>
          </div>

          {/* Exercises list */}
          <div>
            <p className="text-xs font-medium mb-2" style={{ color: '#75798c' }}>Exercises</p>
            <div className="flex flex-col gap-2">
              {exercises.length === 0 && !showAddExercise && (
                <p className="text-sm" style={{ color: '#75798c' }}>No exercises yet.</p>
              )}
              {exercises.map((exercise) => (
                editingExercise?.id === exercise.id ? (
                  <ExerciseForm
                    key={exercise.id}
                    form={editForm}
                    onChange={setEditForm}
                    onSave={() => void handleUpdateExercise()}
                    onCancel={() => setEditingExercise(null)}
                    saving={saving}
                  />
                ) : (
                  <div
                    key={exercise.id}
                    className="flex items-center justify-between gap-2 rounded-xl px-3 py-2.5"
                    style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(233,233,237,0.06)' }}
                  >
                    <div>
                      <p className="text-sm font-medium text-white">{exercise.name}</p>
                      <p className="text-xs mt-0.5" style={{ color: '#75798c' }}>
                        {exercise.sets} × {exercise.reps}
                        {exercise.weight != null && exercise.weight_unit !== 'bodyweight'
                          ? ` @ ${exercise.weight}${exercise.weight_unit}`
                          : exercise.weight_unit === 'bodyweight' ? ' (bodyweight)' : ''}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => startEditExercise(exercise)}
                        className="p-1.5 rounded-lg text-white/40 hover:text-white/70 hover:bg-white/5 transition-colors"
                        aria-label={FITNESS.ACTION_EDIT}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                          <path d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125" />
                        </svg>
                      </button>
                      <button
                        onClick={() => void handleDeleteExercise(exercise.id)}
                        className="p-1.5 rounded-lg text-white/40 hover:text-red-400 hover:bg-white/5 transition-colors"
                        aria-label={FITNESS.ACTION_DELETE}
                        disabled={saving}
                      >
                        <TrashIcon className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                )
              ))}
            </div>

            {/* Add exercise form */}
            {showAddExercise ? (
              <div className="mt-3">
                <ExerciseForm
                  form={exerciseForm}
                  onChange={setExerciseForm}
                  onSave={() => void handleAddExercise()}
                  onCancel={() => { setShowAddExercise(false); setExerciseForm(defaultExerciseForm()) }}
                  saving={saving}
                  nameInputRef={addNameInputRef}
                />
              </div>
            ) : (
              <button
                onClick={() => setShowAddExercise(true)}
                className="mt-3 flex items-center gap-1.5 text-sm font-semibold transition-colors"
                style={{ color: '#9184d9' }}
              >
                <PlusIcon className="h-4 w-4" />
                {FITNESS.ACTION_ADD_EXERCISE}
              </button>
            )}

            <div ref={scrollBottomRef} />
          </div>

          {error && <p className="text-xs text-red-400">{error}</p>}
        </div>

        {/* Footer */}
        <div className="px-5 pb-5 pt-3 shrink-0 flex justify-between border-t" style={{ borderColor: 'rgba(233,233,237,0.06)' }}>
          <button
            onClick={() => void handleDeleteRoutine()}
            disabled={saving}
            className="flex items-center gap-1.5 text-sm font-medium text-red-400 hover:text-red-300 transition-colors disabled:opacity-50"
          >
            <TrashIcon className="h-4 w-4" />
            {FITNESS.ACTION_DELETE}
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-sm font-medium text-white/60 hover:text-white hover:bg-white/5 transition-colors"
          >
            {FITNESS.ACTION_CANCEL}
          </button>
        </div>
      </div>
    </div>
  )
}

function ExerciseForm({
  form,
  onChange,
  onSave,
  onCancel,
  saving,
  nameInputRef,
}: {
  form: ExerciseFormState
  onChange: (f: ExerciseFormState) => void
  onSave: () => void
  onCancel: () => void
  saving: boolean
  nameInputRef?: React.RefObject<HTMLInputElement>
}) {
  return (
    <div
      className="rounded-xl p-4 flex flex-col gap-3"
      style={{ background: 'rgba(145,132,217,0.08)', border: '1px solid rgba(145,132,217,0.2)' }}
    >
      <input
        ref={nameInputRef}
        value={form.name}
        onChange={(e) => onChange({ ...form, name: e.target.value })}
        placeholder={FITNESS.EXERCISE_NAME_PLACEHOLDER}
        className="w-full rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-indigo-400"
        style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(233,233,237,0.1)' }}
      />
      <div className="grid grid-cols-4 gap-2">
        <div>
          <label className="block text-xs font-medium mb-1.5" style={{ color: '#75798c' }}>{FITNESS.LABEL_SETS}</label>
          <input
            type="number"
            min={1}
            value={form.sets}
            onChange={(e) => onChange({ ...form, sets: e.target.value })}
            className="w-full rounded-xl px-2 py-2.5 text-sm text-white text-center focus:outline-none focus:ring-1 focus:ring-indigo-400"
            style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(233,233,237,0.1)' }}
          />
        </div>
        <div>
          <label className="block text-xs font-medium mb-1.5" style={{ color: '#75798c' }}>{FITNESS.LABEL_REPS}</label>
          <input
            type="number"
            min={1}
            value={form.reps}
            onChange={(e) => onChange({ ...form, reps: e.target.value })}
            className="w-full rounded-xl px-2 py-2.5 text-sm text-white text-center focus:outline-none focus:ring-1 focus:ring-indigo-400"
            style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(233,233,237,0.1)' }}
          />
        </div>
        <div>
          <label className="block text-xs font-medium mb-1.5" style={{ color: '#75798c' }}>{FITNESS.LABEL_WEIGHT}</label>
          <input
            type="number"
            min={0}
            step={0.5}
            disabled={form.weight_unit === 'bodyweight'}
            value={form.weight}
            onChange={(e) => onChange({ ...form, weight: e.target.value })}
            className="w-full rounded-xl px-2 py-2.5 text-sm text-white text-center focus:outline-none focus:ring-1 focus:ring-indigo-400 disabled:opacity-40"
            style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(233,233,237,0.1)' }}
          />
        </div>
        <div>
          <label className="block text-xs font-medium mb-1.5" style={{ color: '#75798c' }}>{FITNESS.LABEL_UNIT}</label>
          <select
            value={form.weight_unit}
            onChange={(e) => onChange({ ...form, weight_unit: e.target.value as 'lbs' | 'kg' | 'bodyweight' })}
            className="w-full rounded-xl px-2 py-2.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-indigo-400"
            style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(233,233,237,0.1)' }}
          >
            <option value="lbs">{FITNESS.UNIT_LBS}</option>
            <option value="kg">{FITNESS.UNIT_KG}</option>
            <option value="bodyweight">{FITNESS.UNIT_BODYWEIGHT}</option>
          </select>
        </div>
      </div>
      <div className="flex gap-3 pt-1">
        <button
          onClick={onCancel}
          className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-colors"
          style={{ background: 'rgba(255,255,255,0.06)', color: '#9397ab' }}
        >
          {FITNESS.ACTION_CANCEL}
        </button>
        <button
          onClick={onSave}
          disabled={saving}
          className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-colors disabled:opacity-50"
          style={{ background: 'rgba(145,132,217,0.25)', color: '#c4baee' }}
        >
          {FITNESS.ACTION_SAVE}
        </button>
      </div>
    </div>
  )
}

'use client'

import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { apiClient, getErrorMessage } from '@/lib/api/client'
import type { ShoppingList, ShoppingListItem } from '@/lib/types/shopping'
import { SHOPPING } from '@/locales/en'
import { CheckIcon, XMarkIcon } from '@/components/icons'

interface Ingredient {
  name: string
  quantity?: string | null
  unit?: string | null
}

interface Props {
  householdId: string
  recipeName: string
  ingredients: Ingredient[]
  onClose: () => void
}

function ingredientLabel(ing: Ingredient): string {
  return ing.name
}

export default function AddToShoppingListModal({
  householdId,
  recipeName,
  ingredients,
  onClose,
}: Props) {
  const [lists, setLists] = useState<ShoppingList[]>([])
  const [listsLoading, setListsLoading] = useState(true)
  const [listsError, setListsError] = useState('')
  const [selectedListId, setSelectedListId] = useState('')
  const [checked, setChecked] = useState<Set<number>>(
    new Set(ingredients.map((_, i) => i)),
  )
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [skipMessage, setSkipMessage] = useState('')
  const [allSkipped, setAllSkipped] = useState(false)
  const [done, setDone] = useState(false)

  useEffect(() => {
    async function load() {
      try {
        const res = await apiClient.get<{ data: ShoppingList[] }>(
          `/api/shopping-lists?householdId=${householdId}`,
        )
        const data = res.data.data ?? []
        setLists(data)
        if (data.length > 0) setSelectedListId(data[0].id)
      } catch (err) {
        setListsError(getErrorMessage(err))
      } finally {
        setListsLoading(false)
      }
    }
    void load()
  }, [householdId])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  function toggleItem(idx: number) {
    setChecked((prev) => {
      const next = new Set(prev)
      if (next.has(idx)) next.delete(idx)
      else next.add(idx)
      return next
    })
  }

  async function handleSubmit() {
    const selected = ingredients.filter((_, i) => checked.has(i))
    if (selected.length === 0 || !selectedListId) return

    setSubmitting(true)
    setSubmitError('')
    setSkipMessage('')
    setAllSkipped(false)

    try {
      const items = selected.map((ing) => ({
        name: ing.name,
        quantity: ing.quantity != null ? parseFloat(ing.quantity) || null : null,
        unit: ing.unit ?? null,
      }))

      const res = await apiClient.post<{ data: ShoppingListItem[]; skipped: number }>(
        `/api/shopping-lists/${selectedListId}/items/batch`,
        { items },
      )

      const { skipped } = res.data
      const added = res.data.data.length

      if (added === 0 && skipped === selected.length) {
        setAllSkipped(true)
        setSubmitting(false)
        return
      }

      if (skipped > 0) {
        setSkipMessage(SHOPPING.ERRORS.ITEMS_SKIPPED(skipped))
      }

      setDone(true)
      setTimeout(() => onClose(), 1800)
    } catch (err) {
      setSubmitError(getErrorMessage(err))
      setSubmitting(false)
    }
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-end md:items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-to-list-title"
    >
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      <div className="relative w-full max-w-sm rounded-2xl bg-[#1c1c24] border border-white/10 p-5 shadow-2xl max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between mb-4 shrink-0">
          <h2 id="add-to-list-title" className="text-base font-semibold text-white">
            {SHOPPING.LABELS.ADD_TO_LIST_TITLE(recipeName)}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-white/40 hover:text-white/70 transition-colors"
            aria-label="Close"
          >
            <XMarkIcon className="h-4 w-4" />
          </button>
        </div>

        {listsLoading && (
          <p className="text-sm text-white/40 text-center py-8">{SHOPPING.ACTIONS.CREATING}</p>
        )}

        {!listsLoading && listsError && (
          <p className="text-sm text-red-400 py-4">{listsError}</p>
        )}

        {!listsLoading && !listsError && lists.length === 0 && (
          <p className="text-sm text-white/50 py-4 text-center">
            {SHOPPING.ERRORS.NO_LISTS_FOR_RECIPE}
          </p>
        )}

        {!listsLoading && lists.length > 0 && !done && (
          <>
            {/* List selector */}
            <div className="mb-4 shrink-0">
              <label className="text-xs font-medium text-white/50 mb-1.5 block">
                {SHOPPING.LABELS.SELECT_LIST_LABEL}
              </label>
              <select
                value={selectedListId}
                onChange={(e) => setSelectedListId(e.target.value)}
                disabled={submitting}
                className="w-full rounded-xl bg-white/5 border border-white/10 px-3.5 py-2.5 text-sm text-white outline-none focus:border-indigo-500 transition-colors disabled:opacity-60"
              >
                {lists.map((list) => (
                  <option key={list.id} value={list.id} className="bg-[#1c1c24]">
                    {list.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Ingredient checkboxes */}
            <div className="flex-1 overflow-y-auto mb-4 -mx-1 px-1 min-h-0">
              <p className="text-xs font-medium text-white/50 mb-2 px-2">
                {SHOPPING.LABELS.INGREDIENTS_LABEL}
              </p>
              <div className="flex flex-col">
                {ingredients.map((ing, idx) => (
                  <label
                    key={idx}
                    className="flex items-center gap-3 px-2 py-2 rounded-xl hover:bg-white/5 cursor-pointer transition-colors"
                  >
                    <div
                      className={`w-4 h-4 rounded flex items-center justify-center border flex-shrink-0 transition-colors ${
                        checked.has(idx)
                          ? 'bg-indigo-500 border-indigo-500'
                          : 'border-white/20 bg-transparent'
                      }`}
                    >
                      {checked.has(idx) && <CheckIcon className="h-2.5 w-2.5 text-white" />}
                    </div>
                    <input
                      type="checkbox"
                      className="sr-only"
                      checked={checked.has(idx)}
                      onChange={() => toggleItem(idx)}
                      disabled={submitting}
                    />
                    <span className="text-sm text-white/80">{ingredientLabel(ing)}</span>
                  </label>
                ))}
              </div>
            </div>

            {allSkipped && (
              <p className="text-xs text-amber-400 mb-3 shrink-0">
                {SHOPPING.ERRORS.ALL_ALREADY_IN_LIST}
              </p>
            )}
            {submitError && (
              <p className="text-xs text-red-400 mb-3 shrink-0">{submitError}</p>
            )}

            <div className="flex gap-2 shrink-0">
              <button
                type="button"
                onClick={onClose}
                disabled={submitting}
                className="flex-1 py-2.5 rounded-xl border border-white/10 text-sm text-white/60 hover:text-white hover:border-white/20 transition-colors disabled:opacity-60"
              >
                {SHOPPING.ACTIONS.CANCEL}
              </button>
              <button
                type="button"
                onClick={() => void handleSubmit()}
                disabled={submitting || checked.size === 0 || !selectedListId}
                className="flex-1 py-2.5 rounded-xl bg-indigo-500 hover:bg-indigo-400 text-white text-sm font-semibold transition-colors disabled:opacity-50"
              >
                {submitting ? SHOPPING.ACTIONS.ADDING_ITEMS : SHOPPING.ACTIONS.ADD_ITEMS}
              </button>
            </div>
          </>
        )}

        {done && (
          <div className="flex flex-col items-center gap-3 py-6">
            <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center">
              <CheckIcon className="h-5 w-5 text-green-400" />
            </div>
            <p className="text-sm text-white/80">{SHOPPING.ACTIONS.ITEMS_ADDED}</p>
            {skipMessage && <p className="text-xs text-amber-400 text-center">{skipMessage}</p>}
          </div>
        )}
      </div>
    </div>,
    document.body
  )
}

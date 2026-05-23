'use client'

import { useState, useEffect, useRef } from 'react'
import { apiClient, getErrorMessage } from '@/lib/api/client'
import type { ShoppingList } from '@/lib/types/shopping'
import { SHOPPING } from '@/locales/en'

interface NewListModalProps {
  householdId: string
  onCreated: (list: ShoppingList) => void
  onClose: () => void
}

export default function NewListModal({ householdId, onCreated, onClose }: NewListModalProps) {
  const [name, setName] = useState('')
  const [ownerType, setOwnerType] = useState<'user' | 'household'>('household')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) {
      setError(SHOPPING.ERRORS.NAME_REQUIRED)
      return
    }

    setIsSubmitting(true)
    setError('')
    try {
      const res = await apiClient.post<{ data: ShoppingList }>('/api/shopping-lists', {
        name: name.trim(),
        owner_type: ownerType,
        household_id: householdId,
      })
      onCreated(res.data.data)
    } catch (err) {
      setError(getErrorMessage(err))
      setIsSubmitting(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="new-list-modal-title"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal panel */}
      <div className="relative w-full max-w-sm rounded-2xl bg-[#1c1c24] border border-white/10 p-5 shadow-2xl">
        <h2 id="new-list-modal-title" className="text-base font-semibold text-white mb-4">
          {SHOPPING.ACTIONS.NEW_LIST}
        </h2>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* List name */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-white/50" htmlFor="list-name">
              {SHOPPING.LABELS.LIST_NAME}
            </label>
            <input
              id="list-name"
              ref={inputRef}
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={SHOPPING.LABELS.LIST_NAME_PLACEHOLDER}
              disabled={isSubmitting}
              className="w-full rounded-xl bg-white/5 border border-white/10 px-3.5 py-2.5 text-sm text-white placeholder:text-white/25 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors disabled:opacity-60"
            />
          </div>

          {/* Owner type toggle */}
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-white/50">
              {SHOPPING.LABELS.OWNER_TYPE}
            </span>
            <div className="flex rounded-xl bg-white/5 border border-white/10 p-1 gap-1">
              {(['household', 'user'] as const).map((type) => {
                const label = type === 'household' ? SHOPPING.LABELS.OWNER_HOUSEHOLD : SHOPPING.LABELS.OWNER_MINE
                const isActive = ownerType === type
                return (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setOwnerType(type)}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
                      isActive
                        ? 'bg-white text-black'
                        : 'text-white/50 hover:text-white/80'
                    }`}
                  >
                    {label}
                  </button>
                )
              })}
            </div>
          </div>

          {error && <p className="text-xs text-red-400">{error}</p>}

          {/* Actions */}
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="flex-1 py-2.5 rounded-xl border border-white/10 text-sm text-white/60 hover:text-white hover:border-white/20 transition-colors disabled:opacity-60"
            >
              {SHOPPING.ACTIONS.CANCEL}
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !name.trim()}
              className="flex-1 py-2.5 rounded-xl bg-indigo-500 hover:bg-indigo-400 text-white text-sm font-semibold transition-colors disabled:opacity-50"
            >
              {isSubmitting ? SHOPPING.ACTIONS.CREATING : SHOPPING.ACTIONS.CREATE}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

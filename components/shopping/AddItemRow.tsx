'use client'

import { useState, useRef, useEffect } from 'react'
import { apiClient, getErrorMessage } from '@/lib/api/client'
import type { ShoppingListItem, HouseholdItemSuggestion } from '@/lib/types/shopping'
import { SHOPPING } from '@/locales/en'

interface AddItemRowProps {
  listId: string
  householdId: string
  onItemAdded: (item: ShoppingListItem) => void
}

export default function AddItemRow({ listId, householdId, onItemAdded }: AddItemRowProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [inputValue, setInputValue] = useState('')
  const [suggestions, setSuggestions] = useState<HouseholdItemSuggestion[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (isExpanded) inputRef.current?.focus()
  }, [isExpanded])

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)

    if (!inputValue.trim()) {
      setSuggestions([])
      return
    }

    debounceRef.current = setTimeout(async () => {
      try {
        const res = await apiClient.get<{ data: HouseholdItemSuggestion[] }>(
          `/api/household-items?householdId=${householdId}&q=${encodeURIComponent(inputValue)}`,
        )
        setSuggestions(res.data.data ?? [])
      } catch {
        setSuggestions([])
      }
    }, 250)

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [inputValue, householdId])

  async function submitItem(name: string) {
    if (!name.trim() || isSubmitting) return
    setIsSubmitting(true)
    setError('')
    try {
      const res = await apiClient.post<{ data: ShoppingListItem }>(
        `/api/shopping-lists/${listId}/items`,
        { name: name.trim() },
      )
      onItemAdded(res.data.data)
      setInputValue('')
      setSuggestions([])
      inputRef.current?.focus()
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setIsSubmitting(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault()
      void submitItem(inputValue)
    }
    if (e.key === 'Escape') {
      setIsExpanded(false)
      setInputValue('')
      setSuggestions([])
    }
  }

  function handleBlur() {
    // Delay so suggestion clicks register before blur collapses
    setTimeout(() => {
      if (!inputValue.trim()) {
        setIsExpanded(false)
        setSuggestions([])
      }
    }, 150)
  }

  function handleSuggestionClick(suggestion: HouseholdItemSuggestion) {
    setSuggestions([])
    void submitItem(suggestion.name)
  }

  if (!isExpanded) {
    return (
      <button
        onClick={() => setIsExpanded(true)}
        className="flex items-center gap-2 w-full px-4 py-3 text-sm text-white/30 hover:text-white/60 transition-colors"
      >
        <span className="text-lg leading-none">+</span>
        {SHOPPING.ACTIONS.ADD_ITEM}
      </button>
    )
  }

  return (
    <div className="relative px-4 py-2.5">
      <div className="flex items-center gap-2">
        <span className="text-lg text-white/20 leading-none">+</span>
        <input
          ref={inputRef}
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
          placeholder={SHOPPING.ACTIONS.ADD_ITEM}
          disabled={isSubmitting}
          className="flex-1 bg-transparent text-sm text-white placeholder:text-white/25 outline-none disabled:opacity-60"
        />
        {isSubmitting && (
          <span className="text-xs text-white/30">{SHOPPING.ACTIONS.CREATING}</span>
        )}
        {!isSubmitting && inputValue.trim().length > 0 && (
          <button
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => void submitItem(inputValue)}
            disabled={isSubmitting}
            className="px-3 py-1 rounded-full text-xs font-medium bg-green-500 hover:bg-green-400 text-white transition-all disabled:opacity-50 shrink-0"
          >
            {SHOPPING.ACTIONS.ADD}
          </button>
        )}
      </div>

      {error && <p className="mt-1 text-xs text-red-400">{error}</p>}

      {/* Typeahead suggestions */}
      {suggestions.length > 0 && (
        <ul
          role="listbox"
          className="absolute left-4 right-4 top-full mt-1 z-20 rounded-xl border border-white/10 bg-[#2a2a32] shadow-xl overflow-hidden"
        >
          {suggestions.map((s) => (
            <li key={s.id}>
              <button
                role="option"
                aria-selected={false}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => handleSuggestionClick(s)}
                className="w-full text-left px-4 py-2.5 text-sm text-white/80 hover:bg-white/5 transition-colors"
              >
                {s.name}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

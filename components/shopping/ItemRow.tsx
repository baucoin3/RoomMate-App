'use client'

import { useState } from 'react'
import { apiClient, getErrorMessage } from '@/lib/api/client'
import type { ShoppingListItem } from '@/lib/types/shopping'
import { SHOPPING } from '@/locales/en'

interface ItemRowProps {
  item: ShoppingListItem
  listId: string
  onToggled: (itemId: string, isChecked: boolean) => void
  onDeleted: (itemId: string) => void
}

const CATEGORY_BADGE_STYLES: Record<string, string> = {
  Produce: 'text-blue-400 bg-blue-400/10',
  Dairy: 'text-green-400 bg-green-400/10',
  Meat: 'text-red-400 bg-red-400/10',
  Bakery: 'text-amber-400 bg-amber-400/10',
  Other: 'text-white/40 bg-white/5',
}

function TrashIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
    </svg>
  )
}

function formatQuantity(quantity: number | null, unit: string | null): string | null {
  if (!quantity && !unit) return null
  if (quantity && unit) return `${quantity} ${unit}`
  if (quantity) return `×${quantity}`
  return unit ?? null
}

export default function ItemRow({ item, listId, onToggled, onDeleted }: ItemRowProps) {
  const [isChecked, setIsChecked] = useState(item.is_checked)
  const [isToggling, setIsToggling] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [error, setError] = useState('')

  const quantityLabel = formatQuantity(item.quantity, item.unit)

  async function handleToggle() {
    if (isToggling) return
    const next = !isChecked
    setIsChecked(next)
    setIsToggling(true)
    setError('')
    try {
      await apiClient.patch<{ data: ShoppingListItem }>(
        `/api/shopping-lists/${listId}/items/${item.id}`,
        { is_checked: next },
      )
      onToggled(item.id, next)
    } catch (err) {
      setIsChecked(!next)
      setError(getErrorMessage(err))
    } finally {
      setIsToggling(false)
    }
  }

  async function handleDelete() {
    setIsDeleting(true)
    setError('')
    try {
      await apiClient.delete(`/api/shopping-lists/${listId}/items/${item.id}`)
      onDeleted(item.id)
    } catch (err) {
      setError(getErrorMessage(err))
      setIsDeleting(false)
    }
  }

  return (
    <div className="group flex items-center gap-3 px-4 py-2.5 border-b border-white/5 last:border-0">
      {/* Checkbox */}
      <button
        onClick={handleToggle}
        disabled={isToggling}
        aria-label={isChecked ? 'Mark as unchecked' : 'Mark as checked'}
        className="shrink-0 flex items-center justify-center w-5 h-5 rounded-full border-2 transition-all disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
        style={{
          borderColor: isChecked ? '#6366f1' : 'rgba(255,255,255,0.2)',
          backgroundColor: isChecked ? '#6366f1' : 'transparent',
        }}
      >
        {isChecked && (
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="white" className="w-3 h-3" aria-hidden="true">
            <path fillRule="evenodd" d="M19.916 4.626a.75.75 0 01.208 1.04l-9 13.5a.75.75 0 01-1.154.114l-6-6a.75.75 0 011.06-1.06l5.353 5.353 8.493-12.739a.75.75 0 011.04-.208z" clipRule="evenodd" />
          </svg>
        )}
      </button>

      {/* Item name */}
      <span
        className={`flex-1 text-sm transition-all ${
          isChecked ? 'line-through text-white/30' : 'text-white/80'
        }`}
      >
        {item.name}
      </span>

      {/* Quantity label */}
      {quantityLabel && (
        <span className={`text-xs shrink-0 ${isChecked ? 'text-white/20' : 'text-white/40'}`}>
          {quantityLabel}
        </span>
      )}

      {/* Category badge placeholder — shown when item has a category hint */}
      {/* The badge map is hardcoded; a future integration can pass categoryName as a prop */}

      {/* Inline error */}
      {error && (
        <span className="text-xs text-red-400 shrink-0">{error}</span>
      )}

      {/* Delete button — visible on hover */}
      <button
        onClick={handleDelete}
        disabled={isDeleting}
        aria-label={SHOPPING.ACTIONS.DELETE_ITEM}
        className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity text-white/25 hover:text-red-400 disabled:opacity-40 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400 rounded"
      >
        <TrashIcon className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}

export { CATEGORY_BADGE_STYLES }

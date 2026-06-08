'use client'

import { useState } from 'react'
import { apiClient, getErrorMessage } from '@/lib/api/client'
import type { ShoppingList, ShoppingListItem } from '@/lib/types/shopping'
import { SHOPPING } from '@/locales/en'
import ItemRow from './ItemRow'
import AddItemRow from './AddItemRow'

interface ListCardProps {
  list: ShoppingList
  currentUserId: string
  householdId: string
  onItemsChanged: (updater: (items: ShoppingListItem[]) => ShoppingListItem[]) => void
  onListDeleted: () => void
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={2}
      stroke="currentColor"
      className={`h-4 w-4 transition-transform duration-200 text-white/40 ${open ? 'rotate-180' : ''}`}
      aria-hidden="true"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
    </svg>
  )
}

function TrashIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
    </svg>
  )
}

const STATUS_DOT_COLOR: Record<string, string> = {
  mine: 'bg-blue-400',
  household: 'bg-yellow-400',
}

export default function ListCard({
  list,
  currentUserId,
  householdId,
  onItemsChanged,
  onListDeleted,
}: ListCardProps) {
  const [isOpen, setIsOpen] = useState(true)
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')
  const [isDeletingChecked, setIsDeletingChecked] = useState(false)
  const [isClearing, setIsClearing] = useState(false)
  const [bulkError, setBulkError] = useState('')

  const items = list.items ?? []
  const uncheckedCount = items.filter((i) => !i.is_checked).length
  const isMine = list.owner_type === 'user' && list.user_id === currentUserId
  const badgeLabel = isMine ? SHOPPING.BADGES.MINE : SHOPPING.BADGES.HOUSEHOLD
  const dotColor = isMine ? STATUS_DOT_COLOR.mine : STATUS_DOT_COLOR.household

  async function handleDeleteList() {
    if (!confirm(`Delete "${list.name}"?`)) return
    setIsDeleting(true)
    setDeleteError('')
    try {
      await apiClient.delete(`/api/shopping-lists/${list.id}`)
      onListDeleted()
    } catch (err) {
      setDeleteError(getErrorMessage(err))
      setIsDeleting(false)
    }
  }

  function handleItemAdded(item: ShoppingListItem) {
    onItemsChanged((prev) => [...prev, item])
  }

  function handleItemToggled(itemId: string, isChecked: boolean) {
    onItemsChanged((prev) =>
      prev
        .map((i) => (i.id === itemId ? { ...i, is_checked: isChecked } : i))
        .sort((a, b) => {
          if (a.is_checked !== b.is_checked) return a.is_checked ? 1 : -1
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        }),
    )
  }

  function handleItemDeleted(itemId: string) {
    onItemsChanged((prev) => prev.filter((i) => i.id !== itemId))
  }

  function handleItemEdited(itemId: string, newName: string) {
    onItemsChanged((prev) =>
      prev.map((i) => (i.id === itemId ? { ...i, name: newName } : i)),
    )
  }

  async function handleDeleteChecked() {
    setIsDeletingChecked(true)
    setBulkError('')
    try {
      await apiClient.delete(`/api/shopping-lists/${list.id}/items?checked=true`)
      onItemsChanged((prev) => prev.filter((i) => !i.is_checked))
    } catch (err) {
      setBulkError(getErrorMessage(err))
    } finally {
      setIsDeletingChecked(false)
    }
  }

  async function handleClearAll() {
    if (!confirm(SHOPPING.ACTIONS.CLEAR_ALL_CONFIRM(list.name))) return
    setIsClearing(true)
    setBulkError('')
    try {
      await apiClient.delete(`/api/shopping-lists/${list.id}/items`)
      onItemsChanged(() => [])
    } catch (err) {
      setBulkError(getErrorMessage(err))
    } finally {
      setIsClearing(false)
    }
  }

  return (
    <div className="rounded-2xl bg-[#1c1c24] overflow-hidden">
      {/* Card header */}
      <button
        className="w-full flex items-center gap-3 px-4 py-3.5 text-left"
        onClick={() => setIsOpen((o) => !o)}
        aria-expanded={isOpen}
      >
        <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${dotColor}`} aria-hidden="true" />
        <span className="flex-1 font-semibold text-sm text-white truncate">{list.name}</span>
        <span className="text-xs text-white/40 border border-white/15 rounded-full px-2 py-0.5 shrink-0">
          {badgeLabel}
        </span>
        {uncheckedCount > 0 && (
          <span className="text-xs text-white/40 shrink-0">
            {SHOPPING.ITEMS_LEFT(uncheckedCount)}
          </span>
        )}
        <ChevronIcon open={isOpen} />
      </button>

      {/* Collapsible body */}
      {isOpen && (
        <div className="border-t border-white/5">
          {items.length === 0 && (
            <p className="px-4 py-3 text-xs text-white/30">{SHOPPING.EMPTY_STATE}</p>
          )}
          {items.map((item) => (
            <ItemRow
              key={item.id}
              item={item}
              listId={list.id}
              onToggled={handleItemToggled}
              onDeleted={handleItemDeleted}
              onEdited={handleItemEdited}
            />
          ))}
          <AddItemRow
            listId={list.id}
            householdId={householdId}
            onItemAdded={handleItemAdded}
          />

          {/* List actions footer */}
          <div className="flex items-center justify-end gap-1 px-4 py-3 border-t border-white/5 flex-wrap">
            {(deleteError || bulkError) && (
              <span className="text-sm text-red-400 flex-1">{deleteError || bulkError}</span>
            )}
            {items.some((i) => i.is_checked) && (
              <button
                onClick={handleDeleteChecked}
                disabled={isDeletingChecked}
                className="py-1 px-3 text-sm text-white/40 hover:text-amber-400 transition-colors disabled:opacity-50 rounded-full hover:bg-amber-400/10"
              >
                {SHOPPING.ACTIONS.DELETE_CHECKED}
              </button>
            )}
            {items.length > 0 && (
              <button
                onClick={handleClearAll}
                disabled={isClearing}
                className="py-1 px-3 text-sm text-white/40 hover:text-red-400 transition-colors disabled:opacity-50 rounded-full hover:bg-red-400/10"
              >
                {SHOPPING.ACTIONS.CLEAR_ALL}
              </button>
            )}
            <button
              onClick={handleDeleteList}
              disabled={isDeleting}
              aria-label={SHOPPING.ACTIONS.DELETE_LIST}
              className="flex items-center gap-1.5 py-1 px-3 text-sm text-white/40 hover:text-red-400 transition-colors disabled:opacity-50 rounded-full hover:bg-red-400/10"
            >
              <TrashIcon className="h-4 w-4" />
              {SHOPPING.ACTIONS.DELETE_LIST}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

'use client'

import { useState } from 'react'
import { SHOPPING } from '@/locales/en'
import { apiClient, getErrorMessage } from '@/lib/api/client'
import type { CommonShoppingItem, ShoppingList, ShoppingListItem } from '@/lib/types/shopping'
import AddCommonItemModal from './AddCommonItemModal'
import ChooseListDialog from './ChooseListDialog'

interface CommonItemsBarProps {
  householdId: string
  currentUserId: string
  items: CommonShoppingItem[]
  lists: ShoppingList[]
  onItemAdded: (item: CommonShoppingItem) => void
  onItemDeleted: (itemId: string) => void
  onAddedToList: (listId: string, newItem: ShoppingListItem, itemName: string) => void
  onError: (msg: string) => void
}


export default function CommonItemsBar({
  householdId,
  currentUserId,
  items,
  lists,
  onItemAdded,
  onItemDeleted,
  onAddedToList,
  onError,
}: CommonItemsBarProps) {
  const [collapsed, setCollapsed] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [pendingItem, setPendingItem] = useState<CommonShoppingItem | null>(null)
  const [chooseListOpen, setChooseListOpen] = useState(false)
  const [pulsingId, setPulsingId] = useState<string | null>(null)

  async function handleChipTap(item: CommonShoppingItem) {
    setPulsingId(item.id)
    setTimeout(() => setPulsingId(null), 400)

    if (lists.length === 1) {
      await addToList(item, lists[0])
    } else if (lists.length > 1) {
      setPendingItem(item)
      setChooseListOpen(true)
    }
  }

  async function addToList(item: CommonShoppingItem, list: ShoppingList) {
    const existingNames = new Set((list.items ?? []).map((i) => i.name.toLowerCase()))
    if (existingNames.has(item.name.toLowerCase())) {
      onError(SHOPPING.COMMON_ITEM_ALREADY_IN_LIST(item.name))
      return
    }
    try {
      const res = await apiClient.post<{ data: ShoppingListItem }>(
        `/api/shopping-lists/${list.id}/items`,
        { name: item.name },
      )
      onAddedToList(list.id, res.data.data, item.name)
    } catch (err) {
      onError(getErrorMessage(err) || SHOPPING.ERRORS.ADD_TO_LIST_FAILED)
    }
  }

  async function handleChooseList(list: ShoppingList) {
    setChooseListOpen(false)
    if (pendingItem) await addToList(pendingItem, list)
    setPendingItem(null)
  }

  async function handleDeleteItem(itemId: string) {
    try {
      await apiClient.delete(`/api/common-shopping-items/${itemId}?householdId=${householdId}`)
      onItemDeleted(itemId)
    } catch (err) {
      onError(getErrorMessage(err) || SHOPPING.ERRORS.DELETE_COMMON_ITEM)
    }
  }

  return (
    <>
      <div
        style={{
          background: 'rgba(22,24,38,0.8)',
          border: '1px solid rgba(233,233,237,0.06)',
          borderRadius: 16,
          overflow: 'hidden',
          marginBottom: 4,
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 16px',
            gap: 8,
          }}
        >
          <button
            type="button"
            onClick={() => setCollapsed((c) => !c)}
            style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'none', border: 'none', cursor: 'pointer', padding: 0, flex: 1, minWidth: 0, textAlign: 'left' }}
          >
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#e9e9ed', lineHeight: 1.2 }}>{SHOPPING.COMMON_ITEMS_TITLE}</div>
              <div style={{ fontSize: 11, color: '#75798c', lineHeight: 1.3 }}>{SHOPPING.COMMON_ITEMS_SUBTITLE}</div>
            </div>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
              style={{
                width: 16, height: 16,
                color: '#75798c',
                flexShrink: 0,
                transform: collapsed ? 'rotate(-90deg)' : 'rotate(0deg)',
                transition: 'transform .25s ease',
              }}
            >
              <path d="M6 9l6 6 6-6" />
            </svg>
          </button>

          <button
            type="button"
            onClick={() => setModalOpen(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              padding: '5px 10px',
              borderRadius: 20,
              background: 'rgba(145,132,217,0.14)',
              border: '1px solid rgba(145,132,217,0.3)',
              color: '#c4baff',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
              flexShrink: 0,
              transition: 'background .15s ease',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(145,132,217,0.25)' }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(145,132,217,0.14)' }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ width: 12, height: 12 }}>
              <path d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            {SHOPPING.COMMON_ITEMS_ADD_BUTTON}
          </button>
        </div>

        {/* Collapsible content */}
        <div
          style={{
            maxHeight: collapsed ? 0 : 400,
            overflow: 'hidden',
            transition: 'max-height .3s ease',
          }}
        >
          {items.length === 0 ? (
            <div style={{ padding: '0 16px 14px', fontSize: 13, color: '#595d6c' }}>
              {SHOPPING.COMMON_ITEMS_EMPTY}
            </div>
          ) : (
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: 8,
                padding: '0 16px 14px',
              }}
            >
              {items.map((item) => (
                <div
                  key={item.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 0,
                    borderRadius: 24,
                    border: `1px solid ${item.color}55`,
                    background: `color-mix(in srgb, ${item.color} 18%, transparent)`,
                    transform: pulsingId === item.id ? 'scale(0.93)' : 'scale(1)',
                    transition: 'transform .15s ease',
                    overflow: 'hidden',
                  }}
                >
                  {/* Tap area — add to list */}
                  <button
                    type="button"
                    onClick={() => handleChipTap(item)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '9px 4px 9px 14px',
                      background: 'transparent',
                      border: 'none',
                      color: '#e9e9ed',
                      fontSize: 15,
                      fontWeight: 500,
                      cursor: 'pointer',
                    }}
                  >
                    <span
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        background: item.color,
                        boxShadow: `0 0 6px ${item.color}`,
                        flexShrink: 0,
                      }}
                    />
                    {item.name}
                  </button>
                  {/* Delete X */}
                  <button
                    type="button"
                    onClick={() => handleDeleteItem(item.id)}
                    aria-label={SHOPPING.COMMON_ITEM_DELETE}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: '9px 12px 9px 6px',
                      background: 'transparent',
                      border: 'none',
                      color: `${item.color}`,
                      cursor: 'pointer',
                      opacity: 0.6,
                      transition: 'opacity .15s ease',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.opacity = '1' }}
                    onMouseLeave={(e) => { e.currentTarget.style.opacity = '0.6' }}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ width: 13, height: 13 }}>
                      <path d="M18 6L6 18M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <AddCommonItemModal
        open={modalOpen}
        householdId={householdId}
        onClose={() => setModalOpen(false)}
        onSaved={(item) => { onItemAdded(item); setModalOpen(false) }}
      />

      <ChooseListDialog
        open={chooseListOpen}
        lists={lists}
        currentUserId={currentUserId}
        onChoose={handleChooseList}
        onClose={() => { setChooseListOpen(false); setPendingItem(null) }}
      />
    </>
  )
}

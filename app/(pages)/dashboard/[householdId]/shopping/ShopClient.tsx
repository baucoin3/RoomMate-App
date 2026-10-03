'use client'

import { useState } from 'react'
import type { ShoppingList, ShoppingListItem, CommonShoppingItem } from '@/lib/types/shopping'
import { SHOPPING } from '@/locales/en'
import ListCard from '@/components/shopping/ListCard'
import NewListModal from '@/components/shopping/NewListModal'
import CommonItemsBar from '@/components/shopping/CommonItemsBar'

type TabFilter = 'all' | 'mine' | 'household'

interface ShopClientProps {
  initialLists: ShoppingList[]
  initialCommonItems: CommonShoppingItem[]
  householdId: string
  currentUserId: string
}

interface Toast {
  id: number
  message: string
}

function PlusIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className={className} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
    </svg>
  )
}

let toastCounter = 0

export default function ShopClient({ initialLists, initialCommonItems, householdId, currentUserId }: ShopClientProps) {
  const [lists, setLists] = useState<ShoppingList[]>(initialLists)
  const [commonItems, setCommonItems] = useState<CommonShoppingItem[]>(initialCommonItems)
  const [activeTab, setActiveTab] = useState<TabFilter>('all')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [toasts, setToasts] = useState<Toast[]>([])

  const filteredLists = lists.filter((list) => {
    if (activeTab === 'mine') return list.owner_type === 'user' && list.user_id === currentUserId
    if (activeTab === 'household') return list.owner_type === 'household'
    return true
  })

  function showToast(message: string) {
    const id = ++toastCounter
    setToasts((prev) => [...prev, { id, message }])
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3000)
  }

  function handleListCreated(newList: ShoppingList) {
    setLists((prev) => [newList, ...prev])
    setIsModalOpen(false)
  }

  function handleListDeleted(listId: string) {
    setLists((prev) => prev.filter((l) => l.id !== listId))
  }

  function handleItemsChanged(listId: string, updater: (items: ShoppingListItem[]) => ShoppingListItem[]) {
    setLists((prev) =>
      prev.map((list) =>
        list.id === listId
          ? { ...list, items: updater(list.items ?? []) }
          : list,
      ),
    )
  }

  function handleCommonItemAdded(item: CommonShoppingItem) {
    setCommonItems((prev) => [...prev, item])
  }

  function handleCommonItemDeleted(itemId: string) {
    setCommonItems((prev) => prev.filter((i) => i.id !== itemId))
  }

  function handleAddedToList(listId: string, newItem: ShoppingListItem, itemName: string) {
    setLists((prev) =>
      prev.map((list) =>
        list.id === listId
          ? { ...list, items: [...(list.items ?? []), newItem] }
          : list,
      ),
    )
    showToast(SHOPPING.COMMON_ITEM_ADDED_TOAST(itemName))
  }

  const tabs: { key: TabFilter; label: string }[] = [
    { key: 'all', label: SHOPPING.TABS.ALL },
    { key: 'mine', label: SHOPPING.TABS.MINE },
    { key: 'household', label: SHOPPING.TABS.HOUSEHOLD },
  ]

  return (
    <div className="flex flex-col gap-4 pt-1 pb-24 md:pb-6">
      {/* Quick Add bar */}
      <CommonItemsBar
        householdId={householdId}
        currentUserId={currentUserId}
        items={commonItems}
        lists={filteredLists}
        onItemAdded={handleCommonItemAdded}
        onItemDeleted={handleCommonItemDeleted}
        onAddedToList={handleAddedToList}
        onError={showToast}
      />

      {/* Tab filter chips + New list button */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                activeTab === tab.key
                  ? 'bg-white text-black'
                  : 'border border-white/15 text-white/50 hover:text-white/80 hover:border-white/30'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          aria-label={SHOPPING.ACTIONS.NEW_LIST}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-indigo-500 hover:bg-indigo-400 text-white text-sm font-semibold shadow-md transition-colors shrink-0"
        >
          <PlusIcon className="h-3.5 w-3.5" />
          {SHOPPING.ACTIONS.NEW_LIST}
        </button>
      </div>

      {/* List cards */}
      {filteredLists.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-2">
          <p className="text-sm text-white/40">{SHOPPING.EMPTY_STATE}</p>
          <p className="text-xs text-white/25">{SHOPPING.EMPTY_STATE_CTA}</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {filteredLists.map((list) => (
            <ListCard
              key={list.id}
              list={list}
              currentUserId={currentUserId}
              householdId={householdId}
              onItemsChanged={(updater) => handleItemsChanged(list.id, updater)}
              onListDeleted={() => handleListDeleted(list.id)}
            />
          ))}
        </div>
      )}

      {isModalOpen && (
        <NewListModal
          householdId={householdId}
          onCreated={handleListCreated}
          onClose={() => setIsModalOpen(false)}
        />
      )}

      {/* Toast notifications */}
      <div style={{ position: 'fixed', bottom: 96, left: '50%', transform: 'translateX(-50%)', zIndex: 900, display: 'flex', flexDirection: 'column', gap: 8, pointerEvents: 'none' }}>
        {toasts.map((toast) => (
          <div
            key={toast.id}
            style={{
              padding: '10px 18px',
              borderRadius: 20,
              background: 'rgba(30,32,50,0.95)',
              border: '1px solid rgba(145,132,217,0.3)',
              color: '#e9e9ed',
              fontSize: 13,
              fontWeight: 500,
              whiteSpace: 'nowrap',
              boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
              backdropFilter: 'blur(10px)',
            }}
          >
            {toast.message}
          </div>
        ))}
      </div>
    </div>
  )
}

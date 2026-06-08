'use client'

import { useState } from 'react'
import type { ShoppingList, ShoppingListItem } from '@/lib/types/shopping'
import { SHOPPING } from '@/locales/en'
import ListCard from '@/components/shopping/ListCard'
import NewListModal from '@/components/shopping/NewListModal'

type TabFilter = 'all' | 'mine' | 'household'

interface ShopClientProps {
  initialLists: ShoppingList[]
  householdId: string
  currentUserId: string
}

function PlusIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className={className} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
    </svg>
  )
}

export default function ShopClient({ initialLists, householdId, currentUserId }: ShopClientProps) {
  const [lists, setLists] = useState<ShoppingList[]>(initialLists)
  const [activeTab, setActiveTab] = useState<TabFilter>('all')
  const [isModalOpen, setIsModalOpen] = useState(false)

  const filteredLists = lists.filter((list) => {
    if (activeTab === 'mine') return list.owner_type === 'user' && list.user_id === currentUserId
    if (activeTab === 'household') return list.owner_type === 'household'
    return true
  })

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

  const tabs: { key: TabFilter; label: string }[] = [
    { key: 'all', label: SHOPPING.TABS.ALL },
    { key: 'mine', label: SHOPPING.TABS.MINE },
    { key: 'household', label: SHOPPING.TABS.HOUSEHOLD },
  ]

  return (
    <div className="flex flex-col gap-4 pt-1 pb-24 md:pb-6">
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
    </div>
  )
}

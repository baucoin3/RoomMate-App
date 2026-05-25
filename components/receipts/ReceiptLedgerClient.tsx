'use client'

import { useState } from 'react'
import { RECEIPTS } from '@/locales/en'
import type { ReceiptLedgerItem } from '@/lib/types/receipts'
import ReceiptCard from '@/components/receipts/ReceiptCard'

interface ReceiptLedgerClientProps {
  receipts: ReceiptLedgerItem[]
  categories: string[]
  householdId: string
}

export default function ReceiptLedgerClient({ receipts, categories, householdId }: ReceiptLedgerClientProps) {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)

  const filtered = selectedCategory === null
    ? receipts
    : receipts.filter((r) => r.category_name === selectedCategory)

  return (
    <div>
      {categories.length > 0 && (
        <div
          className="flex gap-2 overflow-x-auto pb-2 mb-4 scrollbar-none"
          aria-label={RECEIPTS.FILTER_BY_CATEGORY}
        >
          <button
            type="button"
            onClick={() => setSelectedCategory(null)}
            className={`flex-shrink-0 px-3 py-1 rounded-full text-sm font-medium border transition-colors ${
              selectedCategory === null
                ? 'bg-indigo-500 border-indigo-500 text-white'
                : 'bg-transparent border-white/20 text-white/60 hover:border-white/40 hover:text-white'
            }`}
          >
            {RECEIPTS.FILTER_ALL}
          </button>
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setSelectedCategory(cat)}
              className={`flex-shrink-0 px-3 py-1 rounded-full text-sm font-medium border transition-colors ${
                selectedCategory === cat
                  ? 'bg-indigo-500 border-indigo-500 text-white'
                  : 'bg-transparent border-white/20 text-white/60 hover:border-white/40 hover:text-white'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      )}

      <div className="flex flex-col gap-3">
        {filtered.map((receipt) => (
          <ReceiptCard key={receipt.id} receipt={receipt} householdId={householdId} />
        ))}
      </div>
    </div>
  )
}

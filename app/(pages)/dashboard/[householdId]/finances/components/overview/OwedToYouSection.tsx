'use client'

import { useState } from 'react'
import { apiClient, getErrorMessage } from '@/lib/api/client'
import type { OweItem } from '@/lib/types/finances'
import { FINANCES } from '@/locales/en'

interface OwedToYouSectionProps {
  items: OweItem[]
  householdId: string
  onSettled: () => void
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function displayDescription(item: OweItem): string {
  return item.receipt?.merchant_name ?? item.description
}

export default function OwedToYouSection({ items, householdId, onSettled }: OwedToYouSectionProps) {
  const [settling, setSettling] = useState<Set<string>>(new Set())
  const [groupErrors, setGroupErrors] = useState<Record<string, string>>({})

  if (items.length === 0) {
    return (
      <div className="rounded-2xl bg-[#1c1c24] px-5 py-8 text-center">
        <p className="text-sm text-white/40">{FINANCES.OVERVIEW.ALL_SETTLED_OWED}</p>
      </div>
    )
  }

  const groups = items.reduce<Record<string, { debtor: OweItem['debtor']; items: OweItem[] }>>(
    (acc, item) => {
      const key = item.debtor?.id ?? 'unknown'
      if (!acc[key]) acc[key] = { debtor: item.debtor, items: [] }
      acc[key].items.push(item)
      return acc
    },
    {},
  )

  async function settle(splitIds: string[], groupKey: string) {
    setSettling((prev) => new Set(Array.from(prev).concat(splitIds)))
    setGroupErrors((prev) => ({ ...prev, [groupKey]: '' }))
    try {
      await apiClient.post('/api/finances/settle', {
        split_ids: splitIds,
        household_id: householdId,
      })
      onSettled()
    } catch (err) {
      setGroupErrors((prev) => ({ ...prev, [groupKey]: getErrorMessage(err) }))
    } finally {
      setSettling((prev) => {
        const next = new Set(prev)
        splitIds.forEach((id) => next.delete(id))
        return next
      })
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {Object.entries(groups).map(([groupKey, group]) => {
        const name = group.debtor?.nickname ?? 'Someone'
        const total = group.items.reduce((sum, i) => sum + i.amount, 0)
        const groupErr = groupErrors[groupKey]
        const allIds = group.items.map((i) => i.split_id)
        const isGroupSettling = allIds.some((id) => settling.has(id))

        return (
          <div key={groupKey} className="rounded-2xl bg-[#1c1c24] overflow-hidden">
            {/* Group header */}
            <div className="flex items-center gap-3 px-5 py-3.5 border-b border-white/5">
              <div className="flex items-center justify-center w-8 h-8 rounded-full bg-green-500/20 text-green-400 text-sm font-semibold shrink-0">
                {name.charAt(0).toUpperCase()}
              </div>
              <span className="flex-1 text-sm font-semibold text-white">{name}</span>
              <span className="text-sm font-semibold text-green-400">
                +${total.toFixed(2)}
              </span>
            </div>

            {/* Per-item rows */}
            {group.items.map((item) => {
              const isItemSettling = settling.has(item.split_id)
              return (
                <div
                  key={item.split_id}
                  className="flex items-center gap-3 px-5 py-3 border-b border-white/5 last:border-0"
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-white truncate">{displayDescription(item)}</div>
                    <div className="text-xs text-white/40">{formatDate(item.date)}</div>
                  </div>
                  <span className="text-sm font-medium text-green-400 shrink-0">
                    ${item.amount.toFixed(2)}
                  </span>
                  <button
                    onClick={() => settle([item.split_id], groupKey)}
                    disabled={isItemSettling || isGroupSettling}
                    className="text-xs text-indigo-400 enabled:hover:text-indigo-300 transition-colors disabled:opacity-50 font-medium shrink-0"
                  >
                    {isItemSettling ? FINANCES.OVERVIEW.SETTLING : FINANCES.OVERVIEW.SETTLE}
                  </button>
                </div>
              )
            })}

            {/* Group footer */}
            <div className="flex items-center justify-between px-5 py-3 bg-white/3">
              {groupErr ? (
                <p className="text-xs text-red-400">{groupErr}</p>
              ) : (
                <span />
              )}
              <button
                onClick={() => settle(allIds, groupKey)}
                disabled={isGroupSettling}
                className="text-xs text-indigo-400 enabled:hover:text-indigo-300 transition-colors disabled:opacity-50 font-medium"
              >
                {isGroupSettling ? FINANCES.OVERVIEW.SETTLING : FINANCES.OVERVIEW.CLEAR_ALL}
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}

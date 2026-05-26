'use client'

import type { OweItem } from '@/lib/types/finances'
import { FINANCES } from '@/locales/en'

interface YouOweSectionProps {
  items: OweItem[]
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function displayDescription(item: OweItem): string {
  return item.receipt?.merchant_name ?? item.description
}

function participantLabel(p: OweItem['creditor']): string {
  if (!p) return 'Someone'
  if (p.type === 'guest') return FINANCES.OVERVIEW.YOU_OWE_GUEST(p.nickname)
  return p.nickname
}

export default function YouOweSection({ items }: YouOweSectionProps) {
  if (items.length === 0) {
    return (
      <div className="rounded-2xl bg-[#1c1c24] px-5 py-8 text-center">
        <p className="text-sm text-white/40">{FINANCES.OVERVIEW.ALL_SETTLED_OWE}</p>
      </div>
    )
  }

  const groups = items.reduce<Record<string, { creditor: OweItem['creditor']; items: OweItem[] }>>(
    (acc, item) => {
      const key = `${item.creditor?.type ?? 'unknown'}:${item.creditor?.id ?? 'unknown'}`
      if (!acc[key]) acc[key] = { creditor: item.creditor, items: [] }
      acc[key].items.push(item)
      return acc
    },
    {},
  )

  return (
    <div className="flex flex-col gap-3">
      {Object.entries(groups).map(([groupKey, group]) => {
        const name = participantLabel(group.creditor)
        const displayName = group.creditor?.nickname ?? 'Someone'
        const isGuest = group.creditor?.type === 'guest'
        const total = group.items.reduce((sum, i) => sum + i.amount, 0)

        return (
          <div key={groupKey} className="rounded-2xl bg-[#1c1c24] overflow-hidden">
            {/* Group header */}
            <div className="flex items-center gap-3 px-5 py-3.5 border-b border-white/5">
              <div className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-semibold shrink-0 ${
                isGuest ? 'bg-violet-500/20 text-violet-300' : 'bg-red-500/20 text-red-400'
              }`}>
                {displayName.charAt(0).toUpperCase()}
              </div>
              <span className="flex-1 text-sm font-semibold text-white flex items-center gap-1.5">
                {name}
                {isGuest && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-violet-500/20 text-violet-300 border border-violet-500/30">
                    {FINANCES.OVERVIEW.GUEST_BADGE}
                  </span>
                )}
              </span>
              <span className="text-sm font-semibold text-red-400">
                −${total.toFixed(2)}
              </span>
            </div>

            {/* Per-item rows */}
            {group.items.map((item) => (
              <div
                key={item.split_id}
                className="flex items-center gap-3 px-5 py-3 border-b border-white/5 last:border-0"
              >
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-white truncate">{displayDescription(item)}</div>
                  <div className="text-xs text-white/40">{formatDate(item.date)}</div>
                </div>
                <span className="text-sm font-medium text-red-400 shrink-0">
                  −${item.amount.toFixed(2)}
                </span>
              </div>
            ))}

            {/* Group footer — total only */}
            <div className="flex items-center justify-end px-5 py-3 bg-white/3">
              <span className="text-xs text-white/40">
                Total: <span className="text-red-400 font-medium">${total.toFixed(2)}</span>
              </span>
            </div>
          </div>
        )
      })}
    </div>
  )
}

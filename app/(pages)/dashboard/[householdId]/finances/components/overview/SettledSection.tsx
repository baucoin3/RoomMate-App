'use client'

import type { SettledItem } from '@/lib/types/finances'
import { FINANCES } from '@/locales/en'

interface SettledSectionProps {
  items: SettledItem[]
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export default function SettledSection({ items }: SettledSectionProps) {
  if (items.length === 0) {
    return (
      <div className="rounded-2xl bg-[#1c1c24] px-5 py-8 text-center">
        <p className="text-sm text-white/40">{FINANCES.OVERVIEW.NO_SETTLED}</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-1 rounded-2xl bg-[#1c1c24] overflow-hidden">
      {items.map((item) => (
        <div
          key={item.split_id}
          className="flex items-center gap-3 px-5 py-3 border-b border-white/5 last:border-0"
        >
          <div className="flex items-center justify-center w-7 h-7 rounded-full shrink-0 bg-white/5">
            <span className="text-xs">
              {item.you_paid ? '↑' : '↓'}
            </span>
          </div>

          <div className="flex-1 min-w-0">
            <p className="text-sm text-white/80 truncate">{item.description}</p>
            <p className="text-xs text-white/40">
              {item.you_paid
                ? FINANCES.OVERVIEW.YOU_PAID_TO(item.other_party.nickname)
                : FINANCES.OVERVIEW.PAID_YOU(item.other_party.nickname)}
              {' · '}
              {formatDate(item.date)}
            </p>
          </div>

          <span className={`text-sm font-mono font-medium shrink-0 ${item.you_paid ? 'text-red-400' : 'text-green-400'}`}>
            {item.you_paid ? '−' : '+'}${item.amount.toFixed(2)}
          </span>
        </div>
      ))}
    </div>
  )
}

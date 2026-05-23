'use client'

import { useState } from 'react'
import type { ActivityItem } from '@/lib/types/finances'
import { FINANCES } from '@/locales/en'

interface RecentActivityProps {
  items: ActivityItem[]
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function ActivityRow({ item }: { item: ActivityItem }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="border-b border-white/5 last:border-0">
      <button
        onClick={() => setExpanded((e) => !e)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-white/3 transition-colors"
        aria-expanded={expanded}
      >
        <div className="shrink-0 text-xs text-white/30 w-14">{formatDate(item.date)}</div>

        <div className="flex-1 min-w-0">
          <div className="text-sm text-white truncate">{item.description}</div>
          <div className="text-xs text-white/40 truncate">{item.category_name} · {item.paid_by.nickname}</div>
        </div>

        <div className="flex flex-col items-end shrink-0 gap-1">
          <span className="text-sm font-medium text-white">${item.total_amount.toFixed(2)}</span>
          {item.your_split && (
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-white/40">{FINANCES.OVERVIEW.YOUR_SHARE_LABEL}: ${item.your_split.calculated_amount.toFixed(2)}</span>
              <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                item.your_split.is_settled
                  ? 'text-green-400 bg-green-400/10'
                  : 'text-amber-400 bg-amber-400/10'
              }`}>
                {item.your_split.is_settled ? FINANCES.OVERVIEW.SETTLED_BADGE : FINANCES.OVERVIEW.OPEN_BADGE}
              </span>
            </div>
          )}
        </div>

        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={2}
          stroke="currentColor"
          className={`h-3.5 w-3.5 text-white/20 shrink-0 transition-transform ${expanded ? 'rotate-180' : ''}`}
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
        </svg>
      </button>

      {expanded && item.all_splits && item.all_splits.length > 0 && (
        <div className="px-4 pb-3 pt-1 flex flex-col gap-1.5">
          <div className="text-xs text-white/30 font-medium mb-1 ml-14">Per-member split</div>
          {item.all_splits.map((s, i) => (
            <div key={i} className="flex items-center gap-3 ml-14">
              <span className="flex-1 text-xs text-white/60">{s.member.nickname}</span>
              <span className="text-xs text-white/60">${s.calculated_amount.toFixed(2)}</span>
              <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                s.is_settled
                  ? 'text-green-400 bg-green-400/10'
                  : 'text-amber-400 bg-amber-400/10'
              }`}>
                {s.is_settled ? FINANCES.OVERVIEW.SETTLED_BADGE : FINANCES.OVERVIEW.OPEN_BADGE}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function RecentActivity({ items }: RecentActivityProps) {
  if (items.length === 0) {
    return (
      <p className="text-sm text-white/40 py-2">{FINANCES.OVERVIEW.NO_ACTIVITY}</p>
    )
  }

  return (
    <div className="rounded-2xl bg-[#1c1c24] overflow-hidden">
      {items.map((item) => (
        <ActivityRow key={item.id} item={item} />
      ))}
    </div>
  )
}

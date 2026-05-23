'use client'

import { useState } from 'react'
import { apiClient, getErrorMessage } from '@/lib/api/client'
import type { BalanceSummary } from '@/lib/types/finances'
import { FINANCES } from '@/locales/en'

interface BalanceCardProps {
  summary: BalanceSummary
  householdId: string
  onSettled: () => void
}

export default function BalanceCard({ summary, householdId, onSettled }: BalanceCardProps) {
  const [settling, setSettling] = useState<string | null>(null)
  const [error, setError] = useState('')

  const { you_owe, owed_to_you } = summary

  async function handleSettle(categoryId: string, withMemberId: string) {
    const key = `${categoryId}::${withMemberId}`
    setSettling(key)
    setError('')
    try {
      await apiClient.post('/api/finances/settle', {
        category_id: categoryId,
        with_member_id: withMemberId,
        household_id: householdId,
      })
      onSettled()
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setSettling(null)
    }
  }

  if (you_owe.length === 0 && owed_to_you.length === 0) {
    return (
      <div className="rounded-2xl bg-[#1c1c24] px-5 py-8 text-center">
        <p className="text-sm text-white/40">{FINANCES.OVERVIEW.ALL_SETTLED}</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {error && <p className="text-xs text-red-400 px-1">{error}</p>}

      {/* You owe */}
      {you_owe.map((entry) => {
        const memberName = entry.to_member?.nickname ?? 'Someone'
        const key = `${entry.category.id}::${entry.to_member?.id ?? ''}`
        return (
          <div key={key} className="rounded-2xl bg-[#1c1c24] overflow-hidden">
            <div className="flex items-center gap-3 px-5 py-3.5 border-b border-white/5">
              <div className="flex items-center justify-center w-8 h-8 rounded-full bg-red-500/20 text-red-400 text-sm font-semibold shrink-0">
                {memberName.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1">
                <span className="text-sm font-semibold text-white">{memberName}</span>
              </div>
              <span className="text-sm font-semibold text-red-400">
                −${entry.amount.toFixed(2)}
              </span>
            </div>
            <div className="flex items-center justify-between px-5 py-3">
              <div>
                <span className="text-xs text-white/40">{entry.category.name}</span>
                <span className="ml-2 text-xs text-white/25">({entry.expense_count} expense{entry.expense_count !== 1 ? 's' : ''})</span>
              </div>
              <button
                onClick={() => handleSettle(entry.category.id, entry.to_member?.id ?? '')}
                disabled={settling === key}
                className="text-xs text-indigo-400 enabled:hover:text-indigo-300 transition-colors disabled:opacity-50 font-medium"
              >
                {settling === key ? FINANCES.OVERVIEW.SETTLING : FINANCES.OVERVIEW.SETTLE_UP}
              </button>
            </div>
          </div>
        )
      })}

      {/* Owed to you */}
      {owed_to_you.map((entry) => {
        const memberName = entry.from_member?.nickname ?? 'Someone'
        const key = `${entry.category.id}::${entry.from_member?.id ?? ''}`
        return (
          <div key={key} className="rounded-2xl bg-[#1c1c24] overflow-hidden">
            <div className="flex items-center gap-3 px-5 py-3.5 border-b border-white/5">
              <div className="flex items-center justify-center w-8 h-8 rounded-full bg-green-500/20 text-green-400 text-sm font-semibold shrink-0">
                {memberName.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1">
                <span className="text-sm font-semibold text-white">{memberName}</span>
              </div>
              <span className="text-sm font-semibold text-green-400">
                +${entry.amount.toFixed(2)}
              </span>
            </div>
            <div className="px-5 py-3">
              <span className="text-xs text-white/40">{entry.category.name}</span>
              <span className="ml-2 text-xs text-white/25">({entry.expense_count} expense{entry.expense_count !== 1 ? 's' : ''})</span>
            </div>
          </div>
        )
      })}
    </div>
  )
}

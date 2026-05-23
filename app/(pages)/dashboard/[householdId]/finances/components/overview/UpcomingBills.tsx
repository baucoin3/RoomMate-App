'use client'

import { useState } from 'react'
import { apiClient, getErrorMessage } from '@/lib/api/client'
import type { UpcomingBill } from '@/lib/types/finances'
import { FINANCES } from '@/locales/en'

interface UpcomingBillsProps {
  bills: UpcomingBill[]
  onConfirmed: () => void
}

/**
 * Returns an rgba color string interpolated from neutral → orange → red
 * based on how close the bill is relative to its alert window.
 * urgency 0 = just entered the window (neutral), 1 = due today / overdue (full red).
 */
function urgencyColor(urgency: number): string {
  // neutral: rgb(255,255,255) at 0% opacity blended with orange then red
  // We go from transparent (low urgency) through orange to red.
  const clamped = Math.max(0, Math.min(1, urgency))
  // orange: 251,146,60 (orange-400)  red: 239,68,68 (red-500)
  const r = Math.round(251 + (239 - 251) * clamped)
  const g = Math.round(146 + (68 - 146) * clamped)
  const b = Math.round(60 + (68 - 60) * clamped)
  // opacity: start at 0.5 when just entering window, reach 1.0 at overdue
  const alpha = 0.5 + 0.5 * clamped
  return `rgba(${r},${g},${b},${alpha})`
}

function computeUrgency(bill: UpcomingBill): number {
  if (bill.is_overdue) return 1
  if (bill.alert_days_before <= 0) return 0
  return 1 - bill.days_until / bill.alert_days_before
}

function formatDate(isoDate: string): string {
  return new Date(isoDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric' })
}

export default function UpcomingBills({ bills, onConfirmed }: UpcomingBillsProps) {
  const [confirming, setConfirming] = useState<string | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})

  async function handleConfirm(recurringExpenseId: string) {
    setConfirming(recurringExpenseId)
    setErrors((prev) => ({ ...prev, [recurringExpenseId]: '' }))
    try {
      await apiClient.post(`/api/finances/recurring/${recurringExpenseId}/confirm`)
      onConfirmed()
    } catch (err) {
      setErrors((prev) => ({ ...prev, [recurringExpenseId]: getErrorMessage(err) }))
    } finally {
      setConfirming(null)
    }
  }

  if (bills.length === 0) {
    return (
      <p className="text-sm text-white/40 py-2">{FINANCES.OVERVIEW.NO_UPCOMING}</p>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      {bills.map((bill) => {
        const urgency = computeUrgency(bill)
        const color = urgencyColor(urgency)
        const formattedDate = formatDate(bill.due_date)

        return (
          <div
            key={bill.recurring_expense_id}
            className="rounded-xl bg-[#1c1c24] border px-4 py-3.5 flex flex-col gap-2"
            style={{ borderColor: urgency > 0.1 ? color : 'rgba(255,255,255,0.05)' }}
          >
            {/* Past due banner */}
            {bill.is_overdue && (
              <div
                className="rounded-lg px-3 py-1.5 text-xs font-semibold"
                style={{ backgroundColor: `rgba(239,68,68,0.15)`, color }}
              >
                {FINANCES.OVERVIEW.PAST_DUE(formattedDate)}
              </div>
            )}

            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <span className="text-sm font-semibold text-white truncate block">{bill.description}</span>
                <span className="text-xs text-white/40">{bill.category_name}</span>
              </div>
              <div className="text-right shrink-0">
                <span className="text-sm font-semibold" style={{ color: urgency > 0.1 ? color : 'white' }}>
                  ${bill.your_share.toFixed(2)}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between gap-3">
              <div className="flex flex-col gap-0.5">
                {/* Who you owe / who collects */}
                <span className="text-xs font-medium" style={{ color: urgency > 0.1 ? color : 'rgba(255,255,255,0.6)' }}>
                  {bill.you_are_payer
                    ? FINANCES.OVERVIEW.COLLECT_FROM_ROOMMATES
                    : FINANCES.OVERVIEW.YOU_OWE_PERSON(bill.payer.nickname)}
                </span>
                {/* Due date line — only show if not overdue (overdue has the banner above) */}
                {!bill.is_overdue && (
                  <span className="text-xs text-white/30">
                    {FINANCES.OVERVIEW.DUE(formattedDate)}
                  </span>
                )}
              </div>

              {bill.you_are_payer && (
                <button
                  onClick={() => handleConfirm(bill.recurring_expense_id)}
                  disabled={confirming === bill.recurring_expense_id}
                  className="px-3 py-1.5 rounded-lg bg-indigo-500/20 enabled:hover:bg-indigo-500/30 border border-indigo-500/30 text-xs text-indigo-400 font-medium transition-colors disabled:opacity-50"
                >
                  {confirming === bill.recurring_expense_id ? FINANCES.OVERVIEW.CONFIRMING : FINANCES.OVERVIEW.CONFIRM_MONTH}
                </button>
              )}
            </div>

            {errors[bill.recurring_expense_id] && (
              <p className="text-xs text-red-400">{errors[bill.recurring_expense_id]}</p>
            )}
          </div>
        )
      })}
    </div>
  )
}

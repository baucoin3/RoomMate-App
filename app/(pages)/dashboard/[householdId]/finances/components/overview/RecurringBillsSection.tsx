'use client'

import { useState } from 'react'
import Link from 'next/link'
import { apiClient, getErrorMessage } from '@/lib/api/client'
import type { RecurringBillOverview, RecurringBillMemberStatus } from '@/lib/types/finances'
import { FINANCES } from '@/locales/en'
import { ROUTES } from '@/lib/constants/routes'

interface RecurringBillsSectionProps {
  bills: RecurringBillOverview[]
  householdId: string
  onChanged: () => void
}

function memberRowLabel(
  bill: RecurringBillOverview,
  member: RecurringBillMemberStatus,
): string {
  const amount = member.share_amount.toFixed(2)
  const payerName = bill.payer.nickname

  if (member.is_payer) {
    if (member.is_viewer) return FINANCES.OVERVIEW.YOU_HAVE_PAID
    return FINANCES.OVERVIEW.MEMBER_HAS_PAID(member.member_name)
  }

  if (bill.viewer_is_payer) {
    return FINANCES.OVERVIEW.ROOMMATE_OWES_YOU(member.member_name, amount)
  }

  if (member.is_viewer) {
    return FINANCES.OVERVIEW.YOU_OWE_PERSON(payerName)
  }

  return FINANCES.OVERVIEW.THIRD_PARTY_OWES(member.member_name, payerName, amount)
}

export default function RecurringBillsSection({
  bills,
  householdId,
  onChanged,
}: RecurringBillsSectionProps) {
  const [confirming, setConfirming] = useState<Set<string>>(new Set())
  const [markingPaid, setMarkingPaid] = useState<Set<string>>(new Set())
  const [billErrors, setBillErrors] = useState<Record<string, string>>({})

  if (bills.length === 0) {
    return (
      <div className="rounded-2xl bg-[#1c1c24] ring-1 ring-indigo-500/10 px-5 py-8 text-center">
        <p className="text-sm text-white/40">{FINANCES.OVERVIEW.NO_RECURRING_BILLS}</p>
        <Link
          href={ROUTES.HOUSEHOLD_SETTINGS(householdId)}
          className="mt-3 inline-block text-sm text-indigo-400 hover:text-indigo-300 transition-colors"
        >
          {FINANCES.OVERVIEW.GO_TO_SETTINGS}
        </Link>
      </div>
    )
  }

  async function handleConfirm(recurringExpenseId: string) {
    setConfirming((prev) => new Set(prev).add(recurringExpenseId))
    setBillErrors((prev) => ({ ...prev, [recurringExpenseId]: '' }))
    try {
      await apiClient.post(`/api/finances/recurring/${recurringExpenseId}/confirm`)
      onChanged()
    } catch (err) {
      setBillErrors((prev) => ({ ...prev, [recurringExpenseId]: getErrorMessage(err) }))
    } finally {
      setConfirming((prev) => {
        const next = new Set(prev)
        next.delete(recurringExpenseId)
        return next
      })
    }
  }

  async function handleMarkPaid(recurringExpenseId: string, splitId: string) {
    setMarkingPaid((prev) => new Set(prev).add(splitId))
    setBillErrors((prev) => ({ ...prev, [recurringExpenseId]: '' }))
    try {
      await apiClient.post('/api/finances/settle', {
        split_ids: [splitId],
        household_id: householdId,
      })
      onChanged()
    } catch (err) {
      setBillErrors((prev) => ({ ...prev, [recurringExpenseId]: getErrorMessage(err) }))
    } finally {
      setMarkingPaid((prev) => {
        const next = new Set(prev)
        next.delete(splitId)
        return next
      })
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {bills.map((bill) => {
        const isConfirming = confirming.has(bill.recurring_expense_id)
        const billErr = billErrors[bill.recurring_expense_id]
        const isLogged = bill.cycle_status === 'logged'

        return (
          <div
            key={bill.recurring_expense_id}
            className="rounded-2xl bg-[#1c1c24] ring-1 ring-indigo-500/10 overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center gap-3 px-5 py-3.5 border-b border-white/5">
              <div className="flex items-center justify-center w-8 h-8 rounded-full text-sm font-semibold shrink-0 bg-indigo-500/20 text-indigo-300">
                {bill.description.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-white truncate">{bill.description}</div>
                <div className="text-xs text-white/40">
                  {FINANCES.SETTINGS.DUE_ON(bill.due_day_of_month)}
                </div>
                <div className="text-xs text-indigo-300/80">
                  {FINANCES.OVERVIEW.PAYER_PAYS(bill.payer.nickname)}
                </div>
              </div>
              <div className="flex flex-col items-end gap-1.5 shrink-0">
                <span className="text-sm font-semibold text-indigo-300">
                  ${bill.total_amount.toFixed(2)}
                </span>
                <span
                  className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                    isLogged
                      ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                      : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                  }`}
                >
                  {isLogged
                    ? FINANCES.OVERVIEW.LOGGED_THIS_CYCLE
                    : FINANCES.OVERVIEW.NOT_LOGGED_THIS_CYCLE}
                </span>
              </div>
            </div>

            {/* Member rows */}
            {bill.members.map((member) => {
              const isSettled = member.is_settled === true
              const isOpen = isLogged && member.is_settled === false
              const isViewerOwes = member.is_viewer && !member.is_payer
              const highlightViewerOwes = isViewerOwes && (!isLogged || !isSettled)
              const canMarkPaid =
                isLogged &&
                bill.viewer_is_payer &&
                !member.is_payer &&
                isOpen &&
                member.split_id != null
              const isMarking = member.split_id != null && markingPaid.has(member.split_id)

              return (
                <div
                  key={member.member_id}
                  className={`flex items-center gap-3 px-5 py-3 border-b border-white/5 last:border-0 ${
                    highlightViewerOwes
                      ? 'bg-red-500/10 border-l-2 border-l-red-400 pl-[18px]'
                      : ''
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <div
                      className={`truncate ${
                        highlightViewerOwes
                          ? 'text-sm font-bold text-red-300'
                          : 'text-sm text-white'
                      }`}
                    >
                      {memberRowLabel(bill, member)}
                    </div>
                    {!member.is_payer && (
                      <div
                        className={
                          highlightViewerOwes
                            ? 'text-sm font-bold text-red-400'
                            : 'text-xs text-white/40'
                        }
                      >
                        ${member.share_amount.toFixed(2)}
                      </div>
                    )}
                  </div>
                  {isLogged && (
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${
                        isSettled
                          ? 'bg-green-500/20 text-green-400'
                          : 'bg-amber-500/20 text-amber-400'
                      }`}
                    >
                      {isSettled ? FINANCES.OVERVIEW.SETTLED_BADGE : FINANCES.OVERVIEW.OPEN_BADGE}
                    </span>
                  )}
                  {canMarkPaid && member.split_id && (
                    <button
                      onClick={() => handleMarkPaid(bill.recurring_expense_id, member.split_id!)}
                      disabled={isMarking}
                      className="text-xs text-indigo-400 enabled:hover:text-indigo-300 transition-colors disabled:opacity-50 font-medium shrink-0"
                    >
                      {isMarking ? FINANCES.OVERVIEW.MARKING_PAID : FINANCES.OVERVIEW.MARK_PAID}
                    </button>
                  )}
                </div>
              )
            })}

            {/* Footer actions */}
            <div className="flex items-center justify-between px-5 py-3 bg-white/3">
              {billErr ? (
                <p className="text-xs text-red-400">{billErr}</p>
              ) : (
                <span />
              )}
              {!isLogged && (
                <button
                  onClick={() => handleConfirm(bill.recurring_expense_id)}
                  disabled={isConfirming}
                  className="text-xs text-indigo-400 enabled:hover:text-indigo-300 transition-colors disabled:opacity-50 font-medium"
                >
                  {isConfirming ? FINANCES.OVERVIEW.CONFIRMING : FINANCES.OVERVIEW.CONFIRM_MONTH}
                </button>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

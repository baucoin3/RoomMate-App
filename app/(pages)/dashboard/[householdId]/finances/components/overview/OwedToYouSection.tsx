'use client'

import { useState } from 'react'
import { apiClient, getErrorMessage } from '@/lib/api/client'
import type { OweItem, RecurringBillOverview } from '@/lib/types/finances'
import { ArrowPathIcon, ChevronDownIcon, ChevronUpIcon } from '@/components/icons'
import { FINANCES } from '@/locales/en'

interface OwedToYouSectionProps {
  items: OweItem[]
  recurringBills: RecurringBillOverview[]
  householdId: string
  onSettled: () => void
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function displayDescription(item: OweItem): string {
  return item.receipt?.merchant_name ?? item.description
}

function participantLabel(p: OweItem['debtor']): string {
  if (!p) return 'Someone'
  if (p.type === 'guest') return FINANCES.OVERVIEW.GUEST_OWES_YOU(p.nickname)
  return p.nickname
}

function RecurringBillsSubSection({
  bills,
  householdId,
  onChanged,
}: {
  bills: RecurringBillOverview[]
  householdId: string
  onChanged: () => void
}) {
  const [collapsed, setCollapsed] = useState(false)
  const [confirming, setConfirming] = useState<Set<string>>(new Set())
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [pendingConfirmBill, setPendingConfirmBill] = useState<RecurringBillOverview | null>(null)

  const payerBills = bills.filter((b) => b.viewer_is_payer)
  if (payerBills.length === 0) return null

  async function confirmMonth(bill: RecurringBillOverview) {
    setPendingConfirmBill(null)
    setConfirming((prev) => new Set(prev).add(bill.recurring_expense_id))
    setErrors((prev) => ({ ...prev, [bill.recurring_expense_id]: '' }))
    try {
      await apiClient.post(`/api/finances/recurring/${bill.recurring_expense_id}/confirm`, {
        household_id: householdId,
      })
      onChanged()
    } catch (err) {
      setErrors((prev) => ({ ...prev, [bill.recurring_expense_id]: getErrorMessage(err) }))
    } finally {
      setConfirming((prev) => {
        const next = new Set(prev)
        next.delete(bill.recurring_expense_id)
        return next
      })
    }
  }

  function handleLogMonthClick(bill: RecurringBillOverview) {
    const unreportedNonPayers = bill.members.filter(
      (m) => !m.is_payer && !m.self_reported && m.is_settled !== true,
    )
    if (unreportedNonPayers.length > 0) {
      setPendingConfirmBill(bill)
    } else {
      confirmMonth(bill)
    }
  }

  return (
    <>
      {pendingConfirmBill && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
          <div className="w-full max-w-sm rounded-2xl bg-[#1c1c24] ring-1 ring-white/10 p-5 flex flex-col gap-4">
            <p className="text-sm font-semibold text-white">
              {FINANCES.OVERVIEW.LOG_MONTH_MODAL_TITLE}
            </p>
            <p className="text-sm text-white/60">
              {FINANCES.OVERVIEW.LOG_MONTH_MODAL_BODY(
                pendingConfirmBill.members
                  .filter((m) => !m.is_payer && !m.self_reported && m.is_settled !== true)
                  .map((m) => m.member_name)
                  .join(', '),
              )}
            </p>
            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => setPendingConfirmBill(null)}
                className="text-sm text-white/50 hover:text-white/80 transition-colors"
              >
                {FINANCES.OVERVIEW.LOG_MONTH_MODAL_CANCEL}
              </button>
              <button
                type="button"
                onClick={() => confirmMonth(pendingConfirmBill)}
                className="text-sm font-medium text-indigo-400 hover:text-indigo-300 transition-colors"
              >
                {FINANCES.OVERVIEW.LOG_MONTH_MODAL_PROCEED}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="rounded-2xl bg-[#1c1c24] ring-1 ring-indigo-500/15 overflow-hidden mb-3">
        <button
          type="button"
          onClick={() => setCollapsed((v) => !v)}
          className="w-full flex items-center gap-2 px-4 py-2.5 border-b border-white/5 hover:bg-white/3 transition-colors"
        >
          <span className="flex items-center gap-1.5 flex-1">
            <ArrowPathIcon className="h-[11px] w-[11px] text-indigo-400" />
            <span className="text-xs font-semibold text-indigo-300 uppercase tracking-wide">
              {FINANCES.OVERVIEW.RECURRING_SUBSECTION_TITLE}
            </span>
          </span>
          {collapsed ? (
            <ChevronDownIcon className="h-[11px] w-[11px] text-white/30" />
          ) : (
            <ChevronUpIcon className="h-[11px] w-[11px] text-white/30" />
          )}
        </button>

        {!collapsed && payerBills.map((bill) => {
          const isConfirming = confirming.has(bill.recurring_expense_id)
          const isLogged = bill.cycle_status === 'logged'
          const err = errors[bill.recurring_expense_id]
          const nonPayerMembers = bill.members.filter((m) => !m.is_payer)
          const allSettled = isLogged && nonPayerMembers.every((m) => m.is_settled === true)

          return (
            <div key={bill.recurring_expense_id} className="border-b border-white/5 last:border-0">
              {/* Bill header */}
              <div className="flex items-center gap-3 px-4 py-3 border-b border-white/5 bg-green-500/5">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-white truncate">{bill.description}</p>
                  <p className="text-xs text-white/40">
                    {FINANCES.OVERVIEW.RECURRING_DUE(bill.due_day_of_month)}
                    {' · '}
                    {FINANCES.OVERVIEW.COLLECT_FROM_ROOMMATES}
                  </p>
                  {err && <p className="text-xs text-red-400 mt-0.5">{err}</p>}
                </div>
                <span className="text-sm font-mono font-semibold text-green-400 shrink-0">
                  +${bill.total_amount.toFixed(2)}
                </span>
                {allSettled ? (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/20 text-green-400 shrink-0">
                    {FINANCES.OVERVIEW.SETTLED_BADGE}
                  </span>
                ) : !isLogged ? (
                  <button
                    type="button"
                    onClick={() => handleLogMonthClick(bill)}
                    disabled={isConfirming}
                    className="text-xs font-medium text-indigo-400 enabled:hover:text-indigo-300 transition-colors disabled:opacity-50 shrink-0"
                  >
                    {isConfirming ? FINANCES.OVERVIEW.LOGGING_MONTH : FINANCES.OVERVIEW.CONFIRM_MONTH_SHORT}
                  </button>
                ) : (
                  <span className="text-xs text-amber-400/80 shrink-0">
                    {FINANCES.OVERVIEW.OPEN_BADGE}
                  </span>
                )}
              </div>

              {/* Per-member avatar rows */}
              {nonPayerMembers.map((member) => {
                const isPending = !isLogged && !member.self_reported
                const isPrePaid = !isLogged && member.self_reported
                const isSettled = isLogged && member.is_settled === true
                const isAwaiting = isLogged && member.is_settled === false

                return (
                  <div
                    key={member.member_id}
                    className="flex items-center gap-3 px-5 py-2.5 border-b border-white/5 last:border-0"
                  >
                    <div className="flex items-center justify-center w-7 h-7 rounded-full bg-green-500/20 text-green-400 text-xs font-semibold shrink-0">
                      {member.member_name.charAt(0).toUpperCase()}
                    </div>
                    <span className="flex-1 text-sm text-white">{member.member_name}</span>
                    <span className="text-sm font-medium text-green-400 shrink-0">
                      ${member.share_amount.toFixed(2)}
                    </span>
                    {isSettled && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/20 text-green-400 shrink-0">
                        {FINANCES.OVERVIEW.SETTLED_BADGE}
                      </span>
                    )}
                    {isAwaiting && (
                      <span className="text-xs text-amber-400/80 shrink-0">
                        {FINANCES.OVERVIEW.RECURRING_MEMBER_AWAITING}
                      </span>
                    )}
                    {isPrePaid && (
                      <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-green-500/20 text-green-400 shrink-0">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" className="h-3 w-3" aria-hidden="true">
                          <path d="M20 6 9 17l-5-5" />
                        </svg>
                        {FINANCES.OVERVIEW.PRE_PAID_BADGE}
                      </span>
                    )}
                    {isPending && (
                      <span className="text-xs text-white/30 shrink-0">
                        {FINANCES.OVERVIEW.RECURRING_MEMBER_PENDING}
                      </span>
                    )}
                  </div>
                )
              })}
            </div>
          )
        })}
      </div>
    </>
  )
}

export default function OwedToYouSection({ items, recurringBills, householdId, onSettled }: OwedToYouSectionProps) {
  const [settling, setSettling] = useState<Set<string>>(new Set())
  const [groupErrors, setGroupErrors] = useState<Record<string, string>>({})

  const hasRecurring = recurringBills.some((b) => b.viewer_is_payer)
  const hasRegular = items.length > 0

  // No items and no recurring expenses
  if (!hasRecurring && !hasRegular) {
    return (
      <div className="rounded-2xl bg-[#1c1c24] px-5 py-8 text-center">
        <p className="text-sm text-white/40">{FINANCES.OVERVIEW.ALL_SETTLED_OWED}</p>
      </div>
    )
  }

  const groups = items.reduce<Record<string, { debtor: OweItem['debtor']; items: OweItem[] }>>(
    (acc, item) => {
      const key = `${item.debtor?.type ?? 'unknown'}:${item.debtor?.id ?? 'unknown'}`
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
    <div>
      <RecurringBillsSubSection bills={recurringBills} householdId={householdId} onChanged={onSettled} />

      {hasRegular && (
        <div className="flex flex-col gap-3">
          {Object.entries(groups).map(([groupKey, group]) => {
            const name = participantLabel(group.debtor)
            const displayName = group.debtor?.nickname ?? 'Someone'
            const isGuest = group.debtor?.type === 'guest'
            const total = group.items.reduce((sum, i) => sum + i.amount, 0)
            const groupErr = groupErrors[groupKey]
            const allIds = group.items.map((i) => i.split_id)
            const isGroupSettling = allIds.some((id) => settling.has(id))

            return (
              <div key={groupKey} className="rounded-2xl bg-[#1c1c24] overflow-hidden">
                {/* Group header */}
                <div className="flex items-center gap-3 px-5 py-3.5 border-b border-white/5">
                  <div className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-semibold shrink-0 ${
                    isGuest ? 'bg-violet-500/20 text-violet-300' : 'bg-green-500/20 text-green-400'
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
      )}
    </div>
  )
}

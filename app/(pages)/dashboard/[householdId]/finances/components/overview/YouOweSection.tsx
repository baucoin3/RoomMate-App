'use client'

import { useState } from 'react'
import { apiClient, getErrorMessage } from '@/lib/api/client'
import type { HouseholdMemberSummary, OweItem, RecurringBillOverview } from '@/lib/types/finances'
import { ArrowPathIcon, ChevronDownIcon, ChevronUpIcon } from '@/components/icons'
import { FINANCES } from '@/locales/en'

interface YouOweSectionProps {
  items: OweItem[]
  recurringBills: RecurringBillOverview[]
  householdId: string
  onChanged: () => void
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
  const [settling, setSettling] = useState<Set<string>>(new Set())
  const [errors, setErrors] = useState<Record<string, string>>({})

  if (bills.length === 0) return null

  const viewerBills = bills.filter((b) => !b.viewer_is_payer && b.viewer_owes_amount > 0)
  if (viewerBills.length === 0) return null

  const billsByPayer = viewerBills.reduce<
    Record<string, { payer: HouseholdMemberSummary; bills: RecurringBillOverview[] }>
  >((acc, bill) => {
    const key = bill.payer.id
    if (!acc[key]) acc[key] = { payer: bill.payer, bills: [] }
    acc[key].bills.push(bill)
    return acc
  }, {})

  async function settle(bill: RecurringBillOverview) {
    const viewerMember = bill.members.find((m) => m.is_viewer)
    if (!viewerMember) return

    setSettling((prev) => new Set(prev).add(bill.recurring_expense_id))
    setErrors((prev) => ({ ...prev, [bill.recurring_expense_id]: '' }))
    try {
      await apiClient.post(`/api/finances/recurring/${bill.recurring_expense_id}/settle-member`, {
        household_id: householdId,
        member_id: viewerMember.member_id,
      })
      onChanged()
    } catch (err) {
      setErrors((prev) => ({ ...prev, [bill.recurring_expense_id]: getErrorMessage(err) }))
    } finally {
      setSettling((prev) => {
        const next = new Set(prev)
        next.delete(bill.recurring_expense_id)
        return next
      })
    }
  }

  return (
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

      {!collapsed && Object.entries(billsByPayer).map(([payerId, { payer, bills: payerBills }]) => {
        const payerTotal = payerBills.reduce((sum, b) => sum + b.viewer_owes_amount, 0)

        return (
          <div key={payerId} className="border-b border-white/5 last:border-0">
            {/* Payer avatar header */}
            <div className="flex items-center gap-3 px-4 py-3 border-b border-white/5 bg-white/2">
              <div className="flex items-center justify-center w-8 h-8 rounded-full bg-red-500/20 text-red-400 text-sm font-semibold shrink-0">
                {payer.nickname.charAt(0).toUpperCase()}
              </div>
              <span className="flex-1 text-sm font-semibold text-white">{payer.nickname}</span>
              <span className="text-sm font-semibold text-red-400">
                −${payerTotal.toFixed(2)}
              </span>
            </div>

            {/* Bill rows under this payer */}
            {payerBills.map((bill) => {
              const isSettling = settling.has(bill.recurring_expense_id)
              const viewerAlreadySettled = bill.members.find((m) => m.is_viewer)?.is_settled === true
              const err = errors[bill.recurring_expense_id]

              return (
                <div
                  key={bill.recurring_expense_id}
                  className="flex items-center gap-3 px-5 py-3 border-b border-white/5 last:border-0 bg-red-500/5"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white truncate">{bill.description}</p>
                    <p className="text-xs text-white/40">
                      {FINANCES.OVERVIEW.RECURRING_DUE(bill.due_day_of_month)}
                    </p>
                    {err && <p className="text-xs text-red-400 mt-0.5">{err}</p>}
                  </div>
                  <span className="text-sm font-mono font-medium text-red-400 shrink-0">
                    −${bill.viewer_owes_amount.toFixed(2)}
                  </span>
                  {viewerAlreadySettled ? (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/20 text-green-400 shrink-0">
                      {FINANCES.OVERVIEW.SETTLED_BADGE}
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => settle(bill)}
                      disabled={isSettling}
                      className="text-xs font-medium text-indigo-400 enabled:hover:text-indigo-300 transition-colors disabled:opacity-50 shrink-0"
                    >
                      {isSettling ? FINANCES.OVERVIEW.SETTLING_RECURRING : FINANCES.OVERVIEW.SETTLE_RECURRING}
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        )
      })}
    </div>
  )
}

export default function YouOweSection({ items, recurringBills, householdId, onChanged }: YouOweSectionProps) {
  const groups = items.reduce<Record<string, { creditor: OweItem['creditor']; items: OweItem[] }>>(
    (acc, item) => {
      const key = `${item.creditor?.type ?? 'unknown'}:${item.creditor?.id ?? 'unknown'}`
      if (!acc[key]) acc[key] = { creditor: item.creditor, items: [] }
      acc[key].items.push(item)
      return acc
    },
    {},
  )

  const hasRecurring = recurringBills.some((b) => !b.viewer_is_payer && b.viewer_owes_amount > 0)
  const hasRegular = items.length > 0

  if (!hasRecurring && !hasRegular) {
    return (
      <div className="rounded-2xl bg-[#1c1c24] px-5 py-8 text-center">
        <p className="text-sm text-white/40">{FINANCES.OVERVIEW.ALL_SETTLED_OWE}</p>
      </div>
    )
  }

  return (
    <div>
      <RecurringBillsSubSection bills={recurringBills} householdId={householdId} onChanged={onChanged} />

      {hasRegular && (
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
      )}
    </div>
  )
}

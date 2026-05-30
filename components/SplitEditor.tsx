'use client'

import { FINANCES } from '@/locales/en'
import { SPLIT_TOTAL, buildEqualAmounts, buildEqualPercentages, roundPercentage, splitsSumTo100 } from '@/lib/utils/splits'
import type { HouseholdMemberSummary } from '@/lib/types/finances'

export interface SplitValue {
  household_member_id: string
  percentage: number
  amount?: number
}

interface SplitEditorProps {
  members: HouseholdMemberSummary[]
  value: SplitValue[]
  onChange: (splits: SplitValue[]) => void
  totalAmount?: number
  showAmountInputs?: boolean
}

function roundCurrency(value: number) {
  return Math.round(value * 100) / 100
}

function clampPercentage(value: number) {
  return Math.min(SPLIT_TOTAL, Math.max(0, value))
}

function formatEditableNumber(value: number) {
  const rounded = roundCurrency(value)
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2).replace(/0+$/, '').replace(/\.$/, '')
}

export default function SplitEditor({ members, value, onChange, totalAmount, showAmountInputs = false }: SplitEditorProps) {
  const total = value.reduce((sum, s) => sum + (Number(s.percentage) || 0), 0)
  const isValid = splitsSumTo100(value)
  const amountInputTotal = totalAmount ?? 0
  const canEditAmounts = showAmountInputs && amountInputTotal > 0

  // Only show members who are currently participating in the split.
  // Fall back to all members when value is unpopulated (e.g. new splits).
  const activeMemberIds = new Set(value.map((s) => s.household_member_id))
  const displayMembers = value.length > 0
    ? members.filter((m) => activeMemberIds.has(m.id))
    : members

  const getSplitForMember = (memberId: string) =>
    value.find((s) => s.household_member_id === memberId)?.percentage ?? 0

  const getAmountForMember = (memberId: string): number => {
    if (!canEditAmounts) return 0
    const split = value.find((s) => s.household_member_id === memberId)
    if (!split) return 0
    return split.amount !== undefined ? split.amount : roundCurrency((split.percentage / 100) * amountInputTotal)
  }

  const amountTotal = canEditAmounts
    ? value.reduce((sum, s) => sum + getAmountForMember(s.household_member_id), 0)
    : 0

  function balanceSplits(memberId: string, percentage: number): SplitValue[] {
    const changedPercentage = clampPercentage(roundPercentage(percentage))
    const otherSplits = value.filter((s) => s.household_member_id !== memberId)
    if (otherSplits.length === 0) {
      return value.map((s) => ({ ...s, percentage: SPLIT_TOTAL }))
    }

    const remaining = roundPercentage(SPLIT_TOTAL - changedPercentage)
    const otherTotal = otherSplits.reduce((sum, s) => sum + (Number(s.percentage) || 0), 0)
    let assigned = 0

    const rebalancedOthers = otherSplits.map((split, index) => {
      const percentageForMember = index === otherSplits.length - 1
        ? roundPercentage(remaining - assigned)
        : roundPercentage(remaining * (otherTotal > 0 ? Number(split.percentage) / otherTotal : 1 / otherSplits.length))
      assigned += percentageForMember
      return { ...split, percentage: percentageForMember }
    })

    return value.map((split) =>
      split.household_member_id === memberId
        ? { ...split, percentage: changedPercentage }
        : rebalancedOthers.find((other) => other.household_member_id === split.household_member_id) ?? split,
    )
  }

  function handlePercentageChange(memberId: string, raw: string) {
    const num = parseFloat(raw)
    const newSplits = balanceSplits(memberId, isNaN(num) ? 0 : num)
    onChange(
      canEditAmounts
        ? newSplits.map((s) => ({ ...s, amount: roundCurrency((s.percentage / 100) * amountInputTotal) }))
        : newSplits,
    )
  }

  function handleAmountChange(memberId: string, raw: string) {
    if (!canEditAmounts) return
    const num = parseFloat(raw)
    const newAmount = isNaN(num) ? 0 : num
    const newPct = amountInputTotal > 0 ? roundPercentage((newAmount / amountInputTotal) * 100) : 0
    const rebalanced = balanceSplits(memberId, newPct)
    onChange(
      rebalanced.map((s) =>
        s.household_member_id === memberId
          ? { ...s, amount: newAmount }
          : { ...s, amount: roundCurrency((s.percentage / 100) * amountInputTotal) },
      ),
    )
  }

  function handleEqualSplit() {
    const count = value.length > 0 ? value.length : members.length
    if (count === 0) return
    const percentages = buildEqualPercentages(count)
    const amounts = canEditAmounts && amountInputTotal > 0
      ? buildEqualAmounts(amountInputTotal, count)
      : undefined
    if (value.length > 0) {
      onChange(
        value.map((s, i) => ({
          ...s,
          percentage: percentages[i],
          ...(amounts !== undefined ? { amount: amounts[i] } : {}),
        })),
      )
    } else {
      onChange(
        members.map((m, i) => ({
          household_member_id: m.id,
          percentage: percentages[i],
          ...(amounts !== undefined ? { amount: amounts[i] } : {}),
        })),
      )
    }
  }

  function handleRemoveMember(memberId: string) {
    const remaining = value.filter((s) => s.household_member_id !== memberId)
    if (remaining.length === 0) return
    const percentages = buildEqualPercentages(remaining.length)
    const amounts = canEditAmounts && amountInputTotal > 0
      ? buildEqualAmounts(amountInputTotal, remaining.length)
      : undefined
    onChange(
      remaining.map((s, i) => ({
        ...s,
        percentage: percentages[i],
        ...(amounts !== undefined ? { amount: amounts[i] } : {}),
      })),
    )
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-white/50">Split</span>
        <button
          type="button"
          onClick={handleEqualSplit}
          className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
        >
          {FINANCES.SPLIT_EDITOR.EQUAL_SPLIT}
        </button>
      </div>

      <div className="flex flex-col gap-1.5">
        {displayMembers.map((member) => (
          <div key={member.id} className="flex items-center gap-3">
            <span className="flex-1 text-sm text-white/70 truncate">{member.nickname}</span>
            <div className="flex items-center gap-1">
              {canEditAmounts && (
                <>
                  <span className="text-xs text-white/40">{FINANCES.SPLIT_EDITOR.AMOUNT_SUFFIX}</span>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={formatEditableNumber(getAmountForMember(member.id))}
                    onChange={(e) => handleAmountChange(member.id, e.target.value)}
                    onFocus={(e) => e.currentTarget.select()}
                    placeholder={FINANCES.SPLIT_EDITOR.AMOUNT_PLACEHOLDER}
                    className="w-24 rounded-lg bg-white/5 border border-white/10 px-2 py-1.5 text-sm text-white text-right outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
                  />
                </>
              )}
              <input
                type="text"
                inputMode="decimal"
                value={formatEditableNumber(getSplitForMember(member.id))}
                onChange={(e) => handlePercentageChange(member.id, e.target.value)}
                onFocus={(e) => e.currentTarget.select()}
                placeholder={FINANCES.SPLIT_EDITOR.PERCENTAGE_PLACEHOLDER}
                className="w-16 rounded-lg bg-white/5 border border-white/10 px-2 py-1.5 text-sm text-white text-right outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
              />
              <span className="text-xs text-white/40">%</span>
              {displayMembers.length > 1 && (
                <button
                  type="button"
                  onClick={() => handleRemoveMember(member.id)}
                  aria-label={FINANCES.SPLIT_EDITOR.REMOVE_MEMBER}
                  className="ml-0.5 rounded p-0.5 text-white/20 transition-colors hover:text-red-400 focus:outline-none focus-visible:ring-1 focus-visible:ring-red-400"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5" aria-hidden="true">
                    <path d="M5.28 4.22a.75.75 0 0 0-1.06 1.06L6.94 8l-2.72 2.72a.75.75 0 1 0 1.06 1.06L8 9.06l2.72 2.72a.75.75 0 1 0 1.06-1.06L9.06 8l2.72-2.72a.75.75 0 0 0-1.06-1.06L8 6.94 5.28 4.22Z" />
                  </svg>
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className={`flex items-center justify-between pt-1 border-t border-white/5 ${!isValid ? 'border-red-500/30' : ''}`}>
        <span className="text-xs text-white/40">{FINANCES.SPLIT_EDITOR.TOTAL_LABEL}</span>
        <div className="flex items-center gap-2">
          {canEditAmounts && (
            <span className="text-xs font-medium text-white/50">
              {FINANCES.SPLIT_EDITOR.AMOUNT_SUFFIX}{amountTotal.toFixed(2)}
            </span>
          )}
          <span className={`text-xs font-medium ${isValid ? 'text-green-400' : 'text-red-400'}`}>
            {total.toFixed(2)}%
          </span>
        </div>
      </div>

      {!isValid && (
        <p className="text-xs text-red-400">{FINANCES.SPLIT_EDITOR.MUST_SUM}</p>
      )}
    </div>
  )
}

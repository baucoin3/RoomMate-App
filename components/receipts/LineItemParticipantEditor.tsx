'use client'

import { FINANCES } from '@/locales/en'
import { GUESTS } from '@/locales/en'
import { buildEqualPercentages, roundPercentage, splitsSumTo100 } from '@/lib/utils/splits'
import type { DisplaySplitRow } from '@/lib/utils/receiptLineItems'
import { balanceParticipantSplits } from '@/lib/utils/receiptLineItems'

interface Props {
  rows: DisplaySplitRow[]
  onChange: (rows: DisplaySplitRow[]) => void
  totalAmount?: number
}

function formatEditableNumber(value: number) {
  const rounded = Math.round(value * 100) / 100
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2).replace(/0+$/, '').replace(/\.$/, '')
}

export default function LineItemParticipantEditor({ rows, onChange, totalAmount }: Props) {
  const total = rows.reduce((sum, r) => sum + r.percentage, 0)
  const isValid = splitsSumTo100(rows)
  const canShowAmounts = (totalAmount ?? 0) > 0

  function handlePercentageChange(id: string, raw: string) {
    const num = parseFloat(raw)
    const rebalanced = balanceParticipantSplits(rows, id, isNaN(num) ? 0 : num)
    onChange(rebalanced)
  }

  function handleEqualSplit() {
    if (rows.length === 0) return
    const percentages = buildEqualPercentages(rows.length)
    onChange(
      rows.map((row, i) => ({
        ...row,
        percentage: percentages[i],
      })),
    )
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-white/50">{FINANCES.SPLIT_EDITOR.TOTAL_LABEL}</span>
        <button
          type="button"
          onClick={handleEqualSplit}
          className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
        >
          {FINANCES.SPLIT_EDITOR.EQUAL_SPLIT}
        </button>
      </div>

      <div className="flex flex-col gap-1.5">
        {rows.map((row) => {
          const dollar = canShowAmounts
            ? ((row.percentage / 100) * (totalAmount ?? 0)).toFixed(2)
            : null
          return (
            <div key={`${row.type}-${row.id}`} className="flex items-center gap-3">
              <span className="flex-1 text-sm text-white/70 truncate flex items-center gap-1.5">
                {row.displayName}
                {row.type === 'guest' && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-violet-500/20 text-violet-300 border border-violet-500/30 shrink-0">
                    {GUESTS.SPLIT_LABEL.GUEST_BADGE}
                  </span>
                )}
              </span>
              <div className="flex items-center gap-1">
                {dollar !== null && (
                  <span className="text-sm font-mono text-emerald-400/80 w-14 text-right">${dollar}</span>
                )}
                <input
                  type="text"
                  inputMode="decimal"
                  value={formatEditableNumber(row.percentage)}
                  onChange={(e) => handlePercentageChange(row.id, e.target.value)}
                  onFocus={(e) => e.currentTarget.select()}
                  placeholder={FINANCES.SPLIT_EDITOR.PERCENTAGE_PLACEHOLDER}
                  className="w-16 rounded-lg bg-white/5 border border-white/10 px-2 py-1.5 text-sm text-white text-right outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
                />
                <span className="text-xs text-white/40">%</span>
              </div>
            </div>
          )
        })}
      </div>

      <div className={`flex items-center justify-between pt-1 border-t border-white/5 ${!isValid ? 'border-red-500/30' : ''}`}>
        <span className="text-xs text-white/40">{FINANCES.SPLIT_EDITOR.TOTAL_LABEL}</span>
        <span className={`text-xs font-medium ${isValid ? 'text-green-400' : 'text-red-400'}`}>
          {roundPercentage(total).toFixed(2)}%
        </span>
      </div>

      {!isValid && (
        <p className="text-xs text-red-400">{FINANCES.SPLIT_EDITOR.MUST_SUM}</p>
      )}
    </div>
  )
}

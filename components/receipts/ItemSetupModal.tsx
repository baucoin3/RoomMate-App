'use client'

import { useState } from 'react'
import { RECEIPTS } from '@/locales/en'
import type { LineItemConfig, LineItemSplitRow } from '@/lib/types/receipts'

interface Category {
  id: string
  name: string
  splits: Array<{
    household_member_id: string
    percentage: number
    nickname: string | null
  }>
}

interface Props {
  configs: LineItemConfig[]
  categories: Category[]
  allMembers: Array<{ id: string; name: string }>
  onDone: (configs: LineItemConfig[]) => void
  onClose: () => void
}

export default function ItemSetupModal({ configs, categories, allMembers, onDone, onClose }: Props) {
  const [localConfigs, setLocalConfigs] = useState<LineItemConfig[]>(configs.map((c) => ({ ...c })))
  const [idx, setIdx] = useState(0)

  const current = localConfigs[idx]
  const total = localConfigs.length

  function updateCurrent(patch: Partial<LineItemConfig>) {
    setLocalConfigs((prev) =>
      prev.map((c, i) => (i === idx ? { ...c, ...patch } : c)),
    )
  }

  function handleCategoryChange(catId: string) {
    const cat = categories.find((c) => c.id === catId) ?? null
    const defaultSplits: LineItemSplitRow[] = cat
      ? cat.splits.map((s) => ({
          household_member_id: s.household_member_id,
          nickname: s.nickname ?? s.household_member_id.slice(0, 8),
          percentage: s.percentage,
        }))
      : allMembers.map((m) => ({
          household_member_id: m.id,
          nickname: m.name,
          percentage: 0,
        }))

    updateCurrent({
      categoryId: catId || null,
      customSplits: defaultSplits,
      useCustomSplit: false,
    })
  }

  function handleSplitChange(memberId: string, value: string) {
    setLocalConfigs((prev) =>
      prev.map((c, i) => {
        if (i !== idx) return c
        return {
          ...c,
          customSplits: c.customSplits.map((s) =>
            s.household_member_id === memberId
              ? { ...s, percentage: Number(value) }
              : s,
          ),
        }
      }),
    )
  }

  const selectedCat = categories.find((c) => c.id === current.categoryId) ?? null
  const displaySplits: LineItemSplitRow[] =
    current.useCustomSplit
      ? current.customSplits
      : selectedCat
        ? selectedCat.splits.map((s) => ({
            household_member_id: s.household_member_id,
            nickname: s.nickname ?? s.household_member_id.slice(0, 8),
            percentage: s.percentage,
          }))
        : []

  const splitTotal = current.useCustomSplit
    ? current.customSplits.reduce((sum, s) => sum + s.percentage, 0)
    : 100

  const progressPct = Math.round(((idx + 1) / total) * 100)

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md bg-[#1a1a2e] border border-white/10 rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-white/10 shrink-0">
          <h2 className="text-white font-semibold text-base">{RECEIPTS.ITEM_SETUP.TITLE}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="w-7 h-7 flex items-center justify-center rounded-full text-white/40 hover:text-white hover:bg-white/10 transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Item navigation */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-white/10 shrink-0">
          <button
            type="button"
            onClick={() => setIdx((i) => Math.max(0, i - 1))}
            disabled={idx === 0}
            className="w-8 h-8 flex items-center justify-center rounded-full border border-white/10 text-white/60 hover:text-white hover:border-white/30 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
            aria-label="Previous item"
          >
            ←
          </button>

          <div className="flex-1 text-center">
            <p className="text-xs text-white/40 mb-0.5">
              {RECEIPTS.ITEM_SETUP.PROGRESS(idx + 1, total)}
            </p>
            <p className="text-white font-semibold truncate">{current.description}</p>
            <p className="text-indigo-300 text-sm font-mono">
              {RECEIPTS.ITEM_SETUP.ITEM_AMOUNT(current.amount.toFixed(2))}
            </p>
          </div>

          <button
            type="button"
            onClick={() => setIdx((i) => Math.min(total - 1, i + 1))}
            disabled={idx === total - 1}
            className="w-8 h-8 flex items-center justify-center rounded-full border border-white/10 text-white/60 hover:text-white hover:border-white/30 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
            aria-label="Next item"
          >
            →
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-5">

          {/* Category */}
          <div>
            <label className="block text-xs text-white/50 mb-1.5">
              {RECEIPTS.ITEM_SETUP.CATEGORY_LABEL}
            </label>
            <select
              value={current.categoryId ?? ''}
              onChange={(e) => handleCategoryChange(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-white focus:outline-none focus:border-indigo-500 transition-colors"
            >
              <option value="">{RECEIPTS.ITEM_SETUP.CATEGORY_PLACEHOLDER}</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* Split preview / custom split */}
          {(selectedCat || current.useCustomSplit) && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-white/50">{RECEIPTS.ITEM_SETUP.SPLIT_PREVIEW}</span>
                <button
                  type="button"
                  onClick={() =>
                    updateCurrent({
                      useCustomSplit: !current.useCustomSplit,
                      customSplits: current.customSplits.length > 0
                        ? current.customSplits
                        : displaySplits,
                    })
                  }
                  className={`text-xs px-2.5 py-1 rounded-full border transition-all ${
                    current.useCustomSplit
                      ? 'border-violet-500 text-violet-300 bg-violet-500/10'
                      : 'border-white/10 text-white/40 hover:text-white/70 hover:border-white/20'
                  }`}
                >
                  {RECEIPTS.ITEM_SETUP.CUSTOM_SPLIT_LABEL}
                </button>
              </div>

              {displaySplits.length === 0 ? (
                <p className="text-white/30 text-xs">{RECEIPTS.ITEM_SETUP.NO_SPLITS}</p>
              ) : (
                <div className="flex flex-col gap-2 bg-white/3 rounded-xl p-3 border border-white/8">
                  {displaySplits.map((s) => {
                    const dollar = ((s.percentage / 100) * current.amount).toFixed(2)
                    return (
                      <div key={s.household_member_id} className="flex items-center gap-3">
                        <span className="flex-1 text-sm text-white/80">{s.nickname}</span>
                        {current.useCustomSplit ? (
                          <div className="flex items-center gap-1">
                            <input
                              type="number"
                              min="0"
                              max="100"
                              value={s.percentage}
                              onChange={(e) =>
                                handleSplitChange(s.household_member_id, e.target.value)
                              }
                              className="w-16 bg-white/5 border border-white/10 rounded px-2 py-1 text-white text-right text-sm focus:outline-none focus:border-indigo-500"
                            />
                            <span className="text-white/40 text-sm">%</span>
                          </div>
                        ) : (
                          <span className="text-sm text-white/50 font-mono">{s.percentage}%</span>
                        )}
                        <span className="text-sm font-mono text-white/40 w-14 text-right">
                          ${dollar}
                        </span>
                      </div>
                    )
                  })}
                  {current.useCustomSplit && (
                    <div className="flex items-center justify-end gap-2 pt-1 border-t border-white/10 mt-1">
                      <span className="text-xs text-white/40">Total:</span>
                      <span
                        className={`text-xs font-mono font-semibold ${
                          Math.abs(splitTotal - 100) > 0.01 ? 'text-red-400' : 'text-green-400'
                        }`}
                      >
                        {splitTotal.toFixed(0)}%
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Save as household item toggle */}
          <button
            type="button"
            onClick={() => updateCurrent({ saveAsHouseholdItem: !current.saveAsHouseholdItem })}
            className={`flex items-start gap-3 w-full p-3.5 rounded-xl border transition-all text-left ${
              current.saveAsHouseholdItem
                ? 'border-indigo-500/50 bg-indigo-500/10'
                : 'border-white/10 bg-white/3 hover:border-white/20'
            }`}
          >
            <div
              className={`mt-0.5 w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-all ${
                current.saveAsHouseholdItem
                  ? 'border-indigo-400 bg-indigo-500'
                  : 'border-white/30'
              }`}
            >
              {current.saveAsHouseholdItem && (
                <svg viewBox="0 0 10 8" className="w-2.5 h-2.5 text-white" fill="currentColor">
                  <path d="M1 4l2.5 2.5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                </svg>
              )}
            </div>
            <div>
              <p className="text-sm font-medium text-white/90">
                {RECEIPTS.ITEM_SETUP.SAVE_AS_ITEM_LABEL}
              </p>
              <p className="text-xs text-white/40 mt-0.5">
                {RECEIPTS.ITEM_SETUP.SAVE_AS_ITEM_HINT}
              </p>
            </div>
          </button>

          {/* Dot progress */}
          <div className="flex items-center justify-center gap-1.5 py-1">
            {localConfigs.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setIdx(i)}
                className={`rounded-full transition-all ${
                  i === idx
                    ? 'w-5 h-2 bg-indigo-500'
                    : localConfigs[i].categoryId || localConfigs[i].useCustomSplit
                      ? 'w-2 h-2 bg-indigo-500/40'
                      : 'w-2 h-2 bg-white/15'
                }`}
                aria-label={`Go to item ${i + 1}`}
              />
            ))}
          </div>
        </div>

        {/* Progress bar + footer */}
        <div className="px-5 pb-5 pt-3 border-t border-white/10 shrink-0">
          <div className="h-1 rounded-full bg-white/8 mb-4 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-indigo-500 to-violet-500 rounded-full transition-all duration-300"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <button
            type="button"
            onClick={() => onDone(localConfigs)}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-600 text-white font-semibold hover:from-indigo-400 hover:to-violet-500 transition-all shadow-lg shadow-indigo-500/20"
          >
            {RECEIPTS.ITEM_SETUP.DONE}
          </button>
        </div>
      </div>
    </div>
  )
}

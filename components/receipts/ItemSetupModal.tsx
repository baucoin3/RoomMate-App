'use client'

import { useEffect, useRef, useState } from 'react'
import { RECEIPTS } from '@/locales/en'
import { apiClient, getErrorMessage } from '@/lib/api/client'
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
  householdId: string
  onDone: (configs: LineItemConfig[]) => void
  onClose: () => void
  onCategoryCreated: (cat: Category) => void
}

// ─── Web Audio whoosh ──────────────────────────────────────────────────────

function playWhoosh() {
  try {
    const ctx = new AudioContext()
    const dur = 0.14
    const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * dur), ctx.sampleRate)
    const data = buf.getChannelData(0)
    for (let i = 0; i < data.length; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / data.length) * 0.11
    }
    const src = ctx.createBufferSource()
    src.buffer = buf
    const filter = ctx.createBiquadFilter()
    filter.type = 'bandpass'
    filter.frequency.setValueAtTime(900, ctx.currentTime)
    filter.frequency.linearRampToValueAtTime(180, ctx.currentTime + dur)
    filter.Q.value = 0.7
    src.connect(filter)
    filter.connect(ctx.destination)
    src.start()
    src.stop(ctx.currentTime + dur + 0.05)
  } catch {
    // AudioContext not available in some environments — silent fallback
  }
}

// ─── Component ─────────────────────────────────────────────────────────────

export default function ItemSetupModal({
  configs,
  categories,
  allMembers,
  householdId,
  onDone,
  onClose,
  onCategoryCreated,
}: Props) {
  const [localConfigs, setLocalConfigs] = useState<LineItemConfig[]>(configs.map((c) => ({ ...c })))
  const [localCategories, setLocalCategories] = useState<Category[]>(categories)
  const [idx, setIdx] = useState(0)

  // Transition state
  const [slideClass, setSlideClass] = useState('')
  const [transitioning, setTransitioning] = useState(false)
  const pendingIdx = useRef<number | null>(null)

  // Inline category creation
  const [showAddCat, setShowAddCat] = useState(false)
  const [newCatName, setNewCatName] = useState('')
  const [addingCat, setAddingCat] = useState(false)
  const [addCatError, setAddCatError] = useState('')

  const current = localConfigs[idx]
  const total = localConfigs.length

  // ─── Item navigation with transition ────────────────────────────────────

  function navigateItem(newIdx: number, direction: 'forward' | 'back') {
    if (transitioning || newIdx === idx) return
    pendingIdx.current = newIdx

    // Mark current item as configured
    setLocalConfigs((prev) =>
      prev.map((c, i) => (i === idx ? { ...c, configured: true } : c)),
    )

    playWhoosh()
    setTransitioning(true)
    const exitClass = direction === 'forward' ? '-translate-x-8 opacity-0' : 'translate-x-8 opacity-0'
    setSlideClass(exitClass)

    setTimeout(() => {
      setIdx(pendingIdx.current!)
      const enterClass = direction === 'forward' ? 'translate-x-8 opacity-0' : '-translate-x-8 opacity-0'
      setSlideClass(enterClass)

      // Tiny frame to let React paint the enter-from position
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setSlideClass('translate-x-0 opacity-100')
          setTimeout(() => {
            setTransitioning(false)
          }, 200)
        })
      })
    }, 180)
  }

  // Initialise slide class on mount
  useEffect(() => {
    setSlideClass('translate-x-0 opacity-100')
  }, [])

  // ─── Config mutations ────────────────────────────────────────────────────

  function updateCurrent(patch: Partial<LineItemConfig>) {
    setLocalConfigs((prev) =>
      prev.map((c, i) => (i === idx ? { ...c, ...patch } : c)),
    )
  }

  function handleCategoryChange(catId: string) {
    const cat = localCategories.find((c) => c.id === catId) ?? null
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

  // ─── Inline category creation ────────────────────────────────────────────

  async function handleAddCategory() {
    const name = newCatName.trim()
    if (!name) return
    setAddingCat(true)
    setAddCatError('')
    try {
      const res = await apiClient.post<{ data: { id: string; name: string; household_id: string } }>(
        '/api/finances/categories',
        { name, household_id: householdId },
      )
      const created: Category = { ...res.data.data, splits: [] }
      setLocalCategories((prev) => [...prev, created])
      onCategoryCreated(created)
      handleCategoryChange(created.id)
      setNewCatName('')
      setShowAddCat(false)
    } catch (err) {
      setAddCatError(getErrorMessage(err))
    } finally {
      setAddingCat(false)
    }
  }

  // ─── Split display logic ─────────────────────────────────────────────────

  const selectedCat = localCategories.find((c) => c.id === current.categoryId) ?? null

  const equalSplits: LineItemSplitRow[] = allMembers.map((m) => ({
    household_member_id: m.id,
    nickname: m.name,
    percentage: allMembers.length > 0 ? Math.round(10000 / allMembers.length) / 100 : 0,
  }))

  const displaySplits: LineItemSplitRow[] = current.useCustomSplit
    ? current.customSplits
    : selectedCat
      ? selectedCat.splits.map((s) => ({
          household_member_id: s.household_member_id,
          nickname: s.nickname ?? s.household_member_id.slice(0, 8),
          percentage: s.percentage,
        }))
      : equalSplits

  const splitTotal = current.useCustomSplit
    ? current.customSplits.reduce((sum, s) => sum + s.percentage, 0)
    : 100

  const progressPct = Math.round(((idx + 1) / total) * 100)

  const isKnownItem = current.matchedHouseholdItemId !== null

  // ─── Footer button action ────────────────────────────────────────────────

  function handleFooterButton() {
    const isLast = idx === total - 1
    // Mark current item configured
    const updated = localConfigs.map((c, i) => (i === idx ? { ...c, configured: true } : c))
    if (isLast) {
      onDone(updated)
    } else {
      navigateItem(idx + 1, 'forward')
    }
  }

  // ─── Render ──────────────────────────────────────────────────────────────

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
            onClick={() => navigateItem(idx - 1, 'back')}
            disabled={idx === 0 || transitioning}
            className="w-8 h-8 flex items-center justify-center rounded-full border border-white/10 text-white/60 hover:text-white hover:border-white/30 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
            aria-label="Previous item"
          >
            ←
          </button>

          <div className="flex-1 text-center">
            <p className="text-xs text-white/40 mb-0.5">
              {RECEIPTS.ITEM_SETUP.PROGRESS(idx + 1, total)}
            </p>
            <div className="flex items-center justify-center gap-1.5">
              <p className="text-white font-semibold truncate">{current.description}</p>
              {isKnownItem && (
                <span
                  title={RECEIPTS.ITEM_SETUP.KNOWN_ITEM_LABEL}
                  className="shrink-0"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    className="w-4 h-4 text-indigo-400"
                    aria-label={RECEIPTS.ITEM_SETUP.KNOWN_ITEM_LABEL}
                  >
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                </span>
              )}
            </div>
            <p className="text-indigo-300 text-sm font-mono">
              {RECEIPTS.ITEM_SETUP.ITEM_AMOUNT(current.amount.toFixed(2))}
            </p>
          </div>

          <button
            type="button"
            onClick={() => navigateItem(idx + 1, 'forward')}
            disabled={idx === total - 1 || transitioning}
            className="w-8 h-8 flex items-center justify-center rounded-full border border-white/10 text-white/60 hover:text-white hover:border-white/30 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
            aria-label="Next item"
          >
            →
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-5 overflow-x-hidden">

          {/* Animated item content wrapper */}
          <div
            className={`flex flex-col gap-5 transition-all duration-[200ms] ease-out ${slideClass}`}
          >

            {/* Known item badge */}
            {isKnownItem && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-indigo-500/10 border border-indigo-500/20">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5 text-indigo-400 shrink-0">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
                <span className="text-xs text-indigo-300">
                  {RECEIPTS.ITEM_SETUP.KNOWN_ITEM_LABEL} — defaults loaded from your household catalog
                </span>
              </div>
            )}

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
                {localCategories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>

              {/* Inline add category */}
              {!showAddCat ? (
                <button
                  type="button"
                  onClick={() => { setShowAddCat(true); setAddCatError('') }}
                  className="mt-1.5 text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
                >
                  {RECEIPTS.ITEM_SETUP.ADD_CATEGORY_LABEL}
                </button>
              ) : (
                <div className="mt-2 flex flex-col gap-1.5">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newCatName}
                      onChange={(e) => setNewCatName(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') handleAddCategory() }}
                      placeholder={RECEIPTS.ITEM_SETUP.ADD_CATEGORY_PLACEHOLDER}
                      autoFocus
                      className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:border-indigo-500 transition-colors"
                    />
                    <button
                      type="button"
                      onClick={handleAddCategory}
                      disabled={addingCat || !newCatName.trim()}
                      className="px-3 py-2 rounded-lg bg-indigo-500/20 border border-indigo-500/40 text-indigo-300 hover:bg-indigo-500/30 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed transition-all text-sm font-medium shrink-0"
                    >
                      {addingCat ? RECEIPTS.ITEM_SETUP.ADDING_CATEGORY : RECEIPTS.ITEM_SETUP.ADD_CATEGORY_SUBMIT}
                    </button>
                    <button
                      type="button"
                      onClick={() => { setShowAddCat(false); setNewCatName(''); setAddCatError('') }}
                      className="px-2 py-2 rounded-lg border border-white/10 text-white/40 hover:text-white/70 transition-colors text-sm"
                    >
                      ✕
                    </button>
                  </div>
                  {addCatError && (
                    <p className="text-red-400 text-xs" role="alert">{addCatError}</p>
                  )}
                </div>
              )}
            </div>

            {/* Split preview — always visible */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-white/50">
                  {RECEIPTS.ITEM_SETUP.SPLIT_PREVIEW}
                  {!current.categoryId && !current.useCustomSplit && (
                    <span className="ml-1.5 text-white/30">({RECEIPTS.ITEM_SETUP.EQUAL_SPLIT_DEFAULT})</span>
                  )}
                </span>
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
            </div>

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

          </div>{/* end animated wrapper */}

          {/* Dot progress */}
          <div className="flex items-center justify-center gap-1.5 py-1">
            {localConfigs.map((c, i) => (
              <button
                key={i}
                type="button"
                onClick={() => navigateItem(i, i > idx ? 'forward' : 'back')}
                disabled={transitioning}
                className={`rounded-full transition-all ${
                  i === idx
                    ? 'w-5 h-2 bg-indigo-500'
                    : c.configured
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
            onClick={handleFooterButton}
            disabled={transitioning}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-600 text-white font-semibold hover:from-indigo-400 hover:to-violet-500 disabled:opacity-50 transition-all shadow-lg shadow-indigo-500/20"
          >
            {idx === total - 1 ? RECEIPTS.ITEM_SETUP.DONE : RECEIPTS.ITEM_SETUP.NEXT}
          </button>
        </div>
      </div>
    </div>
  )
}

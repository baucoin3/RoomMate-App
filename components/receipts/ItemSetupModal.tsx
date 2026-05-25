'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { RECEIPTS } from '@/locales/en'
import { apiClient, getErrorMessage } from '@/lib/api/client'
import SplitEditor from '@/components/SplitEditor'
import { buildDefaultSplits } from '@/lib/utils/splits'
import {
  categoryHasValidSplits,
  getLineItemStatus,
  getSplitsForLineItem,
  hasValidSplitAssignment,
  isLineItemConfirmed,
  lineItemStatusLabel,
  lineItemStatusPillClass,
  type SplitResolverContext,
} from '@/lib/utils/receiptLineItems'
import type { LineItemConfig, LineItemSplitRow, MatchSource } from '@/lib/types/receipts'
import type { HouseholdItem } from '@/lib/types/householdItems'

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
  householdItems: HouseholdItem[]
  splitResolverCtx: SplitResolverContext
  householdId: string
  initialIndex?: number
  onSave: (configs: LineItemConfig[], lastIndex: number) => void
  onCategoryCreated: (cat: Category) => void
}

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
    // AudioContext not available in some environments
  }
}

function matchBadgeLabel(source: MatchSource): string | null {
  switch (source) {
    case 'catalog':
      return RECEIPTS.ITEM_SETUP.MATCH_BADGE_CATALOG
    case 'alias':
      return RECEIPTS.ITEM_SETUP.MATCH_BADGE_ALIAS
    case 'fuzzy':
      return RECEIPTS.ITEM_SETUP.MATCH_BADGE_SUGGESTED
    default:
      return null
  }
}

function applyHouseholdItemToConfig(
  config: LineItemConfig,
  item: HouseholdItem,
  categories: Category[],
  allMembers: Array<{ id: string; name: string }>,
  matchSource: MatchSource,
  rememberAlias: boolean,
): LineItemConfig {
  const hasOverrides = (item.split_overrides?.length ?? 0) > 0
  const cat = item.default_category_id
    ? categories.find((c) => c.id === item.default_category_id) ?? null
    : null

  const customSplits: LineItemSplitRow[] = hasOverrides
    ? (item.split_overrides ?? []).map((o) => ({
        household_member_id: o.member_id,
        nickname: allMembers.find((m) => m.id === o.member_id)?.name ?? o.member_id.slice(0, 8),
        percentage: o.percentage,
      }))
    : cat
      ? cat.splits.map((s) => ({
          household_member_id: s.household_member_id,
          nickname: s.nickname ?? s.household_member_id.slice(0, 8),
          percentage: s.percentage,
        }))
      : []

  return {
    ...config,
    setupMode: 'item',
    householdItemId: item.id,
    resolvedItemName: item.name,
    matchSource,
    rememberAlias,
    saveAsHouseholdItem: false,
    categoryId: item.default_category_id ?? null,
    useCustomSplit: hasOverrides,
    customSplits,
    configured: true,
  }
}

function persistCurrentItemAtIndex(
  configs: LineItemConfig[],
  index: number,
  memberCount: number,
  ctx: SplitResolverContext,
): LineItemConfig[] {
  return configs.map((c, i) =>
    i === index
      ? {
          ...c,
          configured: c.setupMode === 'item'
            ? (c.householdItemId !== null || (c.saveAsHouseholdItem && (c.resolvedItemName ?? '').length > 0)) &&
              hasValidSplitAssignment(c, memberCount, ctx)
            : hasValidSplitAssignment(c, memberCount, ctx),
        }
      : c,
  )
}

export default function ItemSetupModal({
  configs,
  categories,
  allMembers,
  householdItems,
  splitResolverCtx,
  householdId,
  initialIndex = 0,
  onSave,
  onCategoryCreated,
}: Props) {
  const [localConfigs, setLocalConfigs] = useState<LineItemConfig[]>(configs.map((c) => ({ ...c })))
  const [localCategories, setLocalCategories] = useState<Category[]>(categories)
  const [idx, setIdx] = useState(() =>
    Math.min(Math.max(0, initialIndex), Math.max(0, configs.length - 1)),
  )

  const [slideClass, setSlideClass] = useState('')
  const [transitioning, setTransitioning] = useState(false)
  const pendingIdx = useRef<number | null>(null)

  const [showAddCat, setShowAddCat] = useState(false)
  const [newCatName, setNewCatName] = useState('')
  const [addingCat, setAddingCat] = useState(false)
  const [addCatError, setAddCatError] = useState('')

  const [itemSearch, setItemSearch] = useState('')
  const [showItemDropdown, setShowItemDropdown] = useState(false)
  const searchContainerRef = useRef<HTMLDivElement>(null)

  const memberCount = allMembers.length
  const current = localConfigs[idx]
  const total = localConfigs.length
  const modalSplitCtx: SplitResolverContext = {
    ...splitResolverCtx,
    categories: localCategories,
  }
  const itemStatus = getLineItemStatus(current, memberCount, modalSplitCtx)
  const currentValid = current.setupMode === 'item'
    ? (current.householdItemId !== null || (current.saveAsHouseholdItem && (current.resolvedItemName ?? '').length > 0)) &&
      hasValidSplitAssignment(current, memberCount, modalSplitCtx)
    : hasValidSplitAssignment(current, memberCount, modalSplitCtx)

  const displaySplits: LineItemSplitRow[] = getSplitsForLineItem(current, modalSplitCtx)
  const showNoSplitsWarning =
    current.categoryId !== null &&
    !current.useCustomSplit &&
    !categoryHasValidSplits(current.categoryId, modalSplitCtx)

  const badgeLabel = matchBadgeLabel(current.matchSource)
  const showAiRow =
    (current.aiCandidates?.length ?? 0) > 0 &&
    current.matchSource !== 'catalog' &&
    current.matchSource !== 'alias'

  const filteredItems = useMemo(() => {
    const q = itemSearch.trim().toLowerCase()

    if (q) {
      return householdItems.filter((item) => {
        if (item.name.toLowerCase().includes(q)) return true
        return (item.aliases ?? []).some((a) => a.display_text.toLowerCase().includes(q))
      })
    }

    const aiWords = (current.aiCandidates ?? [])
      .flatMap((name) => name.toLowerCase().split(/\s+/))
      .filter(Boolean)

    if (aiWords.length > 0) {
      const wordMatches = householdItems.filter((item) =>
        aiWords.some((word) => item.name.toLowerCase().includes(word))
      )
      const rest = householdItems.filter((item) => !wordMatches.includes(item))
      return [...wordMatches, ...rest]
    }

    return householdItems
  }, [householdItems, itemSearch, current.aiCandidates])

  const exactDropdownMatch = itemSearch.trim()
    ? filteredItems.some((i) => i.name.toLowerCase() === itemSearch.trim().toLowerCase())
    : false
  const showAddNewOption = !!(itemSearch.trim() && !exactDropdownMatch)

  useEffect(() => {
    setSlideClass('translate-x-0 opacity-100')
  }, [])

  useEffect(() => {
    function handleOutside(e: MouseEvent) {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setShowItemDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleOutside)
    return () => document.removeEventListener('mousedown', handleOutside)
  }, [])

  useEffect(() => {
    setItemSearch(current.resolvedItemName ?? '')
  }, [idx, current.resolvedItemName])

  function commitCurrentAndAdvance(action: 'next' | 'done' | 'close') {
    const currentIdx = idx
    setLocalConfigs((prev) => {
      const updated = persistCurrentItemAtIndex(prev, currentIdx, memberCount, modalSplitCtx)
      if (action === 'done' || action === 'close') {
        onSave(updated, currentIdx)
      }
      return updated
    })
    if (action === 'next') navigateItem(currentIdx + 1, 'forward')
  }

  function handleClose() {
    commitCurrentAndAdvance('close')
  }

  function navigateItem(newIdx: number, direction: 'forward' | 'back') {
    if (transitioning || newIdx === idx) return
    pendingIdx.current = newIdx

    setLocalConfigs((prev) => persistCurrentItemAtIndex(prev, idx, memberCount, modalSplitCtx))

    playWhoosh()
    setTransitioning(true)
    const exitClass = direction === 'forward' ? '-translate-x-8 opacity-0' : 'translate-x-8 opacity-0'
    setSlideClass(exitClass)

    setTimeout(() => {
      setIdx(pendingIdx.current!)
      const enterClass = direction === 'forward' ? 'translate-x-8 opacity-0' : '-translate-x-8 opacity-0'
      setSlideClass(enterClass)

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

  function updateCurrent(patch: Partial<LineItemConfig>) {
    setLocalConfigs((prev) =>
      prev.map((c, i) => (i === idx ? { ...c, ...patch } : c)),
    )
  }

  function selectHouseholdItem(item: HouseholdItem, matchSource: MatchSource) {
    const rememberAlias =
      matchSource === 'manual' ||
      matchSource === 'ai' ||
      matchSource === 'fuzzy' ||
      current.matchSource === null

    setLocalConfigs((prev) =>
      prev.map((c, i) =>
        i === idx
          ? applyHouseholdItemToConfig(
              c,
              item,
              localCategories,
              allMembers,
              matchSource,
              rememberAlias,
            )
          : c,
      ),
    )
    setItemSearch(item.name)
    setShowItemDropdown(false)
  }

  function switchToItemTab() {
    updateCurrent({ setupMode: 'item' })
  }

  function switchToCategoryTab() {
    updateCurrent({ setupMode: 'category' })
  }

  function handleCategoryChange(catId: string) {
    updateCurrent({
      categoryId: catId || null,
      useCustomSplit: false,
    })
  }

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
      const defaultSplits = buildDefaultSplits(allMembers)
      await apiClient.put(`/api/finances/categories/${res.data.data.id}/splits`, {
        splits: defaultSplits,
      })

      const created: Category = {
        ...res.data.data,
        splits: defaultSplits.map((s) => ({
          household_member_id: s.household_member_id,
          percentage: s.percentage,
          nickname: allMembers.find((m) => m.id === s.household_member_id)?.name ?? null,
        })),
      }
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

  const progressPct = Math.round(((idx + 1) / total) * 100)

  function handleFooterButton() {
    const isLast = idx === total - 1
    commitCurrentAndAdvance(isLast ? 'done' : 'next')
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md bg-[#1a1a2e] border border-white/10 rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col max-h-[90vh]">

        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-white/10 shrink-0">
          <h2 className="text-white font-semibold text-base">{RECEIPTS.ITEM_SETUP.TITLE}</h2>
          <button
            type="button"
            onClick={handleClose}
            aria-label="Close"
            className="w-7 h-7 flex items-center justify-center rounded-full text-white/40 hover:text-white hover:bg-white/10 transition-colors"
          >
            ✕
          </button>
        </div>

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

          <div className={`flex-1 text-center min-w-0 ${!current.active ? 'opacity-50' : ''}`}>
            <p className="text-base font-semibold text-white/80 mb-1">
              {RECEIPTS.ITEM_SETUP.PROGRESS(idx + 1, total)}
            </p>
            <p className="text-white font-semibold truncate max-w-[240px] mx-auto">{current.description}</p>
            <p className="text-emerald-400 text-lg font-mono font-semibold mt-1">
              {RECEIPTS.ITEM_SETUP.ITEM_AMOUNT(current.amount.toFixed(2))}
            </p>
            <span
              className={`inline-block mt-2 text-xs font-medium px-2.5 py-0.5 rounded-full ${lineItemStatusPillClass(itemStatus)}`}
            >
              {lineItemStatusLabel(itemStatus, memberCount)}
            </span>
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

        <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-5 overflow-x-hidden">
          <div className={`flex flex-col gap-5 transition-all duration-[200ms] ease-out ${slideClass}`}>

            {!current.active ? (
              <button
                type="button"
                onClick={() => updateCurrent({ active: true })}
                className="w-full py-3 rounded-xl bg-indigo-500/10 border border-indigo-400/25 text-indigo-200 text-sm font-medium hover:bg-indigo-500/15 hover:border-indigo-400/35 hover:text-indigo-100 transition-all"
              >
                {RECEIPTS.ITEM_SETUP.ADD_TO_EXPENSE_LIST}
              </button>
            ) : (
              <>
                {/* Tab pills */}
                <div className="flex gap-1 p-1 bg-white/5 rounded-xl">
                  <button
                    type="button"
                    onClick={switchToItemTab}
                    className={`flex-1 py-1.5 rounded-lg text-sm font-medium transition-all ${
                      current.setupMode === 'item'
                        ? 'bg-indigo-500 text-white shadow-sm'
                        : 'text-white/50 hover:text-white/80'
                    }`}
                  >
                    {RECEIPTS.ITEM_SETUP.BY_ITEM_TAB}
                  </button>
                  <button
                    type="button"
                    onClick={switchToCategoryTab}
                    className={`flex-1 py-1.5 rounded-lg text-sm font-medium transition-all ${
                      current.setupMode === 'category'
                        ? 'bg-indigo-500 text-white shadow-sm'
                        : 'text-white/50 hover:text-white/80'
                    }`}
                  >
                    {RECEIPTS.ITEM_SETUP.BY_CATEGORY_TAB}
                  </button>
                </div>

                {/* By Household Item tab */}
                {current.setupMode === 'item' && (
                  <div className="flex flex-col gap-4">
                    {/* Match dropdown */}
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="block text-xs text-white/50">
                          {RECEIPTS.ITEM_SETUP.MATCH_ITEM_LABEL}
                        </label>
                        {badgeLabel && (
                          <span className="text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full bg-white/8 text-white/50 border border-white/10">
                            {badgeLabel}
                          </span>
                        )}
                      </div>
                      <div ref={searchContainerRef} className="relative">
                        <input
                          type="text"
                          value={itemSearch}
                          onChange={(e) => {
                            setItemSearch(e.target.value)
                            setShowItemDropdown(true)
                          }}
                          onFocus={() => setShowItemDropdown(true)}
                          placeholder={RECEIPTS.ITEM_SETUP.MATCH_ITEM_PLACEHOLDER}
                          className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-white placeholder-white/30 focus:outline-none focus:border-indigo-500 transition-colors"
                        />
                        {showItemDropdown && (filteredItems.length > 0 || showAddNewOption) && (
                          <ul className="absolute left-0 right-0 top-full mt-1 z-20 max-h-40 overflow-y-auto rounded-xl border border-white/10 bg-[#2a2a32] shadow-xl">
                            {filteredItems.map((item) => (
                              <li key={item.id}>
                                <button
                                  type="button"
                                  onMouseDown={(e) => e.preventDefault()}
                                  onClick={() => selectHouseholdItem(item, 'manual')}
                                  className="w-full text-left px-4 py-2.5 text-sm text-white/80 hover:bg-white/5"
                                >
                                  <span className="font-medium">{item.name}</span>
                                  {(item.aliases ?? []).length > 0 && (
                                    <span className="block text-xs text-white/35 mt-0.5 truncate">
                                      {(item.aliases ?? []).map((a) => a.display_text).join(' · ')}
                                    </span>
                                  )}
                                </button>
                              </li>
                            ))}
                            {showAddNewOption && (
                              <li>
                                <button
                                  type="button"
                                  onMouseDown={(e) => e.preventDefault()}
                                  onClick={() => {
                                    const name = itemSearch.trim()
                                    updateCurrent({ resolvedItemName: name, saveAsHouseholdItem: true })
                                    setShowItemDropdown(false)
                                  }}
                                  className="w-full text-left px-4 py-2.5 text-sm text-indigo-300/80 hover:bg-white/5 border-t border-white/5"
                                >
                                  {RECEIPTS.ITEM_SETUP.ADD_AS_NEW_ITEM(itemSearch.trim())}
                                </button>
                              </li>
                            )}
                          </ul>
                        )}
                      </div>

                      {/* AI chips */}
                      {showAiRow && (
                        <div className="mt-3">
                          <p className="text-xs text-white/40 mb-1.5 flex items-center gap-1">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3">
                              <path d="M15.98 1.804a1 1 0 00-1.96 0l-.24 1.192a1 1 0 01-.784.785l-1.192.238a1 1 0 000 1.962l1.192.238a1 1 0 01.785.785l.238 1.192a1 1 0 001.962 0l.238-1.192a1 1 0 01.785-.785l1.192-.238a1 1 0 000-1.962l-1.192-.238a1 1 0 01-.785-.785l-.238-1.192zM6.949 5.684a1 1 0 00-1.898 0l-.683 2.051a1 1 0 01-.633.633l-2.051.683a1 1 0 000 1.898l2.051.684a1 1 0 01.633.632l.683 2.051a1 1 0 001.898 0l.683-2.051a1 1 0 01.633-.633l2.051-.683a1 1 0 000-1.898l-2.051-.683a1 1 0 01-.633-.633L6.949 5.684zM13.949 13.684a1 1 0 00-1.898 0l-.184.551a1 1 0 01-.632.633l-.551.183a1 1 0 000 1.898l.551.183a1 1 0 01.633.633l.183.551a1 1 0 001.898 0l.184-.551a1 1 0 01.632-.633l.551-.183a1 1 0 000-1.898l-.551-.183a1 1 0 01-.633-.633l-.183-.551z" />
                            </svg>
                            {RECEIPTS.ITEM_SETUP.AI_SUGGESTION_LABEL}
                          </p>
                          <div className="flex flex-wrap gap-1.5">
                            {(current.aiCandidates ?? []).map((name) => {
                              const item = householdItems.find(
                                (i) => i.name.toLowerCase() === name.toLowerCase(),
                              )
                              if (item) {
                                return (
                                  <button
                                    key={name}
                                    type="button"
                                    onClick={() => selectHouseholdItem(item, 'ai')}
                                    className="text-xs px-2.5 py-1 rounded-full border border-violet-400 bg-violet-500/20 text-violet-100 font-semibold hover:bg-violet-500/35 transition-colors"
                                  >
                                    {name}
                                  </button>
                                )
                              }
                              return (
                                <button
                                  key={name}
                                  type="button"
                                  onClick={() => {
                                    setItemSearch(name)
                                    updateCurrent({
                                      resolvedItemName: name,
                                      saveAsHouseholdItem: true,
                                      householdItemId: null,
                                      matchSource: 'ai',
                                    })
                                    setShowItemDropdown(true)
                                  }}
                                  className="text-xs px-2.5 py-1 rounded-full border border-violet-400 bg-violet-500/20 text-violet-100 font-semibold hover:bg-violet-500/35 transition-colors"
                                >
                                  {name}
                                </button>
                              )
                            })}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* No match: save as household item toggle */}
                    {current.householdItemId === null && (
                      <>
                        <button
                          type="button"
                          onClick={() => {
                            const enabling = !current.saveAsHouseholdItem
                            updateCurrent({
                              saveAsHouseholdItem: enabling,
                              itemGroup: enabling && !current.itemGroup
                                ? (current.resolvedItemName ?? current.description)
                                : current.itemGroup,
                            })
                          }}
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

                        {/* Group input and split preview when creating new item */}
                        {current.saveAsHouseholdItem && (
                          <>
                          <input
                            type="text"
                            value={current.itemGroup}
                            onChange={(e) => updateCurrent({ itemGroup: e.target.value })}
                            placeholder={RECEIPTS.ITEM_SETUP.GROUP_PLACEHOLDER}
                            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-white placeholder-white/30 focus:outline-none focus:border-indigo-500 transition-colors"
                          />
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
                                      : getSplitsForLineItem(current, modalSplitCtx),
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
                              {current.useCustomSplit ? (
                                <SplitEditor
                                  members={allMembers.map((m) => ({ id: m.id, nickname: m.name }))}
                                  value={current.customSplits.map((s) => ({
                                    household_member_id: s.household_member_id,
                                    percentage: s.percentage,
                                    amount: (s.percentage / 100) * current.amount,
                                  }))}
                                  onChange={(splits) =>
                                    updateCurrent({
                                      customSplits: splits.map((s) => ({
                                        household_member_id: s.household_member_id,
                                        nickname: allMembers.find((m) => m.id === s.household_member_id)?.name ?? '',
                                        percentage: s.percentage,
                                      })),
                                    })
                                  }
                                  totalAmount={current.amount}
                                  showAmountInputs
                                />
                              ) : (
                                displaySplits.map((s) => {
                                  const dollar = ((s.percentage / 100) * current.amount).toFixed(2)
                                  return (
                                    <div key={s.household_member_id} className="flex items-center gap-3">
                                      <span className="flex-1 text-sm text-white/80">{s.nickname}</span>
                                      <span className="text-sm text-white/50 font-mono">{s.percentage}%</span>
                                      <span className="text-sm font-mono text-emerald-400/80 w-14 text-right">
                                        ${dollar}
                                      </span>
                                    </div>
                                  )
                                })
                              )}
                            </div>
                          </div>
                          </>
                        )}
                      </>
                    )}

                    {/* Matched to existing item */}
                    {current.householdItemId !== null && (
                      <>
                        <p className="text-xs text-white/40 px-1">
                          {RECEIPTS.ITEM_SETUP.ALREADY_IN_CATALOG}
                        </p>

                        <div>
                          <p className="text-xs text-white/50 mb-1">{RECEIPTS.ITEM_SETUP.DERIVED_CATEGORY}</p>
                          <p className="text-sm text-white/80">
                            {current.categoryId
                              ? localCategories.find((c) => c.id === current.categoryId)?.name ?? '—'
                              : RECEIPTS.ITEM_SETUP.CATEGORY_PLACEHOLDER}
                          </p>
                        </div>

                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs text-white/50">{RECEIPTS.ITEM_SETUP.SPLIT_PREVIEW}</span>
                          </div>
                          <div className="flex flex-col gap-2 bg-white/3 rounded-xl p-3 border border-white/8">
                            {displaySplits.map((s) => {
                              const dollar = ((s.percentage / 100) * current.amount).toFixed(2)
                              return (
                                <div key={s.household_member_id} className="flex items-center gap-3">
                                  <span className="flex-1 text-sm text-white/80">{s.nickname}</span>
                                  <span className="text-sm text-white/50 font-mono">{s.percentage}%</span>
                                  <span className="text-sm font-mono text-emerald-400/80 w-14 text-right">
                                    ${dollar}
                                  </span>
                                </div>
                              )
                            })}
                          </div>
                        </div>

                      </>
                    )}
                  </div>
                )}

                {/* By Category tab */}
                {current.setupMode === 'category' && (
                  <div className="flex flex-col gap-4">
                    <div>
                      <div className="flex items-center gap-2 mb-1.5">
                        <label className="block text-xs text-white/50">
                          {RECEIPTS.ITEM_SETUP.CATEGORY_LABEL}
                        </label>
                        {current.categoryAutoMatched && (
                          <span className="text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full bg-white/8 text-white/50 border border-white/10">
                            {RECEIPTS.ITEM_SETUP.MATCH_BADGE_SUGGESTED}
                          </span>
                        )}
                      </div>
                      <select
                        value={current.categoryId ?? ''}
                        onChange={(e) => handleCategoryChange(e.target.value)}
                        className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-white focus:outline-none focus:border-indigo-500 transition-colors"
                      >
                        <option value="">{RECEIPTS.ITEM_SETUP.CATEGORY_PLACEHOLDER}</option>
                        {localCategories.map((c) => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>

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
                                : getSplitsForLineItem(current, modalSplitCtx),
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
                        {current.useCustomSplit ? (
                          <SplitEditor
                            members={allMembers.map((m) => ({ id: m.id, nickname: m.name }))}
                            value={current.customSplits.map((s) => ({
                              household_member_id: s.household_member_id,
                              percentage: s.percentage,
                              amount: (s.percentage / 100) * current.amount,
                            }))}
                            onChange={(splits) =>
                              updateCurrent({
                                customSplits: splits.map((s) => ({
                                  household_member_id: s.household_member_id,
                                  nickname: allMembers.find((m) => m.id === s.household_member_id)?.name ?? '',
                                  percentage: s.percentage,
                                })),
                              })
                            }
                            totalAmount={current.amount}
                            showAmountInputs
                          />
                        ) : (
                          displaySplits.map((s) => {
                            const dollar = ((s.percentage / 100) * current.amount).toFixed(2)
                            return (
                              <div key={s.household_member_id} className="flex items-center gap-3">
                                <span className="flex-1 text-sm text-white/80">{s.nickname}</span>
                                <span className="text-sm text-white/50 font-mono">{s.percentage}%</span>
                                <span className="text-sm font-mono text-emerald-400/80 w-14 text-right">
                                  ${dollar}
                                </span>
                              </div>
                            )
                          })
                        )}
                        {showNoSplitsWarning && (
                          <p className="text-xs text-amber-400">{RECEIPTS.ITEM_SETUP.NO_SPLITS}</p>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          <div className="flex items-center justify-center gap-1.5 py-1">
            {localConfigs.map((c, i) => {
              const done = isLineItemConfirmed(c)
              const isInactive = !c.active
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => navigateItem(i, i > idx ? 'forward' : 'back')}
                  disabled={transitioning}
                  className={`rounded-full transition-all flex items-center justify-center ${
                    i === idx
                      ? 'w-5 h-2 bg-indigo-500'
                      : isInactive
                        ? 'w-2 h-2 border border-white/20 bg-transparent'
                        : done
                          ? 'w-4 h-4 bg-emerald-500/20 border border-emerald-500/35'
                          : 'w-2 h-2 bg-white/15'
                  }`}
                  aria-label={`Go to item ${i + 1}${done && !isInactive ? ', configured' : ''}`}
                >
                  {i !== idx && done && !isInactive && (
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-2.5 h-2.5 text-emerald-400">
                      <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
                    </svg>
                  )}
                </button>
              )
            })}
          </div>
        </div>

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
            disabled={transitioning || (current.active && !currentValid)}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-600 text-white font-semibold hover:from-indigo-400 hover:to-violet-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-indigo-500/20"
          >
            {idx === total - 1 ? RECEIPTS.ITEM_SETUP.DONE : RECEIPTS.ITEM_SETUP.NEXT}
          </button>
        </div>
      </div>
    </div>
  )
}

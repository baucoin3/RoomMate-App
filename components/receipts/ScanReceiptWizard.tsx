'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'
import { RECEIPTS } from '@/locales/en'
import { ROUTES } from '@/lib/constants/routes'
import { SUPABASE_URL, SUPABASE_ANON_KEY, RECEIPTS_BUCKET, RECEIPT_IMAGE_MAX_BYTES } from '@/lib/config'
import { apiClient, getErrorMessage } from '@/lib/api/client'
import LineItemsAccordion from '@/components/receipts/LineItemsAccordion'
import ItemSetupModal from '@/components/receipts/ItemSetupModal'
import AddParticipantsControl from '@/components/receipts/AddParticipantsControl'
import { matchLineToHouseholdItem } from '@/lib/utils/itemMatching'
import { normalizePercentages, roundCurrency } from '@/lib/utils/splits'
import {
  applyReceiptGuestChange,
  syncReceiptGuestsToConfigs,
  categoryHasValidSplits,
  firstUnconfiguredIndex,
  getDisplaySplitLines,
  getDisplaySplitsForLineItem,
  getLineItemStatus,
  hasValidSplitAssignment,
  isLineItemReadyToSave,
  lineItemStatusLabel,
  lineItemStatusPillClass,
  shouldCreateHouseholdItemOnSave,
  shouldUpsertAliasesOnSave,
  usesDefaultEqualSplit,
  withConfiguredFlags,
  type SplitResolverContext,
} from '@/lib/utils/receiptLineItems'
import type {
  ReceiptAnalysis,
  ReceiptAnalysisLineItem,
  SaveReceiptPayload,
  LineItemConfig,
  LineItemSplitRow,
  MatchSource,
} from '@/lib/types/receipts'
import type { HouseholdItem, HouseholdItemWithAliases } from '@/lib/types/householdItems'
import type { HouseholdGuest } from '@/lib/types/guests'

interface CategorySplit {
  household_member_id: string
  percentage: number
  nickname: string | null
}

interface Category {
  id: string
  name: string
  splits: CategorySplit[]
}

interface Props {
  householdId: string
  memberId: string
  categories: Category[]
  householdItems: HouseholdItem[]
  members: Array<{ id: string; name: string }>
}

type Step = 1 | 2 | 3

function payerKey(type: 'member' | 'guest', id: string): string {
  return `${type}:${id}`
}

function parsePayerKey(key: string): { type: 'member' | 'guest'; id: string } | null {
  const [type, id] = key.split(':')
  if ((type === 'member' || type === 'guest') && id) return { type, id }
  return null
}

function StepIndicator({ current }: { current: Step }) {
  const steps: { num: Step; label: string }[] = [
    { num: 1, label: RECEIPTS.STEPS.UPLOAD },
    { num: 2, label: RECEIPTS.STEPS.REVIEW },
    { num: 3, label: RECEIPTS.STEPS.SPLITS },
  ]

  return (
    <div className="flex items-center gap-2 mb-8">
      {steps.map((s, idx) => (
        <div key={s.num} className="flex items-center gap-2">
          <div
            className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold border ${
              current === s.num
                ? 'bg-indigo-500 border-indigo-500 text-white'
                : current > s.num
                ? 'bg-indigo-500/30 border-indigo-500/40 text-indigo-300'
                : 'bg-white/5 border-white/10 text-white/40'
            }`}
          >
            {current > s.num ? '✓' : s.num}
          </div>
          <span
            className={`text-sm ${current === s.num ? 'text-white font-medium' : 'text-white/40'}`}
          >
            {s.label}
          </span>
          {idx < steps.length - 1 && <div className="w-8 h-px bg-white/10 mx-1" />}
        </div>
      ))}
    </div>
  )
}

const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp']

function categorySplitsToRows(cat: Category): LineItemSplitRow[] {
  return cat.splits.map((s) => ({
    household_member_id: s.household_member_id,
    nickname: s.nickname ?? s.household_member_id.slice(0, 8),
    percentage: s.percentage,
  }))
}

function applyItemDefaults(
  item: HouseholdItem,
  categories: Category[],
  memberNicknames: Record<string, string>,
): Pick<LineItemConfig, 'categoryId' | 'useCustomSplit' | 'customSplits'> {
  const hasOverrides = (item.split_overrides?.length ?? 0) > 0
  const cat = item.default_category_id
    ? categories.find((c) => c.id === item.default_category_id) ?? null
    : null

  if (hasOverrides) {
    return {
      categoryId: item.default_category_id,
      useCustomSplit: true,
      customSplits: (item.split_overrides ?? []).map((o) => ({
        household_member_id: o.member_id,
        nickname: memberNicknames[o.member_id] ?? o.member_id.slice(0, 8),
        percentage: o.percentage,
      })),
    }
  }

  return {
    categoryId: item.default_category_id ?? null,
    useCustomSplit: false,
    customSplits: cat ? categorySplitsToRows(cat) : [],
  }
}

function matchLineItems(
  lineItems: ReceiptAnalysisLineItem[],
  householdItems: HouseholdItem[],
  categories: Category[],
  memberNicknames: Record<string, string>,
): LineItemConfig[] {
  const itemsWithAliases: HouseholdItemWithAliases[] = householdItems.map((item) => ({
    ...item,
    aliases: item.aliases ?? [],
  }))

  const splitCtx: SplitResolverContext = {
    categories: categories.map((c) => ({
      id: c.id,
      splits: c.splits.map((s) => ({
        household_member_id: s.household_member_id,
        percentage: s.percentage,
        nickname: s.nickname,
      })),
    })),
    allMembers: [],
  }

  return lineItems.map((item) => {
    const match = matchLineToHouseholdItem(item.description, itemsWithAliases)
    const probableNames = item.probable_names ?? []
    const aiMatchedItem = probableNames.reduce<HouseholdItem | null>((found, name) => {
      if (found) return found
      return householdItems.find(
        (i) => i.name.toLowerCase() === name.toLowerCase(),
      ) ?? null
    }, null)

    let householdItemId = match.itemId
    let matchSource: MatchSource = null
    let resolvedItemName: string | null = null
    let configured = false

    if (match.matchType === 'exact_name') {
      matchSource = 'catalog'
      resolvedItemName = householdItems.find((i) => i.id === match.itemId)?.name ?? null
      configured = true
    } else if (match.matchType === 'alias') {
      matchSource = 'alias'
      resolvedItemName = householdItems.find((i) => i.id === match.itemId)?.name ?? null
      configured = true
    } else if (aiMatchedItem) {
      householdItemId = aiMatchedItem.id
      matchSource = 'ai'
      resolvedItemName = aiMatchedItem.name
    } else if (match.matchType === 'fuzzy' && match.candidates.length > 0) {
      householdItemId = match.candidates[0].itemId
      matchSource = 'fuzzy'
      resolvedItemName = match.candidates[0].name
    }

    const selectedItem = householdItemId
      ? householdItems.find((i) => i.id === householdItemId) ?? null
      : null

    const itemDefaults = selectedItem
      ? applyItemDefaults(selectedItem, categories, memberNicknames)
      : { categoryId: null as string | null, useCustomSplit: false, customSplits: [] as LineItemSplitRow[] }

    if (!itemDefaults.categoryId && item.suggested_category_name) {
      const cat = categories.find(
        (c) => c.name.toLowerCase() === item.suggested_category_name!.toLowerCase(),
      )
      if (cat) {
        itemDefaults.categoryId = cat.id
        itemDefaults.customSplits = categorySplitsToRows(cat)
      }
    }

    const rememberAlias =
      match.matchType === 'none' ||
      match.matchType === 'fuzzy' ||
      matchSource === 'ai'

    const categoryAutoMatched =
      householdItemId === null &&
      itemDefaults.categoryId !== null &&
      item.suggested_category_name != null

    const setupMode: 'item' | 'category' = categoryAutoMatched ? 'category' : 'item'

    if (
      categoryAutoMatched &&
      itemDefaults.categoryId &&
      categoryHasValidSplits(itemDefaults.categoryId, splitCtx)
    ) {
      configured = true
    }

    return {
      description: item.description,
      amount: item.amount,
      quantity: item.quantity,
      setupMode,
      categoryId: itemDefaults.categoryId,
      useCustomSplit: itemDefaults.useCustomSplit,
      customSplits: itemDefaults.customSplits,
      guestSplits: [],
      splitCustomized: false,
      saveAsHouseholdItem: false,
      householdItemId,
      resolvedItemName,
      matchSource,
      rememberAlias,
      aiNormalizedName: item.normalized_name ?? null,
      aiSuggestedCategoryName: item.suggested_category_name ?? null,
      aiCandidates: probableNames,
      categoryAutoMatched,
      itemGroup: resolvedItemName ?? item.description,
      configured,
      active: true,
    }
  })
}

function computeAggregateSplits(
  configs: LineItemConfig[],
  ctx: SplitResolverContext,
  totalAmount: number,
): Array<{ household_member_id?: string; guest_id?: string; percentage: number; calculated_amount: number }> {
  if (configs.length === 0 || totalAmount <= 0) return []

  const memberTotals = configs.reduce<Record<string, number>>((acc, config) => {
    const weight = config.amount / totalAmount
    const displayRows = getDisplaySplitsForLineItem(config, ctx)
    return displayRows.reduce((inner, row) => {
      if (row.type === 'member') {
        return {
          ...inner,
          [row.id]: (inner[row.id] ?? 0) + row.percentage * weight,
        }
      }
      return inner
    }, acc)
  }, {})

  const guestTotals = configs.reduce<Record<string, number>>((acc, config) => {
    const weight = config.amount / totalAmount
    const displayRows = getDisplaySplitsForLineItem(config, ctx)
    return displayRows.reduce((inner, row) => {
      if (row.type === 'guest') {
        return {
          ...inner,
          [row.id]: (inner[row.id] ?? 0) + row.percentage * weight,
        }
      }
      return inner
    }, acc)
  }, {})

  const memberRows = Object.entries(memberTotals).map(([memberId, pct]) => ({
    household_member_id: memberId,
    percentage: roundCurrency(pct),
    calculated_amount: roundCurrency((pct / 100) * totalAmount),
  }))

  const guestRows = Object.entries(guestTotals).map(([guestId, pct]) => ({
    guest_id: guestId,
    percentage: roundCurrency(pct),
    calculated_amount: roundCurrency((pct / 100) * totalAmount),
  }))

  const allRows = [...memberRows, ...guestRows]
  if (allRows.length === 0) return []

  let pcts = allRows.map((r) => r.percentage)
  const rawTotal = pcts.reduce((sum, p) => sum + p, 0)
  if (rawTotal > 100.01) {
    console.error('[computeAggregateSplits] aggregate percentage exceeds 100%', rawTotal)
    const scale = 100 / rawTotal
    pcts = pcts.map((p) => p * scale)
  }
  const normalized = normalizePercentages(pcts)
  allRows.forEach((row, i) => {
    row.percentage = normalized[i]
    row.calculated_amount = roundCurrency((row.percentage / 100) * totalAmount)
  })

  const amountSum = allRows.reduce((sum, r) => sum + r.calculated_amount, 0)
  const amountDrift = roundCurrency(totalAmount - amountSum)
  if (amountDrift !== 0) {
    allRows[allRows.length - 1].calculated_amount = roundCurrency(
      allRows[allRows.length - 1].calculated_amount + amountDrift,
    )
  }

  return allRows
}

export default function ScanReceiptWizard({
  householdId,
  memberId,
  categories: initialCategories,
  householdItems,
  members,
}: Props) {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [step, setStep] = useState<Step>(1)
  const [fileError, setFileError] = useState('')
  const [uploadError, setUploadError] = useState('')
  const [uploading, setUploading] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)

  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [imageUrl, setImageUrl] = useState<string | null>(null)

  const [analyzing, setAnalyzing] = useState(false)
  const [analysisError, setAnalysisError] = useState('')
  const [merchantName, setMerchantName] = useState('')
  const [receiptDate, setReceiptDate] = useState('')
  const [total, setTotal] = useState<string>('')
  const [tax, setTax] = useState<string>('')
  const [lineItems, setLineItems] = useState<ReceiptAnalysisLineItem[]>([])
  const [analysisSnapshot, setAnalysisSnapshot] = useState<ReceiptAnalysis | null>(null)

  const [categories, setCategories] = useState<Category[]>(initialCategories)
  const [description, setDescription] = useState('')
  const [paidByKey, setPaidByKey] = useState(() => payerKey('member', memberId))
  const [householdGuests, setHouseholdGuests] = useState<HouseholdGuest[]>([])
  const [receiptGuests, setReceiptGuests] = useState<HouseholdGuest[]>([])
  const receiptGuestsRef = useRef<HouseholdGuest[]>([])
  const [lineItemConfigs, setLineItemConfigs] = useState<LineItemConfig[]>([])
  const [showItemModal, setShowItemModal] = useState(false)
  const [lastModalIndex, setLastModalIndex] = useState<number | null>(null)
  const [saveSplitsError, setSaveSplitsError] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')

  const memberNicknames = Object.fromEntries(
    members.map((m) => [m.id, m.name]),
  ) as Record<string, string>

  const memberCount = members.length
  const splitResolverCtx: SplitResolverContext = { categories, allMembers: members }

  useEffect(() => {
    receiptGuestsRef.current = receiptGuests
  }, [receiptGuests])

  useEffect(() => {
    apiClient
      .get<{ data: HouseholdGuest[] }>(`/api/guests?householdId=${householdId}`)
      .then((res) => setHouseholdGuests(res.data.data ?? []))
      .catch((err) => console.error('[ScanReceiptWizard] load guests', err))
  }, [householdId])

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    setFileError('')
    setAnalysisError('')
    const file = e.target.files?.[0]
    if (!file) return

    if (!ACCEPTED_TYPES.includes(file.type)) {
      setFileError(RECEIPTS.ERRORS.INVALID_FILE_TYPE)
      return
    }
    if (file.size > RECEIPT_IMAGE_MAX_BYTES) {
      setFileError(RECEIPTS.ERRORS.FILE_TOO_LARGE)
      return
    }

    setSelectedFile(file)
    setPreviewUrl(URL.createObjectURL(file))
    uploadFile(file)
  }

  async function uploadFile(file: File) {
    setUploading(true)
    setUploadError('')
    try {
      const supabase = createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY)
      const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg'
      const path = `${householdId}/${memberId}/${Date.now()}.${ext}`

      const { error: uploadErr } = await supabase.storage
        .from(RECEIPTS_BUCKET)
        .upload(path, file, { contentType: file.type, upsert: false })

      if (uploadErr) {
        setUploadError(RECEIPTS.ERRORS.UPLOAD_FAILED)
        return
      }

      const { data: urlData } = supabase.storage.from(RECEIPTS_BUCKET).getPublicUrl(path)
      setImageUrl(urlData.publicUrl)
    } catch (err) {
      console.error('[ScanReceiptWizard] upload', err)
      setUploadError(RECEIPTS.ERRORS.UPLOAD_FAILED)
    } finally {
      setUploading(false)
    }
  }

  function handleAnalyze() {
    if (imageUrl) enterStep2(imageUrl)
  }

  function clearImage() {
    setPreviewUrl(null)
    setImageUrl(null)
    setSelectedFile(null)
    setUploadError('')
    setFileError('')
    setAnalysisError('')
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  async function enterStep2(url: string) {
    setStep(2)
    setAnalyzing(true)
    setAnalysisError('')
    try {
      const res = await apiClient.post<{ data: ReceiptAnalysis }>('/api/receipts/analyze', {
        image_url: url,
        household_id: householdId,
      })
      const analysis = res.data.data
      setAnalysisSnapshot(analysis)
      setMerchantName(analysis.merchant_name ?? '')
      setReceiptDate(analysis.receipt_date ?? '')
      setTotal(analysis.total !== null ? String(analysis.total) : '')
      setTax(analysis.tax !== null ? String(analysis.tax) : '')
      setLineItems(analysis.line_items)
    } catch (err) {
      console.log(err)
      console.log('dogs')
      console.error('[ScanReceiptWizard] analyze', err)
      const message = getErrorMessage(err)
      if (message === RECEIPTS.ERRORS.NOT_A_RECEIPT) {
        setStep(1)
        setAnalysisError(message)
      } else {
        setAnalysisError(RECEIPTS.ERRORS.ANALYSIS_FAILED)
      }
    } finally {
      setAnalyzing(false)
    }
  }

  function enterSplitsStep() {
    const name = merchantName.trim()
    const date = receiptDate.trim()
    const prefilled = name && date ? `${name} — ${date}` : name || date || ''
    setDescription(prefilled)
    const configs = matchLineItems(lineItems, householdItems, categories, memberNicknames)
    const synced =
      receiptGuests.length > 0
        ? syncReceiptGuestsToConfigs(configs, receiptGuests, splitResolverCtx)
        : configs
    setLineItemConfigs(
      receiptGuests.length > 0
        ? withConfiguredFlags(synced, memberCount, splitResolverCtx)
        : synced,
    )
    setLastModalIndex(null)
    setStep(3)
  }

  const totalAmount = parseFloat(total) || 0
  const activeCount = lineItemConfigs.filter((c) => c.active).length

  const hasInvalidSplits = lineItemConfigs
    .filter((c) => c.active)
    .some((c) => !hasValidSplitAssignment(c, memberCount, splitResolverCtx))
  const saveBlocked = hasInvalidSplits || memberCount === 0

  function handleConfirmLineItem(index: number) {
    setLineItemConfigs((prev) =>
      prev.map((c, i) => i === index ? { ...c, active: !c.active } : c),
    )
  }

  function handleAddAllToExpense() {
    setLineItemConfigs((prev) =>
      prev.map((c) =>
        c.active && hasValidSplitAssignment(c, memberCount, splitResolverCtx) ? { ...c, active: true } : c,
      ),
    )
  }

  function handleReceiptGuestsChange(nextGuests: HouseholdGuest[]) {
    setLineItemConfigs((prev) =>
      withConfiguredFlags(
        applyReceiptGuestChange(prev, receiptGuestsRef.current, nextGuests, splitResolverCtx),
        memberCount,
        splitResolverCtx,
      ),
    )
    setReceiptGuests(nextGuests)
  }

  function handleGuestCreated(guest: HouseholdGuest) {
    setHouseholdGuests((prev) => [...prev, guest].sort((a, b) => a.name.localeCompare(b.name)))
  }

  function handleModalSave(updatedConfigs: LineItemConfig[], lastIndex: number) {
    setLineItemConfigs(withConfiguredFlags(updatedConfigs, memberCount, splitResolverCtx))
    setLastModalIndex(lastIndex)
    setShowItemModal(false)
  }

  function handleCategoryCreated(newCat: Category) {
    setCategories((prev) => [...prev, newCat])
  }

  async function handleSave() {
    setSaveSplitsError('')
    setSaveError('')

    if (memberCount === 0) {
      setSaveSplitsError(RECEIPTS.ERRORS.NO_MEMBERS_FOR_SPLITS)
      return
    }

    const configsToSave = withConfiguredFlags(
      lineItemConfigs.filter((c) => c.active),
      memberCount,
      splitResolverCtx,
    )
    const remaining = configsToSave.filter((c) => !isLineItemReadyToSave(c, memberCount, splitResolverCtx)).length
    if (remaining > 0) {
      setSaveSplitsError(RECEIPTS.ERRORS.SPLITS_REQUIRED)
      return
    }

    setSaving(true)
    try {
      const aggregateSplits = computeAggregateSplits(configsToSave, splitResolverCtx, totalAmount)

      const catCount: Record<string, number> = {}
      configsToSave.forEach((c) => {
        if (c.categoryId) catCount[c.categoryId] = (catCount[c.categoryId] ?? 0) + 1
      })
      const primaryCategoryId =
        Object.entries(catCount).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null

      const newHouseholdItems = configsToSave
        .filter(shouldCreateHouseholdItemOnSave)
        .map((c) => ({
          name: c.resolvedItemName ?? c.description,
          default_category_id: c.categoryId,
          split_overrides: c.useCustomSplit && c.customSplits.length > 0
            ? c.customSplits.map((s) => ({ member_id: s.household_member_id, percentage: s.percentage }))
            : null,
          initial_aliases: [
            c.description,
            ...(c.aiCandidates ?? []).filter(
              (a) => a.toLowerCase() !== (c.resolvedItemName ?? c.description).toLowerCase()
            ),
          ].filter(Boolean),
          item_group: c.itemGroup?.trim() || null,
        }))

      const aliasInserts = configsToSave
        .filter(shouldUpsertAliasesOnSave)
        .flatMap((c) => {
          const allAliases = [c.description, ...(c.aiCandidates ?? [])]
          const deduplicated = Array.from(new Set(allAliases.map((n) => n.trim()).filter(Boolean)))
          return deduplicated.slice(0, 5).map((alias) => ({
            household_item_id: c.householdItemId!,
            display_text: alias,
          }))
        })

      const payer = parsePayerKey(paidByKey)
      if (!payer) {
        setSaveError(RECEIPTS.ERRORS.PAYER_REQUIRED)
        return
      }

      const payload: SaveReceiptPayload = {
        household_id: householdId,
        image_url: imageUrl!,
        merchant_name: merchantName || null,
        receipt_date: receiptDate || null,
        raw_total: totalAmount,
        ai_extracted_data: analysisSnapshot ?? {
          merchant_name: merchantName || null,
          receipt_date: receiptDate || null,
          subtotal: null,
          tax: tax ? parseFloat(tax) : null,
          total: totalAmount,
          suggested_category_name: null,
          line_items: lineItems,
        },
        line_items: lineItems.map(({ description: d, amount, quantity }) => ({
          description: d,
          amount,
          quantity,
        })),
        category_id: primaryCategoryId,
        description: description || merchantName || 'Receipt',
        uploaded_by_member_id: memberId,
        ...(payer.type === 'member'
          ? { paid_by_member_id: payer.id }
          : { paid_by_guest_id: payer.id }),
        splits: aggregateSplits,
        new_household_items: newHouseholdItems.length > 0 ? newHouseholdItems : undefined,
        alias_inserts: aliasInserts.length > 0 ? aliasInserts : undefined,
      }

      await apiClient.post<{ data: { receipt_id: string; expense_id: string } }>(
        '/api/receipts',
        payload,
      )
      router.push(ROUTES.HOUSEHOLD_RECEIPTS(householdId))
    } catch (err) {
      setSaveError(getErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  function resetToStep1() {
    setStep(1)
    clearImage()
    setAnalysisError('')
    setMerchantName('')
    setReceiptDate('')
    setTotal('')
    setTax('')
    setLineItems([])
    setAnalysisSnapshot(null)
  }

  const modalInitialIndex = lastModalIndex ?? firstUnconfiguredIndex(lineItemConfigs)

  return (
    <div className="max-w-lg mx-auto px-4 py-6">
      <StepIndicator current={step} />

      {step === 1 && (
        <div className="flex flex-col items-center gap-4">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            capture="environment"
            className="hidden"
            onChange={handleFileSelect}
          />

          {previewUrl && (
            <div className="relative w-full rounded-xl overflow-hidden border border-white/10">
              <img src={previewUrl} alt="Receipt preview" className="w-full object-contain max-h-72" />
              {!uploading && (
                <button
                  type="button"
                  onClick={clearImage}
                  aria-label={RECEIPTS.ACTIONS.REMOVE_IMAGE}
                  className="absolute top-2.5 right-2.5 w-9 h-9 flex items-center justify-center rounded-full bg-black/60 backdrop-blur-sm border border-white/20 text-white/70 hover:text-white hover:bg-red-500/80 hover:border-red-400/50 hover:scale-110 transition-all duration-150"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                    <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
                  </svg>
                </button>
              )}
            </div>
          )}

          {!previewUrl && (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-full flex flex-col items-center justify-center gap-3 py-12 rounded-xl border-2 border-dashed border-white/20 hover:border-indigo-500/50 hover:bg-white/5 transition-all"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-10 h-10 text-white/40">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008V10.5z" />
              </svg>
              <span className="text-white/60">{RECEIPTS.ACTIONS.UPLOAD_PHOTO}</span>
            </button>
          )}

          {fileError && (
            <p className="text-red-400 text-sm text-center">{fileError}</p>
          )}

          {analysisError && (
            <p className="text-amber-400 text-sm text-center">{analysisError}</p>
          )}

          {uploadError && !uploading && (
            <div className="flex flex-col items-center gap-3 w-full">
              <p className="text-red-400 text-sm text-center">{uploadError}</p>
              <div className="flex gap-2 w-full">
                <button
                  type="button"
                  onClick={() => selectedFile && uploadFile(selectedFile)}
                  disabled={!selectedFile}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg bg-indigo-500/20 border border-indigo-500/40 text-indigo-300 hover:bg-indigo-500/30 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed transition-all text-sm font-medium"
                >
                  {RECEIPTS.ACTIONS.RETRY_UPLOAD}
                </button>
                <button
                  type="button"
                  onClick={clearImage}
                  className="flex-1 py-2.5 rounded-lg border border-white/10 text-white/50 hover:text-white hover:border-white/20 transition-colors text-sm"
                >
                  {RECEIPTS.ACTIONS.REMOVE_IMAGE}
                </button>
              </div>
            </div>
          )}

          {previewUrl && !uploadError && (
            <button
              type="button"
              onClick={handleAnalyze}
              disabled={uploading || !imageUrl}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-600 text-white font-semibold text-sm hover:from-indigo-400 hover:to-violet-500 disabled:opacity-60 disabled:cursor-not-allowed transition-all"
            >
              {uploading ? RECEIPTS.ACTIONS.UPLOADING : RECEIPTS.ACTIONS.ANALYZE_RECEIPT}
            </button>
          )}
        </div>
      )}

      {step === 2 && (
        <div className="flex flex-col gap-5">
          {analyzing ? (
            <div className="flex flex-col items-center gap-4 py-10">
              <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-white/60 text-sm">{RECEIPTS.ACTIONS.ANALYZE}</p>
            </div>
          ) : (
            <>
              {analysisError && (
                <p className="text-amber-400 text-sm">{analysisError}</p>
              )}

              <div className="flex flex-col gap-4">
                <div>
                  <label className="block text-xs text-white/50 mb-1">{RECEIPTS.LABELS.MERCHANT}</label>
                  <input
                    type="text"
                    value={merchantName}
                    onChange={(e) => setMerchantName(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white placeholder-white/30 focus:outline-none focus:border-indigo-500"
                    placeholder="e.g. Whole Foods"
                  />
                </div>

                <div>
                  <label className="block text-xs text-white/50 mb-1">{RECEIPTS.LABELS.DATE}</label>
                  <input
                    type="date"
                    value={receiptDate}
                    onChange={(e) => setReceiptDate(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-white/50 mb-1">{RECEIPTS.LABELS.TOTAL}</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={total}
                      onChange={(e) => setTotal(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                      placeholder="0.00"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-white/50 mb-1">{RECEIPTS.LABELS.TAX}</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={tax}
                      onChange={(e) => setTax(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                      placeholder="0.00"
                    />
                  </div>
                </div>

                <LineItemsAccordion items={lineItems} />
              </div>

              <div className="flex gap-3 mt-2">
                <button
                  type="button"
                  onClick={resetToStep1}
                  className="flex-1 py-2.5 rounded-lg border border-white/10 text-white/60 hover:text-white hover:border-white/20 transition-colors text-sm"
                >
                  {RECEIPTS.ACTIONS.RETAKE}
                </button>
                <button
                  type="button"
                  onClick={enterSplitsStep}
                  disabled={!total}
                  className="flex-1 py-2.5 rounded-lg bg-indigo-500 text-white font-semibold hover:bg-indigo-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm"
                >
                  Next →
                </button>

              </div>
            </>
          )}
        </div>
      )}

      {step === 3 && (
        <div className="flex flex-col gap-5">
          <div>
            <label className="block text-xs text-white/50 mb-1">{RECEIPTS.LABELS.DESCRIPTION}</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white placeholder-white/30 focus:outline-none focus:border-indigo-500"
              placeholder={merchantName || 'Expense description'}
            />
          </div>

          <div>
            <label className="block text-xs text-white/50 mb-1">{RECEIPTS.LABELS.PAID_BY}</label>
            <select
              value={paidByKey}
              onChange={(e) => setPaidByKey(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
            >
              {members.map((m) => (
                <option key={m.id} value={payerKey('member', m.id)}>
                  {m.name}
                </option>
              ))}
              {householdGuests.map((g) => (
                <option key={g.id} value={payerKey('guest', g.id)}>
                  {g.name}{RECEIPTS.LABELS.PAID_BY_GUEST_SUFFIX}
                </option>
              ))}
            </select>
          </div>

          {lineItemConfigs.length > 0 && (
            <div>
              <label className="block text-xs text-white/50 mb-1">{RECEIPTS.SPLITS.GUESTS_ON_RECEIPT}</label>
              <p className="text-xs text-white/35 mb-2">{RECEIPTS.SPLITS.GUESTS_ON_RECEIPT_HINT}</p>
              <AddParticipantsControl
                householdId={householdId}
                availableGuests={householdGuests}
                selectedGuests={receiptGuests}
                onChange={handleReceiptGuestsChange}
                onGuestCreated={handleGuestCreated}
              />
            </div>
          )}

          {lineItemConfigs.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs text-white/50">{RECEIPTS.LABELS.LINE_ITEMS}</label>
                <button
                  type="button"
                  onClick={handleAddAllToExpense}
                  className="text-xs text-white/40 hover:text-white/70 transition-colors"
                >
                  {RECEIPTS.ACTIONS.ADD_ALL_TO_EXPENSE}
                </button>
              </div>
              <div className="flex flex-col gap-1.5">
                {lineItemConfigs.map((config, i) => {
                  const status = getLineItemStatus(config, memberCount, splitResolverCtx)
                  const confirmed = config.active
                  const catName = config.categoryId
                    ? categories.find((c) => c.id === config.categoryId)?.name
                    : null
                  const displayRows = getDisplaySplitsForLineItem(config, splitResolverCtx)
                  const splitLines = getDisplaySplitLines(displayRows, config.amount)
                  const isDefaultSplit = usesDefaultEqualSplit(config, memberCount)

                  return (
                    <div
                      key={i}
                      role="button"
                      tabIndex={0}
                      onClick={() => handleConfirmLineItem(i)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          handleConfirmLineItem(i)
                        }
                      }}
                      className={`flex items-start gap-3 px-3 py-2.5 rounded-xl bg-gradient-to-r from-white/[0.04] to-white/[0.02] border transition-colors cursor-pointer border-white/5 hover:border-white/15 ${
                        !config.active ? 'opacity-50' : ''
                      }`}
                    >
                      {confirmed ? (
                        <span className="shrink-0 w-6 h-6 flex items-center justify-center rounded-full bg-emerald-500/15 border border-emerald-500/25 text-emerald-400">
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
                            <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
                          </svg>
                        </span>
                      ) : (
                        <span className="shrink-0 w-6 h-6 rounded-full border border-dashed border-white/20" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-white/75 truncate">{config.description}</p>
                        {config.setupMode === 'item' && config.resolvedItemName && (
                          <p className="text-xs text-indigo-300/70 mt-0.5 truncate">{config.resolvedItemName}</p>
                        )}
                        {catName && (
                          <p className="text-xs text-white/35 mt-0.5">{catName}</p>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-1 shrink-0 min-w-[100px]">
                        <span className="text-base font-mono text-emerald-400/90">
                          ${config.amount.toFixed(2)}
                        </span>
                        <span
                          className={`text-sm font-medium px-2.5 py-0.5 rounded-full ${lineItemStatusPillClass(status)}`}
                        >
                          {lineItemStatusLabel(status, memberCount)}
                        </span>
                        {(isDefaultSplit || splitLines.length > 0) && (
                          <div className="flex flex-col items-end gap-0.5 mt-0.5">
                            {isDefaultSplit && (
                              <span className="text-sm text-white/35">
                                {RECEIPTS.LABELS.EQUAL_SPLIT}
                              </span>
                            )}
                            {splitLines.map((line) => (
                              <span key={line} className="text-sm text-white/50">
                                {line}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {lineItemConfigs.length > 0 && (
            <button
              type="button"
              onClick={() => setShowItemModal(true)}
              className="w-full py-3 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2 bg-indigo-500/10 border border-indigo-400/25 text-indigo-200 hover:bg-indigo-500/15 hover:border-indigo-400/35 hover:text-indigo-100"
            >
              {RECEIPTS.ACTIONS.CONFIGURE_ITEMS}
              <span className="ml-1 px-1.5 py-0.5 rounded-full bg-white/10 text-white/50 text-xs">
                {RECEIPTS.ACTIONS.CONFIGURE_ITEMS_COUNT(activeCount)}
              </span>
            </button>
          )}

          {saveSplitsError && (
            <p className="text-red-400 text-sm" role="alert">{saveSplitsError}</p>
          )}
          {saveError && (
            <p className="text-red-400 text-sm" role="alert">{saveError}</p>
          )}

          <div className="flex gap-3 mt-2">
            <button
              type="button"
              onClick={() => setStep(2)}
              className="flex-1 py-2.5 rounded-lg border border-white/10 text-white/60 hover:text-white hover:border-white/20 transition-colors text-sm"
            >
              ← Back
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || saveBlocked}
              className={`flex-1 py-2.5 rounded-lg font-semibold transition-all text-sm ${
                saveBlocked
                  ? 'bg-amber-500/10 border border-amber-500/30 text-amber-400/60 cursor-not-allowed'
                  : 'bg-gradient-to-r from-indigo-500 to-violet-600 text-white hover:from-indigo-400 hover:to-violet-500 disabled:opacity-50 disabled:cursor-not-allowed'
              }`}
            >
              {saving ? RECEIPTS.ACTIONS.SAVING : RECEIPTS.ACTIONS.SAVE}
            </button>
          </div>
        </div>
      )}

      {showItemModal && (
        <ItemSetupModal
          configs={lineItemConfigs}
          categories={categories}
          allMembers={members}
          householdItems={householdItems}
          splitResolverCtx={splitResolverCtx}
          householdId={householdId}
          availableGuests={householdGuests}
          onGuestCreated={handleGuestCreated}
          initialIndex={modalInitialIndex}
          onSave={handleModalSave}
          onCategoryCreated={handleCategoryCreated}
        />
      )}
    </div>
  )
}

'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'
import { RECEIPTS } from '@/locales/en'
import { ROUTES } from '@/lib/constants/routes'
import { SUPABASE_URL, SUPABASE_ANON_KEY, RECEIPTS_BUCKET, RECEIPT_IMAGE_MAX_BYTES } from '@/lib/config'
import { apiClient, getErrorMessage } from '@/lib/api/client'
import ItemSetupModal from '@/components/receipts/ItemSetupModal'
import UploadStep from '@/components/receipts/wizard/UploadStep'
import ReviewStep from '@/components/receipts/wizard/ReviewStep'
import SplitsStep from '@/components/receipts/wizard/SplitsStep'
import { matchLineToHouseholdItem } from '@/lib/utils/itemMatching'
import { normalizePercentages, roundCurrency } from '@/lib/utils/splits'
import {
  applyReceiptGuestChange,
  syncReceiptGuestsToConfigs,
  categoryHasValidSplits,
  firstUnconfiguredIndex,
  getDisplaySplitsForLineItem,
  hasValidSplitAssignment,
  isLineItemReadyToSave,
  shouldCreateHouseholdItemOnSave,
  shouldUpsertAliasesOnSave,
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
        return { ...inner, [row.id]: (inner[row.id] ?? 0) + row.percentage * weight }
      }
      return inner
    }, acc)
  }, {})

  const guestTotals = configs.reduce<Record<string, number>>((acc, config) => {
    const weight = config.amount / totalAmount
    const displayRows = getDisplaySplitsForLineItem(config, ctx)
    return displayRows.reduce((inner, row) => {
      if (row.type === 'guest') {
        return { ...inner, [row.id]: (inner[row.id] ?? 0) + row.percentage * weight }
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
  const isManualMode = imageUrl === null && analysisSnapshot === null && step >= 2

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

  function enterManualStep2() {
    clearImage()
    setMerchantName('')
    setReceiptDate(new Date().toISOString().split('T')[0])
    setTotal('')
    setTax('')
    setLineItems([])
    setAnalysisSnapshot(null)
    setAnalysisError('')
    setStep(2)
  }

  function enterSplitsStep() {
    const name = merchantName.trim()
    const date = receiptDate.trim()
    const prefilled = name && date ? `${name} — ${date}` : name || date || ''
    setDescription(prefilled)

    // If user entered no items, create a synthetic fallback so splits can be configured
    const itemsToMatch: ReceiptAnalysisLineItem[] = lineItems.length > 0
      ? lineItems
      : [{
          description: name || RECEIPTS.LABELS.FALLBACK_ITEM_NAME,
          amount: parseFloat(total) || 0,
          quantity: null,
        }]

    const configs = matchLineItems(itemsToMatch, householdItems, categories, memberNicknames)
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
        image_url: imageUrl,
        merchant_name: merchantName || null,
        receipt_date: receiptDate || null,
        raw_total: totalAmount,
        ai_extracted_data: analysisSnapshot ?? null,
        line_items: lineItems.map(({ description: d, amount, quantity }) => ({
          description: d,
          amount,
          quantity: quantity ?? null,
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
        <UploadStep
          fileInputRef={fileInputRef}
          previewUrl={previewUrl}
          uploading={uploading}
          imageUrl={imageUrl}
          selectedFile={selectedFile}
          fileError={fileError}
          uploadError={uploadError}
          analysisError={analysisError}
          onFileSelect={handleFileSelect}
          onClearImage={clearImage}
          onRetryUpload={() => selectedFile && uploadFile(selectedFile)}
          onAnalyze={handleAnalyze}
          onSkipToManual={enterManualStep2}
        />
      )}

      {step === 2 && (
        <ReviewStep
          analyzing={analyzing}
          analysisError={analysisError}
          merchantName={merchantName}
          receiptDate={receiptDate}
          total={total}
          tax={tax}
          lineItems={lineItems}
          isManualMode={isManualMode}
          onMerchantChange={setMerchantName}
          onDateChange={setReceiptDate}
          onTotalChange={setTotal}
          onTaxChange={setTax}
          onLineItemsChange={setLineItems}
          onBack={isManualMode ? () => setStep(1) : resetToStep1}
          onNext={enterSplitsStep}
        />
      )}

      {step === 3 && (
        <SplitsStep
          householdId={householdId}
          description={description}
          paidByKey={paidByKey}
          members={members}
          householdGuests={householdGuests}
          receiptGuests={receiptGuests}
          lineItemConfigs={lineItemConfigs}
          categories={categories}
          memberCount={memberCount}
          splitResolverCtx={splitResolverCtx}
          activeCount={activeCount}
          saveBlocked={saveBlocked}
          saveSplitsError={saveSplitsError}
          saveError={saveError}
          saving={saving}
          onDescriptionChange={setDescription}
          onPaidByChange={setPaidByKey}
          onReceiptGuestsChange={handleReceiptGuestsChange}
          onGuestCreated={handleGuestCreated}
          onConfirmLineItem={handleConfirmLineItem}
          onAddAllToExpense={handleAddAllToExpense}
          onOpenModal={() => setShowItemModal(true)}
          onBack={() => setStep(2)}
          onSave={handleSave}
        />
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


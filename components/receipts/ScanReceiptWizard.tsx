'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'
import { RECEIPTS } from '@/locales/en'
import { ROUTES } from '@/lib/constants/routes'
import { SUPABASE_URL, SUPABASE_ANON_KEY, RECEIPTS_BUCKET, RECEIPT_IMAGE_MAX_BYTES } from '@/lib/config'
import { apiClient, getErrorMessage } from '@/lib/api/client'
import LineItemsAccordion from '@/components/receipts/LineItemsAccordion'
import ItemSetupModal from '@/components/receipts/ItemSetupModal'
import type { ReceiptAnalysis, SaveReceiptPayload, LineItemConfig, HouseholdItemSummary } from '@/lib/types/receipts'

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
  householdItems: HouseholdItemSummary[]
}

type Step = 1 | 2 | 3

const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp']

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

/** Match line items to known household items by name (case-insensitive) */
function matchLineItems(
  lineItems: Array<{ description: string; amount: number; quantity: number }>,
  householdItems: HouseholdItemSummary[],
  categories: Category[],
): LineItemConfig[] {
  return lineItems.map((item) => {
    const matched = householdItems.find(
      (hi) => hi.name.toLowerCase() === item.description.toLowerCase(),
    )
    const cat = matched?.default_category_id
      ? categories.find((c) => c.id === matched.default_category_id) ?? null
      : null

    const defaultSplits = cat
      ? cat.splits.map((s) => ({
          household_member_id: s.household_member_id,
          nickname: s.nickname ?? s.household_member_id.slice(0, 8),
          percentage: s.percentage,
        }))
      : []

    return {
      description: item.description,
      amount: item.amount,
      quantity: item.quantity,
      categoryId: matched?.default_category_id ?? null,
      useCustomSplit: false,
      customSplits: defaultSplits,
      saveAsHouseholdItem: false,
      matchedHouseholdItemId: matched?.id ?? null,
    }
  })
}

/** Compute aggregate member splits from per-item configs, weighted by amount */
function computeAggregateSplits(
  configs: LineItemConfig[],
  categories: Category[],
  totalAmount: number,
): Array<{ household_member_id: string; percentage: number; calculated_amount: number }> {
  if (configs.length === 0 || totalAmount <= 0) return []

  const memberTotals: Record<string, number> = {}

  configs.forEach((config) => {
    const weight = config.amount / totalAmount
    const splits = config.useCustomSplit
      ? config.customSplits
      : config.categoryId
        ? (categories.find((c) => c.id === config.categoryId)?.splits ?? []).map((s) => ({
            household_member_id: s.household_member_id,
            nickname: s.nickname ?? '',
            percentage: s.percentage,
          }))
        : []

    splits.forEach((s) => {
      memberTotals[s.household_member_id] =
        (memberTotals[s.household_member_id] ?? 0) + s.percentage * weight
    })
  })

  return Object.entries(memberTotals).map(([memberId, pct]) => ({
    household_member_id: memberId,
    percentage: Math.round(pct * 100) / 100,
    calculated_amount: Math.round((pct / 100) * totalAmount * 100) / 100,
  }))
}

export default function ScanReceiptWizard({ householdId, memberId, categories, householdItems }: Props) {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [step, setStep] = useState<Step>(1)
  const [fileError, setFileError] = useState('')
  const [uploadError, setUploadError] = useState('')
  const [uploading, setUploading] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)

  // Step 1 state
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [imageUrl, setImageUrl] = useState<string | null>(null)

  // Step 2 state
  const [analyzing, setAnalyzing] = useState(false)
  const [analysisError, setAnalysisError] = useState('')
  const [merchantName, setMerchantName] = useState('')
  const [receiptDate, setReceiptDate] = useState('')
  const [total, setTotal] = useState<string>('')
  const [tax, setTax] = useState<string>('')
  const [lineItems, setLineItems] = useState<Array<{ description: string; amount: number; quantity: number }>>([])

  // Step 3 state
  const [description, setDescription] = useState('')
  const [paidByMemberId, setPaidByMemberId] = useState(memberId)
  const [lineItemConfigs, setLineItemConfigs] = useState<LineItemConfig[]>([])
  const [showItemModal, setShowItemModal] = useState(false)
  const [saveSplitsError, setSaveSplitsError] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    setFileError('')
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
      await enterStep2(urlData.publicUrl)
    } catch (err) {
      console.error('[ScanReceiptWizard] upload', err)
      setUploadError(RECEIPTS.ERRORS.UPLOAD_FAILED)
    } finally {
      setUploading(false)
    }
  }

  function clearImage() {
    setPreviewUrl(null)
    setImageUrl(null)
    setSelectedFile(null)
    setUploadError('')
    setFileError('')
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
      setMerchantName(analysis.merchant_name ?? '')
      setReceiptDate(analysis.receipt_date ?? '')
      setTotal(analysis.total !== null ? String(analysis.total) : '')
      setTax(analysis.tax !== null ? String(analysis.tax) : '')
      setLineItems(analysis.line_items)
    } catch (err) {
      console.error('[ScanReceiptWizard] analyze', err)
      setAnalysisError(RECEIPTS.ERRORS.ANALYSIS_FAILED)
    } finally {
      setAnalyzing(false)
    }
  }

  function enterStep3() {
    const name = merchantName.trim()
    const date = receiptDate.trim()
    const prefilled = name && date ? `${name} — ${date}` : name || date || ''
    setDescription(prefilled)
    setLineItemConfigs(matchLineItems(lineItems, householdItems, categories))
    setStep(3)
  }

  const totalAmount = parseFloat(total) || 0

  const unassignedCount = lineItemConfigs.filter(
    (c) => !c.categoryId && !c.useCustomSplit,
  ).length

  function handleModalDone(updatedConfigs: LineItemConfig[]) {
    setLineItemConfigs(updatedConfigs)
    setShowItemModal(false)
  }

  async function handleSave() {
    setSaveSplitsError('')
    setSaveError('')

    if (unassignedCount > 0) {
      setSaveSplitsError(RECEIPTS.ERRORS.SPLITS_REQUIRED)
      return
    }

    setSaving(true)
    try {
      const aggregateSplits = computeAggregateSplits(lineItemConfigs, categories, totalAmount)

      // Determine primary category (most-used by item count)
      const catCount: Record<string, number> = {}
      lineItemConfigs.forEach((c) => {
        if (c.categoryId) catCount[c.categoryId] = (catCount[c.categoryId] ?? 0) + 1
      })
      const primaryCategoryId =
        Object.entries(catCount).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null

      const newHouseholdItems = lineItemConfigs
        .filter((c) => c.saveAsHouseholdItem && !c.matchedHouseholdItemId)
        .map((c) => ({ name: c.description, default_category_id: c.categoryId }))

      const payload: SaveReceiptPayload = {
        household_id: householdId,
        image_url: imageUrl!,
        merchant_name: merchantName || null,
        receipt_date: receiptDate || null,
        raw_total: totalAmount,
        ai_extracted_data: {
          merchant_name: merchantName || null,
          receipt_date: receiptDate || null,
          subtotal: null,
          tax: tax ? parseFloat(tax) : null,
          total: totalAmount,
          suggested_category_name: null,
          line_items: lineItems,
        },
        line_items: lineItems,
        category_id: primaryCategoryId,
        description: description || merchantName || 'Receipt',
        paid_by_member_id: paidByMemberId,
        splits: aggregateSplits,
        new_household_items: newHouseholdItems.length > 0 ? newHouseholdItems : undefined,
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
  }

  // Collect all unique members across categories for paid-by dropdown
  const allMembers = Array.from(
    new Map(
      categories
        .flatMap((c) => c.splits)
        .map((s) => [s.household_member_id, s.nickname ?? s.household_member_id.slice(0, 8)]),
    ).entries(),
  ).map(([id, name]) => ({ id, name }))

  return (
    <div className="max-w-lg mx-auto px-4 py-6">
      <StepIndicator current={step} />

      {/* ── Step 1 — Upload ── */}
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

          {/* Preview with overlay controls */}
          {previewUrl && (
            <div className="relative w-full rounded-xl overflow-hidden border border-white/10">
              <img src={previewUrl} alt="Receipt preview" className="w-full object-contain max-h-64" />
              {/* Remove button — always visible */}
              {!uploading && (
                <button
                  type="button"
                  onClick={clearImage}
                  aria-label={RECEIPTS.ACTIONS.REMOVE_IMAGE}
                  className="absolute top-2 right-2 w-8 h-8 flex items-center justify-center rounded-full bg-black/60 text-white/80 hover:text-white hover:bg-black/80 border border-white/20 transition-all"
                >
                  ✕
                </button>
              )}
            </div>
          )}

          {/* Upload drop zone — only when no image selected */}
          {!uploading && !previewUrl && (
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

          {/* Uploading spinner */}
          {uploading && (
            <div className="flex flex-col items-center gap-3 py-8">
              <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-white/60 text-sm">{RECEIPTS.ACTIONS.ANALYZE}</p>
            </div>
          )}

          {fileError && (
            <p className="text-red-400 text-sm text-center">{fileError}</p>
          )}

          {/* Upload error with retry + remove */}
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
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                    <path fillRule="evenodd" d="M15.312 11.424a5.5 5.5 0 01-9.201 2.466l-.312-.311h2.433a.75.75 0 000-1.5H3.989a.75.75 0 00-.75.75v4.242a.75.75 0 001.5 0v-2.43l.31.31a7 7 0 0011.712-3.138.75.75 0 00-1.449-.39zm1.23-3.723a.75.75 0 00.219-.53V2.929a.75.75 0 00-1.5 0V5.36l-.31-.31A7 7 0 003.239 8.188a.75.75 0 101.448.389A5.5 5.5 0 0113.89 6.11l.311.31h-2.432a.75.75 0 000 1.5h4.243a.75.75 0 00.53-.219z" clipRule="evenodd" />
                  </svg>
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
        </div>
      )}

      {/* ── Step 2 — Review ── */}
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
                  onClick={enterStep3}
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

      {/* ── Step 3 — Splits ── */}
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
              value={paidByMemberId}
              onChange={(e) => setPaidByMemberId(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
            >
              {allMembers.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>

          {/* Line items status list */}
          {lineItemConfigs.length > 0 && (
            <div>
              <label className="block text-xs text-white/50 mb-2">{RECEIPTS.LABELS.LINE_ITEMS}</label>
              <div className="flex flex-col gap-1.5">
                {lineItemConfigs.map((config, i) => {
                  const isAuto = config.matchedHouseholdItemId !== null
                  const isSetUp = !isAuto && (!!config.categoryId || config.useCustomSplit)
                  const catName = config.categoryId
                    ? categories.find((c) => c.id === config.categoryId)?.name
                    : null

                  return (
                    <div
                      key={i}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-white/3 border border-white/8"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-white/90 truncate">{config.description}</p>
                        {catName && (
                          <p className="text-xs text-white/40 mt-0.5">{catName}</p>
                        )}
                      </div>
                      <span className="text-xs font-mono text-white/50 shrink-0">
                        ${config.amount.toFixed(2)}
                      </span>
                      <span
                        className={`text-xs font-medium px-2 py-0.5 rounded-full shrink-0 ${
                          isAuto
                            ? 'bg-green-500/15 text-green-400 border border-green-500/25'
                            : isSetUp
                              ? 'bg-blue-500/15 text-blue-400 border border-blue-500/25'
                              : 'bg-amber-500/15 text-amber-400 border border-amber-500/25'
                        }`}
                      >
                        {isAuto
                          ? RECEIPTS.ITEM_SETUP.STATUS_AUTO
                          : isSetUp
                            ? RECEIPTS.ITEM_SETUP.STATUS_SET_UP
                            : RECEIPTS.ITEM_SETUP.STATUS_UNASSIGNED}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Configure items button */}
          {lineItemConfigs.length > 0 && (
            <button
              type="button"
              onClick={() => setShowItemModal(true)}
              className={`w-full py-3 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2 ${
                unassignedCount > 0
                  ? 'bg-gradient-to-r from-amber-500/20 to-orange-500/20 border border-amber-500/40 text-amber-300 hover:from-amber-500/30 hover:to-orange-500/30 hover:text-white'
                  : 'bg-white/5 border border-white/10 text-white/60 hover:text-white hover:border-white/20'
              }`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                <path fillRule="evenodd" d="M8.34 1.804A1 1 0 019.32 1h1.36a1 1 0 01.98.804l.295 1.473c.497.144.971.342 1.416.587l1.25-.834a1 1 0 011.262.125l.962.962a1 1 0 01.125 1.262l-.834 1.25c.245.445.443.919.587 1.416l1.473.294a1 1 0 01.804.98v1.361a1 1 0 01-.804.98l-1.473.295a6.95 6.95 0 01-.587 1.416l.834 1.25a1 1 0 01-.125 1.262l-.962.962a1 1 0 01-1.262.125l-1.25-.834a6.953 6.953 0 01-1.416.587l-.294 1.473a1 1 0 01-.98.804H9.32a1 1 0 01-.98-.804l-.295-1.473a6.957 6.957 0 01-1.416-.587l-1.25.834a1 1 0 01-1.262-.125l-.962-.962a1 1 0 01-.125-1.262l.834-1.25a6.957 6.957 0 01-.587-1.416l-1.473-.294A1 1 0 011 10.68V9.32a1 1 0 01.804-.98l1.473-.295c.144-.497.342-.971.587-1.416l-.834-1.25a1 1 0 01.125-1.262l.962-.962A1 1 0 015.379 3.03l1.25.834a6.957 6.957 0 011.416-.587l.294-1.473zM13 10a3 3 0 11-6 0 3 3 0 016 0z" clipRule="evenodd" />
              </svg>
              {RECEIPTS.ACTIONS.CONFIGURE_ITEMS}
              {unassignedCount > 0 && (
                <span className="ml-1 px-1.5 py-0.5 rounded-full bg-amber-500/30 text-amber-300 text-xs">
                  {RECEIPTS.ACTIONS.CONFIGURE_ITEMS_HINT(unassignedCount)}
                </span>
              )}
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
              disabled={saving}
              className="flex-1 py-2.5 rounded-lg bg-gradient-to-r from-indigo-500 to-violet-600 text-white font-semibold hover:from-indigo-400 hover:to-violet-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all text-sm"
            >
              {saving ? RECEIPTS.ACTIONS.SAVING : RECEIPTS.ACTIONS.SAVE}
            </button>
          </div>
        </div>
      )}

      {/* Item setup modal */}
      {showItemModal && (
        <ItemSetupModal
          configs={lineItemConfigs}
          categories={categories}
          allMembers={allMembers}
          onDone={handleModalDone}
          onClose={() => setShowItemModal(false)}
        />
      )}
    </div>
  )
}

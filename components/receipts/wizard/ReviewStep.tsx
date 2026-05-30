'use client'

import { RECEIPTS } from '@/locales/en'
import LineItemsAccordion from '@/components/receipts/LineItemsAccordion'
import type { ReceiptAnalysisLineItem } from '@/lib/types/receipts'

interface ReviewStepProps {
  analyzing: boolean
  analysisError: string
  merchantName: string
  receiptDate: string
  total: string
  tax: string
  lineItems: ReceiptAnalysisLineItem[]
  isManualMode: boolean
  onMerchantChange: (v: string) => void
  onDateChange: (v: string) => void
  onTotalChange: (v: string) => void
  onTaxChange: (v: string) => void
  onLineItemsChange: (items: ReceiptAnalysisLineItem[]) => void
  onBack: () => void
  onNext: () => void
}

export default function ReviewStep({
  analyzing,
  analysisError,
  merchantName,
  receiptDate,
  total,
  tax,
  lineItems,
  isManualMode,
  onMerchantChange,
  onDateChange,
  onTotalChange,
  onTaxChange,
  onLineItemsChange,
  onBack,
  onNext,
}: ReviewStepProps) {
  function addLineItem() {
    onLineItemsChange([
      ...lineItems,
      { description: '', amount: 0, quantity: null },
    ])
  }

  function removeLineItem(index: number) {
    onLineItemsChange(lineItems.filter((_, i) => i !== index))
  }

  function updateLineItem(index: number, field: 'description' | 'amount', raw: string) {
    onLineItemsChange(
      lineItems.map((item, i) => {
        if (i !== index) return item
        if (field === 'description') return { ...item, description: raw }
        const num = parseFloat(raw)
        return { ...item, amount: isNaN(num) ? 0 : num }
      }),
    )
  }

  return (
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
                onChange={(e) => onMerchantChange(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white placeholder-white/30 focus:outline-none focus:border-indigo-500"
                placeholder="e.g. Whole Foods"
              />
            </div>

            <div>
              <label className="block text-xs text-white/50 mb-1">{RECEIPTS.LABELS.DATE}</label>
              <input
                type="date"
                value={receiptDate}
                onChange={(e) => onDateChange(e.target.value)}
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
                  onChange={(e) => onTotalChange(e.target.value)}
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
                  onChange={(e) => onTaxChange(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                  placeholder="0.00"
                />
              </div>
            </div>

            {isManualMode ? (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs text-white/50">{RECEIPTS.LABELS.LINE_ITEMS}</label>
                </div>
                {lineItems.length > 0 && (
                  <div className="flex flex-col gap-2 mb-2">
                    {lineItems.map((item, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <input
                          type="text"
                          value={item.description}
                          onChange={(e) => updateLineItem(i, 'description', e.target.value)}
                          placeholder="Item name"
                          className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white placeholder-white/30 text-sm focus:outline-none focus:border-indigo-500"
                        />
                        <div className="flex items-center gap-1 shrink-0">
                          <span className="text-xs text-white/40">$</span>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={item.amount || ''}
                            onChange={(e) => updateLineItem(i, 'amount', e.target.value)}
                            placeholder="0.00"
                            className="w-20 bg-white/5 border border-white/10 rounded-lg px-2 py-2 text-white text-sm text-right focus:outline-none focus:border-indigo-500"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => removeLineItem(i)}
                          aria-label={RECEIPTS.ACTIONS.REMOVE_LINE_ITEM}
                          className="rounded p-1 text-white/20 hover:text-red-400 transition-colors"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="h-4 w-4" aria-hidden="true">
                            <path d="M5.28 4.22a.75.75 0 0 0-1.06 1.06L6.94 8l-2.72 2.72a.75.75 0 1 0 1.06 1.06L8 9.06l2.72 2.72a.75.75 0 1 0 1.06-1.06L9.06 8l2.72-2.72a.75.75 0 0 0-1.06-1.06L8 6.94 5.28 4.22Z" />
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <button
                  type="button"
                  onClick={addLineItem}
                  className="text-sm text-indigo-400 hover:text-indigo-300 transition-colors"
                >
                  {RECEIPTS.ACTIONS.ADD_LINE_ITEM}
                </button>
                {lineItems.length === 0 && (
                  <p className="text-xs text-white/30 mt-1">{RECEIPTS.LABELS.MANUAL_ITEMS_HINT}</p>
                )}
              </div>
            ) : (
              <LineItemsAccordion items={lineItems} />
            )}
          </div>

          <div className="flex gap-3 mt-2">
            <button
              type="button"
              onClick={onBack}
              className="flex-1 py-2.5 rounded-lg border border-white/10 text-white/60 hover:text-white hover:border-white/20 transition-colors text-sm"
            >
              {isManualMode ? '← Back' : RECEIPTS.ACTIONS.RETAKE}
            </button>
            <button
              type="button"
              onClick={onNext}
              disabled={!total}
              className="flex-1 py-2.5 rounded-lg bg-indigo-500 text-white font-semibold hover:bg-indigo-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm"
            >
              Next →
            </button>
          </div>
        </>
      )}
    </div>
  )
}

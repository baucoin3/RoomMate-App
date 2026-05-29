'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ROUTES } from '@/lib/constants/routes'
import { RECEIPTS, GUESTS } from '@/locales/en'
import type { ReceiptDetail } from '@/lib/types/receipts'

interface ReceiptDetailClientProps {
  receipt: ReceiptDetail
  householdId: string
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount)
}

function formatDate(dateStr: string): string {
  if (!dateStr) return '—'
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={2}
      stroke="currentColor"
      className={`h-4 w-4 transition-transform duration-200 text-white/40 ${open ? 'rotate-180' : ''}`}
      aria-hidden="true"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
    </svg>
  )
}

export default function ReceiptDetailClient({ receipt, householdId }: ReceiptDetailClientProps) {
  const [imageOpen, setImageOpen] = useState(false)

  return (
    <div className="flex flex-col pt-1 pb-24 md:pb-4">
      <Link
        href={ROUTES.HOUSEHOLD_RECEIPTS(householdId)}
        className="text-sm text-white/60 hover:text-white mb-6 inline-block transition-colors"
      >
        {RECEIPTS.DETAIL.BACK}
      </Link>

      <div className="mb-6">
        <h1 className="text-xl font-bold text-white">
          {receipt.merchantName || RECEIPTS.DETAIL.TITLE}
        </h1>
        <p className="text-sm text-white/50 mt-1">{formatDate(receipt.receiptDate)}</p>
        {receipt.categoryName && (
          <span className="inline-block mt-2 text-xs px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
            {receipt.categoryName}
          </span>
        )}
      </div>

      <div className="bg-[#1c1c24] border border-white/5 rounded-xl p-4 mb-4">
        <div className="flex items-center justify-between">
          <p className="text-sm text-white/60">{RECEIPTS.LABELS.TOTAL}</p>
          <p className="text-white font-mono font-semibold">{formatCurrency(receipt.rawTotal)}</p>
        </div>
      </div>

      <div className="bg-[#1c1c24] border border-white/5 rounded-xl overflow-hidden mb-4">
        {receipt.imageUrl ? (
          <>
            <button
              type="button"
              onClick={() => setImageOpen((prev) => !prev)}
              className="w-full flex items-center justify-between px-4 py-3 text-left"
              aria-expanded={imageOpen}
            >
              <span className="text-sm font-semibold text-white">{RECEIPTS.DETAIL.IMAGE_SECTION}</span>
              <ChevronIcon open={imageOpen} />
            </button>
            {imageOpen && (
              <div className="px-4 pb-4 border-t border-white/5 pt-3">
                <img
                  src={receipt.imageUrl}
                  alt={receipt.merchantName}
                  className="w-full object-contain max-h-96 rounded-lg"
                />
              </div>
            )}
          </>
        ) : (
          <p className="px-4 py-3 text-sm text-white/40">{RECEIPTS.DETAIL.NO_IMAGE}</p>
        )}
      </div>

      {receipt.lineItems.length > 0 && (
        <div className="bg-[#1c1c24] border border-white/5 rounded-xl p-4 mb-4">
          <h2 className="text-xs font-semibold text-white/40 uppercase tracking-wide mb-3">
            {RECEIPTS.DETAIL.LINE_ITEMS}
          </h2>
          <table className="w-full text-sm">
            <tbody>
              {receipt.lineItems.map((item) => (
                <tr key={item.id} className="border-t border-white/5 first:border-t-0">
                  <td className="py-2 text-white/80">
                    {item.description}
                    {item.quantity !== null && (
                      <span className="text-white/40 text-xs ml-2">
                        {RECEIPTS.DETAIL.QUANTITY_ABBR} {item.quantity}
                      </span>
                    )}
                  </td>
                  <td className="py-2 text-right text-white font-mono">
                    {formatCurrency(item.amount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {receipt.splits.length > 0 && (
        <div className="bg-[#1c1c24] border border-white/5 rounded-xl p-4">
          <h2 className="text-xs font-semibold text-white/40 uppercase tracking-wide mb-3">
            {RECEIPTS.DETAIL.SPLITS}
          </h2>
          <div className="flex flex-col gap-2">
            {receipt.splits.map((split, i) => (
              <div key={`${split.participantType}-${split.displayName}-${i}`} className="flex justify-between items-center">
                <p className="text-white/80 text-sm flex items-center gap-1.5">
                  {split.displayName}
                  {split.participantType === 'guest' && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-violet-500/20 text-violet-300">
                      {GUESTS.SPLIT_LABEL.GUEST_BADGE}
                    </span>
                  )}
                </p>
                <p className="text-white font-mono text-sm">{formatCurrency(split.amount)}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

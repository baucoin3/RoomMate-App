'use client'

import { useState } from 'react'
import Image from 'next/image'
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

async function downloadReceiptImage(imageUrl: string, merchantName: string) {
  const res = await fetch(imageUrl)
  const blob = await res.blob()
  const objectUrl = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = objectUrl
  a.download = `receipt-${merchantName || 'image'}.${blob.type.split('/')[1] ?? 'jpg'}`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(objectUrl)
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
              <div className="px-4 pb-4 border-t border-white/5 pt-3 flex flex-col gap-3">
                <div className="relative w-full max-h-96 min-h-[12rem] rounded-lg overflow-hidden">
                  <Image
                    src={receipt.imageUrl}
                    alt={receipt.merchantName}
                    fill
                    sizes="(max-width: 768px) 100vw, 640px"
                    className="object-contain"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => downloadReceiptImage(receipt.imageUrl!, receipt.merchantName)}
                  className="self-end flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-white/70 transition-colors hover:bg-white/10 hover:text-white"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5" aria-hidden="true">
                    <path d="M8.75 2.75a.75.75 0 0 0-1.5 0v5.69L5.03 6.22a.75.75 0 0 0-1.06 1.06l3.5 3.5a.75.75 0 0 0 1.06 0l3.5-3.5a.75.75 0 0 0-1.06-1.06L8.75 8.44V2.75Z" />
                    <path d="M3.5 9.75a.75.75 0 0 0-1.5 0v1.5A2.75 2.75 0 0 0 4.75 14h6.5A2.75 2.75 0 0 0 14 11.25v-1.5a.75.75 0 0 0-1.5 0v1.5c0 .69-.56 1.25-1.25 1.25h-6.5c-.69 0-1.25-.56-1.25-1.25v-1.5Z" />
                  </svg>
                  {RECEIPTS.DETAIL.DOWNLOAD_IMAGE}
                </button>
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
          <div className="flex flex-col divide-y divide-white/5">
            {receipt.lineItems.map((item) => {
              const splitPreview = receipt.expenseTotal > 0
                ? receipt.splits.map((s) => ({
                    name: s.displayName,
                    amount: (s.amount / receipt.expenseTotal) * item.amount,
                    isGuest: s.participantType === 'guest',
                  }))
                : []
              return (
                <div key={item.id} className="py-2.5 first:pt-0 last:pb-0">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm text-white/80">
                      {item.description}
                      {item.quantity !== null && (
                        <span className="text-white/40 text-xs ml-2">
                          {RECEIPTS.DETAIL.QUANTITY_ABBR} {item.quantity}
                        </span>
                      )}
                    </p>
                    <p className="text-sm text-white font-mono whitespace-nowrap">
                      {formatCurrency(item.amount)}
                    </p>
                  </div>
                  {splitPreview.length > 0 && (
                    <p className="text-xs text-white/35 mt-0.5">
                      {splitPreview.map((s, i) => (
                        <span key={s.name}>
                          {i > 0 && <span className="mx-1 text-white/20">·</span>}
                          {s.name}{s.isGuest ? ' (guest)' : ''} {formatCurrency(s.amount)}
                        </span>
                      ))}
                    </p>
                  )}
                </div>
              )
            })}
          </div>
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

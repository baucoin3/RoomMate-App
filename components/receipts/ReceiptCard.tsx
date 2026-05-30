'use client'

import Link from 'next/link'
import { ROUTES } from '@/lib/constants/routes'
import type { ReceiptLedgerItem } from '@/lib/types/receipts'

interface ReceiptCardProps {
  receipt: ReceiptLedgerItem
  householdId: string
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—'
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function formatCurrency(amount: number | null): string {
  if (amount === null) return '—'
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount)
}

export default function ReceiptCard({ receipt, householdId }: ReceiptCardProps) {
  return (
    <Link href={ROUTES.RECEIPT_DETAIL(householdId, receipt.id)} className="block">
      <div className="bg-[#1c1c24] border border-white/5 rounded-xl p-4 flex gap-4 hover:border-white/10 hover:ring-2 hover:ring-primary/40 cursor-pointer transition-all">
        <div className="flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden bg-white/5 flex items-center justify-center">
          {receipt.image_url ? (
            <img
              src={receipt.image_url}
              alt={receipt.merchant_name ?? 'Receipt'}
              className="w-full h-full object-cover"
            />
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-8 h-8 text-white/20" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 14.25l6-6m4.5-3.493V21.75l-3.75-1.5-3.75 1.5-3.75-1.5-3.75 1.5V4.757c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0111.186 0c1.1.128 1.907 1.077 1.907 2.185z" />
            </svg>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <p className="font-semibold text-white truncate">
              {receipt.merchant_name ?? 'Unknown merchant'}
            </p>
            <p className="text-white font-mono font-semibold whitespace-nowrap">
              {formatCurrency(receipt.raw_total)}
            </p>
          </div>

          <p className="text-sm text-white/50 mt-0.5">{formatDate(receipt.receipt_date)}</p>

          {receipt.category_name && (
            <span className="inline-block mt-2 text-xs px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
              {receipt.category_name}
            </span>
          )}
        </div>
      </div>
    </Link>
  )
}

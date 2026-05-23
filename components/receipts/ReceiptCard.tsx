'use client'

import type { ReceiptLedgerItem } from '@/lib/types/receipts'

interface ReceiptCardProps {
  receipt: ReceiptLedgerItem
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

export default function ReceiptCard({ receipt }: ReceiptCardProps) {
  return (
    <div className="bg-[#1c1c24] border border-white/5 rounded-xl p-4 flex gap-4 hover:border-white/10 transition-colors">
      <div className="flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden bg-white/5">
        <img
          src={receipt.image_url}
          alt={receipt.merchant_name ?? 'Receipt'}
          className="w-full h-full object-cover"
        />
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
  )
}

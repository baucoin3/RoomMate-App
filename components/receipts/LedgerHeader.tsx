'use client'

import { RECEIPTS } from '@/locales/en'
import type { ReceiptLedgerItem } from '@/lib/types/receipts'

interface LedgerHeaderProps {
  receipts: ReceiptLedgerItem[]
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount)
}

export default function LedgerHeader({ receipts }: LedgerHeaderProps) {
  const totalAmount = receipts.reduce((sum, r) => sum + (r.raw_total ?? 0), 0)

  const byMerchant = receipts.reduce<Record<string, number>>((acc, r) => {
    const key = r.merchant_name ?? 'Unknown merchant'
    acc[key] = (acc[key] ?? 0) + (r.raw_total ?? 0)
    return acc
  }, {})

  return (
    <div className="bg-[#1c1c24] border border-white/5 rounded-xl p-5 mb-6">
      <div className="flex flex-wrap gap-6">
        <div>
          <p className="text-xs text-white/40 uppercase tracking-wide mb-1">
            {RECEIPTS.LABELS.TOTAL_RECEIPTS}
          </p>
          <p className="text-2xl font-bold text-white">{receipts.length}</p>
        </div>

        <div>
          <p className="text-xs text-white/40 uppercase tracking-wide mb-1">
            {RECEIPTS.LABELS.TOTAL}
          </p>
          <p className="text-2xl font-bold text-white">{formatCurrency(totalAmount)}</p>
        </div>
      </div>

      {Object.keys(byMerchant).length > 0 && (
        <div className="mt-4 pt-4 border-t border-white/5">
          <div className="flex flex-wrap gap-2">
            {Object.entries(byMerchant).map(([name, amount]) => (
              <div
                key={name}
                className="flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/5"
              >
                <span className="text-xs text-white/60">{name}</span>
                <span className="text-xs font-mono text-white/80">{formatCurrency(amount)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

'use client'

import { useState } from 'react'
import { RECEIPTS } from '@/locales/en'

interface LineItem {
  description: string
  amount: number
  quantity: number
}

interface LineItemsAccordionProps {
  items: LineItem[]
}

export default function LineItemsAccordion({ items }: LineItemsAccordionProps) {
  const [open, setOpen] = useState(false)

  if (items.length === 0) return null

  return (
    <div className="rounded-lg border border-white/10 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-white/70 hover:text-white hover:bg-white/5 transition-colors"
        aria-expanded={open}
      >
        <span>{RECEIPTS.LABELS.LINE_ITEMS} ({items.length})</span>
        <span className="text-xs text-white/40">
          {open ? RECEIPTS.LABELS.HIDE_LINE_ITEMS : RECEIPTS.LABELS.SHOW_LINE_ITEMS}
        </span>
      </button>

      {open && (
        <div className="border-t border-white/10">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-white/40 text-xs uppercase tracking-wide">
                <th className="px-4 py-2 text-left">{RECEIPTS.LABELS.DESCRIPTION}</th>
                <th className="px-4 py-2 text-right">Qty</th>
                <th className="px-4 py-2 text-right">{RECEIPTS.LABELS.AMOUNT}</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, idx) => (
                <tr
                  key={idx}
                  className="border-t border-white/5 hover:bg-white/5 transition-colors"
                >
                  <td className="px-4 py-2 text-white/80">{item.description}</td>
                  <td className="px-4 py-2 text-right text-white/60">{item.quantity}</td>
                  <td className="px-4 py-2 text-right text-white font-mono">
                    ${item.amount.toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

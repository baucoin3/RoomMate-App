'use client'

import type { HouseholdGuest } from '@/lib/types/guests'

interface Props {
  guest: HouseholdGuest
  onRemove: (guestId: string) => void
}

export default function GuestChip({ guest, onRemove }: Props) {
  const initial = guest.name[0]?.toUpperCase() ?? '?'

  return (
    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-indigo-500/15 border border-indigo-500/30 group">
      <div className="w-5 h-5 rounded-full bg-indigo-500/30 flex items-center justify-center shrink-0">
        <span className="text-[10px] font-semibold text-indigo-200">{initial}</span>
      </div>
      <span className="text-sm text-indigo-200 font-medium max-w-[120px] truncate" title={guest.email ?? undefined}>
        {guest.name}
      </span>
      <button
        type="button"
        onClick={() => onRemove(guest.id)}
        aria-label={`Remove ${guest.name}`}
        className="ml-0.5 w-4 h-4 flex items-center justify-center rounded-full text-indigo-300/60 hover:text-indigo-100 hover:bg-indigo-500/30 transition-colors"
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-3 h-3">
          <path d="M5.28 4.22a.75.75 0 00-1.06 1.06L6.94 8l-2.72 2.72a.75.75 0 101.06 1.06L8 9.06l2.72 2.72a.75.75 0 101.06-1.06L9.06 8l2.72-2.72a.75.75 0 00-1.06-1.06L8 6.94 5.28 4.22z" />
        </svg>
      </button>
    </div>
  )
}

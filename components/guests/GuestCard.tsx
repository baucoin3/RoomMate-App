'use client'

import { GUESTS } from '@/locales/en'
import type { HouseholdGuest } from '@/lib/types/guests'

interface Props {
  guest: HouseholdGuest
  onEdit: (guest: HouseholdGuest) => void
  onDelete: (guest: HouseholdGuest) => void
}

function expiryLabel(expiresAt: string | null): string {
  if (!expiresAt) return GUESTS.LABELS.PERMANENT
  const d = new Date(expiresAt)
  const now = new Date()
  if (d < now) return `Expired ${d.toLocaleDateString()}`
  return `${GUESTS.LABELS.EXPIRES} ${d.toLocaleDateString()}`
}

export default function GuestCard({ guest, onEdit, onDelete }: Props) {
  const initials = guest.name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('')

  return (
    <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white/[0.03] border border-white/8 hover:border-white/15 transition-colors">
      <div className="w-9 h-9 rounded-full bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center shrink-0">
        <span className="text-xs font-semibold text-indigo-300">{initials}</span>
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-white/90 truncate">{guest.name}</p>
        <p className="text-xs text-white/40 mt-0.5">
          {guest.email ? (
            <span className="text-white/50">{guest.email}</span>
          ) : (
            <span className="text-white/25">No email</span>
          )}
          <span className="mx-1.5 text-white/15">·</span>
          <span>{expiryLabel(guest.expires_at)}</span>
        </p>
      </div>

      <div className="flex items-center gap-1 shrink-0">
        <button
          type="button"
          onClick={() => onEdit(guest)}
          className="px-2.5 py-1 rounded-lg text-xs text-white/50 hover:text-white/80 hover:bg-white/5 transition-colors"
        >
          {GUESTS.ACTIONS.EDIT}
        </button>
        <button
          type="button"
          onClick={() => onDelete(guest)}
          className="px-2.5 py-1 rounded-lg text-xs text-red-400/60 hover:text-red-400 hover:bg-red-500/10 transition-colors"
        >
          {GUESTS.ACTIONS.DELETE}
        </button>
      </div>
    </div>
  )
}

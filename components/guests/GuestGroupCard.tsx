'use client'

import { useState } from 'react'
import { GUESTS } from '@/locales/en'
import type { HouseholdGuestGroup } from '@/lib/types/guests'

interface Props {
  group: HouseholdGuestGroup
  onEdit: (group: HouseholdGuestGroup) => void
  onDelete: (group: HouseholdGuestGroup) => void
}

function expiryLabel(expiresAt: string | null): string {
  if (!expiresAt) return GUESTS.LABELS.PERMANENT
  const d = new Date(expiresAt)
  const now = new Date()
  if (d < now) return `Expired ${d.toLocaleDateString()}`
  return `${GUESTS.LABELS.EXPIRES} ${d.toLocaleDateString()}`
}

export default function GuestGroupCard({ group, onEdit, onDelete }: Props) {
  const [expanded, setExpanded] = useState(false)
  const memberCount = group.members?.length ?? 0

  return (
    <div className="rounded-xl bg-white/[0.03] border border-white/8 overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-3">
        <div className="w-9 h-9 rounded-full bg-violet-500/20 border border-violet-500/30 flex items-center justify-center shrink-0">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 text-violet-300">
            <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
          </svg>
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-white/90 truncate">{group.name}</p>
          <p className="text-xs text-white/40 mt-0.5">
            {memberCount} {memberCount === 1 ? 'member' : 'members'}
            <span className="mx-1.5 text-white/15">·</span>
            {expiryLabel(group.expires_at)}
          </p>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {memberCount > 0 && (
            <button
              type="button"
              onClick={() => setExpanded((e) => !e)}
              className="px-2.5 py-1 rounded-lg text-xs text-white/40 hover:text-white/70 hover:bg-white/5 transition-colors"
            >
              {expanded ? 'Hide' : 'Members'}
            </button>
          )}
          <button
            type="button"
            onClick={() => onEdit(group)}
            className="px-2.5 py-1 rounded-lg text-xs text-white/50 hover:text-white/80 hover:bg-white/5 transition-colors"
          >
            {GUESTS.ACTIONS.EDIT}
          </button>
          <button
            type="button"
            onClick={() => onDelete(group)}
            className="px-2.5 py-1 rounded-lg text-xs text-red-400/60 hover:text-red-400 hover:bg-red-500/10 transition-colors"
          >
            {GUESTS.ACTIONS.DELETE}
          </button>
        </div>
      </div>

      {expanded && memberCount > 0 && (
        <div className="px-4 pb-3 border-t border-white/5 pt-2 flex flex-col gap-1.5">
          {group.members?.map((m) => (
            <div key={m.id} className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-indigo-500/15 flex items-center justify-center shrink-0">
                <span className="text-[10px] font-semibold text-indigo-300">
                  {m.name[0]?.toUpperCase()}
                </span>
              </div>
              <span className="text-xs text-white/70 truncate">{m.name}</span>
              {m.email && (
                <span className="text-xs text-white/35 truncate ml-auto">{m.email}</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

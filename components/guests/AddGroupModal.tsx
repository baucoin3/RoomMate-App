'use client'

import { useState } from 'react'
import { GUESTS } from '@/locales/en'
import GuestChip from '@/components/receipts/GuestChip'
import type { HouseholdGuest, HouseholdGuestGroup } from '@/lib/types/guests'

interface Props {
  group?: HouseholdGuestGroup
  availableGuests: HouseholdGuest[]
  onSave: (data: {
    name: string
    expires_at: string | null
    guest_ids: string[]
  }) => Promise<void>
  onClose: () => void
}

export default function AddGroupModal({ group, availableGuests, onSave, onClose }: Props) {
  const [name, setName] = useState(group?.name ?? '')
  const [expiryMode, setExpiryMode] = useState<'none' | 'custom'>(
    group?.expires_at ? 'custom' : 'none',
  )
  const [expiryDate, setExpiryDate] = useState(
    group?.expires_at ? group.expires_at.slice(0, 10) : '',
  )
  const [selectedMembers, setSelectedMembers] = useState<HouseholdGuest[]>(group?.members ?? [])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const selectedIds = new Set(selectedMembers.map((g) => g.id))
  const unselectedGuests = availableGuests.filter((g) => !selectedIds.has(g.id))

  function addMember(guestId: string) {
    const guest = availableGuests.find((g) => g.id === guestId)
    if (guest && !selectedIds.has(guest.id)) {
      setSelectedMembers((prev) => [...prev, guest].sort((a, b) => a.name.localeCompare(b.name)))
    }
  }

  function removeMember(guestId: string) {
    setSelectedMembers((prev) => prev.filter((g) => g.id !== guestId))
  }

  async function handleSave() {
    if (!name.trim()) {
      setError(GUESTS.ERRORS.GROUP_NAME_REQUIRED)
      return
    }
    setSaving(true)
    setError('')
    try {
      await onSave({
        name: name.trim(),
        expires_at: expiryMode === 'custom' && expiryDate ? `${expiryDate}T23:59:59Z` : null,
        guest_ids: selectedMembers.map((g) => g.id),
      })
      onClose()
    } catch {
      setError(GUESTS.ERRORS.GROUP_SAVE_FAILED)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md bg-[#1a1a2e] border border-white/10 rounded-t-2xl sm:rounded-2xl shadow-2xl p-5 flex flex-col gap-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h2 className="text-white font-semibold text-base">
            {group ? GUESTS.ACTIONS.EDIT : GUESTS.ACTIONS.ADD_GROUP}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-full text-white/40 hover:text-white hover:bg-white/10 transition-colors"
          >
            ✕
          </button>
        </div>

        <div className="flex flex-col gap-3">
          <div>
            <label className="block text-xs text-white/50 mb-1">{GUESTS.LABELS.GROUP_NAME}</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={GUESTS.LABELS.GROUP_NAME_PLACEHOLDER}
              autoFocus
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-white placeholder-white/30 focus:outline-none focus:border-indigo-500 transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs text-white/50 mb-1">{GUESTS.LABELS.GROUP_MEMBERS}</label>
            {availableGuests.length === 0 ? (
              <p className="text-sm text-white/40 px-1">{GUESTS.LABELS.NO_GUESTS_FOR_GROUP}</p>
            ) : (
              <>
                <select
                  value=""
                  onChange={(e) => addMember(e.target.value)}
                  disabled={unselectedGuests.length === 0}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-white focus:outline-none focus:border-indigo-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  aria-label={GUESTS.LABELS.ADD_GROUP_MEMBER}
                >
                  <option value="" className="bg-[#1a1a2e]">
                    {GUESTS.LABELS.ADD_GROUP_MEMBER_PLACEHOLDER}
                  </option>
                  {unselectedGuests.map((g) => (
                    <option key={g.id} value={g.id} className="bg-[#1a1a2e]">
                      {g.name}
                    </option>
                  ))}
                </select>
                {selectedMembers.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {selectedMembers.map((g) => (
                      <GuestChip key={g.id} guest={g} onRemove={removeMember} />
                    ))}
                  </div>
                )}
              </>
            )}
          </div>

          <div>
            <label className="block text-xs text-white/50 mb-1.5">{GUESTS.LABELS.EXPIRY}</label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setExpiryMode('none')}
                className={`flex-1 py-2 rounded-lg text-sm border transition-all ${
                  expiryMode === 'none'
                    ? 'bg-indigo-500/20 border-indigo-500/50 text-indigo-200'
                    : 'border-white/10 text-white/50 hover:text-white/80 hover:border-white/20'
                }`}
              >
                {GUESTS.LABELS.EXPIRY_NONE}
              </button>
              <button
                type="button"
                onClick={() => setExpiryMode('custom')}
                className={`flex-1 py-2 rounded-lg text-sm border transition-all ${
                  expiryMode === 'custom'
                    ? 'bg-indigo-500/20 border-indigo-500/50 text-indigo-200'
                    : 'border-white/10 text-white/50 hover:text-white/80 hover:border-white/20'
                }`}
              >
                {GUESTS.LABELS.EXPIRY_CUSTOM}
              </button>
            </div>
            {expiryMode === 'custom' && (
              <input
                type="date"
                value={expiryDate}
                onChange={(e) => setExpiryDate(e.target.value)}
                className="mt-2 w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-white focus:outline-none focus:border-indigo-500 transition-colors"
              />
            )}
          </div>
        </div>

        {error && (
          <p className="text-red-400 text-sm" role="alert">{error}</p>
        )}

        <div className="flex gap-3 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 rounded-lg border border-white/10 text-white/60 hover:text-white hover:border-white/20 transition-colors text-sm"
          >
            {GUESTS.ACTIONS.CANCEL}
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || !name.trim()}
            className="flex-1 py-2.5 rounded-lg bg-gradient-to-r from-indigo-500 to-violet-600 text-white font-semibold hover:from-indigo-400 hover:to-violet-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all text-sm"
          >
            {saving ? GUESTS.ACTIONS.SAVING : GUESTS.ACTIONS.SAVE}
          </button>
        </div>
      </div>
    </div>
  )
}

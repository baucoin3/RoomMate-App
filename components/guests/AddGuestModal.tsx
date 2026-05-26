'use client'

import { useState } from 'react'
import { GUESTS } from '@/locales/en'
import type { HouseholdGuest } from '@/lib/types/guests'

interface Props {
  guest?: HouseholdGuest
  onSave: (data: { name: string; email: string | null; expires_at: string | null }) => Promise<void>
  onClose: () => void
}

export default function AddGuestModal({ guest, onSave, onClose }: Props) {
  const [name, setName] = useState(guest?.name ?? '')
  const [email, setEmail] = useState(guest?.email ?? '')
  const [expiryMode, setExpiryMode] = useState<'none' | 'custom'>(
    guest?.expires_at ? 'custom' : 'none',
  )
  const [expiryDate, setExpiryDate] = useState(
    guest?.expires_at ? guest.expires_at.slice(0, 10) : '',
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleSave() {
    if (!name.trim()) {
      setError(GUESTS.ERRORS.NAME_REQUIRED)
      return
    }
    setSaving(true)
    setError('')
    try {
      await onSave({
        name: name.trim(),
        email: email.trim() || null,
        expires_at: expiryMode === 'custom' && expiryDate ? `${expiryDate}T23:59:59Z` : null,
      })
      onClose()
    } catch {
      setError(GUESTS.ERRORS.SAVE_FAILED)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md bg-[#1a1a2e] border border-white/10 rounded-t-2xl sm:rounded-2xl shadow-2xl p-5 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-white font-semibold text-base">
            {guest ? GUESTS.ACTIONS.EDIT : GUESTS.ACTIONS.ADD_GUEST}
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
            <label className="block text-xs text-white/50 mb-1">{GUESTS.LABELS.NAME}</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={GUESTS.LABELS.NAME_PLACEHOLDER}
              autoFocus
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-white placeholder-white/30 focus:outline-none focus:border-indigo-500 transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs text-white/50 mb-1">{GUESTS.LABELS.EMAIL_OPTIONAL}</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={GUESTS.LABELS.EMAIL_PLACEHOLDER}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-white placeholder-white/30 focus:outline-none focus:border-indigo-500 transition-colors"
            />
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
            {saving ? 'Saving…' : GUESTS.ACTIONS.SAVE}
          </button>
        </div>
      </div>
    </div>
  )
}

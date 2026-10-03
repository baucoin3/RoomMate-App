'use client'

import { useState, useEffect } from 'react'
import { SHOPPING } from '@/locales/en'
import { apiClient, getErrorMessage } from '@/lib/api/client'
import type { CommonShoppingItem } from '@/lib/types/shopping'
import type { HouseholdItemSuggestion } from '@/lib/types/shopping'

const SWATCH_HUES = [0, 30, 45, 80, 120, 150, 175, 210, 245, 270, 289, 330]
const SWATCHES = SWATCH_HUES.map((h) => `oklch(0.734 0.125 ${h})`)

interface AddCommonItemModalProps {
  open: boolean
  householdId: string
  onClose: () => void
  onSaved: (item: CommonShoppingItem) => void
}

export default function AddCommonItemModal({ open, householdId, onClose, onSaved }: AddCommonItemModalProps) {
  const [name, setName] = useState('')
  const [color, setColor] = useState(SWATCHES[10])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [catalog, setCatalog] = useState<HouseholdItemSuggestion[]>([])

  useEffect(() => {
    if (!open) return
    setName('')
    setColor(SWATCHES[10])
    setError('')
    apiClient
      .get<{ data: HouseholdItemSuggestion[] }>(`/api/household-items?householdId=${householdId}`)
      .then((res) => setCatalog(res.data.data ?? []))
      .catch(() => setCatalog([]))
  }, [open, householdId])

  async function handleSave() {
    const trimmed = name.trim()
    if (!trimmed) { setError(SHOPPING.COMMON_ITEM_NAME_LABEL + ' required'); return }
    setSaving(true)
    setError('')
    try {
      const res = await apiClient.post<{ data: CommonShoppingItem }>(
        `/api/common-shopping-items?householdId=${householdId}`,
        { name: trimmed, color },
      )
      onSaved(res.data.data)
      onClose()
    } catch (err) {
      setError(getErrorMessage(err) || SHOPPING.ERRORS.CREATE_COMMON_ITEM)
    } finally {
      setSaving(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') handleSave()
    if (e.key === 'Escape') onClose()
  }

  const canSubmit = name.trim().length > 0 && color.length > 0

  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0,
          background: 'rgba(8,10,18,0.55)',
          backdropFilter: 'blur(6px)',
          zIndex: 850,
          opacity: open ? 1 : 0,
          pointerEvents: open ? 'auto' : 'none',
          transition: 'opacity .3s ease',
        }}
      />
      <div
        style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: open ? 'translate(-50%,-50%) scale(1)' : 'translate(-50%,-48%) scale(0.96)',
          opacity: open ? 1 : 0,
          pointerEvents: open ? 'auto' : 'none',
          transition: 'transform .35s cubic-bezier(.2,.85,.2,1), opacity .3s ease',
          zIndex: 860,
          width: 'min(380px, calc(100vw - 32px))',
          maxHeight: 'calc(100vh - 48px)',
          overflowY: 'auto',
          background: 'linear-gradient(160deg,#2a2c3e,#181a28)',
          border: '1px solid rgba(145,132,217,0.35)',
          borderRadius: 20,
          padding: '30px 28px 24px',
          boxShadow: '0 24px 60px rgba(0,0,0,0.6), 0 0 40px rgba(145,132,217,0.1)',
        }}
      >
        <div style={{ fontSize: 11, letterSpacing: '0.2em', color: '#75798c', textTransform: 'uppercase', marginBottom: 6 }}>
          {SHOPPING.COMMON_ITEMS_TITLE}
        </div>
        <div style={{ fontSize: 22, fontWeight: 300, color: '#e9e9ed', marginBottom: 24 }}>
          {SHOPPING.COMMON_ITEMS_ADD_BUTTON}
        </div>

        {/* Name */}
        <div style={{ marginBottom: 20 }}>
          <label style={{ fontSize: 11, letterSpacing: '0.16em', color: '#75798c', textTransform: 'uppercase', display: 'block', marginBottom: 8 }}>
            {SHOPPING.COMMON_ITEM_NAME_LABEL}
          </label>
          <input
            autoFocus={open}
            value={name}
            onChange={(e) => { setName(e.target.value); setError('') }}
            placeholder={SHOPPING.COMMON_ITEM_NAME_PLACEHOLDER}
            onKeyDown={handleKeyDown}
            style={{
              width: '100%', boxSizing: 'border-box',
              background: 'rgba(233,233,237,0.05)',
              border: `1px solid ${error ? 'rgba(220,38,38,0.5)' : 'rgba(233,233,237,0.1)'}`,
              borderRadius: 10, padding: '11px 14px',
              fontSize: 15, color: '#e9e9ed', outline: 'none',
              transition: 'border-color .2s ease',
            }}
            onFocus={(e) => { e.currentTarget.style.borderColor = '#9184d9' }}
            onBlur={(e) => { e.currentTarget.style.borderColor = error ? 'rgba(220,38,38,0.5)' : 'rgba(233,233,237,0.1)' }}
          />
          {error && <div style={{ fontSize: 12, color: '#d97777', marginTop: 5 }}>{error}</div>}
        </div>

        {/* Color swatches */}
        <div style={{ marginBottom: 20 }}>
          <label style={{ fontSize: 11, letterSpacing: '0.16em', color: '#75798c', textTransform: 'uppercase', display: 'block', marginBottom: 10 }}>
            {SHOPPING.COMMON_ITEM_COLOR_LABEL}
          </label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {SWATCHES.map((swatch) => (
              <button
                key={swatch}
                type="button"
                onClick={() => setColor(swatch)}
                style={{
                  width: 28, height: 28, borderRadius: '50%',
                  background: swatch,
                  border: color === swatch ? '2px solid #fff' : '2px solid transparent',
                  boxShadow: color === swatch ? `0 0 10px ${swatch}` : `0 0 4px ${swatch}66`,
                  cursor: 'pointer',
                  transition: 'transform .15s ease, box-shadow .15s ease',
                  transform: color === swatch ? 'scale(1.2)' : 'scale(1)',
                  flexShrink: 0,
                }}
              />
            ))}
          </div>
        </div>

        {/* Preview */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 22, padding: '10px 14px', background: 'rgba(233,233,237,0.04)', borderRadius: 10 }}>
          <div style={{ width: 10, height: 10, borderRadius: '50%', background: color, boxShadow: `0 0 8px ${color}`, flexShrink: 0 }} />
          <span style={{ fontSize: 14, color: name.trim() ? '#e9e9ed' : '#595d6c' }}>
            {name.trim() || SHOPPING.COMMON_ITEM_NAME_PLACEHOLDER}
          </span>
        </div>

        {/* Catalog picker */}
        {catalog.length > 0 && (
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 11, letterSpacing: '0.16em', color: '#75798c', textTransform: 'uppercase', marginBottom: 8 }}>
              Or pick from your catalog
            </div>
            <div style={{ maxHeight: 120, overflowY: 'auto', display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {catalog.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => { setName(item.name); setError('') }}
                  style={{
                    padding: '5px 12px',
                    borderRadius: 20,
                    background: 'rgba(233,233,237,0.06)',
                    border: '1px solid rgba(233,233,237,0.1)',
                    color: '#c4c4ce',
                    fontSize: 13,
                    cursor: 'pointer',
                    transition: 'background .15s ease',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(233,233,237,0.12)' }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(233,233,237,0.06)' }}
                >
                  {item.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            type="button"
            onClick={onClose}
            style={{ flex: 1, height: 42, borderRadius: 10, cursor: 'pointer', background: 'transparent', border: '1px solid rgba(233,233,237,0.1)', color: '#75798c', fontSize: 14 }}
          >
            {SHOPPING.COMMON_ITEM_CANCEL}
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || !canSubmit}
            style={{ flex: 1.4, height: 42, borderRadius: 10, cursor: saving || !canSubmit ? 'default' : 'pointer', background: 'rgba(145,132,217,0.14)', border: '1px solid rgba(145,132,217,0.5)', color: '#e9e9ed', fontSize: 14, opacity: saving || !canSubmit ? 0.5 : 1, transition: 'opacity .2s ease' }}
          >
            {saving ? '…' : SHOPPING.COMMON_ITEM_SAVE}
          </button>
        </div>
      </div>
    </>
  )
}

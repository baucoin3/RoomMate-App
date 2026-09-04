'use client'

import { useState } from 'react'
import { DAILY_TASKS } from '@/locales/en'

const SWATCH_HUES = [0, 30, 45, 80, 120, 150, 175, 210, 245, 270, 289, 330]
const SWATCHES = SWATCH_HUES.map((h) => `oklch(0.734 0.125 ${h})`)

interface AddCategoryModalProps {
  open: boolean
  onClose: () => void
  onSave: (name: string, color: string) => Promise<void>
}

export default function AddCategoryModal({ open, onClose, onSave }: AddCategoryModalProps) {
  const [name, setName] = useState('')
  const [color, setColor] = useState(SWATCHES[10]) // default purple
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleSave() {
    const trimmed = name.trim()
    if (!trimmed) { setError(DAILY_TASKS.ERRORS.CATEGORY_NAME_REQUIRED); return }
    setSaving(true)
    setError('')
    try {
      await onSave(trimmed, color)
      setName('')
      setColor(SWATCHES[10])
    } catch (err) {
      setError(err instanceof Error ? err.message : DAILY_TASKS.ERRORS.CATEGORY_CREATE_FAILED)
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      {/* Backdrop */}
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

      {/* Modal card */}
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
          width: 360,
          background: 'linear-gradient(160deg,#2a2c3e,#181a28)',
          border: '1px solid rgba(145,132,217,0.35)',
          borderRadius: 20,
          padding: '30px 28px 24px',
          boxShadow: '0 24px 60px rgba(0,0,0,0.6), 0 0 40px rgba(145,132,217,0.1)',
        }}
      >
        <div style={{ fontSize: 11, letterSpacing: '0.2em', color: '#75798c', textTransform: 'uppercase', marginBottom: 6 }}>
          {DAILY_TASKS.ADD_CATEGORY_EYEBROW}
        </div>
        <div style={{ fontSize: 22, fontWeight: 300, color: '#e9e9ed', marginBottom: 24 }}>
          {DAILY_TASKS.ADD_CATEGORY_HEADING}
        </div>

        {/* Name */}
        <div style={{ marginBottom: 20 }}>
          <label style={{ fontSize: 11, letterSpacing: '0.16em', color: '#75798c', textTransform: 'uppercase', display: 'block', marginBottom: 8 }}>
            {DAILY_TASKS.ADD_CATEGORY_NAME_LABEL}
          </label>
          <input
            autoFocus={open}
            value={name}
            onChange={(e) => { setName(e.target.value); setError('') }}
            placeholder={DAILY_TASKS.ADD_CATEGORY_NAME_PLACEHOLDER}
            onKeyDown={(e) => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') onClose() }}
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
        <div style={{ marginBottom: 24 }}>
          <label style={{ fontSize: 11, letterSpacing: '0.16em', color: '#75798c', textTransform: 'uppercase', display: 'block', marginBottom: 10 }}>
            {DAILY_TASKS.ADD_CATEGORY_COLOR_LABEL}
          </label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {SWATCHES.map((swatch) => (
              <button
                key={swatch}
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
            {name.trim() || 'Category name'}
          </span>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={onClose}
            style={{ flex: 1, height: 42, borderRadius: 10, cursor: 'pointer', background: 'transparent', border: '1px solid rgba(233,233,237,0.1)', color: '#75798c', fontSize: 14 }}
          >
            {DAILY_TASKS.ADD_CATEGORY_CANCEL}
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            style={{ flex: 1.4, height: 42, borderRadius: 10, cursor: saving ? 'default' : 'pointer', background: 'rgba(145,132,217,0.14)', border: '1px solid rgba(145,132,217,0.5)', color: '#e9e9ed', fontSize: 14, opacity: saving ? 0.6 : 1, transition: 'opacity .2s ease' }}
          >
            {DAILY_TASKS.ADD_CATEGORY_SAVE}
          </button>
        </div>
      </div>
    </>
  )
}

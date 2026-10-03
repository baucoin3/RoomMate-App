'use client'

import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import type { TaskCategoryRecord } from '@/lib/types/taskCategories'
import { DAILY_TASKS } from '@/locales/en'

const SWATCH_HUES = [0, 30, 45, 80, 120, 150, 175, 210, 245, 270, 289, 330]
const SWATCHES = SWATCH_HUES.map((h) => `oklch(0.734 0.125 ${h})`)

const LABEL_STYLE: React.CSSProperties = {
  fontSize: 11, letterSpacing: '0.16em', color: '#75798c',
  textTransform: 'uppercase', display: 'block', marginBottom: 8,
}

interface AddCategoryModalProps {
  open: boolean
  categories: TaskCategoryRecord[]
  onClose: () => void
  onSave: (name: string, color: string) => Promise<void>
  onDelete: (id: string) => Promise<void>
  onEdit: (id: string, name: string, color: string) => Promise<void>
}

function ColorSwatches({ selected, onSelect }: { selected: string; onSelect: (c: string) => void }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
      {SWATCHES.map((swatch) => (
        <button
          key={swatch}
          onClick={() => onSelect(swatch)}
          style={{
            width: 24, height: 24, borderRadius: '50%',
            background: swatch,
            border: selected === swatch ? '2px solid #fff' : '2px solid transparent',
            boxShadow: selected === swatch ? `0 0 10px ${swatch}` : `0 0 4px ${swatch}66`,
            cursor: 'pointer',
            transition: 'transform .15s ease, box-shadow .15s ease',
            transform: selected === swatch ? 'scale(1.2)' : 'scale(1)',
            flexShrink: 0,
          }}
        />
      ))}
    </div>
  )
}

interface EditRowState {
  name: string
  color: string
  saving: boolean
  error: string
}

function ManageTab({
  categories, onDelete, onEdit,
}: { categories: TaskCategoryRecord[]; onDelete: (id: string) => Promise<void>; onEdit: (id: string, name: string, color: string) => Promise<void> }) {
  const [editId, setEditId] = useState<string | null>(null)
  const [editState, setEditState] = useState<EditRowState>({ name: '', color: '', saving: false, error: '' })
  const [deleteError, setDeleteError] = useState<Record<string, string>>({})
  const [deleting, setDeleting] = useState<string | null>(null)

  function openEdit(cat: TaskCategoryRecord) {
    setEditId(cat.id)
    setEditState({ name: cat.name, color: cat.color, saving: false, error: '' })
  }

  async function saveEdit() {
    const trimmed = editState.name.trim()
    if (!trimmed) { setEditState((s) => ({ ...s, error: DAILY_TASKS.ERRORS.CATEGORY_NAME_REQUIRED })); return }
    setEditState((s) => ({ ...s, saving: true, error: '' }))
    try {
      await onEdit(editId!, trimmed, editState.color)
      setEditId(null)
    } catch (err) {
      setEditState((s) => ({ ...s, saving: false, error: err instanceof Error ? err.message : 'Failed to save.' }))
    }
  }

  async function handleDelete(id: string) {
    setDeleting(id)
    setDeleteError((prev) => ({ ...prev, [id]: '' }))
    try {
      await onDelete(id)
    } catch (err) {
      setDeleteError((prev) => ({ ...prev, [id]: err instanceof Error ? err.message : 'Failed to delete.' }))
    } finally {
      setDeleting(null)
    }
  }

  if (categories.length === 0) {
    return (
      <div style={{ padding: '32px 0', textAlign: 'center', color: '#595d6c', fontSize: 14 }}>
        No categories yet.
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {categories.map((cat) => {
        const isEditing = editId === cat.id
        const errMsg = deleteError[cat.id]

        return (
          <div
            key={cat.id}
            style={{
              borderRadius: 12,
              background: isEditing ? 'rgba(145,132,217,0.06)' : 'rgba(233,233,237,0.04)',
              border: `1px solid ${isEditing ? 'rgba(145,132,217,0.25)' : 'rgba(233,233,237,0.08)'}`,
              transition: 'background .2s ease, border-color .2s ease',
              overflow: 'hidden',
            }}
          >
            {/* Row header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 14px' }}>
              <div style={{ width: 9, height: 9, borderRadius: '50%', background: cat.color, boxShadow: `0 0 6px ${cat.color}`, flexShrink: 0 }} />
              <span style={{ flex: 1, fontSize: 14, color: '#e9e9ed', textTransform: 'capitalize' }}>{cat.name}</span>
              <button
                onClick={() => isEditing ? setEditId(null) : openEdit(cat)}
                title="Edit category"
                style={{ width: 28, height: 28, borderRadius: 8, cursor: 'pointer', background: isEditing ? 'rgba(145,132,217,0.18)' : 'rgba(233,233,237,0.06)', border: `1px solid ${isEditing ? 'rgba(145,132,217,0.4)' : 'rgba(233,233,237,0.1)'}`, color: isEditing ? '#b5abfc' : '#9397ab', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, transition: 'all .15s ease' }}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
              </button>
              <button
                onClick={() => handleDelete(cat.id)}
                disabled={deleting === cat.id}
                title="Delete category"
                style={{ width: 28, height: 28, borderRadius: 8, cursor: deleting === cat.id ? 'default' : 'pointer', background: 'rgba(233,233,237,0.06)', border: '1px solid rgba(233,233,237,0.1)', color: '#9397ab', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, opacity: deleting === cat.id ? 0.5 : 1, transition: 'all .15s ease' }}
                onMouseEnter={(e) => { if (deleting !== cat.id) { e.currentTarget.style.color = '#f87171'; e.currentTarget.style.borderColor = 'rgba(220,38,38,0.4)' } }}
                onMouseLeave={(e) => { e.currentTarget.style.color = '#9397ab'; e.currentTarget.style.borderColor = 'rgba(233,233,237,0.1)' }}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                  <path d="M10 11v6M14 11v6" />
                  <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                </svg>
              </button>
            </div>

            {/* Delete error */}
            {errMsg && (
              <div style={{ padding: '0 14px 10px', fontSize: 12, color: '#f87171', lineHeight: 1.4 }}>
                {errMsg}
              </div>
            )}

            {/* Inline edit form */}
            {isEditing && (
              <div style={{ padding: '0 14px 14px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                <input
                  autoFocus
                  value={editState.name}
                  onChange={(e) => setEditState((s) => ({ ...s, name: e.target.value, error: '' }))}
                  onKeyDown={(e) => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') setEditId(null) }}
                  style={{ width: '100%', boxSizing: 'border-box', background: 'rgba(233,233,237,0.07)', border: `1px solid ${editState.error ? 'rgba(220,38,38,0.5)' : 'rgba(233,233,237,0.12)'}`, borderRadius: 9, padding: '9px 12px', fontSize: 14, color: '#e9e9ed', outline: 'none', transition: 'border-color .2s ease' }}
                  onFocus={(e) => { e.currentTarget.style.borderColor = '#9184d9' }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = editState.error ? 'rgba(220,38,38,0.5)' : 'rgba(233,233,237,0.12)' }}
                />
                {editState.error && <div style={{ fontSize: 12, color: '#d97777', marginTop: -6 }}>{editState.error}</div>}
                <ColorSwatches selected={editState.color} onSelect={(c) => setEditState((s) => ({ ...s, color: c }))} />
                <div style={{ display: 'flex', gap: 8, marginTop: 2 }}>
                  <button
                    onClick={() => setEditId(null)}
                    style={{ flex: 1, height: 34, borderRadius: 9, cursor: 'pointer', background: 'transparent', border: '1px solid rgba(233,233,237,0.1)', color: '#75798c', fontSize: 13 }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={saveEdit}
                    disabled={editState.saving}
                    style={{ flex: 1.4, height: 34, borderRadius: 9, cursor: editState.saving ? 'default' : 'pointer', background: 'rgba(145,132,217,0.14)', border: '1px solid rgba(145,132,217,0.5)', color: '#e9e9ed', fontSize: 13, opacity: editState.saving ? 0.6 : 1 }}
                  >
                    {editState.saving ? 'Saving…' : DAILY_TASKS.CATEGORY_EDIT_SAVE}
                  </button>
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

export default function AddCategoryModal({ open, categories, onClose, onSave, onDelete, onEdit }: AddCategoryModalProps) {
  const [tab, setTab] = useState<'new' | 'manage'>('new')
  const [name, setName] = useState('')
  const [color, setColor] = useState(SWATCHES[10])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [mounted, setMounted] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => setMounted(true), [])

  useEffect(() => {
    if (open) {
      setTab('new')
      setName('')
      setColor(SWATCHES[10])
      setError('')
      scrollRef.current?.scrollTo({ top: 0 })
    }
  }, [open])

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

  if (!mounted) return null

  return createPortal(
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0,
          background: 'rgba(8,10,18,0.55)',
          backdropFilter: 'blur(6px)',
          zIndex: 1000,
          opacity: open ? 1 : 0,
          pointerEvents: open ? 'auto' : 'none',
          transition: 'opacity .3s ease',
        }}
      />

      {/* Modal card */}
      <div
        ref={scrollRef}
        style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: open ? 'translate(-50%,-50%) scale(1)' : 'translate(-50%,-48%) scale(0.96)',
          opacity: open ? 1 : 0,
          pointerEvents: open ? 'auto' : 'none',
          transition: 'transform .35s cubic-bezier(.2,.85,.2,1), opacity .3s ease',
          zIndex: 1001,
          width: 400,
          maxHeight: 'calc(100vh - 80px)',
          overflowY: 'auto',
          background: 'linear-gradient(160deg,#2a2c3e,#181a28)',
          border: '1px solid rgba(145,132,217,0.35)',
          borderRadius: 20,
          padding: '30px 28px 24px',
          boxShadow: '0 24px 60px rgba(0,0,0,0.6), 0 0 40px rgba(145,132,217,0.1)',
        }}
      >
        {/* Header */}
        <div style={{ fontSize: 11, letterSpacing: '0.2em', color: '#75798c', textTransform: 'uppercase', marginBottom: 6 }}>
          {DAILY_TASKS.ADD_CATEGORY_EYEBROW}
        </div>
        <div style={{ fontSize: 22, fontWeight: 300, color: '#e9e9ed', marginBottom: 20 }}>
          {DAILY_TASKS.ADD_CATEGORY_HEADING}
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 24, background: 'rgba(233,233,237,0.05)', borderRadius: 12, padding: 4 }}>
          {(['new', 'manage'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                flex: 1, height: 34, borderRadius: 9, cursor: 'pointer', fontSize: 13,
                background: tab === t ? 'rgba(145,132,217,0.18)' : 'transparent',
                border: `1px solid ${tab === t ? 'rgba(145,132,217,0.4)' : 'transparent'}`,
                color: tab === t ? '#e9e9ed' : '#9397ab',
                transition: 'all .2s ease',
              }}
            >
              {t === 'new' ? DAILY_TASKS.CATEGORY_TAB_NEW : DAILY_TASKS.CATEGORY_TAB_MANAGE}
            </button>
          ))}
        </div>

        {tab === 'new' ? (
          <>
            {/* Name */}
            <div style={{ marginBottom: 20 }}>
              <label style={LABEL_STYLE}>{DAILY_TASKS.ADD_CATEGORY_NAME_LABEL}</label>
              <input
                autoFocus={open && tab === 'new'}
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
            <div style={{ marginBottom: 22 }}>
              <label style={LABEL_STYLE}>{DAILY_TASKS.ADD_CATEGORY_COLOR_LABEL}</label>
              <ColorSwatches selected={color} onSelect={setColor} />
            </div>

            {/* Preview */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 22, padding: '10px 14px', background: 'rgba(233,233,237,0.04)', borderRadius: 10 }}>
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: color, boxShadow: `0 0 8px ${color}`, flexShrink: 0 }} />
              <span style={{ fontSize: 14, color: name.trim() ? '#e9e9ed' : '#595d6c', textTransform: 'capitalize' }}>
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
          </>
        ) : (
          <>
            <ManageTab categories={categories} onDelete={onDelete} onEdit={onEdit} />
            <div style={{ marginTop: 20 }}>
              <button
                onClick={onClose}
                style={{ width: '100%', height: 42, borderRadius: 10, cursor: 'pointer', background: 'transparent', border: '1px solid rgba(233,233,237,0.1)', color: '#75798c', fontSize: 14 }}
              >
                {DAILY_TASKS.ADD_CATEGORY_CANCEL}
              </button>
            </div>
          </>
        )}
      </div>
    </>,
    document.body,
  )
}

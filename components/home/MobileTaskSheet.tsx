'use client'

import { useState, useEffect } from 'react'
import type { DailyTask, TaskScope } from '@/lib/types/dailyTasks'
import type { TaskCategoryRecord } from '@/lib/types/taskCategories'
import type { SoundEngine } from './SoundEngine'
import type { TaskDraft } from './TaskSlideOver'
import { DAILY_TASKS } from '@/locales/en'

function nativeToDisplay(t: string): string {
  if (!t) return ''
  const [hStr, mStr] = t.split(':')
  const h = parseInt(hStr, 10)
  const period = h < 12 ? 'AM' : 'PM'
  const h12 = h % 12 === 0 ? 12 : h % 12
  return `${h12}:${mStr} ${period}`
}

function displayToNative(t: string): string {
  if (!t) return ''
  const match = /^(\d+):(\d+)\s*(AM|PM)$/i.exec(t.trim())
  if (!match) return ''
  let h = parseInt(match[1], 10) % 12
  if (match[3].toUpperCase() === 'PM') h += 12
  return `${String(h).padStart(2, '0')}:${match[2]}`
}

function storedToDisplay(t: string | null): string {
  if (!t) return ''
  const [hStr, mStr] = t.split(':')
  const h = parseInt(hStr, 10)
  const period = h < 12 ? 'AM' : 'PM'
  const h12 = h % 12 === 0 ? 12 : h % 12
  return `${h12}:${mStr} ${period}`
}

const BLANK_DRAFT: TaskDraft = { title: '', category: '', time: '', logsToCalendar: true, scope: 'personal' }

interface MobileTaskSheetProps {
  open: boolean
  categories: TaskCategoryRecord[]
  editTask?: DailyTask | null
  onClose: () => void
  onSave: (draft: TaskDraft) => Promise<void>
  onDeleteTask?: (taskId: string) => Promise<void>
  soundRef: { current: SoundEngine | null }
}

export default function MobileTaskSheet({
  open, categories, editTask, onClose, onSave, onDeleteTask, soundRef,
}: MobileTaskSheetProps) {
  const isEdit = !!editTask

  const [draft, setDraft] = useState<TaskDraft>(BLANK_DRAFT)
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    if (open) {
      if (editTask) {
        setDraft({
          title: editTask.title,
          category: editTask.category,
          time: storedToDisplay(editTask.timeOfDay),
          logsToCalendar: editTask.logsToCalendar,
          scope: editTask.scope,
        })
      } else {
        setDraft(BLANK_DRAFT)
      }
      setConfirmDelete(false)
    }
  }, [open, editTask])

  const nativeValue = draft.time ? displayToNative(draft.time) : ''

  async function handleSave() {
    if (!draft.title.trim() || !draft.category) {
      soundRef.current?.playInvalid()
      return
    }
    setSaving(true)
    try {
      await onSave(draft)
      if (!isEdit) setDraft(BLANK_DRAFT)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!editTask || !onDeleteTask) return
    setDeleting(true)
    try {
      await onDeleteTask(editTask.id)
      setConfirmDelete(false)
    } finally {
      setDeleting(false)
    }
  }

  const LABEL: React.CSSProperties = {
    fontSize: 10, letterSpacing: '0.16em', color: '#75798c',
    textTransform: 'uppercase', display: 'block', marginBottom: 7,
  }

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0,
          background: 'rgba(11,12,20,0.7)',
          backdropFilter: 'blur(5px)',
          zIndex: 800,
          opacity: open ? 1 : 0,
          pointerEvents: open ? 'auto' : 'none',
          transition: 'opacity .3s ease',
        }}
      />

      {/* Sheet */}
      <div
        style={{
          position: 'fixed', left: 0, right: 0, bottom: 0,
          background: 'linear-gradient(180deg,#232532,#161826)',
          borderTop: '1px solid rgba(233,233,237,0.08)',
          borderRadius: '20px 20px 0 0',
          boxShadow: '0 -20px 60px rgba(0,0,0,0.55)',
          zIndex: 900,
          transform: open ? 'translateY(0)' : 'translateY(100%)',
          opacity: open ? 1 : 0,
          pointerEvents: open ? 'auto' : 'none',
          transition: 'transform .45s cubic-bezier(.2,.85,.2,1), opacity .3s ease',
          display: 'flex', flexDirection: 'column',
          maxHeight: '88vh',
          overflowY: 'auto',
          padding: '0 0 env(safe-area-inset-bottom, 16px)',
        }}
      >
        {/* Drag handle */}
        <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 4px', flexShrink: 0 }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: 'rgba(233,233,237,0.2)' }} />
        </div>

        <div style={{ padding: '8px 22px 28px', display: 'flex', flexDirection: 'column', gap: 0 }}>
          {/* Header */}
          <div style={{ marginBottom: 22 }}>
            <div style={{ fontSize: 10, letterSpacing: '0.2em', color: '#75798c', textTransform: 'uppercase', marginBottom: 5 }}>
              {isEdit ? DAILY_TASKS.SLIDE_EYEBROW_EDIT : DAILY_TASKS.SLIDE_EYEBROW}
            </div>
            <div style={{ fontSize: 20, fontWeight: 300, color: '#e9e9ed' }}>
              {isEdit ? DAILY_TASKS.SLIDE_HEADING_EDIT : DAILY_TASKS.SLIDE_HEADING}
            </div>
          </div>

          {/* Title */}
          <div style={{ marginBottom: 18 }}>
            <label style={LABEL}>{DAILY_TASKS.SLIDE_TASK_LABEL}</label>
            <input
              value={draft.title}
              onChange={(e) => setDraft({ ...draft, title: e.target.value })}
              placeholder={DAILY_TASKS.SLIDE_TASK_PLACEHOLDER}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSave() }}
              style={{
                width: '100%', boxSizing: 'border-box',
                background: 'rgba(233,233,237,0.05)', border: '1px solid rgba(233,233,237,0.1)',
                borderRadius: 12, padding: '11px 14px',
                fontSize: 15, color: '#e9e9ed', outline: 'none',
                transition: 'border-color .2s ease',
              }}
              onFocus={(e) => { e.currentTarget.style.borderColor = '#9184d9' }}
              onBlur={(e) => { e.currentTarget.style.borderColor = 'rgba(233,233,237,0.1)' }}
            />
          </div>

          {/* Category */}
          <div style={{ marginBottom: 18 }}>
            <label style={LABEL}>{DAILY_TASKS.SLIDE_CATEGORY_LABEL}</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 7 }}>
              {categories.map(({ id, name, color }) => {
                const sel = draft.category === name
                return (
                  <button
                    key={id}
                    onClick={() => setDraft({ ...draft, category: name })}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 9,
                      padding: '10px 13px', borderRadius: 11, cursor: 'pointer',
                      background: sel ? 'rgba(145,132,217,0.12)' : 'rgba(233,233,237,0.04)',
                      border: `1px solid ${sel ? 'rgba(145,132,217,0.5)' : 'rgba(233,233,237,0.08)'}`,
                      transition: 'all .2s ease',
                    }}
                  >
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0, boxShadow: `0 0 5px ${color}` }} />
                    <span style={{ fontSize: 13, color: sel ? '#e9e9ed' : '#9397ab', textTransform: 'capitalize' }}>{name}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Scope */}
          <div style={{ marginBottom: 18 }}>
            <label style={LABEL}>{DAILY_TASKS.SLIDE_SCOPE_LABEL}</label>
            <div style={{ display: 'flex', gap: 7 }}>
              {(['personal', 'household'] as TaskScope[]).map((s) => {
                const sel = draft.scope === s
                return (
                  <button
                    key={s}
                    onClick={() => setDraft({ ...draft, scope: s })}
                    style={{
                      flex: 1, height: 38, borderRadius: 19, cursor: 'pointer',
                      fontSize: 13, fontWeight: sel ? 500 : 400,
                      background: sel ? 'rgba(145,132,217,0.16)' : 'rgba(233,233,237,0.04)',
                      border: `1px solid ${sel ? '#9184d9' : 'rgba(233,233,237,0.08)'}`,
                      color: sel ? '#e9e9ed' : '#9397ab',
                      transition: 'all .2s ease',
                    }}
                  >
                    {s === 'personal' ? DAILY_TASKS.SCOPE_PERSONAL : DAILY_TASKS.SCOPE_HOUSEHOLD}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Time */}
          <div style={{ marginBottom: 18 }}>
            <label style={LABEL}>{DAILY_TASKS.SLIDE_TIME_LABEL}</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
              <button
                onClick={() => setDraft({ ...draft, time: '' })}
                style={{
                  padding: '7px 12px', borderRadius: 18, cursor: 'pointer', fontSize: 12,
                  background: draft.time === '' ? 'rgba(145,132,217,0.16)' : 'rgba(233,233,237,0.04)',
                  border: `1px solid ${draft.time === '' ? '#9184d9' : 'rgba(233,233,237,0.08)'}`,
                  color: draft.time === '' ? '#e9e9ed' : '#9397ab',
                  transition: 'all .2s ease',
                }}
              >
                {DAILY_TASKS.SLIDE_TIME_NONE}
              </button>
              {DAILY_TASKS.TIME_PRESETS.map((t) => {
                const sel = draft.time === t
                return (
                  <button
                    key={t}
                    onClick={() => setDraft({ ...draft, time: t })}
                    style={{
                      padding: '7px 12px', borderRadius: 18, cursor: 'pointer', fontSize: 12,
                      background: sel ? 'rgba(145,132,217,0.16)' : 'rgba(233,233,237,0.04)',
                      border: `1px solid ${sel ? '#9184d9' : 'rgba(233,233,237,0.08)'}`,
                      color: sel ? '#e9e9ed' : '#9397ab',
                      transition: 'all .2s ease',
                    }}
                  >
                    {t}
                  </button>
                )
              })}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
              <span style={{ fontSize: 11, color: '#595d6c', flexShrink: 0 }}>{DAILY_TASKS.SLIDE_TIME_CUSTOM}</span>
              <input
                type="time"
                value={nativeValue}
                onChange={(e) => setDraft({ ...draft, time: nativeToDisplay(e.target.value) })}
                style={{
                  background: 'rgba(233,233,237,0.05)', border: '1px solid rgba(233,233,237,0.1)',
                  borderRadius: 9, padding: '7px 10px',
                  fontSize: 13, color: '#e9e9ed', outline: 'none',
                  colorScheme: 'dark', transition: 'border-color .2s ease',
                }}
                onFocus={(e) => { e.currentTarget.style.borderColor = '#9184d9' }}
                onBlur={(e) => { e.currentTarget.style.borderColor = 'rgba(233,233,237,0.1)' }}
              />
            </div>
          </div>

          {/* Log toggle */}
          <div
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '14px 0',
              borderTop: '1px solid rgba(233,233,237,0.06)',
              borderBottom: '1px solid rgba(233,233,237,0.06)',
              marginBottom: 6,
            }}
          >
            <div>
              <div style={{ fontSize: 13, color: '#e9e9ed' }}>{DAILY_TASKS.SLIDE_LOG_TOGGLE_LABEL}</div>
              <div style={{ fontSize: 11, color: '#595d6c', marginTop: 1 }}>{DAILY_TASKS.SLIDE_LOG_TOGGLE_HINT}</div>
            </div>
            <button
              onClick={() => setDraft({ ...draft, logsToCalendar: !draft.logsToCalendar })}
              style={{
                width: 44, height: 24, borderRadius: 12, flexShrink: 0,
                background: draft.logsToCalendar ? 'rgba(145,132,217,0.8)' : 'rgba(233,233,237,0.1)',
                border: 'none', cursor: 'pointer', position: 'relative',
                transition: 'background .3s ease', marginLeft: 14,
              }}
            >
              <div
                style={{
                  position: 'absolute', top: 3,
                  left: draft.logsToCalendar ? 22 : 3,
                  width: 18, height: 18, borderRadius: '50%',
                  background: '#fff', transition: 'left .3s ease',
                }}
              />
            </button>
          </div>

          {/* Delete (edit mode) */}
          {isEdit && onDeleteTask && (
            <div style={{ marginTop: 14 }}>
              {confirmDelete ? (
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={handleDelete}
                    disabled={deleting}
                    style={{ flex: 1, height: 40, borderRadius: 10, cursor: deleting ? 'default' : 'pointer', background: 'rgba(220,38,38,0.15)', border: '1px solid rgba(220,38,38,0.4)', color: '#f87171', fontSize: 13, opacity: deleting ? 0.5 : 1 }}
                  >
                    {deleting ? 'Deleting…' : 'Confirm delete'}
                  </button>
                  <button
                    onClick={() => setConfirmDelete(false)}
                    style={{ height: 40, padding: '0 14px', borderRadius: 10, cursor: 'pointer', background: 'transparent', border: '1px solid rgba(233,233,237,0.1)', color: '#75798c', fontSize: 13 }}
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmDelete(true)}
                  style={{ width: '100%', height: 40, borderRadius: 10, cursor: 'pointer', background: 'transparent', border: '1px solid rgba(220,38,38,0.2)', color: '#9397ab', fontSize: 13, transition: 'all .2s ease' }}
                >
                  {DAILY_TASKS.SLIDE_DELETE_TASK}
                </button>
              )}
            </div>
          )}

          {/* Actions */}
          <div style={{ display: 'flex', gap: 9, marginTop: 20 }}>
            <button
              onClick={onClose}
              style={{ flex: 1, height: 46, borderRadius: 12, cursor: 'pointer', background: 'transparent', border: '1px solid rgba(233,233,237,0.12)', color: '#75798c', fontSize: 14 }}
            >
              {DAILY_TASKS.SLIDE_CANCEL}
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              style={{
                flex: 1.4, height: 46, borderRadius: 12, cursor: saving ? 'default' : 'pointer',
                background: 'rgba(145,132,217,0.12)', border: '1px solid rgba(145,132,217,0.5)',
                color: '#e9e9ed', fontSize: 14,
                opacity: saving ? 0.6 : 1, transition: 'opacity .2s ease',
              }}
            >
              {isEdit ? DAILY_TASKS.SLIDE_SAVE_EDIT : DAILY_TASKS.MOBILE_SLIDE_SAVE}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}

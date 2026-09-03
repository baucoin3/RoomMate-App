'use client'

import { useState } from 'react'
import type { TaskCategory, TaskScope } from '@/lib/types/dailyTasks'
import type { SoundEngine } from './SoundEngine'
import { DAILY_TASKS } from '@/locales/en'

export interface TaskDraft {
  title: string
  category: TaskCategory | ''
  time: string
  logsToCalendar: boolean
  scope: TaskScope
}

interface TaskSlideOverProps {
  open: boolean
  onClose: () => void
  onSave: (draft: TaskDraft) => Promise<void>
  soundRef: { current: SoundEngine | null }
}

const CAT_OPTIONS: { key: TaskCategory; label: string; color: string }[] = [
  { key: 'fitness', label: DAILY_TASKS.CATEGORIES.FITNESS, color: 'oklch(0.734 0.125 289.2)' },
  { key: 'home',    label: DAILY_TASKS.CATEGORIES.HOME,    color: 'oklch(0.734 0.125 175)' },
  { key: 'work',    label: DAILY_TASKS.CATEGORIES.WORK,    color: 'oklch(0.734 0.125 245)' },
  { key: 'errands', label: DAILY_TASKS.CATEGORIES.ERRANDS, color: 'oklch(0.734 0.125 45)' },
]

// Convert native time input "HH:MM" → display format "H:MM AM/PM"
function nativeToDisplay(t: string): string {
  if (!t) return ''
  const [hStr, mStr] = t.split(':')
  const h = parseInt(hStr, 10)
  const period = h < 12 ? 'AM' : 'PM'
  const h12 = h % 12 === 0 ? 12 : h % 12
  return `${h12}:${mStr} ${period}`
}

// Convert display format "H:MM AM/PM" → native input "HH:MM"
function displayToNative(t: string): string {
  if (!t) return ''
  const match = /^(\d+):(\d+)\s*(AM|PM)$/i.exec(t.trim())
  if (!match) return ''
  let h = parseInt(match[1], 10) % 12
  if (match[3].toUpperCase() === 'PM') h += 12
  return `${String(h).padStart(2, '0')}:${match[2]}`
}

const LABEL_STYLE: React.CSSProperties = {
  fontSize: 11,
  letterSpacing: '0.16em',
  color: '#75798c',
  textTransform: 'uppercase',
  display: 'block',
  marginBottom: 8,
}

export default function TaskSlideOver({ open, onClose, onSave, soundRef }: TaskSlideOverProps) {
  const [draft, setDraft] = useState<TaskDraft>({
    title: '',
    category: '',
    time: '',
    logsToCalendar: false,
    scope: 'personal',
  })
  const [saving, setSaving] = useState(false)

  // Track whether a preset is active vs custom input
  const isPreset = DAILY_TASKS.TIME_PRESETS.includes(draft.time as typeof DAILY_TASKS.TIME_PRESETS[number])
  const nativeValue = isPreset ? displayToNative(draft.time) : draft.time ? displayToNative(draft.time) : ''

  async function handleSave() {
    if (!draft.title.trim() || !draft.category) {
      soundRef.current?.playInvalid()
      return
    }
    setSaving(true)
    try {
      await onSave(draft)
      setDraft({ title: '', category: '', time: '', logsToCalendar: false, scope: 'personal' })
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
          position: 'fixed',
          inset: 0,
          background: 'rgba(11,12,20,0.66)',
          backdropFilter: 'blur(6px)',
          zIndex: 800,
          opacity: open ? 1 : 0,
          pointerEvents: open ? 'auto' : 'none',
          transition: 'opacity .35s ease',
        }}
      />

      {/* Panel */}
      <div
        style={{
          position: 'fixed',
          right: 0,
          top: 0,
          bottom: 0,
          width: 460,
          background: 'linear-gradient(200deg,#232532,#161826)',
          borderLeft: '1px solid rgba(233,233,237,0.08)',
          boxShadow: '-30px 0 80px rgba(0,0,0,0.5)',
          zIndex: 900,
          transform: open ? 'translateX(0)' : 'translateX(30px)',
          opacity: open ? 1 : 0,
          pointerEvents: open ? 'auto' : 'none',
          transition: 'transform .5s cubic-bezier(.2,.85,.2,1), opacity .35s ease',
          display: 'flex',
          flexDirection: 'column',
          padding: '36px 32px 32px',
          overflowY: 'auto',
        }}
      >
        <div style={{ fontSize: 11, letterSpacing: '0.2em', color: '#75798c', textTransform: 'uppercase', marginBottom: 8 }}>
          {DAILY_TASKS.SLIDE_EYEBROW}
        </div>
        <div style={{ fontSize: 24, fontWeight: 300, color: '#e9e9ed', marginBottom: 32 }}>
          {DAILY_TASKS.SLIDE_HEADING}
        </div>

        {/* Title */}
        <div style={{ marginBottom: 24 }}>
          <label style={LABEL_STYLE}>{DAILY_TASKS.SLIDE_TASK_LABEL}</label>
          <input
            value={draft.title}
            onChange={(e) => setDraft({ ...draft, title: e.target.value })}
            placeholder={DAILY_TASKS.SLIDE_TASK_PLACEHOLDER}
            onKeyDown={(e) => { if (e.key === 'Enter') handleSave() }}
            style={{
              width: '100%',
              background: 'rgba(233,233,237,0.05)',
              border: '1px solid rgba(233,233,237,0.1)',
              borderRadius: 12,
              padding: '12px 16px',
              fontSize: 15,
              color: '#e9e9ed',
              outline: 'none',
              boxSizing: 'border-box',
              transition: 'border-color .2s ease',
            }}
            onFocus={(e) => { e.currentTarget.style.borderColor = '#9184d9' }}
            onBlur={(e) => { e.currentTarget.style.borderColor = 'rgba(233,233,237,0.1)' }}
          />
        </div>

        {/* Category */}
        <div style={{ marginBottom: 24 }}>
          <label style={LABEL_STYLE}>{DAILY_TASKS.SLIDE_CATEGORY_LABEL}</label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {CAT_OPTIONS.map(({ key, label, color }) => {
              const sel = draft.category === key
              return (
                <button
                  key={key}
                  onClick={() => setDraft({ ...draft, category: key })}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '12px 16px',
                    borderRadius: 12,
                    cursor: 'pointer',
                    background: sel ? 'rgba(145,132,217,0.12)' : 'rgba(233,233,237,0.04)',
                    border: `1px solid ${sel ? 'rgba(145,132,217,0.5)' : 'rgba(233,233,237,0.08)'}`,
                    transition: 'all .2s ease',
                  }}
                >
                  <div style={{ width: 9, height: 9, borderRadius: '50%', background: color, flexShrink: 0, boxShadow: `0 0 6px ${color}` }} />
                  <span style={{ fontSize: 14, color: sel ? '#e9e9ed' : '#9397ab' }}>{label}</span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Scope (Visibility) */}
        <div style={{ marginBottom: 24 }}>
          <label style={LABEL_STYLE}>{DAILY_TASKS.SLIDE_SCOPE_LABEL}</label>
          <div style={{ display: 'flex', gap: 8 }}>
            {(['personal', 'household'] as TaskScope[]).map((s) => {
              const sel = draft.scope === s
              return (
                <button
                  key={s}
                  onClick={() => setDraft({ ...draft, scope: s })}
                  style={{
                    flex: 1,
                    height: 40,
                    borderRadius: 20,
                    cursor: 'pointer',
                    fontSize: 13,
                    fontWeight: sel ? 500 : 400,
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
          <div style={{ fontSize: 11, color: '#595d6c', marginTop: 6 }}>
            {draft.scope === 'personal'
              ? 'Only visible to you'
              : 'Visible to all household members'}
          </div>
        </div>

        {/* Time (optional) */}
        <div style={{ marginBottom: 24 }}>
          <label style={LABEL_STYLE}>{DAILY_TASKS.SLIDE_TIME_LABEL}</label>
          {/* Presets + No time */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
            <button
              onClick={() => setDraft({ ...draft, time: '' })}
              style={{
                padding: '8px 14px',
                borderRadius: 20,
                cursor: 'pointer',
                fontSize: 13,
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
                    padding: '8px 14px',
                    borderRadius: 20,
                    cursor: 'pointer',
                    fontSize: 13,
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
          {/* Custom time input */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 12, color: '#595d6c', flexShrink: 0 }}>{DAILY_TASKS.SLIDE_TIME_CUSTOM}</span>
            <input
              type="time"
              value={nativeValue}
              onChange={(e) => {
                const display = nativeToDisplay(e.target.value)
                setDraft({ ...draft, time: display })
              }}
              style={{
                background: 'rgba(233,233,237,0.05)',
                border: '1px solid rgba(233,233,237,0.1)',
                borderRadius: 10,
                padding: '7px 12px',
                fontSize: 13,
                color: '#e9e9ed',
                outline: 'none',
                colorScheme: 'dark',
                transition: 'border-color .2s ease',
              }}
              onFocus={(e) => { e.currentTarget.style.borderColor = '#9184d9' }}
              onBlur={(e) => { e.currentTarget.style.borderColor = 'rgba(233,233,237,0.1)' }}
            />
          </div>
        </div>

        {/* Log toggle */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '16px 0',
            borderTop: '1px solid rgba(233,233,237,0.06)',
            borderBottom: '1px solid rgba(233,233,237,0.06)',
            marginBottom: 8,
          }}
        >
          <div>
            <div style={{ fontSize: 14, color: '#e9e9ed' }}>{DAILY_TASKS.SLIDE_LOG_TOGGLE_LABEL}</div>
            <div style={{ fontSize: 12, color: '#595d6c', marginTop: 2 }}>{DAILY_TASKS.SLIDE_LOG_TOGGLE_HINT}</div>
          </div>
          <button
            onClick={() => setDraft({ ...draft, logsToCalendar: !draft.logsToCalendar })}
            style={{
              width: 46,
              height: 26,
              borderRadius: 13,
              flexShrink: 0,
              background: draft.logsToCalendar ? 'rgba(145,132,217,0.8)' : 'rgba(233,233,237,0.1)',
              border: 'none',
              cursor: 'pointer',
              position: 'relative',
              transition: 'background .3s ease',
              marginLeft: 16,
            }}
          >
            <div
              style={{
                position: 'absolute',
                top: 4,
                left: draft.logsToCalendar ? 24 : 4,
                width: 18,
                height: 18,
                borderRadius: '50%',
                background: '#fff',
                transition: 'left .3s ease',
              }}
            />
          </button>
        </div>

        <div style={{ flex: 1 }} />

        {/* Actions */}
        <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
          <button
            onClick={onClose}
            style={{
              flex: 1,
              height: 46,
              borderRadius: 12,
              cursor: 'pointer',
              background: 'transparent',
              border: '1px solid rgba(233,233,237,0.12)',
              color: '#75798c',
              fontSize: 14,
            }}
          >
            {DAILY_TASKS.SLIDE_CANCEL}
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            style={{
              flex: 1.4,
              height: 46,
              borderRadius: 12,
              cursor: saving ? 'default' : 'pointer',
              background: 'rgba(145,132,217,0.12)',
              border: '1px solid rgba(145,132,217,0.5)',
              color: '#e9e9ed',
              fontSize: 14,
              opacity: saving ? 0.6 : 1,
              transition: 'opacity .2s ease',
            }}
          >
            {DAILY_TASKS.SLIDE_SAVE}
          </button>
        </div>
      </div>
    </>
  )
}

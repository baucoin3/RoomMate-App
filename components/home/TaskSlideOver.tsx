'use client'

import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import type { DailyTask, TaskScope } from '@/lib/types/dailyTasks'
import type { TaskCategoryRecord } from '@/lib/types/taskCategories'
import type { SoundEngine } from './SoundEngine'
import { DAILY_TASKS } from '@/locales/en'

export interface TaskDraft {
  title: string
  category: string
  time: string
  logsToCalendar: boolean
  scope: TaskScope
  targetCompletionsPerDay: number
  weeklyTarget: number
}

interface TaskSlideOverProps {
  open: boolean
  categories: TaskCategoryRecord[]
  editTask?: DailyTask | null
  onClose: () => void
  onSave: (draft: TaskDraft) => Promise<void>
  onDeleteTask?: (taskId: string) => Promise<void>
  soundRef: { current: SoundEngine | null }
}

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

// Convert stored "HH:MM:SS" → display "H:MM AM/PM"
function storedToDisplay(t: string | null): string {
  if (!t) return ''
  const [hStr, mStr] = t.split(':')
  const h = parseInt(hStr, 10)
  const period = h < 12 ? 'AM' : 'PM'
  const h12 = h % 12 === 0 ? 12 : h % 12
  return `${h12}:${mStr} ${period}`
}

const BLANK_DRAFT: TaskDraft = { title: '', category: '', time: '', logsToCalendar: true, scope: 'personal', targetCompletionsPerDay: 1, weeklyTarget: 7 }

const LABEL_STYLE: React.CSSProperties = {
  fontSize: 11, letterSpacing: '0.16em', color: '#75798c',
  textTransform: 'uppercase', display: 'block', marginBottom: 8,
}

export default function TaskSlideOver({
  open, categories, editTask, onClose, onSave, onDeleteTask, soundRef,
}: TaskSlideOverProps) {
  const isEdit = !!editTask

  const [draft, setDraft] = useState<TaskDraft>(BLANK_DRAFT)
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [mounted, setMounted] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => setMounted(true), [])

  useEffect(() => {
    if (open) {
      scrollRef.current?.scrollTo({ top: 0 })
    }
  }, [open])

  // Sync draft when editTask changes or panel opens
  useEffect(() => {
    if (open) {
      if (editTask) {
        setDraft({
          title: editTask.title,
          category: editTask.category,
          time: storedToDisplay(editTask.timeOfDay),
          logsToCalendar: editTask.logsToCalendar,
          scope: editTask.scope,
          targetCompletionsPerDay: editTask.targetCompletionsPerDay ?? 1,
          weeklyTarget: editTask.weeklyTarget ?? 7,
        })
      } else {
        setDraft(BLANK_DRAFT)
      }
      setConfirmDelete(false)
    }
  }, [open, editTask])

  const isPreset = DAILY_TASKS.TIME_PRESETS.includes(draft.time as typeof DAILY_TASKS.TIME_PRESETS[number])
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

  if (!mounted) return null

  return createPortal(
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0,
          background: 'rgba(11,12,20,0.66)',
          backdropFilter: 'blur(6px)',
          zIndex: 1000,
          opacity: open ? 1 : 0,
          pointerEvents: open ? 'auto' : 'none',
          transition: 'opacity .35s ease',
        }}
      />

      {/* Panel */}
      <div
        ref={scrollRef}
        style={{
          position: 'fixed', right: 0, top: 0, bottom: 0, width: 460,
          background: 'linear-gradient(200deg,#232532,#161826)',
          borderLeft: '1px solid rgba(233,233,237,0.08)',
          boxShadow: '-30px 0 80px rgba(0,0,0,0.5)',
          zIndex: 1001,
          transform: open ? 'translateX(0)' : 'translateX(30px)',
          opacity: open ? 1 : 0,
          pointerEvents: open ? 'auto' : 'none',
          transition: 'transform .5s cubic-bezier(.2,.85,.2,1), opacity .35s ease',
          display: 'flex', flexDirection: 'column',
          padding: '36px 32px 32px',
          overflowY: 'auto',
        }}
      >
        <div style={{ fontSize: 11, letterSpacing: '0.2em', color: '#75798c', textTransform: 'uppercase', marginBottom: 8 }}>
          {isEdit ? DAILY_TASKS.SLIDE_EYEBROW_EDIT : DAILY_TASKS.SLIDE_EYEBROW}
        </div>
        <div style={{ fontSize: 24, fontWeight: 300, color: '#e9e9ed', marginBottom: 32 }}>
          {isEdit ? DAILY_TASKS.SLIDE_HEADING_EDIT : DAILY_TASKS.SLIDE_HEADING}
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
              width: '100%', boxSizing: 'border-box',
              background: 'rgba(233,233,237,0.05)',
              border: '1px solid rgba(233,233,237,0.1)',
              borderRadius: 12, padding: '12px 16px',
              fontSize: 15, color: '#e9e9ed', outline: 'none',
              transition: 'border-color .2s ease',
            }}
            onFocus={(e) => { e.currentTarget.style.borderColor = '#9184d9' }}
            onBlur={(e) => { e.currentTarget.style.borderColor = 'rgba(233,233,237,0.1)' }}
          />
        </div>

        {/* Frequency */}
        <div style={{ marginBottom: 24 }}>
          <label style={LABEL_STYLE}>{DAILY_TASKS.SLIDE_TASK_TYPE_LABEL}</label>
          <div style={{ display: 'flex', gap: 8, marginBottom: draft.targetCompletionsPerDay > 1 ? 12 : 0 }}>
            <button
              onClick={() => setDraft({ ...draft, targetCompletionsPerDay: 1 })}
              style={{
                flex: 1, height: 40, borderRadius: 20, cursor: 'pointer', fontSize: 13,
                background: draft.targetCompletionsPerDay === 1 ? 'rgba(145,132,217,0.16)' : 'rgba(233,233,237,0.04)',
                border: `1px solid ${draft.targetCompletionsPerDay === 1 ? '#9184d9' : 'rgba(233,233,237,0.08)'}`,
                color: draft.targetCompletionsPerDay === 1 ? '#e9e9ed' : '#9397ab',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                transition: 'all .2s ease',
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <circle cx="12" cy="12" r="10" />
                <path d="M9 12l2 2 4-4" />
              </svg>
              {DAILY_TASKS.SLIDE_TASK_TYPE_ONCE}
            </button>
            <button
              onClick={() => setDraft({ ...draft, targetCompletionsPerDay: draft.targetCompletionsPerDay > 1 ? draft.targetCompletionsPerDay : 2 })}
              style={{
                flex: 1, height: 40, borderRadius: 20, cursor: 'pointer', fontSize: 13,
                background: draft.targetCompletionsPerDay > 1 ? 'rgba(145,132,217,0.16)' : 'rgba(233,233,237,0.04)',
                border: `1px solid ${draft.targetCompletionsPerDay > 1 ? '#9184d9' : 'rgba(233,233,237,0.08)'}`,
                color: draft.targetCompletionsPerDay > 1 ? '#e9e9ed' : '#9397ab',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                transition: 'all .2s ease',
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <circle cx="9" cy="12" r="7" />
                <circle cx="15" cy="12" r="7" />
              </svg>
              {DAILY_TASKS.SLIDE_TASK_TYPE_MULTI}
            </button>
          </div>
          {draft.targetCompletionsPerDay > 1 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', borderRadius: 12, background: 'rgba(145,132,217,0.06)', border: '1px solid rgba(145,132,217,0.15)' }}>
              <span style={{ fontSize: 13, color: '#9397ab', flex: 1 }}>{DAILY_TASKS.SLIDE_DAILY_TARGET_LABEL}</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <button
                  onClick={() => setDraft({ ...draft, targetCompletionsPerDay: Math.max(2, draft.targetCompletionsPerDay - 1) })}
                  style={{ width: 28, height: 28, borderRadius: 8, cursor: 'pointer', background: 'rgba(233,233,237,0.06)', border: '1px solid rgba(233,233,237,0.12)', color: '#9397ab', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >−</button>
                <span style={{ fontSize: 18, fontWeight: 400, color: '#e9e9ed', minWidth: 24, textAlign: 'center' }}>{draft.targetCompletionsPerDay}</span>
                <button
                  onClick={() => setDraft({ ...draft, targetCompletionsPerDay: Math.min(20, draft.targetCompletionsPerDay + 1) })}
                  style={{ width: 28, height: 28, borderRadius: 8, cursor: 'pointer', background: 'rgba(233,233,237,0.06)', border: '1px solid rgba(233,233,237,0.12)', color: '#9397ab', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >+</button>
              </div>
            </div>
          )}
        </div>

        {/* Category — dynamic */}
        <div style={{ marginBottom: 24 }}>
          <label style={LABEL_STYLE}>{DAILY_TASKS.SLIDE_CATEGORY_LABEL}</label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {categories.map(({ id, name, color }) => {
              const sel = draft.category === name
              return (
                <button
                  key={id}
                  onClick={() => setDraft({ ...draft, category: name })}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '12px 16px', borderRadius: 12, cursor: 'pointer',
                    background: sel ? 'rgba(145,132,217,0.12)' : 'rgba(233,233,237,0.04)',
                    border: `1px solid ${sel ? 'rgba(145,132,217,0.5)' : 'rgba(233,233,237,0.08)'}`,
                    transition: 'all .2s ease',
                  }}
                >
                  <div style={{ width: 9, height: 9, borderRadius: '50%', background: color, flexShrink: 0, boxShadow: `0 0 6px ${color}` }} />
                  <span style={{ fontSize: 14, color: sel ? '#e9e9ed' : '#9397ab', textTransform: 'capitalize' }}>
                    {name}
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Scope */}
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
                    flex: 1, height: 40, borderRadius: 20, cursor: 'pointer',
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
          <div style={{ fontSize: 11, color: '#595d6c', marginTop: 6 }}>
            {draft.scope === 'personal' ? 'Only visible to you' : 'Visible to all household members'}
          </div>
        </div>

        {/* Weekly goal */}
        <div style={{ marginBottom: 24 }}>
          <label style={LABEL_STYLE}>{DAILY_TASKS.SLIDE_WEEKLY_TARGET_LABEL}</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', borderRadius: 12, background: 'rgba(233,233,237,0.04)', border: '1px solid rgba(233,233,237,0.08)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <button
                onClick={() => setDraft({ ...draft, weeklyTarget: Math.max(1, draft.weeklyTarget - 1) })}
                style={{ width: 28, height: 28, borderRadius: 8, cursor: 'pointer', background: 'rgba(233,233,237,0.06)', border: '1px solid rgba(233,233,237,0.12)', color: '#9397ab', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >−</button>
              <span style={{ fontSize: 18, fontWeight: 400, color: '#e9e9ed', minWidth: 24, textAlign: 'center' }}>{draft.weeklyTarget}</span>
              <button
                onClick={() => setDraft({ ...draft, weeklyTarget: Math.min(7, draft.weeklyTarget + 1) })}
                style={{ width: 28, height: 28, borderRadius: 8, cursor: 'pointer', background: 'rgba(233,233,237,0.06)', border: '1px solid rgba(233,233,237,0.12)', color: '#9397ab', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >+</button>
            </div>
            <span style={{ fontSize: 13, color: '#75798c' }}>{DAILY_TASKS.SLIDE_WEEKLY_TARGET_HINT(draft.weeklyTarget)}</span>
          </div>
        </div>

        {/* Time */}
        <div style={{ marginBottom: 24 }}>
          <label style={LABEL_STYLE}>{DAILY_TASKS.SLIDE_TIME_LABEL}</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
            <button
              onClick={() => setDraft({ ...draft, time: '' })}
              style={{
                padding: '8px 14px', borderRadius: 20, cursor: 'pointer', fontSize: 13,
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
                    padding: '8px 14px', borderRadius: 20, cursor: 'pointer', fontSize: 13,
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
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 12, color: '#595d6c', flexShrink: 0 }}>{DAILY_TASKS.SLIDE_TIME_CUSTOM}</span>
            <input
              type="time"
              value={nativeValue}
              onChange={(e) => { setDraft({ ...draft, time: nativeToDisplay(e.target.value) }) }}
              style={{
                background: 'rgba(233,233,237,0.05)',
                border: '1px solid rgba(233,233,237,0.1)',
                borderRadius: 10, padding: '7px 12px',
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
              width: 46, height: 26, borderRadius: 13, flexShrink: 0,
              background: draft.logsToCalendar ? 'rgba(145,132,217,0.8)' : 'rgba(233,233,237,0.1)',
              border: 'none', cursor: 'pointer', position: 'relative',
              transition: 'background .3s ease', marginLeft: 16,
            }}
          >
            <div
              style={{
                position: 'absolute', top: 4,
                left: draft.logsToCalendar ? 24 : 4,
                width: 18, height: 18, borderRadius: '50%',
                background: '#fff', transition: 'left .3s ease',
              }}
            />
          </button>
        </div>

        {/* Delete task (edit mode only) */}
        {isEdit && onDeleteTask && (
          <div style={{ marginTop: 16 }}>
            {confirmDelete ? (
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  style={{ flex: 1, height: 40, borderRadius: 10, cursor: deleting ? 'default' : 'pointer', background: 'rgba(220,38,38,0.15)', border: '1px solid rgba(220,38,38,0.4)', color: '#f87171', fontSize: 14, opacity: deleting ? 0.5 : 1 }}
                >
                  {deleting ? 'Deleting…' : 'Confirm delete'}
                </button>
                <button
                  onClick={() => setConfirmDelete(false)}
                  style={{ height: 40, padding: '0 14px', borderRadius: 10, cursor: 'pointer', background: 'transparent', border: '1px solid rgba(233,233,237,0.1)', color: '#75798c', fontSize: 14 }}
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmDelete(true)}
                style={{ width: '100%', height: 40, borderRadius: 10, cursor: 'pointer', background: 'transparent', border: '1px solid rgba(220,38,38,0.2)', color: '#9397ab', fontSize: 14, transition: 'all .2s ease' }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(220,38,38,0.08)'; e.currentTarget.style.color = '#f87171' }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#9397ab' }}
              >
                {DAILY_TASKS.SLIDE_DELETE_TASK}
              </button>
            )}
          </div>
        )}

        <div style={{ flex: 1 }} />

        {/* Actions */}
        <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
          <button
            onClick={onClose}
            style={{ flex: 1, height: 46, borderRadius: 12, cursor: 'pointer', background: 'transparent', border: '1px solid rgba(233,233,237,0.12)', color: '#75798c', fontSize: 14 }}
          >
            {DAILY_TASKS.SLIDE_CANCEL}
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            style={{ flex: 1.4, height: 46, borderRadius: 12, cursor: saving ? 'default' : 'pointer', background: 'rgba(145,132,217,0.12)', border: '1px solid rgba(145,132,217,0.5)', color: '#e9e9ed', fontSize: 14, opacity: saving ? 0.6 : 1, transition: 'opacity .2s ease' }}
          >
            {isEdit ? DAILY_TASKS.SLIDE_SAVE_EDIT : DAILY_TASKS.SLIDE_SAVE}
          </button>
        </div>
      </div>
    </>,
    document.body,
  )
}

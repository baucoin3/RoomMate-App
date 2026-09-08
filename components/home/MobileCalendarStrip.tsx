'use client'

import { useState } from 'react'
import type { NocturneCalendarData, NocturneCalendarEvent, TaskScope } from '@/lib/types/dailyTasks'
import { DAILY_TASKS } from '@/locales/en'

const DOW_NARROW = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

function addDays(base: Date, n: number): Date {
  const d = new Date(base)
  d.setDate(d.getDate() + n)
  return d
}

function toISO(d: Date): string {
  return d.toLocaleDateString('en-CA')
}

function catColor(cat: string, map: Record<string, string>): string {
  return map[cat] ?? 'rgba(233,233,237,0.3)'
}

interface MobileCalendarStripProps {
  events: NocturneCalendarData
  now: Date
  categoryMap: Record<string, string>
  onAddEvent: (date: string, title: string, scope: TaskScope) => Promise<void>
  onDeleteEvent: (eventId: string, date: string) => Promise<void>
  onEditTask: (taskId: string) => void
  onTaskToggled: (taskId: string, date: string, currentlyDone: boolean) => Promise<void>
  onEventToggled?: (eventId: string, date: string, currentlyDone: boolean) => Promise<void>
}

export default function MobileCalendarStrip({
  events, now, categoryMap, onAddEvent, onDeleteEvent, onEditTask, onTaskToggled, onEventToggled,
}: MobileCalendarStripProps) {
  const todayISO = toISO(now)
  const [weekOffset, setWeekOffset] = useState(0)
  const [selectedISO, setSelectedISO] = useState(todayISO)
  const [addTitle, setAddTitle] = useState('')
  const [addScope, setAddScope] = useState<TaskScope>('personal')
  const [adding, setAdding] = useState(false)
  const [confirmDeleteKey, setConfirmDeleteKey] = useState<string | null>(null)

  // 7 days centered on today shifted by weekOffset weeks
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = addDays(now, weekOffset * 7 + (i - 3))
    return { date: d, iso: toISO(d) }
  })

  const selectedEvents: NocturneCalendarEvent[] = events[selectedISO] ?? []

  async function handleAdd() {
    if (!addTitle.trim()) return
    setAdding(true)
    try {
      await onAddEvent(selectedISO, addTitle.trim(), addScope)
      setAddTitle('')
    } finally {
      setAdding(false)
    }
  }

  function formatHeader(iso: string): string {
    const d = new Date(iso + 'T12:00:00')
    return d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, height: '100%' }}>

      {/* Week strip */}
      <div
        style={{
          border: '1px solid rgba(233,233,237,0.07)',
          borderRadius: 20,
          background: 'linear-gradient(155deg,rgba(35,37,50,0.92),rgba(22,24,38,0.6))',
          padding: '14px 14px',
          flexShrink: 0,
        }}
      >
        {/* Nav row */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <button
            onClick={() => setWeekOffset((w) => w - 1)}
            style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(233,233,237,0.05)', border: '1px solid rgba(233,233,237,0.1)', color: '#9397ab', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all .2s ease' }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>

          <button
            onClick={() => { setWeekOffset(0); setSelectedISO(todayISO) }}
            style={{ fontSize: 12, color: weekOffset === 0 ? '#b5abfc' : '#9397ab', background: 'transparent', border: 'none', cursor: 'pointer', padding: '4px 8px', borderRadius: 8 }}
          >
            {weekOffset === 0 ? 'This week' : 'Back to today'}
          </button>

          <button
            onClick={() => setWeekOffset((w) => w + 1)}
            style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(233,233,237,0.05)', border: '1px solid rgba(233,233,237,0.1)', color: '#9397ab', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all .2s ease' }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M9 18l6-6-6-6" />
            </svg>
          </button>
        </div>

        {/* Day bubbles */}
        <div style={{ display: 'flex', gap: 5 }}>
          {days.map(({ date, iso }) => {
            const isToday = iso === todayISO
            const isSelected = iso === selectedISO
            const dayEvs = events[iso] ?? []
            const hasActivity = dayEvs.some((e) => e.type !== 'task' || e.done)

            return (
              <button
                key={iso}
                onClick={() => setSelectedISO(iso)}
                style={{
                  flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
                  padding: '8px 2px', borderRadius: 12, cursor: 'pointer',
                  background: isSelected
                    ? 'rgba(145,132,217,0.2)'
                    : isToday ? 'rgba(145,132,217,0.06)' : 'rgba(233,233,237,0.03)',
                  border: `1px solid ${isSelected ? '#9184d9' : isToday ? 'rgba(145,132,217,0.28)' : 'rgba(233,233,237,0.07)'}`,
                  boxShadow: isSelected ? '0 0 12px rgba(145,132,217,0.18)' : 'none',
                  transition: 'all .2s ease',
                }}
              >
                <span style={{ fontSize: 8, color: isSelected ? '#b5abfc' : '#595d6c', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                  {DOW_NARROW[date.getDay()]}
                </span>
                <span style={{ fontSize: 15, fontWeight: isToday ? 500 : 400, color: isSelected ? '#e9e9ed' : isToday ? '#b5abfc' : '#9397ab' }}>
                  {date.getDate()}
                </span>
                <div style={{ width: 4, height: 4, borderRadius: '50%', background: hasActivity ? (isSelected ? '#9184d9' : 'rgba(145,132,217,0.5)') : 'transparent' }} />
              </button>
            )
          })}
        </div>
      </div>

      {/* Events for selected day */}
      <div
        style={{
          border: '1px solid rgba(233,233,237,0.07)',
          borderRadius: 20,
          background: 'linear-gradient(155deg,rgba(35,37,50,0.9),rgba(22,24,38,0.55))',
          padding: '16px 16px',
          flex: 1,
          display: 'flex', flexDirection: 'column',
          minHeight: 0,
          overflow: 'hidden',
        }}
      >
        {/* Day header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, flexShrink: 0 }}>
          <span style={{ fontSize: 15, fontWeight: 400, color: '#e9e9ed' }}>
            {formatHeader(selectedISO)}
          </span>
          {selectedISO === todayISO && (
            <span style={{ fontSize: 10, color: '#9184d9', background: 'rgba(145,132,217,0.12)', border: '1px solid rgba(145,132,217,0.28)', borderRadius: 20, padding: '2px 9px', letterSpacing: '0.1em' }}>
              TODAY
            </span>
          )}
        </div>

        {/* Event list */}
        <div style={{ flex: 1, overflowY: 'auto', marginBottom: 14 }}>
          {selectedEvents.length === 0 ? (
            <div style={{ fontSize: 14, color: '#595d6c', padding: '4px 0' }}>No events</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {selectedEvents.map((ev, i) => {
                const color = catColor(ev.cat, categoryMap)
                const evKey = ev.eventId ?? String(i)

                // ── Task row ────────────────────────────────────────────────────
                if (ev.type === 'task') {
                  return (
                    <div
                      key={i}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 10,
                        padding: '10px 12px', borderRadius: 12,
                        background: 'rgba(233,233,237,0.03)',
                        border: '1px solid rgba(233,233,237,0.06)',
                        opacity: ev.done ? 0.55 : 1, transition: 'opacity .25s ease',
                      }}
                    >
                      {/* Checkbox bubble */}
                      <div
                        onClick={() => ev.taskId && onTaskToggled(ev.taskId, selectedISO, !!ev.done)}
                        style={{
                          width: 22, height: 22, borderRadius: '50%', flexShrink: 0, cursor: 'pointer',
                          border: `1.5px solid ${ev.done ? color : 'rgba(233,233,237,0.25)'}`,
                          background: ev.done ? color : 'transparent',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          transition: 'all .2s ease',
                        }}
                      >
                        {ev.done && (
                          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
                            <path d="M2 6l3 3 5-5" stroke="#161826" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        )}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 14, color: ev.done ? '#595d6c' : '#e9e9ed', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textDecoration: ev.done ? 'line-through' : 'none' }}>
                          {ev.title}
                        </div>
                        {ev.time !== '—' && (
                          <div style={{ fontSize: 11, color: '#75798c', marginTop: 1 }}>{ev.time}</div>
                        )}
                      </div>
                      {ev.taskId && (
                        <button
                          onClick={() => onEditTask(ev.taskId!)}
                          title="Edit task"
                          style={{ width: 30, height: 30, borderRadius: 8, cursor: 'pointer', background: 'rgba(233,233,237,0.04)', border: '1px solid rgba(233,233,237,0.08)', color: '#9397ab', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                          </svg>
                        </button>
                      )}
                    </div>
                  )
                }

                // ── Meal log row (always done) ──────────────────────────────────
                if (ev.type === 'meal') {
                  return (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 12, background: 'rgba(233,233,237,0.03)', border: '1px solid rgba(233,233,237,0.06)', opacity: 0.55 }}>
                      <span style={{ width: 3, height: 20, borderRadius: 2, background: color, flexShrink: 0 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 14, color: '#595d6c', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textDecoration: 'line-through' }}>{ev.title}</div>
                      </div>
                    </div>
                  )
                }

                // ── Household event row ─────────────────────────────────────────
                const isConfirming = confirmDeleteKey === evKey
                return (
                  <div
                    key={i}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '10px 12px', borderRadius: 12,
                      background: isConfirming ? 'rgba(220,38,38,0.08)' : 'rgba(233,233,237,0.03)',
                      border: `1px solid ${isConfirming ? 'rgba(220,38,38,0.2)' : 'rgba(233,233,237,0.06)'}`,
                      transition: 'background .2s ease, border-color .2s ease, opacity .25s ease',
                      opacity: ev.done ? 0.55 : 1,
                    }}
                  >
                    <div
                      onClick={() => ev.eventId && onEventToggled?.(ev.eventId, selectedISO, !!ev.done)}
                      style={{
                        width: 22, height: 22, borderRadius: '50%', flexShrink: 0, cursor: 'pointer',
                        border: `1.5px solid ${ev.done ? color : 'rgba(233,233,237,0.25)'}`,
                        background: ev.done ? color : 'transparent',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        transition: 'all .2s ease',
                      }}
                    >
                      {ev.done && (
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
                          <path d="M2 6l3 3 5-5" stroke="#161826" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, color: ev.done ? '#595d6c' : '#e9e9ed', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textDecoration: ev.done ? 'line-through' : 'none' }}>{ev.title}</div>
                      {ev.time !== '—' && <div style={{ fontSize: 11, color: '#75798c', marginTop: 1 }}>{ev.time}</div>}
                    </div>
                    {isConfirming ? (
                      <div style={{ display: 'flex', gap: 5, flexShrink: 0 }}>
                        <button
                          onClick={async () => { if (ev.eventId) await onDeleteEvent(ev.eventId, selectedISO); setConfirmDeleteKey(null) }}
                          style={{ height: 28, padding: '0 10px', borderRadius: 8, cursor: 'pointer', background: 'rgba(220,38,38,0.2)', border: '1px solid rgba(220,38,38,0.4)', color: '#f87171', fontSize: 11 }}
                        >
                          Remove
                        </button>
                        <button
                          onClick={() => setConfirmDeleteKey(null)}
                          style={{ height: 28, padding: '0 8px', borderRadius: 8, cursor: 'pointer', background: 'transparent', border: '1px solid rgba(233,233,237,0.1)', color: '#75798c', fontSize: 11 }}
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setConfirmDeleteKey(evKey)}
                        title={DAILY_TASKS.CALENDAR_DELETE_EVENT}
                        style={{ width: 30, height: 30, borderRadius: 8, cursor: 'pointer', background: 'rgba(233,233,237,0.04)', border: '1px solid rgba(233,233,237,0.08)', color: '#9397ab', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                          <polyline points="3 6 5 6 21 6" />
                          <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                          <path d="M10 11v6M14 11v6" />
                          <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                        </svg>
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Add event form */}
        <div style={{ flexShrink: 0, borderTop: '1px solid rgba(233,233,237,0.06)', paddingTop: 12 }}>
          <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
            {(['personal', 'household'] as TaskScope[]).map((s) => (
              <button
                key={s}
                onClick={() => setAddScope(s)}
                style={{
                  height: 26, padding: '0 11px', borderRadius: 13, cursor: 'pointer', fontSize: 11,
                  background: addScope === s ? 'rgba(145,132,217,0.16)' : 'rgba(233,233,237,0.04)',
                  border: `1px solid ${addScope === s ? '#9184d9' : 'rgba(233,233,237,0.08)'}`,
                  color: addScope === s ? '#e9e9ed' : '#9397ab',
                  transition: 'all .2s ease',
                }}
              >
                {s === 'personal' ? DAILY_TASKS.SCOPE_PERSONAL : DAILY_TASKS.SCOPE_HOUSEHOLD}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <input
              value={addTitle}
              onChange={(e) => setAddTitle(e.target.value)}
              placeholder={DAILY_TASKS.CALENDAR_ADD_PLACEHOLDER}
              onKeyDown={(e) => { if (e.key === 'Enter') handleAdd() }}
              style={{
                flex: 1, background: 'rgba(233,233,237,0.05)',
                border: '1px solid rgba(233,233,237,0.1)',
                borderRadius: 10, padding: '9px 13px',
                fontSize: 14, color: '#e9e9ed', outline: 'none',
                transition: 'border-color .2s ease',
              }}
              onFocus={(e) => { e.currentTarget.style.borderColor = '#9184d9' }}
              onBlur={(e) => { e.currentTarget.style.borderColor = 'rgba(233,233,237,0.1)' }}
            />
            <button
              onClick={handleAdd}
              disabled={adding || !addTitle.trim()}
              style={{
                height: 40, padding: '0 15px', borderRadius: 10, cursor: adding ? 'default' : 'pointer',
                background: 'rgba(145,132,217,0.15)', border: '1px solid rgba(145,132,217,0.38)',
                color: '#b5abfc', fontSize: 13,
                opacity: adding || !addTitle.trim() ? 0.45 : 1,
                transition: 'opacity .2s ease',
              }}
            >
              {DAILY_TASKS.CALENDAR_ADD_CONFIRM}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

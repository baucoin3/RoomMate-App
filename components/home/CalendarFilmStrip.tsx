'use client'

import { useState, useRef, useEffect } from 'react'
import type { NocturneCalendarEvent, TaskScope } from '@/lib/types/dailyTasks'
import { DAILY_TASKS } from '@/locales/en'

const DOW_FULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const DOW_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function toISO(d: Date): string { return d.toLocaleDateString('en-CA') }

function addDays(base: Date, n: number): Date {
  const d = new Date(base); d.setDate(d.getDate() + n); return d
}

function catColor(cat: string, map: Record<string, string>): string {
  return map[cat] ?? 'rgba(233,233,237,0.3)'
}

interface CalendarFilmStripProps {
  events: Record<string, NocturneCalendarEvent[]>
  now: Date
  isActive: boolean
  categoryMap: Record<string, string>
  onScroll?: () => void
  onAddEvent?: (date: string, title: string, scope: TaskScope) => Promise<void>
  onEditTask?: (taskId: string) => void
  onDeleteEvent?: (eventId: string, date: string) => Promise<void>
  onTaskToggled?: (taskId: string, date: string, currentlyDone: boolean) => Promise<void>
  onEventToggled?: (eventId: string, date: string, currentlyDone: boolean) => Promise<void>
}

const FADED_RULE: React.CSSProperties = {
  height: 1, border: 0,
  background: 'linear-gradient(90deg,transparent,rgba(233,233,237,0.14) 12%,rgba(233,233,237,0.14) 88%,transparent)',
  margin: '14px 0',
}

export default function CalendarFilmStrip({
  events, now, isActive, categoryMap, onScroll,
  onAddEvent, onEditTask, onDeleteEvent, onTaskToggled, onEventToggled,
}: CalendarFilmStripProps) {
  const todayISO = toISO(now)
  const [offset, setOffset] = useState(0)

  // Inline add-event state (per active panel)
  const [addingEvent, setAddingEvent] = useState(false)
  const [newEventTitle, setNewEventTitle] = useState('')
  const [newEventScope, setNewEventScope] = useState<TaskScope>('personal')
  const [addingSaving, setAddingSaving] = useState(false)

  const panels = Array.from({ length: 9 }, (_, i) => {
    const d = addDays(now, offset - 4 + i)
    const iso = toISO(d)
    return { d, iso, isActive: i === 4, evs: events[iso] ?? [], idx: i }
  })

  function badge(iso: string) {
    if (iso === todayISO) return 'Today'
    if (iso < todayISO) return 'Past'
    return 'Upcoming'
  }

  function advance(delta: number) {
    setOffset((o) => o + delta)
    onScroll?.()
  }

  // Pointer drag (swipe) — capture is deferred until 5px of movement so that
  // simple taps on buttons still fire click events normally.
  const dragRef = useRef({ active: false, startX: 0, captured: false })
  function handlePointerDown(e: React.PointerEvent) {
    dragRef.current = { active: true, startX: e.clientX, captured: false }
  }
  function handlePointerMove(e: React.PointerEvent) {
    if (!dragRef.current.active || dragRef.current.captured) return
    if (Math.abs(e.clientX - dragRef.current.startX) > 5) {
      dragRef.current.captured = true
      ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    }
  }
  function handlePointerUp(e: React.PointerEvent) {
    if (!dragRef.current.active) return
    dragRef.current.active = false
    dragRef.current.captured = false
    const dx = e.clientX - dragRef.current.startX
    if (Math.abs(dx) > 80) advance(dx < 0 ? 1 : -1)
  }

  // Arrow keys — gated on isActive
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (!isActive) return
      if (e.key === 'ArrowLeft') { setOffset((o) => o - 1); onScroll?.() }
      if (e.key === 'ArrowRight') { setOffset((o) => o + 1); onScroll?.() }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [isActive, onScroll])

  async function handleAddEvent(iso: string) {
    const title = newEventTitle.trim()
    if (!title || !onAddEvent) return
    setAddingSaving(true)
    try {
      await onAddEvent(iso, title, newEventScope)
      setNewEventTitle('')
      setNewEventScope('personal')
      setAddingEvent(false)
    } finally {
      setAddingSaving(false)
    }
  }

  return (
    <div
      style={{ display: 'flex', flexDirection: 'column', height: '100%', paddingBottom: 26 }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={() => { dragRef.current.active = false; dragRef.current.captured = false }}
    >
      {/* Film strip row */}
      <div style={{ display: 'flex', gap: 10, flex: 1, overflow: 'hidden', userSelect: 'none' }}>
        {panels.map(({ d, iso, isActive: isPanelActive, evs, idx }) => {
          const isToday = iso === todayISO
          const lbl = badge(iso)

          if (isPanelActive) {
            return (
              <div
                key={iso}
                style={{
                  width: 528, flexShrink: 0, borderRadius: 20,
                  background: 'linear-gradient(155deg,rgba(43,39,65,0.95),rgba(22,24,38,0.72))',
                  border: '1px solid rgba(145,132,217,0.42)',
                  padding: '26px 28px',
                  position: 'relative', overflow: 'hidden',
                  transition: 'width .6s cubic-bezier(.2,.85,.2,1)',
                  display: 'flex', flexDirection: 'column',
                }}
              >
                <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', background: 'radial-gradient(120% 90% at 88% 6%,rgba(145,132,217,0.16),transparent 60%)' }} />

                {/* Header row */}
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ fontSize: 11, letterSpacing: '0.2em', color: '#b5abfc', textTransform: 'uppercase', marginBottom: 4 }}>
                      {DOW_FULL[d.getDay()]}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 14 }}>
                      <span style={{ fontSize: 66, fontWeight: 200, lineHeight: 1, color: '#e9e9ed', letterSpacing: '-0.03em' }}>{d.getDate()}</span>
                      <span style={{ fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase', color: lbl === 'Today' ? '#b5abfc' : lbl === 'Past' ? '#595d6c' : '#75798c', background: lbl === 'Today' ? 'rgba(145,132,217,0.18)' : 'rgba(233,233,237,0.06)', border: `1px solid ${lbl === 'Today' ? 'rgba(145,132,217,0.5)' : 'rgba(233,233,237,0.1)'}`, borderRadius: 20, padding: '3px 10px' }}>
                        {lbl}
                      </span>
                    </div>
                  </div>

                  {/* Add event button */}
                  {onAddEvent && (
                    <button
                      onClick={() => { setAddingEvent(true); setNewEventTitle('') }}
                      title="Add event"
                      style={{
                        width: 32, height: 32, borderRadius: 10, flexShrink: 0, marginTop: 4,
                        background: 'rgba(145,132,217,0.1)', border: '1px solid rgba(145,132,217,0.3)',
                        color: '#b5abfc', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        transition: 'background .2s ease',
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(145,132,217,0.22)' }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(145,132,217,0.1)' }}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                        <path d="M12 5v14M5 12h14" />
                      </svg>
                    </button>
                  )}
                </div>

                {/* Summary line */}
                {(() => {
                  const taskEvs = evs.filter((e) => e.type === 'task')
                  const doneCount = taskEvs.filter((e) => e.done).length
                  const otherCount = evs.filter((e) => e.type !== 'task').length
                  const parts: string[] = []
                  if (taskEvs.length > 0) parts.push(`${doneCount}/${taskEvs.length} tasks done`)
                  if (otherCount > 0) parts.push(`${otherCount} event${otherCount === 1 ? '' : 's'}`)
                  return (
                    <div style={{ fontSize: 13, color: '#75798c', marginTop: 8 }}>
                      {parts.length === 0 ? 'No events' : parts.join(' · ')}
                    </div>
                  )
                })()}
                <div style={FADED_RULE} />

                {/* Event list */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2, overflow: 'auto', flex: 1 }}>
                  {evs.length === 0 && !addingEvent ? (
                    <div style={{ fontSize: 14, color: '#595d6c', padding: '8px 0' }}>{DAILY_TASKS.NOTHING_SCHEDULED}</div>
                  ) : (
                    evs.map((ev, i) => {
                      const color = catColor(ev.cat, categoryMap)

                      // ── Task row ──────────────────────────────────────────────
                      if (ev.type === 'task') {
                        const target = ev.targetCompletionsPerDay ?? 1
                        const count = ev.completionCount ?? (ev.done ? target : 0)
                        const partial = count > 0 && !ev.done
                        return (
                          <div
                            key={i}
                            style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '9px 0', borderBottom: '1px solid rgba(233,233,237,0.04)', opacity: ev.done ? 0.55 : 1, transition: 'opacity .25s ease' }}
                          >
                            <span style={{ width: 66, fontSize: 13, fontVariantNumeric: 'tabular-nums', color: '#9397ab', flexShrink: 0 }}>{ev.time}</span>
                            {/* Checkbox bubble — partial = dashed border + color tint */}
                            <div
                              onClick={() => ev.taskId && onTaskToggled?.(ev.taskId, iso, !!ev.done)}
                              style={{
                                width: 18, height: 18, borderRadius: '50%', flexShrink: 0, cursor: 'pointer',
                                border: `1.5px ${partial ? 'dashed' : 'solid'} ${(ev.done || partial) ? color : 'rgba(233,233,237,0.3)'}`,
                                background: ev.done ? color : partial ? `${color}30` : 'transparent',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                transition: 'all .2s ease',
                              }}
                            >
                              {ev.done && (
                                <svg width="10" height="10" viewBox="0 0 12 12" fill="none" aria-hidden>
                                  <path d="M2 6l3 3 5-5" stroke="#161826" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                              )}
                            </div>
                            <span style={{ flex: 1, fontSize: 14, color: ev.done ? '#595d6c' : '#e9e9ed', textDecoration: ev.done ? 'line-through' : 'none', transition: 'all .25s ease' }}>{ev.title}</span>
                            {target > 1 && (
                              <span style={{ fontSize: 12, fontWeight: 600, color: ev.done ? '#595d6c' : color, flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>{count}/{target}</span>
                            )}
                            <span style={{ fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color, opacity: 0.85, flexShrink: 0 }}>{ev.cat}</span>
                            {ev.taskId && onEditTask && (
                              <button
                                onClick={() => onEditTask(ev.taskId!)}
                                title="Edit task"
                                style={{ width: 26, height: 26, borderRadius: 6, cursor: 'pointer', background: 'transparent', border: 'none', color: 'rgba(233,233,237,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'color .15s ease' }}
                                onMouseEnter={(e) => { e.currentTarget.style.color = '#b5abfc' }}
                                onMouseLeave={(e) => { e.currentTarget.style.color = 'rgba(233,233,237,0.25)' }}
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

                      // ── Meal log row (always done) ────────────────────────────
                      if (ev.type === 'meal') {
                        return (
                          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '9px 0', borderBottom: '1px solid rgba(233,233,237,0.04)', opacity: 0.55 }}>
                            <span style={{ width: 66, fontSize: 13, fontVariantNumeric: 'tabular-nums', color: '#9397ab', flexShrink: 0 }}>{ev.time}</span>
                            <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0, boxShadow: `0 0 6px ${color}` }} />
                            <span style={{ flex: 1, fontSize: 14, color: '#595d6c', textDecoration: 'line-through' }}>{ev.title}</span>
                            <span style={{ fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color, opacity: 0.85, flexShrink: 0 }}>{ev.cat}</span>
                          </div>
                        )
                      }

                      // ── Household event row ───────────────────────────────────
                      return (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '9px 0', borderBottom: '1px solid rgba(233,233,237,0.04)', opacity: ev.done ? 0.55 : 1, transition: 'opacity .25s ease' }}>
                          <span style={{ width: 66, fontSize: 13, fontVariantNumeric: 'tabular-nums', color: '#9397ab', flexShrink: 0 }}>{ev.time}</span>
                          <div
                            onClick={() => ev.eventId && onEventToggled?.(ev.eventId, iso, !!ev.done)}
                            style={{
                              width: 18, height: 18, borderRadius: '50%', flexShrink: 0, cursor: 'pointer',
                              border: `1.5px solid ${ev.done ? color : 'rgba(233,233,237,0.3)'}`,
                              background: ev.done ? color : 'transparent',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              transition: 'all .2s ease',
                            }}
                          >
                            {ev.done && (
                              <svg width="10" height="10" viewBox="0 0 12 12" fill="none" aria-hidden>
                                <path d="M2 6l3 3 5-5" stroke="#161826" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                              </svg>
                            )}
                          </div>
                          <span style={{ flex: 1, fontSize: 14, color: ev.done ? '#595d6c' : '#e9e9ed', textDecoration: ev.done ? 'line-through' : 'none', transition: 'all .25s ease' }}>{ev.title}</span>
                          <span style={{ fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color, opacity: 0.85, flexShrink: 0 }}>{ev.cat}</span>
                          <div style={{ display: 'flex', gap: 3, flexShrink: 0 }}>
                            <button
                              onClick={() => ev.eventId && onDeleteEvent?.(ev.eventId, iso)}
                              title="Delete event"
                              style={{ width: 26, height: 26, borderRadius: 6, cursor: 'pointer', background: 'transparent', border: 'none', color: 'rgba(233,233,237,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'color .15s ease' }}
                              onMouseEnter={(e) => { e.currentTarget.style.color = '#f87171' }}
                              onMouseLeave={(e) => { e.currentTarget.style.color = 'rgba(233,233,237,0.2)' }}
                            >
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                                <polyline points="3 6 5 6 21 6" />
                                <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                                <path d="M10 11v6M14 11v6" />
                                <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                              </svg>
                            </button>
                          </div>
                        </div>
                      )
                    })
                  )}

                  {/* Inline add-event form */}
                  {addingEvent && (
                    <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <input
                        autoFocus
                        value={newEventTitle}
                        onChange={(e) => setNewEventTitle(e.target.value)}
                        placeholder={DAILY_TASKS.CALENDAR_ADD_PLACEHOLDER}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleAddEvent(iso)
                          if (e.key === 'Escape') setAddingEvent(false)
                        }}
                        style={{
                          background: 'rgba(233,233,237,0.06)', border: '1px solid rgba(145,132,217,0.4)',
                          borderRadius: 8, padding: '8px 12px', fontSize: 14, color: '#e9e9ed', outline: 'none',
                        }}
                      />
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        {/* Scope toggle */}
                        <div style={{ display: 'flex', borderRadius: 8, overflow: 'hidden', border: '1px solid rgba(233,233,237,0.1)', flexShrink: 0 }}>
                          {(['personal', 'household'] as TaskScope[]).map((s) => (
                            <button
                              key={s}
                              onClick={() => setNewEventScope(s)}
                              style={{
                                padding: '5px 10px', fontSize: 11, cursor: 'pointer', border: 'none',
                                background: newEventScope === s ? 'rgba(145,132,217,0.2)' : 'transparent',
                                color: newEventScope === s ? '#b5abfc' : '#75798c',
                                transition: 'all .15s ease',
                              }}
                            >
                              {s === 'personal' ? 'Personal' : 'Shared'}
                            </button>
                          ))}
                        </div>
                        <div style={{ flex: 1 }} />
                        <button
                          onClick={() => setAddingEvent(false)}
                          style={{ height: 30, padding: '0 10px', borderRadius: 8, cursor: 'pointer', background: 'transparent', border: '1px solid rgba(233,233,237,0.1)', color: '#75798c', fontSize: 12 }}
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => handleAddEvent(iso)}
                          disabled={addingSaving || !newEventTitle.trim()}
                          style={{ height: 30, padding: '0 12px', borderRadius: 8, cursor: addingSaving ? 'default' : 'pointer', background: 'rgba(145,132,217,0.2)', border: '1px solid rgba(145,132,217,0.45)', color: '#b5abfc', fontSize: 12, opacity: addingSaving || !newEventTitle.trim() ? 0.5 : 1 }}
                        >
                          {addingSaving ? '…' : DAILY_TASKS.CALENDAR_ADD_CONFIRM}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )
          }

          // Quiet panel — dots from completed tasks + events/meals
          const tasksDone = evs.filter((e) => e.type === 'task' && e.done)
          const nonTaskEvs = evs.filter((e) => e.type !== 'task')
          const dotCats = Array.from(new Set([...tasksDone, ...nonTaskEvs].slice(0, 3).map((e) => e.cat)))
          return (
            <div
              key={iso}
              onClick={() => { setOffset((o) => o + (idx - 4)); setAddingEvent(false); onScroll?.() }}
              style={{
                flex: 1, minWidth: 0, borderRadius: 20,
                background: 'rgba(35,37,50,0.42)',
                border: '1px solid rgba(233,233,237,0.06)',
                padding: '22px 0', cursor: 'pointer',
                transition: 'background .5s ease',
                display: 'flex', flexDirection: 'column', alignItems: 'center', overflow: 'hidden',
              }}
            >
              <div style={{ fontSize: 9, letterSpacing: '0.18em', textTransform: 'uppercase', color: isToday ? '#b5abfc' : '#595d6c', marginBottom: 6 }}>
                {DOW_SHORT[d.getDay()][0]}
              </div>
              <div style={{ fontSize: 28, fontWeight: 300, color: isToday ? '#d2cefd' : '#75798c', lineHeight: 1 }}>
                {d.getDate()}
              </div>
              <div style={{ flex: 1 }} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'center', paddingBottom: 10 }}>
                {dotCats.map((cat) => (
                  <div key={cat} style={{ width: 5, height: 5, borderRadius: '50%', background: catColor(cat, categoryMap), opacity: 0.8 }} />
                ))}
              </div>
            </div>
          )
        })}
      </div>

      {/* Controls + legend */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 16 }}>
        {/* Category legend — dynamic from categoryMap */}
        <div style={{ display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
          {Object.entries(categoryMap).map(([name, color]) => (
            <div key={name} style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <div style={{ width: 11, height: 11, borderRadius: '50%', background: color, boxShadow: `0 0 5px ${color}88`, flexShrink: 0 }} />
              <span style={{ fontSize: 13, fontWeight: 500, color: '#9397ab', textTransform: 'capitalize' }}>{name}</span>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
          {[{ onClick: () => advance(-1), d: 'M15 18l-6-6 6-6' }, { onClick: () => advance(1), d: 'M9 18l6-6-6-6' }].map((btn, i) => (
            <button
              key={i}
              onClick={btn.onClick}
              style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(233,233,237,0.06)', border: '1px solid rgba(233,233,237,0.1)', color: '#9397ab', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d={btn.d} />
              </svg>
            </button>
          ))}
          <button
            onClick={() => { setOffset(0); onScroll?.() }}
            style={{ height: 36, padding: '0 14px', borderRadius: 10, background: 'rgba(233,233,237,0.06)', border: '1px solid rgba(233,233,237,0.1)', color: '#9397ab', cursor: 'pointer', fontSize: 12 }}
          >
            Today
          </button>
        </div>
      </div>
    </div>
  )
}

'use client'

import { useRef, useEffect, useState } from 'react'
import type { DailyTask, NocturneCalendarEvent } from '@/lib/types/dailyTasks'
import type { SoundEngine } from './SoundEngine'
import BurstAnimation from './BurstAnimation'
import { DAILY_TASKS } from '@/locales/en'

const THETA = 0.202
const R = 1180
const CARD_W = 236
const CARD_H = 296
const DRAG_THRESHOLD = 6

function catColor(cat: string, map: Record<string, string>): string {
  return map[cat] ?? 'rgba(233,233,237,0.3)'
}

function catColorWithAlpha(cat: string, map: Record<string, string>, alpha: number): string {
  const c = catColor(cat, map)
  // Works for both oklch(...) and rgba(...) formats
  return c.endsWith(')') ? c.slice(0, -1) + ` / ${alpha.toFixed(2)})` : c
}

function formatTaskTime(timeOfDay: string | null): string {
  if (!timeOfDay) return ''
  const [hStr, mStr] = timeOfDay.split(':')
  const h = parseInt(hStr, 10)
  const period = h < 12 ? 'AM' : 'PM'
  const h12 = h % 12 === 0 ? 12 : h % 12
  return `${h12}:${mStr} ${period}`
}

function timeOfDayToMins(timeOfDay: string): number {
  const [hStr, mStr] = timeOfDay.split(':')
  return parseInt(hStr, 10) * 60 + parseInt(mStr, 10)
}

function capitalizeFirst(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : ''
}

interface WheelPanelProps {
  tasks: DailyTask[]
  now: Date
  isActive: boolean
  categoryMap: Record<string, string>
  soundRef: { current: SoundEngine | null }
  springNonce: number
  springIndex: number
  onComplete: (taskId: string) => Promise<{ isFullyDone: boolean }>
  onUncomplete: (taskId: string) => Promise<void>
  onEditTask: (task: DailyTask) => void
  onDeleteTask: (taskId: string) => Promise<void>
  todayEvents: NocturneCalendarEvent[]
  onJackpot?: () => void
}

export default function WheelPanel({
  tasks, now, isActive, categoryMap, soundRef,
  springNonce, springIndex, onComplete, onUncomplete, onEditTask, onDeleteTask, onJackpot, todayEvents,
}: WheelPanelProps) {
  const nowMins = now.getHours() * 60 + now.getMinutes()
  const posRef = useRef(0)
  const targetRef = useRef(0)
  const [pos, setPos] = useState(0)
  const rafRef = useRef<number | null>(null)
  const lastDetentRef = useRef(0)
  const [burst, setBurst] = useState<{ color: string; key: number; scale?: number } | null>(null)
  const completingRef = useRef(false)
  const [wheelToast, setWheelToast] = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const wheelToastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const prevNonceRef = useRef(springNonce)
  useEffect(() => {
    if (springNonce === prevNonceRef.current) return
    prevNonceRef.current = springNonce
    targetRef.current = Math.max(0, Math.min(tasks.length - 1, springIndex))
    startSpring()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [springNonce])

  function startSpring() {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
    function tick() {
      const diff = targetRef.current - posRef.current
      if (Math.abs(diff) < 0.0008) {
        posRef.current = targetRef.current
        setPos(posRef.current)
        rafRef.current = null
        return
      }
      posRef.current += diff * 0.17
      const rounded = Math.round(posRef.current)
      if (rounded !== lastDetentRef.current) {
        lastDetentRef.current = rounded
        soundRef.current?.playDetent()
      }
      setPos(posRef.current)
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
  }

  function springTo(index: number) {
    targetRef.current = Math.max(0, Math.min(tasks.length - 1, index))
    startSpring()
  }

  const arcContainerRef = useRef<HTMLDivElement>(null)
  const lastScrollRef = useRef(0)

  // Attach wheel listener with { passive: false } to allow preventDefault
  useEffect(() => {
    const el = arcContainerRef.current
    if (!el) return
    function onWheel(e: WheelEvent) {
      e.preventDefault()
      const now = Date.now()
      if (now - lastScrollRef.current < 110) return
      lastScrollRef.current = now
      const delta = e.deltaY || e.deltaX
      springTo(Math.round(targetRef.current) + (delta > 0 ? 1 : -1))
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const dragRef = useRef({ active: false, dragging: false, startX: 0, startY: 0, startTarget: 0, pointerId: -1 })

  function handlePointerDown(e: React.PointerEvent) {
    if (rafRef.current !== null) { cancelAnimationFrame(rafRef.current); rafRef.current = null }
    targetRef.current = posRef.current
    dragRef.current = { active: true, dragging: false, startX: e.clientX, startY: e.clientY, startTarget: posRef.current, pointerId: e.pointerId }
  }

  function handlePointerMove(e: React.PointerEvent) {
    const drag = dragRef.current
    if (!drag.active) return
    const dx = e.clientX - drag.startX
    if (!drag.dragging) {
      if (Math.hypot(dx, e.clientY - drag.startY) <= DRAG_THRESHOLD) return
      drag.dragging = true
      ;(e.currentTarget as HTMLElement).setPointerCapture(drag.pointerId)
    }
    const raw = drag.startTarget - dx / 190
    targetRef.current = Math.max(0, Math.min(tasks.length - 1, raw))
    if (rafRef.current === null) startSpring()
  }

  function handlePointerUp() {
    const drag = dragRef.current
    if (!drag.active) return
    drag.active = false
    drag.dragging = false
    targetRef.current = Math.round(posRef.current)
    startSpring()
  }

  // Arrow keys — gated on isActive
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (!isActive) return
      if (e.key === 'ArrowLeft') {
        targetRef.current = Math.max(0, Math.round(targetRef.current) - 1)
        startSpring()
      }
      if (e.key === 'ArrowRight') {
        targetRef.current = Math.min(tasks.length - 1, Math.round(targetRef.current) + 1)
        startSpring()
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive, tasks.length])

  function showWheelToast(msg: string) {
    if (wheelToastTimerRef.current) clearTimeout(wheelToastTimerRef.current)
    setWheelToast(msg)
    wheelToastTimerRef.current = setTimeout(() => setWheelToast(null), 2400)
  }

  async function handleCardClick(task: DailyTask, cardIndex: number) {
    if (Math.abs(cardIndex - posRef.current) >= 0.35) { springTo(cardIndex); return }
    if (completingRef.current) return
    completingRef.current = true
    soundRef.current?.playTap()
    try {
      if (task.done) {
        await onUncomplete(task.id)
      } else {
        const { isFullyDone } = await onComplete(task.id)
        soundRef.current?.playComplete()
        const color = catColor(task.category, categoryMap)
        if (isFullyDone) {
          setBurst({ color, key: Date.now() })
          if (onJackpot && Math.random() < 0.15) {
            onJackpot()
          }
        } else {
          const newCount = task.completionCount + 1
          setBurst({ color, key: Date.now(), scale: 0.42 })
          showWheelToast(DAILY_TASKS.TOAST_PARTIAL(newCount, task.targetCompletionsPerDay))
        }
      }
    } finally {
      completingRef.current = false
    }
  }

  const centreIndex = Math.round(pos)
  const centreTask = tasks[centreIndex]
  const centreLabel = centreTask ? capitalizeFirst(centreTask.category) : ''

  return (
    <div
      style={{
        position: 'relative', height: '100%',
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        paddingTop: 24, paddingBottom: 26,
      }}
    >
      {/* Above-arc eyebrow */}
      <div style={{ textAlign: 'center', marginBottom: 18 }}>
        {(() => {
          const glowColor = centreTask ? (categoryMap[centreTask.category] ?? '#75798c') : '#75798c'
          return (
            <div style={{
              fontSize: 12, letterSpacing: '0.2em', textTransform: 'uppercase', minHeight: 16, fontWeight: 600,
              color: centreTask ? glowColor : '#75798c',
              textShadow: centreTask ? `0 0 18px ${glowColor}90, 0 0 40px ${glowColor}40` : 'none',
              transition: 'color .4s ease, text-shadow .4s ease',
            }}>
              {centreLabel}
            </div>
          )
        })()}
        {tasks.length > 0 && (
          <div style={{ fontSize: 12, color: '#595d6c', marginTop: 4 }}>{DAILY_TASKS.HINT_COMPLETE}</div>
        )}
      </div>


      {/* Arc container */}
      <div
        ref={arcContainerRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        style={{
          position: 'relative', width: '100%', height: CARD_H + 60,
          overflow: 'hidden', cursor: 'grab', userSelect: 'none',
          touchAction: 'none', flex: 1,
        }}
      >
        {tasks.length === 0 ? (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, color: '#595d6c' }}>
            Add your first task to get started
          </div>
        ) : (
          tasks.map((task, cardIndex) => {
            const o = cardIndex - pos
            if (Math.abs(o) > 4.6) return null

            const a = o * THETA
            const x = Math.sin(a) * R
            const y = (1 - Math.cos(a)) * R
            const rot = a * (180 / Math.PI)
            const scale = Math.max(0.58, 1 - Math.abs(o) * 0.085)
            const opacity = Math.max(0, 1 - Math.abs(o) * 0.2)
            const focus = Math.max(0, 1 - Math.abs(o))
            const zIdx = 200 - Math.round(Math.abs(o) * 20)
            const color = catColor(task.category, categoryMap)
            const taskMins = task.timeOfDay ? timeOfDayToMins(task.timeOfDay) : null
            const done = task.done
            const isOverdue = taskMins !== null && nowMins > taskMins && !done
            const isCenter = Math.abs(o) < 0.35

            return (
              <div
                key={task.id}
                onClick={() => handleCardClick(task, cardIndex)}
                style={{
                  position: 'absolute', left: '50%', top: 0,
                  width: CARD_W, height: CARD_H, padding: 22,
                  borderRadius: 22,
                  background: done
                    ? 'rgba(30,32,44,0.62)'
                    : 'linear-gradient(160deg,rgba(35,37,50,0.9),rgba(20,22,34,0.86))',
                  backdropFilter: `blur(${(6 + focus * 8).toFixed(1)}px)`,
                  border: `1px solid ${
                    isOverdue ? 'rgba(220,38,38,0.4)'
                      : focus > 0.5 ? 'rgba(145,132,217,0.5)'
                      : 'rgba(233,233,237,0.09)'
                  }`,
                  boxShadow: [
                    `0 ${(14 + focus * 20).toFixed(0)}px ${(34 + focus * 30).toFixed(0)}px rgba(0,0,0,${(0.4 + focus * 0.2).toFixed(2)})`,
                    `0 0 ${(focus * 52).toFixed(0)}px ${catColorWithAlpha(task.category, categoryMap, focus * 0.32)}`,
                    isOverdue ? 'inset 0 0 0 1px rgba(220,38,38,0.2), 0 0 28px rgba(220,38,38,0.14)' : '',
                  ].filter(Boolean).join(', '),
                  transform: `translate(-50%,0) translate(${x.toFixed(2)}px,${y.toFixed(2)}px) rotate(${rot.toFixed(3)}deg) scale(${scale.toFixed(3)})`,
                  opacity, zIndex: zIdx,
                  cursor: Math.abs(o) < 0.35 ? 'pointer' : 'grab',
                  display: 'flex', flexDirection: 'column', boxSizing: 'border-box',
                  transition: 'border-color .3s ease',
                }}
              >
                {/* Top row: category eyebrow + edit/delete icons */}
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                  <div style={{ fontSize: 11, letterSpacing: '0.18em', textTransform: 'uppercase', color: done ? '#595d6c' : color }}>
                    {capitalizeFirst(task.category)}
                  </div>
                  {confirmDeleteId === task.id ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      <span style={{ fontSize: 11, color: '#f87171', whiteSpace: 'nowrap' }}>{DAILY_TASKS.CONFIRM_DELETE_TASK}</span>
                      <button
                        onClick={(e) => { e.stopPropagation(); void onDeleteTask(task.id).then(() => setConfirmDeleteId(null)) }}
                        style={{ height: 24, padding: '0 9px', borderRadius: 7, cursor: 'pointer', background: 'rgba(220,38,38,0.18)', border: '1px solid rgba(220,38,38,0.45)', color: '#f87171', fontSize: 11, fontWeight: 500, whiteSpace: 'nowrap' }}
                      >
                        {DAILY_TASKS.CONFIRM_DELETE_YES}
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(null) }}
                        style={{ width: 24, height: 24, borderRadius: 7, cursor: 'pointer', background: 'rgba(233,233,237,0.06)', border: '1px solid rgba(233,233,237,0.1)', color: '#75798c', fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                      >
                        ✕
                      </button>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <button
                        onClick={(e) => { e.stopPropagation(); onEditTask(task) }}
                        title="Edit task"
                        style={{ width: 28, height: 28, borderRadius: 8, cursor: 'pointer', background: 'rgba(233,233,237,0.06)', border: '1px solid rgba(233,233,237,0.1)', color: '#9397ab', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, transition: 'all .2s ease' }}
                        onMouseEnter={(e) => { e.currentTarget.style.color = '#b5abfc'; e.currentTarget.style.borderColor = 'rgba(145,132,217,0.4)' }}
                        onMouseLeave={(e) => { e.currentTarget.style.color = '#9397ab'; e.currentTarget.style.borderColor = 'rgba(233,233,237,0.1)' }}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                        </svg>
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(task.id) }}
                        title="Delete task"
                        style={{ width: 28, height: 28, borderRadius: 8, cursor: 'pointer', background: 'rgba(233,233,237,0.06)', border: '1px solid rgba(233,233,237,0.1)', color: '#9397ab', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, transition: 'all .2s ease' }}
                        onMouseEnter={(e) => { e.currentTarget.style.color = '#f87171'; e.currentTarget.style.borderColor = 'rgba(220,38,38,0.4)' }}
                        onMouseLeave={(e) => { e.currentTarget.style.color = '#9397ab'; e.currentTarget.style.borderColor = 'rgba(233,233,237,0.1)' }}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                          <polyline points="3 6 5 6 21 6" />
                          <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                          <path d="M10 11v6M14 11v6" />
                          <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                        </svg>
                      </button>
                    </div>
                  )}
                </div>

                {/* Check circle */}
                <div style={{ marginTop: 14 }}>
                  <div
                    style={{
                      width: 22, height: 22, borderRadius: '50%',
                      border: `1.5px solid ${done ? color : 'rgba(233,233,237,0.25)'}`,
                      background: done ? color : 'transparent',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      transition: 'all .3s ease',
                    }}
                  >
                    {done && (
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
                        <path d="M2 6l3 3 5-5" stroke="#161826" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </div>
                </div>

                {/* Title */}
                <div style={{ fontSize: 20, fontWeight: 400, color: done ? '#75798c' : '#e9e9ed', marginTop: 14, lineHeight: 1.3, flex: 1, textDecoration: done ? 'line-through' : 'none', overflowWrap: 'break-word' }}>
                  {task.title}
                </div>

                {/* Multi-tap counter */}
                {task.targetCompletionsPerDay > 1 && (
                  <div style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.02em', color: done ? '#595d6c' : color, marginTop: 8, lineHeight: 1, textShadow: done ? 'none' : `0 0 20px ${color}80` }}>
                    {task.completionCount}/{task.targetCompletionsPerDay}
                  </div>
                )}

                {/* Time */}
                <div style={{ fontSize: 12, fontVariantNumeric: 'tabular-nums', color: done ? '#595d6c' : '#75798c', marginTop: task.targetCompletionsPerDay > 1 ? 4 : 8 }}>
                  {formatTaskTime(task.timeOfDay)}
                </div>

                {/* Gradient bar */}
                <div style={{ height: 2, borderRadius: 1, marginTop: 10, background: done ? 'rgba(233,233,237,0.06)' : `linear-gradient(90deg,${color},transparent)` }} />
              </div>
            )
          })
        )}

        {burst && (
          <div style={{ position: 'absolute', left: '50%', top: 0, transform: 'translateX(-50%)', pointerEvents: 'none' }}>
            <BurstAnimation key={burst.key} color={burst.color} scale={burst.scale} onDone={() => setBurst(null)} />
          </div>
        )}
      </div>

      {/* Progress pips */}
      {tasks.length > 0 && (
        <div style={{ display: 'flex', gap: 5, marginTop: 14, alignItems: 'center' }}>
          {tasks.map((_, i) => {
            const active = centreIndex === i
            return (
              <div
                key={i}
                onClick={() => springTo(i)}
                style={{
                  width: active ? 26 : 5, height: 5, borderRadius: 3,
                  background: active ? '#9184d9' : 'rgba(233,233,237,0.15)',
                  cursor: 'pointer',
                  transition: 'width .35s ease, background .35s ease',
                }}
              />
            )
          })}
        </div>
      )}

      {/* Partial completion toast */}
      {wheelToast && (
        <div style={{ position: 'absolute', bottom: 60, left: '50%', transform: 'translateX(-50%)', background: 'rgba(22,24,38,0.96)', border: '1px solid rgba(145,132,217,0.4)', borderRadius: 24, padding: '8px 18px', fontSize: 13, color: '#e9e9ed', whiteSpace: 'nowrap', pointerEvents: 'none', zIndex: 10 }}>
          {wheelToast}
        </div>
      )}
    </div>
  )
}

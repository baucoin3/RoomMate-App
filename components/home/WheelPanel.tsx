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
  onComplete: (taskId: string) => Promise<void>
  onUncomplete: (taskId: string) => Promise<void>
  todayEvents: NocturneCalendarEvent[]
  onJackpot?: () => void
}

export default function WheelPanel({
  tasks, now, isActive, categoryMap, soundRef,
  springNonce, springIndex, onComplete, onUncomplete, onJackpot, todayEvents,
}: WheelPanelProps) {
  const nowMins = now.getHours() * 60 + now.getMinutes()
  const posRef = useRef(0)
  const targetRef = useRef(0)
  const [pos, setPos] = useState(0)
  const rafRef = useRef<number | null>(null)
  const lastDetentRef = useRef(0)
  const [burst, setBurst] = useState<{ color: string; key: number } | null>(null)
  const completingRef = useRef(false)

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

  const lastScrollRef = useRef(0)
  function handleWheel(e: React.WheelEvent) {
    e.preventDefault()
    const now = Date.now()
    if (now - lastScrollRef.current < 110) return
    lastScrollRef.current = now
    const delta = e.deltaY || e.deltaX
    springTo(Math.round(targetRef.current) + (delta > 0 ? 1 : -1))
  }

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

  function isTaskDone(taskId: string): boolean {
    return todayEvents.some((e) => e.taskId === taskId && e.done === true)
  }

  async function handleCardClick(task: DailyTask, cardIndex: number) {
    if (Math.abs(cardIndex - posRef.current) >= 0.35) { springTo(cardIndex); return }
    if (completingRef.current) return
    completingRef.current = true
    soundRef.current?.playTap()
    const done = isTaskDone(task.id)
    try {
      if (done) {
        await onUncomplete(task.id)
      } else {
        await onComplete(task.id)
        soundRef.current?.playComplete()
        const color = catColor(task.category, categoryMap)
        setBurst({ color, key: Date.now() })
        if (onJackpot && Math.random() < 0.15) {
          onJackpot()
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
        onWheel={handleWheel}
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
            const done = isTaskDone(task.id)
            const isOverdue = taskMins !== null && nowMins > taskMins && !done

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
                {/* Category eyebrow */}
                <div style={{ fontSize: 11, letterSpacing: '0.18em', textTransform: 'uppercase', color: done ? '#595d6c' : color }}>
                  {capitalizeFirst(task.category)}
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

                {/* Time */}
                <div style={{ fontSize: 12, fontVariantNumeric: 'tabular-nums', color: done ? '#595d6c' : '#75798c', marginTop: 8 }}>
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
            <BurstAnimation key={burst.key} color={burst.color} onDone={() => setBurst(null)} />
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
    </div>
  )
}

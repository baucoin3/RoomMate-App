'use client'

import { useRef, useEffect, useState } from 'react'
import type { DailyTask } from '@/lib/types/dailyTasks'
import type { SoundEngine } from './SoundEngine'
import BurstAnimation from './BurstAnimation'
import { DAILY_TASKS } from '@/locales/en'

const DRAG_THRESHOLD = 8

function catColor(cat: string, map: Record<string, string>): string {
  return map[cat] ?? 'rgba(233,233,237,0.3)'
}

function catColorAlpha(cat: string, map: Record<string, string>, alpha: number): string {
  const c = catColor(cat, map)
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

function capitalizeFirst(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : ''
}

function timeToMins(t: string): number {
  const [h, m] = t.split(':')
  return parseInt(h, 10) * 60 + parseInt(m, 10)
}

interface MobileTaskCardProps {
  tasks: DailyTask[]
  now: Date
  categoryMap: Record<string, string>
  soundRef: { current: SoundEngine | null }
  springNonce: number
  springIndex: number
  onComplete: (taskId: string) => Promise<void>
  onUncomplete: (taskId: string) => Promise<void>
  onJackpot?: () => void
}

export default function MobileTaskCard({
  tasks, now, categoryMap, soundRef, springNonce, springIndex, onComplete, onUncomplete, onJackpot,
}: MobileTaskCardProps) {
  const nowMins = now.getHours() * 60 + now.getMinutes()
  const containerRef = useRef<HTMLDivElement>(null)
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
    const containerW = containerRef.current?.offsetWidth ?? 340
    const raw = drag.startTarget - dx / (containerW * 0.85)
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

  async function handleCompleteCard(task: DailyTask) {
    if (completingRef.current) return
    completingRef.current = true
    soundRef.current?.playTap()
    try {
      if (task.done) {
        await onUncomplete(task.id)
      } else {
        await onComplete(task.id)
        const willBeFullyDone = task.completionCount + 1 >= task.targetCompletionsPerDay
        if (willBeFullyDone) {
          soundRef.current?.playComplete()
          setBurst({ color: catColor(task.category, categoryMap), key: Date.now() })
          if (onJackpot && Math.random() < 0.15) onJackpot()
        }
      }
    } finally {
      completingRef.current = false
    }
  }

  if (tasks.length === 0) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', flexDirection: 'column', gap: 10 }}>
        <div style={{ fontSize: 15, color: '#595d6c' }}>{DAILY_TASKS.MOBILE_MANAGE_EMPTY}</div>
      </div>
    )
  }

  const centreIndex = Math.round(pos)
  const centreTask = tasks[centreIndex]
  const glowColor = centreTask ? (categoryMap[centreTask.category] ?? '#75798c') : '#75798c'

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {/* Category eyebrow */}
      <div style={{ textAlign: 'center', marginBottom: 10, flexShrink: 0 }}>
        <div style={{
          fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase', minHeight: 14, fontWeight: 600,
          color: centreTask ? glowColor : '#75798c',
          textShadow: centreTask ? `0 0 18px ${glowColor}90, 0 0 40px ${glowColor}40` : 'none',
          transition: 'color .4s ease, text-shadow .4s ease',
        }}>
          {centreTask ? capitalizeFirst(centreTask.category) : ''}
        </div>
      </div>

      {/* Card carousel */}
      <div
        ref={containerRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        style={{
          position: 'relative', height: 260, overflow: 'hidden',
          cursor: 'grab', userSelect: 'none', touchAction: 'pan-y',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        {tasks.map((task, cardIndex) => {
          const o = cardIndex - pos
          if (Math.abs(o) > 2.5) return null

          const containerW = containerRef.current?.offsetWidth ?? 340
          const tx = o * (containerW * 0.86)
          const scale = Math.max(0.82, 1 - Math.abs(o) * 0.1)
          const opacity = Math.max(0, 1 - Math.abs(o) * 0.5)
          const isCentre = Math.abs(o) < 0.35
          const color = catColor(task.category, categoryMap)
          const taskMins = task.timeOfDay ? timeToMins(task.timeOfDay) : null
          const done = task.done
          const isPartial = task.completionCount > 0 && !done
          const isOverdue = taskMins !== null && nowMins > taskMins && !done
          const zIdx = 10 - Math.round(Math.abs(o) * 2)

          return (
            <div
              key={task.id}
              style={{
                position: 'absolute',
                width: 'calc(100% - 40px)',
                maxWidth: 360,
                borderRadius: 24,
                padding: '20px 22px 22px',
                background: done
                  ? 'rgba(30,32,44,0.72)'
                  : 'linear-gradient(160deg,rgba(35,37,50,0.96),rgba(20,22,34,0.9))',
                backdropFilter: `blur(${(8 + (1 - Math.abs(o)) * 6).toFixed(1)}px)`,
                border: `1px solid ${
                  isOverdue ? 'rgba(220,38,38,0.4)'
                    : isCentre ? 'rgba(145,132,217,0.5)'
                    : 'rgba(233,233,237,0.09)'
                }`,
                boxShadow: [
                  `0 ${(12 + (1 - Math.abs(o)) * 22).toFixed(0)}px ${(28 + (1 - Math.abs(o)) * 28).toFixed(0)}px rgba(0,0,0,${(0.38 + (1 - Math.abs(o)) * 0.2).toFixed(2)})`,
                  isCentre ? `0 0 36px ${catColorAlpha(task.category, categoryMap, 0.2)}` : '',
                  isOverdue && !done ? '0 0 20px rgba(220,38,38,0.1)' : '',
                ].filter(Boolean).join(', '),
                transform: `translateX(${tx.toFixed(1)}px) scale(${scale.toFixed(3)})`,
                opacity,
                zIndex: zIdx,
                display: 'flex', flexDirection: 'column', boxSizing: 'border-box',
                pointerEvents: isCentre ? 'auto' : 'none',
                transition: 'border-color .3s ease',
              }}
            >
              {/* Color bar at top */}
              <div style={{ height: 3, borderRadius: 2, marginBottom: 18, background: done ? 'rgba(233,233,237,0.06)' : `linear-gradient(90deg,${color},transparent)` }} />

              {/* Category + check bubble */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <div style={{ fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase', color: done ? '#595d6c' : color }}>
                  {capitalizeFirst(task.category)}
                </div>
                <div
                  style={{
                    width: 22, height: 22, borderRadius: '50%',
                    border: `1.5px ${isPartial ? 'dashed' : 'solid'} ${done || isPartial ? color : 'rgba(233,233,237,0.22)'}`,
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
              <div style={{ fontSize: 24, fontWeight: 400, color: done ? '#75798c' : '#e9e9ed', lineHeight: 1.3, overflowWrap: 'break-word', textDecoration: done ? 'line-through' : 'none', flex: 1 }}>
                {task.title}
              </div>

              {/* Multi-completion counter */}
              {task.targetCompletionsPerDay > 1 && (
                <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em', color: done ? '#595d6c' : color, marginTop: 8, lineHeight: 1, textShadow: done ? 'none' : `0 0 16px ${color}70` }}>
                  {task.completionCount}/{task.targetCompletionsPerDay}
                </div>
              )}

              {/* Time + overdue */}
              {task.timeOfDay && (
                <div style={{ fontSize: 13, fontVariantNumeric: 'tabular-nums', color: done ? '#595d6c' : '#75798c', marginTop: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
                  {formatTaskTime(task.timeOfDay)}
                  {isOverdue && !done && <span style={{ fontSize: 10, color: 'rgba(220,38,38,0.7)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>overdue</span>}
                </div>
              )}

              {/* Done / Undo button — only on centre card */}
              {isCentre && (
                <button
                  onClick={() => handleCompleteCard(task)}
                  style={{
                    marginTop: 20, height: 48, borderRadius: 14, cursor: 'pointer',
                    fontSize: 15, fontWeight: 500,
                    background: done ? 'rgba(233,233,237,0.06)' : 'rgba(145,132,217,0.18)',
                    border: `1px solid ${done ? 'rgba(233,233,237,0.12)' : 'rgba(145,132,217,0.45)'}`,
                    color: done ? '#75798c' : '#b5abfc',
                    boxShadow: done ? 'none' : '0 0 16px rgba(145,132,217,0.14)',
                    transition: 'all .25s ease',
                    width: '100%',
                  }}
                >
                  {done ? DAILY_TASKS.MOBILE_UNDO_BTN : isPartial ? DAILY_TASKS.MOBILE_TAP_AGAIN_BTN : DAILY_TASKS.MOBILE_DONE_BTN}
                </button>
              )}
            </div>
          )
        })}

        {burst && (
          <div style={{ position: 'absolute', left: '50%', top: '30%', transform: 'translateX(-50%)', pointerEvents: 'none', zIndex: 50 }}>
            <BurstAnimation key={burst.key} color={burst.color} onDone={() => setBurst(null)} />
          </div>
        )}
      </div>

      {/* Arrows + pips */}
      <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 14, justifyContent: 'center', padding: '14px 0 6px' }}>
        <button
          onClick={() => { soundRef.current?.playDetent(); springTo(Math.max(0, centreIndex - 1)) }}
          disabled={centreIndex <= 0}
          style={{
            width: 36, height: 36, borderRadius: 10,
            cursor: centreIndex <= 0 ? 'default' : 'pointer',
            background: 'rgba(233,233,237,0.05)', border: '1px solid rgba(233,233,237,0.1)',
            color: '#9397ab', display: 'flex', alignItems: 'center', justifyContent: 'center',
            opacity: centreIndex <= 0 ? 0.25 : 1, transition: 'opacity .2s ease',
          }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>

        <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
          {tasks.map((_, i) => {
            const active = centreIndex === i
            return (
              <div
                key={i}
                onClick={() => springTo(i)}
                style={{
                  width: active ? 22 : 5, height: 5, borderRadius: 3,
                  background: active ? '#9184d9' : 'rgba(233,233,237,0.15)',
                  cursor: 'pointer',
                  transition: 'width .35s ease, background .35s ease',
                }}
              />
            )
          })}
        </div>

        <button
          onClick={() => { soundRef.current?.playDetent(); springTo(Math.min(tasks.length - 1, centreIndex + 1)) }}
          disabled={centreIndex >= tasks.length - 1}
          style={{
            width: 36, height: 36, borderRadius: 10,
            cursor: centreIndex >= tasks.length - 1 ? 'default' : 'pointer',
            background: 'rgba(233,233,237,0.05)', border: '1px solid rgba(233,233,237,0.1)',
            color: '#9397ab', display: 'flex', alignItems: 'center', justifyContent: 'center',
            opacity: centreIndex >= tasks.length - 1 ? 0.25 : 1, transition: 'opacity .2s ease',
          }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M9 18l6-6-6-6" />
          </svg>
        </button>
      </div>

      {tasks.length > 0 && (
        <div style={{ display: 'flex', justifyContent: 'center', paddingBottom: 4 }}>
          <div style={{
            fontSize: 11, letterSpacing: '0.12em', color: '#9184d9',
            background: 'rgba(145,132,217,0.1)',
            border: '1px solid rgba(145,132,217,0.2)',
            borderRadius: 20, padding: '3px 14px',
            boxShadow: '0 0 10px rgba(145,132,217,0.15)',
          }}>
            {centreIndex + 1} / {tasks.length}
          </div>
        </div>
      )}
    </div>
  )
}

'use client'

import type { DailyTask, NocturneCalendarEvent, WeeklyRate, TaskStruggleStat } from '@/lib/types/dailyTasks'
import { DAILY_TASKS } from '@/locales/en'

function timeToMinutes(t: string): number {
  const m = /^(\d+):(\d+)\s*(AM|PM)$/i.exec(t.trim())
  if (!m) return 99999
  let h = parseInt(m[1], 10) % 12
  if (m[3].toUpperCase() === 'PM') h += 12
  return h * 60 + parseInt(m[2], 10)
}

function catColor(cat: string, map: Record<string, string>): string {
  return map[cat] ?? 'rgba(233,233,237,0.3)'
}

interface TodayPanelProps {
  tasks: DailyTask[]
  events: NocturneCalendarEvent[]
  weeklyRate: WeeklyRate
  categoryMap: Record<string, string>
  now: Date
  struggleStats: TaskStruggleStat[]
}

const FADED_RULE: React.CSSProperties = {
  height: 1, border: 0,
  background: 'linear-gradient(90deg,transparent,rgba(233,233,237,0.12) 12%,rgba(233,233,237,0.12) 88%,transparent)',
  margin: '12px 0',
}

export default function TodayPanel({ tasks, events, categoryMap, now, struggleStats }: TodayPanelProps) {
  void now

  const doneCount = tasks.filter((t) => t.done).length
  const totalCount = tasks.length
  const ringOffset = totalCount === 0 ? 0 : 339.3 * (1 - doneCount / totalCount)
  const remaining = totalCount - doneCount
  const pct = totalCount === 0 ? 0 : Math.round((doneCount / totalCount) * 100)

  // Unified list: incomplete items first, then completed
  const todoItems = events
    .filter((ev) => ev.type !== 'task' || !ev.done)
    .sort((a, b) => {
      if (a.time === '—' && b.time === '—') return 0
      if (a.time === '—') return 1
      if (b.time === '—') return -1
      return timeToMinutes(a.time) - timeToMinutes(b.time)
    })
  const completedItems = events.filter((ev) => ev.type === 'task' && ev.done)

  const struggling = struggleStats.filter((s) => s.isStruggling)
  const doingWell = struggleStats.filter((s) => !s.isStruggling)

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '1.35fr 1fr',
        gridTemplateRows: 'auto 1fr',
        gap: 16,
        height: '100%',
        paddingBottom: 26,
      }}
    >
      {/* Left panel — unified task + event list (spans both rows) */}
      <div
        style={{
          gridRow: '1 / span 2',
          border: '1px solid rgba(233,233,237,0.07)',
          borderRadius: 20,
          background: 'linear-gradient(155deg,rgba(35,37,50,0.92),rgba(22,24,38,0.6))',
          padding: '30px 32px',
          display: 'flex', flexDirection: 'column',
          overflow: 'hidden', position: 'relative',
        }}
      >
        <div style={{ position: 'absolute', right: -90, top: -90, width: 300, height: 300, borderRadius: '50%', background: 'radial-gradient(circle,rgba(145,132,217,0.14),transparent 65%)', pointerEvents: 'none' }} />

        <div style={{ fontSize: 11, letterSpacing: '0.2em', color: '#75798c', textTransform: 'uppercase', marginBottom: 16 }}>
          {DAILY_TASKS.TODAY_TODO_LABEL}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, overflowY: 'auto', flex: 1 }}>
          {todoItems.length === 0 && completedItems.length === 0 ? (
            <div style={{ fontSize: 14, color: '#595d6c', padding: '8px 0' }}>{DAILY_TASKS.NOTHING_SCHEDULED}</div>
          ) : (
            todoItems.map((ev, i) => {
              const color = catColor(ev.cat, categoryMap)
              return (
                <div
                  key={i}
                  style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '11px 0', borderBottom: '1px solid rgba(233,233,237,0.04)' }}
                >
                  <span style={{ width: 66, fontSize: 13, fontVariantNumeric: 'tabular-nums', color: '#9397ab', flexShrink: 0 }}>
                    {ev.time}
                  </span>
                  <span style={{ width: 3, height: 26, borderRadius: 2, background: color, boxShadow: `0 0 10px ${color}`, flexShrink: 0 }} />
                  <span style={{ flex: 1, fontSize: 15, color: '#e9e9ed' }}>{ev.title}</span>
                  <span style={{ fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', color, opacity: 0.85 }}>
                    {ev.cat}
                  </span>
                </div>
              )
            })
          )}

          {/* Completed section */}
          {completedItems.length > 0 && (
            <>
              <div style={FADED_RULE} />
              <div style={{ fontSize: 10, letterSpacing: '0.2em', color: '#595d6c', textTransform: 'uppercase', padding: '4px 0 8px' }}>
                {DAILY_TASKS.TODAY_COMPLETED_LABEL}
              </div>
              {completedItems.map((ev, i) => {
                const color = catColor(ev.cat, categoryMap)
                return (
                  <div
                    key={i}
                    style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '10px 0', borderBottom: '1px solid rgba(233,233,237,0.04)', opacity: 0.4 }}
                  >
                    <span style={{ width: 66, fontSize: 13, fontVariantNumeric: 'tabular-nums', color: '#595d6c', flexShrink: 0 }}>
                      {ev.time}
                    </span>
                    <span style={{ width: 3, height: 22, borderRadius: 2, background: color, flexShrink: 0 }} />
                    <span style={{ flex: 1, fontSize: 14, color: '#595d6c', textDecoration: 'line-through' }}>{ev.title}</span>
                    <span style={{ fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#595d6c' }}>
                      {ev.cat}
                    </span>
                  </div>
                )
              })}
            </>
          )}
        </div>
      </div>

      {/* Top-right — progress ring */}
      <div
        style={{
          border: '1px solid rgba(233,233,237,0.07)',
          borderRadius: 20,
          background: 'linear-gradient(155deg,rgba(35,37,50,0.85),rgba(22,24,38,0.5))',
          padding: '26px 28px',
          display: 'flex', alignItems: 'center', gap: 26,
        }}
      >
        <div style={{ position: 'relative', width: 124, height: 124, flexShrink: 0 }}>
          <svg width="124" height="124" viewBox="0 0 124 124" style={{ transform: 'rotate(-90deg)' }}>
            <circle cx="62" cy="62" r="54" fill="none" stroke="rgba(233,233,237,0.07)" strokeWidth="9" />
            <circle
              cx="62" cy="62" r="54" fill="none"
              stroke="#9184d9" strokeWidth="9" strokeLinecap="round"
              strokeDasharray="339.3"
              strokeDashoffset={ringOffset}
              style={{ transition: 'stroke-dashoffset .8s cubic-bezier(.2,.8,.2,1)', filter: 'drop-shadow(0 0 8px rgba(145,132,217,0.6))' }}
            />
          </svg>
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: 30, fontWeight: 300, letterSpacing: '-0.02em' }}>{doneCount}</span>
            <span style={{ fontSize: 11, color: '#75798c' }}>of {totalCount}</span>
            <span style={{ fontSize: 11, color: '#9397ab', marginTop: 2 }}>{pct}%</span>
          </div>
        </div>
        <div>
          <div style={{ fontSize: 11, letterSpacing: '0.2em', color: '#75798c', textTransform: 'uppercase' }}>
            {DAILY_TASKS.DAILY_TASKS_LABEL}
          </div>
          <div style={{ fontSize: 19, fontWeight: 400, marginTop: 8, color: '#e9e9ed' }}>
            {remaining === 0 ? 'All done!' : DAILY_TASKS.TASKS_LEFT(remaining)}
          </div>
          <div style={{ fontSize: 13, color: '#75798c', marginTop: 5, maxWidth: 180 }}>
            {totalCount === 0 ? 'Add tasks via the wheel tab' : doneCount === totalCount ? 'Great work today' : `${doneCount} of ${totalCount} complete`}
          </div>
        </div>
      </div>

      {/* Bottom-right — struggle widget */}
      <div
        style={{
          border: '1px solid rgba(220,38,38,0.18)',
          borderRadius: 20,
          background: 'linear-gradient(155deg,rgba(35,37,50,0.9),rgba(22,24,38,0.55))',
          padding: '26px 28px',
          display: 'flex', flexDirection: 'column',
          overflow: 'hidden', position: 'relative',
        }}
      >
        <div style={{ position: 'absolute', left: -60, bottom: -80, width: 260, height: 260, borderRadius: '50%', background: 'radial-gradient(circle,rgba(220,38,38,0.1),transparent 65%)', pointerEvents: 'none' }} />

        <div style={{ fontSize: 11, letterSpacing: '0.2em', color: '#f87171', textTransform: 'uppercase', textShadow: '0 0 16px rgba(220,38,38,0.5)', marginBottom: 16 }}>
          {DAILY_TASKS.STRUGGLE_WIDGET_TITLE}
        </div>

        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 7 }}>
          {struggleStats.length === 0 ? (
            <div style={{ fontSize: 14, color: '#595d6c' }}>{DAILY_TASKS.STRUGGLE_GOOD_STATE}</div>
          ) : (
            <>
              {struggling.map((s) => (
                <div
                  key={s.taskId}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '8px 10px', borderRadius: 10,
                    background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.2)',
                    boxShadow: '0 0 12px rgba(220,38,38,0.08)',
                  }}
                >
                  <span style={{ fontSize: 13, color: '#f87171', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginRight: 8 }}>{s.title}</span>
                  <span style={{ fontSize: 11, color: 'rgba(248,113,113,0.7)', flexShrink: 0 }}>{DAILY_TASKS.STRUGGLE_DAYS(s.daysCompleted)}</span>
                </div>
              ))}

              {struggling.length > 0 && doingWell.length > 0 && (
                <div style={{ height: 1, background: 'rgba(233,233,237,0.06)', margin: '4px 0' }} />
              )}

              {doingWell.map((s) => (
                <div
                  key={s.taskId}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '7px 10px', borderRadius: 10,
                    background: 'rgba(52,211,153,0.06)', border: '1px solid rgba(52,211,153,0.14)',
                  }}
                >
                  <span style={{ fontSize: 13, color: '#6ee7b7', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginRight: 8 }}>{s.title}</span>
                  <span style={{ fontSize: 11, color: 'rgba(110,231,183,0.7)', flexShrink: 0 }}>{DAILY_TASKS.STRUGGLE_DAYS(s.daysCompleted)}</span>
                </div>
              ))}

              {struggling.length === 0 && (
                <div style={{ fontSize: 14, color: '#6ee7b7' }}>{DAILY_TASKS.STRUGGLE_GOOD_STATE}</div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

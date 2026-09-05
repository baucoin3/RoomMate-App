'use client'

import type { DailyTask, NocturneCalendarEvent, WeeklyRate } from '@/lib/types/dailyTasks'
import { DAILY_TASKS } from '@/locales/en'

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

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

interface MobileTodayPanelProps {
  tasks: DailyTask[]
  events: NocturneCalendarEvent[]
  weeklyRate: WeeklyRate
  categoryMap: Record<string, string>
  now: Date
}

export default function MobileTodayPanel({ tasks, events, weeklyRate, categoryMap, now }: MobileTodayPanelProps) {
  const nowMins = now.getHours() * 60 + now.getMinutes()

  const upcoming = events.filter((e) => e.time !== '—' && timeToMinutes(e.time) >= nowMins)
  const nextEvent = upcoming[0] ?? events.filter((e) => e.time !== '—').slice(-1)[0] ?? null

  const doneCount = tasks.filter((t) => t.done).length
  const totalCount = tasks.length
  // circumference of r=36 circle: 2 * π * 36 ≈ 226.2
  const ringOffset = totalCount === 0 ? 0 : 226.2 * (1 - doneCount / totalCount)
  const remaining = totalCount - doneCount

  const ratePercent = weeklyRate.rate
  const fillWidth = Math.round(ratePercent)

  const pipDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(now)
    d.setDate(d.getDate() - (6 - i))
    return { label: DOW[d.getDay()][0], isToday: i === 6 }
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, height: '100%', overflowY: 'auto', paddingBottom: 16 }}>

      {/* Progress + weekly rate card */}
      <div
        style={{
          border: '1px solid rgba(145,132,217,0.22)',
          borderRadius: 20,
          background: 'linear-gradient(155deg,rgba(35,37,50,0.92),rgba(22,24,38,0.6))',
          padding: '18px 18px',
          position: 'relative', overflow: 'hidden', flexShrink: 0,
        }}
      >
        <div style={{ position: 'absolute', right: -60, top: -60, width: 220, height: 220, borderRadius: '50%', background: 'radial-gradient(circle,rgba(145,132,217,0.12),transparent 65%)', pointerEvents: 'none' }} />

        {/* Top row: ring + task count + weekly rate */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          {/* Ring */}
          <div style={{ position: 'relative', width: 80, height: 80, flexShrink: 0 }}>
            <svg width="80" height="80" viewBox="0 0 80 80" style={{ transform: 'rotate(-90deg)' }}>
              <circle cx="40" cy="40" r="34" fill="none" stroke="rgba(233,233,237,0.07)" strokeWidth="6" />
              <circle
                cx="40" cy="40" r="34" fill="none"
                stroke="#9184d9" strokeWidth="6" strokeLinecap="round"
                strokeDasharray="213.6"
                strokeDashoffset={totalCount === 0 ? 0 : 213.6 * (1 - doneCount / totalCount)}
                style={{ transition: 'stroke-dashoffset .8s cubic-bezier(.2,.8,.2,1)', filter: 'drop-shadow(0 0 5px rgba(145,132,217,0.6))' }}
              />
            </svg>
            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: 20, fontWeight: 300, letterSpacing: '-0.02em', lineHeight: 1 }}>{doneCount}</span>
              <span style={{ fontSize: 9, color: '#75798c', lineHeight: 1, marginTop: 2 }}>of {totalCount}</span>
            </div>
          </div>

          {/* Task count */}
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 10, letterSpacing: '0.2em', color: '#75798c', textTransform: 'uppercase' }}>
              {DAILY_TASKS.DAILY_TASKS_LABEL}
            </div>
            <div style={{ fontSize: 16, fontWeight: 400, marginTop: 4, color: '#e9e9ed' }}>
              {remaining === 0 ? 'All done!' : DAILY_TASKS.TASKS_LEFT(remaining)}
            </div>
            <div style={{ fontSize: 11, color: '#75798c', marginTop: 2 }}>
              {totalCount === 0 ? 'Add tasks above' : doneCount === totalCount ? 'Great work today' : `${doneCount} of ${totalCount} complete`}
            </div>
          </div>

          {/* Weekly rate */}
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <div style={{ fontSize: 9, letterSpacing: '0.12em', color: '#b5abfc', textTransform: 'uppercase' }}>
              {DAILY_TASKS.WEEKLY_RATE_LABEL}
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 1, justifyContent: 'flex-end', marginTop: 3 }}>
              <span style={{ fontSize: 26, fontWeight: 300, letterSpacing: '-0.03em', color: '#e9e9ed', textShadow: '0 0 20px rgba(145,132,217,0.4)' }}>{ratePercent}</span>
              <span style={{ fontSize: 13, color: '#9397ab', fontWeight: 300 }}>%</span>
            </div>
          </div>
        </div>

        {/* Fill bar */}
        <div style={{ marginTop: 14, height: 3, borderRadius: 2, background: 'rgba(233,233,237,0.07)', overflow: 'hidden' }}>
          <div
            style={{
              height: '100%', width: `${fillWidth}%`, borderRadius: 2,
              background: 'linear-gradient(90deg,#7c6fc4,#b5abfc)',
              boxShadow: '0 0 8px rgba(145,132,217,0.5)',
              transition: 'width .8s cubic-bezier(.2,.8,.2,1)',
            }}
          />
        </div>

        {/* Pip row */}
        <div style={{ display: 'flex', gap: 4, marginTop: 10 }}>
          {pipDays.map(({ label, isToday }, i) => (
            <div
              key={i}
              style={{
                flex: 1, height: 24, borderRadius: 5,
                background: 'rgba(233,233,237,0.04)',
                border: `1px solid ${isToday ? 'rgba(145,132,217,0.4)' : 'rgba(233,233,237,0.07)'}`,
                display: 'flex', alignItems: 'flex-end', justifyContent: 'center', paddingBottom: 3,
              }}
            >
              <span style={{ fontSize: 8, color: isToday ? '#b5abfc' : '#595d6c' }}>{label}</span>
            </div>
          ))}
        </div>

        <div style={{ fontSize: 11, color: '#9397ab', marginTop: 8 }}>
          {DAILY_TASKS.WEEKLY_RATE_DAYS(weeklyRate.completedDays)}
        </div>
      </div>

      {/* Up Next */}
      <div
        style={{
          border: '1px solid rgba(233,233,237,0.07)',
          borderRadius: 20,
          background: 'linear-gradient(155deg,rgba(35,37,50,0.9),rgba(22,24,38,0.55))',
          padding: '16px 18px',
          flexShrink: 0,
        }}
      >
        <div style={{ fontSize: 10, letterSpacing: '0.2em', color: '#75798c', textTransform: 'uppercase', marginBottom: 10 }}>
          {DAILY_TASKS.UP_NEXT}
        </div>

        {nextEvent ? (
          <>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
              <span style={{ fontSize: 24, fontWeight: 300, letterSpacing: '-0.02em', color: catColor(nextEvent.cat, categoryMap), flexShrink: 0 }}>
                {nextEvent.time}
              </span>
              <span style={{ fontSize: 16, fontWeight: 400, color: '#e9e9ed', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {nextEvent.title.replace(' — logged', '')}
              </span>
            </div>
            <div style={{ fontSize: 12, color: '#75798c', marginTop: 4 }}>
              {(() => {
                const gap = timeToMinutes(nextEvent.time) - nowMins
                const catLabel = nextEvent.cat.charAt(0).toUpperCase() + nextEvent.cat.slice(1)
                if (gap > 0) {
                  const h = Math.floor(gap / 60)
                  const m = gap % 60
                  return `in ${h > 0 ? h + 'h ' : ''}${m}m · ${catLabel}`
                }
                return `earlier today · ${catLabel}`
              })()}
            </div>
          </>
        ) : (
          <div style={{ fontSize: 15, color: '#595d6c' }}>{DAILY_TASKS.NOTHING_SCHEDULED}</div>
        )}
      </div>

      {/* Schedule */}
      <div
        style={{
          border: '1px solid rgba(233,233,237,0.07)',
          borderRadius: 20,
          background: 'linear-gradient(155deg,rgba(35,37,50,0.9),rgba(22,24,38,0.55))',
          padding: '16px 18px',
          flex: 1,
          minHeight: 0,
        }}
      >
        <div style={{ fontSize: 10, letterSpacing: '0.2em', color: '#75798c', textTransform: 'uppercase', marginBottom: 12 }}>
          {DAILY_TASKS.TODAY_SCHEDULE}
        </div>

        {events.length === 0 ? (
          <div style={{ fontSize: 14, color: '#595d6c', padding: '4px 0' }}>{DAILY_TASKS.NOTHING_SCHEDULED}</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {events.map((ev, i) => (
              <div
                key={i}
                style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '1px solid rgba(233,233,237,0.04)' }}
              >
                <span style={{ width: 54, fontSize: 12, fontVariantNumeric: 'tabular-nums', color: '#9397ab', flexShrink: 0 }}>
                  {ev.time}
                </span>
                <span style={{ width: 3, height: 20, borderRadius: 2, background: catColor(ev.cat, categoryMap), boxShadow: `0 0 8px ${catColor(ev.cat, categoryMap)}`, flexShrink: 0 }} />
                <span style={{ flex: 1, fontSize: 14, color: '#e9e9ed', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {ev.title.replace(' — logged', '')}
                </span>
                <span style={{ fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: catColor(ev.cat, categoryMap), opacity: 0.8, flexShrink: 0 }}>
                  {ev.cat}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

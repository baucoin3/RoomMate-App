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

interface TodayPanelProps {
  tasks: DailyTask[]
  events: NocturneCalendarEvent[]
  weeklyRate: WeeklyRate
  categoryMap: Record<string, string>
  now: Date
}

const FADED_RULE: React.CSSProperties = {
  height: 1, border: 0,
  background: 'linear-gradient(90deg,transparent,rgba(233,233,237,0.14) 12%,rgba(233,233,237,0.14) 88%,transparent)',
}

function catColor(cat: string, map: Record<string, string>): string {
  return map[cat] ?? 'rgba(233,233,237,0.3)'
}

export default function TodayPanel({ tasks, events, weeklyRate, categoryMap, now }: TodayPanelProps) {
  const nowMins = now.getHours() * 60 + now.getMinutes()

  const upcoming = events.filter((e) => e.time !== '—' && timeToMinutes(e.time) >= nowMins)
  const nextEvent = upcoming[0] ?? events.filter((e) => e.time !== '—').slice(-1)[0] ?? null

  const doneCount = tasks.filter((t) => t.done).length
  const totalCount = tasks.length
  const ringOffset = totalCount === 0 ? 0 : 339.3 * (1 - doneCount / totalCount)
  const remaining = totalCount - doneCount

  // 7-day pip labels (6 days ago → today)
  const pipDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(now)
    d.setDate(d.getDate() - (6 - i))
    return { label: DOW[d.getDay()][0], isToday: i === 6 }
  })

  // Which of the 7 days had activity — approximate from weeklyRate.completedDays
  // We don't have per-day data here; show the rate visually as a filled bar + count
  const ratePercent = weeklyRate.rate
  const fillWidth = Math.round(ratePercent)

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
      {/* Left panel — schedule (spans both rows) */}
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

        <div style={{ fontSize: 11, letterSpacing: '0.2em', color: '#75798c', textTransform: 'uppercase' }}>
          {DAILY_TASKS.UP_NEXT}
        </div>

        {nextEvent ? (
          <>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 14, marginTop: 14 }}>
              <span style={{ fontSize: 34, fontWeight: 300, letterSpacing: '-0.02em', color: catColor(nextEvent.cat, categoryMap) }}>
                {nextEvent.time}
              </span>
              <span style={{ fontSize: 22, fontWeight: 400, color: '#e9e9ed' }}>
                {nextEvent.title.replace(' — logged', '')}
              </span>
            </div>
            <div style={{ fontSize: 13, color: '#75798c', marginTop: 6 }}>
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
          <div style={{ fontSize: 22, fontWeight: 400, color: '#595d6c', marginTop: 14 }}>
            {DAILY_TASKS.NOTHING_SCHEDULED}
          </div>
        )}

        <div style={{ ...FADED_RULE, margin: '24px 0 18px' }} />

        <div style={{ fontSize: 11, letterSpacing: '0.2em', color: '#75798c', textTransform: 'uppercase', marginBottom: 14 }}>
          {DAILY_TASKS.TODAY_SCHEDULE}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, overflow: 'hidden' }}>
          {events.length === 0 ? (
            <div style={{ fontSize: 14, color: '#595d6c', padding: '8px 0' }}>{DAILY_TASKS.NOTHING_SCHEDULED}</div>
          ) : (
            events.map((ev, i) => (
              <div
                key={i}
                style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '11px 0', borderBottom: '1px solid rgba(233,233,237,0.04)' }}
              >
                <span style={{ width: 66, fontSize: 13, fontVariantNumeric: 'tabular-nums', color: '#9397ab', flexShrink: 0 }}>
                  {ev.time}
                </span>
                <span style={{ width: 3, height: 26, borderRadius: 2, background: catColor(ev.cat, categoryMap), boxShadow: `0 0 10px ${catColor(ev.cat, categoryMap)}`, flexShrink: 0 }} />
                <span style={{ flex: 1, fontSize: 15, color: '#e9e9ed' }}>{ev.title.replace(' — logged', '')}</span>
                <span style={{ fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', color: catColor(ev.cat, categoryMap), opacity: 0.85 }}>
                  {ev.cat}
                </span>
              </div>
            ))
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

      {/* Bottom-right — weekly rate */}
      <div
        style={{
          border: '1px solid rgba(145,132,217,0.22)',
          borderRadius: 20,
          background: 'linear-gradient(155deg,rgba(43,39,65,0.9),rgba(22,24,38,0.55))',
          padding: '26px 28px',
          display: 'flex', flexDirection: 'column',
          position: 'relative', overflow: 'hidden',
        }}
      >
        <div style={{ position: 'absolute', left: -60, bottom: -80, width: 260, height: 260, borderRadius: '50%', background: 'radial-gradient(circle,rgba(145,132,217,0.2),transparent 65%)', pointerEvents: 'none' }} />

        <div style={{ fontSize: 11, letterSpacing: '0.2em', color: '#b5abfc', textTransform: 'uppercase' }}>
          {DAILY_TASKS.WEEKLY_RATE_LABEL}
        </div>

        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 12 }}>
          <span style={{ fontSize: 56, fontWeight: 300, letterSpacing: '-0.04em', color: '#e9e9ed', textShadow: '0 0 30px rgba(145,132,217,0.5)' }}>
            {ratePercent}
          </span>
          <span style={{ fontSize: 22, color: '#9397ab', fontWeight: 300 }}>%</span>
        </div>

        {/* Fill bar */}
        <div style={{ marginTop: 14, height: 4, borderRadius: 2, background: 'rgba(233,233,237,0.07)', overflow: 'hidden' }}>
          <div
            style={{
              height: '100%',
              width: `${fillWidth}%`,
              borderRadius: 2,
              background: 'linear-gradient(90deg,#7c6fc4,#b5abfc)',
              boxShadow: '0 0 8px rgba(145,132,217,0.5)',
              transition: 'width .8s cubic-bezier(.2,.8,.2,1)',
            }}
          />
        </div>

        {/* Pip row */}
        <div style={{ display: 'flex', gap: 7, marginTop: 16 }}>
          {pipDays.map(({ label, isToday }, i) => (
            <div
              key={i}
              style={{
                flex: 1, height: 34, borderRadius: 6,
                background: 'rgba(233,233,237,0.04)',
                border: `1px solid ${isToday ? 'rgba(145,132,217,0.4)' : 'rgba(233,233,237,0.07)'}`,
                display: 'flex', alignItems: 'flex-end', justifyContent: 'center', paddingBottom: 4,
              }}
            >
              <span style={{ fontSize: 9, color: isToday ? '#b5abfc' : '#595d6c' }}>{label}</span>
            </div>
          ))}
        </div>

        <div style={{ flex: 1 }} />
        <div style={{ fontSize: 13, color: '#9397ab', marginTop: 14 }}>
          {DAILY_TASKS.WEEKLY_RATE_DAYS(weeklyRate.completedDays)}
        </div>
      </div>
    </div>
  )
}

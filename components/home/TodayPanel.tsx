'use client'

import type { DailyTask, NocturneCalendarEvent } from '@/lib/types/dailyTasks'
import { DAILY_TASKS } from '@/locales/en'

const CATS = {
  fitness: 'oklch(0.734 0.125 289.2)',
  home: 'oklch(0.734 0.125 175)',
  work: 'oklch(0.734 0.125 245)',
  errands: 'oklch(0.734 0.125 45)',
} as const

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function timeToMinutes(t: string): number {
  const m = /^(\d+):(\d+)\s*(AM|PM)$/i.exec(t.trim())
  if (!m) return 99999
  let h = parseInt(m[1], 10) % 12
  if (m[3].toUpperCase() === 'PM') h += 12
  return h * 60 + parseInt(m[2], 10)
}

function formatTimeOfDay(timeOfDay: string | null): string {
  if (!timeOfDay) return '—'
  const [hStr, mStr] = timeOfDay.split(':')
  const h = parseInt(hStr, 10)
  const mm = parseInt(mStr, 10)
  const period = h < 12 ? 'AM' : 'PM'
  const h12 = h % 12 === 0 ? 12 : h % 12
  return `${h12}:${String(mm).padStart(2, '0')} ${period}`
}

interface TodayPanelProps {
  tasks: DailyTask[]
  events: NocturneCalendarEvent[]
  streak: number
  streakDays: boolean[]
  now: Date
}

const FADED_RULE: React.CSSProperties = {
  height: 1,
  border: 0,
  background:
    'linear-gradient(90deg,transparent,rgba(233,233,237,0.14) 12%,rgba(233,233,237,0.14) 88%,transparent)',
}

export default function TodayPanel({ tasks, events, streak, streakDays, now }: TodayPanelProps) {
  const nowMins = now.getHours() * 60 + now.getMinutes()

  const upcoming = events.filter((e) => e.time !== '—' && timeToMinutes(e.time) >= nowMins)
  const nextEvent =
    upcoming[0] ?? events.filter((e) => e.time !== '—').slice(-1)[0] ?? null

  const doneCount = tasks.filter((t) => t.done).length
  const totalCount = tasks.length
  const ringOffset =
    totalCount === 0 ? 0 : 339.3 * (1 - doneCount / totalCount)
  const remaining = totalCount - doneCount

  const gymTask = tasks.find((t) => t.category === 'fitness' && t.logsToCalendar)
  const gymLine = gymTask?.done
    ? 'Gym logged to today ✓'
    : gymTask
    ? 'Complete the gym task to log your streak'
    : 'Add a fitness task to track your streak'

  // Build pip day labels (6 days ago → today)
  const pipDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(now)
    d.setDate(d.getDate() - (6 - i))
    return { label: DOW[d.getDay()][0], hit: streakDays[i] ?? false }
  })

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
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        {/* Corner glow */}
        <div
          style={{
            position: 'absolute',
            right: -90,
            top: -90,
            width: 300,
            height: 300,
            borderRadius: '50%',
            background: 'radial-gradient(circle,rgba(145,132,217,0.14),transparent 65%)',
            pointerEvents: 'none',
          }}
        />

        {/* Up next */}
        <div style={{ fontSize: 11, letterSpacing: '0.2em', color: '#75798c', textTransform: 'uppercase' }}>
          {DAILY_TASKS.UP_NEXT}
        </div>

        {nextEvent ? (
          <>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 14, marginTop: 14 }}>
              <span
                style={{
                  fontSize: 34,
                  fontWeight: 300,
                  letterSpacing: '-0.02em',
                  color: CATS[nextEvent.cat],
                }}
              >
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

        <div
          style={{
            fontSize: 11,
            letterSpacing: '0.2em',
            color: '#75798c',
            textTransform: 'uppercase',
            marginBottom: 14,
          }}
        >
          {DAILY_TASKS.TODAY_SCHEDULE}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, overflow: 'hidden' }}>
          {events.length === 0 ? (
            <div style={{ fontSize: 14, color: '#595d6c', padding: '8px 0' }}>
              {DAILY_TASKS.NOTHING_SCHEDULED}
            </div>
          ) : (
            events.map((ev, i) => (
              <div
                key={i}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 16,
                  padding: '11px 0',
                  borderBottom: '1px solid rgba(233,233,237,0.04)',
                }}
              >
                <span
                  style={{
                    width: 66,
                    fontSize: 13,
                    fontVariantNumeric: 'tabular-nums',
                    color: '#9397ab',
                    flexShrink: 0,
                  }}
                >
                  {ev.time}
                </span>
                <span
                  style={{
                    width: 3,
                    height: 26,
                    borderRadius: 2,
                    background: CATS[ev.cat],
                    boxShadow: `0 0 10px ${CATS[ev.cat]}`,
                    flexShrink: 0,
                  }}
                />
                <span style={{ flex: 1, fontSize: 15, color: '#e9e9ed' }}>{ev.title}</span>
                <span
                  style={{
                    fontSize: 11,
                    letterSpacing: '0.12em',
                    textTransform: 'uppercase',
                    color: CATS[ev.cat],
                    opacity: 0.85,
                  }}
                >
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
          display: 'flex',
          alignItems: 'center',
          gap: 26,
        }}
      >
        <div style={{ position: 'relative', width: 124, height: 124, flexShrink: 0 }}>
          <svg
            width="124"
            height="124"
            viewBox="0 0 124 124"
            style={{ transform: 'rotate(-90deg)' }}
          >
            <circle
              cx="62"
              cy="62"
              r="54"
              fill="none"
              stroke="rgba(233,233,237,0.07)"
              strokeWidth="9"
            />
            <circle
              cx="62"
              cy="62"
              r="54"
              fill="none"
              stroke="#9184d9"
              strokeWidth="9"
              strokeLinecap="round"
              strokeDasharray="339.3"
              strokeDashoffset={ringOffset}
              style={{
                transition: 'stroke-dashoffset .8s cubic-bezier(.2,.8,.2,1)',
                filter: 'drop-shadow(0 0 8px rgba(145,132,217,0.6))',
              }}
            />
          </svg>
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <span style={{ fontSize: 30, fontWeight: 300, letterSpacing: '-0.02em' }}>
              {doneCount}
            </span>
            <span style={{ fontSize: 11, color: '#75798c' }}>of {totalCount}</span>
          </div>
        </div>
        <div>
          <div
            style={{
              fontSize: 11,
              letterSpacing: '0.2em',
              color: '#75798c',
              textTransform: 'uppercase',
            }}
          >
            {DAILY_TASKS.DAILY_TASKS_LABEL}
          </div>
          <div style={{ fontSize: 19, fontWeight: 400, marginTop: 8, color: '#e9e9ed' }}>
            {remaining === 0 ? 'All done!' : DAILY_TASKS.TASKS_LEFT(remaining)}
          </div>
          <div style={{ fontSize: 13, color: '#75798c', marginTop: 5, maxWidth: 180 }}>
            {totalCount === 0
              ? 'Add tasks via the wheel tab'
              : doneCount === totalCount
              ? 'Great work today'
              : `${doneCount} of ${totalCount} complete`}
          </div>
        </div>
      </div>

      {/* Bottom-right — streak */}
      <div
        style={{
          border: '1px solid rgba(145,132,217,0.22)',
          borderRadius: 20,
          background: 'linear-gradient(155deg,rgba(43,39,65,0.9),rgba(22,24,38,0.55))',
          padding: '26px 28px',
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Corner glow */}
        <div
          style={{
            position: 'absolute',
            left: -60,
            bottom: -80,
            width: 260,
            height: 260,
            borderRadius: '50%',
            background: 'radial-gradient(circle,rgba(145,132,217,0.2),transparent 65%)',
            pointerEvents: 'none',
          }}
        />

        <div
          style={{
            fontSize: 11,
            letterSpacing: '0.2em',
            color: '#b5abfc',
            textTransform: 'uppercase',
          }}
        >
          {DAILY_TASKS.GYM_STREAK}
        </div>

        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginTop: 12 }}>
          <span
            style={{
              fontSize: 56,
              fontWeight: 300,
              letterSpacing: '-0.04em',
              color: '#e9e9ed',
              textShadow: '0 0 30px rgba(145,132,217,0.5)',
            }}
          >
            {streak}
          </span>
          <span style={{ fontSize: 15, color: '#9397ab' }}>{DAILY_TASKS.STREAK_LABEL}</span>
        </div>

        <div style={{ display: 'flex', gap: 7, marginTop: 20 }}>
          {pipDays.map(({ label, hit }, i) => (
            <div
              key={i}
              style={{
                flex: 1,
                height: 34,
                borderRadius: 6,
                background: hit ? 'rgba(145,132,217,0.28)' : 'rgba(233,233,237,0.04)',
                border: `1px solid ${hit ? 'rgba(145,132,217,0.6)' : 'rgba(233,233,237,0.07)'}`,
                display: 'flex',
                alignItems: 'flex-end',
                justifyContent: 'center',
                paddingBottom: 4,
                transition: 'all .4s ease',
              }}
            >
              <span style={{ fontSize: 9, color: hit ? '#d2cefd' : '#595d6c' }}>{label}</span>
            </div>
          ))}
        </div>

        <div style={{ flex: 1 }} />
        <div style={{ fontSize: 13, color: '#9397ab', marginTop: 16 }}>{gymLine}</div>
      </div>
    </div>
  )
}

'use client'

import { useState } from 'react'
import type { NocturneCalendarEvent } from '@/lib/types/dailyTasks'
import { DAILY_TASKS } from '@/locales/en'

const CATS = {
  fitness: 'oklch(0.734 0.125 289.2)',
  home: 'oklch(0.734 0.125 175)',
  work: 'oklch(0.734 0.125 245)',
  errands: 'oklch(0.734 0.125 45)',
} as const

const DOW_FULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const DOW_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function toISO(d: Date): string {
  return d.toLocaleDateString('en-CA')
}

function addDays(base: Date, n: number): Date {
  const d = new Date(base)
  d.setDate(d.getDate() + n)
  return d
}

interface CalendarFilmStripProps {
  events: Record<string, NocturneCalendarEvent[]>
  now: Date
}

const FADED_RULE: React.CSSProperties = {
  height: 1,
  border: 0,
  background:
    'linear-gradient(90deg,transparent,rgba(233,233,237,0.14) 12%,rgba(233,233,237,0.14) 88%,transparent)',
  margin: '14px 0',
}

export default function CalendarFilmStrip({ events, now }: CalendarFilmStripProps) {
  const todayISO = toISO(now)
  const [offset, setOffset] = useState(0)

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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', paddingBottom: 26 }}>
      {/* Film strip row */}
      <div style={{ display: 'flex', gap: 10, flex: 1, overflow: 'hidden' }}>
        {panels.map(({ d, iso, isActive, evs, idx }) => {
          const isToday = iso === todayISO
          const lbl = badge(iso)

          if (isActive) {
            return (
              <div
                key={iso}
                style={{
                  width: 528,
                  flexShrink: 0,
                  borderRadius: 20,
                  background: 'linear-gradient(155deg,rgba(43,39,65,0.95),rgba(22,24,38,0.72))',
                  border: '1px solid rgba(145,132,217,0.42)',
                  padding: '26px 28px',
                  position: 'relative',
                  overflow: 'hidden',
                  transition: 'width .6s cubic-bezier(.2,.85,.2,1)',
                  display: 'flex',
                  flexDirection: 'column',
                }}
              >
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    pointerEvents: 'none',
                    background:
                      'radial-gradient(120% 90% at 88% 6%,rgba(145,132,217,0.16),transparent 60%)',
                  }}
                />
                <div
                  style={{
                    fontSize: 11,
                    letterSpacing: '0.2em',
                    color: '#b5abfc',
                    textTransform: 'uppercase',
                    marginBottom: 4,
                  }}
                >
                  {DOW_FULL[d.getDay()]}
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 14 }}>
                  <span
                    style={{
                      fontSize: 66,
                      fontWeight: 200,
                      lineHeight: 1,
                      color: '#e9e9ed',
                      letterSpacing: '-0.03em',
                    }}
                  >
                    {d.getDate()}
                  </span>
                  <span
                    style={{
                      fontSize: 11,
                      letterSpacing: '0.14em',
                      textTransform: 'uppercase',
                      color:
                        lbl === 'Today' ? '#b5abfc' : lbl === 'Past' ? '#595d6c' : '#75798c',
                      background:
                        lbl === 'Today'
                          ? 'rgba(145,132,217,0.18)'
                          : 'rgba(233,233,237,0.06)',
                      border: `1px solid ${lbl === 'Today' ? 'rgba(145,132,217,0.5)' : 'rgba(233,233,237,0.1)'}`,
                      borderRadius: 20,
                      padding: '3px 10px',
                    }}
                  >
                    {lbl}
                  </span>
                </div>
                <div style={{ fontSize: 13, color: '#75798c', marginTop: 8 }}>
                  {evs.length === 0
                    ? 'No events'
                    : `${evs.length} event${evs.length === 1 ? '' : 's'}`}
                </div>
                <div style={FADED_RULE} />
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 2,
                    overflow: 'hidden',
                    flex: 1,
                  }}
                >
                  {evs.length === 0 ? (
                    <div style={{ fontSize: 14, color: '#595d6c', padding: '8px 0' }}>
                      {DAILY_TASKS.NOTHING_SCHEDULED}
                    </div>
                  ) : (
                    evs.map((ev, i) => (
                      <div
                        key={i}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 12,
                          padding: '10px 0',
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
                            width: 8,
                            height: 8,
                            borderRadius: '50%',
                            background: CATS[ev.cat],
                            flexShrink: 0,
                            boxShadow: `0 0 6px ${CATS[ev.cat]}`,
                          }}
                        />
                        <span style={{ flex: 1, fontSize: 14, color: '#e9e9ed' }}>
                          {ev.title.replace(' — logged', '')}
                        </span>
                        <span
                          style={{
                            fontSize: 10,
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
            )
          }

          // Quiet panel
          const dotCats = Array.from(new Set(evs.slice(0, 3).map((e) => e.cat)))
          return (
            <div
              key={iso}
              onClick={() => setOffset((o) => o + (idx - 4))}
              style={{
                flex: 1,
                minWidth: 0,
                borderRadius: 20,
                background: 'rgba(35,37,50,0.42)',
                border: '1px solid rgba(233,233,237,0.06)',
                padding: '22px 0',
                cursor: 'pointer',
                transition: 'background .5s ease',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  fontSize: 9,
                  letterSpacing: '0.18em',
                  textTransform: 'uppercase',
                  color: isToday ? '#b5abfc' : '#595d6c',
                  marginBottom: 6,
                }}
              >
                {DOW_SHORT[d.getDay()][0]}
              </div>
              <div
                style={{
                  fontSize: 28,
                  fontWeight: 300,
                  color: isToday ? '#d2cefd' : '#75798c',
                  lineHeight: 1,
                }}
              >
                {d.getDate()}
              </div>
              <div style={{ flex: 1 }} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'center', paddingBottom: 10 }}>
                {dotCats.map((cat) => (
                  <div
                    key={cat}
                    style={{
                      width: 5,
                      height: 5,
                      borderRadius: '50%',
                      background: CATS[cat],
                      opacity: 0.8,
                    }}
                  />
                ))}
              </div>
            </div>
          )
        })}
      </div>

      {/* Controls + legend */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginTop: 16,
        }}
      >
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => setOffset((o) => o - 1)}
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              background: 'rgba(233,233,237,0.06)',
              border: '1px solid rgba(233,233,237,0.1)',
              color: '#9397ab',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
          <button
            onClick={() => setOffset((o) => o + 1)}
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              background: 'rgba(233,233,237,0.06)',
              border: '1px solid rgba(233,233,237,0.1)',
              color: '#9397ab',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <path d="M9 18l6-6-6-6" />
            </svg>
          </button>
          <button
            onClick={() => setOffset(0)}
            style={{
              height: 36,
              padding: '0 14px',
              borderRadius: 10,
              background: 'rgba(233,233,237,0.06)',
              border: '1px solid rgba(233,233,237,0.1)',
              color: '#9397ab',
              cursor: 'pointer',
              fontSize: 12,
            }}
          >
            Today
          </button>
        </div>

        {/* Category legend */}
        <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
          {(['fitness', 'home', 'work', 'errands'] as const).map((cat) => (
            <div key={cat} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: '50%',
                  background: CATS[cat],
                }}
              />
              <span
                style={{ fontSize: 11, color: '#75798c', textTransform: 'capitalize' }}
              >
                {cat}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

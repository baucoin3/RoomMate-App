'use client'

import type { DailyTask, NocturneCalendarEvent, WeeklyRate, TaskStruggleStat } from '@/lib/types/dailyTasks'
import { DAILY_TASKS } from '@/locales/en'

function catColor(cat: string, map: Record<string, string>): string {
  return map[cat] ?? 'rgba(233,233,237,0.3)'
}

interface MobileTodayPanelProps {
  tasks: DailyTask[]
  events: NocturneCalendarEvent[]
  weeklyRate: WeeklyRate
  categoryMap: Record<string, string>
  now: Date
  struggleStats: TaskStruggleStat[]
}

export default function MobileTodayPanel({ tasks, events, categoryMap, struggleStats }: MobileTodayPanelProps) {
  const doneCount = tasks.filter((t) => t.done).length
  const totalCount = tasks.length
  const remaining = totalCount - doneCount
  const pct = totalCount === 0 ? 0 : Math.round((doneCount / totalCount) * 100)

  const todoItems = events.filter((ev) => ev.type !== 'task' || !ev.done)
  const completedItems = events.filter((ev) => ev.type === 'task' && ev.done)

  const struggling = struggleStats.filter((s) => s.isStruggling)
  const doingWell = struggleStats.filter((s) => !s.isStruggling)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, height: '100%', overflowY: 'auto', paddingBottom: 16 }}>

      {/* Progress ring card */}
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
              <span style={{ fontSize: 9, color: '#9397ab', marginTop: 1 }}>{pct}%</span>
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
        </div>
      </div>

      {/* Task list */}
      <div
        style={{
          border: '1px solid rgba(233,233,237,0.07)',
          borderRadius: 20,
          background: 'linear-gradient(155deg,rgba(35,37,50,0.9),rgba(22,24,38,0.55))',
          padding: '16px 18px',
          flexShrink: 0,
        }}
      >
        <div style={{ fontSize: 10, letterSpacing: '0.2em', color: '#75798c', textTransform: 'uppercase', marginBottom: 12 }}>
          {DAILY_TASKS.TODAY_TODO_LABEL}
        </div>

        {todoItems.length === 0 && completedItems.length === 0 ? (
          <div style={{ fontSize: 14, color: '#595d6c' }}>{DAILY_TASKS.NOTHING_SCHEDULED}</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {todoItems.map((ev, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '1px solid rgba(233,233,237,0.04)' }}>
                <span style={{ width: 54, fontSize: 12, fontVariantNumeric: 'tabular-nums', color: '#9397ab', flexShrink: 0 }}>{ev.time}</span>
                <span style={{ width: 3, height: 20, borderRadius: 2, background: catColor(ev.cat, categoryMap), boxShadow: `0 0 8px ${catColor(ev.cat, categoryMap)}`, flexShrink: 0 }} />
                <span style={{ flex: 1, fontSize: 14, color: '#e9e9ed', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ev.title}</span>
                <span style={{ fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: catColor(ev.cat, categoryMap), opacity: 0.8, flexShrink: 0 }}>{ev.cat}</span>
              </div>
            ))}

            {completedItems.length > 0 && (
              <>
                <div style={{ fontSize: 9, letterSpacing: '0.2em', color: '#595d6c', textTransform: 'uppercase', padding: '10px 0 4px' }}>
                  {DAILY_TASKS.TODAY_COMPLETED_LABEL}
                </div>
                {completedItems.map((ev, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '9px 0', borderBottom: '1px solid rgba(233,233,237,0.04)', opacity: 0.38 }}>
                    <span style={{ width: 54, fontSize: 12, fontVariantNumeric: 'tabular-nums', color: '#595d6c', flexShrink: 0 }}>{ev.time}</span>
                    <span style={{ width: 3, height: 18, borderRadius: 2, background: catColor(ev.cat, categoryMap), flexShrink: 0 }} />
                    <span style={{ flex: 1, fontSize: 13, color: '#595d6c', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textDecoration: 'line-through' }}>{ev.title}</span>
                  </div>
                ))}
              </>
            )}
          </div>
        )}
      </div>

      {/* Struggle widget */}
      <div
        style={{
          border: '1px solid rgba(220,38,38,0.18)',
          borderRadius: 20,
          background: 'linear-gradient(155deg,rgba(35,37,50,0.9),rgba(22,24,38,0.55))',
          padding: '16px 18px',
          flex: 1,
          minHeight: 0,
        }}
      >
        <div style={{ fontSize: 10, letterSpacing: '0.2em', color: '#f87171', textTransform: 'uppercase', marginBottom: 12, textShadow: '0 0 12px rgba(220,38,38,0.5)' }}>
          {DAILY_TASKS.STRUGGLE_WIDGET_TITLE}
        </div>

        {struggleStats.length === 0 ? (
          <div style={{ fontSize: 14, color: '#595d6c' }}>{DAILY_TASKS.STRUGGLE_GOOD_STATE}</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {struggling.map((s) => (
              <div
                key={s.taskId}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '8px 10px', borderRadius: 10,
                  background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.2)',
                  boxShadow: '0 0 10px rgba(220,38,38,0.06)',
                }}
              >
                <span style={{ fontSize: 13, color: '#f87171', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginRight: 8 }}>{s.title}</span>
                <span style={{ fontSize: 11, color: 'rgba(248,113,113,0.7)', flexShrink: 0 }}>{DAILY_TASKS.STRUGGLE_DAYS(s.daysCompleted)}</span>
              </div>
            ))}
            {struggling.length > 0 && doingWell.length > 0 && (
              <div style={{ height: 1, background: 'rgba(233,233,237,0.06)', margin: '2px 0' }} />
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
          </div>
        )}
      </div>
    </div>
  )
}

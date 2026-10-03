'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts'
import { apiClient, getErrorMessage } from '@/lib/api/client'
import { FITNESS } from '@/locales/en'
import type { ProgressMetrics, SessionDayDetail } from '@/lib/types/fitness'

interface ProgressDashboardProps {
  householdId: string
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]
const DAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

function formatDate(dateStr: string) {
  const d = new Date(dateStr + 'T12:00:00')
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
}

// ── Day Detail Modal ──────────────────────────────────────────────────────────

interface DayDetailModalProps {
  householdId: string
  sessionId: string
  dateStr: string
  onClose: () => void
}

function DayDetailModal({ householdId, sessionId, dateStr, onClose }: DayDetailModalProps) {
  const [detail, setDetail] = useState<SessionDayDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    async function load() {
      try {
        const res = await apiClient.get<{ data: SessionDayDetail }>(
          `/api/fitness/${householdId}/sessions/${sessionId}/detail`,
        )
        setDetail(res.data.data)
      } catch (err) {
        setError(getErrorMessage(err))
      } finally {
        setLoading(false)
      }
    }
    void load()
  }, [householdId, sessionId])

  return (
    <div className="fixed inset-0 bg-black/70 flex items-end sm:items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-[#1a1a24] rounded-2xl w-full max-w-md border border-white/10 max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
          <div>
            <p className="font-bold text-white text-base">{FITNESS.PROGRESS_DAY_DETAIL_TITLE(formatDate(dateStr))}</p>
            {detail && (
              <p className="text-xs text-white/40 mt-0.5">
                {detail.duration_minutes != null
                  ? FITNESS.PROGRESS_DAY_DURATION(detail.duration_minutes)
                  : FITNESS.PROGRESS_DAY_NO_DURATION}
                {' · '}{detail.routine_name}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-white/40 hover:text-white/70 transition-colors p-1"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Modal body */}
        <div className="overflow-y-auto px-5 py-4 flex flex-col gap-3">
          {loading && (
            <div className="flex justify-center py-8">
              <div className="w-6 h-6 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
            </div>
          )}
          {error && <p className="text-red-400 text-sm">{error}</p>}
          {detail && detail.exercises.map((ex) => {
            const completedCount = ex.completed_sets.length
            const allDone = completedCount >= ex.configured_sets
            return (
              <div key={ex.exercise_id} className="bg-white/5 rounded-xl p-3">
                <div className="flex items-center gap-2 mb-1.5">
                  {allDone ? (
                    <div className="w-5 h-5 rounded-full bg-green-500/20 flex items-center justify-center flex-shrink-0">
                      <svg className="w-3 h-3 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  ) : (
                    <div className="w-5 h-5 rounded-full bg-red-500/20 flex items-center justify-center flex-shrink-0">
                      <svg className="w-3 h-3 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </div>
                  )}
                  <span className="text-sm font-semibold text-white">{ex.exercise_name}</span>
                  <span className={`ml-auto text-xs ${allDone ? 'text-green-400/70' : 'text-red-400/70'}`}>
                    {FITNESS.PROGRESS_DAY_EXERCISE_PARTIAL(completedCount, ex.configured_sets)}
                  </span>
                </div>

                {/* Per-set detail */}
                <div className="flex flex-wrap gap-1.5 ml-7">
                  {Array.from({ length: ex.configured_sets }).map((_, setIdx) => {
                    const setNum = setIdx + 1
                    const completion = ex.completed_sets.find((s) => s.set_number === setNum)
                    const done = completion != null
                    const expectedLabel = FITNESS.PROGRESS_TOOLTIP_EXPECTED(
                      ex.configured_reps,
                      ex.configured_weight,
                      ex.weight_unit,
                    )
                    const actualLabel = done
                      ? FITNESS.PROGRESS_TOOLTIP_ACTUAL(
                          completion.actual_reps,
                          completion.actual_weight,
                          ex.weight_unit,
                        )
                      : 'Not done'
                    return (
                      <div
                        key={setNum}
                        title={done ? `Set ${setNum}: ${actualLabel} (${expectedLabel})` : `Set ${setNum}: ${expectedLabel} — not completed`}
                        className={`text-xs px-2 py-1 rounded-lg cursor-default ${
                          done
                            ? 'bg-green-500/15 text-green-300'
                            : 'bg-red-500/15 text-red-300'
                        }`}
                      >
                        Set {setNum}: {done ? actualLabel : '—'}
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ── Calendar ──────────────────────────────────────────────────────────────────

interface CalendarDay {
  date: string | null
  dayNum: number
}

function buildCalendar(year: number, month: number): CalendarDay[] {
  const firstDay = new Date(year, month - 1, 1).getDay()
  const daysInMonth = new Date(year, month, 0).getDate()
  const cells: CalendarDay[] = []
  for (let i = 0; i < firstDay; i++) cells.push({ date: null, dayNum: 0 })
  for (let d = 1; d <= daysInMonth; d++) {
    const mm = String(month).padStart(2, '0')
    const dd = String(d).padStart(2, '0')
    cells.push({ date: `${year}-${mm}-${dd}`, dayNum: d })
  }
  return cells
}

// ── Session lookup helper ─────────────────────────────────────────────────────

interface SessionLookup {
  id: string
  session_date: string
  completed_at: string | null
}

// ── Stat card ─────────────────────────────────────────────────────────────────

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="bg-white/5 rounded-2xl p-4 flex flex-col gap-1 border border-white/10">
      <span className="text-xs text-white/40 uppercase tracking-wide font-semibold">{label}</span>
      <span className="text-2xl font-black text-white">{value}</span>
      {sub && <span className="text-xs text-white/30">{sub}</span>}
    </div>
  )
}

// ── Custom tooltip for recharts ───────────────────────────────────────────────

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number; name: string }>; label?: string }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-[#1a1a24] border border-white/20 rounded-xl px-3 py-2 text-xs text-white shadow-xl">
      <p className="font-semibold mb-1">{label}</p>
      {payload.map((p) => (
        <p key={p.name} className="text-purple-300">{p.name}: {p.value}</p>
      ))}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function ProgressDashboard({ householdId }: ProgressDashboardProps) {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [metrics, setMetrics] = useState<ProgressMetrics | null>(null)
  const [sessionLookup, setSessionLookup] = useState<SessionLookup[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [activeProgressTab, setActiveProgressTab] = useState<'overview' | 'history'>('overview')
  const [selectedDay, setSelectedDay] = useState<{ date: string; sessionId: string } | null>(null)

  const loadMetrics = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await apiClient.get<{ data: ProgressMetrics }>(
        `/api/fitness/${householdId}/metrics?year=${year}&month=${month}`,
      )
      setMetrics(res.data.data)

      // Fetch session IDs for the calendar month so we can open day detail
      const sessionsRes = await apiClient.get<{ data: Array<{ id: string; session_date: string; completed_at: string | null }> }>(
        `/api/fitness/${householdId}/sessions?year=${year}&month=${month}`,
      ).catch(() => ({ data: { data: [] } }))
      setSessionLookup(sessionsRes.data.data ?? [])
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [householdId, year, month])

  useEffect(() => { void loadMetrics() }, [loadMetrics])

  function prevMonth() {
    if (month === 1) { setYear((y) => y - 1); setMonth(12) }
    else setMonth((m) => m - 1)
  }
  function nextMonth() {
    if (month === 12) { setYear((y) => y + 1); setMonth(1) }
    else setMonth((m) => m + 1)
  }

  const workoutDaySet = new Set(metrics?.workoutDays ?? [])
  const incompleteDaySet = new Set(metrics?.incompleteDays ?? [])
  const calendarCells = buildCalendar(year, month)

  function handleDayClick(date: string) {
    if (!workoutDaySet.has(date) && !incompleteDaySet.has(date)) return
    const found = sessionLookup.find((s) => s.session_date === date)
    if (found) setSelectedDay({ date, sessionId: found.id })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-7 h-7 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (error) {
    return <p className="text-red-400 text-sm py-8 text-center">{error}</p>
  }

  const streaks = metrics?.streaks
  const weeklyBuckets = metrics?.weeklyBuckets ?? []

  return (
    <div className="flex flex-col gap-6">
      {/* Progress sub-tabs */}
      <div className="flex gap-1 bg-white/5 rounded-xl p-1 self-start">
        <button
          onClick={() => setActiveProgressTab('overview')}
          className="px-4 py-1.5 rounded-lg text-xs font-semibold transition-colors"
          style={{
            background: activeProgressTab === 'overview' ? 'rgba(145,132,217,0.22)' : 'transparent',
            color: activeProgressTab === 'overview' ? '#9184d9' : '#75798c',
          }}
        >
          {FITNESS.PROGRESS_TAB_OVERVIEW}
        </button>
        <button
          onClick={() => setActiveProgressTab('history')}
          className="px-4 py-1.5 rounded-lg text-xs font-semibold transition-colors"
          style={{
            background: activeProgressTab === 'history' ? 'rgba(145,132,217,0.22)' : 'transparent',
            color: activeProgressTab === 'history' ? '#9184d9' : '#75798c',
          }}
        >
          {FITNESS.PROGRESS_TAB_HISTORY}
        </button>
      </div>

      {!streaks || streaks.totalSessions === 0 ? (
        <div className="text-center py-16 text-white/30 text-sm">
          <div className="text-4xl mb-3">📊</div>
          {FITNESS.PROGRESS_NO_DATA}
        </div>
      ) : activeProgressTab === 'overview' ? (
        <>
          {/* Stats row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard
              label={FITNESS.PROGRESS_STAT_STREAK}
              value={streaks.currentStreak}
              sub={FITNESS.PROGRESS_STAT_DAYS(streaks.currentStreak)}
            />
            <StatCard
              label={FITNESS.PROGRESS_STAT_LONGEST}
              value={streaks.longestStreak}
              sub={FITNESS.PROGRESS_STAT_DAYS(streaks.longestStreak)}
            />
            <StatCard
              label={FITNESS.PROGRESS_STAT_THIS_WEEK}
              value={streaks.workoutsThisWeek}
              sub="workouts"
            />
            <StatCard
              label={FITNESS.PROGRESS_STAT_TOTAL}
              value={streaks.totalSessions}
              sub={FITNESS.PROGRESS_STAT_SESSIONS(streaks.totalSessions)}
            />
          </div>

          {/* Frequency bar chart */}
          {weeklyBuckets.length > 0 && (
            <div className="bg-white/5 rounded-2xl border border-white/10 p-4">
              <p className="text-xs font-semibold text-white/50 uppercase tracking-widest mb-4">
                {FITNESS.PROGRESS_CHART_FREQUENCY}
              </p>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={weeklyBuckets} margin={{ top: 0, right: 0, left: -24, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
                  <XAxis
                    dataKey="weekLabel"
                    tick={{ fill: '#6b7280', fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                    interval={1}
                  />
                  <YAxis
                    allowDecimals={false}
                    tick={{ fill: '#6b7280', fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                    domain={[0, 7]}
                  />
                  <Tooltip content={<ChartTooltip />} />
                  <Bar
                    dataKey="workoutDays"
                    name={FITNESS.PROGRESS_CHART_DAYS_LABEL}
                    fill="#9184d9"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Compliance line chart */}
          {weeklyBuckets.some((b) => b.totalConfiguredSets > 0) && (
            <div className="bg-white/5 rounded-2xl border border-white/10 p-4">
              <p className="text-xs font-semibold text-white/50 uppercase tracking-widest mb-4">
                {FITNESS.PROGRESS_CHART_COMPLIANCE}
              </p>
              <ResponsiveContainer width="100%" height={160}>
                <LineChart data={weeklyBuckets} margin={{ top: 0, right: 0, left: -24, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
                  <XAxis
                    dataKey="weekLabel"
                    tick={{ fill: '#6b7280', fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                    interval={1}
                  />
                  <YAxis
                    tick={{ fill: '#6b7280', fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                    domain={[0, 100]}
                    unit="%"
                  />
                  <Tooltip content={<ChartTooltip />} />
                  <Line
                    type="monotone"
                    dataKey="compliancePct"
                    name={FITNESS.PROGRESS_CHART_PCT_LABEL}
                    stroke="#34d399"
                    strokeWidth={2}
                    dot={{ fill: '#34d399', r: 3 }}
                    activeDot={{ r: 5 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </>
      ) : (
        /* History tab — calendar */
        <div className="bg-white/5 rounded-2xl border border-white/10 p-4">
          {/* Month nav */}
          <div className="flex items-center justify-between mb-4">
            <button onClick={prevMonth} className="p-1.5 rounded-lg hover:bg-white/10 text-white/40 hover:text-white/70 transition-colors">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <span className="text-sm font-bold text-white">
              {MONTH_NAMES[month - 1]} {year}
            </span>
            <button onClick={nextMonth} className="p-1.5 rounded-lg hover:bg-white/10 text-white/40 hover:text-white/70 transition-colors">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>

          {/* Day labels */}
          <div className="grid grid-cols-7 mb-1">
            {DAY_LABELS.map((d, i) => (
              <div key={i} className="text-center text-xs text-white/25 font-semibold py-1">{d}</div>
            ))}
          </div>

          {/* Calendar grid */}
          <div className="grid grid-cols-7 gap-1">
            {calendarCells.map((cell, i) => {
              if (!cell.date) return <div key={i} />
              const isWorkout = workoutDaySet.has(cell.date)
              const isIncomplete = incompleteDaySet.has(cell.date)
              const isClickable = isWorkout || isIncomplete
              return (
                <button
                  key={cell.date}
                  onClick={() => handleDayClick(cell.date!)}
                  disabled={!isClickable}
                  className={`aspect-square rounded-xl flex items-center justify-center text-xs font-semibold transition-all ${
                    isWorkout
                      ? 'bg-purple-600/60 text-white hover:bg-purple-500/70 border border-purple-500/40'
                      : isIncomplete
                      ? 'bg-amber-600/40 text-amber-200 hover:bg-amber-500/50 border border-amber-600/30'
                      : 'text-white/30 bg-transparent'
                  } disabled:cursor-default`}
                >
                  {cell.dayNum}
                </button>
              )
            })}
          </div>

          {/* Legend */}
          <div className="flex items-center gap-4 mt-4 justify-center">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-md bg-purple-600/60 border border-purple-500/40" />
              <span className="text-xs text-white/30">Completed</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-md bg-amber-600/40 border border-amber-600/30" />
              <span className="text-xs text-white/30">Auto-completed</span>
            </div>
          </div>
        </div>
      )}

      {/* Day detail modal */}
      {selectedDay && (
        <DayDetailModal
          householdId={householdId}
          sessionId={selectedDay.sessionId}
          dateStr={selectedDay.date}
          onClose={() => setSelectedDay(null)}
        />
      )}
    </div>
  )
}

'use client'

import { useState, useEffect, useCallback } from 'react'
import { FITNESS } from '@/locales/en'
import { apiClient, getErrorMessage } from '@/lib/api/client'
import type { FitnessMetrics } from '@/lib/types/fitness'

interface FitnessMetricsProps {
  householdId: string
  userId: string
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate()
}

function getFirstDayOfWeek(year: number, month: number): number {
  return new Date(year, month - 1, 1).getDay()
}

export default function FitnessMetrics({ householdId }: FitnessMetricsProps) {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [metrics, setMetrics] = useState<FitnessMetrics | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const loadMetrics = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await apiClient.get<{ data: FitnessMetrics }>(
        `/api/fitness/${householdId}/metrics?year=${year}&month=${month}`,
      )
      setMetrics(res.data.data)
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [householdId, year, month])

  useEffect(() => {
    void loadMetrics()
  }, [loadMetrics])

  function prevMonth() {
    if (month === 1) { setYear((y) => y - 1); setMonth(12) }
    else setMonth((m) => m - 1)
  }

  function nextMonth() {
    if (month === 12) { setYear((y) => y + 1); setMonth(1) }
    else setMonth((m) => m + 1)
  }

  const workoutDaySet = new Set(metrics?.workout_days ?? [])
  const daysInMonth = getDaysInMonth(year, month)
  const firstDow = getFirstDayOfWeek(year, month)
  const calCells: (number | null)[] = [
    ...Array(firstDow).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]
  while (calCells.length % 7 !== 0) calCells.push(null)

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold" style={{ color: '#9397ab' }}>{FITNESS.SECTION_METRICS}</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={prevMonth}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-white/40 hover:text-white/70 hover:bg-white/5 transition-colors"
            aria-label="Previous month"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
          <span className="text-sm font-medium text-white min-w-[120px] text-center">
            {MONTH_NAMES[month - 1]} {year}
          </span>
          <button
            onClick={nextMonth}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-white/40 hover:text-white/70 hover:bg-white/5 transition-colors"
            aria-label="Next month"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M9 18l6-6-6-6" />
            </svg>
          </button>
        </div>
      </div>

      {error && (
        <p className="text-sm text-red-400">{error}</p>
      )}

      {loading ? (
        <div className="flex justify-center py-10">
          <div className="w-6 h-6 rounded-full border-2 border-indigo-400 border-t-transparent animate-spin" />
        </div>
      ) : (
        <>
          {/* Stats summary */}
          <div
            className="flex items-center gap-3 rounded-2xl px-5 py-4"
            style={{ background: 'rgba(145,132,217,0.08)', border: '1px solid rgba(145,132,217,0.15)' }}
          >
            <span
              className="text-3xl font-bold tabular-nums"
              style={{ color: '#9184d9' }}
            >
              {metrics?.total_sessions ?? 0}
            </span>
            <span className="text-sm" style={{ color: '#9397ab' }}>{FITNESS.METRICS_WORKOUTS}</span>
          </div>

          {/* Calendar grid */}
          <div>
            <div className="grid grid-cols-7 mb-1">
              {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((d) => (
                <div key={d} className="text-center text-xs font-medium pb-1" style={{ color: '#75798c' }}>
                  {d}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {calCells.map((day, idx) => {
                if (day === null) return <div key={idx} />
                const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
                const worked = workoutDaySet.has(dateStr)
                const isToday = dateStr === new Date().toLocaleDateString('en-CA')
                return (
                  <div
                    key={idx}
                    className="aspect-square flex items-center justify-center rounded-lg text-xs font-medium"
                    style={{
                      background: worked
                        ? 'rgba(145,132,217,0.25)'
                        : isToday
                        ? 'rgba(255,255,255,0.06)'
                        : 'transparent',
                      color: worked ? '#e9e9ed' : isToday ? '#cfd3e5' : '#75798c',
                      boxShadow: worked ? '0 0 8px rgba(145,132,217,0.3)' : undefined,
                      border: isToday && !worked ? '1px solid rgba(145,132,217,0.3)' : undefined,
                    }}
                  >
                    {day}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Exercise breakdown */}
          {metrics && metrics.exercise_breakdown.length > 0 ? (
            <div>
              <h3 className="text-xs font-semibold mb-3" style={{ color: '#9397ab' }}>Exercise Breakdown</h3>
              <div className="flex flex-col gap-2">
                {metrics.exercise_breakdown.map((ex) => (
                  <div
                    key={ex.exercise_id}
                    className="flex items-center justify-between rounded-xl px-4 py-3"
                    style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(233,233,237,0.06)' }}
                  >
                    <div>
                      <p className="text-sm font-medium text-white">{ex.exercise_name}</p>
                      <p className="text-xs mt-0.5" style={{ color: '#75798c' }}>
                        {ex.total_sets} sets
                      </p>
                    </div>
                    <div className="flex gap-4 text-right">
                      {ex.avg_weight != null && (
                        <div>
                          <p className="text-xs font-semibold text-white">{ex.avg_weight}</p>
                          <p className="text-xs" style={{ color: '#75798c' }}>{FITNESS.METRICS_AVG_WEIGHT}</p>
                        </div>
                      )}
                      {ex.avg_reps != null && (
                        <div>
                          <p className="text-xs font-semibold text-white">{ex.avg_reps}</p>
                          <p className="text-xs" style={{ color: '#75798c' }}>{FITNESS.METRICS_AVG_REPS}</p>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-sm" style={{ color: '#75798c' }}>{FITNESS.METRICS_NO_DATA}</p>
          )}
        </>
      )}
    </div>
  )
}

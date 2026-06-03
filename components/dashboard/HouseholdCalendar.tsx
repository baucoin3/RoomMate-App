'use client'

import { useState } from 'react'
import { apiClient, getErrorMessage } from '@/lib/api/client'
import { ChevronLeftIcon, ChevronRightIcon } from '@/components/icons'
import { HOUSEHOLD_DASHBOARD } from '@/locales/en'
import type { CalendarData, CalendarMealLog, CalendarBillDot, CalendarReceiptDot } from '@/lib/types/dashboard'

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
] as const

const MEAL_DOT_COLOR = '#5DCAA5'
const RECEIPT_DOT_COLOR = '#818cf8'

interface HouseholdCalendarProps {
  initialData: CalendarData
  householdId: string
  initialYear: number
  initialMonth: number
}

interface DayEvents {
  bills: CalendarBillDot[]
  meals: CalendarMealLog[]
  receipts: CalendarReceiptDot[]
}

function getDayEvents(year: number, month: number, day: number, data: CalendarData): DayEvents {
  const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  return {
    bills: data.bill_dots.filter((b) => b.due_day === day),
    meals: data.meal_logs.filter((m) => m.date === dateStr),
    receipts: (data.receipt_dots ?? []).filter((r) => r.date === dateStr),
  }
}

function DayTooltip({ events }: { events: DayEvents }) {
  const all = [
    ...events.bills.map((b) => ({ color: b.color, label: HOUSEHOLD_DASHBOARD.CALENDAR.BILL_DUE(b.description), icon: null })),
    ...events.meals.map((m) => ({ color: MEAL_DOT_COLOR, label: HOUSEHOLD_DASHBOARD.CALENDAR.RECIPE_MADE(m.made_by_name, m.recipe_name), icon: null })),
    ...events.receipts.map((r) => ({
      color: RECEIPT_DOT_COLOR,
      label: r.merchant_name
        ? HOUSEHOLD_DASHBOARD.CALENDAR.GROCERY_VISIT(r.merchant_name)
        : HOUSEHOLD_DASHBOARD.CALENDAR.GROCERY_VISIT_UNKNOWN,
      icon: '🛍',
    })),
  ]
  const visible = all.slice(0, 4)
  const extra = all.length - visible.length

  return (
    <div className="absolute left-1/2 -translate-x-1/2 top-full mt-1.5 z-50 rounded-xl border border-[--color-border-primary] bg-[--color-background-card] shadow-xl p-2.5 min-w-[180px] max-w-[220px]">
      {visible.map((item, i) => (
        <div key={i} className="flex items-center gap-1.5 py-0.5">
          {item.icon ? (
            <span className="text-[10px] leading-none shrink-0">{item.icon}</span>
          ) : (
            <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
          )}
          <span className="text-[11px] text-[--color-text-secondary] leading-tight">{item.label}</span>
        </div>
      ))}
      {extra > 0 && (
        <p className="text-[11px] text-[--color-text-tertiary] mt-0.5 pl-3.5">
          {HOUSEHOLD_DASHBOARD.CALENDAR.MORE_EVENTS(extra)}
        </p>
      )}
    </div>
  )
}

export default function HouseholdCalendar({
  initialData,
  householdId,
  initialYear,
  initialMonth,
}: HouseholdCalendarProps) {
  const [year, setYear] = useState(initialYear)
  const [month, setMonth] = useState(initialMonth)
  const [calendarData, setCalendarData] = useState<CalendarData>(initialData)
  const [loading, setLoading] = useState(false)
  const [hoveredDay, setHoveredDay] = useState<number | null>(null)

  async function navigate(newYear: number, newMonth: number) {
    setLoading(true)
    setHoveredDay(null)
    try {
      const res = await apiClient.get<{ data: CalendarData }>(
        `/api/dashboard/${householdId}/calendar?year=${newYear}&month=${newMonth}`,
      )
      setCalendarData(res.data.data)
      setYear(newYear)
      setMonth(newMonth)
    } catch (err) {
      console.error('[HouseholdCalendar]', getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  function prevMonth() {
    const d = new Date(year, month - 1, 1)
    void navigate(d.getFullYear(), d.getMonth())
  }

  function nextMonth() {
    const d = new Date(year, month + 1, 1)
    void navigate(d.getFullYear(), d.getMonth())
  }

  const today = new Date()
  const isCurrentMonth = today.getFullYear() === year && today.getMonth() === month
  const todayDay = today.getDate()

  const firstDayOfMonth = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const daysInPrevMonth = new Date(year, month, 0).getDate()

  const totalCells = Math.ceil((firstDayOfMonth + daysInMonth) / 7) * 7
  const cells: { day: number; current: boolean }[] = []

  for (let i = 0; i < firstDayOfMonth; i++) {
    cells.push({ day: daysInPrevMonth - firstDayOfMonth + 1 + i, current: false })
  }
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ day: d, current: true })
  }
  const trailing = totalCells - cells.length
  for (let d = 1; d <= trailing; d++) {
    cells.push({ day: d, current: false })
  }

  return (
    <div className="rounded-2xl bg-[#1c1c24] border border-[--color-border-secondary] p-4 md:p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <button
          type="button"
          onClick={prevMonth}
          disabled={loading}
          aria-label={HOUSEHOLD_DASHBOARD.CALENDAR.PREV}
          className="w-7 h-7 flex items-center justify-center rounded-lg text-[--color-text-tertiary] hover:text-[--color-text-primary] hover:bg-white/5 transition-colors disabled:opacity-40"
        >
          <ChevronLeftIcon className="h-4 w-4" />
        </button>

        <div className="flex items-center gap-2">
          <h2
            className="text-base font-semibold text-[--color-text-primary]"
            style={{ fontFamily: "'Playfair Display', serif" }}
          >
            {MONTH_NAMES[month]} {year}
          </h2>
          {loading && (
            <span className="text-[11px] text-[--color-text-tertiary]">
              {HOUSEHOLD_DASHBOARD.CALENDAR.LOADING}
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={nextMonth}
          disabled={loading}
          aria-label={HOUSEHOLD_DASHBOARD.CALENDAR.NEXT}
          className="w-7 h-7 flex items-center justify-center rounded-lg text-[--color-text-tertiary] hover:text-[--color-text-primary] hover:bg-white/5 transition-colors disabled:opacity-40"
        >
          <ChevronRightIcon className="h-4 w-4" />
        </button>
      </div>

      {/* Day-of-week headers */}
      <div className="grid grid-cols-7 mb-1">
        {HOUSEHOLD_DASHBOARD.CALENDAR.DAYS.map((d, i) => (
          <div key={i} className="text-center text-[11px] font-medium text-[--color-text-tertiary] py-1">
            {d}
          </div>
        ))}
      </div>

      {/* Day cells */}
      <div className="grid grid-cols-7 gap-0.5">
        {cells.map((cell, i) => {
          if (!cell.current) {
            return (
              <div
                key={i}
                className="min-h-[48px] rounded-lg p-1 opacity-25"
              >
                <span className="text-[11px] text-[--color-text-tertiary]">{cell.day}</span>
              </div>
            )
          }

          const events = getDayEvents(year, month, cell.day, calendarData)
          const hasEvents = events.bills.length > 0 || events.meals.length > 0 || events.receipts.length > 0
          const isToday = isCurrentMonth && cell.day === todayDay
          const isHovered = hoveredDay === cell.day

          const visibleBills = events.bills.slice(0, 2)
          const visibleMeals = events.meals.slice(0, Math.max(0, 2 - visibleBills.length))
          const visibleReceipts = events.receipts.slice(0, Math.max(0, 3 - visibleBills.length - visibleMeals.length))

          return (
            <div
              key={i}
              className={`relative min-h-[48px] rounded-lg p-1 cursor-default transition-colors ${
                hasEvents ? 'hover:bg-white/5' : ''
              } ${isHovered && hasEvents ? 'bg-white/5' : ''}`}
              onMouseEnter={() => hasEvents && setHoveredDay(cell.day)}
              onMouseLeave={() => setHoveredDay(null)}
            >
              {/* Day number */}
              <div className="flex justify-center">
                <span
                  className={`text-[11px] font-medium w-5 h-5 flex items-center justify-center rounded-full ${
                    isToday
                      ? 'bg-amber-500/30 text-amber-300'
                      : 'text-[--color-text-secondary]'
                  }`}
                >
                  {cell.day}
                </span>
              </div>

              {/* Event dots */}
              {hasEvents && (
                <div className="flex flex-wrap gap-0.5 justify-center mt-1">
                  {visibleBills.map((b, di) => (
                    <span
                      key={`b-${di}`}
                      className="w-1.5 h-1.5 rounded-full"
                      style={{ backgroundColor: b.color }}
                    />
                  ))}
                  {visibleMeals.map((_, mi) => (
                    <span
                      key={`m-${mi}`}
                      className="w-1.5 h-1.5 rounded-full"
                      style={{ backgroundColor: MEAL_DOT_COLOR }}
                    />
                  ))}
                  {visibleReceipts.map((_, ri) => (
                    <span
                      key={`r-${ri}`}
                      className="text-[8px] leading-none"
                    >
                      🛍
                    </span>
                  ))}
                </div>
              )}

              {/* Tooltip */}
              {isHovered && hasEvents && <DayTooltip events={events} />}
            </div>
          )
        })}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-3 mt-4 pt-3 border-t border-[--color-border-secondary]">
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-[#5DCAA5]" />
          <span className="text-[11px] text-[--color-text-tertiary]">Meal cooked</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] leading-none">🛍</span>
          <span className="text-[11px] text-[--color-text-tertiary]">Grocery run</span>
        </div>
        {calendarData.bill_dots.slice(0, 2).map((b) => (
          <div key={b.description} className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: b.color }} />
            <span className="text-[11px] text-[--color-text-tertiary] truncate max-w-[80px]">{b.description}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

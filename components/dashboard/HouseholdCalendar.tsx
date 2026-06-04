'use client'

import { useState, useRef, useEffect } from 'react'
import { apiClient, getErrorMessage } from '@/lib/api/client'
import { ChevronLeftIcon, ChevronRightIcon } from '@/components/icons'
import { HOUSEHOLD_DASHBOARD } from '@/locales/en'
import type { CalendarData, CalendarCustomEvent, CalendarMealLog, CalendarBillDot, CalendarReceiptDot } from '@/lib/types/dashboard'

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
] as const

const MEAL_DOT_COLOR = '#5DCAA5'
const RECEIPT_DOT_COLOR = '#818cf8'
const CUSTOM_EVENT_DOT_COLOR = '#f59e0b'

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
  customEvents: CalendarCustomEvent[]
}

interface SelectedDay {
  year: number
  month: number
  day: number
}

function getDayEvents(year: number, month: number, day: number, data: CalendarData): DayEvents {
  const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  return {
    bills: data.bill_dots.filter((b) => b.due_day === day),
    meals: data.meal_logs.filter((m) => m.date === dateStr),
    receipts: (data.receipt_dots ?? []).filter((r) => r.date === dateStr),
    customEvents: (data.custom_events ?? []).filter((e) => e.date === dateStr),
  }
}

function DayModal({
  selected,
  events,
  householdId,
  onClose,
  onEventAdded,
  onEventDeleted,
}: {
  selected: SelectedDay
  events: DayEvents
  householdId: string
  onClose: () => void
  onEventAdded: (event: CalendarCustomEvent) => void
  onEventDeleted: (id: string) => void
}) {
  const [title, setTitle] = useState('')
  const [note, setNote] = useState('')
  const [adding, setAdding] = useState(false)
  const [titleError, setTitleError] = useState('')
  const backdropRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const dateStr = `${selected.year}-${String(selected.month + 1).padStart(2, '0')}-${String(selected.day).padStart(2, '0')}`
  const displayDate = new Date(selected.year, selected.month, selected.day).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  })

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = title.trim()
    if (!trimmed) {
      setTitleError(HOUSEHOLD_DASHBOARD.CALENDAR.EVENT_TITLE_REQUIRED)
      return
    }
    if (trimmed.length > 100) {
      setTitleError(HOUSEHOLD_DASHBOARD.CALENDAR.EVENT_TITLE_TOO_LONG)
      return
    }
    setTitleError('')
    setAdding(true)
    try {
      const res = await apiClient.post<{ data: CalendarCustomEvent }>(
        `/api/dashboard/${householdId}/events`,
        { date: dateStr, title: trimmed, note: note.trim() || null },
      )
      onEventAdded(res.data.data)
      setTitle('')
      setNote('')
    } catch (err) {
      console.error('[DayModal/add]', getErrorMessage(err))
    } finally {
      setAdding(false)
    }
  }

  async function handleDelete(id: string) {
    try {
      await apiClient.delete(`/api/dashboard/${householdId}/events/${id}`)
      onEventDeleted(id)
    } catch (err) {
      console.error('[DayModal/delete]', getErrorMessage(err))
    }
  }

  return (
    <div
      ref={backdropRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={(e) => { if (e.target === backdropRef.current) onClose() }}
    >
      <div className="w-full max-w-sm rounded-2xl bg-[#1c1c24] border border-[--color-border-secondary] shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[--color-border-secondary]">
          <h2
            className="text-base font-semibold text-[--color-text-primary]"
            style={{ fontFamily: "'Playfair Display', serif" }}
          >
            {displayDate}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="w-7 h-7 flex items-center justify-center rounded-lg text-[--color-text-tertiary] hover:text-[--color-text-primary] hover:bg-white/5 transition-colors"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="px-5 py-4 space-y-4 max-h-[70vh] overflow-y-auto">
          {/* Existing auto events (read-only) */}
          {(events.bills.length > 0 || events.meals.length > 0 || events.receipts.length > 0) && (
            <div className="space-y-1.5">
              {events.bills.map((b, i) => (
                <div key={`b-${i}`} className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: b.color }} />
                  <span className="text-[13px] text-[--color-text-secondary]">{HOUSEHOLD_DASHBOARD.CALENDAR.BILL_DUE(b.description)}</span>
                </div>
              ))}
              {events.meals.map((m, i) => (
                <div key={`m-${i}`} className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: MEAL_DOT_COLOR }} />
                  <span className="text-[13px] text-[--color-text-secondary]">{HOUSEHOLD_DASHBOARD.CALENDAR.RECIPE_MADE(m.made_by_name, m.recipe_name)}</span>
                </div>
              ))}
              {events.receipts.map((r, i) => (
                <div key={`r-${i}`} className="flex items-center gap-2">
                  <span className="text-[10px] leading-none shrink-0">🛍</span>
                  <span className="text-[13px] text-[--color-text-secondary]">
                    {r.merchant_name ? HOUSEHOLD_DASHBOARD.CALENDAR.GROCERY_VISIT(r.merchant_name) : HOUSEHOLD_DASHBOARD.CALENDAR.GROCERY_VISIT_UNKNOWN}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Custom reminders */}
          <div>
            <p className="text-[11px] font-medium text-[--color-text-tertiary] uppercase tracking-wide mb-2">Reminders</p>
            {events.customEvents.length === 0 ? (
              <p className="text-[13px] text-[--color-text-tertiary]">{HOUSEHOLD_DASHBOARD.CALENDAR.NO_EVENTS_TODAY}</p>
            ) : (
              <div className="space-y-2">
                {events.customEvents.map((ev) => (
                  <div key={ev.id} className="flex items-start gap-2 group">
                    <span className="text-[13px] leading-none mt-0.5 shrink-0">🔔</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] text-[--color-text-primary] leading-snug">{ev.title}</p>
                      {ev.note && (
                        <p className="text-[12px] text-[--color-text-tertiary] mt-0.5 leading-snug">{ev.note}</p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => void handleDelete(ev.id)}
                      aria-label={HOUSEHOLD_DASHBOARD.CALENDAR.DELETE_EVENT}
                      className="opacity-0 group-hover:opacity-100 w-5 h-5 flex items-center justify-center rounded text-[--color-text-tertiary] hover:text-red-400 transition-all shrink-0 mt-0.5"
                    >
                      <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Add form */}
          <form onSubmit={(e) => void handleAdd(e)} className="pt-1 border-t border-[--color-border-secondary]">
            <p className="text-[11px] font-medium text-[--color-text-tertiary] uppercase tracking-wide mb-2">
              {HOUSEHOLD_DASHBOARD.CALENDAR.ADD_EVENT}
            </p>
            <div className="space-y-2">
              <div>
                <input
                  ref={inputRef}
                  type="text"
                  value={title}
                  onChange={(e) => { setTitle(e.target.value); setTitleError('') }}
                  placeholder={HOUSEHOLD_DASHBOARD.CALENDAR.EVENT_TITLE_PLACEHOLDER}
                  maxLength={100}
                  className="w-full rounded-lg bg-white/5 border border-[--color-border-primary] px-3 py-2 text-[13px] text-[--color-text-primary] placeholder:text-[--color-text-tertiary] focus:outline-none focus:border-amber-500/50 transition-colors"
                />
                {titleError && (
                  <p className="text-[11px] text-red-400 mt-1">{titleError}</p>
                )}
              </div>
              <input
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder={HOUSEHOLD_DASHBOARD.CALENDAR.EVENT_NOTE_PLACEHOLDER}
                className="w-full rounded-lg bg-white/5 border border-[--color-border-primary] px-3 py-2 text-[13px] text-[--color-text-primary] placeholder:text-[--color-text-tertiary] focus:outline-none focus:border-amber-500/50 transition-colors"
              />
              <button
                type="submit"
                disabled={adding}
                className="w-full rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/30 px-4 py-2 text-[13px] font-medium text-amber-300 transition-colors disabled:opacity-50"
              >
                {adding ? HOUSEHOLD_DASHBOARD.CALENDAR.ADDING_EVENT : HOUSEHOLD_DASHBOARD.CALENDAR.ADD_EVENT_BUTTON}
              </button>
            </div>
          </form>
        </div>
      </div>
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
  const [selectedDay, setSelectedDay] = useState<SelectedDay | null>(null)

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

  function handleEventAdded(event: CalendarCustomEvent) {
    setCalendarData((prev) => ({
      ...prev,
      custom_events: [...(prev.custom_events ?? []), event],
    }))
  }

  function handleEventDeleted(id: string) {
    setCalendarData((prev) => ({
      ...prev,
      custom_events: (prev.custom_events ?? []).filter((e) => e.id !== id),
    }))
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

  const selectedDayEvents =
    selectedDay
      ? getDayEvents(selectedDay.year, selectedDay.month, selectedDay.day, calendarData)
      : null

  return (
    <>
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
              className="text-lg font-semibold text-[--color-text-primary]"
              style={{ fontFamily: "'Playfair Display', serif" }}
            >
              {MONTH_NAMES[month]} {year}
            </h2>
            {loading && (
              <span className="text-xs text-[--color-text-tertiary]">
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
            <div key={i} className="text-center text-xs font-medium text-[--color-text-tertiary] py-1">
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
                  className="min-h-[52px] rounded-lg p-1 opacity-25"
                >
                  <span className="text-xs text-[--color-text-tertiary]">{cell.day}</span>
                </div>
              )
            }

            const events = getDayEvents(year, month, cell.day, calendarData)
            const hasAutoEvents = events.bills.length > 0 || events.meals.length > 0 || events.receipts.length > 0
            const hasCustomEvents = events.customEvents.length > 0
            const hasEvents = hasAutoEvents || hasCustomEvents
            const isToday = isCurrentMonth && cell.day === todayDay
            const isHovered = hoveredDay === cell.day

            const visibleBills = events.bills.slice(0, 2)
            const visibleMeals = events.meals.slice(0, Math.max(0, 2 - visibleBills.length))
            const visibleReceipts = events.receipts.slice(0, Math.max(0, 3 - visibleBills.length - visibleMeals.length))

            return (
              <div
                key={i}
                className={`relative min-h-[52px] rounded-lg p-1 cursor-pointer transition-colors hover:bg-white/5 ${
                  isHovered && hasEvents ? 'bg-white/5' : ''
                }`}
                onClick={() => setSelectedDay({ year, month, day: cell.day })}
                onMouseEnter={() => hasEvents && setHoveredDay(cell.day)}
                onMouseLeave={() => setHoveredDay(null)}
              >
                {/* Day number */}
                <div className="flex justify-center">
                  <span
                    className={`text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full ${
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
                        className="text-[9px] leading-none"
                      >
                        🛍
                      </span>
                    ))}
                    {hasCustomEvents && (
                      <span
                        className="w-1.5 h-1.5 rounded-full"
                        style={{ backgroundColor: CUSTOM_EVENT_DOT_COLOR }}
                      />
                    )}
                  </div>
                )}

                {/* Event tooltip on hover */}
                {isHovered && hasEvents && (
                  <div className="absolute left-1/2 -translate-x-1/2 top-full mt-1.5 z-50 rounded-xl border border-[--color-border-primary] bg-[--color-background-card] shadow-xl p-2.5 min-w-[180px] max-w-[220px]">
                    {[
                      ...events.bills.map((b) => ({ color: b.color, label: HOUSEHOLD_DASHBOARD.CALENDAR.BILL_DUE(b.description), icon: null as string | null })),
                      ...events.meals.map((m) => ({ color: MEAL_DOT_COLOR, label: HOUSEHOLD_DASHBOARD.CALENDAR.RECIPE_MADE(m.made_by_name, m.recipe_name), icon: null as string | null })),
                      ...events.receipts.map((r) => ({
                        color: RECEIPT_DOT_COLOR,
                        label: r.merchant_name
                          ? HOUSEHOLD_DASHBOARD.CALENDAR.GROCERY_VISIT(r.merchant_name)
                          : HOUSEHOLD_DASHBOARD.CALENDAR.GROCERY_VISIT_UNKNOWN,
                        icon: '🛍',
                      })),
                      ...events.customEvents.map((e) => ({
                        color: CUSTOM_EVENT_DOT_COLOR,
                        label: e.title,
                        icon: '🔔',
                      })),
                    ].slice(0, 4).map((item, idx) => (
                      <div key={idx} className="flex items-center gap-1.5 py-0.5">
                        {item.icon ? (
                          <span className="text-[11px] leading-none shrink-0">{item.icon}</span>
                        ) : (
                          <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                        )}
                        <span className="text-xs text-[--color-text-secondary] leading-tight">{item.label}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-3 mt-4 pt-3 border-t border-[--color-border-secondary]">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#5DCAA5]" />
            <span className="text-xs text-[--color-text-tertiary]">Meal cooked</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] leading-none">🛍</span>
            <span className="text-xs text-[--color-text-tertiary]">Grocery run</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: CUSTOM_EVENT_DOT_COLOR }} />
            <span className="text-xs text-[--color-text-tertiary]">{HOUSEHOLD_DASHBOARD.CALENDAR.CUSTOM_EVENT_DOT_LABEL}</span>
          </div>
          {calendarData.bill_dots.slice(0, 2).map((b) => (
            <div key={b.description} className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: b.color }} />
              <span className="text-xs text-[--color-text-tertiary] truncate max-w-[80px]">{b.description}</span>
            </div>
          ))}
        </div>
      </div>

      {selectedDay && selectedDayEvents && (
        <DayModal
          selected={selectedDay}
          events={selectedDayEvents}
          householdId={householdId}
          onClose={() => setSelectedDay(null)}
          onEventAdded={handleEventAdded}
          onEventDeleted={handleEventDeleted}
        />
      )}
    </>
  )
}

/**
 * Recurring bill cycle date utilities.
 *
 * Cycle rules:
 * - dueDayOfMonth is clamped to the last valid day of each month (e.g. 31 → Feb 28/29).
 * - The current cycle is anchored to the most recent due date that has occurred or is today:
 *   - If today >= due day in the current calendar month → cycle due = this month's due day.
 *   - Else → cycle due = last month's due day.
 * - MVP expense matching: an expense belongs to the cycle when its date shares the same
 *   calendar month and year as cycle_due_date (see isDateInCycle).
 */

function toIsoDate(year: number, month: number, day: number): string {
  const y = String(year)
  const m = String(month + 1).padStart(2, '0')
  const d = String(day).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/** Last valid day of month for a given due day (clamps 31 → 28/29/30 as needed). */
export function clampDueDayToMonth(dueDayOfMonth: number, year: number, month: number): number {
  const lastDay = new Date(year, month + 1, 0).getDate()
  return Math.min(Math.max(dueDayOfMonth, 1), lastDay)
}

/** Due date (ISO yyyy-mm-dd) for the billing cycle we are currently in. */
export function getCurrentCycleDueDate(dueDayOfMonth: number, today: Date = new Date()): string {
  const year = today.getFullYear()
  const month = today.getMonth()
  const todayDay = today.getDate()

  const thisMonthDueDay = clampDueDayToMonth(dueDayOfMonth, year, month)

  if (todayDay >= thisMonthDueDay) {
    return toIsoDate(year, month, thisMonthDueDay)
  }

  const prevMonth = month === 0 ? 11 : month - 1
  const prevYear = month === 0 ? year - 1 : year
  const prevMonthDueDay = clampDueDayToMonth(dueDayOfMonth, prevYear, prevMonth)

  return toIsoDate(prevYear, prevMonth, prevMonthDueDay)
}

/** Start/end ISO dates inclusive for matching an expense to this cycle. */
export function getCurrentCycleDateRange(
  dueDayOfMonth: number,
  today: Date = new Date(),
): { start: string; end: string } {
  const cycleDueDate = getCurrentCycleDueDate(dueDayOfMonth, today)
  const [yearStr, monthStr] = cycleDueDate.split('-')
  const year = Number(yearStr)
  const month = Number(monthStr) - 1

  const start = toIsoDate(year, month, 1)
  const endDay = new Date(year, month + 1, 0).getDate()
  const end = toIsoDate(year, month, endDay)

  return { start, end }
}

/** MVP: expense belongs to cycle when date shares calendar month/year with cycle_due_date. */
export function isDateInCycle(expenseDate: string, cycleDueDate: string): boolean {
  const expense = expenseDate.slice(0, 10)
  const cycle = cycleDueDate.slice(0, 10)
  return expense.slice(0, 7) === cycle.slice(0, 7)
}

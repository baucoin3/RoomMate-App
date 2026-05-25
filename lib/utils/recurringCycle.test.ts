import { describe, it, expect } from 'vitest'
import {
  getCurrentCycleDueDate,
  getCurrentCycleDateRange,
  isDateInCycle,
  clampDueDayToMonth,
} from './recurringCycle'

describe('getCurrentCycleDueDate', () => {
  it('uses this month due day when today is on or after due day (due on 1st)', () => {
    expect(getCurrentCycleDueDate(1, new Date(2026, 4, 15))).toBe('2026-05-01')
  })

  it('uses last month due day when today is before due day (due on 15th)', () => {
    expect(getCurrentCycleDueDate(15, new Date(2026, 4, 10))).toBe('2026-04-15')
  })

  it('clamps due on 31st in February to last day of month', () => {
    expect(getCurrentCycleDueDate(31, new Date(2026, 1, 28))).toBe('2026-02-28')
  })

  it('clamps due on 31st in February leap year', () => {
    expect(getCurrentCycleDueDate(31, new Date(2024, 1, 29))).toBe('2024-02-29')
  })

  it('uses prior month when today is before due day at month rollover', () => {
    expect(getCurrentCycleDueDate(25, new Date(2026, 2, 10))).toBe('2026-02-25')
  })
})

describe('getCurrentCycleDateRange', () => {
  it('returns full calendar month of cycle due date', () => {
    const range = getCurrentCycleDateRange(15, new Date(2026, 4, 20))
    expect(range).toEqual({ start: '2026-05-01', end: '2026-05-31' })
  })
})

describe('isDateInCycle', () => {
  it('matches same month and year', () => {
    expect(isDateInCycle('2026-05-15', '2026-05-01')).toBe(true)
    expect(isDateInCycle('2026-04-15', '2026-05-01')).toBe(false)
  })
})

describe('clampDueDayToMonth', () => {
  it('clamps 31 to 30 in April', () => {
    expect(clampDueDayToMonth(31, 2026, 3)).toBe(30)
  })
})

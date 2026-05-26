import { describe, it, expect } from 'vitest'
import {
  buildDefaultSplits,
  buildEqualAmounts,
  buildEqualPercentages,
  normalizePercentages,
  splitsSumTo100,
} from './splits'

describe('buildEqualPercentages', () => {
  it('returns empty array for zero count', () => {
    expect(buildEqualPercentages(0)).toEqual([])
  })

  it('splits 3 ways with remainder on last person', () => {
    expect(buildEqualPercentages(3)).toEqual([33.33, 33.33, 33.34])
    expect(splitsSumTo100(buildEqualPercentages(3).map((percentage) => ({ percentage })))).toBe(true)
  })

  it('splits 4 ways evenly', () => {
    expect(buildEqualPercentages(4)).toEqual([25, 25, 25, 25])
  })
})

describe('buildEqualAmounts', () => {
  it('splits $10 across 3 people with penny remainder on last', () => {
    expect(buildEqualAmounts(10, 3)).toEqual([3.33, 3.33, 3.34])
    expect(buildEqualAmounts(10, 3).reduce((sum, n) => sum + n, 0)).toBe(10)
  })
})

describe('normalizePercentages', () => {
  it('fixes drift from naive rounding', () => {
    expect(normalizePercentages([33.33, 33.33, 33.33])).toEqual([33.33, 33.33, 33.34])
  })
})

describe('buildDefaultSplits', () => {
  it('assigns equal percentages that sum to 100', () => {
    const splits = buildDefaultSplits([
      { id: 'a' },
      { id: 'b' },
      { id: 'c' },
    ])
    expect(splits.map((s) => s.percentage)).toEqual([33.33, 33.33, 33.34])
    expect(splitsSumTo100(splits)).toBe(true)
  })
})

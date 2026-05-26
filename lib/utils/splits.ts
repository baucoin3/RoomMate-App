export const SPLIT_TOTAL = 100

export function roundPercentage(value: number): number {
  return Math.round(value * 10000) / 10000
}

export function roundCurrency(value: number): number {
  return Math.round(value * 100) / 100
}

/** Returns N percentages that sum to exactly 100 (remainder on last slot). */
export function buildEqualPercentages(count: number): number[] {
  if (count <= 0) return []
  const base = Math.floor((SPLIT_TOTAL / count) * 100) / 100
  const remainder = Math.round((SPLIT_TOTAL - base * count) * 100) / 100
  return Array.from({ length: count }, (_, i) =>
    i === count - 1 ? roundPercentage(base + remainder) : base,
  )
}

/** Returns N dollar amounts that sum to exactly `total` (remainder on last slot). */
export function buildEqualAmounts(total: number, count: number): number[] {
  if (count <= 0) return []
  const base = Math.floor((total / count) * 100) / 100
  const remainder = Math.round((total - base * count) * 100) / 100
  return Array.from({ length: count }, (_, i) =>
    i === count - 1 ? roundCurrency(base + remainder) : base,
  )
}

/** Round values to 2 dp and push remainder onto the last slot so the sum equals `target`. */
export function normalizePercentages(values: number[], target = SPLIT_TOTAL): number[] {
  if (values.length === 0) return []
  if (values.length === 1) return [target]
  const rounded = values.slice(0, -1).map((v) => roundCurrency(v))
  const sumSoFar = rounded.reduce((sum, v) => sum + v, 0)
  return [...rounded, roundCurrency(target - sumSoFar)]
}

export function splitsSumTo100(splits: Array<{ percentage: number }>): boolean {
  const totalBp = splits.reduce(
    (sum, s) => sum + Math.round((Number(s.percentage) || 0) * 100),
    0,
  )
  return totalBp === SPLIT_TOTAL * 100
}

export function buildDefaultSplits(
  members: Array<{ id: string }>,
): Array<{ household_member_id: string; percentage: number }> {
  if (members.length === 0) return []
  const percentages = buildEqualPercentages(members.length)
  return members.map((m, i) => ({
    household_member_id: m.id,
    percentage: percentages[i],
  }))
}

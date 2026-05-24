export const SPLIT_TOTAL = 100

export function roundPercentage(value: number): number {
  return Math.round(value * 10000) / 10000
}

export function splitsSumTo100(splits: Array<{ percentage: number }>): boolean {
  const total = splits.reduce((sum, s) => sum + (Number(s.percentage) || 0), 0)
  return Math.abs(total - SPLIT_TOTAL) <= 0.01
}

export function buildDefaultSplits(
  members: Array<{ id: string }>,
): Array<{ household_member_id: string; percentage: number }> {
  if (members.length === 0) return []
  const base = Math.floor((100 / members.length) * 100) / 100
  const remainder = Math.round((100 - base * members.length) * 100) / 100
  return members.map((m, i) => ({
    household_member_id: m.id,
    percentage: i === members.length - 1 ? base + remainder : base,
  }))
}

import type { HouseholdItemWithAliases } from '@/lib/types/householdItems'

export type MatchType = 'exact_name' | 'alias' | 'fuzzy' | 'none'

export interface MatchResult {
  matchType: MatchType
  itemId: string | null
  confidence: number
  candidates: Array<{
    itemId: string
    name: string
    reason: string
    confidence: number
  }>
}

export function normalizeReceiptText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[''`]/g, '')
    .replace(/[-–—]/g, ' ')
    .replace(/[^a-z0-9 ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function tokenize(text: string): string[] {
  return normalizeReceiptText(text).split(' ').filter(Boolean)
}

function fuzzyMatchScore(rawTokens: string[], targetText: string): number {
  const targetTokens = tokenize(targetText)
  if (rawTokens.length === 0 || targetTokens.length === 0) return 0

  const matched = rawTokens.filter((t) =>
    targetTokens.some((tt) => tt.includes(t) || t.includes(tt)),
  ).length

  return matched / rawTokens.length
}

export function matchLineToHouseholdItem(
  rawDescription: string,
  items: HouseholdItemWithAliases[],
  options?: { minFuzzyScore?: number },
): MatchResult {
  const minFuzzyScore = options?.minFuzzyScore ?? 0.3
  const normalized = normalizeReceiptText(rawDescription)

  if (!normalized) {
    return { matchType: 'none', itemId: null, confidence: 0, candidates: [] }
  }

  const exactName = items.find(
    (item) => normalizeReceiptText(item.name) === normalized,
  )
  if (exactName) {
    return {
      matchType: 'exact_name',
      itemId: exactName.id,
      confidence: 1.0,
      candidates: [],
    }
  }

  for (const item of items) {
    const aliasHit = item.aliases?.find(
      (a) => a.alias_text === normalized,
    )
    if (aliasHit) {
      return {
        matchType: 'alias',
        itemId: item.id,
        confidence: 1.0,
        candidates: [],
      }
    }
  }

  const rawTokens = tokenize(rawDescription)
  const fuzzyCandidates = items
    .flatMap((item) => {
      const nameScore = fuzzyMatchScore(rawTokens, item.name)
      const aliasScores = (item.aliases ?? []).map((a) =>
        fuzzyMatchScore(rawTokens, a.display_text),
      )
      const bestScore = Math.max(nameScore, ...aliasScores, 0)
      if (bestScore < minFuzzyScore) return []

      const reason =
        nameScore >= bestScore
          ? `Name overlap`
          : `Alias overlap`

      return [{
        itemId: item.id,
        name: item.name,
        reason,
        confidence: Math.min(bestScore, 0.85),
      }]
    })
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 5)

  if (fuzzyCandidates.length > 0) {
    return {
      matchType: 'fuzzy',
      itemId: null,
      confidence: fuzzyCandidates[0].confidence,
      candidates: fuzzyCandidates,
    }
  }

  return { matchType: 'none', itemId: null, confidence: 0, candidates: [] }
}

import { RECEIPTS } from '@/locales/en'
import { splitsSumTo100 } from '@/lib/utils/splits'
import type { LineItemConfig, LineItemSplitRow, MatchSource } from '@/lib/types/receipts'

export type LineItemStatus = 'matched' | 'ai' | 'setup' | 'auto' | 'default_split' | 'set_up' | 'unassigned'

export interface SplitResolverContext {
  categories: Array<{
    id: string
    splits: Array<{ household_member_id: string; percentage: number; nickname: string | null }>
  }>
  allMembers: Array<{ id: string; name: string }>
}

export function getEqualSplitPercentage(memberCount: number): number {
  return memberCount > 0 ? Math.round(10000 / memberCount) / 100 : 0
}

export function categoryHasValidSplits(
  categoryId: string | null,
  ctx: SplitResolverContext,
): boolean {
  if (!categoryId) return false
  const cat = ctx.categories.find((c) => c.id === categoryId)
  if (!cat || cat.splits.length === 0) return false
  return splitsSumTo100(cat.splits)
}

export function getSplitsForLineItem(
  config: LineItemConfig,
  ctx: SplitResolverContext,
): LineItemSplitRow[] {
  if (config.useCustomSplit) {
    return config.customSplits
  }
  if (config.categoryId) {
    const cat = ctx.categories.find((c) => c.id === config.categoryId)
    if (cat && cat.splits.length > 0 && splitsSumTo100(cat.splits)) {
      return cat.splits.map((s) => ({
        household_member_id: s.household_member_id,
        nickname: s.nickname ?? s.household_member_id.slice(0, 8),
        percentage: s.percentage,
      }))
    }
  }
  const equalPct = getEqualSplitPercentage(ctx.allMembers.length)
  return ctx.allMembers.map((m) => ({
    household_member_id: m.id,
    nickname: m.name,
    percentage: equalPct,
  }))
}

export function usesDefaultEqualSplit(
  config: LineItemConfig,
  memberCount: number,
): boolean {
  return (
    memberCount > 0 &&
    !config.useCustomSplit &&
    config.categoryId === null &&
    config.householdItemId === null
  )
}

export function hasValidSplitAssignment(
  c: LineItemConfig,
  memberCount: number,
  ctx?: SplitResolverContext,
): boolean {
  if (memberCount === 0) return false

  if (c.householdItemId !== null) {
    if (!ctx) return true
    const resolved = getSplitsForLineItem(c, ctx)
    return resolved.length > 0 && splitsSumTo100(resolved)
  }

  if (c.useCustomSplit) {
    return c.customSplits.length > 0 && splitsSumTo100(c.customSplits)
  }

  if (c.categoryId !== null) {
    if (!ctx) return false
    return categoryHasValidSplits(c.categoryId, ctx)
  }

  return memberCount > 0
}

/** @deprecated Use hasValidSplitAssignment for split validity, isLineItemConfirmed for user ack. */
export function isLineItemConfigured(c: LineItemConfig, memberCount: number, ctx?: SplitResolverContext): boolean {
  return hasValidSplitAssignment(c, memberCount, ctx)
}

export function isLineItemConfirmed(c: LineItemConfig): boolean {
  return c.configured === true
}

export function isLineItemReadyToSave(
  c: LineItemConfig,
  memberCount: number,
  ctx?: SplitResolverContext,
): boolean {
  return isLineItemConfirmed(c) && hasValidSplitAssignment(c, memberCount, ctx)
}

function isAutoMatchSource(source: MatchSource): boolean {
  return source === 'catalog' || source === 'alias'
}

export function getLineItemStatus(
  c: LineItemConfig,
  memberCount: number,
  ctx?: SplitResolverContext,
): LineItemStatus {
  if (c.householdItemId !== null && isAutoMatchSource(c.matchSource)) {
    if (ctx && !hasValidSplitAssignment(c, memberCount, ctx)) return 'setup'
    return 'matched'
  }

  if (c.matchSource === 'ai' || c.matchSource === 'fuzzy' || (c.aiCandidates?.length ?? 0) > 0) {
    return 'ai'
  }

  if (c.householdItemId !== null) {
    if (ctx && !hasValidSplitAssignment(c, memberCount, ctx)) return 'setup'
    return 'matched'
  }

  if (usesDefaultEqualSplit(c, memberCount)) return 'setup'
  if (hasValidSplitAssignment(c, memberCount, ctx)) return 'setup'
  return 'setup'
}

export function lineItemStatusLabel(status: LineItemStatus, memberCount = 0): string {
  switch (status) {
    case 'matched':
      return RECEIPTS.ITEM_SETUP.STATUS_MATCHED
    case 'ai':
      return RECEIPTS.ITEM_SETUP.STATUS_AI
    case 'setup':
      return RECEIPTS.ITEM_SETUP.STATUS_SETUP
    case 'auto':
      return RECEIPTS.ITEM_SETUP.STATUS_MATCHED
    case 'default_split':
      return RECEIPTS.ITEM_SETUP.STATUS_SETUP
    case 'set_up':
      return RECEIPTS.ITEM_SETUP.STATUS_SETUP
    case 'unassigned':
      return memberCount === 0
        ? RECEIPTS.ITEM_SETUP.STATUS_NEEDS_SETUP
        : RECEIPTS.ITEM_SETUP.STATUS_SETUP
  }
}

export function lineItemStatusPillClass(status: LineItemStatus): string {
  switch (status) {
    case 'matched':
    case 'auto':
      return 'bg-green-500/12 text-green-400/90 border border-green-500/20'
    case 'ai':
      return 'bg-violet-500/12 text-violet-300/90 border border-violet-500/20'
    case 'setup':
    case 'default_split':
    case 'set_up':
      return 'bg-amber-500/12 text-amber-400/90 border border-amber-500/20'
    case 'unassigned':
      return 'bg-amber-500/12 text-amber-400/90 border border-amber-500/20'
  }
}

export function getLineItemSplitLines(
  splits: LineItemSplitRow[],
  amount: number,
  maxMembers = 6,
): string[] {
  if (splits.length === 0) return []
  const shown = splits.slice(0, maxMembers)
  const lines = shown.map((s) => {
    const dollar = ((s.percentage / 100) * amount).toFixed(2)
    return RECEIPTS.LABELS.LINE_ITEM_SPLIT_MEMBER(s.nickname, dollar, s.percentage)
  })
  const remaining = splits.length - maxMembers
  if (remaining > 0) {
    lines.push(RECEIPTS.LABELS.LINE_ITEM_SPLIT_MORE(remaining))
  }
  return lines
}

export function formatLineItemSplitSummary(
  splits: LineItemSplitRow[],
  amount: number,
  maxMembers = 3,
): string {
  return getLineItemSplitLines(splits, amount, maxMembers).join(
    RECEIPTS.LABELS.LINE_ITEM_SPLIT_SEPARATOR,
  )
}

export function withConfiguredFlags(
  configs: LineItemConfig[],
  memberCount: number,
  ctx?: SplitResolverContext,
): LineItemConfig[] {
  return configs.map((c) => ({
    ...c,
    configured:
      c.householdItemId !== null &&
      c.configured &&
      hasValidSplitAssignment(c, memberCount, ctx),
  }))
}

export function firstUnconfiguredIndex(configs: LineItemConfig[]): number {
  const idx = configs.findIndex((c) => !isLineItemConfirmed(c))
  return idx === -1 ? 0 : idx
}

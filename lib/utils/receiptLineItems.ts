import { RECEIPTS } from '@/locales/en'
import { buildEqualPercentages, splitsSumTo100, roundPercentage, SPLIT_TOTAL } from '@/lib/utils/splits'
import type { LineItemConfig, LineItemSplitRow } from '@/lib/types/receipts'
import type { GuestSplitRow, HouseholdGuest } from '@/lib/types/guests'

export type LineItemStatus = 'matched' | 'setup' | 'auto' | 'default_split' | 'set_up' | 'unassigned'

export interface SplitResolverContext {
  categories: Array<{
    id: string
    splits: Array<{ household_member_id: string; percentage: number; nickname: string | null }>
  }>
  allMembers: Array<{ id: string; name: string }>
}

export interface DisplaySplitRow {
  type: 'member' | 'guest'
  id: string
  displayName: string
  percentage: number
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
  if (config.guestSplits.length > 0 && config.useCustomSplit) {
    return config.customSplits
  }
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
  const percentages = buildEqualPercentages(ctx.allMembers.length)
  return ctx.allMembers.map((m, i) => ({
    household_member_id: m.id,
    nickname: m.name,
    percentage: percentages[i],
  }))
}

function buildEqualParticipantSplits(
  config: LineItemConfig,
  ctx: SplitResolverContext,
): Pick<LineItemConfig, 'customSplits' | 'guestSplits' | 'useCustomSplit'> {
  const memberRows = getSplitsForLineItem(
    { ...config, guestSplits: [], useCustomSplit: config.useCustomSplit && config.splitCustomized },
    ctx,
  )
  const guests = config.guestSplits
  const totalCount = memberRows.length + guests.length
  const percentages = buildEqualPercentages(totalCount)

  const customSplits: LineItemSplitRow[] = memberRows.map((m, i) => ({
    ...m,
    percentage: percentages[i],
  }))
  const guestSplits: GuestSplitRow[] = guests.map((g, i) => ({
    ...g,
    percentage: percentages[memberRows.length + i],
  }))

  return { customSplits, guestSplits, useCustomSplit: true }
}

export function rebalanceLineItemParticipants(
  config: LineItemConfig,
  ctx: SplitResolverContext,
): LineItemConfig {
  if (config.guestSplits.length === 0) {
    return config
  }

  const memberSplits = config.useCustomSplit && config.splitCustomized
    ? config.customSplits
    : getSplitsForLineItem({ ...config, guestSplits: [] }, ctx)
  const guestSplits = config.guestSplits
  const allPcts = [
    ...memberSplits.map((s) => s.percentage),
    ...guestSplits.map((s) => s.percentage),
  ]

  if (!config.splitCustomized || !splitsSumTo100(allPcts.map((p) => ({ percentage: p })))) {
    const equal = buildEqualParticipantSplits(config, ctx)
    return {
      ...config,
      ...equal,
      splitCustomized: false,
    }
  }

  return {
    ...config,
    useCustomSplit: true,
    customSplits: memberSplits,
    guestSplits,
  }
}

export function applyGuestToLineItem(
  config: LineItemConfig,
  guest: HouseholdGuest,
  ctx: SplitResolverContext,
): LineItemConfig {
  if (config.guestSplits.some((g) => g.guest_id === guest.id)) {
    return config
  }
  const withGuest: LineItemConfig = {
    ...config,
    guestSplits: [
      ...config.guestSplits,
      { guest_id: guest.id, name: guest.name, percentage: 0 },
    ],
    splitCustomized: false,
  }
  return rebalanceLineItemParticipants(withGuest, ctx)
}

export function applyReceiptGuestChange(
  configs: LineItemConfig[],
  prevGuests: HouseholdGuest[],
  nextGuests: HouseholdGuest[],
  ctx: SplitResolverContext,
): LineItemConfig[] {
  const prevIds = new Set(prevGuests.map((g) => g.id))
  const nextIds = new Set(nextGuests.map((g) => g.id))
  const added = nextGuests.filter((g) => !prevIds.has(g.id))
  const removed = prevGuests.filter((g) => !nextIds.has(g.id))

  return configs.map((config) => {
    const withAdded = added.reduce(
      (acc, guest) => applyGuestToLineItem(acc, guest, ctx),
      config,
    )
    return removed.reduce(
      (acc, guest) => removeGuestFromLineItem(acc, guest.id, ctx),
      withAdded,
    )
  })
}

export function syncReceiptGuestsToConfigs(
  configs: LineItemConfig[],
  receiptGuests: HouseholdGuest[],
  ctx: SplitResolverContext,
): LineItemConfig[] {
  return applyReceiptGuestChange(configs, [], receiptGuests, ctx)
}

export function removeGuestFromLineItem(
  config: LineItemConfig,
  guestId: string,
  ctx: SplitResolverContext,
): LineItemConfig {
  const guestSplits = config.guestSplits.filter((g) => g.guest_id !== guestId)
  if (guestSplits.length === config.guestSplits.length) {
    return config
  }

  if (guestSplits.length === 0) {
    return {
      ...config,
      guestSplits: [],
      splitCustomized: false,
      useCustomSplit: config.useCustomSplit && config.customSplits.length > 0,
    }
  }

  return rebalanceLineItemParticipants(
    { ...config, guestSplits, splitCustomized: false },
    ctx,
  )
}

export function getDisplaySplitsForLineItem(
  config: LineItemConfig,
  ctx: SplitResolverContext,
): DisplaySplitRow[] {
  const memberRows = config.guestSplits.length > 0 && config.useCustomSplit
    ? config.customSplits
    : getSplitsForLineItem(config, ctx)

  const members: DisplaySplitRow[] = memberRows.map((s) => ({
    type: 'member',
    id: s.household_member_id,
    displayName: s.nickname,
    percentage: s.percentage,
  }))

  const guests: DisplaySplitRow[] = (config.guestSplits ?? []).map((s) => ({
    type: 'guest',
    id: s.guest_id,
    displayName: s.name,
    percentage: s.percentage,
  }))

  return [...members, ...guests]
}

export function participantSplitsFromDisplay(
  displayRows: DisplaySplitRow[],
  ctx: SplitResolverContext,
): Pick<LineItemConfig, 'customSplits' | 'guestSplits'> {
  const customSplits: LineItemSplitRow[] = displayRows
    .filter((r) => r.type === 'member')
    .map((r) => ({
      household_member_id: r.id,
      nickname: ctx.allMembers.find((m) => m.id === r.id)?.name ?? r.displayName,
      percentage: r.percentage,
    }))
  const guestSplits: GuestSplitRow[] = displayRows
    .filter((r) => r.type === 'guest')
    .map((r) => ({
      guest_id: r.id,
      name: r.displayName,
      percentage: r.percentage,
    }))
  return { customSplits, guestSplits }
}

export function balanceParticipantSplits(
  rows: DisplaySplitRow[],
  changedId: string,
  newPercentage: number,
): DisplaySplitRow[] {
  const clamped = Math.min(SPLIT_TOTAL, Math.max(0, roundPercentage(newPercentage)))
  const others = rows.filter((r) => r.id !== changedId)
  if (others.length === 0) {
    return rows.map((r) => ({ ...r, percentage: SPLIT_TOTAL }))
  }

  const remaining = roundPercentage(SPLIT_TOTAL - clamped)
  const otherTotal = others.reduce((sum, r) => sum + r.percentage, 0)
  let assigned = 0

  const rebalancedOthers = others.map((row, index) => {
    const pct = index === others.length - 1
      ? roundPercentage(remaining - assigned)
      : roundPercentage(remaining * (otherTotal > 0 ? row.percentage / otherTotal : 1 / others.length))
    assigned += pct
    return { ...row, percentage: pct }
  })

  return rows.map((row) =>
    row.id === changedId
      ? { ...row, percentage: clamped }
      : rebalancedOthers.find((o) => o.id === row.id) ?? row,
  )
}

export function usesDefaultEqualSplit(
  config: LineItemConfig,
  memberCount: number,
): boolean {
  return (
    memberCount > 0 &&
    config.guestSplits.length === 0 &&
    !config.useCustomSplit &&
    config.categoryId === null &&
    config.householdItemId === null
  )
}

function getMemberSplitsForValidation(
  c: LineItemConfig,
  ctx: SplitResolverContext,
): LineItemSplitRow[] {
  if (c.guestSplits.length > 0) {
    return c.useCustomSplit ? c.customSplits : getSplitsForLineItem(c, ctx).slice(0, ctx.allMembers.length)
  }
  return getSplitsForLineItem(c, ctx)
}

export function hasValidSplitAssignment(
  c: LineItemConfig,
  memberCount: number,
  ctx?: SplitResolverContext,
): boolean {
  if (memberCount === 0) return false

  if (c.guestSplits.length > 0) {
    if (!ctx) return false
    const memberSplits = c.useCustomSplit
      ? c.customSplits
      : getSplitsForLineItem({ ...c, guestSplits: [] }, ctx)
    const allPcts = [
      ...memberSplits.map((s) => ({ percentage: s.percentage })),
      ...c.guestSplits.map((s) => ({ percentage: s.percentage })),
    ]
    return allPcts.length > 0 && splitsSumTo100(allPcts)
  }

  if (c.householdItemId !== null) {
    if (!ctx) return true
    const resolved = getMemberSplitsForValidation(c, ctx)
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

export function isLineItemAutoMatched(c: LineItemConfig): boolean {
  return (
    c.householdItemId !== null ||
    (c.categoryAutoMatched && c.categoryId !== null)
  )
}

export function getLineItemStatus(
  c: LineItemConfig,
  memberCount: number,
  ctx?: SplitResolverContext,
): LineItemStatus {
  if (isLineItemAutoMatched(c)) {
    if (ctx && !hasValidSplitAssignment(c, memberCount, ctx)) return 'setup'
    return 'matched'
  }

  return 'setup'
}

export function lineItemStatusLabel(status: LineItemStatus, memberCount = 0): string {
  switch (status) {
    case 'matched':
      return RECEIPTS.ITEM_SETUP.STATUS_MATCHED
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
    case 'setup':
    case 'default_split':
    case 'set_up':
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

export function getDisplaySplitLines(
  displayRows: DisplaySplitRow[],
  amount: number,
  maxRows = 6,
): string[] {
  if (displayRows.length === 0) return []
  const shown = displayRows.slice(0, maxRows)
  const lines = shown.map((s) => {
    const dollar = ((s.percentage / 100) * amount).toFixed(2)
    const label = s.type === 'guest'
      ? RECEIPTS.LABELS.LINE_ITEM_SPLIT_GUEST(s.displayName, dollar, s.percentage)
      : RECEIPTS.LABELS.LINE_ITEM_SPLIT_MEMBER(s.displayName, dollar, s.percentage)
    return label
  })
  const remaining = displayRows.length - maxRows
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

export function formatDisplaySplitSummary(
  displayRows: DisplaySplitRow[],
  amount: number,
  maxRows = 3,
): string {
  return getDisplaySplitLines(displayRows, amount, maxRows).join(
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
    configured: c.setupMode === 'item'
      ? (c.householdItemId !== null || (c.saveAsHouseholdItem && (c.resolvedItemName ?? '').length > 0)) &&
        c.configured &&
        hasValidSplitAssignment(c, memberCount, ctx)
      : c.configured && hasValidSplitAssignment(c, memberCount, ctx),
  }))
}

export function firstUnconfiguredIndex(configs: LineItemConfig[]): number {
  const idx = configs.findIndex((c) => !isLineItemConfirmed(c))
  return idx === -1 ? 0 : idx
}

export function shouldCreateHouseholdItemOnSave(c: LineItemConfig): boolean {
  return c.setupMode === 'item' && c.saveAsHouseholdItem && c.householdItemId === null
}

export function shouldUpsertAliasesOnSave(c: LineItemConfig): boolean {
  return c.setupMode === 'item' && c.householdItemId !== null
}

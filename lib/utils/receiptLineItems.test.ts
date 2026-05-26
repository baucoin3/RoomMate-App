import { describe, it, expect } from 'vitest'
import {
  shouldCreateHouseholdItemOnSave,
  shouldUpsertAliasesOnSave,
  applyGuestToLineItem,
  applyReceiptGuestChange,
  syncReceiptGuestsToConfigs,
  removeGuestFromLineItem,
  rebalanceLineItemParticipants,
  hasValidSplitAssignment,
  getDisplaySplitsForLineItem,
} from './receiptLineItems'
import type { LineItemConfig } from '@/lib/types/receipts'
import type { HouseholdGuest } from '@/lib/types/guests'
import type { SplitResolverContext } from './receiptLineItems'

function baseConfig(overrides: Partial<LineItemConfig> = {}): LineItemConfig {
  return {
    description: 'Bud Light 6pk',
    amount: 12.99,
    quantity: 1,
    setupMode: 'category',
    categoryId: 'cat-alcohol',
    useCustomSplit: false,
    customSplits: [],
    guestSplits: [],
    splitCustomized: false,
    saveAsHouseholdItem: false,
    householdItemId: null,
    resolvedItemName: null,
    matchSource: null,
    rememberAlias: false,
    categoryAutoMatched: true,
    itemGroup: '',
    configured: true,
    active: true,
    ...overrides,
  }
}

describe('shouldCreateHouseholdItemOnSave', () => {
  it('returns false for category mode', () => {
    expect(shouldCreateHouseholdItemOnSave(baseConfig())).toBe(false)
  })

  it('returns false for category mode even when saveAsHouseholdItem is true', () => {
    expect(
      shouldCreateHouseholdItemOnSave(
        baseConfig({ setupMode: 'category', saveAsHouseholdItem: true }),
      ),
    ).toBe(false)
  })

  it('returns true for item mode with saveAsHouseholdItem and no householdItemId', () => {
    expect(
      shouldCreateHouseholdItemOnSave(
        baseConfig({
          setupMode: 'item',
          saveAsHouseholdItem: true,
          resolvedItemName: 'Milk',
        }),
      ),
    ).toBe(true)
  })

  it('returns false for item mode with toggle off and no householdItemId', () => {
    expect(
      shouldCreateHouseholdItemOnSave(
        baseConfig({ setupMode: 'item', saveAsHouseholdItem: false }),
      ),
    ).toBe(false)
  })

  it('returns false for item mode with existing householdItemId', () => {
    expect(
      shouldCreateHouseholdItemOnSave(
        baseConfig({
          setupMode: 'item',
          saveAsHouseholdItem: true,
          householdItemId: 'item-123',
        }),
      ),
    ).toBe(false)
  })
})

describe('shouldUpsertAliasesOnSave', () => {
  it('returns false for category mode', () => {
    expect(shouldUpsertAliasesOnSave(baseConfig())).toBe(false)
  })

  it('returns false for category mode even with stale householdItemId', () => {
    expect(
      shouldUpsertAliasesOnSave(
        baseConfig({ setupMode: 'category', householdItemId: 'item-123' }),
      ),
    ).toBe(false)
  })

  it('returns true for item mode with matched householdItemId', () => {
    expect(
      shouldUpsertAliasesOnSave(
        baseConfig({
          setupMode: 'item',
          householdItemId: 'item-123',
          resolvedItemName: 'Milk',
          matchSource: 'catalog',
        }),
      ),
    ).toBe(true)
  })

  it('returns false for item mode without householdItemId', () => {
    expect(
      shouldUpsertAliasesOnSave(
        baseConfig({ setupMode: 'item', saveAsHouseholdItem: true }),
      ),
    ).toBe(false)
  })
})

const ctx: SplitResolverContext = {
  categories: [{
    id: 'cat-alcohol',
    splits: [
      { household_member_id: 'm1', percentage: 50, nickname: 'Alex' },
      { household_member_id: 'm2', percentage: 50, nickname: 'Jordan' },
    ],
  }],
  allMembers: [
    { id: 'm1', name: 'Alex' },
    { id: 'm2', name: 'Jordan' },
  ],
}

describe('guest split rebalancing', () => {
  it('equalizes 2 members + 2 guests to 25% each', () => {
    const config = baseConfig({ categoryId: 'cat-alcohol' })
    const withGuests = applyGuestToLineItem(config, { id: 'g1', name: 'Sam', household_id: 'h', email: null, expires_at: null, created_by: null, created_at: '' }, ctx)
    const result = applyGuestToLineItem(withGuests, { id: 'g2', name: 'Pat', household_id: 'h', email: null, expires_at: null, created_by: null, created_at: '' }, ctx)
    const display = getDisplaySplitsForLineItem(result, ctx)
    expect(display).toHaveLength(4)
    display.forEach((row) => expect(row.percentage).toBe(25))
    expect(hasValidSplitAssignment(result, 2, ctx)).toBe(true)
  })

  it('equalizes custom 60/40 members + 1 guest when not customized', () => {
    const config = baseConfig({
      useCustomSplit: true,
      customSplits: [
        { household_member_id: 'm1', nickname: 'Alex', percentage: 60 },
        { household_member_id: 'm2', nickname: 'Jordan', percentage: 40 },
      ],
    })
    const result = applyGuestToLineItem(
      config,
      { id: 'g1', name: 'Sam', household_id: 'h', email: null, expires_at: null, created_by: null, created_at: '' },
      ctx,
    )
    const display = getDisplaySplitsForLineItem(result, ctx)
    expect(display).toHaveLength(3)
    expect(display.map((row) => row.percentage)).toEqual([33.33, 33.33, 33.34])
    expect(hasValidSplitAssignment(result, 2, ctx)).toBe(true)
  })

  it('equalizes 3 participants to percentages summing to 100', () => {
    const config = baseConfig({ categoryId: 'cat-alcohol' })
    const withGuest = applyGuestToLineItem(
      config,
      { id: 'g1', name: 'Sam', household_id: 'h', email: null, expires_at: null, created_by: null, created_at: '' },
      ctx,
    )
    const display = getDisplaySplitsForLineItem(withGuest, ctx)
    expect(display).toHaveLength(3)
    const total = display.reduce((sum, row) => sum + row.percentage, 0)
    expect(total).toBe(100)
    expect(hasValidSplitAssignment(withGuest, 2, ctx)).toBe(true)
  })

  it('preserves custom splits when splitCustomized is true and sums to 100', () => {
    const config = baseConfig({
      splitCustomized: true,
      useCustomSplit: true,
      guestSplits: [{ guest_id: 'g1', name: 'Sam', percentage: 20 }],
      customSplits: [
        { household_member_id: 'm1', nickname: 'Alex', percentage: 50 },
        { household_member_id: 'm2', nickname: 'Jordan', percentage: 30 },
      ],
    })
    const result = rebalanceLineItemParticipants(config, ctx)
    expect(result.customSplits[0].percentage).toBe(50)
    expect(result.customSplits[1].percentage).toBe(30)
    expect(result.guestSplits[0].percentage).toBe(20)
    expect(hasValidSplitAssignment(result, 2, ctx)).toBe(true)
  })

  it('member-only configs unchanged when no guests', () => {
    const config = baseConfig({ categoryId: 'cat-alcohol' })
    const result = rebalanceLineItemParticipants(config, ctx)
    expect(result.guestSplits).toHaveLength(0)
    expect(result.useCustomSplit).toBe(false)
  })
})

const guestSam: HouseholdGuest = {
  id: 'g1',
  name: 'Sam',
  household_id: 'h',
  email: null,
  expires_at: null,
  created_by: null,
  created_at: '',
}

const guestPat: HouseholdGuest = {
  id: 'g2',
  name: 'Pat',
  household_id: 'h',
  email: null,
  expires_at: null,
  created_by: null,
  created_at: '',
}

describe('receipt-level guest sync', () => {
  it('syncReceiptGuestsToConfigs adds guests to every line item', () => {
    const configs = [
      baseConfig({ description: 'Item A', amount: 10 }),
      baseConfig({ description: 'Item B', amount: 20 }),
    ]
    const result = syncReceiptGuestsToConfigs(configs, [guestSam, guestPat], ctx)
    expect(result).toHaveLength(2)
    result.forEach((config) => {
      expect(config.guestSplits).toHaveLength(2)
      expect(config.guestSplits.map((g) => g.guest_id)).toEqual(['g1', 'g2'])
      expect(hasValidSplitAssignment(config, 2, ctx)).toBe(true)
    })
  })

  it('applyReceiptGuestChange adds a guest to all configs', () => {
    const configs = [baseConfig(), baseConfig({ description: 'Other' })]
    const result = applyReceiptGuestChange(configs, [], [guestSam], ctx)
    result.forEach((config) => {
      expect(config.guestSplits).toHaveLength(1)
      expect(config.guestSplits[0].guest_id).toBe('g1')
    })
  })

  it('applyReceiptGuestChange removes a guest from all configs', () => {
    const withGuest = applyGuestToLineItem(baseConfig(), guestSam, ctx)
    const configs = [withGuest, applyGuestToLineItem(baseConfig({ description: 'Other' }), guestSam, ctx)]
    const result = applyReceiptGuestChange(configs, [guestSam], [], ctx)
    result.forEach((config) => {
      expect(config.guestSplits).toHaveLength(0)
    })
  })

  it('applyReceiptGuestChange preserves per-item-only guests when removing receipt guest', () => {
    const itemOnlyGuest = applyGuestToLineItem(baseConfig(), guestPat, ctx)
    const withBoth = applyGuestToLineItem(itemOnlyGuest, guestSam, ctx)
    const result = applyReceiptGuestChange([withBoth], [guestSam], [], ctx)
    expect(result[0].guestSplits).toHaveLength(1)
    expect(result[0].guestSplits[0].guest_id).toBe('g2')
  })

  it('removeGuestFromLineItem removes only the targeted guest', () => {
    let config = applyGuestToLineItem(baseConfig(), guestSam, ctx)
    config = applyGuestToLineItem(config, guestPat, ctx)
    const result = removeGuestFromLineItem(config, 'g1', ctx)
    expect(result.guestSplits).toHaveLength(1)
    expect(result.guestSplits[0].guest_id).toBe('g2')
  })
})

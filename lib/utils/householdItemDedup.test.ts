import { describe, it, expect } from 'vitest'
import { dedupeNewHouseholdItems } from './householdItemDedup'
import type { NewHouseholdItemInput } from '@/lib/types/receipts'

describe('dedupeNewHouseholdItems', () => {
  it('merges 3× candy with different aliases into one row', () => {
    const items: NewHouseholdItemInput[] = [
      { name: 'candy', default_category_id: null, initial_aliases: ['CANDY BAR'] },
      { name: 'candy', default_category_id: null, initial_aliases: ['chocolate candy'] },
      { name: 'candy', default_category_id: null, initial_aliases: ['CANDY BAR', 'gummy'] },
    ]
    const result = dedupeNewHouseholdItems(items)
    expect(result).toHaveLength(1)
    expect(result[0].name).toBe('candy')
    expect(result[0].initial_aliases).toEqual(['CANDY BAR', 'chocolate candy', 'gummy'])
  })

  it('merges initial_aliases that normalize to the same key', () => {
    const items: NewHouseholdItemInput[] = [
      { name: 'candy', default_category_id: null, initial_aliases: ['CANDY BAR', 'candy bar'] },
    ]
    const result = dedupeNewHouseholdItems(items)
    expect(result).toHaveLength(1)
    expect(result[0].initial_aliases).toEqual(['CANDY BAR'])
  })

  it('treats Candy then candy as one row with last display name', () => {
    const items: NewHouseholdItemInput[] = [
      { name: 'Candy', default_category_id: null },
      { name: 'candy', default_category_id: null },
    ]
    const result = dedupeNewHouseholdItems(items)
    expect(result).toHaveLength(1)
    expect(result[0].name).toBe('candy')
    expect(result[0].normalizedName).toBe('candy')
  })

  it('filters empty and whitespace-only names', () => {
    const items: NewHouseholdItemInput[] = [
      { name: '', default_category_id: null },
      { name: '   ', default_category_id: null },
      { name: 'chips', default_category_id: null },
    ]
    const result = dedupeNewHouseholdItems(items)
    expect(result).toHaveLength(1)
    expect(result[0].name).toBe('chips')
  })

  it('keeps last row split_overrides when duplicates disagree', () => {
    const firstOverrides = [{ member_id: 'a', percentage: 50 }]
    const lastOverrides = [{ member_id: 'b', percentage: 100 }]
    const items: NewHouseholdItemInput[] = [
      { name: 'candy', default_category_id: null, split_overrides: firstOverrides },
      { name: 'candy', default_category_id: null, split_overrides: lastOverrides },
    ]
    const result = dedupeNewHouseholdItems(items)
    expect(result).toHaveLength(1)
    expect(result[0].split_overrides).toEqual(lastOverrides)
  })

  it('dedupes multiple distinct names', () => {
    const items: NewHouseholdItemInput[] = [
      { name: 'candy', default_category_id: null },
      { name: 'chips', default_category_id: null },
      { name: 'chips', default_category_id: null },
    ]
    const result = dedupeNewHouseholdItems(items)
    expect(result).toHaveLength(2)
    expect(result.map((r) => r.name).sort()).toEqual(['candy', 'chips'])
  })

  it('uses last wins for default_category_id when duplicates disagree', () => {
    const items: NewHouseholdItemInput[] = [
      { name: 'milk', default_category_id: 'cat-1' },
      { name: 'milk', default_category_id: 'cat-2' },
    ]
    const result = dedupeNewHouseholdItems(items)
    expect(result).toHaveLength(1)
    expect(result[0].default_category_id).toBe('cat-2')
  })
})

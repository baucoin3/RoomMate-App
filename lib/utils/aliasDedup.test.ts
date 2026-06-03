import { describe, it, expect } from 'vitest'
import {
  dedupeAliasRowsInBatch,
  filterAliasesAlreadyLinked,
  type AliasUpsertRow,
} from './aliasDedup'

const HOUSEHOLD_ID = 'household-1'

describe('dedupeAliasRowsInBatch', () => {
  it('merges KOZEL BEER + and Kozel Beer into one row with normalized alias_text', () => {
    const result = dedupeAliasRowsInBatch(HOUSEHOLD_ID, [
      { household_item_id: 'item-1', display_text: 'KOZEL BEER +' },
      { household_item_id: 'item-1', display_text: 'Kozel Beer' },
    ])
    expect(result).toHaveLength(1)
    expect(result[0].alias_text).toBe('kozel beer')
    expect(result[0].display_text).toBe('KOZEL BEER +')
    expect(result[0].household_item_id).toBe('item-1')
  })

  it('keeps 7 distinct LCBO-style descriptions as 7 rows', () => {
    const descriptions = [
      'SMIRNOFF VODKA 750ML',
      'GREY GOOSE VODKA',
      'JACK DANIELS WHISKEY',
      'CORONA EXTRA 6PK',
      'HEINEKEN LAGER 12PK',
      'TANQUERAY GIN 750',
      'BACARDI WHITE RUM',
    ]
    const result = dedupeAliasRowsInBatch(
      HOUSEHOLD_ID,
      descriptions.map((display_text) => ({
        household_item_id: 'alcohol-id',
        display_text,
      })),
    )
    expect(result).toHaveLength(7)
    expect(new Set(result.map((r) => r.alias_text)).size).toBe(7)
  })

  it('keeps last household_item_id when same alias_text maps to different items', () => {
    const result = dedupeAliasRowsInBatch(HOUSEHOLD_ID, [
      { household_item_id: 'item-a', display_text: 'Beer' },
      { household_item_id: 'item-b', display_text: 'beer' },
    ])
    expect(result).toHaveLength(1)
    expect(result[0].alias_text).toBe('beer')
    expect(result[0].display_text).toBe('Beer')
    expect(result[0].household_item_id).toBe('item-b')
  })

  it('drops empty and punctuation-only display text', () => {
    const result = dedupeAliasRowsInBatch(HOUSEHOLD_ID, [
      { household_item_id: 'item-1', display_text: '   ' },
      { household_item_id: 'item-1', display_text: '+++' },
      { household_item_id: 'item-1', display_text: 'chips' },
    ])
    expect(result).toHaveLength(1)
    expect(result[0].alias_text).toBe('chips')
  })
})

describe('filterAliasesAlreadyLinked', () => {
  const row = (alias_text: string, household_item_id: string): AliasUpsertRow => ({
    household_id: HOUSEHOLD_ID,
    household_item_id,
    alias_text,
    display_text: alias_text,
  })

  it('filters out rows already linked to the same item', () => {
    const rows = [row('kozel beer', 'item-a')]
    const result = filterAliasesAlreadyLinked(rows, [
      { alias_text: 'kozel beer', household_item_id: 'item-a' },
    ])
    expect(result).toHaveLength(0)
  })

  it('keeps rows when alias exists but points at a different item', () => {
    const rows = [row('kozel beer', 'item-b')]
    const result = filterAliasesAlreadyLinked(rows, [
      { alias_text: 'kozel beer', household_item_id: 'item-a' },
    ])
    expect(result).toHaveLength(1)
    expect(result[0].household_item_id).toBe('item-b')
  })
})
